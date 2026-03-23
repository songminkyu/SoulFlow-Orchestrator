import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormModal } from "../../components/modal";
import { FormGroup } from "../../components/form-group";
import { useT } from "../../i18n";
import { api } from "../../api/client";
import type { ApiProtocolList } from "../../api/contracts";
import { useAsyncState } from "../../hooks/use-async-state";
import { ProfileEditor } from "./profile-editor";
import type { AgentDefinition, CreateAgentDefinitionInput, UpdateAgentDefinitionInput } from "../../../../src/agent/agent-definition.types";
import { generate_agent_fields, apply_generated_to_form } from "../../hooks/use-agent-generate";

/** 에이전트 모달 모드 — 신규, 편집, 빌트인 포크 */
export type AgentModalMode =
  | { kind: "add" }
  | { kind: "edit"; definition: AgentDefinition }
  | { kind: "fork"; definition: AgentDefinition };

interface AgentModalProps {
  mode: AgentModalMode;
  onClose: () => void;
  onSaved: () => void;
}

const FALLBACK_PROTOCOLS = [
  "clarification-protocol",
  "phase-gates",
  "error-escalation",
  "session-metrics",
  "difficulty-guide",
] as const;

const ROLE_SKILLS = [
  "", // 커스텀 역할 (없음)
  "role:concierge",
  "role:pm",
  "role:pl",
  "role:implementer",
  "role:reviewer",
  "role:debugger",
  "role:validator",
  "role:generalist",
];

/** 초기 폼 상태 */
function init_form(mode: AgentModalMode) {
  const src = mode.kind !== "add" ? mode.definition : null;
  return {
    name: src?.name ?? "",
    description: src?.description ?? "",
    icon: src?.icon ?? "🤖",
    role_skill: src?.role_skill ?? "",
    soul: src?.soul ?? "",
    heart: src?.heart ?? "",
    tools: src?.tools.join(", ") ?? "",
    shared_protocols: src?.shared_protocols ?? ["clarification-protocol", "phase-gates"],
    skills: src?.skills.join(", ") ?? "",
    use_when: src?.use_when ?? "",
    not_use_for: src?.not_use_for ?? "",
    extra_instructions: src?.extra_instructions ?? "",
    preferred_providers: src?.preferred_providers.join(", ") ?? "",
    model: src?.model ?? "",
    is_builtin: false,
  };
}

export function AgentModal({ mode, onClose, onSaved }: AgentModalProps) {
  const t = useT();
  const { data: protocols_data } = useQuery<ApiProtocolList>({
    queryKey: ["protocols"],
    queryFn: () => api.get("/api/protocols"),
    staleTime: 300_000,
  });
  const available_protocols = protocols_data?.protocols?.length
    ? protocols_data.protocols
    : [...FALLBACK_PROTOCOLS];
  const is_edit = mode.kind === "edit";
  const title = is_edit ? t("agents.edit_title") : mode.kind === "fork" ? t("agents.fork_title") : t("agents.add_title");

  const [tab, setTab] = useState<"manual" | "ai">("manual");
  /** IC-2: "raw" = 기존 시스템 프롬프트 textarea, "profile" = ProfileEditor */
  const [prompt_tab, setPromptTab] = useState<"raw" | "profile">("raw");
  const [aiPrompt, setAiPrompt] = useState("");
  const { pending: generating, run: runGenerate } = useAsyncState();
  const { pending: saving, run: runSave } = useAsyncState();

  const [form, setForm] = useState(() => init_form(mode));

  // mode 변경 시 폼 리셋 — useEffect 대신 render 중 조건부 setState (React 권장 패턴)
  const [prev_mode, set_prev_mode] = useState(mode);
  if (mode !== prev_mode) {
    set_prev_mode(mode);
    setForm(init_form(mode));
    setAiPrompt("");
    setTab("manual");
    setPromptTab("raw");
  }

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggle_protocol = (protocol: string) => {
    set("shared_protocols", form.shared_protocols.includes(protocol)
      ? form.shared_protocols.filter((p) => p !== protocol)
      : [...form.shared_protocols, protocol]);
  };

  async function handle_generate() {
    if (!aiPrompt.trim()) return;
    await runGenerate(async () => {
      const data = await generate_agent_fields(aiPrompt);
      setForm((f) => apply_generated_to_form(f, data));
      setTab("manual");
    });
  }

  async function handle_submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    await runSave(async () => {
      const payload: CreateAgentDefinitionInput | UpdateAgentDefinitionInput = {
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon.trim() || "🤖",
        role_skill: form.role_skill || null,
        soul: form.soul.trim(),
        heart: form.heart.trim(),
        tools: form.tools.split(",").map((s) => s.trim()).filter(Boolean),
        shared_protocols: form.shared_protocols,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        use_when: form.use_when.trim(),
        not_use_for: form.not_use_for.trim(),
        extra_instructions: form.extra_instructions.trim(),
        preferred_providers: form.preferred_providers.split(",").map((s) => s.trim()).filter(Boolean),
        model: form.model.trim() || null,
        is_builtin: false,
      };

      if (is_edit) {
        await api.put(`/api/agent-definitions/${(mode as { kind: "edit"; definition: AgentDefinition }).definition.id}`, payload);
      } else {
        await api.post("/api/agent-definitions", payload);
      }
      onSaved();
    });
  }

  return (
    <FormModal
      open
      title={title}
      onClose={onClose}
      onSubmit={handle_submit}
      submitLabel={saving ? t("common.saving") : t("common.save")}
      saving={saving}
      wide
    >
      {/* AI 생성 탭 */}
      <div className="provider-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "manual"} className={`provider-tab${tab === "manual" ? " provider-tab--active" : ""}`} onClick={() => setTab("manual")}>
          {t("agents.tab_manual")}
        </button>
        <button role="tab" aria-selected={tab === "ai"} className={`provider-tab${tab === "ai" ? " provider-tab--active" : ""}`} onClick={() => setTab("ai")}>
          ✨ {t("agents.tab_ai")}
        </button>
      </div>

      {tab === "ai" && (
        <div className="form-section">
          <FormGroup label={t("agents.ai_prompt_label")}>
            <textarea
              className="input input--md"
              rows={3}
              placeholder={t("agents.ai_prompt_placeholder")}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
          </FormGroup>
          <button
            type="button"
            className="btn btn--accent btn--sm"
            disabled={generating || !aiPrompt.trim()}
            onClick={() => void handle_generate()}
          >
            {generating ? t("agents.generating") : t("agents.generate")}
          </button>
          {generating && <p className="form-hint">{t("agents.generating_hint")}</p>}
        </div>
      )}

      {/* ① 기본 정보 */}
      <fieldset className="form-section">
        <legend className="form-section__title">{t("agents.section_basic")}</legend>
        <div className="form-row">
          <div style={{ flex: "0 0 64px" }}>
            <FormGroup label={t("agents.icon")}>
              <input className="input input--center" value={form.icon} onChange={(e) => set("icon", e.target.value)} maxLength={4} placeholder="🤖" />
            </FormGroup>
          </div>
          <div style={{ flex: 1 }}>
            <FormGroup label={t("agents.name")} required>
              <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("agents.name_placeholder")} required />
            </FormGroup>
          </div>
        </div>
        <FormGroup label={t("agents.description")}>
          <input className="input" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder={t("agents.description_placeholder")} />
        </FormGroup>
      </fieldset>

      {/* ② 역할 + 프롬프트 편집기 탭 */}
      <fieldset className="form-section">
        <legend className="form-section__title">{t("profile.editor_section")}</legend>

        {/* IC-2: Raw Prompt / Profile Editor 탭 전환 */}
        <div className="pe-modal-tabs" role="tablist" aria-label={t("profile.editor_section")}>
          <button
            type="button"
            role="tab"
            aria-selected={prompt_tab === "raw"}
            className={`pe-modal-tab${prompt_tab === "raw" ? " pe-modal-tab--active" : ""}`}
            onClick={() => setPromptTab("raw")}
          >
            {t("profile.tab_raw")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={prompt_tab === "profile"}
            className={`pe-modal-tab${prompt_tab === "profile" ? " pe-modal-tab--active" : ""}`}
            onClick={() => setPromptTab("profile")}
          >
            {t("profile.tab_profile")}
          </button>
        </div>

        {prompt_tab === "raw" && (
          <div className="pe-raw-panel">
            <FormGroup label={t("agents.role_skill")}>
              <select className="input" value={form.role_skill} onChange={(e) => set("role_skill", e.target.value)}>
                {ROLE_SKILLS.map((r) => (
                  <option key={r} value={r}>{r || t("agents.role_custom")}</option>
                ))}
              </select>
            </FormGroup>
            <FormGroup label={t("agents.soul")}>
              <textarea className="input" rows={2} value={form.soul} onChange={(e) => set("soul", e.target.value)} placeholder={t("agents.soul_placeholder")} />
            </FormGroup>
            <FormGroup label={t("agents.heart")}>
              <textarea className="input" rows={2} value={form.heart} onChange={(e) => set("heart", e.target.value)} placeholder={t("agents.heart_placeholder")} />
            </FormGroup>
            <FormGroup label={t("agents.section_protocols")}>
              <div className="checkbox-grid">
                {available_protocols.map((protocol) => (
                  <label key={protocol} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={form.shared_protocols.includes(protocol)}
                      onChange={() => toggle_protocol(protocol)}
                    />
                    <span>{protocol}</span>
                  </label>
                ))}
              </div>
            </FormGroup>
          </div>
        )}

        {prompt_tab === "profile" && (
          <ProfileEditor
            form={{
              role_skill: form.role_skill,
              soul: form.soul,
              heart: form.heart,
              shared_protocols: form.shared_protocols,
              extra_instructions: form.extra_instructions,
            }}
            available_protocols={available_protocols}
            onChange={(next) => {
              set("role_skill", next.role_skill);
              set("soul", next.soul);
              set("heart", next.heart);
              set("shared_protocols", next.shared_protocols);
              set("extra_instructions", next.extra_instructions);
            }}
          />
        )}
      </fieldset>

      {/* ④ 허용 도구 + 추가 스킬 */}
      <fieldset className="form-section">
        <legend className="form-section__title">{t("agents.section_tools")}</legend>
        <FormGroup label={t("agents.tools")} hint={t("agents.tools_hint")}>
          <input className="input" value={form.tools} onChange={(e) => set("tools", e.target.value)} placeholder="read_file, write_file, exec" />
        </FormGroup>
        <FormGroup label={t("agents.skills")} hint={t("agents.skills_hint")}>
          <input className="input" value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="github, cron, memory" />
        </FormGroup>
      </fieldset>

      {/* ⑤ 경계 (Boundary) */}
      <fieldset className="form-section">
        <legend className="form-section__title">{t("agents.section_boundary")}</legend>
        <FormGroup label={t("agents.use_when")}>
          <input className="input" value={form.use_when} onChange={(e) => set("use_when", e.target.value)} placeholder={t("agents.use_when_placeholder")} />
        </FormGroup>
        <FormGroup label={t("agents.not_use_for")}>
          <input className="input" value={form.not_use_for} onChange={(e) => set("not_use_for", e.target.value)} placeholder={t("agents.not_use_for_placeholder")} />
        </FormGroup>
      </fieldset>

      {/* ⑥ 추가 지침 */}
      <fieldset className="form-section">
        <legend className="form-section__title">{t("agents.section_extra")}</legend>
        <FormGroup label={t("agents.extra_instructions")}>
          <textarea className="input" rows={3} value={form.extra_instructions} onChange={(e) => set("extra_instructions", e.target.value)} placeholder={t("agents.extra_instructions_placeholder")} />
        </FormGroup>
      </fieldset>

      {/* ⑦ 실행 설정 */}
      <fieldset className="form-section">
        <legend className="form-section__title">{t("agents.section_execution")}</legend>
        <FormGroup label={t("agents.preferred_providers")} hint={t("agents.preferred_providers_hint")}>
          <input className="input" value={form.preferred_providers} onChange={(e) => set("preferred_providers", e.target.value)} placeholder="provider-id-1, provider-id-2" />
        </FormGroup>
        <FormGroup label={t("agents.model")}>
          <input className="input" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="claude-opus-4-6" />
        </FormGroup>
      </fieldset>
    </FormModal>
  );
}
