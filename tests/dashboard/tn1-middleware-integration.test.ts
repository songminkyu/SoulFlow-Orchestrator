/**
 * TN-1 미들웨어 통합 테스트.
 *
 * service.ts auth middleware 3경로를 실제 HTTP 요청 수준에서 검증:
 *   1. superadmin_bypass — superadmin + 임의 tid → 미들웨어 통과
 *   2. explicit_membership — user + 실제 TeamStore 멤버십 → 미들웨어 통과
 *   3. default_team_fallback — user + tid="default" → 미들웨어 통과
 *   4. non_member reject — user + tid (멤버십 없음) → 403 not_a_member
 *   5. team_not_found — user + tid (team.db 없음) → 403 team_not_found
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AdminStore } from "@src/auth/admin-store.js";
import { AuthService } from "@src/auth/auth-service.js";
import { TeamStore } from "@src/auth/team-store.js";
import { DashboardService } from "@src/dashboard/service.js";

// ── 픽스처 ──

const TEST_DIR = join(tmpdir(), `tn1-mw-test-${randomUUID()}`);
const ADMIN_DB = join(TEST_DIR, "admin.db");
const TEAM_ID = "team-alpha";
const TEAM_DB = join(TEST_DIR, "tenants", TEAM_ID, "team.db");

let auth_svc: AuthService;
let dashboard: DashboardService;
let base_url: string;

/** superadmin JWT — tid="team-alpha" */
let token_superadmin: string;
/** member JWT — tid="team-alpha", TeamStore 멤버십 있음 */
let token_member: string;
/** non-member JWT — tid="team-alpha", TeamStore 멤버십 없음 */
let token_non_member: string;
/** default-team JWT — tid="default" */
let token_default: string;
/** non-existent team JWT — tid="ghost-team" (team.db 없음) */
let token_ghost_team: string;

function make_wdir(tid: string, uid: string): string {
  return `tenants/${tid}/users/${uid}`;
}

beforeAll(async () => {
  // 1. 디렉토리 구조 생성
  mkdirSync(join(TEST_DIR, "tenants", TEAM_ID), { recursive: true });

  // 2. AdminStore + AuthService
  const admin_store = new AdminStore(ADMIN_DB);
  auth_svc = new AuthService(admin_store);

  // 3. superadmin 생성
  admin_store.ensure_team("default", "Default");
  admin_store.ensure_team(TEAM_ID, "Team Alpha");
  const sa_hash = auth_svc.hash_password("sa_pass");
  const sa = admin_store.create_user({ username: "superadmin", password_hash: sa_hash, system_role: "superadmin", default_team_id: TEAM_ID });

  // 4. member user 생성
  const m_hash = auth_svc.hash_password("m_pass");
  const member = admin_store.create_user({ username: "member_user", password_hash: m_hash, system_role: "user", default_team_id: TEAM_ID });

  // 5. non-member user 생성 (team-alpha 멤버십 없음)
  const nm_hash = auth_svc.hash_password("nm_pass");
  const non_member = admin_store.create_user({ username: "non_member", password_hash: nm_hash, system_role: "user", default_team_id: TEAM_ID });

  // 6. default-team user 생성
  const d_hash = auth_svc.hash_password("d_pass");
  const default_user = admin_store.create_user({ username: "default_user", password_hash: d_hash, system_role: "user", default_team_id: "default" });

  // 7. ghost-team user 생성 (team.db가 존재하지 않는 팀)
  const g_hash = auth_svc.hash_password("g_pass");
  const ghost_user = admin_store.create_user({ username: "ghost_user", password_hash: g_hash, system_role: "user" });

  // 8. TeamStore — team-alpha에 member_user 멤버십 추가
  const team_store = new TeamStore(TEAM_DB, TEAM_ID);
  team_store.upsert_member(member.id, "member");

  // 9. JWT 발급
  token_superadmin = auth_svc.sign_token({ sub: sa.id, usr: "superadmin", role: "superadmin", tid: TEAM_ID, wdir: make_wdir(TEAM_ID, sa.id) });
  token_member = auth_svc.sign_token({ sub: member.id, usr: "member_user", role: "user", tid: TEAM_ID, wdir: make_wdir(TEAM_ID, member.id) });
  token_non_member = auth_svc.sign_token({ sub: non_member.id, usr: "non_member", role: "user", tid: TEAM_ID, wdir: make_wdir(TEAM_ID, non_member.id) });
  token_default = auth_svc.sign_token({ sub: default_user.id, usr: "default_user", role: "user", tid: "default", wdir: make_wdir("default", default_user.id) });
  token_ghost_team = auth_svc.sign_token({ sub: ghost_user.id, usr: "ghost_user", role: "user", tid: "ghost-team", wdir: make_wdir("ghost-team", ghost_user.id) });

  // 10. DashboardService — 최소 옵션으로 생성
  dashboard = new DashboardService({
    host: "127.0.0.1",
    port: 0,
    port_fallback: true,
    workspace: TEST_DIR,
    auth_svc,
    // 필수 인터페이스 — 미들웨어 테스트에서는 사용되지 않으므로 빈 객체
    agent: {} as any,
    bus: { publish_inbound: async () => {} } as any,
    channels: {} as any,
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

async function api_get(path: string, token?: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base_url}${path}`, { headers });
  const body = await res.json() as Record<string, unknown>;
  return { status: res.status, body };
}

// ── 테스트 ──

describe("TN-1: service.ts auth middleware 3경로 통합 테스트", () => {
  it("토큰 없음 → 401 unauthorized", async () => {
    const { status, body } = await api_get("/api/workflow/events");
    expect(status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("경로 1: superadmin_bypass — superadmin + tid=team-alpha → 미들웨어 통과 (200 = route handler 도달)", async () => {
    const { status } = await api_get("/api/workflow/events", token_superadmin);
    // 200 = 미들웨어를 통과하여 route handler까지 도달
    expect(status).toBe(200);
    // 200 = 미들웨어를 통과하여 route handler까지 도달
  });

  it("경로 2: explicit_membership — member + tid=team-alpha + TeamStore 멤버십 → 미들웨어 통과", async () => {
    const { status } = await api_get("/api/workflow/events", token_member);
    expect(status).toBe(200);
    // 200 = 미들웨어를 통과하여 route handler까지 도달
  });

  it("경로 3: default_team_fallback — user + tid=default → 미들웨어 통과", async () => {
    const { status } = await api_get("/api/workflow/events", token_default);
    expect(status).toBe(200);
    // 200 = 미들웨어를 통과하여 route handler까지 도달
  });

  it("거부: non_member — user + tid=team-alpha + 멤버십 없음 → 403 not_a_member", async () => {
    const { status, body } = await api_get("/api/workflow/events", token_non_member);
    expect(status).toBe(403);
    expect(body.error).toBe("not_a_member");
  });

  it("거부: team_not_found — user + tid=ghost-team (team.db 없음) → 403 not_a_member (TN-6b: 팀 존재 미노출)", async () => {
    const { status, body } = await api_get("/api/workflow/events", token_ghost_team);
    expect(status).toBe(403);
    expect(body.error).toBe("not_a_member");
  });
});
