/** 라우트 핸들러 공통 컨텍스트. */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { DashboardOptions, ChatSession, RecentMessage } from "./service.js";
import type { SystemMetricsCollector } from "./system-metrics.js";
import type { SessionStoreLike } from "../session/index.js";
import type { JwtPayload } from "../auth/auth-service.js";
import type { DashboardMemoryOps } from "./service.types.js";
import { type CorrelationContext, create_correlation } from "../observability/correlation.js";
import { type TenantContext } from "../auth/tenant-context.js";
import { type WorkspaceRuntimeRef } from "../workspace/runtime.js";

/** Phase 8-23 / TN-1: 현재 요청의 팀 문맥. auth_middleware 검증 후 주입. */
export type { TenantContext };
/** 하위 호환 별칭. TenantContext와 구조적으로 호환. */
export type TeamContext = TenantContext;

/** TN-2: WorkspaceRuntimeRef 재노출. 라우트 핸들러가 소비하는 runtime 포트 타입. */
export type { WorkspaceRuntimeRef };
/** 하위 호환 별칭. WorkspaceRuntimeRef와 동일. */
export type WorkspaceRuntimeLike = WorkspaceRuntimeRef;

export type RouteContext = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  options: DashboardOptions;
  /** 인증된 사용자의 JWT 페이로드. 인증 비활성 또는 미인증 시 null. */
  auth_user: JwtPayload | null;
  /** TN-1: 현재 요청의 팀 문맥 (멤버십 출처 포함). 인증 비활성 또는 미인증 시 null. */
  team_context: TenantContext | null;
  /** TN-2: 현재 사용자의 워크스페이스 런타임 (WorkspaceRuntimeRef 포트). 미인증 시 null. */
  workspace_runtime: WorkspaceRuntimeRef | null;
  /** [global, team, personal] 워크스페이스 레이어 경로 (낮은 → 높은 우선순위). */
  workspace_layers: string[];
  /** 저장/삭제용 개인 workspace 경로 (최상위 레이어). */
  personal_dir: string;
  json: (res: ServerResponse, status: number, data: unknown) => void;
  read_body: (req: IncomingMessage) => Promise<Record<string, unknown> | null>;
  add_sse_client: (res: ServerResponse, team_id?: string, user_id?: string) => void;
  build_state: (team_id?: string, user_id?: string) => Promise<Record<string, unknown>>;
  build_merged_tasks: (team_id?: string) => Promise<unknown[]>;
  recent_messages: RecentMessage[];
  metrics: SystemMetricsCollector;
  chat_sessions: Map<string, ChatSession>;
  session_store: SessionStoreLike | null;
  session_store_key: (chat_id: string) => string;
  register_media_token: (abs_path: string) => string | null;
  oauth_callback_handler?: (code: string, state: string) => Promise<{ ok: boolean; instance_id?: string; error?: string }>;
  oauth_callback_html: (success: boolean, message: string) => string;
  resolve_request_origin: (req: IncomingMessage) => string;
  bus: DashboardOptions["bus"];
  add_rich_stream_listener: (chat_id: string, fn: (event: import("./broadcaster.js").WebStreamEvent) => void) => () => void;
  /** per-user 메모리 ops. 멀티테넌트에서 유저별 MemoryStore 캐시 기반. 미설정 시 글로벌 ops fallback. */
  get_scoped_memory_ops: () => DashboardMemoryOps | null;
  /** OB-1: 요청 단위 correlation context. service.ts에서 1회 생성 후 고정. */
  correlation: CorrelationContext;
  /** PA-3: TeamStore factory. concrete 생성을 route handler에서 제거. */
  create_team_store: (team_id: string) => import("../auth/team-store.js").TeamStoreLike;
};

export type RouteHandler = (ctx: RouteContext) => Promise<boolean>;

export function set_no_cache(res: ServerResponse): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

/**
 * 운영자(superadmin) 권한 확인.
 * auth 비활성(단일 사용자 모드) 시 통과.
 * 권한 부족 시 403 응답 후 false 반환 → 호출자는 즉시 return true.
 */
/**
 * 요청자의 team_id 반환. undefined = 전체 조회 (superadmin 또는 싱글 유저 모드).
 * 라우트 핸들러에서 서비스 쿼리 시 스코핑 기준.
 */
export function get_filter_team_id(ctx: RouteContext): string | undefined {
  if (!ctx.options.auth_svc) return undefined;
  if (ctx.auth_user?.role === "superadmin") return undefined;
  return ctx.team_context?.team_id ?? "";
}

/**
 * FE-6: 요청자의 user_id 반환. undefined = 전체 조회 (superadmin 또는 싱글 유저 모드).
 * 사용자 소유 리소스(세션, 이벤트 등) 필터링 기준.
 */
export function get_filter_user_id(ctx: RouteContext): string | undefined {
  if (!ctx.options.auth_svc) return undefined;
  if (ctx.auth_user?.role === "superadmin") return undefined;
  return ctx.auth_user?.sub ?? "";
}

export function require_superadmin(ctx: RouteContext): boolean {
  // auth 비활성 = 싱글 유저 모드 → 제한 없음
  if (!ctx.options.auth_svc) return true;
  if (ctx.auth_user?.role === "superadmin") return true;
  ctx.json(ctx.res, 403, { error: "superadmin_required" });
  return false;
}

/**
 * 설정 변경(write) 엔드포인트용: 읽기는 허용, 쓰기는 superadmin만.
 * auth 비활성 시 통과.
 */
/**
 * 리소스 소유권(team_id) 검증.
 * team_id가 undefined(superadmin/싱글유저)이면 항상 통과.
 * 리소스의 team_id가 요청자의 team_id와 불일치하면 false(= 404로 처리).
 */
export function check_team_ownership(ctx: RouteContext, resource_team_id: string | undefined): boolean {
  const filter = get_filter_team_id(ctx);
  if (filter === undefined) return true;
  return resource_team_id === filter;
}

/**
 * G-12: cross-team 리소스 접근 거부.
 * 리소스의 team_id가 요청자와 불일치할 때 403 + cross_team_denied 구조체 응답.
 * superadmin/싱글유저 모드에서는 항상 통과(true).
 * false 반환 시 호출자는 즉시 return true.
 */
export function deny_cross_team(
  ctx: RouteContext,
  resource_team_id: string | undefined,
): boolean {
  const filter = get_filter_team_id(ctx);
  // superadmin 또는 auth 비활성 → 통과
  if (filter === undefined) return true;
  if (resource_team_id === filter) return true;
  ctx.json(ctx.res, 403, {
    error: {
      code: "cross_team_denied",
      team_id: filter,
      resource_team_id: resource_team_id ?? "",
    },
  });
  return false;
}

export function require_superadmin_for_write(ctx: RouteContext): boolean {
  if (!ctx.options.auth_svc) return true;
  const method = ctx.req.method ?? "";
  if (method === "GET" || method === "HEAD") return true;
  if (ctx.auth_user?.role === "superadmin") return true;
  ctx.json(ctx.res, 403, { error: "superadmin_required" });
  return false;
}

/**
 * 팀 리소스 접근 제어 (모든 HTTP 메서드 차단).
 * 외부 채널 세션 mirror 등 읽기 자체가 팀 리소스 접근인 경우 사용.
 * auth 비활성 시 통과.
 */
export function require_team_manager(ctx: RouteContext): boolean {
  if (!ctx.options.auth_svc) return true;
  if (ctx.auth_user?.role === "superadmin") return true;
  const role = ctx.team_context?.team_role;
  if (role === "owner" || role === "manager") return true;
  ctx.json(ctx.res, 403, { error: "team_manager_required" });
  return false;
}

/**
 * 팀 공유 리소스(write) 엔드포인트용:
 * 읽기는 허용, 쓰기는 team owner/manager 또는 superadmin만.
 * auth 비활성 시 통과.
 */
export function require_team_manager_for_write(ctx: RouteContext): boolean {
  if (!ctx.options.auth_svc) return true;
  const method = ctx.req.method ?? "";
  if (method === "GET" || method === "HEAD") return true;
  if (ctx.auth_user?.role === "superadmin") return true;
  const role = ctx.team_context?.team_role;
  if (role === "owner" || role === "manager") return true;
  ctx.json(ctx.res, 403, { error: "team_manager_required" });
  return false;
}

// ── 3-tier resource scoping ──

/** ScopeFilter 타입 re-export (store에서 정의). */
export type ScopeFilter = Array<{ scope_type: string; scope_id: string }> | undefined;

/**
 * 현재 요청자가 볼 수 있는 scope 목록.
 * superadmin/싱글유저 → undefined (전체), 일반 사용자 → global + team + personal.
 */
export function build_scope_filter(ctx: RouteContext): ScopeFilter {
  if (!ctx.options.auth_svc) return undefined;
  if (ctx.auth_user?.role === "superadmin") return undefined;
  const scopes: Array<{ scope_type: string; scope_id: string }> = [
    { scope_type: "global", scope_id: "" },
  ];
  if (ctx.team_context?.team_id) {
    scopes.push({ scope_type: "team", scope_id: ctx.team_context.team_id });
  }
  if (ctx.auth_user?.sub) {
    scopes.push({ scope_type: "personal", scope_id: ctx.auth_user.sub });
  }
  return scopes;
}

/**
 * 요청자가 해당 scope에 쓰기 가능한지 검사.
 * global → superadmin만, team → superadmin/owner/manager, personal → 본인 또는 superadmin.
 */
export function can_write_scope(ctx: RouteContext, scope_type: string, scope_id: string): boolean {
  if (!ctx.options.auth_svc) return true;
  if (ctx.auth_user?.role === "superadmin") return true;
  if (scope_type === "global") return false;
  if (scope_type === "team") {
    if (ctx.team_context?.team_id !== scope_id) return false;
    const role = ctx.team_context?.team_role;
    return role === "owner" || role === "manager";
  }
  if (scope_type === "personal") {
    return ctx.auth_user?.sub === scope_id;
  }
  return false;
}

// ── OB-1: Correlation Context ──

/** RouteContext에서 CorrelationContext 추출. 매 요청마다 새 trace_id를 생성. */
export function extract_correlation(ctx: RouteContext): CorrelationContext {
  return create_correlation({
    team_id: ctx.team_context?.team_id,
    user_id: ctx.auth_user?.sub,
    workspace_dir: ctx.workspace_runtime?.workspace_path,
  });
}
