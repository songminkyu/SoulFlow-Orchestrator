/** RP-5: AgentModal FE tests. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

const mock_api_post = vi.fn().mockResolvedValue({});
const mock_api_put = vi.fn().mockResolvedValue({});
vi.mock("@/api/client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({}),
    post: (...args: unknown[]) => mock_api_post(...args),
    put: (...args: unknown[]) => mock_api_put(...args),
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
  useAsyncState: () => ({ pending: false, run: async (fn: () => Promise<void>) => { await fn(); } }),
}));

vi.mock("@/components/modal", () => ({
  FormModal: ({ children, onSubmit, title }: { children: React.ReactNode; onSubmit: (e: React.FormEvent) => void; title: string }) => (
    <form data-testid="form-modal" onSubmit={onSubmit}><h3 data-testid="modal-title">{title}</h3>{children}<button type="submit">Submit</button></form>
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

import type { AgentDefinition } from "../../../../../src/agent/agent-definition.types";
import { AgentModal } from "@/pages/prompting/agent-modal";

// ── 테스트 ──────────────────────────────────────────────────────────────────────

function make_agent(o: Partial<AgentDefinition> = {}): AgentDefinition {
  return { id: "agent-1", name: "Test Agent", description: "A test agent", icon: "T", role_skill: "role:pm", soul: "You are a helpful PM.", heart: "Be concise and clear.", tools: ["read_file", "write_file"], shared_protocols: ["clarification-protocol"], skills: ["github"], use_when: "Project management tasks", not_use_for: "Code implementation", extra_instructions: "Always confirm.", preferred_providers: ["openai-main"], model: "gpt-4", is_builtin: false, use_count: 5, scope_type: "global", scope_id: "", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", ...o };
}

describe("AgentModal -- add mode", () => {
  beforeEach(() => { captured_queries = []; mock_api_post.mockClear(); mock_api_put.mockClear(); });
  it("renders without crash", () => { render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); expect(screen.getByTestId("form-modal")).toBeInTheDocument(); });
  it("shows correct title", () => { render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); expect(screen.getByTestId("modal-title").textContent).toBe("agents.add_title"); });
  it("starts with empty name", () => { render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); expect((screen.getByPlaceholderText("agents.name_placeholder") as HTMLInputElement).value).toBe(""); });
  it("renders form sections", () => { const { container } = render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); expect(container.querySelectorAll("fieldset.form-section").length).toBeGreaterThanOrEqual(5); });
  it("renders tabs", () => { render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); expect(screen.getAllByRole("tab").length).toBe(2); });
  it("submit calls api.post", async () => { render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); fireEvent.change(screen.getByPlaceholderText("agents.name_placeholder"), { target: { value: "X" } }); fireEvent.submit(screen.getByTestId("form-modal")); await vi.waitFor(() => { expect(mock_api_post).toHaveBeenCalledWith("/api/agent-definitions", expect.objectContaining({ name: "X" })); }); });
});

describe("AgentModal -- edit mode", () => {
  beforeEach(() => { captured_queries = []; mock_api_post.mockClear(); mock_api_put.mockClear(); });
  const agent = make_agent();
  it("shows edit title", () => { render(<AgentModal mode={{ kind: "edit", definition: agent }} onClose={vi.fn()} onSaved={vi.fn()} />); expect(screen.getByTestId("modal-title").textContent).toBe("agents.edit_title"); });
  it("populates name", () => { render(<AgentModal mode={{ kind: "edit", definition: agent }} onClose={vi.fn()} onSaved={vi.fn()} />); expect((screen.getByPlaceholderText("agents.name_placeholder") as HTMLInputElement).value).toBe("Test Agent"); });
  it("populates soul", () => { render(<AgentModal mode={{ kind: "edit", definition: agent }} onClose={vi.fn()} onSaved={vi.fn()} />); expect((screen.getByPlaceholderText("agents.soul_placeholder") as HTMLTextAreaElement).value).toBe("You are a helpful PM."); });
  it("populates heart", () => { render(<AgentModal mode={{ kind: "edit", definition: agent }} onClose={vi.fn()} onSaved={vi.fn()} />); expect((screen.getByPlaceholderText("agents.heart_placeholder") as HTMLTextAreaElement).value).toBe("Be concise and clear."); });
  it("submit calls api.put", async () => { render(<AgentModal mode={{ kind: "edit", definition: agent }} onClose={vi.fn()} onSaved={vi.fn()} />); fireEvent.submit(screen.getByTestId("form-modal")); await vi.waitFor(() => { expect(mock_api_put).toHaveBeenCalledWith("/api/agent-definitions/agent-1", expect.objectContaining({ name: "Test Agent" })); }); });
});

describe("AgentModal -- fork mode", () => {
  beforeEach(() => { captured_queries = []; mock_api_post.mockClear(); mock_api_put.mockClear(); });
  const b = make_agent({ id: "b-1", name: "Concierge", is_builtin: true });
  it("shows fork title", () => { render(<AgentModal mode={{ kind: "fork", definition: b }} onClose={vi.fn()} onSaved={vi.fn()} />); expect(screen.getByTestId("modal-title").textContent).toBe("agents.fork_title"); });
  it("populates from source", () => { render(<AgentModal mode={{ kind: "fork", definition: b }} onClose={vi.fn()} onSaved={vi.fn()} />); expect((screen.getByPlaceholderText("agents.name_placeholder") as HTMLInputElement).value).toBe("Concierge"); });
  it("submits via api.post", async () => { render(<AgentModal mode={{ kind: "fork", definition: b }} onClose={vi.fn()} onSaved={vi.fn()} />); fireEvent.submit(screen.getByTestId("form-modal")); await vi.waitFor(() => { expect(mock_api_post).toHaveBeenCalledWith("/api/agent-definitions", expect.objectContaining({ name: "Concierge" })); expect(mock_api_put).not.toHaveBeenCalled(); }); });
});

describe("AgentModal -- AI tab", () => {
  beforeEach(() => { mock_api_post.mockClear(); });
  it("AI tab shows prompt", () => { render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); fireEvent.click(screen.getAllByRole("tab")[1]!); expect(screen.getByPlaceholderText("agents.ai_prompt_placeholder")).toBeInTheDocument(); });
  it("generate disabled when empty", () => { render(<AgentModal mode={{ kind: "add" }} onClose={vi.fn()} onSaved={vi.fn()} />); fireEvent.click(screen.getAllByRole("tab")[1]!); expect(screen.getByText("agents.generate")).toBeDisabled(); });
});
