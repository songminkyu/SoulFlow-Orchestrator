import { useRef, useState } from "react";
import { BuilderField } from "../builder-field";
import { VariableRefDropdown } from "../variable-ref-chip";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";

function TemplateEditPanel({ node, update, t, upstream_refs }: EditPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showVarPicker, setShowVarPicker] = useState(false);

  const insertRef = (ref_text: string) => {
    const el = textareaRef.current;
    if (!el) { update({ template: (node.template || "") + ref_text }); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = String(node.template || "");
    update({ template: current.slice(0, start) + ref_text + current.slice(end) });
    setShowVarPicker(false);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + ref_text.length;
    });
  };

  return (
    <>
      <BuilderField label={t("workflows.template_body")} hint={t("workflows.template_hint")}>
        <div style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            autoFocus
            className="input code-textarea"
            rows={6}
            value={String(node.template || "")}
            onChange={(e) => update({ template: e.target.value })}
            spellCheck={false}
            placeholder="Hello {{input.name}}, your order #{{input.order_id}} is ready."
            aria-label={t("workflows.template_body")}
          />
          {upstream_refs && upstream_refs.length > 0 && (
            <div style={{ marginTop: "4px" }}>
              <button
                type="button"
                className="btn btn--xs"
                onClick={() => setShowVarPicker((v) => !v)}
              >
                {"{{ }}"} {t("workflows.insert_variable")}
              </button>
              {showVarPicker && (
                <VariableRefDropdown
                  upstream_refs={upstream_refs}
                  onSelect={insertRef}
                />
              )}
            </div>
          )}
        </div>
      </BuilderField>
      <BuilderField label={t("workflows.field_output_field")}>
        <input
          className="input input--sm"
          value={String(node.output_field || "text")}
          onChange={(e) => update({ output_field: e.target.value })}
          placeholder="text"
          aria-label={t("workflows.field_output_field")}
        />
      </BuilderField>
    </>
  );
}

export const template_descriptor: FrontendNodeDescriptor = {
  node_type: "template",
  icon: "{ }",
  color: "#00bcd4",
  shape: "rect",
  toolbar_label: "node.template.label",
  category: "data",
  output_schema: [
    { name: "text", type: "string", description: "node.template.output.text" },
  ],
  input_schema: [
    { name: "input", type: "object", description: "node.template.input.input" },
  ],
  create_default: () => ({ template: "{{input}}", output_field: "text" }),
  EditPanel: TemplateEditPanel,
};
