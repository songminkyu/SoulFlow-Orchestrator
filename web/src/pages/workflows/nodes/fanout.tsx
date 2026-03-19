/**
 * Fanout 노드 (B2.2): 입력을 여러 브랜치로 분산 실행.
 * branch 목록 + reconcile node 드롭다운 + max_concurrency + timeout.
 */
import { BuilderField, BuilderRowPair, NodeMultiSelect } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

function FanoutEditPanel({ node, update, t, options }: EditPanelProps) {
  const branches = (node.branches as string[]) || [];
  const reconcile_node = (node.reconcile_node as string[]) || [];
  const wf_nodes = options?.workflow_nodes;

  return (
    <>
      <BuilderField label={t("workflows.fanout_branches")} required hint={t("workflows.fanout_branches_hint")}>
        <NodeMultiSelect
          value={branches}
          onChange={(ids) => update({ branches: ids })}
          nodes={wf_nodes}
          placeholder="branch-node"
        />
      </BuilderField>
      <BuilderField label={t("workflows.fanout_reconcile")} hint={t("workflows.fanout_reconcile_hint")}>
        <NodeMultiSelect
          value={reconcile_node}
          onChange={(ids) => update({ reconcile_node: ids })}
          nodes={wf_nodes?.filter((n) => n.type === "reconcile")}
          placeholder="reconcile-node"
        />
      </BuilderField>
      <BuilderRowPair>
        <BuilderField label={t("workflows.fanout_max_concurrency")}>
          <input
            className="input input--sm"
            type="number"
            min={1}
            max={100}
            value={String(node.max_concurrency ?? 5)}
            onChange={(e) => update({ max_concurrency: Number(e.target.value) || 5 })}
          />
        </BuilderField>
        <BuilderField label={t("workflows.timeout_ms")} hint={t("workflows.timeout_ms_hint")}>
          <input
            className="input input--sm"
            type="number"
            min={1000}
            max={600000}
            step={1000}
            value={String(node.timeout_ms ?? 30000)}
            onChange={(e) => update({ timeout_ms: Number(e.target.value) || 30000 })}
          />
        </BuilderField>
      </BuilderRowPair>
    </>
  );
}

export const fanout_descriptor: FrontendNodeDescriptor = {
  node_type: "fanout",
  icon: "\u21D4",
  color: "#e74c3c",
  shape: "diamond",
  toolbar_label: "node.fanout.label",
  category: "flow",
  output_schema: [
    { name: "branch_results", type: "array", description: "node.fanout.output.branch_results" },
  ],
  input_schema: [
    { name: "input", type: "object", description: "node.fanout.input.input" },
  ],
  create_default: () => ({ branches: [], reconcile_node: [], max_concurrency: 5, timeout_ms: 30000 }),
  EditPanel: FanoutEditPanel,
};
