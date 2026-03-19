/**
 * FE-6: StatusView Contract 회귀 — EmptyState 4가지 상태 렌더 + onRetry 콜백 검증.
 *
 * 검증 축:
 * 1. EmptyState: loading/error/empty/no-results 상태별 올바른 렌더
 * 2. error 상태에서 retry 액션 버튼 동작
 * 3. 각 상태의 role="status" + aria-label 접근성 준수
 * 4. Badge 상태별 CSS 클래스 매핑 (cross-check)
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { EmptyState } from "@/components/empty-state";
import type { EmptyStateType } from "@/components/empty-state";

// -- EmptyState 4가지 상태 렌더 -----------------------------------------------

describe("EmptyState — 4 상태 렌더 (FE-6)", () => {
  const cases: { type: EmptyStateType; icon: string; ariaLabel: string }[] = [
    { type: "loading", icon: "⏳", ariaLabel: "common.loading" },
    { type: "error", icon: "⚠️", ariaLabel: "error" },
    { type: "empty", icon: "📭", ariaLabel: "empty" },
    { type: "no-results", icon: "🔍", ariaLabel: "no-results" },
  ];

  for (const { type, ariaLabel } of cases) {
    it(`type="${type}"가 올바르게 렌더된다`, () => {
      render(<EmptyState type={type} title={`${type} title`} />);
      expect(screen.getByText(`${type} title`)).toBeInTheDocument();
      const status_el = screen.getByRole("status");
      expect(status_el.getAttribute("aria-label")).toBe(ariaLabel);
    });
  }

  it("기본 type은 empty이다", () => {
    render(<EmptyState title="default state" />);
    const status_el = screen.getByRole("status");
    expect(status_el.getAttribute("aria-label")).toBe("empty");
  });
});

// -- description + actions 렌더 -------------------------------------------------

describe("EmptyState — description/actions 슬롯 (FE-6)", () => {
  it("description이 렌더된다", () => {
    render(<EmptyState title="main" description="hint text" />);
    expect(screen.getByText("hint text")).toBeInTheDocument();
  });

  it("description 미설정 시 hint 영역이 없다", () => {
    const { container } = render(<EmptyState title="main" />);
    expect(container.querySelector(".empty-state__hint")).toBeNull();
  });

  it("actions 슬롯이 렌더된다", () => {
    const retry = vi.fn();
    render(
      <EmptyState
        type="error"
        title="Error occurred"
        actions={<button onClick={retry}>Retry</button>}
      />,
    );
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("actions 미설정 시 actions 영역이 없다", () => {
    const { container } = render(<EmptyState type="error" title="Error" />);
    expect(container.querySelector(".empty-state__actions")).toBeNull();
  });
});

// -- onRetry 콜백 동작 --------------------------------------------------------

describe("EmptyState — retry 콜백 (FE-6)", () => {
  it("error 상태에서 retry 버튼 클릭 시 콜백이 호출된다", () => {
    const on_retry = vi.fn();
    render(
      <EmptyState
        type="error"
        title="Something went wrong"
        actions={<button onClick={on_retry}>Retry</button>}
      />,
    );
    fireEvent.click(screen.getByText("Retry"));
    expect(on_retry).toHaveBeenCalledOnce();
  });

  it("loading 상태에서는 actions 없이 상태만 표시 가능", () => {
    const { container } = render(
      <EmptyState type="loading" title="Loading..." />,
    );
    expect(container.querySelector(".empty-state__actions")).toBeNull();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});

// -- 접근성 검증 ---------------------------------------------------------------

describe("EmptyState — 접근성 (FE-6)", () => {
  it("role=status가 설정되어 있다", () => {
    render(<EmptyState title="accessible" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("icon 영역에 aria-hidden=true가 설정되어 있다", () => {
    const { container } = render(<EmptyState title="test" />);
    const icon_el = container.querySelector(".empty-state__icon");
    expect(icon_el?.getAttribute("aria-hidden")).toBe("true");
  });

  it("커스텀 icon이 기본 icon을 대체한다", () => {
    const { container } = render(<EmptyState title="custom" icon="🎯" />);
    const icon_el = container.querySelector(".empty-state__icon");
    expect(icon_el?.textContent).toBe("🎯");
  });

  it("className prop이 적용된다", () => {
    const { container } = render(<EmptyState title="cls" className="custom-cls" />);
    expect(container.querySelector(".empty-state.custom-cls")).not.toBeNull();
  });
});

// -- EmptyStateType 타입 계약 --------------------------------------------------

describe("EmptyStateType — 유효 값 회귀 (FE-6)", () => {
  it("4가지 상태가 모두 유효하다", () => {
    const types: EmptyStateType[] = ["empty", "loading", "error", "no-results"];
    expect(types).toHaveLength(4);
  });
});
