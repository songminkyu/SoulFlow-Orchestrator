/**
 * UnifiedSelector: 3탭 통합 선택기.
 * Agents | Tools (MCP + App) | Workflows.
 * 검색 debounce, 키보드 네비게이션, useClickOutside.
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

const DEBOUNCE_MS = 200;
const TABS = ["agents", "tools", "workflows"] as const;
type TabKey = (typeof TABS)[number];

function UnifiedSelectorInner({
  onClose,
  onSelect,
  className,
}: Omit<UnifiedSelectorProps, "open">) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabKey>("agents");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);
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

  const { data: workflows = [] } = useQuery<WorkflowDef[]>({
    queryKey: ["unified-selector-workflows"],
    queryFn: () => api.get<WorkflowDef[]>("/api/workflow/definitions"),
    staleTime: 30_000,
  });

  const agentItems: UnifiedSelectorItem[] = useMemo(
    () =>
      agents.map((a) => ({
        type: "agent" as const,
        id: a.slug,
        name: a.name,
        description: a.description,
      })),
    [agents],
  );

  const toolItems: UnifiedSelectorItem[] = useMemo(
    () =>
      (mcpRaw?.servers ?? []).flatMap((server) =>
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

  const workflowItems: UnifiedSelectorItem[] = useMemo(
    () =>
      workflows.map((wf) => ({
        type: "workflow" as const,
        id: wf.slug,
        name: wf.name,
        description: wf.objective,
      })),
    [workflows],
  );

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

  const filteredAgents = useMemo(() => filterItems(agentItems), [filterItems, agentItems]);
  const filteredTools = useMemo(() => filterItems(toolItems), [filterItems, toolItems]);
  const filteredWorkflows = useMemo(() => filterItems(workflowItems), [filterItems, workflowItems]);

  const currentItems = useMemo(() => {
    if (activeTab === "agents") return filteredAgents;
    if (activeTab === "tools") return filteredTools;
    return filteredWorkflows;
  }, [activeTab, filteredAgents, filteredTools, filteredWorkflows]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, currentItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusIdx >= 0 && focusIdx < currentItems.length) {
      e.preventDefault();
      const item = currentItems[focusIdx];
      if (item) onSelect(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const TAB_LABELS: Record<TabKey, string> = {
    agents: t("unified_selector.tab_agents"),
    tools: t("unified_selector.tab_tools"),
    workflows: t("unified_selector.tab_workflows"),
  };

  const EMPTY_MSGS: Record<TabKey, string> = {
    agents: t("unified_selector.no_agents"),
    tools: t("unified_selector.no_tools"),
    workflows: t("unified_selector.no_workflows"),
  };

  return (
    <div
      ref={wrapRef}
      className={`unified-selector${className ? ` ${className}` : ""}`}
      role="dialog"
      aria-label={t("unified_selector.label")}
    >
      <input
        ref={searchRef}
        className="unified-selector__search"
        type="text"
        placeholder={t("unified_selector.search_placeholder")}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setFocusIdx(-1);
        }}
        onKeyDown={handleKeyDown}
        aria-label={t("unified_selector.search_placeholder")}
      />

      <div className="unified-selector__tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`unified-selector__tab${activeTab === tab ? " unified-selector__tab--active" : ""}`}
            onClick={() => { setActiveTab(tab); setFocusIdx(-1); }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="unified-selector__list" role="listbox">
        {currentItems.length === 0 && (
          <div className="unified-selector__empty">{EMPTY_MSGS[activeTab]}</div>
        )}
        {currentItems.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={i === focusIdx}
            className={`unified-selector__item${i === focusIdx ? " unified-selector__item--focused" : ""}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setFocusIdx(i)}
          >
            <span className="unified-selector__item-icon" aria-hidden="true">
              {item.type === "agent" && "\u{1F916}"}
              {(item.type === "mcp-tool" || item.type === "app-tool") && "\u{1F527}"}
              {item.type === "workflow" && "\u{26A1}"}
            </span>
            <span className="unified-selector__item-body">
              <span className="unified-selector__item-name">{item.name}</span>
              {item.server_name && (
                <span className="unified-selector__item-server">{item.server_name}</span>
              )}
              {item.description && (
                <span className="unified-selector__item-desc">{item.description}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function UnifiedSelector({ open, ...rest }: UnifiedSelectorProps) {
  if (!open) return null;
  return <UnifiedSelectorInner {...rest} />;
}
