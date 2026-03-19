import { useState } from "react";
import { BuilderField, NodeMultiSelect } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

type Operator = "==" | "!=" | ">" | ">=" | "<" | "<=" | "includes" | "startsWith" | "truthy" | "falsy";
interface ConditionClause { variable: string; operator: Operator; value: string }

const OPERATORS: { value: Operator; label: string }[] = [
  { value: "==", label: "==" },
  { value: "!=", label: "!=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "includes", label: "includes" },
  { value: "startsWith", label: "starts with" },
  { value: "truthy", label: "is truthy" },
  { value: "falsy", label: "is falsy" },
];

const UNARY_OPS = new Set<Operator>(["truthy", "falsy"]);

function IfEditPanel({ node, update, t, options }: EditPanelProps) {
  const outputs = (node.outputs as Record<string, unknown>) || {};
  const true_branch = (outputs.true_branch as string[]) || [];
  const false_branch = (outputs.false_branch as string[]) || [];
  const wf_nodes = options?.workflow_nodes;
  const [mode, setMode] = useState<"expression" | "builder">(
    (node.conditions as ConditionClause[] | undefined)?.length ? "builder" : "expression",
  );
  const clauses = (node.conditions as ConditionClause[]) || [];

  const update_clause = (i: number, patch: Partial<ConditionClause>) => {
    update({ conditions: clauses.map((c, j) => j === i ? { ...c, ...patch } : c) });
  };
  const add_clause = () => {
    update({ conditions: [...clauses, { variable: "", operator: "==", value: "" }] });
  };
  const remove_clause = (i: number) => {
    update({ conditions: clauses.filter((_, j) => j !== i) });
  };

  return (
    <>
      {/* 모드 전환 */}
      <div className="builder-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label className="label">{t("workflows.if_condition")}</label>
        <button
          type="button"
          className="btn btn--xs btn--ghost"
          onClick={() => setMode(mode === "expression" ? "builder" : "expression")}
        >
          {mode === "expression" ? t("workflows.if_visual_mode") : t("workflows.if_expression_mode")}
        </button>
      </div>

      {mode === "expression" ? (
        <BuilderField label="" hint={t("workflows.condition_hint")}>
          <input
            autoFocus
            className="input input--sm"
            value={String(node.condition || "")}
            onChange={(e) => update({ condition: e.target.value })}
            placeholder="memory.prev.status === 200"
          />
        </BuilderField>
      ) : (
        <div className="builder-row">
          {clauses.map((c, i) => (
            <div key={i} className="builder-nested-block" style={{ marginBottom: "4px" }}>
              {i > 0 && <span className="builder-hint--inline" style={{ marginBottom: "4px", display: "block" }}>AND</span>}
              <div className="builder-inline-row" style={{ gap: "4px" }}>
                <input
                  className="input input--sm"
                  style={{ flex: 1 }}
                  value={c.variable}
                  onChange={(e) => update_clause(i, { variable: e.target.value })}
                  placeholder="memory.node.field"
                  autoFocus={i === 0}
                />
                <select
                  className="input input--sm"
                  style={{ flex: "0 0 100px" }}
                  value={c.operator}
                  onChange={(e) => update_clause(i, { operator: e.target.value as Operator })}
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {!UNARY_OPS.has(c.operator) && (
                  <input
                    className="input input--sm"
                    style={{ flex: 1 }}
                    value={c.value}
                    onChange={(e) => update_clause(i, { value: e.target.value })}
                    placeholder="value"
                  />
                )}
                <button type="button" className="btn btn--xs btn--danger" onClick={() => remove_clause(i)}>{"\u2715"}</button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn--xs" onClick={add_clause}>+ {t("workflows.if_add_condition")}</button>
        </div>
      )}

      <BuilderField label={t("workflows.if_true_branch")}>
        <NodeMultiSelect value={true_branch} onChange={(ids) => update({ outputs: { ...outputs, true_branch: ids } })} nodes={wf_nodes} placeholder="next-node" />
      </BuilderField>
      <BuilderField label={t("workflows.if_false_branch")}>
        <NodeMultiSelect value={false_branch} onChange={(ids) => update({ outputs: { ...outputs, false_branch: ids } })} nodes={wf_nodes} placeholder="fallback-node" />
      </BuilderField>
    </>
  );
}

export const if_descriptor: FrontendNodeDescriptor = {
  node_type: "if",
  icon: "?",
  color: "#f39c12",
  shape: "diamond",
  toolbar_label: "node.if.label",
  category: "flow",
  output_schema: [
    { name: "branch",           type: "string",  description: "node.if.output.branch" },
    { name: "condition_result", type: "boolean", description: "node.if.output.condition_result" },
  ],
  input_schema: [
    { name: "value", type: "unknown", description: "node.if.input.value" },
  ],
  create_default: () => ({ condition: "true" }),
  EditPanel: IfEditPanel,
};
