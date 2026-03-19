/**
 * StatusView 컴포넌트 테스트 — 4가지 상태별 렌더링.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatusView } from "../src/components/status-contract";
import { I18nProvider } from "../src/i18n";

function wrap(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("StatusView", () => {
  it("loading -> renders skeleton grid", () => {
    const { container } = wrap(<StatusView status="loading" skeletonCount={2} />);
    const skeletons = container.querySelectorAll(".skeleton-card");
    expect(skeletons.length).toBe(2);
  });

  it("error -> renders error message with retry button", () => {
    const onRetry = vi.fn();
    wrap(<StatusView status="error" onRetry={onRetry} />);

    // EmptyState uses role="status"
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();

    const retryBtn = screen.getByRole("button");
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("error -> custom error message", () => {
    wrap(<StatusView status="error" errorMessage="Custom error" />);
    expect(screen.getByText("Custom error")).toBeInTheDocument();
  });

  it("error -> no retry button when onRetry is not provided", () => {
    wrap(<StatusView status="error" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("empty -> renders empty state", () => {
    wrap(<StatusView status="empty" />);
    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
  });

  it("empty -> custom message", () => {
    wrap(<StatusView status="empty" emptyMessage="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("success -> renders children", () => {
    wrap(
      <StatusView status="success">
        <div data-testid="content">Hello</div>
      </StatusView>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("success -> no children renders nothing", () => {
    const { container } = wrap(<StatusView status="success" />);
    // empty fragment
    expect(container.innerHTML).toBe("");
  });
});
