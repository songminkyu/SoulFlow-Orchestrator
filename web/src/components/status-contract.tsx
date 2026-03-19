/**
 * StatusView — 4가지 상태(loading|error|empty|success)에 대한 공통 래퍼.
 *
 * loading → SkeletonGrid, error → 재시도 버튼 + 메시지,
 * empty → EmptyState 안내 문구, success → children.
 */

import type { ReactNode } from "react";
import { useT } from "../i18n";
import { EmptyState } from "./empty-state";
import { SkeletonGrid } from "./skeleton-grid";

export type ViewStatus = "loading" | "error" | "empty" | "success";

export function StatusView({
  status,
  errorMessage,
  onRetry,
  emptyMessage,
  skeletonCount = 3,
  children,
}: {
  status: ViewStatus;
  /** error 상태에서 표시할 메시지. 미지정 시 i18n 기본값. */
  errorMessage?: string;
  /** error 상태에서 재시도 콜백. 미지정 시 재시도 버튼 미표시. */
  onRetry?: () => void;
  /** empty 상태에서 표시할 안내 문구. 미지정 시 i18n 기본값. */
  emptyMessage?: string;
  /** loading 상태 스켈레톤 카드 수. */
  skeletonCount?: number;
  /** success 상태에서 렌더링할 콘텐츠. */
  children?: ReactNode;
}) {
  const t = useT();

  if (status === "loading") {
    return <SkeletonGrid count={skeletonCount} />;
  }

  if (status === "error") {
    return (
      <EmptyState
        type="error"
        title={errorMessage ?? t("status.error")}
        actions={
          onRetry ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onRetry}
            >
              {t("status.retry")}
            </button>
          ) : undefined
        }
      />
    );
  }

  if (status === "empty") {
    return (
      <EmptyState
        type="empty"
        title={emptyMessage ?? t("status.empty")}
      />
    );
  }

  // success
  return <>{children}</>;
}
