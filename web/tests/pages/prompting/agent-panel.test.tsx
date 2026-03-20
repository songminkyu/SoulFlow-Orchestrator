/**
 * RP-5: AgentPanel FE tests.
 *
 * Render test, form field presence, save handler, model picker integration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// -- useQuery / react-query mock

type QueryOpts = { queryKey: string[]; queryFn: () => unknown; staleTime?: number };
let captured_queries: QueryOpts[] = [];

const STABLE_EMPTY_ARRAY: never[] = [];
const STABLE_PROTOCOLS = { protocols: ["clarification-protocol", "phase-gates", "error-escalation"] };

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: QueryOpts) => {
    captured_queries.push(opts);
    if (opts.queryKey[0] === "protocols") {
      return { data: STABLE_PROTOCOLS, isLoading: false, error: null };
    }
    if (opts.queryKey[0] === "agent-definitions") {
      return { data: STABLE_EMPTY_ARRAY, isLoading: false, error: null };
    }
    return { data: undefined, isLoading: false, error: null };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// -- api mock

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

// -- i18n mock

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
  useI18n: () => ({ t: (key: string) => key, locale: "en", set_locale: vi.fn() }),
}));

// -- leaf component / hook mocks

let last_model_picker_props: Record<string, unknown> | null = null;
vi.mock("@/components/studio-model-picker", () => ({
  StudioModelPicker: (props: Record<string, unknown>) => {
    last_model_picker_props = props;
    return <div data-testid="model-picker" />;
  },
}));

vi.mock("@/components/chat-prompt-bar", () => ({
  ChatPromptBar: () => <div data-testid="chat-bar" />,
}));

vi.mock("@/pages/prompting/run-result", () => ({
  RunResult: () => null,
}));

// -- SUT import

import { AgentPanel } from "@/pages/prompting/agent-panel";

// -- tests

describe("AgentPanel", () => {
  beforeEach(() => {
    captured_queries = [];
    last_model_picker_props = null;
    mock_api_post.mockClear();
    mock_api_put.mockClear();
  });

  it("mounts without crash", () => {
    const { container } = render(<AgentPanel />);
    expect(container.querySelector(".ps-split")).toBeTruthy();
  });

  it("renders name input field", () => {
    render(<AgentPanel />);
    const name_input = screen.getByPlaceholderText("agents.name_placeholder");
    expect(name_input).toBeInTheDocument();
  });

  it("renders description input field", () => {
    render(<AgentPanel />);
    const desc_input = screen.getByPlaceholderText("agents.description_placeholder");
    expect(desc_input).toBeInTheDocument();
  });

  it("renders icon input with default value", () => {
    const { container } = render(<AgentPanel />);
    const icon_inputs = container.querySelectorAll("input.input--center");
    expect(icon_inputs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders role_skill select with ROLE_SKILLS options", () => {
    const { container } = render(<AgentPanel />);
    const selects = container.querySelectorAll("select.ps-select-sm");
    expect(selects.length).toBeGreaterThanOrEqual(2);
    const role_select = selects[1]!;
    const options = role_select.querySelectorAll("option");
    expect(options.length).toBeGreaterThanOrEqual(5);
  });

  it("renders soul textarea", () => {
    render(<AgentPanel />);
    const soul_area = screen.getByPlaceholderText("prompting.soul_ph");
    expect(soul_area).toBeInTheDocument();
    expect(soul_area.tagName).toBe("TEXTAREA");
  });

  it("renders heart textarea", () => {
    render(<AgentPanel />);
    const heart_area = screen.getByPlaceholderText("prompting.heart_ph");
    expect(heart_area).toBeInTheDocument();
    expect(heart_area.tagName).toBe("TEXTAREA");
  });

  it("renders protocol checkboxes from API data", () => {
    const { container } = render(<AgentPanel />);
    const checkboxes = container.querySelectorAll("input[type='checkbox']");
    expect(checkboxes.length).toBe(3);
  });

  it("renders StudioModelPicker", () => {
    render(<AgentPanel />);
    expect(screen.getByTestId("model-picker")).toBeInTheDocument();
  });

  it("renders ChatPromptBar for test chat", () => {
    render(<AgentPanel />);
    expect(screen.getByTestId("chat-bar")).toBeInTheDocument();
  });

  it("model picker receives value and onChange props", () => {
    render(<AgentPanel />);
    expect(last_model_picker_props).not.toBeNull();
    expect(last_model_picker_props!["value"]).toBeDefined();
    expect(typeof last_model_picker_props!["onChange"]).toBe("function");
  });

  it("save button is disabled when name is empty", () => {
    render(<AgentPanel />);
    const save_btn = screen.getByText("prompting.save");
    expect(save_btn).toBeDisabled();
  });

  it("save button becomes enabled when name is filled", () => {
    render(<AgentPanel />);
    const name_input = screen.getByPlaceholderText("agents.name_placeholder");
    fireEvent.change(name_input, { target: { value: "Test Agent" } });
    const save_btn = screen.getByText("prompting.save");
    expect(save_btn).not.toBeDisabled();
  });

  it("save calls api.post for new agent", async () => {
    render(<AgentPanel />);
    const name_input = screen.getByPlaceholderText("agents.name_placeholder");
    fireEvent.change(name_input, { target: { value: "New Agent" } });
    const save_btn = screen.getByText("prompting.save");
    fireEvent.click(save_btn);
    await vi.waitFor(() => {
      expect(mock_api_post).toHaveBeenCalledWith(
        "/api/agent-definitions",
        expect.objectContaining({ name: "New Agent" }),
      );
    });
  });

  it("form fields update on user input", () => {
    render(<AgentPanel />);
    const desc = screen.getByPlaceholderText("agents.description_placeholder") as HTMLInputElement;
    fireEvent.change(desc, { target: { value: "A helpful agent" } });
    expect(desc.value).toBe("A helpful agent");
  });

  it("renders extra_instructions textarea", () => {
    render(<AgentPanel />);
    const extra = screen.getByPlaceholderText("prompting.extra_ph");
    expect(extra).toBeInTheDocument();
  });

  it("renders tools input field", () => {
    render(<AgentPanel />);
    const tools = screen.getByPlaceholderText("agents.tools_hint");
    expect(tools).toBeInTheDocument();
  });

  it("renders skills input field", () => {
    render(<AgentPanel />);
    const skills = screen.getByPlaceholderText("agents.skills_hint");
    expect(skills).toBeInTheDocument();
  });

  it("renders boundary inputs (use_when and not_use_for)", () => {
    render(<AgentPanel />);
    const use_when = screen.getByPlaceholderText("agents.use_when_placeholder");
    const not_use_for = screen.getByPlaceholderText("agents.not_use_for_placeholder");
    expect(use_when).toBeInTheDocument();
    expect(not_use_for).toBeInTheDocument();
  });
});
