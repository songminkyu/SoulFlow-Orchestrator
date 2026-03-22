/**
 * IC-2: RP-5 Profile Editor Component
 *
 * Role skill selector + shared protocol checklist + compile preview panel.
 * Provides a structured alternative to raw system_prompt editing.
 */
import { useState, useEffect, useRef } from "react";
import { useT } from "../../i18n";
import { api } from "../../api/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProfileFormState {
  role_skill: string;
  soul: string;
  heart: string;
  shared_protocols: string[];
  extra_instructions: string;
}

interface ProfileEditorProps {
  form: ProfileFormState;
  available_protocols: string[];
  onChange: (next: ProfileFormState) => void;
}

interface CompilePreviewResult {
  /** Rendered full system prompt text */
  text: string;
  /** Structured breakdown, if available */
  sections?: {
    soul?: string;
    heart?: string;
    instructions?: string;
    protocols?: Array<{ name: string; content: string }>;
  };
  error?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

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

/** Protocol display metadata — description for each known protocol */
const PROTOCOL_META: Record<string, string> = {
  "clarification-protocol": "Asks for clarification before acting on ambiguous requests",
  "phase-gates": "Requires explicit sign-off before each major phase transition",
  "error-escalation": "Escalates unrecoverable errors to the operator immediately",
  "session-metrics": "Tracks turn count, token usage, and completion rates per session",
  "difficulty-guide": "Calibrates response complexity to match user expertise level",
};

// ── Local compile preview (FE-side, no API required) ────────────────────────

function build_local_preview(form: ProfileFormState): CompilePreviewResult {
  const sections: CompilePreviewResult["sections"] = {
    soul: form.soul || undefined,
    heart: form.heart || undefined,
    instructions: form.extra_instructions || undefined,
    protocols: form.shared_protocols.map((p) => ({
      name: p,
      content: PROTOCOL_META[p] ?? `Protocol: ${p}`,
    })),
  };

  const parts: string[] = [];

  if (form.role_skill) {
    parts.push(`# Role: ${form.role_skill.replace("role:", "")}`);
  }
  if (form.soul) {
    parts.push(`## Soul\n${form.soul}`);
  }
  if (form.heart) {
    parts.push(`## Heart\n${form.heart}`);
  }
  if (form.shared_protocols.length > 0) {
    parts.push(
      `## Protocols\n${form.shared_protocols
        .map((p) => `- **${p}**: ${PROTOCOL_META[p] ?? p}`)
        .join("\n")}`,
    );
  }
  if (form.extra_instructions) {
    parts.push(`## Extra Instructions\n${form.extra_instructions}`);
  }

  return {
    text: parts.join("\n\n"),
    sections,
  };
}

// ── CompilePreview Panel ─────────────────────────────────────────────────────

function CompilePreview({ form }: { form: ProfileFormState }) {
  const t = useT();
  const [preview, setPreview] = useState<CompilePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [view_mode, setViewMode] = useState<"structured" | "raw">("structured");
  const debounce_ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetch_preview() {
    setLoading(true);
    try {
      const result = await api.post<CompilePreviewResult>("/api/prompt/compile-preview", {
        role_skill: form.role_skill,
        soul: form.soul,
        heart: form.heart,
        shared_protocols: form.shared_protocols,
        extra_instructions: form.extra_instructions,
      });
      setPreview(result);
    } catch {
      // API unavailable — fall back to local compile
      setPreview(build_local_preview(form));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (debounce_ref.current) clearTimeout(debounce_ref.current);
    debounce_ref.current = setTimeout(() => {
      void fetch_preview();
    }, 400);
    return () => {
      if (debounce_ref.current) clearTimeout(debounce_ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.role_skill, form.soul, form.heart, form.shared_protocols.join(","), form.extra_instructions]);

  const has_content =
    form.soul || form.heart || form.shared_protocols.length > 0 || form.extra_instructions;

  return (
    <div className="pe-preview">
      <div className="pe-preview__header">
        <span className="pe-preview__title">{t("profile.preview_title")}</span>
        <div className="pe-preview__controls">
          <button
            type="button"
            className={`pe-view-toggle${view_mode === "structured" ? " pe-view-toggle--active" : ""}`}
            onClick={() => setViewMode("structured")}
            aria-pressed={view_mode === "structured"}
          >
            {t("profile.preview_structured")}
          </button>
          <button
            type="button"
            className={`pe-view-toggle${view_mode === "raw" ? " pe-view-toggle--active" : ""}`}
            onClick={() => setViewMode("raw")}
            aria-pressed={view_mode === "raw"}
          >
            {t("profile.preview_raw")}
          </button>
          {loading && (
            <span className="pe-preview__spinner" aria-label={t("common.loading")} />
          )}
        </div>
      </div>

      <div className="pe-preview__body">
        {!has_content && !preview && (
          <div className="pe-preview__empty">
            <span>{t("profile.preview_empty")}</span>
          </div>
        )}

        {preview && view_mode === "structured" && preview.sections && (
          <div className="pe-structured">
            {preview.sections.soul && (
              <div className="pe-section">
                <span className="pe-section__label">{t("prompting.soul")}</span>
                <p className="pe-section__content">{preview.sections.soul}</p>
              </div>
            )}
            {preview.sections.heart && (
              <div className="pe-section">
                <span className="pe-section__label">{t("prompting.heart")}</span>
                <p className="pe-section__content">{preview.sections.heart}</p>
              </div>
            )}
            {preview.sections.protocols && preview.sections.protocols.length > 0 && (
              <div className="pe-section">
                <span className="pe-section__label">{t("agents.section_protocols")}</span>
                <div className="pe-protocol-list">
                  {preview.sections.protocols.map((p) => (
                    <div key={p.name} className="pe-protocol-item">
                      <span className="pe-protocol-item__name">{p.name}</span>
                      <span className="pe-protocol-item__desc">{p.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {preview.sections.instructions && (
              <div className="pe-section">
                <span className="pe-section__label">{t("prompting.extra")}</span>
                <p className="pe-section__content">{preview.sections.instructions}</p>
              </div>
            )}
          </div>
        )}

        {preview && view_mode === "raw" && (
          <pre className="pe-raw">{preview.text}</pre>
        )}

        {preview?.error && (
          <div className="pe-preview__error">{preview.error}</div>
        )}
      </div>
    </div>
  );
}

// ── Main ProfileEditor component ─────────────────────────────────────────────

export function ProfileEditor({ form, available_protocols, onChange }: ProfileEditorProps) {
  const t = useT();

  const set = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) =>
    onChange({ ...form, [key]: value });

  const toggle_protocol = (protocol: string) => {
    const next = form.shared_protocols.includes(protocol)
      ? form.shared_protocols.filter((p) => p !== protocol)
      : [...form.shared_protocols, protocol];
    set("shared_protocols", next);
  };

  return (
    <div className="pe-layout">
      {/* Left: editor controls */}
      <div className="pe-editor">
        {/* Role Skill */}
        <div className="pe-field-group">
          <label className="pe-field-label" htmlFor="pe-role-skill">
            {t("agents.section_role")}
          </label>
          <select
            id="pe-role-skill"
            className="input"
            value={form.role_skill}
            onChange={(e) => set("role_skill", e.target.value)}
          >
            {ROLE_SKILLS.map((r) => (
              <option key={r} value={r}>
                {r || t("agents.role_custom")}
              </option>
            ))}
          </select>
          <span className="pe-field-hint">{t("profile.role_hint")}</span>
        </div>

        {/* Soul */}
        <div className="pe-field-group">
          <label className="pe-field-label" htmlFor="pe-soul">
            {t("prompting.soul")}
          </label>
          <textarea
            id="pe-soul"
            className="input"
            rows={3}
            value={form.soul}
            onChange={(e) => set("soul", e.target.value)}
            placeholder={t("agents.soul_placeholder")}
          />
          <span className="pe-field-hint">{t("prompting.soul_hint")}</span>
        </div>

        {/* Heart */}
        <div className="pe-field-group">
          <label className="pe-field-label" htmlFor="pe-heart">
            {t("prompting.heart")}
          </label>
          <textarea
            id="pe-heart"
            className="input"
            rows={3}
            value={form.heart}
            onChange={(e) => set("heart", e.target.value)}
            placeholder={t("agents.heart_placeholder")}
          />
          <span className="pe-field-hint">{t("prompting.heart_hint")}</span>
        </div>

        {/* Shared Protocols */}
        <div className="pe-field-group">
          <span className="pe-field-label">{t("agents.section_protocols")}</span>
          <div className="pe-protocol-checklist">
            {available_protocols.map((protocol) => {
              const checked = form.shared_protocols.includes(protocol);
              return (
                <label
                  key={protocol}
                  className={`pe-protocol-check${checked ? " pe-protocol-check--active" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle_protocol(protocol)}
                    aria-label={protocol}
                  />
                  <div className="pe-protocol-check__body">
                    <span className="pe-protocol-check__name">{protocol}</span>
                    {PROTOCOL_META[protocol] && (
                      <span className="pe-protocol-check__desc">
                        {PROTOCOL_META[protocol]}
                      </span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Extra Instructions */}
        <div className="pe-field-group">
          <label className="pe-field-label" htmlFor="pe-extra">
            {t("prompting.extra")}
          </label>
          <textarea
            id="pe-extra"
            className="input"
            rows={3}
            value={form.extra_instructions}
            onChange={(e) => set("extra_instructions", e.target.value)}
            placeholder={t("prompting.extra_ph")}
          />
        </div>
      </div>

      {/* Right: compile preview */}
      <div className="pe-preview-col">
        <CompilePreview form={form} />
      </div>
    </div>
  );
}
