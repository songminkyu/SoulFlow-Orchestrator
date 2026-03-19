/**
 * MentionPicker: @ 입력 시 표시되는 3컬럼 드롭다운.
 * Agents | MCP Tools + App Tools | Workflows 컬럼.
 * 검색 입력 (debounce), 키보드 네비게이션 (ArrowUp/Down/Enter/Escape).
 */
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useClickOutside } from "../hooks/use-click-outside";

export interface MentionItem {
  type: "agent" | "tool" | "workflow";
  id: string;
  name: string;
  description?: string;
}

interface McpServer {
  name: string;
  tools: Array<{ name: string; description?: string }>;
}

interface WorkflowDef {
  id: string;
  name: string;
  description?: string;
}

export interface MentionPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MentionItem) => void;
  /** 에이전트 목록 (외부 주입). 미제공 시 빈 배열. */
  agents?: MentionItem[];
  className?: string;
}

const DEBOUNCE_MS = 200;

/**
 * 내부 구현. open=true일 때만 mount되므로 상태가 자동 초기화됨.
 * open/close 전환 시 setState 없이 깨끗한 상태로 시작.
 */
function MentionPickerInner({ onClose, onSelect, agents = [], className }: Omit<MentionPickerProps, "open">) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useClickOutside(wrapRef, onClose, true);

  // debounce 검색어
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // mount 시 포커스
  useEffect(() => {
    const timer = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, []);

  // MCP 도구 목록 fetch
  const { data: mcpServers = [] } = useQuery<McpServer[]>({
    queryKey: ["mention-mcp-servers"],
    queryFn: () => api.get<McpServer[]>("/api/mcp/servers"),
    staleTime: 30_000,
  });

  // 워크플로우 목록 fetch
  const { data: workflows = [] } = useQuery<WorkflowDef[]>({
    queryKey: ["mention-workflows"],
    queryFn: () => api.get<WorkflowDef[]>("/api/workflow/definitions"),
    staleTime: 30_000,
  });

  // MCP 도구를 MentionItem으로 변환
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

  // 워크플로우를 MentionItem으로 변환
  const workflowItems: MentionItem[] = useMemo(
    () =>
      workflows.map((wf) => ({
        type: "workflow" as const,
        id: wf.id,
        name: wf.name,
        description: wf.description,
      })),
    [workflows],
  );

  // 필터링
  const filterByQuery = useCallback(
    (items: MentionItem[]): MentionItem[] => {
      if (!debouncedQuery) return items;
      const q = debouncedQuery.toLowerCase();
      return items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false),
      );
    },
    [debouncedQuery],
  );

  const filteredAgents = useMemo(() => filterByQuery(agents), [filterByQuery, agents]);
  const filteredTools = useMemo(() => filterByQuery(toolItems), [filterByQuery, toolItems]);
  const filteredWorkflows = useMemo(() => filterByQuery(workflowItems), [filterByQuery, workflowItems]);

  // 전체 flat 리스트 (키보드 네비게이션용)
  const allItems = useMemo(
    () => [...filteredAgents, ...filteredTools, ...filteredWorkflows],
    [filteredAgents, filteredTools, filteredWorkflows],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusIdx >= 0 && focusIdx < allItems.length) {
      e.preventDefault();
      const item = allItems[focusIdx];
      if (item) onSelect(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const renderColumn = (title: string, items: MentionItem[], offsetBase: number) => (
    <div className="mention-picker__column">
      <div className="mention-picker__column-title">{title}</div>
      {items.length === 0 && (
        <div className="mention-picker__no-results">{t("mention.no_results")}</div>
      )}
      {items.map((item, i) => {
        const globalIdx = offsetBase + i;
        return (
          <button
            key={item.id}
            type="button"
            className={`mention-picker__item${globalIdx === focusIdx ? " mention-picker__item--focus" : ""}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setFocusIdx(globalIdx)}
            aria-selected={globalIdx === focusIdx}
            role="option"
          >
            <span className="mention-picker__item-name">{item.name}</span>
            {item.description && (
              <span className="mention-picker__item-desc">{item.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className={`mention-picker${className ? ` ${className}` : ""}`}
      role="listbox"
      aria-label={t("mention.search_placeholder")}
    >
      <input
        ref={searchRef}
        className="mention-picker__search"
        type="text"
        placeholder={t("mention.search_placeholder")}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setFocusIdx(-1); }}
        onKeyDown={handleKeyDown}
        aria-label={t("mention.search_placeholder")}
      />
      <div className="mention-picker__columns">
        {renderColumn(t("mention.agents"), filteredAgents, 0)}
        {renderColumn(t("mention.tools"), filteredTools, filteredAgents.length)}
        {renderColumn(
          t("mention.workflows"),
          filteredWorkflows,
          filteredAgents.length + filteredTools.length,
        )}
      </div>
    </div>
  );
}

export function MentionPicker({ open, ...rest }: MentionPickerProps) {
  if (!open) return null;
  return <MentionPickerInner {...rest} />;
}
