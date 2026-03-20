/**
 * ToolChips: 선택된 도구 인라인 칩 카드 표시.
 * max_visible 초과 시 "+N more" 토글.
 */
import { useState } from "react";
import { useT } from "../../i18n";

export interface ToolChip {
  id: string;
  name: string;
  description?: string;
  server_name?: string;
}

export interface ToolChipsProps {
  tools: ToolChip[];
  onRemove: (id: string) => void;
  max_visible?: number;
  className?: string;
}

export function ToolChips({
  tools,
  onRemove,
  max_visible = 5,
  className,
}: ToolChipsProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  if (tools.length === 0) return null;

  const visible = expanded ? tools : tools.slice(0, max_visible);
  const overflow = tools.length - max_visible;

  return (
    <div className={`tool-chips${className ? ` ${className}` : ""}`}>
      {visible.map((tool) => (
        <span key={tool.id} className="tool-chips__chip">
          <span className="tool-chips__chip-icon" aria-hidden="true">&#x1F527;</span>
          <span className="tool-chips__chip-name">{tool.name}</span>
          {tool.server_name && (
            <span className="tool-chips__chip-server">{tool.server_name}</span>
          )}
          <button
            type="button"
            className="tool-chips__chip-remove"
            onClick={() => onRemove(tool.id)}
            aria-label={t("tool_chips.remove", { name: tool.name })}
          >
            &times;
          </button>
        </span>
      ))}

      {!expanded && overflow > 0 && (
        <button
          type="button"
          className="tool-chips__overflow"
          onClick={() => setExpanded(true)}
        >
          +{overflow} {t("tool_chips.more")}
        </button>
      )}

      {expanded && overflow > 0 && (
        <button
          type="button"
          className="tool-chips__overflow tool-chips__overflow--collapse"
          onClick={() => setExpanded(false)}
        >
          {t("tool_chips.collapse")}
        </button>
      )}
    </div>
  );
}
