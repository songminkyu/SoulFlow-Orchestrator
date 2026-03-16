/**
 * TN-1: TenantContext — 팀 멤버십이 어떻게 결정됐는지 출처까지 포함하는 도메인 타입.
 * resolve_tenant_context()는 TeamStore 의존 없이 테스트 가능한 순수 함수.
 */

import type { TeamRole, MembershipRecord } from "./team-store.js";

/** 팀 컨텍스트가 어떤 경로로 허가됐는지 나타내는 출처. */
export type MembershipSource =
  | "explicit_membership"   // TeamStore에서 검증된 실제 멤버십
  | "superadmin_bypass"     // superadmin 권한으로 멤버십 우회
  | "default_team_fallback" // default_team_id 편의 접근 — 별도 TeamStore 없이 허용
  | "no_auth";              // 인증 비활성 (단일 사용자 모드)

/**
 * route layer가 소비하는 최소 tenant 문맥.
 * TeamContext와 달리 user_id + membership_source를 포함해
 * "누가, 어떤 근거로" 접근했는지를 명시한다.
 *
 * user_id / membership_source는 optional: 기존 테스트 목과 호환성 유지.
 * 실제 미들웨어(service.ts)는 항상 두 필드를 채운다.
 */
export type TenantContext = {
  team_id: string;
  team_role: TeamRole;
  user_id?: string;
  membership_source?: MembershipSource;
};

/**
 * TeamStore 접근을 콜백으로 주입받아 테스트 가능하게 한 순수 도메인 함수.
 *
 * - superadmin → 멤버십 조회 없이 owner로 결정 (superadmin_bypass)
 * - 일반 사용자 → get_membership() 반환값 기준; null이면 접근 거부 (null 반환)
 */
export function resolve_tenant_context(opts: {
  user_id: string;
  system_role: "superadmin" | "user";
  team_id: string;
  /** TeamStore.get_membership(user_id) 어댑터. null = 미가입. */
  get_membership: (user_id: string) => MembershipRecord | null;
}): TenantContext | null {
  if (opts.system_role === "superadmin") {
    return {
      user_id: opts.user_id,
      team_id: opts.team_id,
      team_role: "owner",
      membership_source: "superadmin_bypass",
    };
  }

  const membership = opts.get_membership(opts.user_id);
  if (!membership) return null;

  return {
    user_id: opts.user_id,
    team_id: opts.team_id,
    team_role: membership.role,
    membership_source: "explicit_membership",
  };
}
