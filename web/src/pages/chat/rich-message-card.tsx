/**
 * IC-8a/IC-8b: Rich Message Card — 구조화된 임베드 카드 + 인터랙티브 버튼.
 * RichPayload의 embeds 배열을 받아 필드 + 이미지 카드로 렌더링하고,
 * actions 배열이 있으면 클릭 가능한 버튼을 렌더링하여 POST /api/approvals/:id/resolve 호출.
 * rich 없으면 null 반환 → 기존 ChatMessageBubble 흐름에 영향 없음.
 */

import { useState } from "react";
import type { RichAction, RichEmbed, RichPayload } from "../../../../src/bus/types.js";

/* ── Color strip mapping ── */
const COLOR_VAR: Record<string, string> = {
  green:  "var(--ok)",
  yellow: "var(--warn)",
  red:    "var(--err)",
  blue:   "var(--accent)",
};

function resolve_color(color: string | undefined): string {
  if (!color) return "var(--accent)";
  const named = COLOR_VAR[color.toLowerCase()];
  if (named) return named;
  // hex passthrough
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  return "var(--accent)";
}

/* ── Single embed card ── */
interface EmbedCardProps {
  embed: RichEmbed;
}

function EmbedCard({ embed }: EmbedCardProps) {
  const strip_color = resolve_color(embed.color);

  return (
    <div className="rich-card">
      {/* Left color strip */}
      <div className="rich-card__strip" style={{ background: strip_color }} aria-hidden="true" />

      <div className="rich-card__body">
        {/* Header row: thumbnail + title */}
        <div className="rich-card__header">
          {embed.thumbnail_url && (
            <img
              className="rich-card__thumbnail"
              src={embed.thumbnail_url}
              alt={embed.title || "thumbnail"}
              loading="lazy"
            />
          )}
          <div className="rich-card__header-text">
            {embed.title && (
              <div className="rich-card__title">{embed.title}</div>
            )}
            {embed.description && (
              <div className="rich-card__description">{embed.description}</div>
            )}
          </div>
        </div>

        {/* Fields grid */}
        {Array.isArray(embed.fields) && embed.fields.length > 0 && (
          <div className="rich-card__fields">
            {embed.fields.map((f, i) => (
              <div
                key={i}
                className={`rich-card__field${f.inline !== false ? " rich-card__field--inline" : ""}`}
              >
                <div className="rich-card__field-name">{f.name}</div>
                <div className="rich-card__field-value">{f.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Full-width image */}
        {embed.image_url && (
          <img
            className="rich-card__image"
            src={embed.image_url}
            alt={embed.title || "image"}
            loading="lazy"
          />
        )}

        {/* Footer */}
        {embed.footer && (
          <div className="rich-card__footer">{embed.footer}</div>
        )}
      </div>
    </div>
  );
}

/* ── Attachment list ── */
interface AttachmentListProps {
  attachments: NonNullable<RichPayload["attachments"]>;
}

function AttachmentList({ attachments }: AttachmentListProps) {
  if (attachments.length === 0) return null;
  return (
    <div className="rich-attachments">
      {attachments.map((a, i) => {
        const label = a.name || a.url.split("/").pop() || "attachment";
        return (
          <a
            key={i}
            className="rich-attachment"
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="rich-attachment__icon" aria-hidden="true">
              {a.mime?.startsWith("image/") ? "🖼" : a.mime?.startsWith("video/") ? "🎬" : "📎"}
            </span>
            <span className="rich-attachment__name">{label}</span>
          </a>
        );
      })}
    </div>
  );
}

/* ── IC-8b: Action button row ── */
interface ActionBarProps {
  actions: RichAction[];
  /** approval request_id extracted from payload or id field. */
  approval_id: string | null;
}

type ActionState = "idle" | "loading" | "done" | "error";

function ActionBar({ actions, approval_id }: ActionBarProps) {
  const [state, set_state] = useState<ActionState>("idle");
  const [active_id, set_active_id] = useState<string | null>(null);
  const [error_msg, set_error_msg] = useState<string>("");

  if (actions.length === 0) return null;

  async function handle_click(action: RichAction) {
    if (state !== "idle") return;

    // Resolve approval_id: prefer explicit approval_id prop,
    // then fall back to action.payload.approval_id or action.payload.request_id.
    const req_id = approval_id
      ?? action.payload?.["approval_id"]
      ?? action.payload?.["request_id"]
      ?? null;

    if (!req_id) {
      // No approval context — mark done without POST
      set_active_id(action.id);
      set_state("done");
      return;
    }

    set_active_id(action.id);
    set_state("loading");
    set_error_msg("");

    try {
      const resp = await fetch(`/api/approvals/${encodeURIComponent(req_id)}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: action.id }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as Record<string, unknown>;
        set_error_msg(String(body.error || `HTTP ${resp.status}`));
        set_state("error");
      } else {
        set_state("done");
      }
    } catch (err) {
      set_error_msg(err instanceof Error ? err.message : "network_error");
      set_state("error");
    }
  }

  const is_busy = state === "loading";
  const is_resolved = state === "done";

  return (
    <div className="rich-actions" role="group" aria-label="Actions">
      {actions.map((action) => {
        const is_active = active_id === action.id;
        const btn_state: ActionState = is_active ? state : "idle";
        const style_class = `rich-action-btn rich-action-btn--${action.style}`;
        const status_class = btn_state !== "idle" ? ` rich-action-btn--${btn_state}` : "";
        const disabled = is_busy || is_resolved;

        return (
          <button
            key={action.id}
            type="button"
            className={`${style_class}${status_class}`}
            disabled={disabled}
            aria-busy={btn_state === "loading"}
            aria-pressed={is_active && is_resolved ? true : undefined}
            onClick={() => { void handle_click(action); }}
          >
            {is_active && btn_state === "loading" ? (
              <span className="rich-action-btn__spinner" aria-hidden="true" />
            ) : null}
            <span className="rich-action-btn__label">{action.label}</span>
          </button>
        );
      })}
      {state === "error" && (
        <span className="rich-actions__error" role="alert">{error_msg}</span>
      )}
    </div>
  );
}

/* ── Public component ── */
export interface RichMessageCardProps {
  rich: RichPayload;
  /** IC-8b: approval request_id to forward to POST /api/approvals/:id/resolve */
  approval_id?: string;
}

export function RichMessageCard({ rich, approval_id }: RichMessageCardProps) {
  const embeds = Array.isArray(rich.embeds) ? rich.embeds : [];
  const attachments = Array.isArray(rich.attachments) ? rich.attachments : [];
  const actions = Array.isArray(rich.actions) ? rich.actions : [];

  if (embeds.length === 0 && attachments.length === 0 && actions.length === 0) return null;

  return (
    <div className="rich-message-card">
      {embeds.map((embed, i) => (
        <EmbedCard key={i} embed={embed} />
      ))}
      {attachments.length > 0 && <AttachmentList attachments={attachments} />}
      {actions.length > 0 && (
        <ActionBar
          actions={actions}
          approval_id={approval_id ?? null}
        />
      )}
    </div>
  );
}
