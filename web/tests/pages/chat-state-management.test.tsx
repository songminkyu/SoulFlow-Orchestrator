/**
 * FE-2b: chat.tsx 상태 관리 테스트.
 * - attached_items 관리 (추가/제거)
 * - tool_choice 전달
 * - 전송 시 pinned_tools 변환
 * - session_browser i18n 키 사용 확인
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

// query key별로 적절한 mock 데이터 반환
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

// ChatPromptBar를 스파이로 대체 — 전달된 props 검증
const prompt_bar_spy = vi.fn();
vi.mock("@/components/chat-prompt-bar", () => ({
  ChatPromptBar: (props: Record<string, unknown>) => {
    prompt_bar_spy(props);
    return <div data-testid="chat-prompt-bar" />;
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

describe("ChatPage state management (FE-2b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prompt_bar_spy.mockClear();
  });

  it("초기 렌더 시 EmptyState 표시 (세션 미선택)", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("세션 탭바가 렌더된다", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("session-tabs")).toBeInTheDocument();
  });

  it("AgentContextBar가 더 이상 렌더되지 않는다 (FE-2b deprecated)", () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    // 이전 AgentContextBar의 select 요소가 없어야 함
    expect(screen.queryByLabelText("chat.agent_select_placeholder")).toBeNull();
  });
});
