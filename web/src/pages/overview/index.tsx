import { Link } from "react-router-dom";
import { useStatus } from "../../api/hooks";
import { Badge } from "../../components/badge";
import { classify_agent } from "../../utils/classify";
import { useT } from "../../i18n";
import type { DashboardState } from "./types";
import { ACTIVE_TASK_STATUSES } from "./types";
import { StatusView } from "../../components/status-contract";

export default function OverviewPage() {
  const t = useT();
  const { data, isLoading, error, refetch } = useStatus();
  const s = data as DashboardState | undefined;

  const status = isLoading ? "loading" as const
    : error ? "error" as const
    : !s ? "empty" as const
    : "success" as const;

  return (
    <StatusView
      status={status}
      errorMessage={t("status.error")}
      onRetry={() => void refetch()}
      emptyMessage={t("overview.no_data")}
      skeletonCount={2}
    >
      <OverviewContent state={s!} />
    </StatusView>
  );
}

function OverviewContent({ state: s }: { state: DashboardState }) {
  const t = useT();

  const working_agents = s.agents?.filter((a) => classify_agent(a.status) === "working").length ?? 0;
  const active_tasks = s.tasks?.filter((tk) => ACTIVE_TASK_STATUSES.has(tk.status)).length ?? 0;

  /** validator 통과/실패 여부에 따른 라벨. */
  const validator_label = (): string => {
    if (!s.validator_summary) return t("overview.validator_none");
    if (s.validator_summary.failed_validators.length === 0) return t("overview.validator_all_passed");
    return t("overview.validator_failed_fmt", { count: s.validator_summary.failed_validators.length });
  };

  const validator_variant = (): "ok" | "err" | "info" => {
    if (!s.validator_summary) return "info";
    return s.validator_summary.failed_validators.length === 0 ? "ok" : "err";
  };

  return (
    <div className="overview fade-in">
      {/* Stat cards: Tasks + Agents */}
      <div className="stat-grid">
        <Link to="/workspace">
          <div className="stat-card">
            <div className="stat-card__header">
              <div className="stat-card__icon stat-card__icon--accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              {active_tasks > 0 && <Badge status={t("overview.active_fmt", { count: active_tasks })} variant="ok" />}
            </div>
            <div className="stat-card__value">{s.tasks?.length ?? 0}</div>
            <div className="stat-card__label">{t("overview.tasks")}</div>
          </div>
        </Link>

        {(s.agents?.length ?? 0) > 0 && (
          <Link to="/workspace">
            <div className="stat-card">
              <div className="stat-card__header">
                <div className="stat-card__icon stat-card__icon--warn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                {working_agents > 0 && <Badge status={t("overview.working_fmt", { count: working_agents })} variant="warn" />}
              </div>
              <div className="stat-card__value">{s.agents?.length ?? 0}</div>
              <div className="stat-card__label">{t("overview.agents")}</div>
            </div>
          </Link>
        )}
      </div>

      {/* Messages */}
      <section className="panel panel--flush">
        <h2>{t("overview.messages")}</h2>
        <ul className="list list--compact">
          {!s.messages?.length && <li className="empty">-</li>}
          {s.messages?.map((m, i) => (
            <li key={`${m.direction}-${m.sender_id}-${i}`}>
              <span className="li-text li-flex li-flex--baseline">
                <span className={`fw-600 truncate msg-sender ${m.direction === "inbound" ? "msg-sender--in" : "msg-sender--out"}`}>
                  {m.direction === "inbound" ? t("overview.msg_in") : t("overview.msg_out")} {m.sender_id}
                </span>
                <span className="truncate text-sm text-muted flex-fill">{m.content}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* OB-7: Observability 요약 배지 — error rate + active runs */}
      {s.observability && s.observability.error_rate.total > 0 && (
        <div className="stat-grid" data-testid="observability-badges">
          <div className="stat-card">
            <div className="stat-card__header">
              <div className={`stat-card__icon stat-card__icon--${s.observability.error_rate.rate === 0 ? "ok" : s.observability.error_rate.rate < 0.1 ? "warn" : "accent"}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              {s.observability.error_rate.errors > 0 && (
                <Badge status={`${s.observability.error_rate.errors} errors`} variant="err" />
              )}
            </div>
            <div className="stat-card__value">{(s.observability.error_rate.rate * 100).toFixed(1)}%</div>
            <div className="stat-card__label">{t("overview.error_rate") || "Error Rate"}</div>
            <div className="stat-card__extra">{s.observability.error_rate.errors}/{s.observability.error_rate.total}</div>
          </div>

          {(s.channels?.active_runs ?? 0) > 0 && (
            <div className="stat-card">
              <div className="stat-card__header">
                <div className="stat-card__icon stat-card__icon--ok">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
              </div>
              <div className="stat-card__value">{s.channels.active_runs}</div>
              <div className="stat-card__label">{t("overview.active_runs") || "Active Runs"}</div>
            </div>
          )}
        </div>
      )}

      {/* Validator Summary — 항상 배지 표시, 실패 시 상세 표시 */}
      <section className="panel panel--flush" data-testid="validator-summary">
        <h2>{t("overview.validator_summary")}</h2>
        <div className="kv mt-0">
          <Badge
            status={validator_label()}
            variant={validator_variant()}
          />
          {s.validator_summary && (
            <>
              <span className="text-xs text-muted">{s.validator_summary.repo_id}</span>
              <span className="text-xs text-muted">
                {t("overview.validator_passed_fmt", {
                  passed: s.validator_summary.passed_validators,
                  total: s.validator_summary.total_validators,
                })}
              </span>
            </>
          )}
        </div>
        {s.validator_summary?.failed_validators && s.validator_summary.failed_validators.length > 0 && (
          <ul className="list list--compact mt-2">
            {s.validator_summary.failed_validators.map((f, i) => (
              <li key={i} className="text-xs text-err">
                <span className="fw-600">{f.kind}</span>: {f.command}
                {f.output && <span className="text-muted"> — {f.output}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Artifact Replay Entry Point */}
      {s.validator_summary?.artifact_bundle_id && (
        <section className="panel panel--flush" data-testid="artifact-replay">
          <div className="kv mt-0">
            <span className="fw-600 text-sm">{t("repo.artifact_replay")}</span>
            <Badge status={s.validator_summary.artifact_bundle_id} variant="info" />
          </div>
        </section>
      )}

      <div className="overview__timestamp text-xs text-muted">{s.now || "-"}</div>
    </div>
  );
}
