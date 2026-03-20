/**
 * Fanout 노드 (B2.2): 입력을 여러 브랜치로 분산 실행.
 * branch 목록 + reconcile node 드롭다운 + max_concurrency + timeout.
 */
import { BuilderField, BuilderRowPair, NodeMultiSelect } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

function FanoutEditPanel({ node, update, t, options }: EditPanelProps) {
  const reconcile_id = (node.reconcile_node_id as string) || "";
  const wf_nodes = options?.workflow_nodes;
  const reconcile_nodes = wf_nodes?.filter((n) => n.type === "reconcile") || [];

  return (
    <>
      <BuilderField label={t("workflows.fanout_branches")} required hint={t("workflows.fanout_branches_hint")}>
        <NodeMultiSelect
          value={(node.branches as Array<{ branch_id: string; node_ids: string[] }>)?.map((b) => b.branch_id) || []}
          onChange={(ids) => update({ branches: ids.map((id) => ({ branch_id: id, node_ids: [] })) })}
          nodes={wf_nodes}
          placeholder="branch-node"
        />
      </BuilderField>
      <BuilderField label={t("workflows.fanout_reconcile")} hint={t("workflows.fanout_reconcile_hint")}>
        <select
          className="input input--sm"
          value={reconcile_id}
          onChange={(e) => update({ reconcile_node_id: e.target.value })}
        >
          <option value="">{t("common.select")}</option>
          {reconcile_nodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label || n.id}</option>
          ))}
        </select>
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
            value={String(node.branch_timeout_ms ?? 30000)}
            onChange={(e) => update({ branch_timeout_ms: Number(e.target.value) || 30000 })}
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
  create_default: () => ({ branches: [], reconcile_node_id: "", max_concurrency: 5, branch_timeout_ms: 30000 }),
  EditPanel: FanoutEditPanel,
};
