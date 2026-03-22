/**
 * UnifiedSelector: 멀티컬럼 그리드 선택기.
 * 레퍼런스: samples/better-chatbot-feature4.png
 *
 * 4섹션 동시 표시:
 *   Agents    | MCP Tools | App Tools
 *   Workflows |           |
 *
 * 통합 검색바, 키보드 네비게이션, useClickOutside.
 */
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useT } from "../../i18n";
import { useClickOutside } from "../../hooks/use-click-outside";

export interface UnifiedSelectorItem {
  type: "agent" | "mcp-tool" | "app-tool" | "workflow";
  id: string;
  name: string;
  description?: string;
  server_name?: string;
}

export interface UnifiedSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: UnifiedSelectorItem) => void;
  className?: string;
}

interface AgentDefinition {
  slug: string;
  name: string;
  description?: string;
}

interface McpServer {
  name: string;
  tools: Array<{ name: string; description?: string }>;
}

interface WorkflowDef {
  slug: string;
  name: string;
  objective?: string;
}

interface ToolsResponse {
  names: string[];
  definitions: Record<string, { name: string; description?: string }>;
  mcp_servers: string[];
  native_tools: string[];
}

const DEBOUNCE_MS = 200;

/** 아이콘 매핑 — App Tools 용 */
const APP_TOOL_ICONS: Record<string, string> = {
  "pie-chart": "📊", "bar-chart": "📊", "line-chart": "📈",
  table: "📋", "web-search": "🌐", "web-content": "🌐",
  HTTP: "🔗", http: "🔗", code: "💻",
};

function UnifiedSelectorInner({
  onClose,
  onSelect,
  className,
}: Omit<UnifiedSelectorProps, "open">) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useClickOutside(wrapRef, onClose, true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  /* ── Data Sources ── */

  const { data: agents = [] } = useQuery<AgentDefinition[]>({
    queryKey: ["unified-selector-agents"],
    queryFn: () => api.get<AgentDefinition[]>("/api/agent-definitions"),
    staleTime: 30_000,
  });

  const { data: mcpRaw } = useQuery<{ servers: McpServer[] }>({
    queryKey: ["unified-selector-mcp"],
    queryFn: () => api.get<{ servers: McpServer[] }>("/api/mcp/servers"),
    staleTime: 30_000,
  });

  const { data: toolsRaw } = useQuery<ToolsResponse>({
    queryKey: ["unified-selector-app-tools"],
    queryFn: () => api.get<ToolsResponse>("/api/tools"),
    staleTime: 30_000,
  });

  const { data: workflows = [] } = useQuery<WorkflowDef[]>({
    queryKey: ["unified-selector-workflows"],
    queryFn: () => api.get<WorkflowDef[]>("/api/workflow/definitions"),
    staleTime: 30_000,
  });

  /* ── Derived Items ── */

  const agentItems: UnifiedSelectorItem[] = useMemo(
    () => agents.map((a) => ({ type: "agent" as const, id: a.slug, name: a.name, description: a.description })),
    [agents],
  );

  const mcpToolItems: UnifiedSelectorItem[] = useMemo(
    () => (mcpRaw?.servers ?? []).flatMap((server) =>
      server.tools.map((tool) => ({
        type: "mcp-tool" as const,
        id: `${server.name}/${tool.name}`,
        name: tool.name,
        description: tool.description,
        server_name: server.name,
      })),
    ),
    [mcpRaw],
  );

  const mcpServerNames = useMemo(() => new Set(mcpRaw?.servers?.map((s) => s.name) ?? []), [mcpRaw]);

  const appToolItems: UnifiedSelectorItem[] = useMemo(() => {
    if (!toolsRaw) return [];
    // native_tools + definitions에서 MCP 서버 도구를 제외한 앱 내장 도구
    const native = toolsRaw.native_tools ?? [];
    const defs = toolsRaw.definitions ?? {};
    const appNames = Object.keys(defs).filter((n) => !mcpServerNames.has(n.split("/")[0] ?? n));
    const allNames = [...new Set([...native, ...appNames])];
    return allNames.map((name) => ({
      type: "app-tool" as const,
      id: name,
      name: defs[name]?.name ?? name,
      description: defs[name]?.description,
    }));
  }, [toolsRaw, mcpServerNames]);

  const workflowItems: UnifiedSelectorItem[] = useMemo(
    () => workflows.map((wf) => ({ type: "workflow" as const, id: wf.slug, name: wf.name, description: wf.objective })),
    [workflows],
  );

  /* ── Search Filter ── */

  const filterItems = useCallback(
    (items: UnifiedSelectorItem[]): UnifiedSelectorItem[] => {
      if (!debouncedQuery) return items;
      const q = debouncedQuery.toLowerCase();
      return items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false) ||
          (item.server_name?.toLowerCase().includes(q) ?? false),
      );
    },
    [debouncedQuery],
  );

  const fAgents = useMemo(() => filterItems(agentItems), [filterItems, agentItems]);
  const fMcpTools = useMemo(() => filterItems(mcpToolItems), [filterItems, mcpToolItems]);
  const fAppTools = useMemo(() => filterItems(appToolItems), [filterItems, appToolItems]);
  const fWorkflows = useMemo(() => filterItems(workflowItems), [filterItems, workflowItems]);

  /* ── Keyboard ── */

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div
      ref={wrapRef}
      className={`unified-selector${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-label={t("unified_selector.label")}
    >
      {/* 통합 검색 */}
      <input
        ref={searchRef}
        className="unified-selector__search"
        type="text"
        placeholder={t("unified_selector.search_placeholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={t("unified_selector.search_placeholder")}
      />

      {/* 멀티컬럼 그리드 — 레퍼런스: feature4.png */}
      <div className="unified-selector__grid">
        {/* 좌측: Agents + Workflows */}
        <div className="unified-selector__column">
          <div className="unified-selector__section-label">{t("unified_selector.tab_agents")}</div>
          {fAgents.length === 0 ? (
            <div className="unified-selector__empty">{t("unified_selector.no_agents")}</div>
          ) : (
            fAgents.map((item) => (
              <SelectorItem key={item.id} item={item} icon="🤖" onSelect={onSelect} />
            ))
          )}

          <div className="unified-selector__section-label unified-selector__section-label--mt">
            {t("unified_selector.tab_workflows")}
          </div>
          {fWorkflows.length === 0 ? (
            <div className="unified-selector__empty">{t("unified_selector.no_workflows")}</div>
          ) : (
            fWorkflows.map((item) => (
              <SelectorItem key={item.id} item={item} icon="⚡" onSelect={onSelect} />
            ))
          )}
        </div>

        {/* 중앙: MCP Tools */}
        <div className="unified-selector__column">
          <div className="unified-selector__section-label">MCP Tools</div>
          {fMcpTools.length === 0 ? (
            <div className="unified-selector__empty">{t("unified_selector.no_tools")}</div>
          ) : (
            fMcpTools.map((item) => (
              <SelectorItem key={item.id} item={item} icon="🔧" onSelect={onSelect} />
            ))
          )}
        </div>

        {/* 우측: App Tools */}
        <div className="unified-selector__column">
          <div className="unified-selector__section-label">App Tools</div>
          {fAppTools.length === 0 ? (
            <div className="unified-selector__empty">{t("unified_selector.no_tools")}</div>
          ) : (
            fAppTools.map((item) => (
              <SelectorItem
                key={item.id}
                item={item}
                icon={APP_TOOL_ICONS[item.name] ?? "🔧"}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** 개별 아이템 — 컴팩트 (아이콘 + 이름만 표시) */
function SelectorItem({
  item,
  icon,
  onSelect,
}: {
  item: UnifiedSelectorItem;
  icon: string;
  onSelect: (item: UnifiedSelectorItem) => void;
}) {
  return (
    <button
      type="button"
      role="option"
      className="unified-selector__item"
      onClick={() => onSelect(item)}
    >
      <span className="unified-selector__item-icon" aria-hidden="true">{icon}</span>
      <span className="unified-selector__item-name">{item.name}</span>
    </button>
  );
}

export function UnifiedSelector({ open, ...rest }: UnifiedSelectorProps) {
  if (!open) return null;
  return <UnifiedSelectorInner {...rest} />;
}
