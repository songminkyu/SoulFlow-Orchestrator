/**
 * FE-WF: workflow pages redesign — token unification + shared component integration.
 * Covers: builder basic render, detail CompilerVerdictPanel, kanban card render, wbs basic render.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WorkflowDetailPage from "@/pages/workflows/detail";
import WorkflowBuilderPage from "@/pages/workflows/builder";
import KanbanPage from "@/pages/kanban";
import WbsPage from "@/pages/wbs";

// ── 공통 모킹 ────────────────────────────────────────────────────────────────

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => ({ mutate: vi.fn(), isPending: false }));
const mockUseQueryClient = vi.fn(() => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient(),
}));

vi.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("@/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() } }));
vi.mock("@/api/sse", () => ({ create_sse: vi.fn(() => ({ close: vi.fn() })) }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/use-approvals", () => ({
  useApprovals: () => ({ pending: [], resolve: vi.fn() }),
}));
vi.mock("@/components/approval-banner", () => ({ ApprovalBanner: () => null }));
vi.mock("@/components/message-bubble", () => ({ MessageBubble: () => null }));
vi.mock("@/utils/format", () => ({ time_ago: () => "just now" }));
vi.mock("@/hooks/use-async-action", () => ({ useAsyncAction: () => vi.fn() }));
vi.mock("@/hooks/use-delete-confirmation", () => ({
  useDeleteConfirmation: () => ({
    deleteTarget: null, setDeleteTarget: vi.fn(),
    confirmDelete: vi.fn(), modalOpen: false, closeModal: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-page-access", () => ({ usePageAccess: () => ({ can_manage: true }) }));
vi.mock("@/pages/access-policy", () => ({ get_page_policy: () => ({ roles: [] }) }));
vi.mock("@/components/search-input", () => ({
  SearchInput: ({ placeholder }: { placeholder: string }) => <input placeholder={placeholder} />,
}));
vi.mock("@/components/modal", () => ({
  DeleteConfirmModal: () => null,
  FormModal: () => null,
  useConfirm: () => ({ confirm: vi.fn(), dialog: null }),
}));
vi.mock("@/hooks/use-click-outside", () => ({ useClickOutside: vi.fn() }));

// Builder-specific mocks
vi.mock("@/components/yaml-editor", () => ({ YamlEditor: () => null }));
vi.mock("@/components/node-palette", () => ({ NodePalette: () => null }));
vi.mock("@/pages/workflows/graph-editor", () => ({
  GraphEditor: () => <div data-testid="graph-editor" />,
}));
vi.mock("@/pages/workflows/node-inspector", () => ({ NodeInspector: () => null }));
vi.mock("@/pages/workflows/output-schema", () => ({ get_output_fields: () => [] }));
vi.mock("@/pages/workflows/builder-modals", () => ({
  PhaseEditModal: () => null, CronEditModal: () => null,
  TriggerNodeEditModal: () => null, ChannelEditModal: () => null,
  OrcheNodeEditModal: () => null, AgentEditModal: () => null,
}));
vi.mock("@/pages/workflows/builder-bars", () => ({
  WorkflowPromptBar: () => null, NodeRunInputBar: () => null,
}));
vi.mock("@/pages/workflows/workflow-diagram", () => ({ workflow_def_to_mermaid: () => "" }));
vi.mock("js-yaml", () => ({ default: { dump: () => "", load: vi.fn() } }));
vi.mock("@/components/status-contract", () => ({
  StatusView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/badge", () => ({ Badge: ({ status }: { status: string }) => <span>{status}</span> }));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn(), setQueryData: vi.fn() });
  mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isPending: false });
});

// ── 1. WorkflowBuilderPage — 기본 렌더링 ────────────────────────────────────

describe("WorkflowBuilderPage — 기본 렌더링", () => {
  function render_builder() {
    return render(
      <MemoryRouter initialEntries={["/workflows/new"]}>
        <Routes>
          <Route path="/workflows/:name" element={<WorkflowBuilderPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("그래프 에디터가 렌더링된다", () => {
    render_builder();
    expect(screen.getByTestId("graph-editor")).toBeInTheDocument();
  });

  it("YAML 토글 버튼이 렌더링된다", () => {
    render_builder();
    expect(screen.getByTitle("workflows.toggle_yaml")).toBeInTheDocument();
  });

  // FE-WF-5: builder.tsx:715 return JSX — 헤더 내 템플릿 이름 입력 필드 렌더링 검증
  it("워크플로우 이름 입력 필드가 렌더링된다 (builder.tsx:730 aria-label)", () => {
    render_builder();
    const nameInput = screen.getByRole("textbox", { name: "workflows.template_name" });
    expect(nameInput).toBeInTheDocument();
  });

  it("브레드크럼 내비게이션이 렌더링된다 (builder.tsx:720)", () => {
    render_builder();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });
});

// ── 2. WorkflowDetailPage — CompilerVerdictPanel ─────────────────────────────

function make_wf(overrides: Record<string, unknown> = {}) {
  return {
    workflow_id: "wf-1",
    title: "Test Workflow",
    objective: "test objective",
    status: "completed",
    current_phase: 0,
    phases: [],
    memory: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:01.000Z",
    ...overrides,
  };
}

function render_detail(wf_data: Record<string, unknown> | null) {
  mockUseQuery.mockReturnValue({ data: wf_data, isLoading: false });
  return render(
    <MemoryRouter initialEntries={["/workflows/wf-1"]}>
      <Routes>
        <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// FE-WF-6: detail.tsx:290 + detail.tsx:927 CompilerVerdictPanel 통합 검증
describe("WorkflowDetailPage — CompilerVerdictPanel (FE-WF-6)", () => {
  it("compiler_verdict 없으면 패널 미렌더", () => {
    render_detail(make_wf());
    expect(screen.queryByText("workflows.compiler_verdict")).toBeNull();
  });

  it("compiler_verdict passed=true + violations=[] → 패널 미렌더 (숨김 조건)", () => {
    render_detail(make_wf({
      compiler_verdict: { passed: true, violations: [], agent_node_ratio: 0.5 },
    }));
    expect(screen.queryByText("workflows.compiler_verdict")).toBeNull();
  });

  it("compiler_verdict violations 있으면 패널 렌더", () => {
    render_detail(make_wf({
      compiler_verdict: {
        passed: false,
        violations: [{ code: "E001", severity: "major", detail: "missing output" }],
        agent_node_ratio: 0.3,
      },
    }));
    expect(screen.getByText("workflows.compiler_verdict")).toBeInTheDocument();
    expect(screen.getByText("E001")).toBeInTheDocument();
  });

  it("isLoading=true → 스켈레톤 렌더", () => {
    mockUseQuery.mockReturnValue({ data: null, isLoading: true });
    render(
      <MemoryRouter initialEntries={["/workflows/wf-1"]}>
        <Routes>
          <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    // loading state has skeletons (no workflow title)
    expect(screen.queryByText("Test Workflow")).toBeNull();
  });
});

// ── 3. KanbanPage — CSS 토큰 클래스 + StatusBadge 통합 ───────────────────────

function make_board(column_overrides: Record<string, unknown> = {}, card_count = 1) {
  const cards = Array.from({ length: card_count }, (_, i) => ({
    card_id: `SP-${i + 1}`,
    seq: i + 1,
    board_id: "board-1",
    title: i === 0 ? "Implement feature" : `Card ${i + 1}`,
    description: "desc",
    column_id: "todo",
    position: i,
    priority: "high",
    labels: [],
    created_by: "user:admin",
    metadata: {},
    comment_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:01.000Z",
  }));

  return {
    board_id: "board-1",
    name: "Sprint 1",
    prefix: "SP",
    scope_type: "workflow",
    scope_id: "wf-1",
    columns: [
      { id: "todo", name: "To Do", color: "#6b7e8f", ...column_overrides },
      { id: "done", name: "Done", color: "#27ae60" },
    ],
    cards,
  };
}

describe("KanbanPage — CSS 토큰 클래스 (FE-WF-1) + StatusBadge 통합 (FE-WF-2)", () => {
  function render_kanban(board: ReturnType<typeof make_board>) {
    mockUseQuery
      .mockReturnValueOnce({ data: [board] })
      .mockReturnValueOnce({ data: board, isPending: false });
    return render(
      <MemoryRouter initialEntries={["/kanban"]}>
        <Routes>
          <Route path="/kanban" element={<KanbanPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  // FE-WF-1: kanban.css:215 — .kanban-card (uses var(--card-bg), var(--card-radius) etc.)
  it(".kanban-card 클래스 요소가 렌더링된다 (kanban.css:215 token class)", () => {
    render_kanban(make_board());
    expect(document.querySelector(".kanban-card")).toBeInTheDocument();
  });

  // FE-WF-1: kanban.css:124 — .kanban-col (uses var(--radius-lg))
  it(".kanban-col 클래스 요소가 렌더링된다 (kanban.css:124 token class)", () => {
    render_kanban(make_board());
    expect(document.querySelector(".kanban-col")).toBeInTheDocument();
  });

  it("보드 카드 타이틀이 렌더링된다", () => {
    render_kanban(make_board());
    expect(screen.getByText("Implement feature")).toBeInTheDocument();
  });

  // FE-WF-2: kanban.tsx:377-378 — over_wip=false → variant="off" (status-badge--off)
  it("WIP 한계 미초과 시 StatusBadge variant=off 클래스 렌더링된다", () => {
    const board = make_board({ wip_limit: 5 }, 1); // 1 card, limit 5 → not over
    render_kanban(board);
    const badge = document.querySelector(".status-badge--off");
    expect(badge).toBeInTheDocument();
    expect(badge?.querySelector(".status-badge__label")?.textContent).toBe("1/5");
  });

  // FE-WF-2: kanban.tsx:377-378 — over_wip=true → variant="warn" (status-badge--warn)
  it("WIP 한계 초과 시 StatusBadge variant=warn 클래스 렌더링된다 (kanban.tsx:377-378)", () => {
    const board = make_board({ wip_limit: 1 }, 3); // 3 cards, limit 1 → over_wip=true
    render_kanban(board);
    const badge = document.querySelector(".status-badge--warn");
    expect(badge).toBeInTheDocument();
    expect(badge?.querySelector(".status-badge__label")?.textContent).toBe("3/1");
  });

  it("보드 이름이 헤더에 렌더링된다", () => {
    render_kanban(make_board());
    expect(screen.getByText("Sprint 1 ▾")).toBeInTheDocument();
  });
});

// ── 4. WbsPage — CSS 토큰 클래스 (FE-WF-3) + 기본 렌더링 ───────────────────

describe("WbsPage — CSS 토큰 클래스 + 기본 렌더링 (FE-WF-3)", () => {
  // FE-WF-3: wbs.css:109 — .wbs-th background: var(--panel)
  //          wbs.css:183 — .wbs-priority--urgent { color: var(--err) }
  // FE-WF-3: wbs.css:109 — .wbs-th background: var(--panel) (sticky header token)
  it("wbs-table 헤더에 .wbs-th 클래스 요소가 렌더링된다 (wbs.css:109)", () => {
    const board_with_card = {
      board_id: "board-1", name: "Sprint 1", prefix: "SP",
      scope_type: "workflow", scope_id: "wf-1",
      columns: [{ id: "todo", name: "To Do", color: "#6b7e8f" }],
      cards: [{
        card_id: "SP-1", seq: 1, board_id: "board-1",
        title: "Header Test", description: "",
        column_id: "todo", position: 0, priority: "low",
        labels: [], created_by: "user:admin", metadata: {},
        comment_count: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:01.000Z",
      }],
    };
    mockUseQuery
      .mockReturnValueOnce({ data: [board_with_card] })
      .mockReturnValueOnce({ data: board_with_card, isPending: false });
    render(
      <MemoryRouter initialEntries={["/wbs"]}>
        <Routes>
          <Route path="/wbs" element={<WbsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.querySelector(".wbs-th")).toBeInTheDocument();
  });

  it("urgent 카드가 .wbs-priority--urgent 클래스로 렌더링된다 (wbs.css:183)", () => {
    const urgent_board = {
      board_id: "board-1",
      name: "Sprint 1",
      prefix: "SP",
      scope_type: "workflow",
      scope_id: "wf-1",
      columns: [{ id: "todo", name: "To Do", color: "#6b7e8f" }],
      cards: [
        {
          card_id: "SP-1", seq: 1, board_id: "board-1",
          title: "Urgent Task", description: "",
          column_id: "todo", position: 0, priority: "urgent",
          labels: [], created_by: "user:admin", metadata: {},
          comment_count: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:01.000Z",
        },
      ],
    };
    mockUseQuery
      .mockReturnValueOnce({ data: [urgent_board] })
      .mockReturnValueOnce({ data: urgent_board, isPending: false });
    render(
      <MemoryRouter initialEntries={["/wbs"]}>
        <Routes>
          <Route path="/wbs" element={<WbsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.querySelector(".wbs-priority--urgent")).toBeInTheDocument();
  });

  it("보드 없을 때 wbs.no_boards 텍스트 렌더링", () => {
    mockUseQuery.mockReturnValue({ data: [], isPending: false });
    render(
      <MemoryRouter initialEntries={["/wbs"]}>
        <Routes>
          <Route path="/wbs" element={<WbsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("wbs.no_boards")).toBeInTheDocument();
  });

  it("카드 있을 때 wbs-table 렌더링", () => {
    const mock_board = {
      board_id: "board-1",
      name: "Sprint 1",
      prefix: "SP",
      scope_type: "workflow",
      scope_id: "wf-1",
      columns: [{ id: "todo", name: "To Do", color: "#6b7e8f" }],
      cards: [
        {
          card_id: "SP-1",
          seq: 1,
          board_id: "board-1",
          title: "WBS Task",
          description: "",
          column_id: "todo",
          position: 0,
          priority: "medium",
          labels: [],
          created_by: "user:admin",
          metadata: {},
          comment_count: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:01.000Z",
        },
      ],
    };
    mockUseQuery
      .mockReturnValueOnce({ data: [mock_board] })
      .mockReturnValueOnce({ data: mock_board, isPending: false });
    render(
      <MemoryRouter initialEntries={["/wbs"]}>
        <Routes>
          <Route path="/wbs" element={<WbsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("WBS Task")).toBeInTheDocument();
    expect(document.querySelector(".wbs-table")).toBeInTheDocument();
  });
});
