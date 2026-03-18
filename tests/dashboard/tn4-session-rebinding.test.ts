/**
 * TN-4 Team Switch / Session Rebinding 검증.
 *
 * 설계 완료 기준:
 *   - 팀 전환 후 이전 팀 세션이 재사용되지 않음
 *   - switch-team → JWT 재발급 + workspace runtime 사전 생성
 *
 * 보안 시나리오 (실제 침해 재현):
 *   1. alice가 team-alpha에서 chat 세션 생성
 *   2. alice가 team-beta로 팀 전환
 *   3. team-beta에서 team-alpha 세션 목록 → 빈 배열
 *   4. team-beta에서 team-alpha 세션 ID 직접 접근 → 404
 *   5. team-alpha로 다시 전환하면 세션 복원됨
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AdminStore } from "@src/auth/admin-store.js";
import { AuthService } from "@src/auth/auth-service.js";
import { TeamStore } from "@src/auth/team-store.js";
import { WorkspaceRegistry } from "@src/workspace/registry.js";
import { DashboardService } from "@src/dashboard/service.js";

// ── 픽스처 ──

const TEST_DIR = join(tmpdir(), `tn4-test-${randomUUID()}`);
const ADMIN_DB = join(TEST_DIR, "admin.db");
const TEAM_A = "team-alpha";
const TEAM_B = "team-beta";

let auth_svc: AuthService;
let dashboard: DashboardService;
let base_url: string;

/** alice — 양쪽 팀 모두 멤버십 있음 */
let token_alice_team_a: string;

function make_wdir(tid: string, uid: string): string {
  return `tenants/${tid}/users/${uid}`;
}

beforeAll(async () => {
  mkdirSync(join(TEST_DIR, "tenants", TEAM_A), { recursive: true });
  mkdirSync(join(TEST_DIR, "tenants", TEAM_B), { recursive: true });

  const admin_store = new AdminStore(ADMIN_DB);
  auth_svc = new AuthService(admin_store);
  const registry = new WorkspaceRegistry(TEST_DIR);

  admin_store.ensure_team("default", "Default");
  admin_store.ensure_team(TEAM_A, "Team Alpha");
  admin_store.ensure_team(TEAM_B, "Team Beta");

  const a_hash = await auth_svc.hash_password("a_pass");
  const alice = admin_store.create_user({ username: "alice", password_hash: a_hash, system_role: "user", default_team_id: TEAM_A });

  // alice → 양쪽 팀 모두 멤버십
  new TeamStore(join(TEST_DIR, "tenants", TEAM_A, "team.db"), TEAM_A).upsert_member(alice.id, "member");
  new TeamStore(join(TEST_DIR, "tenants", TEAM_B, "team.db"), TEAM_B).upsert_member(alice.id, "member");

  token_alice_team_a = auth_svc.sign_token({
    sub: alice.id, usr: "alice", role: "user",
    tid: TEAM_A, wdir: make_wdir(TEAM_A, alice.id),
  });

  dashboard = new DashboardService({
    host: "127.0.0.1",
    port: 0,
    port_fallback: true,
    workspace: TEST_DIR,
    auth_svc,
    workspace_registry: registry,
    agent: {} as any,
    bus: { publish_inbound: async () => {} } as any,
    channels: { get_status: () => ({ enabled_channels: [] }) } as any,
    heartbeat: {} as any,
    ops: {} as any,
    decisions: {} as any,
    promises: {} as any,
    events: { list: async () => [] } as any,
  });

  await dashboard.start();
  base_url = dashboard.get_url();
});

afterAll(async () => {
  await dashboard?.stop();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

// ── 헬퍼 ──

async function api(method: string, path: string, token: string, body?: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown>; cookies: string[] }> {
  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`,
  };
  const init: RequestInit = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${base_url}${path}`, init);
  const cookies = res.headers.getSetCookie?.() ?? [];
  const json = await res.json() as Record<string, unknown>;
  return { status: res.status, body: json, cookies };
}

function extract_token_from_cookie(cookies: string[]): string | null {
  for (const cookie of cookies) {
    const match = /sf_token=([^;]+)/.exec(cookie);
    if (match) return match[1];
  }
  return null;
}

// ── 테스트 ──

/** team-beta 토큰 — describe 간 공유. */
let token_alice_team_b: string;

describe("TN-4: 팀 전환 후 크로스팀 세션 격리", () => {
  let session_id: string;

  it("① team-alpha에서 chat 세션 생성", async () => {
    const res = await api("POST", "/api/chat/sessions", token_alice_team_a);
    expect(res.status).toBe(201);
    session_id = (res.body as Record<string, unknown>).id as string;
    expect(session_id).toBeTruthy();
  });

  it("② team-alpha에서 세션 목록 조회 → 1개", async () => {
    const res = await api("GET", "/api/chat/sessions", token_alice_team_a);
    expect(res.status).toBe(200);
    const sessions = res.body as unknown[];
    expect(sessions).toHaveLength(1);
  });

  it("③ team-beta로 팀 전환 → 새 JWT 발급", async () => {
    const res = await api("POST", "/api/auth/switch-team", token_alice_team_a, { team_id: TEAM_B });
    expect(res.status).toBe(200);
    expect((res.body as Record<string, unknown>).ok).toBe(true);

    const cookie_token = extract_token_from_cookie(res.cookies);
    expect(cookie_token).toBeTruthy();
    token_alice_team_b = cookie_token!;
  });

  it("④ team-beta에서 세션 목록 → 빈 배열 (team-alpha 세션 안 보임)", async () => {
    const res = await api("GET", "/api/chat/sessions", token_alice_team_b);
    expect(res.status).toBe(200);
    const sessions = res.body as unknown[];
    expect(sessions).toHaveLength(0);
  });

  it("⑤ team-beta에서 team-alpha 세션 ID 직접 접근 → 404 (크로스팀 접근 차단)", async () => {
    const res = await api("GET", `/api/chat/sessions/${session_id}`, token_alice_team_b);
    expect(res.status).toBe(404);
    expect((res.body as Record<string, unknown>).error).toBe("not_found");
  });

  it("⑥ team-alpha로 복귀 → 세션 다시 보임", async () => {
    const res = await api("GET", "/api/chat/sessions", token_alice_team_a);
    expect(res.status).toBe(200);
    const sessions = res.body as unknown[];
    expect(sessions).toHaveLength(1);
  });
});

describe("TN-4: session_store_key 팀 격리", () => {
  it("같은 user+chat_id라도 다른 team → 다른 세션 키", async () => {
    // team-beta에서도 세션 생성
    const res = await api("POST", "/api/chat/sessions", token_alice_team_b);
    expect(res.status).toBe(201);
    const session_b_id = (res.body as Record<string, unknown>).id as string;

    // team-alpha 세션 목록 → 여전히 1개 (team-beta 세션 안 섞임)
    const list_a = await api("GET", "/api/chat/sessions", token_alice_team_a);
    const sessions_a = list_a.body as unknown[];
    expect(sessions_a).toHaveLength(1);

    // team-beta 세션 목록 → 1개
    const list_b = await api("GET", "/api/chat/sessions", token_alice_team_b);
    const sessions_b = list_b.body as unknown[];
    expect(sessions_b).toHaveLength(1);

    // 각 팀 세션 ID가 다름
    expect((sessions_a[0] as Record<string, unknown>).id).not.toBe(session_b_id);
  });
});
