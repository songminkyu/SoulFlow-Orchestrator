/**
 * MentionPicker 컴포넌트 테스트.
 * 렌더링, 검색 필터링, 키보드 네비게이션, onSelect 콜백.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── 모킹 ──────────────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/hooks/use-click-outside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn() },
}));

import { MentionPicker, type MentionItem } from "@/components/mention-picker";
import { useQuery } from "@tanstack/react-query";

const AGENTS: MentionItem[] = [
  { type: "agent", id: "a1", name: "Agent Alpha", description: "First agent" },
  { type: "agent", id: "a2", name: "Agent Beta" },
];

function mockQueries(opts?: { tools?: MentionItem[]; workflows?: MentionItem[] }) {
  const tools = opts?.tools ?? [];
  const workflows = opts?.workflows ?? [];
  vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "mention-mcp-servers") {
      return {
        data: tools.length > 0
          ? [{ name: "mcp-srv", tools: tools.map((t) => ({ name: t.name, description: t.description })) }]
          : [],
        isLoading: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }
    if (queryKey[0] === "mention-workflows") {
      return {
        data: workflows.map((w) => ({ id: w.id, name: w.name, description: w.description })),
        isLoading: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { data: [], isLoading: false } as any;
  });
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("MentionPicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockQueries();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("open=false이면 렌더링하지 않는다", () => {
    const { container } = render(
      <MentionPicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("open=true이면 3개 컬럼 제목을 렌더한다", () => {
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} agents={AGENTS} />,
    );
    expect(screen.getByText("mention.agents")).toBeInTheDocument();
    expect(screen.getByText("mention.tools")).toBeInTheDocument();
    expect(screen.getByText("mention.workflows")).toBeInTheDocument();
  });

  it("에이전트 목록을 렌더한다", () => {
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} agents={AGENTS} />,
    );
    expect(screen.getByText("Agent Alpha")).toBeInTheDocument();
    expect(screen.getByText("Agent Beta")).toBeInTheDocument();
  });

  it("검색어로 필터링한다 (debounce 적용)", async () => {
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} agents={AGENTS} />,
    );
    const input = screen.getByPlaceholderText("mention.search_placeholder");
    fireEvent.change(input, { target: { value: "Alpha" } });

    // debounce 전에는 아직 필터 안 됨
    expect(screen.getByText("Agent Beta")).toBeInTheDocument();

    // debounce 시간 경과
    act(() => { vi.advanceTimersByTime(250); });

    expect(screen.getByText("Agent Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Agent Beta")).toBeNull();
  });

  it("항목 클릭 시 onSelect 콜백을 호출한다", () => {
    const onSelect = vi.fn();
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={onSelect} agents={AGENTS} />,
    );
    fireEvent.click(screen.getByText("Agent Alpha"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1", name: "Agent Alpha" }),
    );
  });

  it("키보드 ArrowDown/Enter로 항목을 선택한다", () => {
    const onSelect = vi.fn();
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={onSelect} agents={AGENTS} />,
    );
    const input = screen.getByPlaceholderText("mention.search_placeholder");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1", name: "Agent Alpha" }),
    );
  });

  it("키보드 ArrowUp으로 포커스를 위로 이동한다", () => {
    const onSelect = vi.fn();
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={onSelect} agents={AGENTS} />,
    );
    const input = screen.getByPlaceholderText("mention.search_placeholder");

    // 두 번 아래 → 한 번 위 → Enter = 첫 번째 항목
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1" }),
    );
  });

  it("Escape 키로 onClose를 호출한다", () => {
    const onClose = vi.fn();
    render(
      <MentionPicker open={true} onClose={onClose} onSelect={vi.fn()} agents={AGENTS} />,
    );
    const input = screen.getByPlaceholderText("mention.search_placeholder");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("결과 없을 때 no_results를 표시한다", () => {
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} agents={[]} />,
    );
    // 3개 컬럼 모두 빈 상태
    const noResults = screen.getAllByText("mention.no_results");
    expect(noResults).toHaveLength(3);
  });

  it("MCP 도구와 워크플로우를 렌더한다", () => {
    mockQueries({
      tools: [{ type: "tool", id: "t1", name: "exec", description: "Execute command" }],
      workflows: [{ type: "workflow", id: "w1", name: "Deploy", description: "Deploy workflow" }],
    });
    render(
      <MentionPicker open={true} onClose={vi.fn()} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("exec")).toBeInTheDocument();
    expect(screen.getByText("Deploy")).toBeInTheDocument();
  });
});
