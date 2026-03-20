import { BuilderField } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

/** QC-2: Rubric verdict for workflow eval node quality gate display. */
type NodeRubricVerdict = "pass" | "warn" | "fail";

function verdict_color(v: NodeRubricVerdict): string {
  if (v === "pass") return "var(--ok, #22c55e)";
  if (v === "warn") return "var(--warn, #f59e0b)";
  return "var(--err, #ef4444)";
}

/** QC-2: Quality gate badge for eval node — shows rubric verdict if present in node data. */
function QualityGateBadge({ verdict, score }: { verdict: NodeRubricVerdict; score?: number }) {
  return (
    <div
      className="eval-quality-gate"
      data-testid="eval-quality-gate"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 3,
        background: `${verdict_color(verdict)}22`,
        border: `1px solid ${verdict_color(verdict)}55`,
        fontSize: 11,
        fontWeight: 600,
        color: verdict_color(verdict),
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: verdict_color(verdict), flexShrink: 0 }} />
      {verdict.toUpperCase()}
      {score != null && (
        <span style={{ fontWeight: 400, opacity: 0.85, marginLeft: 2 }}>
          {(score * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

function EvalEditPanel({ node, update, t }: EditPanelProps) {
  // QC-2: read rubric_verdict / eval_score from node data if present (set by runtime after execution)
  const rubric_verdict = node.rubric_verdict as NodeRubricVerdict | undefined;
  const eval_score = typeof node.eval_score === "number" ? node.eval_score : undefined;

  return (
    <>
      {/* QC-4: direct-node preference hint — eval(code) 노드는 에이전트 대신 직접 실행 권장 */}
      <div className="node-hint node-hint--info" title={t("workflows.eval_direct_node_hint_detail") || "Use eval/code nodes instead of agent nodes for deterministic transformations to keep agent ratio low."}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        {t("workflows.eval_direct_node_hint") || "Direct execution node — prefer over agent nodes for deterministic logic"}
      </div>
      {/* QC-2: Quality gate display — show verdict badge when available */}
      {rubric_verdict && (
        <BuilderField label={t("node.eval.quality_gate")}>
          <QualityGateBadge verdict={rubric_verdict} score={eval_score} />
        </BuilderField>
      )}
      <BuilderField label={t("workflows.field_code")}>
        <textarea autoFocus className="input code-textarea" rows={5} value={String(node.code || "")} onChange={(e) => update({ code: e.target.value })} placeholder="return x + y;" />
      </BuilderField>
      <BuilderField label={t("workflows.field_context_json")}>
        <textarea className="input code-textarea" rows={2} value={String(node.context || "")} onChange={(e) => update({ context: e.target.value })} placeholder='{"x": 1, "y": 2}' />
      </BuilderField>
    </>
  );
}

export const eval_descriptor: FrontendNodeDescriptor = {
  node_type: "eval",
  icon: "\u{1F4BB}",
  color: "#4a148c",
  shape: "rect",
  toolbar_label: "node.eval.label",
  category: "data",
  output_schema: [
    { name: "result",  type: "string",  description: "node.eval.output.result" },
    { name: "success", type: "boolean", description: "node.eval.output.success" },
    { name: "rubric_verdict", type: "string", description: "node.eval.output.rubric_verdict" },
  ],
  input_schema: [
    { name: "code",    type: "string", description: "node.eval.input.code" },
    { name: "context", type: "string", description: "node.eval.input.context" },
  ],
  create_default: () => ({ code: "", context: "" }),
  EditPanel: EvalEditPanel,
};
