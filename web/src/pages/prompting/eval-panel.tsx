/** EV-4/5 FE: Eval Pipeline Panel — 번들 선택, 실행, scorecard 표시, baseline diff. */
import { useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../../components/toast";
import { useT } from "../../i18n";
import { Badge } from "../../components/badge";
import { SectionHeader } from "../../components/section-header";
import { StudioModelPicker, type StudioModelValue } from "../../components/studio-model-picker";

type EvalBundle = {
  name: string;
  description: string;
  smoke: boolean;
  dataset_files: string[];
  tags?: string[];
};

type ScorecardEntry = {
  dimension: string;
  passed: boolean;
  score: number;
  detail?: string;
};

type Scorecard = {
  case_id: string;
  entries: ScorecardEntry[];
  overall_passed: boolean;
  overall_score: number;
  /** QC-4: compiler verdict — pass/fail/warn */
  compiler_verdict?: "pass" | "warn" | "fail";
  /** QC-4: direct-node hint from compiler */
  direct_node_hint?: string;
};

type EvalReport = {
  dataset: string;
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  scorecards: Scorecard[];
};

type RunSummary = {
  dataset: string;
  total: number;
  passed: number;
  failed: number;
  error_count: number;
  duration_ms: number;
};

type EvalRunResponse = {
  report: EvalReport;
  summaries: RunSummary[];
};

type BaselineDiffEntry = {
  case_id: string;
  dimension: string;
  before: number;
  after: number;
  delta: number;
  status: "improved" | "regressed" | "unchanged" | "new";
};

const EMPTY_MODEL = (): StudioModelValue => ({ provider_id: "", model: "" });

export function EvalPanel() {
  const t = useT();
  const { toast } = useToast();
  const [bundles, setBundles] = useState<EvalBundle[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalRunResponse | null>(null);
  const [baseline, setBaseline] = useState<EvalReport | null>(null);
  const [diff, setDiff] = useState<BaselineDiffEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [endpoint, setEndpoint] = useState<StudioModelValue>(EMPTY_MODEL());

  const load_bundles = async () => {
    try {
      const data = await api.get("/api/eval/bundles") as EvalBundle[];
      setBundles(data);
      setLoaded(true);
    } catch (e) {
      toast(String(e), "err");
    }
  };

  const load_baseline_for = (bundle: string): EvalReport | null => {
    try {
      const raw = localStorage.getItem(`eval_baseline_${bundle}`);
      return raw ? JSON.parse(raw) as EvalReport : null;
    } catch { return null; }
  };

  const save_as_baseline = () => {
    if (!result || !selected) return;
    localStorage.setItem(`eval_baseline_${selected}`, JSON.stringify(result.report));
    setBaseline(result.report);
    toast(t("prompting.eval_save_baseline"), "ok");
  };

  const compute_local_diff = (base: EvalReport, current: EvalReport): BaselineDiffEntry[] => {
    const entries: BaselineDiffEntry[] = [];
    const base_map = new Map(base.scorecards.map(sc => [sc.case_id, sc]));
    for (const sc of current.scorecards) {
      const prev = base_map.get(sc.case_id);
      if (!prev) {
        entries.push({ case_id: sc.case_id, dimension: "overall", before: 0, after: sc.overall_score, delta: sc.overall_score, status: "new" });
        continue;
      }
      const delta = sc.overall_score - prev.overall_score;
      entries.push({
        case_id: sc.case_id, dimension: "overall",
        before: prev.overall_score, after: sc.overall_score, delta,
        status: delta > 0.01 ? "improved" : delta < -0.01 ? "regressed" : "unchanged",
      });
    }
    return entries;
  };

  const run_bundle = async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    setDiff([]);
    try {
      const payload: Record<string, unknown> = { bundle: selected };
      if (endpoint.provider_id) {
        payload.provider_id = endpoint.provider_id;
        if (endpoint.model) payload.model = endpoint.model;
      }
      const data = await api.post("/api/eval/run", payload) as EvalRunResponse;
      setResult(data);
      const prev = load_baseline_for(selected);
      if (prev) {
        setBaseline(prev);
        setDiff(compute_local_diff(prev, data.report));
      }
    } catch (e) {
      toast(String(e), "err");
    } finally {
      setRunning(false);
    }
  };

  if (!loaded) {
    return (
      <div className="ps-split">
        <aside className="ps-config">
          <div className="ps-pane-head">
            <div className="ps-pane-head__icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span className="ps-pane-head__title">{t("prompting.tab_eval")}</span>
          </div>
          <div className="ps-pane-sec ps-pane-sec--grow ps-pane-sec--noborder" style={{ justifyContent: "center" }}>
            <button className="btn btn--sm btn--primary" onClick={() => void load_bundles()}>
              {t("prompting.eval_load")}
            </button>
          </div>
        </aside>
        <main className="ps-preview">
          <div className="ps-preview-empty" style={{ minHeight: 200 }}>
            <div className="ps-preview-empty__icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span>{t("prompting.tab_eval")}</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ps-split">
      {/* ── 왼쪽: 번들 선택 + 엔드포인트 ── */}
      <aside className="ps-config">
        <div className="ps-pane-head">
          <div className="ps-pane-head__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <span className="ps-pane-head__title">{t("prompting.tab_eval")}</span>
        </div>

        {/* 번들 목록 */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("prompting.eval_bundles")}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {bundles.map(b => (
              <button
                key={b.name}
                className={`btn btn--xs${selected === b.name ? " btn--primary" : ""}`}
                onClick={() => { setSelected(b.name); setResult(null); setBaseline(null); setDiff([]); }}
              >
                {b.name}
                {b.smoke && <Badge status="smoke" variant="ok" />}
              </button>
            ))}
          </div>
          {selected && (
            <div className="ps-setting-row" style={{ marginTop: 6 }}>
              <span className="ps-setting-row__label" style={{ fontWeight: 600 }}>{selected}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {bundles.find(b => b.name === selected)?.description}
              </span>
            </div>
          )}
        </div>

        {/* EndpointSelector */}
        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("prompting.eval_endpoint")}</span>
          <StudioModelPicker compact value={endpoint} onChange={setEndpoint} />
        </div>

        {/* 실행 버튼 */}
        <div className="ps-pane-sec ps-pane-sec--grow ps-pane-sec--noborder">
          <button
            className={`ps-run-btn-main${running ? " ps-run-btn-main--running" : ""}`}
            disabled={running || !selected}
            onClick={() => void run_bundle()}
          >
            {running
              ? <>{t("prompting.eval_running")}</>
              : <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  {t("prompting.eval_run")}
                </>
            }
          </button>
        </div>
      </aside>

      {/* ── 오른쪽: 결과 표시 ── */}
      <main className="ps-preview" style={{ display: "flex", flexDirection: "column", overflow: "auto" }}>
        {!result ? (
          <div className="ps-preview-empty" style={{ minHeight: 200 }}>
            <div className="ps-preview-empty__icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span>{t("prompting.output_hint")}</span>
          </div>
        ) : (
          <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Scorecard Panel */}
            <section className="panel panel--flush" data-testid="eval-scorecard">
              <SectionHeader title={t("prompting.eval_scorecard")}>
                <Badge
                  status={`${result.report.passed}/${result.report.total} passed`}
                  variant={result.report.failed === 0 ? "ok" : result.report.failed < result.report.total ? "warn" : "err"}
                />
                <span className="text-xs text-muted">{result.report.duration_ms}ms</span>
              </SectionHeader>
              <div className="grid-stack">
                {result.report.scorecards.map(sc => (
                  <div key={sc.case_id} className="kv mt-0 mb-0">
                    <Badge
                      status={sc.overall_passed ? "pass" : "fail"}
                      variant={sc.overall_passed ? "ok" : "err"}
                    />
                    <span className="fw-600 text-sm">{sc.case_id}</span>
                    <span className="text-xs text-muted">
                      {(sc.overall_score * 100).toFixed(0)}%
                    </span>
                    {/* QC-4: compiler verdict badge */}
                    {sc.compiler_verdict && (
                      <span
                        className={`ps-chip ps-chip--rubric${
                          sc.compiler_verdict === "pass" ? " ps-chip--score-ok"
                          : sc.compiler_verdict === "warn" ? " ps-chip--score-warn"
                          : " ps-chip--score-err"
                        }`}
                        title={sc.direct_node_hint ? `Compiler: ${sc.direct_node_hint}` : `Compiler: ${sc.compiler_verdict}`}
                        data-testid="eval-compiler-badge"
                      >
                        {sc.compiler_verdict.toUpperCase()}
                      </span>
                    )}
                    {sc.entries.length > 1 && (
                      <span className="text-xs text-muted">
                        {sc.entries.map(e => `${e.dimension}: ${e.passed ? "pass" : "fail"}`).join(" · ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Baseline Diff */}
            {diff.length > 0 && (
              <section className="panel panel--flush" data-testid="eval-baseline-diff">
                <SectionHeader title={t("prompting.eval_baseline_diff")}>
                  <Badge
                    status={`${diff.filter(d => d.status === "improved").length} improved / ${diff.filter(d => d.status === "regressed").length} regressed`}
                    variant={diff.some(d => d.status === "regressed") ? "warn" : "ok"}
                  />
                </SectionHeader>
                <div className="grid-stack">
                  {diff.filter(d => d.status !== "unchanged").map(d => (
                    <div key={`${d.case_id}-${d.dimension}`} className="kv mt-0 mb-0">
                      <Badge
                        status={d.status}
                        variant={d.status === "improved" ? "ok" : d.status === "regressed" ? "err" : "info"}
                      />
                      <span className="fw-600 text-sm">{d.case_id}</span>
                      <span className="text-xs text-muted">
                        {(d.before * 100).toFixed(0)}% → {(d.after * 100).toFixed(0)}% ({d.delta > 0 ? "+" : ""}{(d.delta * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Actions: Save Baseline + Export Report */}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn--xs" onClick={save_as_baseline}>
                {baseline ? t("prompting.eval_update_baseline") : t("prompting.eval_save_baseline")}
              </button>
              <button className="btn btn--xs" onClick={() => {
                const blob = new Blob([JSON.stringify(result.report, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `eval-report-${selected}-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}>
                {t("prompting.eval_export_json")}
              </button>
            </div>

            {/* Run Summaries */}
            {result.summaries.length > 0 && (
              <section className="panel panel--flush">
                <SectionHeader title={t("prompting.eval_run_summaries")} />
                <div className="grid-stack">
                  {result.summaries.map((s, i) => (
                    <div key={`${s.dataset}-${i}`} className="kv mt-0 mb-0">
                      <span className="fw-600 text-sm">{s.dataset}</span>
                      <Badge
                        status={`${s.passed}/${s.total}`}
                        variant={s.failed === 0 ? "ok" : "warn"}
                      />
                      {s.error_count > 0 && <Badge status={`${s.error_count} errors`} variant="err" />}
                      <span className="text-xs text-muted">{s.duration_ms}ms</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
