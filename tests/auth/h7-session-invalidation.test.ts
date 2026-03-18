/**
 * H-7: 서버 측 세션 무효화 테스트
 *
 * 비밀번호 변경 시 기존 JWT를 무효화하는 메커니즘을 검증한다.
 * password_changed_at 타임스탬프와 JWT iat를 비교하여 세션 유효성을 결정한다.
 */

import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AdminStore } from "../../src/auth/admin-store.js";
import { AuthService } from "../../src/auth/auth-service.js";

/** 테스트용 임시 DB 경로를 생성한다. */
function make_temp_db(): string {
  return join(tmpdir(), `h7-test-${randomUUID()}.db`);
}

/** 테스트용 AdminStore + AuthService 쌍을 생성한다. */
function make_svc(db_path: string): { store: AdminStore; svc: AuthService } {
  const store = new AdminStore(db_path);
  const svc = new AuthService(store);
  return { store, svc };
}

/** Unix 초 단위 현재 시각. */
function now_unix(): number {
  return Math.floor(Date.now() / 1000);
}

describe("H-7: 서버 측 세션 무효화", () => {
  // ── 테스트 1: 비밀번호 변경 이전 발급 토큰은 거부 ──

  it("비밀번호 변경 이전 iat를 가진 토큰은 is_token_valid_for_user가 false를 반환한다", async () => {
    const db = make_temp_db();
    const { store, svc } = make_svc(db);

    // 사용자 생성
    const user = store.create_user({
      username: "alice",
      password_hash: "dummy_hash",
      system_role: "user",
    });

    // 비밀번호 변경 1초 전의 iat를 시뮬레이션
    const old_iat = now_unix() - 5; // 5초 전

    // 비밀번호 변경 — password_changed_at이 현재 시각으로 설정됨
    await svc.update_password(user.id, "new_password_123");

    // 변경 이전 iat는 거부되어야 함
    const result = svc.is_token_valid_for_user(user.id, old_iat);
    expect(result).toBe(false);
  });

  // ── 테스트 2: 비밀번호 변경 이후 발급 토큰은 허용 ──

  it("비밀번호 변경 이후 iat를 가진 토큰은 is_token_valid_for_user가 true를 반환한다", async () => {
    const db = make_temp_db();
    const { store, svc } = make_svc(db);

    const user = store.create_user({
      username: "bob",
      password_hash: "dummy_hash",
      system_role: "user",
    });

    // 비밀번호 변경
    await svc.update_password(user.id, "secure_pass_456");

    // 변경 이후의 iat (현재 시각 + 1초)
    const new_iat = now_unix() + 1;

    const result = svc.is_token_valid_for_user(user.id, new_iat);
    expect(result).toBe(true);
  });

  // ── 테스트 3: password_changed_at이 없는 레거시 계정은 토큰 허용 ──

  it("password_changed_at이 null인 레거시 계정은 하위 호환성을 위해 토큰을 허용한다", () => {
    const db = make_temp_db();
    const { store, svc } = make_svc(db);

    // password_changed_at 없이 사용자 생성 (레거시 시뮬레이션)
    const user = store.create_user({
      username: "legacy_user",
      password_hash: "old_hash",
      system_role: "user",
    });

    // password_changed_at 설정 없이 바로 검증
    const changed_at = store.get_password_changed_at(user.id);
    expect(changed_at).toBeNull();

    // 오래된 iat도 허용되어야 함 (레거시 계정)
    const old_iat = now_unix() - 3600; // 1시간 전
    const result = svc.is_token_valid_for_user(user.id, old_iat);
    expect(result).toBe(true);
  });

  // ── 테스트 4: update_password가 password_changed_at을 설정한다 ──

  it("update_password 호출 후 password_changed_at이 현재 시각 근처로 설정된다", async () => {
    const db = make_temp_db();
    const { store, svc } = make_svc(db);

    const user = store.create_user({
      username: "charlie",
      password_hash: "old_hash",
      system_role: "user",
    });

    const before = new Date().toISOString();
    await svc.update_password(user.id, "brand_new_pass_789");
    const after = new Date().toISOString();

    const changed_at = store.get_password_changed_at(user.id);
    expect(changed_at).not.toBeNull();

    // 변경 시각이 호출 전후 범위 내에 있어야 함
    expect(changed_at! >= before).toBe(true);
    expect(changed_at! <= after).toBe(true);
  });

  // ── 테스트 5: 여러 번 비밀번호 변경 시 마지막 변경만 유효 ──

  it("여러 번 비밀번호를 변경하면 마지막 변경 시각 기준으로만 검증한다", async () => {
    const db = make_temp_db();
    const { store, svc } = make_svc(db);

    const user = store.create_user({
      username: "diana",
      password_hash: "first_hash",
      system_role: "user",
    });

    // 첫 번째 비밀번호 변경
    await svc.update_password(user.id, "second_pass_aaa");
    const first_changed_at = store.get_password_changed_at(user.id);

    // 잠깐 대기 후 두 번째 비밀번호 변경 (순서 보장을 위해 1ms 대기)
    await new Promise((resolve) => setTimeout(resolve, 5));
    await svc.update_password(user.id, "third_pass_bbb");
    const second_changed_at = store.get_password_changed_at(user.id);

    // 두 번째 변경 시각이 첫 번째보다 이후이거나 같아야 함
    expect(second_changed_at).not.toBeNull();
    expect(second_changed_at! >= first_changed_at!).toBe(true);

    // 첫 번째 변경 이전 iat는 거부 (두 번째 변경 이후 기준으로도 이전이므로)
    const old_iat = now_unix() - 100;
    expect(svc.is_token_valid_for_user(user.id, old_iat)).toBe(false);

    // 두 번째 변경 이후 iat는 허용
    const fresh_iat = now_unix() + 5;
    expect(svc.is_token_valid_for_user(user.id, fresh_iat)).toBe(true);
  });

  // ── 테스트 6: 다른 사용자의 비밀번호 변경은 서로 영향을 주지 않는다 ──

  it("사용자 A의 비밀번호 변경이 사용자 B의 토큰 유효성에 영향을 주지 않는다", async () => {
    const db = make_temp_db();
    const { store, svc } = make_svc(db);

    const user_a = store.create_user({
      username: "user_a",
      password_hash: "hash_a",
      system_role: "user",
    });

    const user_b = store.create_user({
      username: "user_b",
      password_hash: "hash_b",
      system_role: "user",
    });

    // 사용자 A만 비밀번호 변경
    await svc.update_password(user_a.id, "a_new_password_xyz");

    const old_iat = now_unix() - 3600; // 1시간 전 발급된 iat

    // 사용자 A: 변경 이전 iat → 거부
    expect(svc.is_token_valid_for_user(user_a.id, old_iat)).toBe(false);

    // 사용자 B: password_changed_at 없음 → 레거시 허용
    const b_changed_at = store.get_password_changed_at(user_b.id);
    expect(b_changed_at).toBeNull();
    expect(svc.is_token_valid_for_user(user_b.id, old_iat)).toBe(true);
  });
});
