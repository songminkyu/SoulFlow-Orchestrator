/**
 * handle_auth — /api/auth/* 엔드포인트.
 *
 *   GET  /api/auth/status  — 인증 설정 여부 + 초기화 여부
 *   POST /api/auth/setup   — 최초 superadmin 생성 (미초기화 시에만)
 *   POST /api/auth/login   — 로그인 → JWT 쿠키 + JSON 응답
 *   POST /api/auth/logout  — 쿠키 삭제
 *   GET  /api/auth/me      — 현재 로그인 사용자 정보
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { RouteContext } from "../route-context.js";
import { make_auth_cookie, clear_auth_cookie } from "../../auth/auth-middleware.js";
import { LoginRateLimiter } from "../../auth/login-rate-limiter.js";
import type { ApiAuthStatus, ApiAuthMe, ApiMyTeams } from "../../contracts/api-responses.js";

/** H-8: 로그인/셋업 brute-force 방어. 모듈 수준 싱글턴. */
const login_limiter = new LoginRateLimiter({ max_attempts: 5, window_ms: 15 * 60 * 1000 });

function team_db_path(workspace: string, team_id: string): string {
  return join(workspace, "tenants", team_id, "team.db");
}

export async function handle_auth(ctx: RouteContext): Promise<boolean> {
  const { req, res, url, options, json, read_body } = ctx;
  if (!url.pathname.startsWith("/api/auth")) return false;

  const auth_svc = options.auth_svc ?? null;

  // ── GET /api/auth/status ──

  if (url.pathname === "/api/auth/status" && req.method === "GET") {
    if (!auth_svc) {
      json(res, 200, { enabled: false, initialized: false } satisfies ApiAuthStatus);
      return true;
    }
    json(res, 200, { enabled: true, initialized: auth_svc.is_initialized() } satisfies ApiAuthStatus);
    return true;
  }

  // ── POST /api/auth/setup ──

  if (url.pathname === "/api/auth/setup" && req.method === "POST") {
    if (!auth_svc) { json(res, 503, { error: "auth_not_configured" }); return true; }
    if (auth_svc.is_initialized()) { json(res, 409, { error: "already_initialized" }); return true; }

    // H-8: setup 도 rate limit 적용 (scrypt DoS 방어)
    // H-8: remoteAddress 우선 — X-Forwarded-For는 spoofable이므로 직접 소켓 IP 사용
    const client_ip = req.socket?.remoteAddress || "unknown";
    if (!login_limiter.check(client_ip)) {
      const retry_sec = Math.ceil(login_limiter.retry_after_ms(client_ip) / 1000);
      res.setHeader("Retry-After", String(retry_sec));
      json(res, 429, { error: "too_many_requests", retry_after_sec: retry_sec });
      return true;
    }

    const body = await read_body(req);
    if (!body) { json(res, 400, { error: "invalid_body" }); return true; }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      json(res, 400, { error: "username_password_required" });
      return true;
    }
    if (username.length < 2 || password.length < 6) {
      json(res, 400, { error: "username_min_2_password_min_6" });
      return true;
    }

    const result = await auth_svc.setup_superadmin(username, password);
    if (!result) { json(res, 500, { error: "setup_failed" }); return true; }

    // 워크스페이스 디렉토리 + TeamStore 멤버십 동기화 (admin.ts create_user와 동일)
    const workspace = options.workspace ?? "";
    const team_id = "default";
    if (workspace) {
      // WorkspaceRegistry로 디렉토리 생성 + 런타임 등록 (수동 mkdirSync 대체)
      if (options.workspace_registry) {
        options.workspace_registry.get_or_create({ team_id, user_id: result.payload.sub });
      } else {
        const base = join(workspace, "tenants", team_id, "users", result.payload.sub);
        for (const sub of ["workflows", "skills", "templates", "runtime"]) {
          mkdirSync(join(base, sub), { recursive: true });
        }
      }
      ctx.create_team_store(team_id).upsert_member(result.payload.sub, "owner");
    }

    res.setHeader("Set-Cookie", make_auth_cookie(result.token));
    json(res, 201, { ok: true, username: result.payload.usr, role: result.payload.role });
    return true;
  }

  // ── POST /api/auth/login ──

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    if (!auth_svc) { json(res, 503, { error: "auth_not_configured" }); return true; }

    // H-8: IP 기반 rate limiting
    // H-8: remoteAddress 우선 — X-Forwarded-For는 spoofable이므로 직접 소켓 IP 사용
    const client_ip = req.socket?.remoteAddress || "unknown";
    if (!login_limiter.check(client_ip)) {
      const retry_sec = Math.ceil(login_limiter.retry_after_ms(client_ip) / 1000);
      res.setHeader("Retry-After", String(retry_sec));
      json(res, 429, { error: "too_many_requests", retry_after_sec: retry_sec });
      return true;
    }

    const body = await read_body(req);
    if (!body) { json(res, 400, { error: "invalid_body" }); return true; }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      json(res, 400, { error: "username_password_required" });
      return true;
    }

    const result = await auth_svc.login(username, password);
    if (!result) { json(res, 401, { error: "invalid_credentials" }); return true; }

    // 로그인 시 워크스페이스 런타임 즉시 생성 (후속 요청 cold start 방지)
    if (result.payload.tid) {
      options.workspace_registry?.get_or_create({ team_id: result.payload.tid, user_id: result.payload.sub });
    }

    res.setHeader("Set-Cookie", make_auth_cookie(result.token));
    json(res, 200, { ok: true, username: result.payload.usr, role: result.payload.role, tid: result.payload.tid });
    return true;
  }

  // ── POST /api/auth/logout ──

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    res.setHeader("Set-Cookie", clear_auth_cookie());
    json(res, 200, { ok: true });
    return true;
  }

  // ── GET /api/auth/me ──

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    if (!auth_svc) { json(res, 503, { error: "auth_not_configured" }); return true; }
    const p = ctx.auth_user;
    if (!p) { json(res, 401, { error: "not_authenticated" }); return true; }

    // TeamStore에서 현재 팀 role 조회 (없으면 null)
    const workspace = options.workspace ?? "";
    let team_role: string | null = null;
    if (workspace && p.tid) {
      const db = team_db_path(workspace, p.tid);
      if (existsSync(db)) team_role = ctx.create_team_store(p.tid).get_membership(p.sub)?.role ?? null;
    }

    json(res, 200, { sub: p.sub, username: p.usr, role: p.role, tid: p.tid, wdir: p.wdir, exp: p.exp, team_role } satisfies ApiAuthMe);
    return true;
  }

  // ── GET /api/auth/my-teams ──

  if (url.pathname === "/api/auth/my-teams" && req.method === "GET") {
    if (!auth_svc) { json(res, 503, { error: "auth_not_configured" }); return true; }
    const p = ctx.auth_user;
    if (!p) { json(res, 401, { error: "not_authenticated" }); return true; }

    const workspace = options.workspace ?? "";
    const all_teams = auth_svc.list_teams();

    // superadmin은 모든 팀, 일반 사용자는 멤버십이 있는 팀만
    if (p.role === "superadmin") {
      json(res, 200, { teams: all_teams.map((t) => ({ ...t, role: "owner" as const })) } satisfies ApiMyTeams);
      return true;
    }

    const my_teams = [];
    for (const team of all_teams) {
      const db = team_db_path(workspace, team.id);
      if (!existsSync(db)) continue;
      const membership = ctx.create_team_store(team.id).get_membership(p.sub);
      if (membership) my_teams.push({ ...team, role: membership.role });
    }
    json(res, 200, { teams: my_teams } satisfies ApiMyTeams);
    return true;
  }

  // ── PATCH /api/auth/me/password — 사용자 자체 비밀번호 변경 ──
  if (url.pathname === "/api/auth/me/password" && (req.method === "PATCH" || req.method === "PUT")) {
    if (!auth_svc) { json(res, 503, { error: "auth_not_configured" }); return true; }
    const p = ctx.auth_user;
    if (!p) { json(res, 401, { error: "not_authenticated" }); return true; }
    const body = await read_body(req);
    const current = typeof body?.current_password === "string" ? body.current_password : "";
    const next_pw = typeof body?.new_password === "string" ? body.new_password : "";
    if (!current || !next_pw) { json(res, 400, { error: "passwords_required" }); return true; }
    if (next_pw.length < 6) { json(res, 400, { error: "password_too_short" }); return true; }
    const user = auth_svc.get_user_by_id(p.sub);
    if (!user?.password_hash) { json(res, 404, { error: "user_not_found" }); return true; }
    const ok = await auth_svc.verify_password(current, user.password_hash);
    if (!ok) { json(res, 403, { error: "wrong_password" }); return true; }
    await auth_svc.update_password(p.sub, next_pw);
    json(res, 200, { ok: true });
    return true;
  }

  // ── POST /api/auth/switch-team ──

  if (url.pathname === "/api/auth/switch-team" && req.method === "POST") {
    if (!auth_svc) { json(res, 503, { error: "auth_not_configured" }); return true; }
    const p = ctx.auth_user;
    if (!p) { json(res, 401, { error: "not_authenticated" }); return true; }

    const body = await read_body(req);
    const team_id = typeof body?.team_id === "string" ? body.team_id.trim() : "";
    if (!team_id) { json(res, 400, { error: "team_id_required" }); return true; }

    const workspace = options.workspace ?? "";

    // superadmin은 멤버십 검증 없이 모든 팀으로 전환 가능
    if (p.role !== "superadmin") {
      const db = team_db_path(workspace, team_id);
      if (!existsSync(db)) { json(res, 403, { error: "not_a_member" }); return true; }
      const membership = ctx.create_team_store(team_id).get_membership(p.sub);
      if (!membership) { json(res, 403, { error: "not_a_member" }); return true; }
    }

    const result = auth_svc.issue_token_for_team(p.sub, team_id);
    if (!result) { json(res, 404, { error: "user_not_found" }); return true; }

    // 새 팀의 워크스페이스 런타임 사전 생성 (후속 요청 cold start 방지)
    options.workspace_registry?.get_or_create({ team_id, user_id: p.sub });

    res.setHeader("Set-Cookie", make_auth_cookie(result.token));
    json(res, 200, { ok: true, tid: team_id });
    return true;
  }

  return false;
}
