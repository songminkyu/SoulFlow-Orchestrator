/**
 * FE-3: StatusView -- loading/error/empty/success 상태 렌더링 테스트.
 * FE-5: prop 이름 `state` -> `status`로 수정 (실제 컴포넌트 인터페이스 일치).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));
vi.mock("@/components/skeleton-grid", () => ({
  SkeletonGrid: ({ count }: { count: number }) => <div data-testid="skeleton-grid">{count} skeletons</div>,
}));
vi.mock("@/components/empty-state", () => ({
  EmptyState: ({ title, type }: { title: string; type?: string }) => (
    <div role={type === "error" ? "alert" : "status"} data-type={type}>{title}</div>
  ),
}));

import { StatusView } from "@/components/status-contract";

describe("StatusView", () => {
  it("loading 상태에서 SkeletonGrid를 렌더링한다", () => {
    render(<StatusView status="loading" />);
    expect(screen.getByTestId("skeleton-grid")).toBeInTheDocument();
  });

  it("error 상태에서 에러 메시지를 렌더링한다", () => {
    render(<StatusView status="error" errorMessage="Network failed" />);
    expect(screen.getByText("Network failed")).toBeInTheDocument();
  });

  it("error 상태에서 커스텀 메시지가 없으면 기본 메시지를 표시한다", () => {
    render(<StatusView status="error" />);
    expect(screen.getByText("status.error")).toBeInTheDocument();
  });

  it("empty 상태에서 빈 메시지를 렌더링한다", () => {
    render(<StatusView status="empty" />);
    expect(screen.getByText("status.empty")).toBeInTheDocument();
  });

  it("success 상태에서 자식을 렌더링한다", () => {
    render(<StatusView status="success"><div>Content</div></StatusView>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
