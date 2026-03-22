/**
 * IC-8a: Rich Message Card — 구조화된 임베드 카드 컴포넌트.
 * RichPayload의 embeds 배열을 받아 필드 + 이미지 카드로 렌더링.
 * rich 없으면 null 반환 → 기존 ChatMessageBubble 흐름에 영향 없음.
 */

import type { RichEmbed, RichPayload } from "../../../../src/bus/types.js";

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

/* ── Public component ── */
export interface RichMessageCardProps {
  rich: RichPayload;
}

export function RichMessageCard({ rich }: RichMessageCardProps) {
  const embeds = Array.isArray(rich.embeds) ? rich.embeds : [];
  const attachments = Array.isArray(rich.attachments) ? rich.attachments : [];

  if (embeds.length === 0 && attachments.length === 0) return null;

  return (
    <div className="rich-message-card">
      {embeds.map((embed, i) => (
        <EmbedCard key={i} embed={embed} />
      ))}
      {attachments.length > 0 && <AttachmentList attachments={attachments} />}
    </div>
  );
}
