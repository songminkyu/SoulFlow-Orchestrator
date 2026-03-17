/** EV-4/5 FE: Eval Pipeline Panel — 번들 선택, 실행, scorecard 표시, baseline diff. */
import { useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../../components/toast";
import { Badge } from "../../components/badge";
import { SectionHeader } from "../../components/section-header";

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

export function EvalPanel() {
  const { toast } = useToast();
  const [bundles, setBundles] = useState<EvalBundle[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalRunResponse | null>(null);
  const [baseline, setBaseline] = useState<EvalReport | null>(null);
  const [diff, setDiff] = useState<BaselineDiffEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

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
    toast("Baseline saved", "ok");
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
      const data = await api.post("/api/eval/run", { bundle: selected }) as EvalRunResponse;
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
      <div className="panel" style={{ padding: 16 }}>
        <button className="btn btn--sm" onClick={load_bundles}>Load Eval Bundles</button>
      </div>
    );
  }

  return (
    <div className="eval-panel fade-in">
      {/* Bundle Selector */}
      <section className="panel panel--flush">
        <SectionHeader title="Eval Bundles">
          <Badge status={`${bundles.length} bundles`} variant="info" />
        </SectionHeader>
        <div className="grid-stack">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {bundles.map(b => (
              <button
                key={b.name}
                className={`btn btn--xs ${selected === b.name ? "btn--primary" : ""}`}
                onClick={() => { setSelected(b.name); setResult(null); setBaseline(null); setDiff([]); }}
              >
                {b.name}
                {b.smoke && <Badge status="smoke" variant="ok" />}
              </button>
            ))}
          </div>
          {selected && (
            <div className="kv mt-0">
              <span className="text-sm fw-600">{selected}</span>
              <span className="text-xs text-muted">
                {bundles.find(b => b.name === selected)?.description}
              </span>
              <button
                className="btn btn--sm btn--primary"
                onClick={run_bundle}
                disabled={running}
              >
                {running ? "Running..." : "Run"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Scorecard Panel */}
      {result && (
        <section className="panel panel--flush" data-testid="eval-scorecard">
          <SectionHeader title="Scorecard">
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
                {sc.entries.length > 1 && (
                  <span className="text-xs text-muted">
                    {sc.entries.map(e => `${e.dimension}: ${e.passed ? "pass" : "fail"}`).join(" · ")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Baseline Diff */}
      {result && diff.length > 0 && (
        <section className="panel panel--flush" data-testid="eval-baseline-diff">
          <SectionHeader title="Baseline Diff">
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

      {/* Save Baseline + Export Report */}
      {result && (
        <div style={{ padding: "8px 0", display: "flex", gap: 8 }}>
          <button className="btn btn--xs" onClick={save_as_baseline}>
            {baseline ? "Update Baseline" : "Save as Baseline"}
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
            Export JSON
          </button>
        </div>
      )}

      {/* Run Summaries */}
      {result && result.summaries.length > 0 && (
        <section className="panel panel--flush">
          <SectionHeader title="Run Summaries" />
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
  );
}
