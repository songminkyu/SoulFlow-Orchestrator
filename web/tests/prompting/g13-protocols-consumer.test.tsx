/**
 * G-13: AgentPanel / AgentModal — /api/protocols 소비자 직접 렌더 검증.
 *
 * agent-panel.tsx:93과 agent-modal.tsx:66에서 useQuery({queryKey:["protocols"]})로
 * api.get("/api/protocols")를 호출하는지 실제 렌더를 통해 확인.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

// ── useQuery 호출 캡처 ─────────────────────────────────────────────────────────

type QueryOpts = { queryKey: string[]; queryFn: () => unknown; staleTime?: number };
let captured_queries: QueryOpts[] = [];

// 안정적인 참조를 유지하여 useEffect 무한 루프 방지
const STABLE_EMPTY_ARRAY: never[] = [];
const STABLE_PROTOCOLS = { protocols: ["clarification-protocol", "phase-gates"] };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: QueryOpts) => {
    captured_queries.push(opts);
    if (opts.queryKey[0] === "protocols") {
      return {
        data: STABLE_PROTOCOLS,
        isLoading: false,
        error: null,
      };
    }
    if (opts.queryKey[0] === "agent-definitions") {
      return { data: STABLE_EMPTY_ARRAY, isLoading: false, error: null };
    }
    return { data: undefined, isLoading: false, error: null };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// ── api mock ────────────────────────────────────────────────────────────────────

const mock_api_get = vi.fn().mockResolvedValue({});
vi.mock("@/api/client", () => ({
  api: {
    get: (...args: unknown[]) => mock_api_get(...args),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    del: vi.fn().mockResolvedValue({}),
  },
}));

// ── i18n mock ───────────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ t: (key: string) => key, locale: "en", set_locale: vi.fn() }),
}));

// ── 리프 컴포넌트/훅 mock ──────────────────────────────────────────────────────

vi.mock("@/components/studio-model-picker", () => ({
  StudioModelPicker: () => <div data-testid="model-picker" />,
}));

vi.mock("@/components/chat-prompt-bar", () => ({
  ChatPromptBar: () => <div data-testid="chat-bar" />,
}));

vi.mock("@/pages/prompting/run-result", () => ({
  RunResult: () => null,
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-click-outside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@/hooks/use-async-state", () => ({
  useAsyncState: () => ({ pending: false, run: vi.fn() }),
}));

vi.mock("@/components/modal", () => ({
  FormModal: ({ children }: { children: React.ReactNode }) => (
    <form data-testid="form-modal">{children}</form>
  ),
  Modal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useModalEffects: vi.fn(),
}));

vi.mock("@/components/form-group", () => ({
  FormGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/form-label", () => ({
  FormLabel: () => null,
}));

// ── SUT import ──────────────────────────────────────────────────────────────────

import { AgentPanel } from "@/pages/prompting/agent-panel";
import { AgentModal } from "@/pages/prompting/agent-modal";

// ── 테스트 ──────────────────────────────────────────────────────────────────────

describe("G-13: AgentPanel /api/protocols 소비자 렌더 검증", () => {
  beforeEach(() => {
    captured_queries = [];
    mock_api_get.mockClear();
  });

  it("AgentPanel 렌더 시 useQuery({queryKey:['protocols']})가 등록된다", () => {
    render(<AgentPanel />);
    const proto_query = captured_queries.find((q) => q.queryKey[0] === "protocols");
    expect(proto_query).toBeDefined();
    expect(proto_query!.queryKey).toEqual(["protocols"]);
  });

  it("AgentPanel의 protocols queryFn이 api.get('/api/protocols')를 호출한다", async () => {
    render(<AgentPanel />);
    const proto_query = captured_queries.find((q) => q.queryKey[0] === "protocols");
    expect(proto_query).toBeDefined();

    // queryFn을 직접 실행하여 api.get 호출 경로 검증
    mock_api_get.mockResolvedValueOnce({ protocols: ["test-proto"] });
    await proto_query!.queryFn();
    expect(mock_api_get).toHaveBeenCalledWith("/api/protocols");
  });

  it("AgentPanel이 프로토콜 체크박스를 렌더한다", () => {
    const { container } = render(<AgentPanel />);
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });
});

describe("G-13: AgentModal /api/protocols 소비자 렌더 검증", () => {
  beforeEach(() => {
    captured_queries = [];
    mock_api_get.mockClear();
  });

  it("AgentModal 렌더 시 useQuery({queryKey:['protocols']})가 등록된다", () => {
    render(
      <AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    const proto_query = captured_queries.find((q) => q.queryKey[0] === "protocols");
    expect(proto_query).toBeDefined();
    expect(proto_query!.queryKey).toEqual(["protocols"]);
  });

  it("AgentModal의 protocols queryFn이 api.get('/api/protocols')를 호출한다", async () => {
    render(
      <AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    const proto_query = captured_queries.find((q) => q.queryKey[0] === "protocols");
    expect(proto_query).toBeDefined();

    mock_api_get.mockResolvedValueOnce({ protocols: ["test-proto"] });
    await proto_query!.queryFn();
    expect(mock_api_get).toHaveBeenCalledWith("/api/protocols");
  });

  it("AgentModal이 프로토콜 체크박스를 렌더한다", () => {
    const { container } = render(
      <AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });
});
