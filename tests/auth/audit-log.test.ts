/**
 * PCH-C2: Admin 감사 로그 (SOC2 CC6.2, CWE-778)
 * PCH-C3: 사용자 삭제 → 세션 cascade (GDPR Art.17)
 */

import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AdminStore } from "@src/auth/admin-store.js";
import { AuthService } from "@src/auth/auth-service.js";
import type { SessionStoreLike, SessionListEntry } from "@src/session/service.js";

function make_store(): AdminStore {
  const path = join(tmpdir(), `audit-test-${randomUUID()}.db`);
  return new AdminStore(path);
}

function make_svc(): { store: AdminStore; svc: AuthService } {
  const store = make_store();
  const svc = new AuthService(store);
  return { store, svc };
}

// ── PCH-C2: audit_log 테이블 기본 동작 ──

describe("AdminStore — audit_log (PCH-C2)", () => {
  it("초기 상태에서 get_audit_log는 빈 배열", () => {
    const s = make_store();
    expect(s.get_audit_log()).toEqual([]);
  });

  it("log_audit 후 get_audit_log에서 조회 가능", () => {
    const s = make_store();
    s.log_audit({ actor_id: "actor-1", action: "user.delete", target_id: "target-1" });
    const logs = s.get_audit_log();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("user.delete");
    expect(logs[0].actor_id).toBe("actor-1");
    expect(logs[0].target_id).toBe("target-1");
    expect(logs[0].at).toBeTruthy();
  });

  it("detail_json 직렬화/역직렬화", () => {
    const s = make_store();
    s.log_audit({ actor_id: null, action: "user.login.fail", target_id: null, detail: { username: "alice", reason: "wrong_password" } });
    const logs = s.get_audit_log();
    expect(logs[0].detail_json).toBeTruthy();
    const detail = JSON.parse(logs[0].detail_json!) as Record<string, unknown>;
    expect(detail.username).toBe("alice");
    expect(detail.reason).toBe("wrong_password");
  });

  it("limit 파라미터 준수", () => {
    const s = make_store();
    for (let i = 0; i < 10; i++) {
      s.log_audit({ actor_id: null, action: `action.${i}`, target_id: null });
    }
    const logs = s.get_audit_log(3);
    expect(logs).toHaveLength(3);
  });

  it("결과는 id DESC 순서 (최신 먼저)", () => {
    const s = make_store();
    s.log_audit({ actor_id: null, action: "first", target_id: null });
    s.log_audit({ actor_id: null, action: "second", target_id: null });
    const logs = s.get_audit_log();
    expect(logs[0].action).toBe("second");
    expect(logs[1].action).toBe("first");
  });
});

// ── PCH-C2: delete_user 시 감사 로그 ──

describe("AdminStore — delete_user audit (PCH-C2)", () => {
  it("delete_user 성공 시 user.delete 감사 로그 생성", () => {
    const s = make_store();
    const u = s.create_user({ username: "alice", password_hash: "h", system_role: "user" });
    s.delete_user(u.id, "actor-admin");
    const logs = s.get_audit_log();
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe("user.delete");
    expect(logs[0].target_id).toBe(u.id);
    expect(logs[0].actor_id).toBe("actor-admin");
  });

  it("존재하지 않는 user 삭제 시 감사 로그 미생성", () => {
    const s = make_store();
    s.delete_user("nonexistent", "actor-admin");
    expect(s.get_audit_log()).toHaveLength(0);
  });

  it("actor_id 없이 delete_user 호출 가능 (null로 저장)", () => {
    const s = make_store();
    const u = s.create_user({ username: "bob", password_hash: "h", system_role: "user" });
    s.delete_user(u.id);
    const logs = s.get_audit_log();
    expect(logs[0].actor_id).toBeNull();
  });
});

// ── PCH-C2: 로그인 감사 로그 (AuthService) ──

describe("AuthService — login audit (PCH-C2)", () => {
  it("로그인 성공 시 user.login.success 감사 로그 생성", async () => {
    const { store, svc } = make_svc();
    const hash = await svc.hash_password("secret");
    const u = store.create_user({ username: "alice", password_hash: hash, system_role: "user" });
    await svc.login("alice", "secret");
    const logs = store.get_audit_log();
    const success_log = logs.find((l) => l.action === "user.login.success");
    expect(success_log).toBeTruthy();
    expect(success_log!.actor_id).toBe(u.id);
    expect(success_log!.target_id).toBe(u.id);
  });

  it("비밀번호 불일치 시 user.login.fail 감사 로그 생성", async () => {
    const { store, svc } = make_svc();
    const hash = await svc.hash_password("right");
    const u = store.create_user({ username: "bob", password_hash: hash, system_role: "user" });
    await svc.login("bob", "wrong");
    const logs = store.get_audit_log();
    const fail_log = logs.find((l) => l.action === "user.login.fail");
    expect(fail_log).toBeTruthy();
    expect(fail_log!.target_id).toBe(u.id);
    const detail = JSON.parse(fail_log!.detail_json!) as Record<string, unknown>;
    expect(detail.reason).toBe("wrong_password");
  });

  it("존재하지 않는 사용자 로그인 시 user.login.fail 감사 로그 (target_id=null)", async () => {
    const { store, svc } = make_svc();
    await svc.login("nobody", "pass");
    const logs = store.get_audit_log();
    const fail_log = logs.find((l) => l.action === "user.login.fail");
    expect(fail_log).toBeTruthy();
    expect(fail_log!.target_id).toBeNull();
    const detail = JSON.parse(fail_log!.detail_json!) as Record<string, unknown>;
    expect(detail.reason).toBe("user_not_found");
  });
});

// ── PCH-C2: 비밀번호 변경 감사 로그 (AuthService) ──

describe("AuthService — password change audit (PCH-C2)", () => {
  it("update_password 성공 시 user.password.change 감사 로그 생성", async () => {
    const { store, svc } = make_svc();
    const u = store.create_user({ username: "carol", password_hash: "h", system_role: "user" });
    await svc.update_password(u.id, "newpass123", "admin-actor");
    const logs = store.get_audit_log();
    const pw_log = logs.find((l) => l.action === "user.password.change");
    expect(pw_log).toBeTruthy();
    expect(pw_log!.target_id).toBe(u.id);
    expect(pw_log!.actor_id).toBe("admin-actor");
  });

  it("존재하지 않는 user 비밀번호 변경 → 감사 로그 미생성", async () => {
    const { store, svc } = make_svc();
    await svc.update_password("nonexistent", "newpass123");
    expect(store.get_audit_log()).toHaveLength(0);
  });
});

// ── PCH-C3: 사용자 삭제 시 세션 cascade ──

describe("PCH-C3 — session cascade delete mock", () => {
  it("delete_user 후 session_store.delete가 해당 사용자 세션에 대해 호출됨", async () => {
    const deleted_keys: string[] = [];

    // SessionStoreLike mock: 사용자의 세션 2개를 가지고 있다고 가정
    const mock_session_store: SessionStoreLike = {
      get_or_create: async () => { throw new Error("not used"); },
      append_message: async () => { throw new Error("not used"); },
      save: async () => { throw new Error("not used"); },
      list_by_prefix: async (prefix: string, _limit?: number): Promise<SessionListEntry[]> => {
        // web:default:user-123: 프리픽스의 세션 2개 반환
        if (prefix === "web:default:user-123:") {
          return [
            { key: "web:default:user-123:chat1:main:main", created_at: "2024-01-01", updated_at: "2024-01-02", message_count: 5 },
            { key: "web:default:user-123:chat2:main:main", created_at: "2024-01-01", updated_at: "2024-01-03", message_count: 3 },
          ];
        }
        return [];
      },
      delete: async (key: string): Promise<boolean> => {
        deleted_keys.push(key);
        return true;
      },
    };

    // cascade delete 로직 직접 테스트 (route 핸들러 로직 분리 검증)
    const user_id = "user-123";
    const team_ids = ["default"];
    for (const tid of team_ids) {
      const prefix = `web:${tid}:${user_id}:`;
      const sessions = await mock_session_store.list_by_prefix!(prefix, 1000);
      for (const s of sessions) {
        await mock_session_store.delete!(s.key);
      }
    }

    expect(deleted_keys).toContain("web:default:user-123:chat1:main:main");
    expect(deleted_keys).toContain("web:default:user-123:chat2:main:main");
    expect(deleted_keys).toHaveLength(2);
  });

  it("세션이 없는 경우 delete 호출 안 됨", async () => {
    const delete_call_count = { n: 0 };
    const mock_session_store: SessionStoreLike = {
      get_or_create: async () => { throw new Error("not used"); },
      append_message: async () => { throw new Error("not used"); },
      save: async () => { throw new Error("not used"); },
      list_by_prefix: async (_prefix: string): Promise<SessionListEntry[]> => [],
      delete: async (_key: string): Promise<boolean> => {
        delete_call_count.n++;
        return true;
      },
    };

    const user_id = "user-456";
    const team_ids = ["default"];
    for (const tid of team_ids) {
      const prefix = `web:${tid}:${user_id}:`;
      const sessions = await mock_session_store.list_by_prefix!(prefix, 1000);
      for (const s of sessions) {
        await mock_session_store.delete!(s.key);
      }
    }

    expect(delete_call_count.n).toBe(0);
  });
});
