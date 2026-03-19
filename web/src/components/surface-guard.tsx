/**
 * SurfaceGuard — tier 기반으로 children을 표시/숨김하는 래퍼 컴포넌트.
 *
 * <SurfaceGuard requiredTier="operator">
 *   <AdminPanel />
 * </SurfaceGuard>
 */

import type { ReactNode } from "react";
import type { PermissionTier } from "../types/visibility";
import { useSurfaceGuard } from "../hooks/use-surface-guard";

export function SurfaceGuard({
  requiredTier,
  fallback = null,
  children,
}: {
  requiredTier: PermissionTier;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { canView } = useSurfaceGuard();

  if (!canView(requiredTier)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
