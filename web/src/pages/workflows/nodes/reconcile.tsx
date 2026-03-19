/**
 * Reconcile 노드 (B2.1): 분산 실행 결과를 정책 기반으로 병합.
 * source 노드 멀티셀렉트 + policy 드롭다운 + use_parsed 토글.
 */
import { BuilderField } from "../builder-field";
import { NodeMultiSelect } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

const POLICIES = ["merge_all", "first_success", "majority_vote", "custom"] as const;

function ReconcileEditPanel({ node, update, t, options }: EditPanelProps) {
  const sources = (node.source_nodes as string[]) || [];
  const wf_nodes = options?.workflow_nodes;

  return (
    <>
      <BuilderField label={t("workflows.reconcile_sources")} required hint={t("workflows.reconcile_sources_hint")}>
        <NodeMultiSelect
          value={sources}
          onChange={(ids) => update({ source_nodes: ids })}
          nodes={wf_nodes}
          placeholder="source-node"
        />
      </BuilderField>
      <BuilderField label={t("workflows.reconcile_policy")} required>
        <select
          autoFocus
          className="input input--sm"
          required
          value={String(node.policy || "merge_all")}
          onChange={(e) => update({ policy: e.target.value })}
        >
          {POLICIES.map((p) => (
            <option key={p} value={p}>{t(`workflows.reconcile_policy_${p}`)}</option>
          ))}
        </select>
      </BuilderField>
      <div className="builder-row builder-checkbox-row">
        <label className="builder-checkbox-label">
          <input
            type="checkbox"
            checked={!!node.use_parsed}
            onChange={(e) => update({ use_parsed: e.target.checked })}
          />
          {t("workflows.reconcile_use_parsed")}
        </label>
      </div>
    </>
  );
}

export const reconcile_descriptor: FrontendNodeDescriptor = {
  node_type: "reconcile",
  icon: "\u2A01",
  color: "#8e44ad",
  shape: "diamond",
  toolbar_label: "node.reconcile.label",
  category: "flow",
  output_schema: [
    { name: "result", type: "object", description: "node.reconcile.output.result" },
    { name: "sources", type: "array", description: "node.reconcile.output.sources" },
  ],
  input_schema: [],
  create_default: () => ({ source_nodes: [], policy: "merge_all", use_parsed: false }),
  EditPanel: ReconcileEditPanel,
};
