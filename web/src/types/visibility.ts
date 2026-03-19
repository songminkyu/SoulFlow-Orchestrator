/**
 * 프론트엔드 전반에서 사용하는 권한/가시성 공통 계약.
 *
 * PermissionTier: 낮은 권한에서 높은 권한 순서로 정렬.
 * TIER_ORDER: 비교 연산용 인덱스 맵.
 */

/** 권한 등급 — 낮은 순에서 높은 순. */
export type PermissionTier =
  | "consumer"
  | "authenticated_member"
  | "workspace_editor"
  | "operator"
  | "superadmin";

/** 권한 비교 연산을 위한 순서 배열 (인덱스가 높을수록 강한 권한). */
export const TIER_ORDER: readonly PermissionTier[] = [
  "consumer",
  "authenticated_member",
  "workspace_editor",
  "operator",
  "superadmin",
] as const;

/** tier의 서열 인덱스를 반환. 알 수 없는 값이면 0(consumer). */
export function tierIndex(tier: PermissionTier): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx >= 0 ? idx : 0;
}

/** a가 b 이상의 권한인지 비교. */
export function isTierAtLeast(
  current: PermissionTier,
  required: PermissionTier,
): boolean {
  return tierIndex(current) >= tierIndex(required);
}
