/** 워크플로우 통합 목록 — Templates 카탈로그 + Running 탭. */

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { Badge } from "../../components/badge";
import { EmptyState } from "../../components/empty-state";
import { DeleteConfirmModal, useModalEffects } from "../../components/modal";
import { SkeletonGrid } from "../../components/skeleton-grid";
import { useToast } from "../../components/toast";
import { useT } from "../../i18n";
import { time_ago } from "../../utils/format";

/** 노드 타입별 아이콘+색상 매핑 — 생성 위저드용 */
const NODE_TYPE_CATALOG = [
  { id: "research", icon: "🔍", label: "Research", color: "#4a9eff" },
  { id: "code", icon: "💻", label: "Code", color: "#8b5cf6" },
  { id: "chatbot", icon: "💬", label: "Chatbot", color: "#10b981" },
  { id: "analysis", icon: "📊", label: "Analysis", color: "#f59e0b" },
  { id: "template", icon: "📋", label: "Template", color: "#ec4899" },
  { id: "automation", icon: "⚡", label: "Automation", color: "#6366f1" },
] as const;

/** 템플릿 제목 첫 글자 기반 아바타 색상 */
function tpl_avatar_color(title: string): string {
  const colors = ["#4a9eff", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#6366f1", "#14b8a6", "#ef4444"];
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length] ?? "#4a9eff";
}

// ── Types ──

interface PhaseLoopState {
  workflow_id: string;
  title: string;
  objective: string;
  status: string;
  current_phase: number;
  phases: Array<{
    phase_id: string;
    title: string;
    status: string;
    agents: Array<{ agent_id: string; label: string; status: string }>;
    critic?: { status: string; approved?: boolean };
  }>;
  created_at: string;
  updated_at: string;
}

interface WorkflowTemplate {
  slug: string;
  title: string;
  objective: string;
  variables?: Record<string, string>;
  phases: Array<{
    phase_id: string;
    title: string;
    agents: Array<{ agent_id: string; role: string; label: string; backend: string }>;
    critic?: { system_prompt: string; gate: boolean };
  }>;
}

// ── Helpers ──

const STATUS_VARIANT: Record<string, "ok" | "warn" | "err" | "off"> = {
  running: "ok", completed: "ok", failed: "err", cancelled: "off",
  waiting_user_input: "warn", pending: "off", reviewing: "warn",
};


/** 상태 우선순위: 실행 중 > 대기 > 실패 > 완료 > 취소. */
const STATUS_ORDER: Record<string, number> = {
  running: 0, waiting_user_input: 1, reviewing: 2, failed: 3, pending: 4, completed: 5, cancelled: 6,
};

function progress_percent(wf: PhaseLoopState): number {
  const total = wf.phases.length;
  if (total === 0) return 0;
  return Math.round((wf.phases.filter((p) => p.status === "completed").length / total) * 100);
}

// ── Page ──

export default function WorkflowsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const t = useT();
  const navigate = useNavigate();
  const templateListRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<"templates" | "running">("templates");
  const [selectedTpl, setSelectedTpl] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const { data: workflows, isLoading: wfLoading } = useQuery<PhaseLoopState[]>({
    queryKey: ["workflows"],
    queryFn: () => api.get("/api/workflow/runs"),
    refetchInterval: 60_000,
    staleTime: 10_000,
  });

  const { data: templates, isLoading: tplLoading } = useQuery<WorkflowTemplate[]>({
    queryKey: ["workflow-templates"],
    staleTime: 30_000,
    queryFn: async () => {
      const raw = await api.get<WorkflowTemplate[]>("/api/workflow/templates");
      // slug 없는 레거시 응답 방어: title 기반 slug 생성
      return raw.map((tpl, i) => ({
        ...tpl,
        slug: tpl.slug || tpl.title?.toLowerCase().replace(/[^a-z0-9가-힣\-_]/g, "-").replace(/-+/g, "-") || `tpl-${i}`,
      }));
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/workflow/runs/${id}`),
    onSuccess: () => { toast(t("workflows.cancelled"), "ok"); void qc.invalidateQueries({ queryKey: ["workflows"] }); setCancelTarget(null); },
    onError: () => toast(t("workflows.cancel_failed"), "err"),
  });

  const deleteMut = useMutation({
    mutationFn: (name: string) => api.del(`/api/workflow/templates/${encodeURIComponent(name)}`),
    onSuccess: () => {
      toast(t("workflows.template_deleted"), "ok");
      void qc.invalidateQueries({ queryKey: ["workflow-templates"] });
      setDeleteTarget(null);
      // 삭제 후 리스트의 첫 번째 항목으로 포커스 이동 (접근성)
      setTimeout(() => {
        const firstTemplate = templateListRef.current?.querySelector('[role="button"]');
        (firstTemplate as HTMLElement)?.focus();
      }, 0);
    },
  });

  const runFromTplMut = useMutation({
    mutationFn: (body: { template_name: string; title: string; objective: string }) =>
      api.post<{ ok: boolean; workflow_id?: string; error?: string }>("/api/workflow/runs", body),
    onSuccess: (data) => {
      if (data.ok && data.workflow_id) {
        setSelectedTpl(null);
        void qc.invalidateQueries({ queryKey: ["workflows"] });
        toast(t("workflows.created"), "ok");
        navigate(`/workflows/${data.workflow_id}`);
      } else {
        toast(data.error || "Failed", "err");
      }
    },
    onError: () => toast(t("workflows.create_failed"), "err"),
  });

  const sortedWorkflows = (workflows || []).slice().sort((a, b) => {
    const sa = STATUS_ORDER[a.status] ?? 9;
    const sb = STATUS_ORDER[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const runningCount = workflows?.length ?? 0;
  const tplCount = templates?.length ?? 0;

  return (
    <div className="page">
      {/* Page Header — clean, no gradient */}
      <header className="wf-page-header">
        <div>
          <h1 className="wf-page-header__title">{t("workflows.title")}</h1>
          <p className="wf-page-header__desc">{t("workflows.description")}</p>
        </div>
        <div className="wf-page-header__actions">
          {tab === "templates" && (
            <button className="btn btn--sm btn--ghost" onClick={() => setShowImport(true)}>
              {t("workflows.import")}
            </button>
          )}
          <button className="btn btn--sm btn--accent" onClick={() => setShowWizard(true)}>
            + {t("workflows.new_workflow")}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="wf-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "templates"} className={`wf-tab${tab === "templates" ? " wf-tab--active" : ""}`} onClick={() => setTab("templates")}>
          {t("workflows.templates")} ({tplCount})
        </button>
        <button role="tab" aria-selected={tab === "running"} className={`wf-tab${tab === "running" ? " wf-tab--active" : ""}`} onClick={() => setTab("running")}>
          {t("workflows.running_tab")} ({runningCount})
        </button>
      </div>

      {/* Templates */}
      {tab === "templates" && (
        <>
          {tplLoading ? (
            <SkeletonGrid count={4} cardStyle={{ height: 180 }} />
          ) : (
            <>
            {/* My Workflows */}
            <h2 className="wf-section__title">My Workflows</h2>
            <div className="wf-grid" ref={templateListRef}>
              {/* Create New Card */}
              <div
                className="wf-create-card"
                role="button"
                tabIndex={0}
                onClick={() => setShowWizard(true)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setShowWizard(true); } }}
              >
                <div className="wf-create-card__icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="wf-create-card__title">{t("workflows.new_workflow")}</div>
                <div className="wf-create-card__desc">{t("workflows.quick_run_placeholder")}</div>
              </div>
            </div>

            {/* Shared Workflows */}
            {(templates || []).length > 0 && (
              <>
                <h2 className="wf-section__title" style={{ marginTop: "var(--sp-5)" }}>Shared Workflows</h2>
                <div className="wf-grid">
                  {(templates || []).map((tpl) => {
                    const agent_count = tpl.phases.reduce((n, p) => n + p.agents.length, 0);
                    const selected = selectedTpl === tpl.slug;
                    const avatar_color = tpl_avatar_color(tpl.title);
                    return (
                      <div
                        key={tpl.slug}
                        role="button"
                        tabIndex={0}
                        className={`wf-card${selected ? " wf-card--selected" : ""}`}
                        onClick={() => setSelectedTpl(selected ? null : tpl.slug)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedTpl(selected ? null : tpl.slug); } }}
                      >
                        <div className="wf-card__header">
                          <span className="wf-card__avatar" style={{ background: avatar_color }}>{tpl.title.charAt(0).toUpperCase()}</span>
                          <span className="wf-card__meta">{tpl.phases.length} phases · {agent_count} agents</span>
                        </div>
                        <h3 className="wf-card__title">{tpl.title}</h3>
                        {tpl.objective && (
                          <p className="wf-card__desc">
                            {tpl.objective.length > 100 ? tpl.objective.slice(0, 100) + "…" : tpl.objective}
                          </p>
                        )}
                        <div className="wf-card__phases">
                          {tpl.phases.map((p, i) => (
                            <span key={p.phase_id} className="wf-card__phase">
                              {i > 0 && <span className="wf-card__arrow">→</span>}
                              {p.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
          )}

          {/* Template Detail */}
          {(() => {
            const tplMatch = selectedTpl ? templates?.find((t) => t.slug === selectedTpl) : undefined;
            return tplMatch ? (
              <TemplateDetailPanel
                template={tplMatch}
                initialObjective={undefined}
                onClose={() => setSelectedTpl(null)}
                onRun={(body) => { runFromTplMut.mutate(body); }}
                onEdit={() => navigate(`/workflows/edit/${encodeURIComponent(selectedTpl!)}`)}
                onDelete={() => setDeleteTarget(selectedTpl)}
                running={runFromTplMut.isPending}
              />
            ) : null;
          })()}

          <ImportModal
            open={showImport}
            onClose={() => setShowImport(false)}
            onImported={() => {
              setShowImport(false);
              void qc.invalidateQueries({ queryKey: ["workflow-templates"] });
              toast(t("workflows.import_success"), "ok");
            }}
          />

          <DeleteConfirmModal
            open={!!deleteTarget}
            title={t("workflows.delete_template")}
            message={t("workflows.confirm_delete")}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)}
            confirmLabel={t("workflows.delete_template")}
          />
        </>
      )}

      {/* Creation Wizard Modal */}
      {showWizard && (
        <CreateWizardModal
          onClose={() => setShowWizard(false)}
          onCreateBlank={() => { setShowWizard(false); navigate("/workflows/new"); }}
          onCreateWithPrompt={(prompt) => { setShowWizard(false); navigate(`/workflows/new?prompt=${encodeURIComponent(prompt)}`); }}
        />
      )}

      {/* Cancel Workflow Confirm */}
      <DeleteConfirmModal
        open={!!cancelTarget}
        title={t("workflows.cancel_confirm_title")}
        message={t("workflows.cancel_confirm_desc")}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && cancelMut.mutate(cancelTarget)}
        confirmLabel={t("workflows.cancel_confirm_ok")}
      />

      {/* Running */}
      {tab === "running" && (
        <>
          {wfLoading ? (
            <SkeletonGrid count={4} cardStyle={{ height: 180 }} />
          ) : !sortedWorkflows.length ? (
            <EmptyState title={t("workflows.empty")} description={t("workflows.empty_hint")} />
          ) : (
            <div className="wf-grid">
              {sortedWorkflows.map((wf) => {
                const pct = progress_percent(wf);
                const agent_count = wf.phases.reduce((n, p) => n + p.agents.length, 0);
                return (
                  <div key={wf.workflow_id} className={`wf-card wf-card--${wf.status}`}>
                    <div className="wf-card__header">
                      <Badge status={wf.status} variant={STATUS_VARIANT[wf.status] || "off"} />
                      <span className="wf-card__meta" title={new Date(wf.updated_at).toLocaleString()}>
                        {time_ago(wf.updated_at)}
                      </span>
                    </div>
                    <h3 className="wf-card__title">{wf.title}</h3>
                    <p className="wf-card__desc">
                      {wf.objective.length > 100 ? wf.objective.slice(0, 100) + "…" : wf.objective}
                    </p>
                    <span className="wf-card__meta">
                      Phase {wf.current_phase + 1}/{wf.phases.length} · {agent_count} agents
                    </span>
                    <div className="wf-progress" title={`${pct}%`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("workflows.progress")}>
                      <div
                        className={`wf-progress__bar${wf.status === "failed" ? " wf-progress__bar--err" : wf.status === "running" ? " wf-progress__bar--running" : ""}`}
                        style={{ width: `${Math.max(pct, 3)}%` }}
                      />
                      <span className="wf-progress__label">{pct}%</span>
                    </div>
                    <div className="wf-card__actions">
                      <button className="btn btn--sm btn--ghost" onClick={() => navigate(`/workflows/${wf.workflow_id}`)}>
                        {t("workflows.view_detail")}
                      </button>
                      {(wf.status === "running" || wf.status === "waiting_user_input") && (
                        <button className="btn btn--sm btn--danger" onClick={() => setCancelTarget(wf.workflow_id)}>
                          {t("workflows.cancel")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Template Detail Panel (카탈로그 상세) ──

function TemplateDetailPanel({ template, initialObjective, onClose, onRun, onEdit, onDelete, running }: {
  template: WorkflowTemplate;
  initialObjective?: string;
  onClose: () => void;
  onRun: (body: { template_name: string; title: string; objective: string }) => void;
  onEdit: () => void;
  onDelete: () => void;
  running: boolean;
}) {
  const t = useT();
  const [currentSlug, setCurrentSlug] = useState(template.slug);
  const [title, setTitle] = useState(template.title);
  const [objective, setObjective] = useState(initialObjective ?? template.objective);
  const [hasChanges, setHasChanges] = useState(false);

  // template.slug 변경 시 로컬 편집 상태 리셋 — 렌더 중 setState (cascading 렌더 방지에 React가 최적화)
  if (currentSlug !== template.slug) {
    setCurrentSlug(template.slug);
    setTitle(template.title);
    setObjective(initialObjective ?? template.objective);
    setHasChanges(false);
  }

  const baseObjective = initialObjective ?? template.objective;

  const handleChangeTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setHasChanges(e.target.value !== template.title || objective !== baseObjective);
  };

  const handleChangeObjective = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setObjective(e.target.value);
    setHasChanges(title !== template.title || e.target.value !== baseObjective);
  };

  const handleClose = () => {
    if (hasChanges && !window.confirm(t("workflows.unsaved_changes_confirm") || "변경사항이 저장되지 않습니다. 계속하시겠습니까?")) {
      return;
    }
    onClose();
  };

  const handleRun = (e: React.FormEvent) => {
    e.preventDefault();
    onRun({ template_name: template.slug, title: title || template.title, objective });
  };

  const agent_count = template.phases.reduce((n, p) => n + p.agents.length, 0);
  const critic_count = template.phases.filter((p) => p.critic).length;

  return (
    <div className="tpl-detail">
      <div className="tpl-detail__header">
        <h3 className="mt-0 mb-0">{template.title}</h3>
        <button className="btn btn--xs btn--ghost tpl-detail__close" onClick={handleClose} aria-label="close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <p className="tpl-detail__objective">{template.objective}</p>

      <div className="tpl-detail__meta">
        <Badge status={`${template.phases.length} phases`} variant="info" />
        <Badge status={`${agent_count} agents`} variant="off" />
        {critic_count > 0 && <Badge status={`${critic_count} critics`} variant="warn" />}
      </div>

      {/* Phase 흐름 시각화 */}
      <div className="tpl-detail__flow">
        {template.phases.map((p, i) => (
          <div key={p.phase_id} className="tpl-detail__phase-step">
            {i > 0 && (
              <span className="tpl-detail__flow-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </span>
            )}
            <div className="tpl-detail__phase-box">
              <span className="tpl-detail__phase-num">{i + 1}</span>
              <div>
                <div className="tpl-detail__phase-title">{p.title}</div>
                <div className="tpl-detail__phase-info">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  {p.agents.length} {t("workflows.agents").toLowerCase()}
                  {p.critic && (
                    <span className="tpl-detail__phase-critic">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      {t("workflows.critic")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 실행 폼 */}
      <form className="tpl-detail__form" onSubmit={handleRun}>
        <div className="tpl-detail__form-row">
          <label className="label">{t("workflows.title_label")}</label>
          <input className="input" value={title} onChange={handleChangeTitle} />
        </div>
        <div className="tpl-detail__form-row">
          <label className="label">{t("workflows.objective_label")}</label>
          <textarea
            className="input"
            rows={2}
            value={objective}
            onChange={handleChangeObjective}
            placeholder={t("workflows.objective_placeholder")}
          />
        </div>
        <div className="tpl-detail__actions">
          <button type="button" className="btn btn--sm btn--ghost" onClick={onEdit}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            {t("workflows.edit_template")}
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={onDelete}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            {t("workflows.delete_template")}
          </button>
          <div className="flex-fill" />
          <button type="submit" className="btn btn--ok" disabled={running}>
            {running ? (
              <span className="btn__spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
            {running ? t("workflows.creating") : t("workflows.run_template")}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Import Modal ──

function ImportModal({ open, onClose, onImported }: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const t = useT();
  useModalEffects(open, onClose);
  const { toast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  const [yamlText, setYamlText] = useState("");

  useEffect(() => { if (open) modalRef.current?.focus(); }, [open]);

  const importMut = useMutation({
    mutationFn: (yaml_str: string) =>
      api.post<{ ok: boolean; name?: string; error?: string }>("/api/workflow/templates", { yaml: yaml_str }),
    onSuccess: (data) => {
      if (data.ok) { setYamlText(""); onImported(); }
      else toast(data.error || t("workflows.import_error"), "err");
    },
    onError: () => toast(t("workflows.import_error"), "err"),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setYamlText(await file.text());
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal modal--wide" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">{t("workflows.import_yaml")}</h3>
          <button className="modal__close btn btn--xs btn--ghost" onClick={onClose} aria-label="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal__body">
          <label className="label">{t("workflows.upload_file")}</label>
          <input type="file" accept=".yaml,.yml,.json" onChange={handleFile} className="mb-2" />
          <label className="label">YAML</label>
          <textarea
            className="input code-textarea"
            rows={16}
            value={yamlText}
            onChange={(e) => setYamlText(e.target.value)}
            placeholder={t("workflows.paste_yaml")}
          />
        </div>
        <div className="modal__footer">
          <button className="btn btn--sm btn--ghost" onClick={onClose}>{t("workflows.close")}</button>
          <button
            className="btn btn--sm btn--accent"
            disabled={!yamlText.trim() || importMut.isPending}
            onClick={() => importMut.mutate(yamlText)}
          >
            {importMut.isPending ? (
              <span className="btn__spinner" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            )}
            {t("workflows.import")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Creation Wizard Modal ──

function CreateWizardModal({ onClose, onCreateBlank, onCreateWithPrompt }: {
  onClose: () => void;
  onCreateBlank: () => void;
  onCreateWithPrompt: (prompt: string) => void;
}) {
  const t = useT();
  const [objective, setObjective] = useState("");
  useModalEffects(true, onClose);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="wf-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="wf-wizard__header">
          <h2 className="wf-wizard__title">{t("workflows.title")}</h2>
          <p className="wf-wizard__subtitle">{t("workflows.description")}</p>
          <button className="wf-wizard__close btn btn--xs btn--ghost" onClick={onClose} aria-label="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="wf-wizard__body">
          {/* Left: Steps */}
          <div className="wf-wizard__steps">
            <div className="wf-wizard__step">
              <span className="wf-wizard__step-icon">🔥</span>
              <div>
                <div className="wf-wizard__step-title">{t("workflows.wizard_step1_title")}</div>
                <div className="wf-wizard__step-desc">{t("workflows.wizard_step1_desc")}</div>
              </div>
            </div>
            <div className="wf-wizard__step">
              <span className="wf-wizard__step-icon">🔧</span>
              <div>
                <div className="wf-wizard__step-title">{t("workflows.wizard_step2_title")}</div>
                <div className="wf-wizard__step-desc">{t("workflows.wizard_step2_desc")}</div>
              </div>
            </div>
            <div className="wf-wizard__step">
              <span className="wf-wizard__step-icon">🎯</span>
              <div>
                <div className="wf-wizard__step-title">{t("workflows.wizard_step3_title")}</div>
                <div className="wf-wizard__step-desc">{t("workflows.wizard_step3_desc")}</div>
              </div>
            </div>

            <textarea
              className="wf-wizard__objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={t("workflows.quick_run_placeholder")}
              rows={3}
            />
          </div>

          {/* Right: Node Type Catalog */}
          <div className="wf-wizard__catalog">
            <div className="wf-wizard__catalog-label">{t("workflows.wizard_node_types")}</div>
            <div className="wf-wizard__catalog-grid">
              {NODE_TYPE_CATALOG.map((node) => (
                <button
                  key={node.id}
                  className="wf-wizard__node-btn"
                  style={{ "--node-color": node.color } as React.CSSProperties}
                  onClick={() => onCreateWithPrompt(objective.trim() || node.label)}
                >
                  <span className="wf-wizard__node-icon">{node.icon}</span>
                  <span className="wf-wizard__node-label">{node.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="wf-wizard__footer">
          <p className="wf-wizard__hint">{t("workflows.wizard_hint")}</p>
          <div className="wf-wizard__actions">
            <button className="btn btn--sm btn--ghost" onClick={onCreateBlank}>{t("workflows.wizard_blank")}</button>
            <button
              className="btn btn--sm btn--accent"
              disabled={!objective.trim()}
              onClick={() => onCreateWithPrompt(objective.trim())}
            >
              {t("workflows.create")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
