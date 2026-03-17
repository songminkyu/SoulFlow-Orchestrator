/**
 * FE-4: 재사용 가능한 차트 프리미티브.
 * 외부 라이브러리 없이 CSS 기반으로 구현.
 */

import { useState } from "react";

/* ─── Distribution Bar (수평 비율 바) ─── */

export interface DistributionSegment {
  key: string;
  value: number;
  color: string;
  label?: string;
}

/** 수평 stacked bar — 요청 분류 등 비율 분포 표현. */
export function DistributionBar({ segments, height = 24 }: { segments: DistributionSegment[]; height?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  return (
    <div className="dist-bar" style={{ height }} role="img" aria-label="Distribution">
      {segments.map((seg) => {
        const pct = (seg.value / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={seg.key}
            className="dist-bar__seg"
            style={{ width: `${pct}%`, backgroundColor: seg.color }}
            title={`${seg.label || seg.key}: ${seg.value} (${pct.toFixed(1)}%)`}
          >
            {pct > 8 && <span className="dist-bar__label">{seg.label || seg.key}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** 범례 — DistributionBar 아래에 배치. */
export function DistributionLegend({ segments }: { segments: DistributionSegment[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div className="dist-legend">
      {segments.map((seg) => (
        <span key={seg.key} className="dist-legend__item">
          <span className="dist-legend__dot" style={{ backgroundColor: seg.color }} />
          <span className="dist-legend__key">{seg.label || seg.key}</span>
          <span className="dist-legend__val">{seg.value}</span>
          {total > 0 && (
            <span className="dist-legend__pct">{((seg.value / total) * 100).toFixed(0)}%</span>
          )}
        </span>
      ))}
    </div>
  );
}

/* ─── Latency Bars (수평 그룹 바) ─── */

export interface LatencyEntry {
  label: string;
  p50: number;
  p95: number;
  p99: number;
  count?: number;
}

/** 수평 그룹 바 — 같은 축에서 p50/p95/p99를 비교. */
export function LatencyBars({ entries }: { entries: LatencyEntry[] }) {
  const max_val = Math.max(...entries.flatMap((e) => [e.p50, e.p95, e.p99]), 1);

  return (
    <div className="lat-bars">
      {entries.map((e) => (
        <div key={e.label} className="lat-bars__row">
          <span className="lat-bars__label">
            {e.label}
            {e.count != null && <span className="lat-bars__count">({e.count})</span>}
          </span>
          <div className="lat-bars__tracks">
            <LatBar value={e.p99} max={max_val} color="var(--err)" label={`p99: ${e.p99}ms`} />
            <LatBar value={e.p95} max={max_val} color="var(--warn)" label={`p95: ${e.p95}ms`} />
            <LatBar value={e.p50} max={max_val} color="var(--ok)" label={`p50: ${e.p50}ms`} />
          </div>
          <span className="lat-bars__values">
            <span className="lat-bars__v lat-bars__v--ok">{e.p50}</span>
            <span className="lat-bars__v lat-bars__v--warn">{e.p95}</span>
            <span className="lat-bars__v lat-bars__v--err">{e.p99}</span>
          </span>
        </div>
      ))}
      <div className="lat-bars__legend">
        <span><span className="lat-bars__ldot" style={{ background: "var(--ok)" }} /> p50</span>
        <span><span className="lat-bars__ldot" style={{ background: "var(--warn)" }} /> p95</span>
        <span><span className="lat-bars__ldot" style={{ background: "var(--err)" }} /> p99</span>
      </div>
    </div>
  );
}

function LatBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className="lat-bars__bar"
      style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: color }}
      title={label}
    />
  );
}

/* ─── Proportion Bar (단일 비율 바) ─── */

/** 테이블 행 안의 인라인 비율 바 — provider/tool 사용량 비교용. */
export function ProportionBar({ value, max, color = "var(--accent)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="prop-bar">
      <div className="prop-bar__fill" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

/* ─── Delta Indicator (트렌드 화살표) ─── */

/** 이전 기간 대비 증감 표시. */
export function DeltaIndicator({ current, previous, format_fn, invert }: {
  current: number;
  previous: number;
  format_fn?: (n: number) => string;
  /** true이면 감소가 긍정적 (비용 등). */
  invert?: boolean;
}) {
  if (previous === 0 && current === 0) return null;
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
  const is_up = delta > 0;
  const is_positive = invert ? !is_up : is_up;

  return (
    <span className={`delta-ind delta-ind--${is_positive ? "pos" : delta === 0 ? "flat" : "neg"}`}>
      <span className="delta-ind__arrow">{is_up ? "▲" : delta < 0 ? "▼" : "–"}</span>
      <span className="delta-ind__pct">{Math.abs(delta).toFixed(1)}%</span>
      {format_fn && previous > 0 && (
        <span className="delta-ind__prev">vs {format_fn(previous)}</span>
      )}
    </span>
  );
}

/* ─── Stacked Daily Bar Chart (프로바이더별) ─── */

export interface StackedDayData {
  date: string;
  segments: { key: string; value: number; color: string }[];
}

/** 수직 stacked bar chart — 프로바이더별 일별 분해. */
export function StackedBarChart({
  data,
  format_fn,
  height = 180,
}: {
  data: StackedDayData[];
  format_fn: (n: number) => string;
  height?: number;
}) {
  const [hovered, set_hovered] = useState<number | null>(null);
  if (data.length === 0) return <p className="empty text-xs">-</p>;

  const day_totals = data.map((d) => d.segments.reduce((s, seg) => s + seg.value, 0));
  const max_val = Math.max(...day_totals, 1);
  const total = day_totals.reduce((s, v) => s + v, 0);

  return (
    <div className="usage-chart">
      <div className="usage-chart__summary">
        <span className="usage-chart__total">{format_fn(total)}</span>
      </div>
      <div className="usage-chart__bars" style={{ height }} role="img" aria-label="Stacked bar chart">
        {data.map((d, i) => {
          const day_total = day_totals[i]!;
          const bar_pct = max_val > 0 ? (day_total / max_val) * 100 : 0;
          const is_hovered = hovered === i;

          return (
            <div
              key={d.date}
              className={`usage-chart__bar-col${is_hovered ? " usage-chart__bar-col--hover" : ""}`}
              onMouseEnter={() => set_hovered(i)}
              onMouseLeave={() => set_hovered(null)}
            >
              <div className="usage-chart__bar-track">
                <div className="usage-chart__stacked-bar" style={{ height: `${Math.max(bar_pct, 1)}%` }}>
                  {d.segments
                    .filter((seg) => seg.value > 0)
                    .map((seg) => {
                      const seg_pct = day_total > 0 ? (seg.value / day_total) * 100 : 0;
                      return (
                        <div
                          key={seg.key}
                          className="usage-chart__stacked-seg"
                          style={{ height: `${seg_pct}%`, backgroundColor: seg.color }}
                        />
                      );
                    })}
                </div>
              </div>
              <span className="usage-chart__bar-label">{fmt_date_short(d.date)}</span>
              {/* CSS tooltip */}
              {is_hovered && (
                <div className="usage-chart__tooltip">
                  <div className="usage-chart__tooltip-date">{d.date}</div>
                  {d.segments.filter((s) => s.value > 0).map((s) => (
                    <div key={s.key} className="usage-chart__tooltip-row">
                      <span className="usage-chart__tooltip-dot" style={{ backgroundColor: s.color }} />
                      <span>{s.key}</span>
                      <span className="usage-chart__tooltip-val">{format_fn(s.value)}</span>
                    </div>
                  ))}
                  <div className="usage-chart__tooltip-total">
                    Total: {format_fn(day_total)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmt_date_short(iso: string): string {
  const parts = iso.split("-");
  if (parts.length >= 3) return `${parts[1]}/${parts[2]}`;
  return iso;
}
