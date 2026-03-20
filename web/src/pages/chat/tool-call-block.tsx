/** 스트리밍 중 도구 호출 및 thinking 시각화 — 진행 중 / 완료 / 오류 상태 표시. */

import { useState, useRef, useEffect } from "react";
import type { ToolCallEntry, ThinkingEntry } from "../../hooks/use-ndjson-stream";
import { useT } from "../../i18n";
import { RichResultRenderer } from "../../components/rich-result-renderer";

const ICONS: [RegExp, string][] = [
  [/^web_search|^search_web/, "🔍"],
  [/^web_fetch|^web_extract|^web_pdf|^web_snapshot/, "📄"],
  [/^web_browser|^web_form|^web_auth|^web_monitor|^web_table/, "🌐"],
  [/^screenshot/, "📸"],
  [/^canvas_render/, "🎨"],
  [/^diagram_render/, "📊"],
  [/^shell_exec|^exec/, "💻"],
  [/^git/, "📝"],
  [/^docker/, "🐋"],
  [/^read_file|^write_file|^list_dir|^search_files|^edit_file/, "📁"],
  [/^memory|^knowledge/, "🧠"],
  [/^send_message|^ask_user|^message/, "💬"],
  [/^cron/, "⏰"],
  [/^spawn/, "🤖"],
  [/^http_request|^oauth_fetch/, "🔗"],
  [/^database|^sql/, "🗃️"],
  [/^decision/, "⚖️"],
];

function tool_icon(name: string): string {
  for (const [re, icon] of ICONS) {
    if (re.test(name)) return icon;
  }
  return "🔧";
}

/** tool_name에서 action 부분 추출: "web_search" -> "search", "read_file" -> "read file". */
function parse_tool_action(name: string): { category: string; action: string } {
  const parts = name.split("_");
  if (parts.length <= 1) return { category: name, action: "" };
  return { category: parts[0]!, action: parts.slice(1).join(" ") };
}

/** Thinking 섹션 — 기본 접힘, 클릭 시 고정 높이 블록 표시. */
export function ThinkingBlockList({ blocks }: { blocks: ThinkingEntry[] }) {
  const [open, setOpen] = useState(false);
  const body_ref = useRef<HTMLDivElement>(null);
  const t = useT();

  // 스트리밍 중 새 블록 추가 시 펼쳐진 상태면 자동 스크롤
  useEffect(() => {
    if (open) {
      const el = body_ref.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [blocks.length, open]);

  if (blocks.length === 0) return null;

  const total_tokens = blocks.reduce((sum, b) => sum + b.tokens, 0);

  return (
    <div className="thinking-section">
      <button
        className="thinking-section__header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${t("chat.thinking_label")}: ${total_tokens.toLocaleString()} ${t("chat.tokens")}`}
      >
        <span className="thinking-section__icon" aria-hidden="true">💭</span>
        <span className="thinking-section__title">
          {t("chat.thinking_label")}
          {total_tokens > 0 && (
            <span className="thinking-section__tokens">
              ({total_tokens.toLocaleString()} {t("chat.tokens")})
            </span>
          )}
        </span>
        <span className="thinking-section__chevron" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="thinking-section__body" ref={body_ref}>
          {blocks.map((b, i) => (
            <pre
              key={`${i}-${b.tokens}`}
              className={`thinking-section__pre${i > 0 ? " thinking-section__pre--sep" : ""}`}
            >
              {b.preview || t("chat.no_preview")}
            </pre>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToolCallList({ calls }: { calls: ToolCallEntry[] }) {
  const scroll_ref = useRef<HTMLDivElement>(null);
  const done_count = calls.filter(c => c.done).length;
  const scroll_dep = calls.length + done_count;

  useEffect(() => {
    const el = scroll_ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scroll_dep]);

  if (calls.length === 0) return null;

  return (
    <div className="tool-call-list">
      <div className="tool-call-list__summary">
        <span className="tool-call-list__label">🔧 {calls.length}</span>
        {done_count > 0 && (
          <span className="tool-call-list__done">✓ {done_count}</span>
        )}
        {calls.length > done_count && (
          <span className="tool-call-list__running">
            <span className="tool-call__spinner" aria-hidden="true" />
            {calls.length - done_count}
          </span>
        )}
      </div>
      <div className="tool-call-list__scroll" ref={scroll_ref}>
        {calls.map((c) => (
          <ToolCallBlock key={c.id} entry={c} />
        ))}
      </div>
    </div>
  );
}

function ToolCallBlock({ entry }: { entry: ToolCallEntry }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(true);
  const status_cls = entry.done ? (entry.is_error ? "error" : "done") : "pending";
  const { category, action } = parse_tool_action(entry.name);

  return (
    <div className={`tool-call tool-call--${status_cls}`}>
      <button
        className="tool-call__header"
        onClick={() => entry.done && setExpanded((e) => !e)}
        style={{ cursor: entry.done ? "pointer" : "default" }}
        aria-expanded={entry.done ? expanded : undefined}
        aria-label={`${entry.name} ${entry.done ? (entry.is_error ? "failed" : "succeeded") : "running"}`}
      >
        <span className="tool-call__status-icon">
          {!entry.done
            ? <span className="tool-call__spinner" aria-hidden="true" />
            : entry.is_error
              ? <span className="tool-call__x" aria-hidden="true">✗</span>
              : <span className="tool-call__check" aria-hidden="true">✓</span>}
        </span>
        <span className="tool-call__icon" aria-hidden="true">{tool_icon(entry.name)}</span>
        <span className="tool-call__name">
          <span className="tool-call__category">{category}</span>
          {action && <span className="tool-call__action"> &gt; {action}</span>}
        </span>
        {entry.done && (
          <span className="tool-call__expand-icon" aria-hidden="true">{expanded ? "▲" : "▼"}</span>
        )}
      </button>

      {expanded && entry.done && (
        <div className="tool-call__detail">
          {/* Request (params) 접이식 패널 */}
          {entry.params && Object.keys(entry.params).length > 0 && (
            <section className="tool-call__section">
              <button
                className="tool-call__section-toggle"
                onClick={() => setRequestOpen((v) => !v)}
                aria-expanded={requestOpen}
                aria-label={t("tool_call.request")}
              >
                <span className="tool-call__section-label">{t("tool_call.request")}</span>
                <span className="tool-call__section-chevron" aria-hidden="true">{requestOpen ? "▲" : "▼"}</span>
              </button>
              {requestOpen && (
                <RichResultRenderer content={JSON.stringify(entry.params, null, 2)} kind="json" />
              )}
            </section>
          )}
          {/* Response (result) 접이식 패널 */}
          {entry.result && (
            <section className="tool-call__section">
              <button
                className="tool-call__section-toggle"
                onClick={() => setResponseOpen((v) => !v)}
                aria-expanded={responseOpen}
                aria-label={entry.is_error ? t("chat.tool_error") : t("tool_call.response")}
              >
                <span className="tool-call__section-label">
                  {entry.is_error ? t("chat.tool_error") : t("tool_call.response")}
                </span>
                <span className="tool-call__section-chevron" aria-hidden="true">{responseOpen ? "▲" : "▼"}</span>
              </button>
              {responseOpen && (
                <RichResultRenderer content={entry.display_text ?? entry.result} isError={entry.is_error} />
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
