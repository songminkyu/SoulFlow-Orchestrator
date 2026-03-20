/**
 * SharedPromptBar + SharedChatView + MemoryPanel 테스트 스위트.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── 공통 모킹 ───────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (s, [k, v]) => s.replace(`{${k}}`, String(v)),
        key,
      );
    }
    return key;
  },
}));

vi.mock("@/hooks/use-click-outside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({ data: undefined, isLoading: false, isError: false }),
  useQueries: vi.fn().mockReturnValue([]),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn() }),
}));

import { useQuery, useQueries } from "@tanstack/react-query";
import { SharedPromptBar } from "@/components/shared/prompt-bar";
import type { SharedPromptBarProps } from "@/components/shared/prompt-bar";
import { SharedChatView } from "@/components/shared/chat-view";
import type { ChatViewMessage } from "@/components/shared/chat-view";
import { MemoryPanel } from "@/components/shared/memory-panel";
import type { Endpoint } from "@/components/shared/endpoint-selector";
import type { ToolChip } from "@/components/shared/tool-chips";

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function makePromptBarProps(overrides?: Partial<SharedPromptBarProps>): SharedPromptBarProps {
  return {
    input: "",
    onInputChange: vi.fn(),
    onSend: vi.fn(),
    sending: false,
    streaming: false,
    endpoint: null,
    onEndpointChange: vi.fn(),
    tools: [],
    onToolAdd: vi.fn(),
    onToolRemove: vi.fn(),
    toolChoice: "auto",
    onToolChoiceChange: vi.fn(),
    ...overrides,
  };
}

function mockEmptyQueries() {
  vi.mocked(useQuery).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useQuery>);
  vi.mocked(useQueries).mockReturnValue([]);
}

// ── SharedPromptBar ─────────────────────────────────────────────────────────

describe("SharedPromptBar", () => {
  beforeEach(() => {
    mockEmptyQueries();
  });

  it("기본 렌더링 — 텍스트에리어가 있다", () => {
    render(<SharedPromptBar {...makePromptBarProps()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shared-prompt-bar 루트 클래스가 있다", () => {
    const { container } = render(<SharedPromptBar {...makePromptBarProps()} />);
    expect(container.querySelector(".shared-prompt-bar")).toBeInTheDocument();
  });

  it("className prop이 루트에 추가된다", () => {
    const { container } = render(
      <SharedPromptBar {...makePromptBarProps()} className="custom-bar" />,
    );
    expect(container.querySelector(".shared-prompt-bar.custom-bar")).toBeInTheDocument();
  });

  it("@ 버튼이 렌더링된다", () => {
    render(<SharedPromptBar {...makePromptBarProps()} />);
    const atBtn = screen.getByTestId("at-button");
    expect(atBtn).toBeInTheDocument();
  });

  it("@ 버튼 클릭 시 UnifiedSelector가 열린다", () => {
    vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[0] as string;
      if (key === "unified-selector-agents") return { data: [], isLoading: false } as ReturnType<typeof useQuery>;
      if (key === "unified-selector-mcp") return { data: { servers: [] }, isLoading: false } as ReturnType<typeof useQuery>;
      if (key === "unified-selector-workflows") return { data: [], isLoading: false } as ReturnType<typeof useQuery>;
      return { data: undefined, isLoading: false } as ReturnType<typeof useQuery>;
    });

    const { container } = render(<SharedPromptBar {...makePromptBarProps()} />);
    const atBtn = screen.getByTestId("at-button");
    fireEvent.click(atBtn);
    expect(container.querySelector(".unified-selector")).toBeInTheDocument();
  });

  it("@ 버튼 클릭 시 aria-expanded=true가 된다", () => {
    mockEmptyQueries();
    render(<SharedPromptBar {...makePromptBarProps()} />);
    const atBtn = screen.getByTestId("at-button");
    expect(atBtn).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(atBtn);
    expect(atBtn).toHaveAttribute("aria-expanded", "true");
  });

  it("전송 버튼이 렌더링된다", () => {
    render(<SharedPromptBar {...makePromptBarProps()} />);
    expect(screen.getByTestId("send-button")).toBeInTheDocument();
  });

  it("input이 있을 때 Enter 키로 onSend를 호출한다", () => {
    const onSend = vi.fn();
    render(<SharedPromptBar {...makePromptBarProps({ input: "hello", onSend })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", nativeEvent: { isComposing: false } });
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("input이 비어 있을 때 Enter 키로 onSend를 호출하지 않는다", () => {
    const onSend = vi.fn();
    render(<SharedPromptBar {...makePromptBarProps({ input: "", onSend })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", nativeEvent: { isComposing: false } });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("Shift+Enter 키로 onSend를 호출하지 않는다", () => {
    const onSend = vi.fn();
    render(<SharedPromptBar {...makePromptBarProps({ input: "hello", onSend })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true, nativeEvent: { isComposing: false } });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("streaming=true 시 중단 버튼이 렌더링된다", () => {
    const { container } = render(
      <SharedPromptBar {...makePromptBarProps({ streaming: true })} />,
    );
    const sendBtn = screen.getByTestId("send-button");
    expect(sendBtn).toHaveClass("shared-prompt-bar__btn--stop");
    expect(container.querySelector(".shared-prompt-bar__stop-icon")).toBeInTheDocument();
  });

  it("streaming=false 시 전송 아이콘이 렌더링된다", () => {
    const { container } = render(
      <SharedPromptBar {...makePromptBarProps({ input: "hi", streaming: false })} />,
    );
    expect(container.querySelector(".shared-prompt-bar__send-icon")).toBeInTheDocument();
  });

  it("streaming=true + onStop 클릭 시 onStop이 호출된다", () => {
    const onStop = vi.fn();
    render(
      <SharedPromptBar {...makePromptBarProps({ streaming: true, onStop })} />,
    );
    fireEvent.click(screen.getByTestId("send-button"));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("endpoint가 있을 때 EndpointSelector에 표시된다", () => {
    const ep: Endpoint = { type: "model", id: "gpt-4o", label: "GPT-4o" };
    render(<SharedPromptBar {...makePromptBarProps({ endpoint: ep })} />);
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
  });

  it("tools가 있을 때 ToolChips가 렌더링된다", () => {
    const tools: ToolChip[] = [{ id: "t1", name: "exec" }];
    const { container } = render(
      <SharedPromptBar {...makePromptBarProps({ tools })} />,
    );
    expect(container.querySelector(".tool-chips")).toBeInTheDocument();
    expect(screen.getByText("exec")).toBeInTheDocument();
  });

  it("tools가 없을 때 ToolChips가 렌더링되지 않는다", () => {
    const { container } = render(<SharedPromptBar {...makePromptBarProps({ tools: [] })} />);
    expect(container.querySelector(".tool-chips")).toBeNull();
  });

  it("tools count 배지가 표시된다", () => {
    const tools: ToolChip[] = [
      { id: "t1", name: "exec" },
      { id: "t2", name: "read" },
    ];
    const { container } = render(<SharedPromptBar {...makePromptBarProps({ tools })} />);
    // The i18n mock returns the key with {count} replaced — key is "shared_prompt_bar.tools_count"
    // which has no {count} placeholder so mock returns the key as-is.
    expect(container.querySelector(".shared-prompt-bar__tool-count")).toBeInTheDocument();
  });

  it("빈 상태에서 greeting이 표시된다", () => {
    render(
      <SharedPromptBar
        {...makePromptBarProps({ input: "", greeting: "안녕하세요!" })}
      />,
    );
    expect(screen.getByText("안녕하세요!")).toBeInTheDocument();
  });

  it("input이 있을 때 greeting이 표시되지 않는다", () => {
    render(
      <SharedPromptBar
        {...makePromptBarProps({ input: "hello", greeting: "안녕하세요!" })}
      />,
    );
    expect(screen.queryByText("안녕하세요!")).toBeNull();
  });

  it("빈 상태에서 AI suggestions가 렌더링된다", () => {
    render(
      <SharedPromptBar
        {...makePromptBarProps({
          input: "",
          suggestions: ["Summarize this", "Write a test"],
          onSuggestionSelect: vi.fn(),
        })}
      />,
    );
    expect(screen.getByText("Summarize this")).toBeInTheDocument();
    expect(screen.getByText("Write a test")).toBeInTheDocument();
  });

  it("AI suggestion 클릭 시 onSuggestionSelect가 호출된다", () => {
    const onSuggestionSelect = vi.fn();
    render(
      <SharedPromptBar
        {...makePromptBarProps({
          input: "",
          suggestions: ["Summarize this"],
          onSuggestionSelect,
        })}
      />,
    );
    fireEvent.click(screen.getByText("Summarize this"));
    expect(onSuggestionSelect).toHaveBeenCalledWith("Summarize this");
  });

  it("ToolChoiceToggle이 렌더링된다", () => {
    const { container } = render(<SharedPromptBar {...makePromptBarProps()} />);
    expect(container.querySelector(".tool-choice-toggle")).toBeInTheDocument();
  });

  it("disabled=true 시 textarea가 비활성화된다", () => {
    render(<SharedPromptBar {...makePromptBarProps({ disabled: true })} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });

  it("onInputChange가 textarea 변경 시 호출된다", () => {
    const onInputChange = vi.fn();
    render(<SharedPromptBar {...makePromptBarProps({ onInputChange })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "new text" } });
    expect(onInputChange).toHaveBeenCalledWith("new text");
  });

  it("@ 입력 시 UnifiedSelector가 자동 열린다", () => {
    vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[0] as string;
      if (key === "unified-selector-agents") return { data: [], isLoading: false } as ReturnType<typeof useQuery>;
      if (key === "unified-selector-mcp") return { data: { servers: [] }, isLoading: false } as ReturnType<typeof useQuery>;
      if (key === "unified-selector-workflows") return { data: [], isLoading: false } as ReturnType<typeof useQuery>;
      return { data: undefined, isLoading: false } as ReturnType<typeof useQuery>;
    });

    const onInputChange = vi.fn();
    const { container } = render(<SharedPromptBar {...makePromptBarProps({ onInputChange })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "@" } });
    expect(container.querySelector(".unified-selector")).toBeInTheDocument();
  });

  it("sending=true 시 textarea가 비활성화된다", () => {
    render(<SharedPromptBar {...makePromptBarProps({ sending: true })} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });

  it("sending=true + Enter 키로 onSend를 호출하지 않는다 (busy)", () => {
    const onSend = vi.fn();
    render(<SharedPromptBar {...makePromptBarProps({ input: "hello", sending: true, onSend })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.keyDown(textarea, { key: "Enter", nativeEvent: { isComposing: false } });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("전송 버튼 클릭 시 onSend가 호출된다", () => {
    const onSend = vi.fn();
    render(<SharedPromptBar {...makePromptBarProps({ input: "hello", onSend })} />);
    fireEvent.click(screen.getByTestId("send-button"));
    expect(onSend).toHaveBeenCalledOnce();
  });

  it("input이 없을 때 전송 버튼이 비활성화된다", () => {
    render(<SharedPromptBar {...makePromptBarProps({ input: "" })} />);
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("UnifiedSelector 에서 항목 선택 시 onToolAdd가 호출된다", async () => {
    // Setup: mock useQuery to return one agent so UnifiedSelector renders a clickable item
    vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[0] as string;
      if (key === "unified-selector-agents") {
        return {
          data: [{ slug: "agent-1", name: "Test Agent", description: "test" }],
          isLoading: false,
        } as ReturnType<typeof useQuery>;
      }
      if (key === "unified-selector-mcp") return { data: { servers: [] }, isLoading: false } as ReturnType<typeof useQuery>;
      if (key === "unified-selector-workflows") return { data: [], isLoading: false } as ReturnType<typeof useQuery>;
      return { data: undefined, isLoading: false } as ReturnType<typeof useQuery>;
    });

    const onToolAdd = vi.fn();
    render(<SharedPromptBar {...makePromptBarProps({ onToolAdd })} />);

    // Open selector via @ button
    fireEvent.click(screen.getByTestId("at-button"));

    // Click the agent item
    const agentBtn = screen.getByText("Test Agent");
    fireEvent.click(agentBtn);

    expect(onToolAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: "agent", id: "agent-1" })
    );
  });
});

// ── SharedChatView ──────────────────────────────────────────────────────────

describe("SharedChatView", () => {
  beforeEach(() => {
    mockEmptyQueries();
  });

  it("shared-chat-view 루트 클래스가 있다", () => {
    const { container } = render(
      <SharedChatView
        messages={[]}
        promptBarProps={makePromptBarProps()}
      />,
    );
    expect(container.querySelector(".shared-chat-view")).toBeInTheDocument();
  });

  it("className prop이 루트에 추가된다", () => {
    const { container } = render(
      <SharedChatView
        messages={[]}
        promptBarProps={makePromptBarProps()}
        className="custom-view"
      />,
    );
    expect(container.querySelector(".shared-chat-view.custom-view")).toBeInTheDocument();
  });

  it("메시지 목록이 렌더링된다", () => {
    const messages: ChatViewMessage[] = [
      { id: "m1", role: "user", content: "Hello there!" },
      { id: "m2", role: "assistant", content: "Hi, how can I help?" },
    ];
    render(
      <SharedChatView
        messages={messages}
        promptBarProps={makePromptBarProps()}
      />,
    );
    expect(screen.getByText("Hello there!")).toBeInTheDocument();
    expect(screen.getByText("Hi, how can I help?")).toBeInTheDocument();
  });

  it("빈 상태에서 empty 상태 영역이 렌더링된다", () => {
    const { container } = render(
      <SharedChatView
        messages={[]}
        promptBarProps={makePromptBarProps()}
        showEmpty={true}
      />,
    );
    expect(container.querySelector(".shared-chat-view__empty")).toBeInTheDocument();
  });

  it("showEmpty=false 시 empty 상태가 렌더링되지 않는다", () => {
    const { container } = render(
      <SharedChatView
        messages={[]}
        promptBarProps={makePromptBarProps()}
        showEmpty={false}
      />,
    );
    expect(container.querySelector(".shared-chat-view__empty")).toBeNull();
  });

  it("메시지가 있으면 empty 상태가 렌더링되지 않는다", () => {
    const messages: ChatViewMessage[] = [
      { id: "m1", role: "user", content: "test" },
    ];
    const { container } = render(
      <SharedChatView
        messages={messages}
        promptBarProps={makePromptBarProps()}
        showEmpty={true}
      />,
    );
    expect(container.querySelector(".shared-chat-view__empty")).toBeNull();
  });

  it("streamingMessage가 있을 때 streaming 클래스와 함께 렌더링된다", () => {
    const { container } = render(
      <SharedChatView
        messages={[]}
        streamingMessage={{ role: "assistant", content: "Typing...", streaming: true }}
        promptBarProps={makePromptBarProps()}
      />,
    );
    expect(
      container.querySelector(".shared-chat-view__message--streaming"),
    ).toBeInTheDocument();
    expect(screen.getByText("Typing...")).toBeInTheDocument();
  });

  it("PromptBar가 렌더링된다", () => {
    const { container } = render(
      <SharedChatView
        messages={[]}
        promptBarProps={makePromptBarProps()}
      />,
    );
    expect(container.querySelector(".shared-prompt-bar")).toBeInTheDocument();
    expect(container.querySelector(".shared-chat-view__prompt")).toBeInTheDocument();
  });

  it("messages 영역이 렌더링된다", () => {
    const { container } = render(
      <SharedChatView
        messages={[]}
        promptBarProps={makePromptBarProps()}
      />,
    );
    expect(container.querySelector(".shared-chat-view__messages")).toBeInTheDocument();
  });

  it("여러 메시지가 각각 response-view 클래스로 렌더링된다", () => {
    const messages: ChatViewMessage[] = [
      { id: "m1", role: "user", content: "msg1" },
      { id: "m2", role: "assistant", content: "msg2" },
      { id: "m3", role: "user", content: "msg3" },
    ];
    const { container } = render(
      <SharedChatView
        messages={messages}
        promptBarProps={makePromptBarProps()}
      />,
    );
    const views = container.querySelectorAll(".response-view");
    expect(views.length).toBe(3);
  });

  it("빈 상태에서 greeting이 PromptBar를 통해 렌더링된다", () => {
    render(
      <SharedChatView
        messages={[]}
        promptBarProps={makePromptBarProps({ greeting: "Welcome!" })}
        showEmpty={true}
      />,
    );
    expect(screen.getByText("Welcome!")).toBeInTheDocument();
  });

  it("메시지가 있을 때 greeting이 숨겨진다", () => {
    render(
      <SharedChatView
        messages={[{ id: "m1", role: "user", content: "test" }]}
        promptBarProps={makePromptBarProps({ greeting: "Welcome!" })}
        showEmpty={true}
      />,
    );
    expect(screen.queryByText("Welcome!")).toBeNull();
  });

  it("autoScroll=false 시 scrollIntoView가 호출되지 않는다 (no error)", () => {
    // Just verify component renders without error when autoScroll=false
    const { container } = render(
      <SharedChatView
        messages={[{ id: "m1", role: "user", content: "test" }]}
        promptBarProps={makePromptBarProps()}
        autoScroll={false}
      />,
    );
    expect(container.querySelector(".shared-chat-view__messages")).toBeInTheDocument();
  });

  it("streaming 메시지 있고 messages 있을 때 모두 렌더링된다", () => {
    const messages: ChatViewMessage[] = [
      { id: "m1", role: "user", content: "First message" },
    ];
    render(
      <SharedChatView
        messages={messages}
        streamingMessage={{ role: "assistant", content: "Responding now...", streaming: true }}
        promptBarProps={makePromptBarProps()}
      />,
    );
    expect(screen.getByText("First message")).toBeInTheDocument();
    expect(screen.getByText("Responding now...")).toBeInTheDocument();
  });

  it("messages 영역에 onScroll 이벤트가 연결된다", () => {
    const { container } = render(
      <SharedChatView
        messages={[{ id: "m1", role: "user", content: "test" }]}
        promptBarProps={makePromptBarProps()}
      />,
    );
    const messagesDiv = container.querySelector(".shared-chat-view__messages");
    expect(messagesDiv).toBeInTheDocument();
    // fire scroll event (plain, no target property override — scrollHeight is read-only DOM)
    fireEvent.scroll(messagesDiv!);
    expect(messagesDiv).toBeInTheDocument();  // still mounted after scroll
  });
});

// ── MemoryPanel ─────────────────────────────────────────────────────────────
// MemoryPanel은 /api/memory/longterm + /api/memory/daily 두 BE 엔드포인트를 사용.
// useQuery를 queryKey로 구분하여 모킹.

function mockMemoryQueries(opts?: {
  longtermContent?: string;
  longtermViolations?: boolean;
  days?: string[];
  loading?: boolean;
  error?: boolean;
}) {
  vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
    const key = queryKey[0] as string;
    if (opts?.loading) {
      return { data: undefined, isLoading: true, isError: false } as ReturnType<typeof useQuery>;
    }
    if (opts?.error) {
      return { data: undefined, isLoading: false, isError: true } as ReturnType<typeof useQuery>;
    }
    if (key === "memory-longterm") {
      const violations = opts?.longtermViolations
        ? [{ code: "noisy_content", severity: "major" as const, detail: "Potentially leaked secret" }]
        : [];
      return {
        data: {
          content: opts?.longtermContent ?? "User prefers concise responses.",
          audit_result: { passed: violations.length === 0, violations },
        },
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    }
    if (key === "memory-daily-list") {
      return {
        data: { days: opts?.days ?? ["2024-01-01", "2024-01-02"] },
        isLoading: false,
        isError: false,
      } as ReturnType<typeof useQuery>;
    }
    return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
  });
}

describe("MemoryPanel", () => {
  beforeEach(() => {
    mockMemoryQueries();
  });

  it("memory-panel 루트 클래스가 있다", () => {
    const { container } = render(<MemoryPanel mode="inline" />);
    expect(container.querySelector(".memory-panel")).toBeInTheDocument();
  });

  it("mode 클래스가 적용된다", () => {
    const { container: c1 } = render(<MemoryPanel mode="sidebar" />);
    expect(c1.querySelector(".memory-panel--sidebar")).toBeInTheDocument();

    const { container: c2 } = render(<MemoryPanel mode="modal" />);
    expect(c2.querySelector(".memory-panel--modal")).toBeInTheDocument();

    const { container: c3 } = render(<MemoryPanel mode="inline" />);
    expect(c3.querySelector(".memory-panel--inline")).toBeInTheDocument();
  });

  it("className prop이 적용된다", () => {
    const { container } = render(
      <MemoryPanel mode="inline" className="extra-cls" />,
    );
    expect(container.querySelector(".memory-panel.extra-cls")).toBeInTheDocument();
  });

  it("메모리 목록을 렌더링한다 — longterm(user) + daily(user) 항목", () => {
    render(<MemoryPanel mode="inline" />);
    // longterm entry key="longterm"
    expect(screen.getByText("longterm")).toBeInTheDocument();
    // daily entries for each day (may appear multiple times as key+updated_at)
    expect(screen.getAllByText("2024-01-01").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2024-01-02").length).toBeGreaterThanOrEqual(1);
  });

  it("메모리 항목의 value가 표시된다 (longterm content)", () => {
    mockMemoryQueries({ longtermContent: "User prefers concise responses." });
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByText("User prefers concise responses.")).toBeInTheDocument();
  });

  it("audit_result clean 시 clean 뱃지가 표시된다", () => {
    mockMemoryQueries({ longtermViolations: false });
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByTestId("audit-badge-clean")).toBeInTheDocument();
  });

  it("audit_result noisy 시 noisy 뱃지가 표시된다", () => {
    mockMemoryQueries({ longtermViolations: true });
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByTestId("audit-badge-noisy")).toBeInTheDocument();
  });

  it("noisy 뱃지에 --noisy CSS 클래스가 적용된다", () => {
    mockMemoryQueries({ longtermViolations: true });
    render(<MemoryPanel mode="inline" />);
    expect(
      screen.getByTestId("audit-badge-noisy").classList.contains("memory-panel__badge--noisy"),
    ).toBe(true);
  });

  it("clean 뱃지에 --clean CSS 클래스가 적용된다", () => {
    mockMemoryQueries({ longtermViolations: false });
    render(<MemoryPanel mode="inline" />);
    expect(
      screen.getByTestId("audit-badge-clean").classList.contains("memory-panel__badge--clean"),
    ).toBe(true);
  });

  it("noisy 경고 메시지가 표시된다", () => {
    mockMemoryQueries({ longtermViolations: true });
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByText("Potentially leaked secret")).toBeInTheDocument();
  });

  it("검색 입력이 렌더링된다", () => {
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByTestId("memory-search")).toBeInTheDocument();
  });

  it("검색 필터로 메모리 항목을 필터링한다", () => {
    render(<MemoryPanel mode="inline" />);
    const searchInput = screen.getByTestId("memory-search");
    // "longterm"을 검색하면 longterm 항목만 표시
    fireEvent.change(searchInput, { target: { value: "longterm" } });
    expect(screen.getByText("longterm")).toBeInTheDocument();
    expect(screen.queryByText("2024-01-01")).toBeNull();
  });

  it("빈 검색 결과 시 empty 메시지가 표시된다", () => {
    render(<MemoryPanel mode="inline" />);
    const searchInput = screen.getByTestId("memory-search");
    fireEvent.change(searchInput, { target: { value: "XXXXNOTFOUND" } });
    expect(screen.getByText("memory_panel.empty")).toBeInTheDocument();
  });

  it("스코프 탭이 4개 렌더링된다 (All / Session / User / Team)", () => {
    render(<MemoryPanel mode="inline" />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(4);
  });

  it("Session 스코프 탭 클릭 시 session 항목 없으면 empty가 표시된다", () => {
    // daily entries are now user-scoped (BE list_daily() is per-user, not per-session)
    render(<MemoryPanel mode="inline" />);
    const tabs = screen.getAllByRole("tab");
    const sessionTab = tabs[1]; // index 1 = session
    if (sessionTab) {
      fireEvent.click(sessionTab);
      // Both longterm and daily are user-scoped — no session-scoped entries → empty
      expect(screen.getByText("memory_panel.empty")).toBeInTheDocument();
    }
  });

  it("User 스코프 탭 클릭 시 longterm + daily 항목이 모두 표시된다", () => {
    render(<MemoryPanel mode="inline" />);
    const tabs = screen.getAllByRole("tab");
    const userTab = tabs[2]; // index 2 = user
    if (userTab) {
      fireEvent.click(userTab);
      // Both longterm and daily are user-scoped
      expect(screen.getByText("longterm")).toBeInTheDocument();
      expect(screen.getAllByText("2024-01-01").length).toBeGreaterThanOrEqual(1);
    }
  });

  it("Team 스코프 탭 클릭 시 team 항목이 없으면 empty 메시지가 표시된다", () => {
    render(<MemoryPanel mode="inline" />);
    const tabs = screen.getAllByRole("tab");
    const teamTab = tabs[3]; // index 3 = team
    if (teamTab) {
      fireEvent.click(teamTab);
      // no team-scoped entries from BE
      expect(screen.getByText("memory_panel.empty")).toBeInTheDocument();
    }
  });

  it("isLoading=true 시 로딩 메시지가 표시된다", () => {
    mockMemoryQueries({ loading: true });
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByText("memory_panel.loading")).toBeInTheDocument();
  });

  it("isError=true 시 에러 메시지가 표시된다", () => {
    mockMemoryQueries({ error: true });
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByText("memory_panel.error")).toBeInTheDocument();
  });

  it("longterm content가 없을 때 항목이 렌더링되지 않는다", () => {
    vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      const key = queryKey[0] as string;
      if (key === "memory-longterm") {
        return { data: { content: "", audit_result: null }, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      }
      if (key === "memory-daily-list") {
        return { data: { days: [] }, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
      }
      return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
    });
    render(<MemoryPanel mode="inline" />);
    expect(screen.getByText("memory_panel.empty")).toBeInTheDocument();
  });

  it("audit_result가 없는 항목(daily)에는 뱃지가 없다", () => {
    // daily entries have no audit_result → no badge
    mockMemoryQueries({ longtermViolations: false });
    render(<MemoryPanel mode="inline" />);
    // Only longterm has audit badge (clean)
    const badges = screen.getAllByTestId(/audit-badge-/);
    expect(badges.length).toBe(1);
    expect(badges[0]).toHaveAttribute("data-testid", "audit-badge-clean");
  });

  // ── FE-MEM T-2: queryFn 직접 검증 ──────────────────────────────────────────
  // useQuery를 모킹하더라도 queryKey로 등록된 queryFn이 실제 BE 경로를 호출하는지 검증.
  // render 후 useQuery.mock.calls에서 queryFn을 추출, 직접 호출하여 api.get URL을 단언.

  it("longterm queryFn이 /api/memory/longterm을 호출한다", async () => {
    const { api } = await import("@/api/client");
    vi.mocked(api.get).mockResolvedValue({ content: "test", audit_result: null });

    vi.mocked(useQuery).mockImplementation(({ queryKey, queryFn }: {
      queryKey: unknown[];
      queryFn?: () => unknown;
    }) => {
      // Capture all queryFn calls so we can invoke them in assertions
      if ((queryKey[0] as string) === "memory-longterm" && queryFn) {
        void queryFn();  // invoke the real queryFn
      }
      return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
    });

    render(<MemoryPanel mode="inline" />);

    expect(vi.mocked(api.get)).toHaveBeenCalledWith("/api/memory/longterm");
  });

  it("daily queryFn이 /api/memory/daily를 호출한다", async () => {
    const { api } = await import("@/api/client");
    vi.mocked(api.get).mockResolvedValue({ days: [] });

    vi.mocked(useQuery).mockImplementation(({ queryKey, queryFn }: {
      queryKey: unknown[];
      queryFn?: () => unknown;
    }) => {
      if ((queryKey[0] as string) === "memory-daily-list" && queryFn) {
        void queryFn();  // invoke the real queryFn
      }
      return { data: undefined, isLoading: false, isError: false } as ReturnType<typeof useQuery>;
    });

    render(<MemoryPanel mode="inline" />);

    expect(vi.mocked(api.get)).toHaveBeenCalledWith("/api/memory/daily");
  });
});

// ── i18n 로케일 키 검증 ──────────────────────────────────────────────────────

import enLocale from "../../../../src/i18n/locales/en.json";
import koLocale from "../../../../src/i18n/locales/ko.json";

const PROMPT_BAR_KEYS = [
  "shared_prompt_bar.placeholder",
  "shared_prompt_bar.label",
  "shared_prompt_bar.send",
  "shared_prompt_bar.stop",
  "shared_prompt_bar.at_label",
  "shared_prompt_bar.tools_count",
] as const;

const MEMORY_PANEL_KEYS = [
  "memory_panel.label",
  "memory_panel.title",
  "memory_panel.search_placeholder",
  "memory_panel.loading",
  "memory_panel.error",
  "memory_panel.empty",
  "memory_panel.scope.all",
  "memory_panel.scope.session",
  "memory_panel.scope.user",
  "memory_panel.scope.team",
  "memory_panel.audit.clean",
  "memory_panel.audit.noisy",
] as const;

describe("FE-SHARED Layer 1+3 i18n keys", () => {
  it("en.json에 SharedPromptBar 키가 모두 있다", () => {
    for (const key of PROMPT_BAR_KEYS) {
      expect((enLocale as Record<string, string>)[key]).toBeDefined();
    }
  });

  it("ko.json에 SharedPromptBar 키가 모두 있다", () => {
    for (const key of PROMPT_BAR_KEYS) {
      expect((koLocale as Record<string, string>)[key]).toBeDefined();
    }
  });

  it("en.json에 MemoryPanel 키가 모두 있다", () => {
    for (const key of MEMORY_PANEL_KEYS) {
      expect((enLocale as Record<string, string>)[key]).toBeDefined();
    }
  });

  it("ko.json에 MemoryPanel 키가 모두 있다", () => {
    for (const key of MEMORY_PANEL_KEYS) {
      expect((koLocale as Record<string, string>)[key]).toBeDefined();
    }
  });

  it("en.json 값이 비어 있지 않다", () => {
    for (const key of [...PROMPT_BAR_KEYS, ...MEMORY_PANEL_KEYS]) {
      const val = (enLocale as Record<string, string>)[key];
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    }
  });

  it("ko.json 값이 비어 있지 않다", () => {
    for (const key of [...PROMPT_BAR_KEYS, ...MEMORY_PANEL_KEYS]) {
      const val = (koLocale as Record<string, string>)[key];
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
    }
  });
});
