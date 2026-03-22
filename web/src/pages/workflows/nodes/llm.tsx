import { useState } from "react";
import type { FrontendNodeDescriptor, EditPanelProps } from "../node-registry";
import { BuilderField, BackendModelPicker, BuilderRowPair, TemperatureField } from "../builder-field";

type MessageRole = "system" | "user" | "assistant";
interface LlmMessage { role: MessageRole; content: string }

/** 스키마 필드별 체크박스 편집기 — JSON 스키마를 시각적으로 편집 */
function SchemaFieldEditor({ schema, onUpdate, t }: { schema: unknown; onUpdate: (v: unknown) => void; t: (k: string) => string }) {
  const [rawMode, setRawMode] = useState(false);
  const parsed = (() => {
    try {
      const obj = typeof schema === "string" ? JSON.parse(schema) : schema;
      if (obj?.type === "object" && obj.properties) return obj as { type: string; properties: Record<string, { type: string; description?: string }>; required?: string[] };
    } catch { /* ignore */ }
    return null;
  })();

  if (rawMode || !parsed) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "var(--sp-1)" }}>
          {parsed && <button type="button" className="btn btn--xs btn--ghost" onClick={() => setRawMode(false)}>Fields</button>}
        </div>
        <textarea
          className="input input--sm code-textarea"
          rows={4}
          value={typeof schema === "string" ? schema : JSON.stringify(schema, null, 2)}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder='{"type": "object", "properties": {...}}'
        />
      </div>
    );
  }

  const fields = Object.entries(parsed.properties);
  const required = new Set(parsed.required || []);

  const toggle_field = (name: string) => {
    const props = { ...parsed.properties };
    if (props[name]) { delete props[name]; }
    else { props[name] = { type: "string" }; }
    const req = Object.keys(props).filter((k) => required.has(k));
    onUpdate(JSON.stringify({ type: "object", properties: props, required: req }));
  };

  const add_field = () => {
    const name = `field_${fields.length + 1}`;
    const props = { ...parsed.properties, [name]: { type: "string" } };
    onUpdate(JSON.stringify({ type: "object", properties: props, required: parsed.required }));
  };

  const update_field_type = (name: string, type: string) => {
    const props = { ...parsed.properties, [name]: { ...parsed.properties[name], type } };
    onUpdate(JSON.stringify({ type: "object", properties: props, required: parsed.required }));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--sp-2)" }}>
        <span className="label" style={{ margin: 0 }}>{t("workflows.llm_schema")}</span>
        <button type="button" className="btn btn--xs btn--ghost" onClick={() => setRawMode(true)}>JSON</button>
      </div>
      {fields.map(([name, def]) => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", padding: "var(--sp-1) 0", borderBottom: "1px solid var(--line)" }}>
          <input type="checkbox" checked={true} onChange={() => toggle_field(name)} />
          <input className="input input--sm" value={name} style={{ flex: 1 }} readOnly />
          <select className="input input--sm" value={def.type} onChange={(e) => update_field_type(name, e.target.value)} style={{ width: 90 }}>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="array">array</option>
            <option value="object">object</option>
          </select>
        </div>
      ))}
      <button type="button" className="btn btn--xs" onClick={add_field} style={{ marginTop: "var(--sp-2)" }}>+ Field</button>
    </div>
  );
}

const ROLES: MessageRole[] = ["system", "user", "assistant"];

/**
 * messages 배열을 정규화. legacy prompt_template → 단일 user 메시지로 변환.
 */
function normalize_messages(node: Record<string, unknown>): LlmMessage[] {
  const msgs = node.messages as LlmMessage[] | undefined;
  if (msgs && Array.isArray(msgs) && msgs.length > 0) return msgs;
  const prompt = String(node.prompt_template || "{{prompt}}");
  const sys = node.system_prompt ? String(node.system_prompt) : "";
  const result: LlmMessage[] = [];
  if (sys) result.push({ role: "system", content: sys });
  result.push({ role: "user", content: prompt });
  return result;
}

function LlmEditPanel({ node, update, t, options }: EditPanelProps) {
  const temp = node.temperature as number | undefined;
  const [use_messages, setUseMessages] = useState(!!node.messages);
  const [structured_output, setStructuredOutput] = useState(!!node.output_json_schema);
  const messages = normalize_messages(node);

  const update_message = (i: number, patch: Partial<LlmMessage>) => {
    const updated = messages.map((m, j) => j === i ? { ...m, ...patch } : m);
    update({ messages: updated });
  };
  const add_message = (role: MessageRole = "user") => {
    update({ messages: [...messages, { role, content: "" }] });
  };
  const remove_message = (i: number) => {
    update({ messages: messages.filter((_, j) => j !== i) });
  };

  return (
    <>
      <BackendModelPicker
        backend={String(node.backend || "")}
        onBackendChange={(v) => update({ backend: v })}
        model={node.model as string | undefined}
        onModelChange={(v) => update({ model: v })}
        options={options}
        required
        autoFocus
        backendLabel={t("workflows.llm_backend")}
        modelLabel={t("workflows.llm_model")}
      />

      {/* Messages vs Legacy 토글 */}
      <div className="builder-row builder-checkbox-row">
        <label className="builder-checkbox-label">
          <input
            type="checkbox"
            checked={use_messages}
            onChange={(e) => {
              setUseMessages(e.target.checked);
              if (e.target.checked) {
                update({ messages: normalize_messages(node) });
              } else {
                const user_msg = messages.find((m) => m.role === "user");
                const sys_msg = messages.find((m) => m.role === "system");
                update({
                  prompt_template: user_msg?.content || "{{prompt}}",
                  system_prompt: sys_msg?.content || "",
                  messages: undefined,
                });
              }
            }}
          />
          {t("workflows.llm_use_messages")}
        </label>
      </div>

      {use_messages ? (
        <div className="builder-row">
          <label className="label">{t("workflows.llm_messages")}</label>
          {messages.map((msg, i) => (
            <div key={i} className="builder-nested-block" style={{ marginBottom: "8px" }}>
              <div className="builder-inline-row" style={{ marginBottom: "4px" }}>
                <select
                  className="input input--sm"
                  style={{ flex: "0 0 110px" }}
                  value={msg.role}
                  onChange={(e) => update_message(i, { role: e.target.value as MessageRole })}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                </select>
                <button type="button" className="btn btn--xs btn--danger" onClick={() => remove_message(i)}>{"\u2715"}</button>
              </div>
              <textarea
                className="input code-textarea"
                rows={msg.role === "system" ? 2 : 3}
                value={msg.content}
                onChange={(e) => update_message(i, { content: e.target.value })}
                spellCheck={false}
                placeholder={msg.role === "system" ? "You are a helpful assistant..." : "{{prompt}}"}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: "var(--sp-1)" }}>
            {ROLES.map((r) => (
              <button key={r} type="button" className="btn btn--xs" onClick={() => add_message(r)}>+ {r.toUpperCase()}</button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <BuilderField label={t("workflows.llm_prompt")} required>
            <textarea className="input code-textarea" required rows={4} value={String(node.prompt_template || "")} onChange={(e) => update({ prompt_template: e.target.value })} spellCheck={false} placeholder="{{prompt}}" aria-required="true" />
          </BuilderField>
          <BuilderField label={t("workflows.llm_system")} optional>
            <textarea className="input" rows={3} value={String(node.system_prompt || "")} onChange={(e) => update({ system_prompt: e.target.value })} placeholder={t("common.optional")} />
          </BuilderField>
        </>
      )}

      <BuilderRowPair>
        <TemperatureField value={temp} onChange={(v) => update({ temperature: v })} />
        <BuilderField label={t("providers.max_tokens")}>
          <input className="input input--sm" type="number" min={1} value={String(node.max_tokens ?? "")} onChange={(e) => update({ max_tokens: e.target.value ? Number(e.target.value) : undefined })} />
        </BuilderField>
      </BuilderRowPair>

      {/* 구조화된 출력 토글 */}
      <div className="builder-row builder-checkbox-row">
        <label className="builder-checkbox-label">
          <input
            type="checkbox"
            checked={structured_output}
            onChange={(e) => {
              setStructuredOutput(e.target.checked);
              if (!e.target.checked) update({ output_json_schema: undefined });
            }}
          />
          {t("workflows.llm_structured_output")}
        </label>
      </div>
      {structured_output && (
        <SchemaFieldEditor schema={node.output_json_schema} onUpdate={(v) => update({ output_json_schema: v })} t={t} />
      )}
    </>
  );
}

export const llm_descriptor: FrontendNodeDescriptor = {
  node_type: "llm",
  icon: "🤖",
  color: "#e91e63",
  shape: "rect",
  toolbar_label: "node.llm.label",
  category: "ai",
  output_schema: [
    { name: "response", type: "string",  description: "node.llm.output.response" },
    { name: "parsed",   type: "object",  description: "node.llm.output.parsed" },
    { name: "usage",    type: "object",  description: "node.llm.output.usage" },
  ],
  input_schema: [
    { name: "prompt",  type: "string", description: "node.llm.input.prompt" },
    { name: "context", type: "object", description: "node.llm.input.context" },
  ],
  create_default: () => ({ backend: "", prompt_template: "{{prompt}}" }),
  EditPanel: LlmEditPanel,
};
