/**
 * TN-3 Route Context Runtime Injection 검증.
 *
 * 설계 완료 기준:
 *   - RouteContext.workspace_runtime이 null이 아님 (인증된 요청)
 *   - mismatched tid/wdir → 401
 *   - route handler가 registry를 직접 호출하지 않음 (아키텍처 — 코드 검증)
 *
 * 테스트 전략:
 *   실제 DashboardService + WorkspaceRegistry로 HTTP 서버 가동 →
 *   인증된 요청 후 registry 상태 검증 + wdir 조작 거부 검증.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { AdminStore } from "@src/auth/admin-store.js";
import { AuthService } from "@src/auth/auth-service.js";
import { TeamStore } from "@src/auth/team-store.js";
import { WorkspaceRegistry } from "@src/workspace/registry.js";
import { DashboardService } from "@src/dashboard/service.js";

// ── 픽스처 ──

const TEST_DIR = join(tmpdir(), `tn3-test-${randomUUID()}`);
const ADMIN_DB = join(TEST_DIR, "admin.db");
const TEAM_ID = "team-alpha";

let auth_svc: AuthService;
let registry: WorkspaceRegistry;
let dashboard: DashboardService;
let base_url: string;

let token_member: string;
let member_id: string;

function make_wdir(tid: string, uid: string): string {
  return `tenants/${tid}/users/${uid}`;
}

beforeAll(async () => {
  mkdirSync(join(TEST_DIR, "tenants", TEAM_ID), { recursive: true });

  const admin_store = new AdminStore(ADMIN_DB);
  auth_svc = new AuthService(admin_store);
  registry = new WorkspaceRegistry(TEST_DIR);

  admin_store.ensure_team("default", "Default");
  admin_store.ensure_team(TEAM_ID, "Team Alpha");

  const m_hash = auth_svc.hash_password("m_pass");
  const member = admin_store.create_user({ username: "alice", password_hash: m_hash, system_role: "user", default_team_id: TEAM_ID });
  member_id = member.id;

  const team_store = new TeamStore(join(TEST_DIR, "tenants", TEAM_ID, "team.db"), TEAM_ID);
  team_store.upsert_member(member.id, "member");

  token_member = auth_svc.sign_token({
    sub: member.id, usr: "alice", role: "user",
    tid: TEAM_ID, wdir: make_wdir(TEAM_ID, member.id),
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

async function api_get(path: string, token?: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${base_url}${path}`, { headers });
  const body = await res.json() as Record<string, unknown>;
  return { status: res.status, body };
}

// ── TN-3 테스트 ──

describe("TN-3: workspace_runtime 주입 검증", () => {
  it("인증된 요청 후 registry에 runtime이 생성됨 (get_or_create 호출 증거)", async () => {
    // 요청 전: runtime 미등록
    expect(registry.get_runtime({ team_id: TEAM_ID, user_id: member_id })).toBeNull();

    // 인증된 요청 → 미들웨어가 get_or_create 호출
    await api_get("/api/tools", token_member);

    // 요청 후: runtime 등록됨
    const rt = registry.get_runtime({ team_id: TEAM_ID, user_id: member_id });
    expect(rt).not.toBeNull();
    expect(rt!.team_id).toBe(TEAM_ID);
    expect(rt!.user_id).toBe(member_id);
    expect(rt!.is_active).toBe(true);
  });

  it("runtime의 workspace_path가 올바른 per-user 경로", () => {
    const rt = registry.get_runtime({ team_id: TEAM_ID, user_id: member_id })!;
    const expected = join(TEST_DIR, "tenants", TEAM_ID, "users", member_id);
    expect(rt.workspace_path).toBe(expected);
  });

  it("미들웨어가 per-user 워크스페이스 디렉토리를 생성함", () => {
    const user_ws = join(TEST_DIR, "tenants", TEAM_ID, "users", member_id);
    expect(existsSync(join(user_ws, "runtime"))).toBe(true);
    expect(existsSync(join(user_ws, "workflows"))).toBe(true);
    expect(existsSync(join(user_ws, "skills"))).toBe(true);
    expect(existsSync(join(user_ws, "templates"))).toBe(true);
  });
});

describe("TN-3: wdir mismatch 거부", () => {
  it("JWT wdir 조작 → 401 invalid_token (구조 무결성 검증)", async () => {
    // wdir를 다른 사용자의 경로로 조작한 JWT
    const tampered_token = auth_svc.sign_token({
      sub: member_id, usr: "alice", role: "user",
      tid: TEAM_ID, wdir: "tenants/team-alpha/users/SOMEONE_ELSE",
    });

    const { status, body } = await api_get("/api/tools", tampered_token);
    expect(status).toBe(401);
    expect(body.error).toBe("invalid_token");
  });

  it("tid와 wdir 불일치 → 401 (다른 팀 경로 주입 시도)", async () => {
    const tampered_token = auth_svc.sign_token({
      sub: member_id, usr: "alice", role: "user",
      tid: "team-beta", wdir: make_wdir(TEAM_ID, member_id), // tid != wdir의 팀
    });

    const { status, body } = await api_get("/api/tools", tampered_token);
    expect(status).toBe(401);
    expect(body.error).toBe("invalid_token");
  });
});
