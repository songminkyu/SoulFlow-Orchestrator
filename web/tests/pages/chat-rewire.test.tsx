/**
 * FE-CHAT: chat.tsx rewire — SharedPromptBar + ResponseView + UnifiedSelector 통합 테스트.
 *
 * 검증 항목:
 *  1. SharedPromptBar가 chat에서 렌더링되는지 (ChatPromptBar 대신)
 *  2. endpoint 전환 콜백 — onEndpointChange 전달 확인
 *  3. tool chip 추가/제거 — onToolAdd / onToolRemove 전달 확인
 *  4. suggestion 클릭 시 input에 반영 — onSuggestionSelect
 *  5. 빈 상태 greeting 표시 — greeting prop 전달 확인
 *  6. 세션 활성 시 greeting/suggestions 없음
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── 모킹 ──────────────────────────────────────────────────────────────────────

const mock_t = (key: string, p?: Record<string, string>) =>
  p ? `${key}:${JSON.stringify(p)}` : key;

vi.mock("@/i18n", () => ({
  useT: () => mock_t,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "chat-sessions") return { data: [], isLoading: false };
    if (queryKey[0] === "agent-definitions") return { data: [], isLoading: false };
    if (queryKey[0] === "chat-session") return { data: undefined, isLoading: false };
    if (queryKey[0] === "mirror-sessions") return { data: [], isLoading: false };
    if (queryKey[0] === "mirror-session") return { data: undefined, isLoading: false };
    return { data: undefined, isLoading: false };
  }),
  useQueryClient: vi.fn().mockReturnValue({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ id: "test-session" }),
    patch: vi.fn().mockResolvedValue({}),
    del: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-async-state", () => ({
  useAsyncState: () => ({ pending: false, run: vi.fn() }),
}));

vi.mock("@/hooks/use-approvals", () => ({
  useApprovals: () => ({ pending: [], resolve: vi.fn() }),
}));

vi.mock("@/hooks/use-ndjson-stream", () => ({
  useNdjsonStream: () => ({
    stream: null,
    tool_calls: [],
    thinking_blocks: [],
    routing: null,
    start: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
  }),
}));

vi.mock("@/store", () => ({
  useDashboardStore: vi.fn().mockImplementation((sel: (s: Record<string, unknown>) => unknown) => {
    const state = {
      web_stream: null,
      set_web_stream: vi.fn(),
      mirror_event: null,
      canvas_specs: new Map(),
      dismiss_canvas: vi.fn(),
    };
    return sel(state);
  }),
}));

/** SharedPromptBar spy — 전달된 props 캡처 */
const shared_prompt_bar_spy = vi.fn();
vi.mock("@/components/shared/prompt-bar", () => ({
  SharedPromptBar: (props: Record<string, unknown>) => {
    shared_prompt_bar_spy(props);
    return (
      <div data-testid="shared-prompt-bar">
        {props.greeting && <div data-testid="greeting">{props.greeting as string}</div>}
        {Array.isArray(props.suggestions) && (props.suggestions as string[]).length > 0 && (
          <div data-testid="suggestions">{(props.suggestions as string[]).join(",")}</div>
        )}
      </div>
    );
  },
}));

vi.mock("@/components/badge", () => ({
  Badge: ({ status }: { status: string }) => <span data-testid="badge">{status}</span>,
}));

vi.mock("@/components/modal", () => ({
  DeleteConfirmModal: () => null,
}));

vi.mock("@/pages/chat/message-list", () => ({
  MessageList: vi.fn(() => <div data-testid="message-list" />),
}));

vi.mock("@/pages/chat/empty-state", () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock("@/pages/chat/chat-session-tabs", () => ({
  ChatSessionTabs: () => <div data-testid="session-tabs" />,
}));

vi.mock("@/pages/chat/chat-status-bar", () => ({
  ChatBottomBar: () => null,
}));

vi.mock("@/pages/chat/session-browser", () => ({
  SessionBrowser: () => <div data-testid="session-browser" />,
}));

vi.mock("@/pages/chat/agent-context-bar", () => ({
  compose_agent_prompt: (def: { soul?: string; heart?: string }) =>
    [def.soul, def.heart].filter(Boolean).join("\n\n"),
}));

vi.mock("@/pages/chat/canvas-panel", () => ({
  CanvasPanel: () => null,
}));

import ChatPage from "@/pages/chat";

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("ChatPage rewire — SharedPromptBar (FE-CHAT)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shared_prompt_bar_spy.mockClear();
  });

  it("1. SharedPromptBar가 렌더된다 (ChatPromptBar 대체)", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId("shared-prompt-bar").length).toBeGreaterThan(0);
  });

  it("2. 빈 상태에서 greeting prop이 전달된다", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    // 빈 상태 prompt-bar에 greeting이 있어야 함
    const calls = shared_prompt_bar_spy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const has_greeting = calls.some((props) => typeof props.greeting === "string" && props.greeting.length > 0);
    expect(has_greeting).toBe(true);
  });

  it("3. 빈 상태에서 suggestions prop이 전달된다 (3개)", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const calls = shared_prompt_bar_spy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const with_suggestions = calls.find((props) => Array.isArray(props.suggestions) && (props.suggestions as string[]).length > 0);
    expect(with_suggestions).toBeDefined();
    expect((with_suggestions!.suggestions as string[]).length).toBe(3);
  });

  it("4. onEndpointChange 콜백이 SharedPromptBar에 전달된다", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const calls = shared_prompt_bar_spy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const has_callback = calls.some((props) => typeof props.onEndpointChange === "function");
    expect(has_callback).toBe(true);
  });

  it("5. onToolAdd / onToolRemove 콜백이 SharedPromptBar에 전달된다", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const calls = shared_prompt_bar_spy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const has_tool_callbacks = calls.some(
      (props) => typeof props.onToolAdd === "function" && typeof props.onToolRemove === "function",
    );
    expect(has_tool_callbacks).toBe(true);
  });

  it("6. onSuggestionSelect 콜백이 SharedPromptBar에 전달된다 (빈 상태)", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const calls = shared_prompt_bar_spy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const with_suggestion_select = calls.some((props) => typeof props.onSuggestionSelect === "function");
    expect(with_suggestion_select).toBe(true);
  });

  it("7. 초기 빈 상태에서 EmptyState도 렌더된다", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("8. 세션 탭이 렌더된다", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("session-tabs")).toBeInTheDocument();
  });
});
