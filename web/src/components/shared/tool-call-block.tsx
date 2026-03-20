/**
 * ToolCallBlock (shared) — MCP 도구 실행 블록.
 * 헤더: 아이콘 + tool_name > action + 상태 뱃지 + 소요 시간.
 * 본문: Request / Response JSON 접이식 패널 (기본 접힘).
 */

import { useState } from "react";
import { useT } from "../../i18n";
import { StatusBadge } from "./status-badges";

export interface ToolCallBlockProps {
  tool_name: string;
  action?: string;
  request?: string;   // JSON string
  response?: string;  // JSON string
  status: "running" | "success" | "error";
  duration_ms?: number;
  className?: string;
}

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

function fmt_duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function JsonPanel({ label, json, default_open = false }: { label: string; json: string; default_open?: boolean }) {
  const [open, set_open] = useState(default_open);
  let formatted = json;
  try {
    formatted = JSON.stringify(JSON.parse(json), null, 2);
  } catch { /* leave as-is */ }

  return (
    <section className="tool-call-block__section">
      <button
        className="tool-call-block__section-toggle"
        onClick={() => set_open((v) => !v)}
        aria-expanded={open}
        aria-label={label}
      >
        <span className="tool-call-block__section-label">{label}</span>
        <span className="tool-call-block__section-chevron" aria-hidden="true">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <pre className="tool-call-block__json">{formatted}</pre>
      )}
    </section>
  );
}

export function ToolCallBlock({
  tool_name,
  action,
  request,
  response,
  status,
  duration_ms,
  className,
}: ToolCallBlockProps) {
  const t = useT();
  const [expanded, set_expanded] = useState(false);
  const can_expand = status !== "running" && (!!request || !!response);

  const status_variant = status === "success" ? "ok" : status === "error" ? "err" : "info";
  const status_label =
    status === "running" ? t("tool_call.running") || "running" :
    status === "success" ? t("tool_call.success") || "done" :
    t("tool_call.error") || "error";

  return (
    <div className={`tool-call-block tool-call-block--${status}${className ? ` ${className}` : ""}`}>
      <button
        className="tool-call-block__header"
        onClick={() => can_expand && set_expanded((e) => !e)}
        style={{ cursor: can_expand ? "pointer" : "default" }}
        aria-expanded={can_expand ? expanded : undefined}
        aria-label={`${tool_name}${action ? ` ${action}` : ""} ${status}`}
      >
        {/* Status icon / spinner */}
        <span className="tool-call-block__status-icon" aria-hidden="true">
          {status === "running" ? (
            <span className="tool-call__spinner" />
          ) : status === "success" ? (
            <span className="tool-call-block__check">✓</span>
          ) : (
            <span className="tool-call-block__x">✗</span>
          )}
        </span>

        {/* Tool icon */}
        <span className="tool-call-block__icon" aria-hidden="true">
          {tool_icon(tool_name)}
        </span>

        {/* Name + action */}
        <span className="tool-call-block__name">
          <span className="tool-call-block__tool-name">{tool_name}</span>
          {action && (
            <span className="tool-call-block__action"> &gt; {action}</span>
          )}
        </span>

        {/* Status badge */}
        <StatusBadge variant={status_variant} label={status_label} size="sm" />

        {/* Duration */}
        {duration_ms != null && (
          <span className="tool-call-block__duration">{fmt_duration(duration_ms)}</span>
        )}

        {/* Expand chevron */}
        {can_expand && (
          <span className="tool-call-block__chevron" aria-hidden="true">
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </button>

      {expanded && can_expand && (
        <div className="tool-call-block__body">
          {request && (
            <JsonPanel
              label={t("tool_call.request")}
              json={request}
              default_open={false}
            />
          )}
          {response && (
            <JsonPanel
              label={status === "error" ? (t("chat.tool_error") || "Error") : t("tool_call.response")}
              json={response}
              default_open={true}
            />
          )}
        </div>
      )}
    </div>
  );
}
