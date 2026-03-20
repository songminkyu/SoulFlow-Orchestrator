/**
 * StatusBadge — 공통 상태 뱃지.
 * variant: ok / warn / err / off / accent / info
 * size: sm (작은 뱃지) / md (일반)
 */

import type { ReactNode } from "react";

export type BadgeVariant = "ok" | "warn" | "err" | "off" | "accent" | "info";

export interface StatusBadgeProps {
  variant: BadgeVariant;
  label: string;
  icon?: ReactNode;
  size?: "sm" | "md";
  className?: string;
}

export function StatusBadge({
  variant,
  label,
  icon,
  size = "md",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={[
        "status-badge",
        `status-badge--${variant}`,
        `status-badge--${size}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon && <span className="status-badge__icon" aria-hidden="true">{icon}</span>}
      <span className="status-badge__label">{label}</span>
    </span>
  );
}
