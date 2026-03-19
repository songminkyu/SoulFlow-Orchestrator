/**
 * VisibilityBadge — PermissionTier에 따른 badge 렌더링.
 *
 * tier별 색상 + 라벨을 i18n 키에서 조회. data-tier 속성으로 CSS 스타일링 지원.
 */

import { useT } from "../i18n";
import type { PermissionTier } from "../types/visibility";

/** tier별 CSS variant 매핑. */
const TIER_VARIANT: Record<PermissionTier, string> = {
  consumer: "off",
  authenticated_member: "info",
  workspace_editor: "ok",
  operator: "warn",
  superadmin: "err",
};

/** tier별 i18n 키 매핑. */
const TIER_I18N_KEY: Record<PermissionTier, string> = {
  consumer: "permission.consumer",
  authenticated_member: "permission.authenticated_member",
  workspace_editor: "permission.workspace_editor",
  operator: "permission.operator",
  superadmin: "permission.superadmin",
};

export function VisibilityBadge({
  tier,
  className,
}: {
  tier: PermissionTier;
  className?: string;
}) {
  const t = useT();
  const variant = TIER_VARIANT[tier];
  const label = t(TIER_I18N_KEY[tier]);

  return (
    <span
      className={`badge badge--${variant}${className ? ` ${className}` : ""}`}
      data-tier={tier}
      aria-label={label}
    >
      {label}
    </span>
  );
}
