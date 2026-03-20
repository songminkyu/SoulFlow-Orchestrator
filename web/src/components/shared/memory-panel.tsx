/**
 * MemoryPanel — 메모리 열람/관리 패널.
 * 채팅 컨텍스트 + 프롬프팅 관리. sidebar / modal / inline 모드.
 * QC-5 audit 뱃지: clean=green, noisy=amber.
 *
 * BE 엔드포인트:
 *   GET /api/memory/longterm → { content: string; audit_result?: MemoryAuditResult }
 *   GET /api/memory/daily    → { days: string[] }
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useT } from "../../i18n";

/** QC-5 감사 결과 (BE audit_memory_entry() 반환값). */
export interface MemoryAuditResult {
  passed?: boolean;
  violations?: Array<{
    code: string;
    severity: "major" | "minor";
    detail?: string;
  }>;
  /** MemoryPanel 뱃지용 단순 상태 — violations 유무로 파생 */
  status: "clean" | "noisy";
  reason?: string;
}

/** MemoryPanel에서 표시되는 정규화된 메모리 항목. */
export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  scope: "session" | "user" | "team";
  updated_at: string;
  audit_result?: {
    status: "clean" | "noisy";
    reason?: string;
  };
}

export interface MemoryPanelProps {
  /** 세션 ID (미사용 — /api/memory/daily는 user 스코프, 세션 필터 없음) */
  sessionId?: string;
  /** 표시 모드 */
  mode: "sidebar" | "modal" | "inline";
  className?: string;
}

/** BE /api/memory/longterm 응답 */
interface LongtermResponse {
  content: string;
  audit_result?: {
    passed?: boolean;
    violations?: Array<{ code: string; severity: "major" | "minor"; detail?: string }>;
  } | null;
}

/** BE /api/memory/daily 응답 */
interface DailyListResponse {
  days: string[];
}

type ScopeFilter = "all" | "session" | "user" | "team";

function derive_audit(
  raw?: LongtermResponse["audit_result"],
): MemoryEntry["audit_result"] | undefined {
  if (!raw) return undefined;
  const noisy =
    Array.isArray(raw.violations) && raw.violations.length > 0;
  return {
    status: noisy ? "noisy" : "clean",
    reason: noisy
      ? raw.violations!.map((v) => v.detail ?? v.code).join(", ")
      : undefined,
  };
}

export function MemoryPanel({ sessionId: _sessionId, mode, className }: MemoryPanelProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");

  // longterm 메모리 (user 스코프)
  const { data: longterm, isLoading: lt_loading, isError: lt_error } = useQuery<LongtermResponse>({
    queryKey: ["memory-longterm"],
    queryFn: () => api.get<LongtermResponse>("/api/memory/longterm"),
    staleTime: 30_000,
  });

  // daily 목록 (user 스코프 — BE list_daily()는 유저 레벨 영속 저장, 세션 무관)
  const { data: daily_list, isLoading: dl_loading, isError: dl_error } = useQuery<DailyListResponse>({
    queryKey: ["memory-daily-list"],
    queryFn: () => api.get<DailyListResponse>("/api/memory/daily"),
    staleTime: 30_000,
  });

  const isLoading = lt_loading || dl_loading;
  const isError = lt_error || dl_error;

  // BE 응답을 MemoryEntry[] 로 정규화
  const allEntries = useMemo<MemoryEntry[]>(() => {
    const entries: MemoryEntry[] = [];

    if (longterm?.content) {
      entries.push({
        id: "longterm",
        key: "longterm",
        value: longterm.content,
        scope: "user",
        updated_at: "",
        audit_result: derive_audit(longterm.audit_result),
      });
    }

    const days = daily_list?.days ?? [];
    for (const day of days) {
      entries.push({
        id: `daily:${day}`,
        key: day,
        value: "",  // 요약: 일별 메모리 항목 (클릭으로 확장 가능)
        scope: "user",  // BE list_daily()는 유저 스코프 — 세션 무관 영속 저장
        updated_at: day,
      });
    }

    return entries;
  }, [longterm, daily_list]);

  const filtered = useMemo(() => {
    let result = allEntries;

    if (scopeFilter !== "all") {
      result = result.filter((e) => e.scope === scopeFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.key.toLowerCase().includes(q) ||
          e.value.toLowerCase().includes(q),
      );
    }

    return result;
  }, [allEntries, scopeFilter, search]);

  const SCOPE_TABS: ScopeFilter[] = ["all", "session", "user", "team"];

  return (
    <div
      className={[
        "memory-panel",
        `memory-panel--${mode}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      aria-label={t("memory_panel.label")}
    >
      {/* 헤더 */}
      <div className="memory-panel__header">
        <span className="memory-panel__title">{t("memory_panel.title")}</span>
      </div>

      {/* 스코프 탭 */}
      <div className="memory-panel__scope-tabs" role="tablist">
        {SCOPE_TABS.map((scope) => (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={scopeFilter === scope}
            className={[
              "memory-panel__scope-tab",
              scopeFilter === scope ? "memory-panel__scope-tab--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setScopeFilter(scope)}
          >
            {t(`memory_panel.scope.${scope}`)}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="memory-panel__search-wrap">
        <input
          type="text"
          className="memory-panel__search"
          placeholder={t("memory_panel.search_placeholder")}
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          aria-label={t("memory_panel.search_placeholder")}
          data-testid="memory-search"
        />
      </div>

      {/* 로딩 / 에러 / 목록 */}
      {isLoading && (
        <div className="memory-panel__loading" aria-busy="true">
          {t("memory_panel.loading")}
        </div>
      )}

      {isError && (
        <div className="memory-panel__error" role="alert">
          {t("memory_panel.error")}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="memory-panel__list">
          {filtered.length === 0 && (
            <div className="memory-panel__empty">{t("memory_panel.empty")}</div>
          )}

          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={[
                "memory-panel__entry",
                entry.audit_result?.status === "noisy"
                  ? "memory-panel__entry--noisy"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-testid="memory-entry"
            >
              {/* 키 + 스코프 */}
              <div className="memory-panel__entry-header">
                <span className="memory-panel__entry-key">{entry.key}</span>
                <span className={`memory-panel__entry-scope memory-panel__entry-scope--${entry.scope}`}>
                  {t(`memory_panel.scope.${entry.scope}`)}
                </span>

                {/* Audit 뱃지 */}
                {entry.audit_result && (
                  <span
                    className={[
                      "memory-panel__badge",
                      entry.audit_result.status === "clean"
                        ? "memory-panel__badge--clean"
                        : "memory-panel__badge--noisy",
                    ].join(" ")}
                    title={entry.audit_result.reason}
                    data-testid={`audit-badge-${entry.audit_result.status}`}
                  >
                    {entry.audit_result.status === "clean"
                      ? t("memory_panel.audit.clean")
                      : t("memory_panel.audit.noisy")}
                  </span>
                )}
              </div>

              {/* 값 */}
              {entry.value && (
                <div className="memory-panel__entry-value">{entry.value}</div>
              )}

              {/* noisy 경고 */}
              {entry.audit_result?.status === "noisy" && entry.audit_result.reason && (
                <div className="memory-panel__entry-warning" role="note">
                  {entry.audit_result.reason}
                </div>
              )}

              {/* 타임스탬프 */}
              {entry.updated_at && (
                <div className="memory-panel__entry-time">
                  {entry.updated_at}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
