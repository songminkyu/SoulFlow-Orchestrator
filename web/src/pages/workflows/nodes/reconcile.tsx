/**
 * Reconcile 노드 (B2.1): 분산 실행 결과를 정책 기반으로 병합.
 * source 노드 멀티셀렉트 + policy 드롭다운 + use_parsed 토글.
 */
import { BuilderField } from "../builder-field";
import { NodeMultiSelect } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

const POLICIES = ["majority_vote", "first_wins", "last_wins", "merge_union"] as const;

function ReconcileEditPanel({ node, update, t, options }: EditPanelProps) {
  const sources = (node.source_node_ids as string[]) || [];
  const wf_nodes = options?.workflow_nodes;

  return (
    <>
      <BuilderField label={t("workflows.reconcile_sources")} required hint={t("workflows.reconcile_sources_hint")}>
        <NodeMultiSelect
          value={sources}
          onChange={(ids) => update({ source_node_ids: ids })}
          nodes={wf_nodes}
          placeholder="source-node"
        />
      </BuilderField>
      <BuilderField label={t("workflows.reconcile_policy")} required>
        <select
          autoFocus
          className="input input--sm"
          required
          value={String(node.policy || "majority_vote")}
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
    { name: "reconciled", type: "object", description: "node.reconcile.output.reconciled" },
    { name: "conflicts", type: "array", description: "node.reconcile.output.conflicts" },
    { name: "policy_applied", type: "string", description: "node.reconcile.output.policy_applied" },
    { name: "succeeded", type: "number", description: "node.reconcile.output.succeeded" },
    { name: "failed", type: "number", description: "node.reconcile.output.failed" },
  ],
  input_schema: [],
  create_default: () => ({ source_node_ids: [], policy: "majority_vote", use_parsed: false }),
  EditPanel: ReconcileEditPanel,
};
