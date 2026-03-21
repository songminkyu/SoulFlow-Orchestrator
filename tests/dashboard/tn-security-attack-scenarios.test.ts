/**
 * TN 보안 공격 시나리오 테스트 (OWASP Top 10 관점).
 *
 * A01 Broken Access Control: 크로스팀/크로스유저 접근, 권한 상승
 * A03 Injection: JWT wdir path traversal
 * A04 Insecure Design: IDOR 세션 탈취
 * A07 Auth Failures: disabled 사용자 토큰, 비정상 JWT
 *
 * 공격자 관점: 실제 DashboardService HTTP 서버에 모든 공격을 시도.
 * 모든 테스트는 "이것이 차단되어야 한다"는 negative assertion.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AdminStore } from "@src/auth/admin-store.js";
import { AuthService } from "@src/auth/auth-service.js";
import { TeamStore } from "@src/auth/team-store.js";
import { WorkspaceRegistry } from "@src/workspace/registry.js";
import { DashboardService } from "@src/dashboard/service.js";

const TEST_DIR = join(tmpdir(), `tn-attack-${randomUUID()}`);
const ADMIN_DB = join(TEST_DIR, "admin.db");
const TEAM_A = "team-alpha";
const TEAM_B = "team-beta";

let auth_svc: AuthService;
let dashboard: DashboardService;
let base_url: string;

let token_alice_a: string;    // alice @ team-alpha (member)
let token_bob_b: string;      // bob @ team-beta (member)
function wdir(tid: string, uid: string): string { return `tenants/${tid}/users/${uid}`; }

beforeAll(async () => {
  mkdirSync(join(TEST_DIR, "tenants", TEAM_A), { recursive: true });
  mkdirSync(join(TEST_DIR, "tenants", TEAM_B), { recursive: true });

  const admin = new AdminStore(ADMIN_DB);
  auth_svc = new AuthService(admin);
  const registry = new WorkspaceRegistry(TEST_DIR);

  admin.ensure_team("default", "Default");
  admin.ensure_team(TEAM_A, "Team Alpha");
  admin.ensure_team(TEAM_B, "Team Beta");

  const sa = admin.create_user({ username: "superadmin", password_hash: await auth_svc.hash_password("sa"), system_role: "superadmin", default_team_id: TEAM_A });
  const alice = admin.create_user({ username: "alice", password_hash: await auth_svc.hash_password("a"), system_role: "user", default_team_id: TEAM_A });
  const bob = admin.create_user({ username: "bob", password_hash: await auth_svc.hash_password("b"), system_role: "user", default_team_id: TEAM_B });

  new TeamStore(join(TEST_DIR, "tenants", TEAM_A, "team.db"), TEAM_A).upsert_member(alice.id, "member");
  new TeamStore(join(TEST_DIR, "tenants", TEAM_B, "team.db"), TEAM_B).upsert_member(bob.id, "member");

  token_alice_a = auth_svc.sign_token({ sub: alice.id, usr: "alice", role: "user", tid: TEAM_A, wdir: wdir(TEAM_A, alice.id) });
  token_bob_b = auth_svc.sign_token({ sub: bob.id, usr: "bob", role: "user", tid: TEAM_B, wdir: wdir(TEAM_B, bob.id) });
  void sa; // superadmin 토큰은 bootstrap 가드 테스트에서 별도 파일 사용

  dashboard = new DashboardService({
    host: "127.0.0.1", port: 0, port_fallback: true, workspace: TEST_DIR,
    auth_svc, workspace_registry: registry,
    agent: {} as never,
    bus: { publish_inbound: async () => {} } as never,
    channels: { get_status: () => ({ enabled_channels: [] }) } as never,
    heartbeat: {} as never, ops: {} as never,
    decisions: {} as never, promises: {} as never,
    events: { list: async () => [] } as never,
  });

  await dashboard.start();
  base_url = dashboard.get_url();
});

afterAll(async () => {
  await dashboard?.stop();
  rmSync(TEST_DIR, { recursive: true, force: true });
});

async function api(method: string, path: string, token: string, body?: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { Accept: "application/json", Authorization: `Bearer ${token}` };
  const init: RequestInit = { method, headers };
  if (body) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(body); }
  const res = await fetch(`${base_url}${path}`, init);
  return { status: res.status, body: await res.json() as Record<string, unknown> };
}

// ══════════════════════════════════════════
// 공격 1: 비멤버 팀 접근 시도
// ══════════════════════════════════════════

describe("공격: 비멤버 팀 접근", () => {
  it("alice(team-alpha) → team-beta 멤버십 없으면 팀 전환 403", async () => {
    const res = await api("POST", "/api/auth/switch-team", token_alice_a, { team_id: TEAM_B });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_a_member");
  });

  it("bob(team-beta) → team-alpha 멤버십 없으면 팀 전환 403", async () => {
    const res = await api("POST", "/api/auth/switch-team", token_bob_b, { team_id: TEAM_A });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("not_a_member");
  });
});

// ══════════════════════════════════════════
// 공격 2: JWT wdir 조작 (path traversal via token)
// ══════════════════════════════════════════

describe("공격: JWT wdir 조작", () => {
  it("wdir를 superadmin 경로로 변조 → 401", async () => {
    const alice = auth_svc.sign_token({
      sub: "alice_id", usr: "alice", role: "user", tid: TEAM_A,
      wdir: `tenants/${TEAM_A}/users/SUPERADMIN_ID`,
    });
    const res = await api("GET", "/api/workflow/events", alice);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_token");
  });

  it("wdir에 path traversal 주입 → 401", async () => {
    const evil = auth_svc.sign_token({
      sub: "evil", usr: "evil", role: "user", tid: TEAM_A,
      wdir: "tenants/../../../etc/passwd",
    });
    const res = await api("GET", "/api/workflow/events", evil);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_token");
  });
});

// ══════════════════════════════════════════
// 공격 3: 크로스팀 세션 데이터 탈취
// ══════════════════════════════════════════

describe("공격: 크로스팀 세션 탈취", () => {
  let alice_session_id: string;

  it("alice가 team-alpha에서 세션 생성", async () => {
    const res = await api("POST", "/api/chat/sessions", token_alice_a);
    expect(res.status).toBe(201);
    alice_session_id = (res.body as Record<string, unknown>).id as string;
  });

  it("bob이 alice의 세션 ID를 알아도 접근 불가 → 404", async () => {
    const res = await api("GET", `/api/chat/sessions/${alice_session_id}`, token_bob_b);
    expect(res.status).toBe(404);
  });

  it("bob의 세션 목록에 alice 세션 없음", async () => {
    const res = await api("GET", "/api/chat/sessions", token_bob_b);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("bob이 alice 세션 삭제 시도 → 404", async () => {
    const res = await api("DELETE", `/api/chat/sessions/${alice_session_id}`, token_bob_b);
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════
// 공격 4: bootstrap 권한 상승
// ══════════════════════════════════════════

describe("공격: bootstrap 권한 상승", () => {
  it("일반 유저가 POST /api/bootstrap → 403", async () => {
    const res = await api("POST", "/api/bootstrap", token_alice_a, {
      providers: [{ instance_id: "evil", provider_type: "openai", token: "stolen_key" }],
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("superadmin_required");
  });
});

// ══════════════════════════════════════════
// 공격 5: 만료/비활성 사용자 토큰 재사용
// ══════════════════════════════════════════

describe("공격: disabled 사용자 토큰", () => {
  it("비활성화된 사용자 토큰 → 401", async () => {
    // 사용자 생성 + 토큰 발급 + 비활성화
    const admin = new AdminStore(ADMIN_DB);
    const doomed = admin.create_user({ username: "doomed", password_hash: await auth_svc.hash_password("d"), system_role: "user" });
    const token = auth_svc.sign_token({ sub: doomed.id, usr: "doomed", role: "user", tid: "default", wdir: wdir("default", doomed.id) });

    // 토큰 유효 확인
    const before = await api("GET", "/api/workflow/events", token);
    expect(before.status).toBe(200); // 미들웨어 통과

    // 사용자 비활성화
    admin.update_user(doomed.id, { disabled_at: new Date().toISOString() });

    // 같은 토큰으로 재시도 → 401
    const after = await api("GET", "/api/workflow/events", token);
    expect(after.status).toBe(401);
    expect(after.body.error).toBe("unauthorized");
  });
});

// ══════════════════════════════════════════
// A07: 비정상 JWT / 인증 우회 시도
// ══════════════════════════════════════════

describe("A07: 비정상 JWT 인증 우회", () => {
  it("빈 Bearer 토큰 → 401", async () => {
    const res = await fetch(`${base_url}/api/workflow/events`, { headers: { Authorization: "Bearer " } });
    expect(res.status).toBe(401);
  });

  it("조작된 JWT 서명 → 401", async () => {
    const parts = token_alice_a.split(".");
    const tampered = `${parts[0]}.${parts[1]}.INVALID_SIGNATURE`;
    const res = await api("GET", "/api/workflow/events", tampered);
    expect(res.status).toBe(401);
  });

  it("role을 superadmin으로 위조한 JWT → 401 (서명 불일치)", async () => {
    // 공격자가 자체 서명 키로 role:superadmin JWT를 생성해도, 서버의 JWT 시크릿과 불일치
    const forged = [
      Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
      Buffer.from(JSON.stringify({ sub: "alice", usr: "alice", role: "superadmin", tid: TEAM_A, wdir: wdir(TEAM_A, "alice"), iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"),
      "forged_signature_here",
    ].join(".");
    const res = await api("GET", "/api/workflow/events", forged);
    expect(res.status).toBe(401);
  });

  it("Authorization 헤더 없이 /api 요청 → 401", async () => {
    const res = await fetch(`${base_url}/api/workflow/events`, { headers: { Accept: "application/json" } });
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════
// A01: IDOR — 다른 유저의 리소스에 직접 ID로 접근
// ══════════════════════════════════════════

describe("A01: 크로스유저 세션 IDOR", () => {
  it("alice 세션을 bob이 PATCH(이름 변경) 시도 → 404", async () => {
    // alice 세션 생성
    const create = await api("POST", "/api/chat/sessions", token_alice_a);
    const sid = (create.body as Record<string, unknown>).id as string;

    // bob이 alice 세션 이름 변경 시도
    const res = await api("PATCH", `/api/chat/sessions/${sid}`, token_bob_b, { name: "stolen" });
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════
// A01: 수직 권한 상승 — 일반 유저가 admin 기능 접근
// ══════════════════════════════════════════

describe("A01: 수직 권한 상승", () => {
  it("일반 유저가 /api/admin/* 접근 → 403", async () => {
    const res = await api("GET", "/api/admin/users", token_alice_a);
    // admin 라우트는 superadmin_required
    expect([401, 403]).toContain(res.status);
  });

  it("일반 유저가 /api/admin/global-providers 접근 → 403", async () => {
    const res = await api("GET", "/api/admin/global-providers", token_alice_a);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════
// TN-6a: 보안 수정 직접 호출 검증
// ══════════════════════════════════════════

describe("TN-6a: references — member 접근 차단 (route handler 직접 호출)", () => {
  it("member(비manager) → 403 team_manager_required", async () => {
    const { handle_references } = await import("@src/dashboard/routes/references.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {}, url: new URL("/api/references", "http://localhost"),
      options: { auth_svc: {}, reference_store: { list_documents: () => [], get_stats: () => ({}) } },
      auth_user: { role: "user", sub: "alice", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_references(ctx);
    expect(sent[0].status).toBe(403);
    expect((sent[0].body as Record<string, unknown>).error).toBe("team_manager_required");
  });
});

describe("TN-6a: skills — member 쓰기 차단 (HTTP)", () => {
  it("member POST /api/skills/refresh → 403 (쓰기 차단)", async () => {
    const res = await api("POST", "/api/skills/refresh", token_alice_a);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("team_manager_required");
  });
});

describe("TN-6a: promises — member 쓰기 차단 (route handler 직접 호출)", () => {
  it("member POST → 403", async () => {
    const { handle_promise } = await import("@src/dashboard/routes/promise.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "POST", headers: {} }, res: {}, url: new URL("/api/promises", "http://localhost"),
      options: { auth_svc: {}, promises: { append_promise: async () => ({ action: "created", record: { id: "x" } }) } },
      auth_user: { role: "user", sub: "alice", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => ({ key: "k", value: "v" }),
    } as never;
    await handle_promise(ctx);
    expect(sent[0].status).toBe(403);
    expect((sent[0].body as Record<string, unknown>).error).toBe("team_manager_required");
  });
});

describe("TN-6a: kanban search — 비superadmin board_id 필수 (route handler 직접 호출)", () => {
  it("member board_id 없이 검색 → 400", async () => {
    const { handle_kanban } = await import("@src/dashboard/routes/kanban.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {}, url: new URL("/api/kanban/search?q=test", "http://localhost"),
      options: { auth_svc: {}, kanban_store: { search_cards: async () => [] } },
      auth_user: { role: "user", sub: "alice", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_kanban(ctx);
    expect(sent[0].status).toBe(400);
    expect((sent[0].body as Record<string, unknown>).error).toBe("board_id_required");
  });
});

describe("TN-6a: workflow/events — user_id 필터 직접 검증 (route handler 호출)", () => {
  it("member 요청 시 events.list에 user_id가 전달됨", async () => {
    const { handle_health } = await import("@src/dashboard/routes/health.js");
    const spy = vi.fn(async () => []);
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {},
      url: new URL("/api/workflow/events", "http://localhost"),
      options: { auth_svc: {}, events: { list: spy } },
      auth_user: { role: "user", sub: "alice_id", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
    } as never;
    await handle_health(ctx);
    expect(spy).toHaveBeenCalledTimes(1);
    const filter = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(filter.team_id).toBe("team-a");
    expect(filter.user_id).toBe("alice_id");
  });

  it("superadmin 요청 시 user_id/team_id 미전달 (전체 조회)", async () => {
    const { handle_health } = await import("@src/dashboard/routes/health.js");
    const spy = vi.fn(async () => []);
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {},
      url: new URL("/api/workflow/events", "http://localhost"),
      options: { auth_svc: {}, events: { list: spy } },
      auth_user: { role: "superadmin", sub: "admin1", tid: "t1" },
      team_context: null,
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
    } as never;
    await handle_health(ctx);
    expect(spy).toHaveBeenCalledTimes(1);
    const filter = spy.mock.calls[0][0] as Record<string, unknown>;
    expect(filter.team_id).toBeUndefined();
    expect(filter.user_id).toBeUndefined();
  });
});

describe("TN-6a: kanban relation delete — 비superadmin 차단", () => {
  it("member가 relation 삭제 시도 → 403", async () => {
    const { handle_kanban } = await import("@src/dashboard/routes/kanban.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "DELETE", headers: {} }, res: {},
      url: new URL("/api/kanban/relations/rel_123", "http://localhost"),
      options: { auth_svc: {}, kanban_store: { remove_relation: async () => true } },
      auth_user: { role: "user", sub: "alice", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_kanban(ctx);
    expect(sent[0].status).toBe(403);
    expect((sent[0].body as Record<string, unknown>).error).toBe("forbidden");
  });
});

// ══════════════════════════════════════════
// TN-6b: webhook 무인증 차단 직접 검증
// ══════════════════════════════════════════

describe("TN-6b: webhook — auth 활성 + secret 미설정 → 401", () => {
  it("auth 활성 + webhookSecret 없음 → 401", async () => {
    const { dispatch_webhook } = await import("@src/dashboard/routes/webhook.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const result = await dispatch_webhook(
      {
        webhook_store: { push: () => {} } as never,
        webhook_secret: undefined,
        auth_enabled: true,
        publish_inbound: async () => {},
        json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
        read_body: async () => null,
      },
      { method: "POST", headers: {} } as never,
      {} as never,
      new URL("/hooks/agent", "http://localhost"),
    );
    expect(result).toBe(true);
    expect(sent[0].status).toBe(401);
  });

  it("auth 비활성 + webhookSecret 없음 → 허용", async () => {
    const { dispatch_webhook } = await import("@src/dashboard/routes/webhook.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const result = await dispatch_webhook(
      {
        webhook_store: { push: () => {} } as never,
        webhook_secret: undefined,
        auth_enabled: false,
        publish_inbound: async () => {},
        json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
        read_body: async () => ({ task: "test" }),
      },
      { method: "POST", headers: {} } as never,
      {} as never,
      new URL("/hooks/agent", "http://localhost"),
    );
    expect(result).toBe(true);
    expect(sent[0].status).toBe(200);
  });
});

// ══════════════════════════════════════════
// TN-6b: recent_messages user_id 필터 직접 검증
// ══════════════════════════════════════════

describe("TN-6b: recent_messages — build_dashboard_state 직접 호출로 크로스유저 차단 검증", () => {
  it("user_id 필터 시 다른 유저 메시지 제외 (build_dashboard_state 직접 호출)", async () => {
    const { build_dashboard_state } = await import("@src/dashboard/state-builder.js");
    const messages = [
      { direction: "inbound" as const, sender_id: "alice", content: "alice msg", chat_id: "c1", team_id: "team-a", user_id: "alice", at: "2026-01-01" },
      { direction: "outbound" as const, sender_id: "bot", content: "bot reply to bob", chat_id: "c2", team_id: "team-a", user_id: "bob", at: "2026-01-01" },
      { direction: "inbound" as const, sender_id: "bob", content: "bob secret", chat_id: "c2", team_id: "team-a", user_id: "bob", at: "2026-01-01" },
    ];
    const noop = () => [];
    const anoop = async () => [];
    const mock_opts = {
      bus: { get_sizes: noop },
      channels: { get_status: () => ({ enabled_channels: [], connected_channels: [] }), get_channel_health: noop, get_active_run_count: () => 0 },
      ops: { status: noop },
      heartbeat: { status: noop },
      agent: { list_subagents: noop, list_runtime_tasks: noop, list_stored_tasks: anoop, list_approval_requests: noop, list_active_loops: noop },
      decisions: { get_effective_decisions: anoop },
      promises: { get_effective_promises: anoop },
      events: { list: anoop },
      process_tracker: { list_active: noop, list_recent: noop },
      agent_provider_ops: null, task_ops: null, cron: null, validator_summary_ops: null,
    } as never;
    const state = await build_dashboard_state(mock_opts, messages, "team-a", "alice");
    const result_messages = (state as Record<string, unknown>).messages as Array<Record<string, unknown>>;
    // alice 메시지만 — bob의 outbound도 제외
    expect(result_messages.some((m) => m.sender_id === "bob")).toBe(false);
    expect(result_messages.some((m) => String(m.content || "").includes("bob secret"))).toBe(false);
  });
});

// ══════════════════════════════════════════
// TN-6b: SSE /api/events — user_id 전달 직접 검증
// ══════════════════════════════════════════

describe("TN-6b: SSE /api/events — add_sse_client에 user_id 전달", () => {
  it("route handler가 add_sse_client에 team_id + user_id를 전달", async () => {
    const { handle_state } = await import("@src/dashboard/routes/state.js");
    const add_spy = vi.fn();
    const ctx = {
      url: new URL("/api/events", "http://localhost"),
      res: { statusCode: 0, setHeader: vi.fn(), write: vi.fn(), on: vi.fn() },
      options: { auth_svc: {} },
      auth_user: { role: "user", sub: "alice_id", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      add_sse_client: add_spy,
      json: vi.fn(),
      build_state: vi.fn(),
      metrics: { get_latest: () => ({}) },
    } as never;
    await handle_state(ctx);
    expect(add_spy).toHaveBeenCalledTimes(1);
    expect(add_spy.mock.calls[0][1]).toBe("team-a");  // team_id
    expect(add_spy.mock.calls[0][2]).toBe("alice_id"); // user_id
  });
});

// ══════════════════════════════════════════
// TN-6b: /media/<token> 인증 필수 (HTTP)
// ══════════════════════════════════════════

describe("TN-6b: /media/<token> — 인증 없으면 401", () => {
  it("auth 활성 시 토큰 없이 media 접근 → 401", async () => {
    const res = await fetch(`${base_url}/media/abcdef1234567890abcd`, {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("auth 활성 시 유효한 JWT로 media 접근 → 200 또는 404 (파일 없음)", async () => {
    const res = await fetch(`${base_url}/media/abcdef1234567890abcd`, {
      headers: { Authorization: `Bearer ${token_alice_a}` },
    });
    expect(res.status).not.toBe(401);
  });
});

// ══════════════════════════════════════════
// TN-6c: Cookie Secure 플래그 직접 검증
// ══════════════════════════════════════════

describe("TN-6c: Cookie Secure 플래그", () => {
  it("make_auth_cookie에 Secure 플래그 포함", async () => {
    const { make_auth_cookie, clear_auth_cookie } = await import("@src/auth/auth-middleware.js");
    const cookie = make_auth_cookie("test_token");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const clear = clear_auth_cookie();
    expect(clear).toContain("Secure");
  });
});

// ══════════════════════════════════════════
// TN-6c: DELETE /api/processes/:id 크로스유저 차단
// ══════════════════════════════════════════

describe("TN-6c: DELETE /api/processes — 크로스유저 차단", () => {
  it("다른 유저 프로세스 삭제 시도 → 404", async () => {
    const { handle_process } = await import("@src/dashboard/routes/process.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "DELETE", headers: {} }, res: {},
      url: new URL("/api/processes/run_123", "http://localhost"),
      options: {
        auth_svc: {},
        process_tracker: {
          get: () => ({ run_id: "run_123", team_id: "team-a", sender_id: "bob" }),
          cancel: async () => ({ cancelled: true }),
        },
      },
      auth_user: { role: "user", sub: "alice", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
    } as never;
    await handle_process(ctx);
    expect(sent[0].status).toBe(404); // alice가 bob의 프로세스 삭제 불가
  });

  it("본인 프로세스 삭제 → 200", async () => {
    const { handle_process } = await import("@src/dashboard/routes/process.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "DELETE", headers: {} }, res: {},
      url: new URL("/api/processes/run_456", "http://localhost"),
      options: {
        auth_svc: {},
        process_tracker: {
          get: () => ({ run_id: "run_456", team_id: "team-a", sender_id: "alice" }),
          cancel: async () => ({ cancelled: true }),
        },
      },
      auth_user: { role: "user", sub: "alice", tid: "team-a" },
      team_context: { team_id: "team-a", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
    } as never;
    await handle_process(ctx);
    expect(sent[0].status).toBe(200);
  });
});

// ══════════════════════════════════════════
// TN-6c: GET /api/config/sections/:section superadmin only
// ══════════════════════════════════════════

describe("TN-6c: GET /api/config/sections — 인증 사용자 허용", () => {
  it("일반 유저 → 200 (sections 읽기 허용)", async () => {
    const { default: handle_config } = await import("@src/dashboard/routes/config.js").then(m => ({ default: m.handle_config }));
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {},
      url: new URL("/api/config/sections/general", "http://localhost"),
      options: { auth_svc: {}, config_ops: { get_section: async () => ({ id: "general", label: "General", fields: [] }) } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_config(ctx);
    expect(sent[0].status).toBe(200);
  });
});

// ══════════════════════════════════════════
// TN-6c: _resolve_request_origin — publicUrl 우선, X-Forwarded-Host 무시
// ══════════════════════════════════════════

describe("TN-6c: resolve_request_origin — X-Forwarded-Host 하이재킹 방지 (직접 호출)", () => {
  it("publicUrl 설정 시 X-Forwarded-Host 무시", async () => {
    const { resolve_request_origin } = await import("@src/dashboard/service.js");
    const req = { headers: { host: "legit.com", "x-forwarded-host": "evil.com", "x-forwarded-proto": "https" } } as never;
    const result = resolve_request_origin(req, "https://my-app.example.com", 3000);
    expect(result).toBe("https://my-app.example.com");
    expect(result).not.toContain("evil.com");
  });

  it("publicUrl 미설정 시 host 사용, X-Forwarded-Host 무시", async () => {
    const { resolve_request_origin } = await import("@src/dashboard/service.js");
    const req = { headers: { host: "legit.com:3000", "x-forwarded-host": "evil.com" } } as never;
    const result = resolve_request_origin(req, undefined, 3000);
    expect(result).toContain("legit.com");
    expect(result).not.toContain("evil.com");
  });

  it("publicUrl trailing slash 제거", async () => {
    const { resolve_request_origin } = await import("@src/dashboard/service.js");
    const req = { headers: {} } as never;
    const result = resolve_request_origin(req, "https://app.com///", 3000);
    expect(result).toBe("https://app.com");
  });
});

// ══════════════════════════════════════════
// TN-6d: oauth presets — 읽기 team_manager, 쓰기 superadmin
// ══════════════════════════════════════════

describe("TN-6d: oauth presets 권한 매트릭스", () => {
  it("GET /api/oauth/presets — team_manager → 200 허용", async () => {
    const { handle_oauth } = await import("@src/dashboard/routes/oauth.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {},
      url: new URL("/api/oauth/presets", "http://localhost"),
      options: { auth_svc: {}, oauth_ops: { list_presets: () => [] } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "manager" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_oauth(ctx);
    expect(sent[0].status).toBe(200);
  });

  it("GET /api/oauth/presets — member → 403 (team_manager 전체 게이트)", async () => {
    const { handle_oauth } = await import("@src/dashboard/routes/oauth.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {},
      url: new URL("/api/oauth/presets", "http://localhost"),
      options: { auth_svc: {}, oauth_ops: { list_presets: () => [] } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_oauth(ctx);
    expect(sent[0].status).toBe(403);
  });

  it("POST /api/oauth/presets — team_manager → 403 (superadmin 필요)", async () => {
    const { handle_oauth } = await import("@src/dashboard/routes/oauth.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "POST", headers: {} }, res: {},
      url: new URL("/api/oauth/presets", "http://localhost"),
      options: { auth_svc: {}, oauth_ops: { register_preset: async () => ({ ok: true }) } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "manager" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => ({ service_type: "github" }),
    } as never;
    await handle_oauth(ctx);
    expect(sent[0].status).toBe(403);
  });

  it("PUT /api/oauth/presets/:type — team_manager → 403 (superadmin 필요)", async () => {
    const { handle_oauth } = await import("@src/dashboard/routes/oauth.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "PUT", headers: {} }, res: {},
      url: new URL("/api/oauth/presets/github", "http://localhost"),
      options: { auth_svc: {}, oauth_ops: { update_preset: async () => ({ ok: true }) } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "manager" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => ({ client_id: "x" }),
    } as never;
    await handle_oauth(ctx);
    expect(sent[0].status).toBe(403);
  });

  it("DELETE /api/oauth/presets/:type — team_manager → 403 (superadmin 필요)", async () => {
    const { handle_oauth } = await import("@src/dashboard/routes/oauth.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "DELETE", headers: {} }, res: {},
      url: new URL("/api/oauth/presets/github", "http://localhost"),
      options: { auth_svc: {}, oauth_ops: { unregister_preset: async () => ({ ok: true }) } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "manager" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_oauth(ctx);
    expect(sent[0].status).toBe(403);
  });
});

// ══════════════════════════════════════════
// TN-6d: kanban templates — GET 인증만, POST/DELETE superadmin
// ══════════════════════════════════════════

describe("TN-6d: kanban templates 권한 매트릭스", () => {
  it("GET /api/kanban/templates — member → 허용 (읽기 전용)", async () => {
    const { handle_kanban } = await import("@src/dashboard/routes/kanban.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "GET", headers: {} }, res: {},
      url: new URL("/api/kanban/templates", "http://localhost"),
      options: { auth_svc: {}, kanban_store: { list_templates: async () => [] } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_kanban(ctx);
    expect(sent[0].status).toBe(200);
  });

  it("POST /api/kanban/templates — member → 403 (superadmin 필요)", async () => {
    const { handle_kanban } = await import("@src/dashboard/routes/kanban.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "POST", headers: {} }, res: {},
      url: new URL("/api/kanban/templates", "http://localhost"),
      options: { auth_svc: {}, kanban_store: { create_template: async () => ({}) } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => ({ name: "test", cards: [] }),
    } as never;
    await handle_kanban(ctx);
    expect(sent[0].status).toBe(403);
  });

  it("DELETE /api/kanban/templates/:id — member → 403 (superadmin 필요)", async () => {
    const { handle_kanban } = await import("@src/dashboard/routes/kanban.js");
    const sent: Array<{ status: number; body: unknown }> = [];
    const ctx = {
      req: { method: "DELETE", headers: {} }, res: {},
      url: new URL("/api/kanban/templates/tpl_1", "http://localhost"),
      options: { auth_svc: {}, kanban_store: { delete_template: async () => true } },
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "member" },
      json: (_r: unknown, s: number, b: unknown) => { sent.push({ status: s, body: b }); },
      read_body: async () => null,
    } as never;
    await handle_kanban(ctx);
    expect(sent[0].status).toBe(403);
  });
});
