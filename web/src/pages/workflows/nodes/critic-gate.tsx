/**
 * CriticGate 노드 (B2.3): 품질 게이트 — 조건 미달 시 재시도/실패.
 * source node + condition + max_rounds + on_fail 정책.
 */
import { BuilderField, BuilderRowPair, NodeMultiSelect } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

const ON_FAIL_POLICIES = ["retry", "skip", "error", "fallback"] as const;

function CriticGateEditPanel({ node, update, t, options }: EditPanelProps) {
  const source_nodes = (node.source_nodes as string[]) || [];
  const wf_nodes = options?.workflow_nodes;

  return (
    <>
      <BuilderField label={t("workflows.critic_source")} required>
        <NodeMultiSelect
          value={source_nodes}
          onChange={(ids) => update({ source_nodes: ids })}
          nodes={wf_nodes}
          placeholder="source-node"
        />
      </BuilderField>
      <BuilderField label={t("workflows.critic_condition")} required hint={t("workflows.critic_condition_hint")}>
        <input
          autoFocus
          className="input input--sm"
          required
          value={String(node.condition || "")}
          onChange={(e) => update({ condition: e.target.value })}
          placeholder="memory.prev.score >= 0.8"
        />
      </BuilderField>
      <BuilderRowPair>
        <BuilderField label={t("workflows.critic_max_rounds")}>
          <input
            className="input input--sm"
            type="number"
            min={1}
            max={10}
            value={String(node.max_rounds ?? 3)}
            onChange={(e) => update({ max_rounds: Number(e.target.value) || 3 })}
          />
        </BuilderField>
        <BuilderField label={t("workflows.critic_on_fail")} required>
          <select
            className="input input--sm"
            required
            value={String(node.on_fail || "retry")}
            onChange={(e) => update({ on_fail: e.target.value })}
          >
            {ON_FAIL_POLICIES.map((p) => (
              <option key={p} value={p}>{t(`workflows.critic_on_fail_${p}`)}</option>
            ))}
          </select>
        </BuilderField>
      </BuilderRowPair>
    </>
  );
}

export const critic_gate_descriptor: FrontendNodeDescriptor = {
  node_type: "critic_gate",
  icon: "\uD83D\uDEE1",
  color: "#c0392b",
  shape: "diamond",
  toolbar_label: "node.critic_gate.label",
  category: "flow",
  output_schema: [
    { name: "passed", type: "boolean", description: "node.critic_gate.output.passed" },
    { name: "rounds", type: "number", description: "node.critic_gate.output.rounds" },
    { name: "result", type: "object", description: "node.critic_gate.output.result" },
  ],
  input_schema: [
    { name: "value", type: "unknown", description: "node.critic_gate.input.value" },
  ],
  create_default: () => ({ source_nodes: [], condition: "", max_rounds: 3, on_fail: "retry" }),
  EditPanel: CriticGateEditPanel,
};
