/**
 * Prompting — Compare 탭.
 * 동일한 프롬프트를 여러 모델에 동시 실행하여 결과·비용·레이턴시를 나란히 비교.
 */
import { useState } from "react";
import { api } from "../../api/client";
import { useToast } from "../../components/toast";
import { useT } from "../../i18n";
import { StudioModelPicker, type StudioModelValue } from "../../components/studio-model-picker";
import { RunResult, type RunResultValue } from "./run-result";

const EMPTY_TARGET = (): StudioModelValue => ({ provider_id: "", model: "" });

type CompareResult = (RunResultValue & { ok: boolean; error?: string }) | null;

export function ComparePanel() {
  const t = useT();
  const { toast } = useToast();
  const [targets, setTargets] = useState<StudioModelValue[]>([EMPTY_TARGET(), EMPTY_TARGET()]);
  const [system, setSystem] = useState("");
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [max_tokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CompareResult[]>([]);

  const add_target = () => setTargets((prev) => [...prev, EMPTY_TARGET()]);
  const remove_target = (i: number) => setTargets((prev) => prev.filter((_, idx) => idx !== i));
  const update_target = (i: number, v: StudioModelValue) =>
    setTargets((prev) => prev.map((x, idx) => (idx === i ? v : x)));

  const handle_run = async () => {
    if (!prompt.trim()) return;
    const active = targets.filter((tgt) => tgt.provider_id);
    if (!active.length) return;
    setRunning(true);
    setResults([]);
    try {
      const res = await api.post<CompareResult[]>("/api/prompt/compare", {
        prompt,
        system: system.trim() || undefined,
        temperature,
        max_tokens,
        targets: active,
      });
      setResults(res);
    } catch {
      toast(t("prompting.compare_failed"), "err");
      setResults(active.map(() => null));
    } finally {
      setRunning(false);
    }
  };

  const temp_label =
    temperature <= 0.3
      ? t("prompting.temp_precise")
      : temperature <= 0.7
        ? t("prompting.temp_balance")
        : t("prompting.temp_creative");
  const active_count = targets.filter((tgt) => tgt.provider_id).length;

  return (
    <div className="ps-split">
      {/* ── 왼쪽: 공통 설정 ── */}
      <aside className="ps-config">
        <div className="ps-pane-head">
          <div className="ps-pane-head__icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span className="ps-pane-head__title">{t("prompting.compare_title")}</span>
        </div>

        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">{t("prompting.compare_params")}</span>
          <div className="ps-setting-row">
            <span className="ps-setting-row__label">
              {t("prompting.temperature")} <span style={{ fontWeight: 400, opacity: 0.65 }}>({temp_label})</span>
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="range" style={{ width: 88 }} min={0} max={2} step={0.1}
                value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} />
              <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 26, textAlign: "right" }}>{temperature}</span>
            </div>
          </div>
          <div className="ps-setting-row">
            <span className="ps-setting-row__label">{t("prompting.compare_max_tokens")}</span>
            <input className="input input--sm" style={{ width: 88, textAlign: "right" }}
              type="number" min={1} placeholder="default" value={max_tokens ?? ""}
              onChange={(e) => setMaxTokens(e.target.value ? Number(e.target.value) : undefined)} />
          </div>
        </div>

        <div className="ps-pane-sec">
          <span className="ps-pane-sec__label">
            {t("prompting.compare_system")} <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({t("prompting.optional")})</span>
          </span>
          <textarea className="ps-prompt-area" style={{ minHeight: 64 }}
            value={system} onChange={(e) => setSystem(e.target.value)}
            placeholder={t("prompting.system_prompt_ph")} />
        </div>

        <div className="ps-pane-sec ps-pane-sec--grow ps-pane-sec--noborder">
          <span className="ps-pane-sec__label">{t("prompting.compare_prompt")}</span>
          <textarea className="ps-prompt-area ps-prompt-area--grow"
            value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder={t("prompting.compare_prompt_ph")} />
          <button
            className={`ps-run-btn-main${running ? " ps-run-btn-main--running" : ""}`}
            style={{ marginTop: 4 }}
            disabled={running || !prompt.trim() || !active_count}
            onClick={() => void handle_run()}
          >
            {running
              ? <>{t("prompting.compare_running")}</>
              : <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  {t("prompting.compare_run_btn")}
                  <span className="ps-shortcut">⌘↵</span>
                </>
            }
          </button>
        </div>
      </aside>

      {/* ── 오른쪽: 모델 선택 + 결과 ── */}
      <main className="ps-preview" style={{ display: "flex", flexDirection: "column" }}>
        {/* 모델 헤더 */}
        <div className="ps-preview-head">
          <div className="ps-preview-head__top">
            <span className="ps-preview-head__icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </span>
            <span className="ps-preview-head__title">{t("prompting.compare_models_label")}</span>
          </div>
          <div className="ps-preview-head__sub">{t("prompting.compare_models_sub")}</div>
        </div>

        {/* 모델 선택 목록 */}
        <div className="ps-compare__model-list">
          {targets.map((tgt, i) => (
            <div key={i} className="ps-compare__model-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <StudioModelPicker compact value={tgt} onChange={(v) => update_target(i, v)} />
              </div>
              {targets.length > 2 && (
                <button className="btn btn--xs btn--danger"
                  onClick={() => remove_target(i)} aria-label={t("prompting.compare_remove_model")}
                  style={{ flexShrink: 0 }}>✕</button>
              )}
            </div>
          ))}
          {targets.length < 6 && (
            <button className="btn btn--xs" style={{ alignSelf: "flex-start" }} onClick={add_target}>
              {t("prompting.compare_add_model")}
            </button>
          )}
        </div>

        {/* 결과 영역 */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {!running && results.length === 0 ? (
            <div className="ps-preview-empty" style={{ minHeight: 180 }}>
              <div className="ps-preview-empty__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <span>{t("prompting.compare_empty")}</span>
            </div>
          ) : (
            <div
              className="ps-compare__grid"
              style={{ "--col-count": String(Math.max(results.length, active_count)) } as React.CSSProperties}
            >
              {targets.filter((tgt) => tgt.provider_id).map((tgt, i) => (
                <div key={i} className="ps-compare__cell">
                  <div className="ps-compare__cell-header">
                    <span className="ps-chip">{tgt.provider_id}</span>
                    {tgt.model && <span className="ps-chip ps-chip--model">{tgt.model}</span>}
                    {/* QC-2: rubric verdict badge per cell */}
                    {results[i]?.rubric_verdict && (
                      <span
                        className={`ps-chip ps-chip--rubric${
                          results[i]!.rubric_verdict!.overall === "pass" ? " ps-chip--score-ok"
                          : results[i]!.rubric_verdict!.overall === "warn" ? " ps-chip--score-warn"
                          : " ps-chip--score-err"
                        }`}
                        title={`Rubric: ${results[i]!.rubric_verdict!.overall}`}
                        data-testid="compare-rubric-badge"
                      >
                        {results[i]!.rubric_verdict!.overall.toUpperCase()}
                      </span>
                    )}
                    {/* QC-3: route verdict badge per cell */}
                    {results[i]?.route_verdict && (
                      <span
                        className={`ps-chip ps-chip--route${
                          results[i]!.route_verdict!.passed
                            ? (results[i]!.route_verdict!.codes?.length ? " ps-chip--score-warn" : " ps-chip--score-ok")
                            : " ps-chip--score-err"
                        }`}
                        title={results[i]!.route_verdict!.codes?.length
                          ? `Route: ${results[i]!.route_verdict!.codes!.join(", ")}`
                          : `Route: ${results[i]!.route_verdict!.passed ? "ok" : "misrouted"}`
                        }
                        data-testid="compare-route-badge"
                      >
                        {results[i]!.route_verdict!.passed ? "ROUTED" : "MISROUTE"}
                      </span>
                    )}
                  </div>
                  <RunResult value={results[i] ?? null} loading={running && !results[i]} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
