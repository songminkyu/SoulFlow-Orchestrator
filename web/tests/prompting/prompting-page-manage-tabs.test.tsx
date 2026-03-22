/** FE-PE-1: 프롬프팅 스튜디오 — manage 탭 4개 진입 테스트. */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/i18n", () => ({ useT: () => (k: string) => k }));

// creative panels
vi.mock("@/pages/prompting/text-panel", () => ({ TextPanel: () => <div data-testid="text-panel" /> }));
vi.mock("@/pages/prompting/image-panel", () => ({ ImagePanel: () => <div data-testid="image-panel" /> }));
vi.mock("@/pages/prompting/video-panel", () => ({ VideoPanel: () => <div data-testid="video-panel" /> }));
vi.mock("@/pages/prompting/agent-panel", () => ({ AgentPanel: () => <div data-testid="agent-panel" /> }));
vi.mock("@/pages/prompting/gallery-panel", () => ({ GalleryPanel: () => <div data-testid="gallery-panel" /> }));
vi.mock("@/pages/prompting/compare-panel", () => ({ ComparePanel: () => <div data-testid="compare-panel" /> }));
vi.mock("@/pages/prompting/eval-panel", () => ({ EvalPanel: () => <div data-testid="eval-panel" /> }));

// manage panels (workspace)
vi.mock("@/pages/workspace/skills", () => ({ SkillsTab: () => <div data-testid="skills-panel" /> }));
vi.mock("@/pages/workspace/templates", () => ({ TemplatesTab: () => <div data-testid="templates-panel" /> }));
vi.mock("@/pages/workspace/tools", () => ({ ToolsTab: () => <div data-testid="tools-panel" /> }));
vi.mock("@/pages/workspace/references", () => ({ ReferencesTab: () => <div data-testid="rag-panel" /> }));

import PromptingPage from "@/pages/prompting/index";

describe("PromptingPage — manage 탭 진입", () => {
  it("11개 탭 버튼이 모두 렌더링", () => {
    render(<PromptingPage />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(11);
  });

  it("creative / manage 영역이 분리됨", () => {
    const { container } = render(<PromptingPage />);
    expect(container.querySelector(".ps-tabs__creative")).toBeTruthy();
    expect(container.querySelector(".ps-tabs__sep")).toBeTruthy();
    expect(container.querySelector(".ps-tabs__manage")).toBeTruthy();
  });

  it("Skills 탭 클릭 → SkillsTab 렌더", async () => {
    render(<PromptingPage />);
    fireEvent.click(screen.getByText("prompting.tab_skills"));
    await waitFor(() => expect(screen.getByTestId("skills-panel")).toBeInTheDocument());
  });

  it("Templates 탭 클릭 → TemplatesTab 렌더", async () => {
    render(<PromptingPage />);
    fireEvent.click(screen.getByText("prompting.tab_templates"));
    await waitFor(() => expect(screen.getByTestId("templates-panel")).toBeInTheDocument());
  });

  it("Tools 탭 클릭 → ToolsTab 렌더", async () => {
    render(<PromptingPage />);
    fireEvent.click(screen.getByText("prompting.tab_tools"));
    await waitFor(() => expect(screen.getByTestId("tools-panel")).toBeInTheDocument());
  });

  it("RAG 탭 클릭 → ReferencesTab 렌더", async () => {
    render(<PromptingPage />);
    fireEvent.click(screen.getByText("prompting.tab_rag"));
    await waitFor(() => expect(screen.getByTestId("rag-panel")).toBeInTheDocument());
  });

  it("manage 탭 → creative 탭 복귀", async () => {
    render(<PromptingPage />);
    fireEvent.click(screen.getByText("prompting.tab_skills"));
    await waitFor(() => expect(screen.getByTestId("skills-panel")).toBeInTheDocument());
    fireEvent.click(screen.getByText("prompting.tab_text"));
    await waitFor(() => expect(screen.getByTestId("text-panel")).toBeInTheDocument());
    expect(screen.queryByTestId("skills-panel")).toBeNull();
  });

  it("nav_label aria-label이 i18n 키 사용", () => {
    render(<PromptingPage />);
    const nav = screen.getByRole("tablist");
    expect(nav.getAttribute("aria-label")).toBe("prompting.nav_label");
  });
});
