/**
 * ToolFeatureMenu (A3.1): + 버튼에서 열리는 통합 기능 메뉴.
 * 카테고리별 도구/워크플로우/에이전트 선택, 파일 첨부, MCP 서버 상태를 한 곳에서 관리.
 * MentionPicker와 동일 API 재사용 (캐시 공유).
 */
import { useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useClickOutside } from "../hooks/use-click-outside";
import type { MentionItem } from "./mention-picker";

interface McpServer {
  name: string;
  tools: Array<{ name: string; description?: string }>;
}

interface WorkflowDef {
  slug: string;
  name: string;
  objective?: string;
}

export interface ToolFeatureMenuProps {
  open: boolean;
  onClose: () => void;
  onAttach?: () => void;
  attached_items?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => void;
  onMentionRemove?: (id: string) => void;
}

type MenuSection = "main" | "workflows" | "tools" | "agents";

export function ToolFeatureMenu({
  open,
  onClose,
  onAttach,
  attached_items = [],
  onMentionSelect,
  onMentionRemove,
}: ToolFeatureMenuProps) {
  if (!open) return null;
  return (
    <ToolFeatureMenuInner
      onClose={onClose}
      onAttach={onAttach}
      attached_items={attached_items}
      onMentionSelect={onMentionSelect}
      onMentionRemove={onMentionRemove}
    />
  );
}

function ToolFeatureMenuInner({
  onClose,
  onAttach,
  attached_items,
  onMentionSelect,
  onMentionRemove,
}: Omit<ToolFeatureMenuProps, "open">) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<MenuSection>("main");
  const [search, setSearch] = useState("");

  useClickOutside(wrapRef, onClose, true);

  const { data: mcpRaw } = useQuery<{ servers: McpServer[] }>({
    queryKey: ["mention-mcp-servers"],
    queryFn: () => api.get<{ servers: McpServer[] }>("/api/mcp/servers"),
    staleTime: 30_000,
  });
  const mcpServers = mcpRaw?.servers ?? [];

  const { data: workflows = [] } = useQuery<WorkflowDef[]>({
    queryKey: ["mention-workflows"],
    queryFn: () => api.get<WorkflowDef[]>("/api/workflow/definitions"),
    staleTime: 30_000,
  });

  const toolItems: MentionItem[] = useMemo(
    () =>
      mcpServers.flatMap((server) =>
        server.tools.map((tool) => ({
          type: "tool" as const,
          id: `${server.name}/${tool.name}`,
          name: tool.name,
          description: tool.description,
        })),
      ),
    [mcpServers],
  );

  const workflowItems: MentionItem[] = useMemo(
    () =>
      workflows.map((wf) => ({
        type: "workflow" as const,
        id: wf.slug,
        name: wf.name,
        description: wf.objective,
      })),
    [workflows],
  );

  const attachedIds = useMemo(
    () => new Set((attached_items ?? []).map((i) => i.id)),
    [attached_items],
  );

  const searchLower = search.toLowerCase();

  const filterItems = (items: MentionItem[]) => {
    if (!searchLower) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(searchLower) ||
        (i.description?.toLowerCase().includes(searchLower) ?? false),
    );
  };

  const handleToggleItem = (item: MentionItem) => {
    if (attachedIds.has(item.id)) {
      onMentionRemove?.(item.id);
    } else {
      onMentionSelect?.(item);
    }
  };

  const renderItemList = (items: MentionItem[]) => {
    const filtered = filterItems(items);
    if (filtered.length === 0) {
      return <div className="tool-feature-menu__empty">{t("mention.no_results")}</div>;
    }
    return filtered.map((item) => (
      <button
        key={item.id}
        type="button"
        className={`tool-feature-menu__item${attachedIds.has(item.id) ? " tool-feature-menu__item--active" : ""}`}
        onClick={() => handleToggleItem(item)}
      >
        <span className="tool-feature-menu__item-name">{item.name}</span>
        {item.description && (
          <span className="tool-feature-menu__item-desc">{item.description}</span>
        )}
        {attachedIds.has(item.id) && (
          <span className="tool-feature-menu__item-check" aria-hidden="true">{"\u2713"}</span>
        )}
      </button>
    ));
  };

  if (section !== "main") {
    const items = section === "workflows" ? workflowItems
      : section === "tools" ? toolItems
      : (attached_items ?? []).filter((i) => i.type === "agent");

    return (
      <div ref={wrapRef} className="tool-feature-menu">
        <div className="tool-feature-menu__header">
          <button
            type="button"
            className="tool-feature-menu__back"
            onClick={() => { setSection("main"); setSearch(""); }}
            aria-label={t("common.back")}
          >
            {"\u2190"}
          </button>
          <span className="tool-feature-menu__header-title">
            {t(`tool_feature.${section}`)}
          </span>
        </div>
        <input
          className="tool-feature-menu__search"
          type="text"
          placeholder={t("mention.search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="tool-feature-menu__list">
          {renderItemList(items)}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="tool-feature-menu">
      <div className="tool-feature-menu__header">
        <span className="tool-feature-menu__header-title">{t("tool_feature.title")}</span>
      </div>
      <div className="tool-feature-menu__sections">
        {onAttach && (
          <button
            type="button"
            className="tool-feature-menu__section-btn"
            onClick={() => { onAttach(); onClose(); }}
          >
            <span className="tool-feature-menu__section-icon">{"\uD83D\uDCCE"}</span>
            <span className="tool-feature-menu__section-label">{t("chat.attach_file")}</span>
          </button>
        )}
        <button
          type="button"
          className="tool-feature-menu__section-btn"
          onClick={() => setSection("workflows")}
        >
          <span className="tool-feature-menu__section-icon">{"\u2699"}</span>
          <span className="tool-feature-menu__section-label">{t("tool_feature.workflows")}</span>
          <span className="tool-feature-menu__section-count">{workflowItems.length}</span>
        </button>
        <button
          type="button"
          className="tool-feature-menu__section-btn"
          onClick={() => setSection("tools")}
        >
          <span className="tool-feature-menu__section-icon">{"\uD83D\uDD27"}</span>
          <span className="tool-feature-menu__section-label">{t("tool_feature.tools")}</span>
          <span className="tool-feature-menu__section-count">{toolItems.length}</span>
        </button>
        {/* MCP 서버 상태 */}
        <div className="tool-feature-menu__mcp-status">
          <span className="tool-feature-menu__mcp-label">{t("tool_feature.mcp_servers")}</span>
          <span className="tool-feature-menu__mcp-count">
            {mcpServers.length} {t("tool_feature.connected")}
          </span>
        </div>
      </div>
    </div>
  );
}
