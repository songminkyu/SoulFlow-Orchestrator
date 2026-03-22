/**
 * PAR-6: FanoutEditPanel -- render, branch management, concurrency/timeout fields.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/i18n", () => ({ useT: () => (key: string) => key }));
vi.mock("@/pages/workflows/use-provider-models", () => ({
  useProviderModels: () => ({ models: [], loading: false }),
}));
vi.mock("@/pages/workflows/use-json-field", () => ({
  useJsonField: () => ({ raw: "", err: null, onChange: vi.fn() }),
}));
vi.mock("@/pages/workflows/inspector-dnd", () => ({
  handleContainerDrop: vi.fn(),
  handleContainerDragOver: vi.fn(),
}));

import { fanout_descriptor } from "@/pages/workflows/nodes/fanout";

const EditPanel = fanout_descriptor.EditPanel;

describe("FanoutEditPanel", () => {
  let update: ReturnType<typeof vi.fn>;
  const t = (key: string) => key;

  beforeEach(() => {
    update = vi.fn();
  });

  it("renders with default node values", () => {
    const node = fanout_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    expect(screen.getByText("workflows.fanout_branches")).toBeInTheDocument();
    expect(screen.getByText("workflows.fanout_reconcile")).toBeInTheDocument();
    expect(screen.getByText("workflows.fanout_max_concurrency")).toBeInTheDocument();
    expect(screen.getByText("workflows.timeout_ms")).toBeInTheDocument();
  });

  it("renders branches as text input when no workflow_nodes provided", () => {
    const node = {
      ...fanout_descriptor.create_default(),
      branches: [
        { branch_id: "b1", node_ids: [] },
        { branch_id: "b2", node_ids: [] },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} />);

    const input = screen.getByPlaceholderText("branch-node");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("b1, b2");
  });

  it("renders branches as buttons when workflow_nodes provided", () => {
    const node = fanout_descriptor.create_default();
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Branch A", type: "llm" },
        { id: "n2", label: "Branch B", type: "tool" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    expect(screen.getByText("Branch A")).toBeInTheDocument();
    expect(screen.getByText("Branch B")).toBeInTheDocument();
  });

  it("selects a branch node on click", () => {
    const node = fanout_descriptor.create_default();
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Branch A", type: "llm" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    fireEvent.click(screen.getByText("Branch A"));
    expect(update).toHaveBeenCalledWith({
      branches: [{ branch_id: "n1", node_ids: [] }],
    });
  });

  it("deselects a branch node on second click", () => {
    const node = {
      ...fanout_descriptor.create_default(),
      branches: [{ branch_id: "n1", node_ids: [] }],
    };
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Branch A", type: "llm" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    fireEvent.click(screen.getByText("Branch A"));
    expect(update).toHaveBeenCalledWith({ branches: [] });
  });

  it("filters reconcile node list to type=reconcile only", () => {
    const node = fanout_descriptor.create_default();
    const options = {
      workflow_nodes: [
        { id: "n1", label: "LLM Node", type: "llm" },
        { id: "n2", label: "Reconcile Node", type: "reconcile" },
        { id: "n3", label: "Tool Node", type: "tool" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    // Branch picker shows all 3 nodes as buttons
    // Reconcile picker shows 1 reconcile node as a select option (not a button)
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    // Reconcile dropdown has 1 option + empty option = 2 options total
    const reconcileSelect = screen.getByDisplayValue("common.select");
    expect(reconcileSelect.querySelectorAll("option")).toHaveLength(2);
  });

  it("updates max_concurrency on change", () => {
    const node = fanout_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const concurrencyInput = screen.getByDisplayValue("5");
    fireEvent.change(concurrencyInput, { target: { value: "10" } });

    expect(update).toHaveBeenCalledWith({ max_concurrency: 10 });
  });

  it("updates timeout_ms on change", () => {
    const node = fanout_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const timeoutInput = screen.getByDisplayValue("30000");
    fireEvent.change(timeoutInput, { target: { value: "60000" } });

    expect(update).toHaveBeenCalledWith({ branch_timeout_ms: 60000 });
  });

  it("falls back to default on non-numeric concurrency input", () => {
    const node = fanout_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const concurrencyInput = screen.getByDisplayValue("5");
    fireEvent.change(concurrencyInput, { target: { value: "" } });

    expect(update).toHaveBeenCalledWith({ max_concurrency: 5 });
  });

  it("falls back to default on non-numeric timeout input", () => {
    const node = fanout_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const timeoutInput = screen.getByDisplayValue("30000");
    fireEvent.change(timeoutInput, { target: { value: "" } });

    expect(update).toHaveBeenCalledWith({ branch_timeout_ms: 30000 });
  });

  it("descriptor has correct metadata", () => {
    expect(fanout_descriptor.node_type).toBe("fanout");
    expect(fanout_descriptor.category).toBe("flow");
    expect(fanout_descriptor.shape).toBe("diamond");
  });
});
