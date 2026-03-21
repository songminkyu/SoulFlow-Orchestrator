/**
 * EndpointSelector: 모델/에이전트/워크플로우 통합 드롭다운.
 * provider별 그룹핑, 검색, 모델+에이전트+워크플로우 통합 목록.
 */
import { useState, useRef, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useT } from "../../i18n";
import { useClickOutside } from "../../hooks/use-click-outside";

export type EndpointType = "model" | "agent" | "workflow";

export interface Endpoint {
  type: EndpointType;
  id: string;
  label: string;
  provider?: string;
}

export interface EndpointSelectorProps {
  value: Endpoint | null;
  onChange: (ep: Endpoint) => void;
  className?: string;
}

interface ProviderInfo {
  instance_id: string;
  label: string;
  provider_type: string;
  available: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
  purpose: string;
}

interface AgentDefinition {
  slug: string;
  name: string;
  description?: string;
}

interface WorkflowDef {
  slug: string;
  name: string;
  objective?: string;
}

export function EndpointSelector({ value, onChange, className }: EndpointSelectorProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapRef, () => setOpen(false), open);

  const { data: providers = [] } = useQuery<ProviderInfo[]>({
    queryKey: ["endpoint-selector-providers"],
    queryFn: () => api.get<ProviderInfo[]>("/api/agents/providers"),
    staleTime: 30_000,
  });

  const { data: agents = [] } = useQuery<AgentDefinition[]>({
    queryKey: ["endpoint-selector-agents"],
    queryFn: () => api.get<AgentDefinition[]>("/api/agent-definitions"),
    staleTime: 30_000,
    enabled: open,
  });

  const { data: workflows = [] } = useQuery<WorkflowDef[]>({
    queryKey: ["endpoint-selector-workflows"],
    queryFn: () => api.get<WorkflowDef[]>("/api/workflow/definitions"),
    staleTime: 30_000,
    enabled: open,
  });

  const availableProviders = useMemo(
    () => providers.filter((p) => p.available !== false),
    [providers],
  );

  const modelQueryResults = useQueries({
    queries: availableProviders.map((p) => ({
      queryKey: ["endpoint-selector-models", p.instance_id],
      queryFn: () =>
        api.get<ModelInfo[]>(
          `/api/agents/providers/${encodeURIComponent(p.instance_id)}/models`,
        ),
      enabled: open,
      staleTime: 30_000,
    })),
  });

  const searchLower = search.toLowerCase();

  const matchesSearch = (text: string) =>
    !searchLower || text.toLowerCase().includes(searchLower);

  const handleSelect = (ep: Endpoint) => {
    onChange(ep);
    setSearch("");
    setOpen(false);
  };

  const triggerLabel = value?.label ?? t("endpoint_selector.select");

  return (
    <div
      ref={wrapRef}
      className={`endpoint-selector${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className={`endpoint-selector__trigger${open ? " endpoint-selector__trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("endpoint_selector.select")}
      >
        <span className="endpoint-selector__label">{triggerLabel}</span>
        <svg
          className={`endpoint-selector__chevron${open ? " endpoint-selector__chevron--open" : ""}`}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="endpoint-selector__dropdown"
          role="listbox"
          aria-label={t("endpoint_selector.select")}
        >
          <input
            className="endpoint-selector__search"
            type="text"
            placeholder={t("endpoint_selector.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("endpoint_selector.search")}
            autoFocus
          />

          {/* Models — grouped by provider */}
          {availableProviders.map((p, i) => {
            const models = (modelQueryResults[i]?.data as ModelInfo[] | undefined) ?? [];
            const filtered = models.filter(
              (m) =>
                m.purpose !== "embedding" &&
                (matchesSearch(m.name) || matchesSearch(m.id)),
            );
            if (filtered.length === 0) return null;
            return (
              <div key={p.instance_id} className="endpoint-selector__group">
                <div className="endpoint-selector__group-label">{p.label}</div>
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={value?.id === m.id && value?.type === "model"}
                    className={`endpoint-selector__option${value?.id === m.id && value?.type === "model" ? " endpoint-selector__option--selected" : ""}`}
                    onClick={() =>
                      handleSelect({
                        type: "model",
                        id: m.id,
                        label: m.name,
                        provider: p.instance_id,
                      })
                    }
                  >
                    <span className="endpoint-selector__option-icon" aria-hidden="true">&#x2022;</span>
                    {m.name}
                  </button>
                ))}
              </div>
            );
          })}

          {/* Agents group */}
          {agents.filter((a) => matchesSearch(a.name)).length > 0 && (
            <div className="endpoint-selector__group">
              <div className="endpoint-selector__group-label">
                {t("endpoint_selector.group_agents")}
              </div>
              {agents
                .filter((a) => matchesSearch(a.name))
                .map((a) => (
                  <button
                    key={a.slug}
                    type="button"
                    role="option"
                    aria-selected={value?.id === a.slug && value?.type === "agent"}
                    className={`endpoint-selector__option${value?.id === a.slug && value?.type === "agent" ? " endpoint-selector__option--selected" : ""}`}
                    onClick={() =>
                      handleSelect({ type: "agent", id: a.slug, label: a.name })
                    }
                  >
                    <span className="endpoint-selector__option-icon" aria-hidden="true">&#x1F916;</span>
                    {a.name}
                  </button>
                ))}
            </div>
          )}

          {/* Workflows group */}
          {workflows.filter((w) => matchesSearch(w.name)).length > 0 && (
            <div className="endpoint-selector__group">
              <div className="endpoint-selector__group-label">
                {t("endpoint_selector.group_workflows")}
              </div>
              {workflows
                .filter((w) => matchesSearch(w.name))
                .map((w) => (
                  <button
                    key={w.slug}
                    type="button"
                    role="option"
                    aria-selected={value?.id === w.slug && value?.type === "workflow"}
                    className={`endpoint-selector__option${value?.id === w.slug && value?.type === "workflow" ? " endpoint-selector__option--selected" : ""}`}
                    onClick={() =>
                      handleSelect({ type: "workflow", id: w.slug, label: w.name })
                    }
                  >
                    <span className="endpoint-selector__option-icon" aria-hidden="true">&#x26A1;</span>
                    {w.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
