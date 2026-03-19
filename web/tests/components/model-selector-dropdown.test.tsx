/**
 * ModelSelectorDropdown 컴포넌트 테스트.
 * 렌더링, 프로바이더 그룹, 검색, onSelect.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── 모킹 ──────────────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/hooks/use-click-outside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn() },
}));

const PROVIDERS = [
  { instance_id: "p1", label: "OpenAI", provider_type: "openai", available: true },
  { instance_id: "p2", label: "Anthropic", provider_type: "anthropic", available: true },
];

const MODELS_P1 = [
  { id: "gpt-4", name: "GPT-4", purpose: "chat" },
  { id: "gpt-3.5", name: "GPT-3.5", purpose: "chat" },
];

const MODELS_P2 = [
  { id: "claude-3", name: "Claude 3", purpose: "chat" },
];

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useQueries: vi.fn(),
}));

import { ModelSelectorDropdown } from "@/components/model-selector-dropdown";
import { useQuery, useQueries } from "@tanstack/react-query";

function mockQueries() {
  vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "model-selector-providers") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { data: PROVIDERS, isLoading: false } as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { data: [], isLoading: false } as any;
  });

  vi.mocked(useQueries).mockReturnValue([
    { data: MODELS_P1, isLoading: false, status: "success" },
    { data: MODELS_P2, isLoading: false, status: "success" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as any);
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("ModelSelectorDropdown", () => {
  beforeEach(() => {
    mockQueries();
  });

  it("기본 상태에서 트리거 버튼을 렌더한다", () => {
    render(<ModelSelectorDropdown value="" onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: "model_selector.select" })).toBeInTheDocument();
  });

  it("선택된 모델 이름을 트리거에 표시한다", () => {
    render(<ModelSelectorDropdown value="gpt-4" onSelect={vi.fn()} />);
    expect(screen.getByText("GPT-4")).toBeInTheDocument();
  });

  it("트리거 클릭 시 드롭다운을 연다", () => {
    render(<ModelSelectorDropdown value="" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "model_selector.select" }));
    expect(screen.getByPlaceholderText("model_selector.search")).toBeInTheDocument();
  });

  it("프로바이더별 그룹을 표시한다", () => {
    render(<ModelSelectorDropdown value="" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "model_selector.select" }));
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
  });

  it("모델 목록을 프로바이더 그룹 아래에 표시한다", () => {
    render(<ModelSelectorDropdown value="" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "model_selector.select" }));
    expect(screen.getByText("GPT-4")).toBeInTheDocument();
    expect(screen.getByText("GPT-3.5")).toBeInTheDocument();
    expect(screen.getByText("Claude 3")).toBeInTheDocument();
  });

  it("검색으로 모델을 필터링한다", () => {
    render(<ModelSelectorDropdown value="" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "model_selector.select" }));
    const searchInput = screen.getByPlaceholderText("model_selector.search");
    fireEvent.change(searchInput, { target: { value: "Claude" } });
    expect(screen.getByText("Claude 3")).toBeInTheDocument();
    expect(screen.queryByText("GPT-4")).toBeNull();
    expect(screen.queryByText("GPT-3.5")).toBeNull();
  });

  it("모델 클릭 시 onSelect 콜백을 호출한다", () => {
    const onSelect = vi.fn();
    render(<ModelSelectorDropdown value="" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "model_selector.select" }));
    fireEvent.click(screen.getByText("GPT-4"));
    expect(onSelect).toHaveBeenCalledWith("gpt-4");
  });

  it("모델 선택 후 드롭다운을 닫는다", () => {
    render(<ModelSelectorDropdown value="" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "model_selector.select" }));
    fireEvent.click(screen.getByText("GPT-4"));
    expect(screen.queryByPlaceholderText("model_selector.search")).toBeNull();
  });

  it("선택된 모델에 selected 상태를 표시한다", () => {
    render(<ModelSelectorDropdown value="claude-3" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "model_selector.select" }));
    const option = screen.getByRole("option", { name: "Claude 3" });
    expect(option).toHaveAttribute("aria-selected", "true");
  });
});
