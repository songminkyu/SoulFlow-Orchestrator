/**
 * Prompting — Agent 탭.
 * 에이전트 목록 사이드바 + 선택된 에이전트 편집 + 테스트 채팅을 3열로 통합.
 */
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { ApiProtocolList } from "../../api/contracts";
import { useT } from "../../i18n";
import { useToast } from "../../components/toast";
import { StudioModelPicker, type StudioModelValue } from "../../components/studio-model-picker";
import { ChatPromptBar } from "../../components/chat-prompt-bar";
import { RunResult, type RunResultValue } from "./run-result";
import type { AgentDefinition } from "../../../../src/agent/agent-definition.types";
import { generate_agent_fields, apply_generated_to_form } from "../../hooks/use-agent-generate";

type ChatMsg = { role: "user" | "assistant"; content: string };

/** G-13: 하드코딩 폴백 — API 미응답 시 사용. */
const FALLBACK_PROTOCOLS = [
  "clarification-protocol",
  "phase-gates",
  "error-escalation",
  "session-metrics",
  "difficulty-guide",
] as const;

const ROLE_SKILLS = [
  "",
  "role:concierge",
  "role:pm",
  "role:pl",
  "role:implementer",
  "role:reviewer",
  "role:debugger",
  "role:validator",
  "role:generalist",
];

interface AgentPanelProps {
  /** Gallery에서 넘어올 때 선택할 에이전트 ID. "__new__"이면 새 에이전트 폼. */
  initial_id?: string;
}

interface FormState {
  name: string;
  description: string;
  icon: string;
  role_skill: string;
  soul: string;
  heart: string;
  tools: string;
  shared_protocols: string[];
  skills: string;
  use_when: string;
  not_use_for: string;
  extra_instructions: string;
}

const EMPTY_FORM: FormState = {
  name: "", description: "", icon: "🤖", role_skill: "",
  soul: "", heart: "", tools: "",
  shared_protocols: ["clarification-protocol", "phase-gates"],
  skills: "", use_when: "", not_use_for: "", extra_instructions: "",
};

function form_from_def(def: AgentDefinition): FormState {
  return {
    name: def.name,
    description: def.description,
    icon: def.icon,
    role_skill: def.role_skill ?? "",
    soul: def.soul,
    heart: def.heart,
    tools: def.tools.join(", "),
    shared_protocols: def.shared_protocols,
    skills: def.skills.join(", "),
    use_when: def.use_when,
    not_use_for: def.not_use_for,
    extra_instructions: def.extra_instructions,
  };
}

// ── 에이전트 목록 아이템 ──
function AgentListItem({
  def,
  selected,
  running,
  onClick,
}: {
  def: AgentDefinition;
  selected: boolean;
  running: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      className={`ps-agent-item${selected ? " ps-agent-item--active" : ""}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="ps-agent-item__icon" aria-hidden="true">{def.icon || "🤖"}</span>
      <span className="ps-agent-item__body">
        <span className="ps-agent-item__name">{def.name}</span>
        {def.role_skill && (
          <span className="ps-agent-item__role">{def.role_skill.replace("role:", "")}</span>
        )}
      </span>
      <span className="ps-agent-item__badges">
        {running && (
          <span className="badge badge--ok ps-agent-item__badge" title={t("prompting.agent_running")}>
            ●
          </span>
        )}
        {def.is_builtin && (
          <span className="badge badge--info ps-agent-item__badge" title={t("agents.builtin_tooltip")}>
            {t("agents.builtin")}
          </span>
        )}
      </span>
    </button>
  );
}

export function AgentPanel({ initial_id }: AgentPanelProps) {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const chat_end_ref = useRef<HTMLDivElement>(null);

  const { data: definitions = [] } = useQuery<AgentDefinition[]>({
    queryKey: ["agent-definitions"],
    queryFn: () => api.get("/api/agent-definitions"),
    staleTime: 10_000,
  });

  // running 에이전트 ID 목록 (running/waiting 상태인 에이전트 정의 ID)
  const { data: running_agents = [] } = useQuery<Array<{ id: string; status: string }>>({
    queryKey: ["agents"],
    queryFn: () => api.get("/api/agents"),
    staleTime: 10_000,
  });

  const running_ids = new Set(
    running_agents
      .filter((a) => a.status === "running" || a.status === "waiting_user_input" || a.status === "waiting_approval")
      .map((a) => a.id),
  );

  /** G-13: 동적 프로토콜 목록 — API 실패 시 폴백 사용. */
  const { data: protocols_data } = useQuery<ApiProtocolList>({
    queryKey: ["protocols"],
    queryFn: () => api.get("/api/protocols"),
    staleTime: 300_000,
  });
  const available_protocols = protocols_data?.protocols?.length
    ? protocols_data.protocols
    : [...FALLBACK_PROTOCOLS];

  const [selected_id, setSelectedId] = useState<string>(initial_id ?? "__new__");
  const [model, setModel] = useState<StudioModelValue>({ provider_id: "", model: "" });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [ai_prompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [last_result, setLastResult] = useState<RunResultValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [delete_confirm_id, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggle_protocol = (protocol: string) =>
    set("shared_protocols", form.shared_protocols.includes(protocol)
      ? form.shared_protocols.filter((p) => p !== protocol)
      : [...form.shared_protocols, protocol]);

  // Gallery에서 탭 전환 시 initial_id 반영
  useEffect(() => {
    if (initial_id !== undefined) setSelectedId(initial_id);
  }, [initial_id]);

  useEffect(() => {
    if (selected_id === "__new__") {
      setModel({ provider_id: "", model: "" });
      setForm(EMPTY_FORM);
      return;
    }
    const def = definitions.find((d) => d.id === selected_id);
    if (!def) return;
    setModel({ provider_id: def.preferred_providers[0] ?? "", model: def.model ?? "" });
    setForm(form_from_def(def));
  }, [selected_id, definitions]);

  useEffect(() => {
    chat_end_ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, running]);

  const build_system = () =>
    [form.soul, form.heart, form.extra_instructions].filter(Boolean).join("\n\n---\n\n");

  const handle_generate = async () => {
    if (!ai_prompt.trim()) return;
    setGenerating(true);
    try {
      const data = await generate_agent_fields(ai_prompt, model.provider_id || undefined);
      setForm((f) => apply_generated_to_form(f, data));
      if (data.preferred_providers?.[0]) setModel((m) => ({ ...m, provider_id: data.preferred_providers![0]! }));
      if (data.model) setModel((m) => ({ ...m, model: data.model ?? "" }));
    } catch (e) {
      toast(e instanceof Error ? e.message : "generate_failed", "err");
    } finally {
      setGenerating(false);
    }
  };

  const handle_send = async () => {
    if (!input.trim() || !model.provider_id) return;
    const user_msg: ChatMsg = { role: "user", content: input.trim() };
    setChat((prev) => [...prev, user_msg]);
    setInput("");
    setRunning(true);
    setLastResult(null);
    try {
      const res = await api.post<RunResultValue>("/api/prompt/run", {
        provider_id: model.provider_id,
        model: model.model || undefined,
        prompt: user_msg.content,
        system: build_system() || undefined,
      });
      setChat((prev) => [...prev, { role: "assistant", content: res.content ?? "(empty)" }]);
      setLastResult(res);
    } catch (err) {
      setChat((prev) => [...prev, { role: "assistant", content: `⚠ ${(err as Error)?.message}` }]);
    } finally {
      setRunning(false);
    }
  };

  const handle_save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
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
        preferred_providers: model.provider_id ? [model.provider_id] : [],
        model: model.model || null,
        is_builtin: false,
      };
      if (selected_id === "__new__") {
        const created = await api.post<AgentDefinition>("/api/agent-definitions", payload);
        void qc.invalidateQueries({ queryKey: ["agent-definitions"] });
        if (created?.id) setSelectedId(created.id);
      } else {
        await api.put(`/api/agent-definitions/${selected_id}`, payload);
        void qc.invalidateQueries({ queryKey: ["agent-definitions"] });
      }
    } finally {
      setSaving(false);
    }
  };

  const handle_delete = async (id: string) => {
    setDeleting(true);
    try {
      await api.del(`/api/agent-definitions/${id}`);
      void qc.invalidateQueries({ queryKey: ["agent-definitions"] });
      setSelectedId("__new__");
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const selected_def = definitions.find((d) => d.id === selected_id);

  return (
    <div className="ps-agent-layout">
      {/* ── 왼쪽: 에이전트 목록 ── */}
      <aside className="ps-agent-sidebar">
        <div className="ps-agent-sidebar__head">
          <span className="ps-pane-head__title">{t("prompting.agent_catalog")}</span>
          <button
            className="btn btn--xs btn--accent"
            onClick={() => setSelectedId("__new__")}
            aria-label={t("prompting.agent_new")}
          >
            +
          </button>
        </div>
        <div className="ps-agent-sidebar__list">
          {definitions.length === 0 && (
            <div className="ps-agent-sidebar__empty">{t("prompting.agent_list_empty")}</div>
          )}
          {definitions.map((def) => (
            <AgentListItem
              key={def.id}
              def={def}
              selected={selected_id === def.id}
              running={running_ids.has(def.id)}
              onClick={() => setSelectedId(def.id)}
            />
          ))}
        </div>
      </aside>

      {/* ── 가운데: 에이전트 편집 ── */}
      <aside className="ps-config">
        {/* 타이틀 */}
        <div className="ps-pane-head">
          <div className="ps-pane-head__icon">🤖</div>
          <span className="ps-pane-head__title">
            {selected_id === "__new__" ? t("prompting.agent_new_title") : t("prompting.agent_edit_title")}
          </span>
        </div>

        {/* 기본 정보: 아이콘 + 이름 + 설명 */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("agents.section_basic")}</span>
          <div className="ps-icon-name-row">
            <input
              className="input input--center ps-icon-input"
              value={form.icon}
              onChange={(e) => set("icon", e.target.value)}
              maxLength={4}
              placeholder="🤖"
              aria-label={t("agents.icon")}
            />
            <input
              className="input flex-1"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t("agents.name_placeholder")}
              aria-label={t("agents.name")}
            />
          </div>
          <input
            className="input"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder={t("agents.description_placeholder")}
            aria-label={t("agents.description")}
          />
        </div>

        {/* 역할 */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("agents.section_role")}</span>
          <select
            className="ps-select-sm ps-select-full"
            style={{ height: 32, fontSize: 13 }}
            value={form.role_skill}
            onChange={(e) => set("role_skill", e.target.value)}
            aria-label={t("agents.section_role")}
          >
            {ROLE_SKILLS.map((r) => (
              <option key={r} value={r}>{r || t("agents.role_custom")}</option>
            ))}
          </select>
        </div>

        {/* 모델 */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("prompting.model")}</span>
          <StudioModelPicker value={model} onChange={setModel} />
        </div>

        {/* AI 자동 생성 */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">
            {t("prompting.ai_generate")}
            <span className="ps-label-hint">{t("prompting.ai_generate_hint")}</span>
          </span>
          <div className="ps-upload-row">
            <textarea
              className="ps-upload-input ps-generate-input"
              value={ai_prompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t("prompting.ai_generate_ph")}
            />
            <button
              className="ps-upload-btn ps-generate-btn"
              disabled={generating || !ai_prompt.trim()}
              onClick={() => void handle_generate()}
            >
              {generating ? "…" : t("prompting.generate")}
            </button>
          </div>
        </div>

        {/* Soul */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">
            {t("prompting.soul")} <span className="ps-label-hint">{t("prompting.soul_hint")}</span>
          </span>
          <textarea
            className="ps-prompt-area"
            style={{ minHeight: 72 }}
            value={form.soul}
            onChange={(e) => set("soul", e.target.value)}
            placeholder={t("prompting.soul_ph")}
            aria-label={t("prompting.soul")}
          />
        </div>

        {/* Heart */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">
            {t("prompting.heart")} <span className="ps-label-hint">{t("prompting.heart_hint")}</span>
          </span>
          <textarea
            className="ps-prompt-area"
            style={{ minHeight: 60 }}
            value={form.heart}
            onChange={(e) => set("heart", e.target.value)}
            placeholder={t("prompting.heart_ph")}
            aria-label={t("prompting.heart")}
          />
        </div>

        {/* 공통 규칙 (Shared Protocols) */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("agents.section_protocols")}</span>
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
        </div>

        {/* 도구 + 스킬 */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("agents.section_tools")}</span>
          <input
            className="input"
            value={form.tools}
            onChange={(e) => set("tools", e.target.value)}
            placeholder={t("agents.tools_hint")}
          />
          <input
            className="input"
            value={form.skills}
            onChange={(e) => set("skills", e.target.value)}
            placeholder={t("agents.skills_hint")}
          />
        </div>

        {/* 경계 (Boundary) */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("agents.section_boundary")}</span>
          <input
            className="input"
            value={form.use_when}
            onChange={(e) => set("use_when", e.target.value)}
            placeholder={t("agents.use_when_placeholder")}
          />
          <input
            className="input"
            value={form.not_use_for}
            onChange={(e) => set("not_use_for", e.target.value)}
            placeholder={t("agents.not_use_for_placeholder")}
          />
        </div>

        {/* Extra */}
        <div className="ps-pane-sec ps-pane-sec--noborder">
          <span className="ps-pane-sec__label">{t("prompting.extra")}</span>
          <textarea
            className="ps-prompt-area"
            style={{ minHeight: 52 }}
            value={form.extra_instructions}
            onChange={(e) => set("extra_instructions", e.target.value)}
            placeholder={t("prompting.extra_ph")}
          />
        </div>

        {/* 저장 바 */}
        <div className="ps-save-bar">
          <button
            className={`ps-run-btn-main ps-save-btn-agent${saving ? " ps-run-btn-main--running" : ""}`}
            disabled={saving || !form.name.trim()}
            onClick={() => void handle_save()}
          >
            {saving ? t("prompting.saving") : selected_id === "__new__" ? t("prompting.save") : t("prompting.update")}
          </button>
          {selected_id !== "__new__" && (
            <button className="btn btn--sm" onClick={() => setSelectedId("__new__")}>{t("prompting.new")}</button>
          )}
          {selected_id !== "__new__" && selected_def && !selected_def.is_builtin && (
            delete_confirm_id === selected_id ? (
              <>
                <button
                  className="btn btn--sm btn--danger"
                  disabled={deleting}
                  onClick={() => void handle_delete(selected_id)}
                >
                  {deleting ? "…" : t("prompting.agent_delete_confirm")}
                </button>
                <button className="btn btn--sm" onClick={() => setDeleteConfirmId(null)}>
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button
                className="btn btn--sm btn--danger"
                onClick={() => setDeleteConfirmId(selected_id)}
              >
                {t("prompting.delete")}
              </button>
            )
          )}
        </div>
      </aside>

      {/* ── 오른쪽: 채팅 테스트 ── */}
      <main className="ps-preview">
        {/* 헤더 */}
        <div className="ps-preview-head">
          <div className="ps-preview-head__top">
            <span className="ps-preview-head__icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </span>
            <span className="ps-preview-head__title">{t("prompting.test_chat")}</span>
          </div>
          <div className="ps-preview-head__sub">{t("prompting.test_chat_hint")}</div>
        </div>

        {/* 채팅 메시지 영역 */}
        <div className="ps-output-area">
          {chat.length === 0 && (
            <div className="ps-preview-empty">
              <div className="ps-preview-empty__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <span>{t("prompting.test_chat_empty")}</span>
            </div>
          )}
          {chat.map((msg, i) => (
            <div key={i} className="ps-chat-msg">
              <span className={`ps-chat-role ps-chat-role--${msg.role === "user" ? "user" : "agent"}`}>
                {msg.role === "user" ? t("prompting.role_user") : t("prompting.role_agent")}
              </span>
              <pre className="ps-chat-body">
                {msg.content}
              </pre>
            </div>
          ))}
          {running && (
            <div className="ps-streaming-status">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 11-18 0"/><path d="M21 12a9 9 0 00-9-9"/>
              </svg>
              {t("prompting.thinking")}
            </div>
          )}
          {last_result && !running && (
            <div className="ps-thinking-wrap">
              <RunResult value={last_result} />
            </div>
          )}
          <div ref={chat_end_ref} />
        </div>

        {/* 입력 바 */}
        <ChatPromptBar
          input={input}
          setInput={setInput}
          sending={running}
          can_send={!running && input.trim().length > 0 && !!model.provider_id}
          onSend={() => void handle_send()}
          placeholder={t("prompting.chat_placeholder")}
        />
      </main>
    </div>
  );
}
