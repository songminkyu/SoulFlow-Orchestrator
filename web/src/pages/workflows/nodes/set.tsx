import { useState } from "react";
import { JsonField } from "../builder-field";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

interface Assignment {
  key: string;
  value: string;
  type?: string;
}

function SetEditPanel({ node, update, t }: EditPanelProps) {
  const [mode, setMode] = useState<"table" | "json">("table");
  const assignments = (node.assignments as Assignment[]) || [];

  const update_row = (i: number, patch: Partial<Assignment>) => {
    update({ assignments: assignments.map((a, j) => j === i ? { ...a, ...patch } : a) });
  };
  const add_row = () => {
    update({ assignments: [...assignments, { key: "", value: "", type: "string" }] });
  };
  const remove_row = (i: number) => {
    update({ assignments: assignments.filter((_, j) => j !== i) });
  };

  return (
    <>
      <div className="builder-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label className="label">{t("workflows.set_assignments")}</label>
        <button type="button" className="btn btn--xs btn--ghost" onClick={() => setMode(mode === "table" ? "json" : "table")}>
          {mode === "table" ? "JSON" : t("workflows.set_table_mode")}
        </button>
      </div>
      {mode === "table" ? (
        <div className="builder-row">
          {assignments.map((a, i) => (
            <div key={i} className="builder-inline-row" style={{ marginBottom: "4px", gap: "4px" }}>
              <input
                className="input input--sm"
                style={{ flex: "0 0 30%" }}
                value={a.key}
                onChange={(e) => update_row(i, { key: e.target.value })}
                placeholder="key"
                autoFocus={i === 0}
              />
              <input
                className="input input--sm"
                style={{ flex: 1 }}
                value={a.value}
                onChange={(e) => update_row(i, { value: e.target.value })}
                placeholder="{{memory.node-1.field}}"
              />
              <select
                className="input input--sm"
                style={{ flex: "0 0 80px" }}
                value={a.type || "string"}
                onChange={(e) => update_row(i, { type: e.target.value })}
              >
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="object">object</option>
                <option value="array">array</option>
              </select>
              <button type="button" className="btn btn--xs btn--danger" onClick={() => remove_row(i)}>{"\u2715"}</button>
            </div>
          ))}
          <button type="button" className="btn btn--xs" onClick={add_row}>+ {t("workflows.set_add_row")}</button>
        </div>
      ) : (
        <JsonField
          label=""
          hint={t("workflows.set_hint")}
          value={node.assignments || []}
          onUpdate={(v) => update({ assignments: (v as unknown[]) ?? [] })}
          rows={4}
          placeholder='[{"key": "result", "value": "{{memory.http-1.body}}"}]'
          emptyValue={[]}
        />
      )}
    </>
  );
}

export const set_descriptor: FrontendNodeDescriptor = {
  node_type: "set",
  icon: "=",
  color: "#1abc9c",
  shape: "rect",
  toolbar_label: "node.set.label",
  category: "data",
  output_schema: [],  // 동적: assignments에서 추출
  input_schema: [],
  create_default: () => ({ assignments: [] }),
  EditPanel: SetEditPanel,
};
