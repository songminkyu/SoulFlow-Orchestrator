/**
 * useSurfaceGuard — 권한 tier 계산 + 가시성 제어 훅.
 *
 * auth_user.role (시스템 역할) + auth_user.team_role (팀 역할) 을 조합하여
 * PermissionTier를 결정하고, canView(required) 로 접근 판단.
 */

import { useMemo } from "react";
import { useAuthUser } from "./use-auth";
import type { AuthUser, TeamRole } from "./use-auth";
import type { PermissionTier } from "../types/visibility";
import { isTierAtLeast } from "../types/visibility";

/**
 * AuthUser의 role + team_role 조합으로 PermissionTier를 결정.
 *
 * 매핑 규칙:
 *   superadmin (system_role) → "superadmin"
 *   team_role=owner           → "operator"
 *   team_role=manager         → "workspace_editor"
 *   team_role=member          → "authenticated_member"
 *   team_role=viewer          → "authenticated_member"
 *   인증됨 but no team_role   → "authenticated_member"
 *   미인증 / null             → "consumer"
 */
export function resolveTier(user: AuthUser | null | undefined): PermissionTier {
  if (!user) return "consumer";
  if (user.role === "superadmin") return "superadmin";

  const teamRole: TeamRole | null | undefined = user.team_role;
  if (teamRole === "owner") return "operator";
  if (teamRole === "manager") return "workspace_editor";
  // member, viewer, 또는 team_role 없음 → authenticated_member
  return "authenticated_member";
}

export interface SurfaceGuardResult {
  /** 현재 사용자의 계산된 PermissionTier. */
  tier: PermissionTier;
  /** 주어진 requiredTier 이상의 권한인지 확인. */
  canView: (requiredTier: PermissionTier) => boolean;
}

/**
 * 현재 인증 사용자의 PermissionTier를 계산하고, canView 헬퍼를 제공.
 */
export function useSurfaceGuard(): SurfaceGuardResult {
  const { data: user } = useAuthUser();

  const tier = useMemo(() => resolveTier(user), [user]);

  const canView = useMemo(
    () => (requiredTier: PermissionTier) => isTierAtLeast(tier, requiredTier),
    [tier],
  );

  return { tier, canView };
}
