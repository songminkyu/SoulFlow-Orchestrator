/**
 * PAR-6: ReconcileEditPanel -- render, source node selection, policy update, use_parsed toggle.
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

import { reconcile_descriptor } from "@/pages/workflows/nodes/reconcile";

const EditPanel = reconcile_descriptor.EditPanel;

describe("ReconcileEditPanel", () => {
  let update: ReturnType<typeof vi.fn>;
  const t = (key: string) => key;

  beforeEach(() => {
    update = vi.fn();
  });

  it("renders with default node values", () => {
    const node = reconcile_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    expect(screen.getByText("workflows.reconcile_sources")).toBeInTheDocument();
    expect(screen.getByText("workflows.reconcile_policy")).toBeInTheDocument();
    expect(screen.getByText("workflows.reconcile_use_parsed")).toBeInTheDocument();
  });

  it("renders policy dropdown with all 4 options", () => {
    const node = reconcile_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const select = screen.getByDisplayValue("workflows.reconcile_policy_majority_vote");
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll("option")).toHaveLength(4);
  });

  it("calls update when policy changes", () => {
    const node = reconcile_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const select = screen.getByDisplayValue("workflows.reconcile_policy_majority_vote");
    fireEvent.change(select, { target: { value: "first_wins" } });

    expect(update).toHaveBeenCalledWith({ policy: "first_wins" });
  });

  it("renders source nodes as text input when no workflow_nodes provided", () => {
    const node = { ...reconcile_descriptor.create_default(), source_node_ids: ["a", "b"] };
    render(<EditPanel node={node} update={update} t={t} />);

    const input = screen.getByPlaceholderText("source-node");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("a, b");
  });

  it("renders source nodes as buttons when workflow_nodes provided", () => {
    const node = reconcile_descriptor.create_default();
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Node 1", type: "llm" },
        { id: "n2", label: "Node 2", type: "tool" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    expect(screen.getByText("Node 1")).toBeInTheDocument();
    expect(screen.getByText("Node 2")).toBeInTheDocument();
  });

  it("calls update when a source node button is clicked", () => {
    const node = reconcile_descriptor.create_default();
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Node 1", type: "llm" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    fireEvent.click(screen.getByText("Node 1"));
    expect(update).toHaveBeenCalledWith({ source_node_ids: ["n1"] });
  });

  it("deselects a source node on second click", () => {
    const node = { ...reconcile_descriptor.create_default(), source_node_ids: ["n1"] };
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Node 1", type: "llm" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    fireEvent.click(screen.getByText("Node 1"));
    expect(update).toHaveBeenCalledWith({ source_node_ids: [] });
  });

  it("toggles use_parsed checkbox", () => {
    const node = reconcile_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(update).toHaveBeenCalledWith({ use_parsed: true });
  });

  it("descriptor has correct metadata", () => {
    expect(reconcile_descriptor.node_type).toBe("reconcile");
    expect(reconcile_descriptor.category).toBe("flow");
    expect(reconcile_descriptor.shape).toBe("diamond");
  });
});
