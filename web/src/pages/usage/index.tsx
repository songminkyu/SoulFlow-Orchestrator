/** FE-4: Usage Dashboard — LLM 비용·토큰·요청 시각화. */

import { useState, useMemo } from "react";
import { useT } from "../../i18n";
import { SkeletonGrid } from "../../components/skeleton-grid";
import { SectionHeader } from "../../components/section-header";
import { Badge } from "../../components/badge";
import { useStatus } from "../../api/hooks";
import { StackedBarChart, DeltaIndicator, type StackedDayData } from "../../components/chart-primitives";
import { useDailySummary, useProviderSummary, useTodayByModel } from "./use-usage";
import type { DailySummary, PeriodPreset, ProviderSummary, ModelDailySummary } from "./types";
import type { DashboardState, ObservabilitySummary } from "../overview/types";
import "../../styles/usage.css";

const PERIOD_OPTIONS: { value: PeriodPreset; label_key: string }[] = [
  { value: "7d", label_key: "usage.period_7d" },
  { value: "14d", label_key: "usage.period_14d" },
  { value: "30d", label_key: "usage.period_30d" },
  { value: "90d", label_key: "usage.period_90d" },
];

function period_to_days(p: PeriodPreset): number {
  return parseInt(p, 10);
}

/** 프로바이더별 색상 — 안정적인 해시 기반 할당. */
const PROVIDER_PALETTE = [
  "#4a9eff", "#2fb171", "#d9a441", "#c56a6a", "#9b59b6",
  "#1abc9c", "#e67e22", "#5dade2", "#af7ac5", "#45b7d1",
];

function provider_color(_id: string, idx: number): string {
  return PROVIDER_PALETTE[idx % PROVIDER_PALETTE.length]!;
}

/** 프로바이더별 일별 데이터를 StackedDayData로 변환. */
function build_stacked(rows: DailySummary[], metric: "cost_usd" | "calls" | "total_tokens"): StackedDayData[] {
  const providers = [...new Set(rows.map((r) => r.provider_id))];
  const by_date = new Map<string, Map<string, number>>();
  for (const r of rows) {
    let day = by_date.get(r.date);
    if (!day) { day = new Map(); by_date.set(r.date, day); }
    day.set(r.provider_id, (day.get(r.provider_id) ?? 0) + r[metric]);
  }
  return Array.from(by_date.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pmap]) => ({
      date,
      segments: providers.map((pid, i) => ({
        key: pid,
        value: pmap.get(pid) ?? 0,
        color: provider_color(pid, i),
      })),
    }));
}

/** 기간 합산 (이전 기간 비교용). */
function sum_metric(rows: DailySummary[], metric: "cost_usd" | "calls" | "total_tokens"): number {
  return rows.reduce((s, r) => s + r[metric], 0);
}

export default function UsagePage() {
  const t = useT();
  const [period, set_period] = useState<PeriodPreset>("30d");
  const days = period_to_days(period);

  const { data: daily_raw, isLoading: daily_loading } = useDailySummary(days);
  const { data: prev_raw } = useDailySummary(days * 2);
  const { data: providers, isLoading: prov_loading } = useProviderSummary(days);
  const { data: today_models, isLoading: model_loading } = useTodayByModel();
  const { data: state_raw } = useStatus();
  const obs = (state_raw as DashboardState | undefined)?.observability;

  const stacked_cost = useMemo(() => build_stacked(daily_raw ?? [], "cost_usd"), [daily_raw]);
  const stacked_calls = useMemo(() => build_stacked(daily_raw ?? [], "calls"), [daily_raw]);
  const stacked_tokens = useMemo(() => build_stacked(daily_raw ?? [], "total_tokens"), [daily_raw]);

  /** 이전 기간 합산 — prev_raw(2x 기간)에서 현재 기간을 빼면 이전 기간. */
  const prev_totals = useMemo(() => {
    if (!prev_raw || !daily_raw) return { cost: 0, tokens: 0, calls: 0 };
    const cur_cost = sum_metric(daily_raw, "cost_usd");
    const cur_tokens = sum_metric(daily_raw, "total_tokens");
    const cur_calls = sum_metric(daily_raw, "calls");
    return {
      cost: sum_metric(prev_raw, "cost_usd") - cur_cost,
      tokens: sum_metric(prev_raw, "total_tokens") - cur_tokens,
      calls: sum_metric(prev_raw, "calls") - cur_calls,
    };
  }, [prev_raw, daily_raw]);

  const totals = useMemo(() => {
    if (!providers) return { cost: 0, tokens: 0, calls: 0 };
    return providers.reduce(
      (acc, p) => ({
        cost: acc.cost + p.cost_usd,
        tokens: acc.tokens + p.total_tokens,
        calls: acc.calls + p.calls,
      }),
      { cost: 0, tokens: 0, calls: 0 },
    );
  }, [providers]);

  const is_loading = daily_loading || prov_loading;

  return (
    <div className="usage fade-in">
      <div className="usage__header">
        <h1 className="usage__title">{t("usage.title")}</h1>
        <div className="usage__period-selector">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`usage__period-btn ${period === opt.value ? "usage__period-btn--active" : ""}`}
              onClick={() => set_period(opt.value)}
            >
              {t(opt.label_key)}
            </button>
          ))}
        </div>
      </div>

      {is_loading ? (
        <SkeletonGrid count={3} className="usage__stat-grid" />
      ) : (
        <>
          {/* Summary Cards + Delta */}
          <div className="usage__stat-grid">
            <SummaryCard
              icon={<CostIcon />}
              value={fmt_usd(totals.cost)}
              label={t("usage.total_spend")}
              variant="accent"
              delta={<DeltaIndicator current={totals.cost} previous={prev_totals.cost} format_fn={fmt_usd} invert />}
            />
            <SummaryCard
              icon={<TokenIcon />}
              value={fmt_number(totals.tokens)}
              label={t("usage.total_tokens")}
              variant="ok"
              delta={<DeltaIndicator current={totals.tokens} previous={prev_totals.tokens} format_fn={fmt_compact} />}
            />
            <SummaryCard
              icon={<RequestIcon />}
              value={fmt_number(totals.calls)}
              label={t("usage.total_requests")}
              variant="info"
              delta={<DeltaIndicator current={totals.calls} previous={prev_totals.calls} format_fn={fmt_number} />}
            />
          </div>

          {/* Stacked Daily Chart — Cost by Provider */}
          <section className="panel panel--flush usage__chart-section">
            <SectionHeader title={t("usage.daily_spend")} />
            <StackedBarChart data={stacked_cost} format_fn={fmt_usd_short} />
          </section>

          {/* Stacked Daily Chart — Requests by Provider */}
          <section className="panel panel--flush usage__chart-section">
            <SectionHeader title={t("usage.daily_requests")} />
            <StackedBarChart data={stacked_calls} format_fn={fmt_number} />
          </section>

          {/* Stacked Daily Chart — Tokens by Provider */}
          <section className="panel panel--flush usage__chart-section">
            <SectionHeader title={t("usage.daily_tokens")} />
            <StackedBarChart data={stacked_tokens} format_fn={fmt_compact} />
          </section>

          {/* Provider Breakdown */}
          {providers && providers.length > 0 && (
            <section className="panel panel--flush">
              <SectionHeader title={t("usage.by_provider")} />
              <ProviderTable rows={providers} total_cost={totals.cost} />
            </section>
          )}

          {/* Today — Model Breakdown */}
          {!model_loading && today_models && today_models.length > 0 && (
            <section className="panel panel--flush">
              <SectionHeader title={t("usage.today_by_model")} />
              <ModelTable rows={today_models} />
            </section>
          )}

          {/* Realtime Observability Summary */}
          {obs && <RealtimeObsCard obs={obs} />}

          {/* Empty state */}
          {!is_loading && stacked_cost.length === 0 && (
            <div className="usage__empty">
              <p className="text-muted">{t("usage.no_data")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function SummaryCard({
  icon,
  value,
  label,
  variant,
  delta,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  variant: "accent" | "ok" | "info";
  delta?: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <div className={`stat-card__icon stat-card__icon--${variant}`}>{icon}</div>
      </div>
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
      {delta && <div className="stat-card__extra">{delta}</div>}
    </div>
  );
}


function ProviderTable({ rows, total_cost }: { rows: ProviderSummary[]; total_cost: number }) {
  const t = useT();
  return (
    <div className="usage-table-wrap">
      <table className="usage-table">
        <thead>
          <tr>
            <th>{t("usage.col_provider")}</th>
            <th className="text-right">{t("usage.col_requests")}</th>
            <th className="text-right">{t("usage.col_tokens")}</th>
            <th className="text-right">{t("usage.col_cost")}</th>
            <th className="text-right">{t("usage.col_share")}</th>
            <th className="text-right">{t("usage.col_errors")}</th>
            <th className="text-right">{t("usage.col_latency")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.provider_id}>
              <td>
                <span className="fw-600">{r.provider_id}</span>
              </td>
              <td className="text-right">{fmt_number(r.calls)}</td>
              <td className="text-right">{fmt_compact(r.total_tokens)}</td>
              <td className="text-right">{fmt_usd(r.cost_usd)}</td>
              <td className="text-right">
                <CostShareBar pct={total_cost > 0 ? (r.cost_usd / total_cost) * 100 : 0} />
              </td>
              <td className="text-right">
                {r.error_calls > 0 ? (
                  <Badge status={String(r.error_calls)} variant="err" />
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="text-right text-muted">{r.avg_latency_ms}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelTable({ rows }: { rows: ModelDailySummary[] }) {
  const t = useT();
  return (
    <div className="usage-table-wrap">
      <table className="usage-table">
        <thead>
          <tr>
            <th>{t("usage.col_model")}</th>
            <th>{t("usage.col_provider")}</th>
            <th className="text-right">{t("usage.col_requests")}</th>
            <th className="text-right">{t("usage.col_input_tokens")}</th>
            <th className="text-right">{t("usage.col_output_tokens")}</th>
            <th className="text-right">{t("usage.col_cost")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.provider_id}-${r.model}`}>
              <td><code className="usage-model-name">{r.model}</code></td>
              <td className="text-muted">{r.provider_id}</td>
              <td className="text-right">{fmt_number(r.calls)}</td>
              <td className="text-right">{fmt_compact(r.input_tokens)}</td>
              <td className="text-right">{fmt_compact(r.output_tokens)}</td>
              <td className="text-right">{fmt_usd(r.cost_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostShareBar({ pct }: { pct: number }) {
  return (
    <div className="usage-share">
      <div className="usage-share__bar">
        <div className="usage-share__fill" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="usage-share__label">{pct.toFixed(1)}%</span>
    </div>
  );
}

/* ─── Icons ─── */

function CostIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function TokenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 3h-8l-2 4h12z" />
    </svg>
  );
}

function RequestIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

/* ─── Formatters ─── */

function fmt_usd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  if (n === 0) return "$0.00";
  return `$${n.toFixed(4)}`;
}

function fmt_usd_short(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return fmt_usd(n);
}

function fmt_number(n: number): string {
  return n.toLocaleString();
}

function fmt_compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}


/** FE-4/OB: 실시간 observability 요약 카드 — error rate, LLM cost, active spans. */
function RealtimeObsCard({ obs }: { obs: ObservabilitySummary }) {
  const t = useT();
  const err_pct = obs.error_rate.total > 0 ? (obs.error_rate.rate * 100).toFixed(1) : "0";
  const has_cost = (obs.llm_cost?.total_calls ?? 0) > 0;

  return (
    <section className="panel panel--flush" style={{ padding: "var(--sp-4)" }}>
      <SectionHeader title={t("usage.realtime") || "Realtime"} />
      <div className="usage__stat-grid" style={{ gridTemplateColumns: has_cost ? "repeat(4, 1fr)" : "repeat(3, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-card__value" style={{ color: obs.error_rate.rate === 0 ? "var(--ok)" : obs.error_rate.rate < 0.1 ? "var(--warn)" : "var(--err)" }}>
            {err_pct}%
          </div>
          <div className="stat-card__label">{t("usage.error_rate") || "Error Rate"}</div>
          <div className="stat-card__extra">{obs.error_rate.errors}/{obs.error_rate.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{obs.llm_cost?.total_calls ?? 0}</div>
          <div className="stat-card__label">{t("usage.llm_calls") || "LLM Calls"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{fmt_compact(obs.llm_cost?.total_input_tokens ?? 0)}/{fmt_compact(obs.llm_cost?.total_output_tokens ?? 0)}</div>
          <div className="stat-card__label">{t("usage.in_out_tokens") || "In/Out Tokens"}</div>
        </div>
        {has_cost && (
          <div className="stat-card">
            <div className="stat-card__value">{fmt_usd(obs.llm_cost!.total_cost_usd)}</div>
            <div className="stat-card__label">{t("usage.session_cost") || "Session Cost"}</div>
          </div>
        )}
      </div>
    </section>
  );
}
