/** EV FE: PromptingPage → eval 탭 진입 통합 테스트. */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// 모든 하위 패널 mock — eval 탭 진입만 검증
vi.mock("@/pages/prompting/text-panel", () => ({ TextPanel: () => <div data-testid="text-panel" /> }));
vi.mock("@/pages/prompting/image-panel", () => ({ ImagePanel: () => <div data-testid="image-panel" /> }));
vi.mock("@/pages/prompting/video-panel", () => ({ VideoPanel: () => <div data-testid="video-panel" /> }));
vi.mock("@/pages/prompting/agent-panel", () => ({ AgentPanel: () => <div data-testid="agent-panel" /> }));
vi.mock("@/pages/prompting/gallery-panel", () => ({ GalleryPanel: () => <div data-testid="gallery-panel" /> }));
vi.mock("@/pages/prompting/compare-panel", () => ({ ComparePanel: () => <div data-testid="compare-panel" /> }));
vi.mock("@/pages/prompting/eval-panel", () => ({ EvalPanel: () => <div data-testid="eval-panel" /> }));

import PromptingPage from "@/pages/prompting/index";

describe("PromptingPage — eval 탭 진입", () => {
  it("초기 상태 — Text 탭 렌더", async () => {
    render(<PromptingPage />);
    await waitFor(() => expect(screen.getByTestId("text-panel")).toBeInTheDocument());
    expect(screen.queryByTestId("eval-panel")).toBeNull();
  });

  it("Eval 탭 클릭 → EvalPanel 렌더", async () => {
    render(<PromptingPage />);
    fireEvent.click(screen.getByText("Eval"));
    await waitFor(() => expect(screen.getByTestId("eval-panel")).toBeInTheDocument());
    expect(screen.queryByTestId("text-panel")).toBeNull();
  });

  it("Eval 탭이 탭 목록에 존재", () => {
    render(<PromptingPage />);
    const eval_tab = screen.getByText("Eval");
    expect(eval_tab).toBeInTheDocument();
    expect(eval_tab.closest("button")).toBeTruthy();
  });
});
