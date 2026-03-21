import { BuilderField, NodeMultiSelect } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

type SwitchCase = { value: string; targets: string[] };

const CASE_COLORS_SOLID = ["#3498db", "#2ecc71", "#e91e63", "#f39c12", "#9b59b6", "#00bcd4"];
const CASE_COLORS_BG = CASE_COLORS_SOLID.map((c) => `color-mix(in srgb, ${c} 12%, transparent)`);

function SwitchEditPanel({ node, update, t, options }: EditPanelProps) {
  const cases = (node.cases as SwitchCase[]) || [];
  const default_targets = (node.default_targets as string[]) || [];
  const wf_nodes = options?.workflow_nodes;

  const update_case = (i: number, patch: Partial<SwitchCase>) => {
    update({ cases: cases.map((c, j) => j === i ? { ...c, ...patch } : c) });
  };
  const add_case = () => update({ cases: [...cases, { value: "", targets: [] }] });
  const remove_case = (i: number) => update({ cases: cases.filter((_, j) => j !== i) });

  return (
    <>
      <BuilderField label={t("workflows.switch_expression")} hint={t("workflows.expression_hint")}>
        <input autoFocus className="input input--sm" value={String(node.expression || "")} onChange={(e) => update({ expression: e.target.value })} placeholder="memory.status" />
      </BuilderField>
      <div className="builder-row">
        <label className="label">{t("workflows.switch_cases")}</label>
        {cases.map((c, i) => {
          const color = CASE_COLORS_SOLID[i % CASE_COLORS_SOLID.length];
          return (
            <div key={i} className="switch-case-block" style={{ borderLeft: `3px solid ${color}`, background: CASE_COLORS_BG[i % CASE_COLORS_BG.length], borderRadius: "var(--radius-md)", padding: "var(--sp-2) var(--sp-3)", marginBottom: "var(--sp-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", marginBottom: "var(--sp-1)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <input className="input input--sm" style={{ flex: 1 }} value={c.value} onChange={(e) => update_case(i, { value: e.target.value })} placeholder={`condition-${i + 1}`} />
                <button type="button" className="btn btn--xs btn--ghost" onClick={() => remove_case(i)} style={{ color: "var(--err)" }}>{"\u2715"}</button>
              </div>
              <NodeMultiSelect value={c.targets} onChange={(ids) => update_case(i, { targets: ids })} nodes={wf_nodes} placeholder={t("workflows.switch_target_hint")} />
            </div>
          );
        })}
        <button type="button" className="btn btn--xs" onClick={add_case}>+ {t("workflows.switch_add_case")}</button>
      </div>
      <BuilderField label={t("workflows.switch_default")}>
        <div style={{ borderLeft: "3px solid var(--muted)", background: "var(--hover)", borderRadius: "var(--radius-md)", padding: "var(--sp-2) var(--sp-3)" }}>
          <NodeMultiSelect value={default_targets} onChange={(ids) => update({ default_targets: ids })} nodes={wf_nodes} placeholder="fallback-node" />
        </div>
      </BuilderField>
    </>
  );
}

export const switch_descriptor: FrontendNodeDescriptor = {
  node_type: "switch",
  icon: "⑆",
  color: "#ff9800",
  shape: "diamond",
  toolbar_label: "node.switch.label",
  category: "flow",
  output_schema: [
    { name: "matched_case", type: "string", description: "node.switch.output.matched_case" },
  ],
  input_schema: [
    { name: "value", type: "unknown", description: "node.switch.input.value" },
  ],
  create_default: () => ({ expression: "value", cases: [{ value: "a", targets: [] }] }),
  EditPanel: SwitchEditPanel,
};
