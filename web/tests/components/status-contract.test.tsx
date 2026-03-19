/**
 * FE-3: StatusView -- loading/error/empty/success 상태 렌더링 테스트.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { StatusView } from "@/components/status-contract";

describe("StatusView", () => {
  it("loading 상태에서 스피너와 메시지를 렌더링한다", () => {
    render(<StatusView state="loading" />);
    expect(screen.getByText("status.loading")).toBeInTheDocument();
    expect(document.querySelector(".status-view--loading")).toBeTruthy();
  });

  it("error 상태에서 에러 메시지를 렌더링한다", () => {
    render(<StatusView state="error" errorMessage="Network failed" />);
    expect(screen.getByText("Network failed")).toBeInTheDocument();
    expect(document.querySelector('[role="alert"]')).toBeTruthy();
  });

  it("error 상태에서 커스텀 메시지가 없으면 기본 메시지를 표시한다", () => {
    render(<StatusView state="error" />);
    expect(screen.getByText("status.error")).toBeInTheDocument();
  });

  it("empty 상태에서 빈 메시지를 렌더링한다", () => {
    render(<StatusView state="empty" />);
    expect(screen.getByText("status.empty")).toBeInTheDocument();
  });

  it("success 상태에서 자식을 렌더링한다", () => {
    render(<StatusView state="success"><div>Content</div></StatusView>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });
});
