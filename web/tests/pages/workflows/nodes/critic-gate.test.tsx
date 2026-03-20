/**
 * PAR-6: CriticGateEditPanel -- render, condition field, max_rounds, on-fail policy selection.
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

import { critic_gate_descriptor } from "@/pages/workflows/nodes/critic-gate";

const EditPanel = critic_gate_descriptor.EditPanel;

describe("CriticGateEditPanel", () => {
  let update: ReturnType<typeof vi.fn>;
  const t = (key: string) => key;

  beforeEach(() => {
    update = vi.fn();
  });

  it("renders with default node values", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    expect(screen.getByText("workflows.critic_source")).toBeInTheDocument();
    expect(screen.getByText("workflows.critic_condition")).toBeInTheDocument();
    expect(screen.getByText("workflows.critic_max_rounds")).toBeInTheDocument();
    expect(screen.getByText("workflows.critic_on_fail")).toBeInTheDocument();
  });

  it("renders condition input with placeholder", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const input = screen.getByPlaceholderText("memory.prev.score >= 0.8");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("updates condition on input change", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const input = screen.getByPlaceholderText("memory.prev.score >= 0.8");
    fireEvent.change(input, { target: { value: "result.score > 0.9" } });

    expect(update).toHaveBeenCalledWith({ condition: "result.score > 0.9" });
  });

  it("renders max_rounds with default value of 3", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const input = screen.getByDisplayValue("3");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "number");
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "10");
  });

  it("updates max_rounds on change", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "5" } });
    expect(update).toHaveBeenCalledWith({ max_rounds: 5 });
  });

  it("falls back to default on non-numeric max_rounds input", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "" } });
    expect(update).toHaveBeenCalledWith({ max_rounds: 3 });
  });

  it("renders on_fail dropdown with all 4 policies", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const select = screen.getByDisplayValue("workflows.critic_on_fail_retry");
    expect(select).toBeInTheDocument();
    expect(select.querySelectorAll("option")).toHaveLength(4);
  });

  it("updates on_fail policy on change", () => {
    const node = critic_gate_descriptor.create_default();
    render(<EditPanel node={node} update={update} t={t} />);

    const select = screen.getByDisplayValue("workflows.critic_on_fail_retry");
    fireEvent.change(select, { target: { value: "error" } });

    expect(update).toHaveBeenCalledWith({ on_fail: "error" });
  });

  it("renders source nodes as text input when no workflow_nodes", () => {
    const node = { ...critic_gate_descriptor.create_default(), source_nodes: ["s1"] };
    render(<EditPanel node={node} update={update} t={t} />);

    const input = screen.getByPlaceholderText("source-node");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("s1");
  });

  it("renders source nodes as buttons when workflow_nodes provided", () => {
    const node = critic_gate_descriptor.create_default();
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Source Node", type: "llm" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    expect(screen.getByText("Source Node")).toBeInTheDocument();
  });

  it("selects/deselects source node on click", () => {
    const node = critic_gate_descriptor.create_default();
    const options = {
      workflow_nodes: [
        { id: "n1", label: "Source Node", type: "llm" },
      ],
    };
    render(<EditPanel node={node} update={update} t={t} options={options} />);

    fireEvent.click(screen.getByText("Source Node"));
    expect(update).toHaveBeenCalledWith({ source_nodes: ["n1"] });
  });

  it("existing condition value is rendered", () => {
    const node = { ...critic_gate_descriptor.create_default(), condition: "x > 1" };
    render(<EditPanel node={node} update={update} t={t} />);

    const input = screen.getByDisplayValue("x > 1");
    expect(input).toBeInTheDocument();
  });

  it("descriptor has correct metadata", () => {
    expect(critic_gate_descriptor.node_type).toBe("critic_gate");
    expect(critic_gate_descriptor.category).toBe("flow");
    expect(critic_gate_descriptor.shape).toBe("diamond");
  });
});
