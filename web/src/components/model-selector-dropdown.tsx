/**
 * ModelSelectorDropdown: 프로바이더별 그룹 드롭다운 (검색 가능).
 * studio-model-picker.tsx 패턴을 재사용하되, 단순 드롭다운으로 제공.
 */
import { useState, useRef, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useClickOutside } from "../hooks/use-click-outside";

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

export interface ModelSelectorDropdownProps {
  value: string;
  onSelect: (model_id: string) => void;
  className?: string;
}

export function ModelSelectorDropdown({ value, onSelect, className }: ModelSelectorDropdownProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useClickOutside(wrapRef, () => setOpen(false), open);

  const { data: providers = [] } = useQuery<ProviderInfo[]>({
    queryKey: ["model-selector-providers"],
    queryFn: () => api.get<ProviderInfo[]>("/api/agents/providers"),
    staleTime: 30_000,
  });

  const availableProviders = useMemo(
    () => providers.filter((p) => p.available !== false),
    [providers],
  );

  // useQueries: 프로바이더별 모델 목록을 병렬 fetch (hooks-in-loop 방지)
  const modelQueryResults = useQueries({
    queries: availableProviders.map((p) => ({
      queryKey: ["model-selector-models", p.instance_id],
      queryFn: () =>
        api.get<ModelInfo[]>(
          `/api/agents/providers/${encodeURIComponent(p.instance_id)}/models`,
        ),
      enabled: open,
      staleTime: 30_000,
    })),
  });

  // 프로바이더 + 모델 쿼리 결과를 합침
  const providerGroups = useMemo(
    () =>
      availableProviders.map((p, i) => ({
        provider: p,
        data: modelQueryResults[i]?.data as ModelInfo[] | undefined,
        isLoading: modelQueryResults[i]?.isLoading ?? false,
      })),
    [availableProviders, modelQueryResults],
  );

  // 선택된 모델의 이름 표시
  const selectedLabel = useMemo(() => {
    for (const group of providerGroups) {
      const found = group.data?.find((m) => m.id === value);
      if (found) return found.name;
    }
    return value || t("model_selector.select");
  }, [providerGroups, value, t]);

  const searchLower = search.toLowerCase();

  const handleSelect = (modelId: string) => {
    onSelect(modelId);
    setSearch("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className={`model-selector${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className={`model-selector__trigger${open ? " model-selector__trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("model_selector.select")}
      >
        <span className="model-selector__label">{selectedLabel}</span>
        <svg
          className={`model-selector__chevron${open ? " model-selector__chevron--open" : ""}`}
          width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="model-selector__dropdown" role="listbox" aria-label={t("model_selector.select")}>
          <input
            className="model-selector__search"
            type="text"
            placeholder={t("model_selector.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("model_selector.search")}
            autoFocus
          />
          {providerGroups.map((group) => {
            const models = (group.data ?? []).filter(
              (m) =>
                m.purpose !== "embedding" &&
                (!searchLower || m.name.toLowerCase().includes(searchLower) || m.id.toLowerCase().includes(searchLower)),
            );
            if (models.length === 0 && searchLower) return null;
            return (
              <div key={group.provider.instance_id} className="model-selector__group">
                <div className="model-selector__group-label">{group.provider.label}</div>
                {group.isLoading && (
                  <div className="model-selector__loading">{t("common.loading")}</div>
                )}
                {models.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`model-selector__option${m.id === value ? " model-selector__option--selected" : ""}`}
                    onClick={() => handleSelect(m.id)}
                    role="option"
                    aria-selected={m.id === value}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
