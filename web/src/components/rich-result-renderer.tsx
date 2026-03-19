/**
 * RichResultRenderer -- content-type 감지 기반 리치 렌더링.
 * 텍스트(마크다운), JSON/테이블, 이미지, 코드 구문 강조를 지원.
 */

import { useState, useMemo } from "react";
import { useT } from "../i18n";

/** content-type 감지 결과. */
export type ContentKind = "json" | "image" | "code" | "text";

const IMAGE_RE = /^https?:\/\/.*\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?[^"]*)?$/i;
const JSON_START_RE = /^\s*[[{]/;
const CODE_FENCE_RE = /^```[\s\S]*```\s*$/s;

/** 문자열의 content-type을 추정. */
export function detect_content_kind(content: string): ContentKind {
  const trimmed = content.trim();
  if (IMAGE_RE.test(trimmed)) return "image";
  if (JSON_START_RE.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch { /* not valid JSON */ }
  }
  if (CODE_FENCE_RE.test(trimmed)) return "code";
  return "text";
}

/** JSON 값을 포매팅하여 접기/펼치기 가능하게 렌더링. */
function JsonRenderer({ content }: { content: string }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const parsed = useMemo(() => {
    try { return JSON.parse(content.trim()); }
    catch { return null; }
  }, [content]);

  if (parsed === null) return <pre className="rich-result__pre">{content}</pre>;

  const formatted = JSON.stringify(parsed, null, 2);
  const lines = formatted.split("\n");
  const is_long = lines.length > 12;

  return (
    <div className="rich-result__json">
      <div className="rich-result__json-toolbar">
        <span className="rich-result__json-badge">JSON</span>
        {is_long && (
          <button
            className="btn btn--xs btn--ghost"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={expanded ? t("tool_call.collapse") : t("tool_call.expand")}
          >
            {expanded ? t("tool_call.collapse") : t("tool_call.expand")}
          </button>
        )}
      </div>
      <pre className="rich-result__pre rich-result__pre--json">
        {is_long && !expanded ? lines.slice(0, 12).join("\n") + "\n..." : formatted}
      </pre>
    </div>
  );
}

/** 이미지 URL을 인라인 프리뷰 + 확대 버튼으로 렌더링. */
function ImageRenderer({ content }: { content: string }) {
  const t = useT();
  const [zoomed, setZoomed] = useState(false);
  const url = content.trim();

  return (
    <div className="rich-result__image">
      <img
        src={url}
        alt={t("tool_call.image_result")}
        className={`rich-result__img${zoomed ? " rich-result__img--zoomed" : ""}`}
        onClick={() => setZoomed((v) => !v)}
        loading="lazy"
      />
      <button
        className="btn btn--xs btn--ghost rich-result__zoom-btn"
        onClick={() => setZoomed((v) => !v)}
        aria-label={zoomed ? t("tool_call.collapse") : t("tool_call.expand")}
      >
        {zoomed ? "⊖" : "⊕"}
      </button>
    </div>
  );
}

/** 코드 펜스 블록의 언어 + 본문을 추출하여 구문 강조 렌더링. */
function CodeRenderer({ content }: { content: string }) {
  const trimmed = content.trim();
  // ```lang\n...\n```
  const match = trimmed.match(/^```(\w+)?\n([\s\S]*)\n```$/);
  const lang = match?.[1] ?? "";
  const body = match?.[2] ?? trimmed.replace(/^```\n?/, "").replace(/\n?```$/, "");

  return (
    <div className="rich-result__code">
      {lang && <span className="rich-result__code-lang">{lang}</span>}
      <pre className="rich-result__pre rich-result__pre--code"><code>{body}</code></pre>
    </div>
  );
}

/** 일반 텍스트를 줄바꿈 보존하여 렌더링. */
function TextRenderer({ content, truncateAt }: { content: string; truncateAt?: number }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const is_long = truncateAt != null && content.length > truncateAt;

  const display = is_long && !expanded
    ? content.slice(0, truncateAt) + `\n... (${t("tool_call.truncated", { count: String(content.length - truncateAt) })})`
    : content;

  return (
    <div className="rich-result__text">
      <pre className="rich-result__pre">{display}</pre>
      {is_long && (
        <button
          className="btn btn--xs btn--ghost"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? t("tool_call.collapse") : t("tool_call.expand")}
        >
          {expanded ? t("tool_call.collapse") : t("tool_call.expand")}
        </button>
      )}
    </div>
  );
}

export interface RichResultRendererProps {
  content: string;
  /** content-type 힌트 (미제공 시 자동 감지). */
  kind?: ContentKind;
  /** 텍스트 모드에서 잘리는 길이 (기본 1200). */
  truncateAt?: number;
  /** 에러 스타일 적용. */
  isError?: boolean;
}

/** content-type 감지 후 적절한 렌더러를 선택. */
export function RichResultRenderer({ content, kind, truncateAt = 1200, isError }: RichResultRendererProps) {
  const detected = kind ?? detect_content_kind(content);

  return (
    <div className={`rich-result${isError ? " rich-result--error" : ""}`}>
      {detected === "json" && <JsonRenderer content={content} />}
      {detected === "image" && <ImageRenderer content={content} />}
      {detected === "code" && <CodeRenderer content={content} />}
      {detected === "text" && <TextRenderer content={content} truncateAt={truncateAt} />}
    </div>
  );
}
