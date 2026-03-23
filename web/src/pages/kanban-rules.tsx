import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useT } from "../i18n";
import { useAsyncAction } from "../hooks/use-async-action";
import { useConfirm } from "../components/modal";
import type { ColumnDef, Rule } from "./kanban-types";
import { TRIGGER_OPTIONS, TRIGGER_LABELS, ACTION_TYPE_OPTIONS, ACTION_LABELS } from "./kanban-types";

export function RulesPanel({ board_id, columns, onClose }: { board_id: string; columns: ColumnDef[]; onClose: () => void }) {
  const t = useT();
  const run_action = useAsyncAction();
  const qc = useQueryClient();
  const { confirm, dialog: confirm_dialog } = useConfirm();
  const [showCreate, setShowCreate] = useState(false);

  const { data: rules } = useQuery<Rule[]>({
    queryKey: ["kanban-rules", board_id],
    queryFn: () => api.get(`/api/kanban/boards/${encodeURIComponent(board_id)}/rules`),
    enabled: !!board_id,
  });

  const toggle_rule = (rule: Rule) => void run_action(
    () => api.put(`/api/kanban/rules/${encodeURIComponent(rule.rule_id)}`, { enabled: !rule.enabled })
      .then(() => { void qc.invalidateQueries({ queryKey: ["kanban-rules", board_id] }); }),
    undefined,
    t("kanban.update_failed"),
  );

  const delete_rule = (rule_id: string) => confirm(
    t("kanban.confirm_delete_rule"),
    () => void run_action(
      () => api.del(`/api/kanban/rules/${encodeURIComponent(rule_id)}`)
        .then(() => { void qc.invalidateQueries({ queryKey: ["kanban-rules", board_id] }); }),
      t("kanban.rule_deleted"),
      t("kanban.delete_failed"),
    ),
  );

  return (
    <div className="kanban-rules">
      <div className="kanban-rules__header">
        <span className="kanban-rules__title">{t("kanban.rules")}</span>
        <button className="btn btn--accent btn--sm" onClick={() => setShowCreate(true)}>+ {t("kanban.new_rule")}</button>
        <button className="kanban-detail__close" onClick={onClose} aria-label={t("common.close")}>✕</button>
      </div>
      <div className="kanban-rules__list">
        {(!rules || rules.length === 0) && <div className="kanban-rules__empty">{t("kanban.no_rules")}</div>}
        {(rules ?? []).map(rule => (
          <div key={rule.rule_id} className={`kanban-rules__item ${rule.enabled ? "" : "kanban-rules__item--disabled"}`}>
            <label className="kanban-rules__toggle">
              <input type="checkbox" checked={rule.enabled} onChange={() => toggle_rule(rule)} />
            </label>
            <div className="kanban-rules__info">
              <span className="kanban-rules__trigger">{TRIGGER_LABELS[rule.trigger] ? t(TRIGGER_LABELS[rule.trigger]!) : rule.trigger}</span>
              <span className="kanban-rules__arrow">→</span>
              <span className="kanban-rules__action">{ACTION_LABELS[rule.action_type] ? t(ACTION_LABELS[rule.action_type]!) : rule.action_type}</span>
              {Object.keys(rule.condition).length > 0 && (
                <span className="kanban-rules__condition" title={JSON.stringify(rule.condition)}>
                  {Object.entries(rule.condition).map(([k, v]) => `${k}=${v}`).join(", ")}
                </span>
              )}
            </div>
            <button className="kanban-rules__delete" onClick={() => delete_rule(rule.rule_id)} aria-label={t("kanban.delete_rule")}>✕</button>
          </div>
        ))}
      </div>
      {showCreate && <CreateRuleForm board_id={board_id} columns={columns} onClose={() => setShowCreate(false)} onCreated={() => {
        setShowCreate(false);
        void qc.invalidateQueries({ queryKey: ["kanban-rules", board_id] });
      }} />}
      {confirm_dialog}
    </div>
  );
}

function CreateRuleForm({ board_id, columns, onClose, onCreated }: { board_id: string; columns: ColumnDef[]; onClose: () => void; onCreated: () => void }) {
  const t = useT();
  const run_action = useAsyncAction();
  const [trigger, setTrigger] = useState<string>("card_moved");
  const [actionType, setActionType] = useState<string>("move_card");

  const [condToCol, setCondToCol] = useState("");
  const [condFromCol, setCondFromCol] = useState("");
  const [condStaleHours, setCondStaleHours] = useState(48);

  const [paramColId, setParamColId] = useState("");
  const [paramAssignee, setParamAssignee] = useState("");
  const [paramLabel, setParamLabel] = useState("");
  const [paramLabelColor, setParamLabelColor] = useState("#3b82f6");
  const [paramCommentText, setParamCommentText] = useState("");
  const [paramWorkflow, setParamWorkflow] = useState("");
  const [paramTaskTitle, setParamTaskTitle] = useState("");

  const build_condition = (): Record<string, unknown> => {
    if (trigger === "card_moved") {
      const c: Record<string, unknown> = {};
      if (condToCol) c.to_column = condToCol;
      if (condFromCol) c.from_column = condFromCol;
      return c;
    }
    if (trigger === "card_stale") return { stale_hours: condStaleHours };
    return {};
  };

  const build_params = (): Record<string, unknown> => {
    if (actionType === "move_card") return { column_id: paramColId };
    if (actionType === "assign") return { assignee: paramAssignee };
    if (actionType === "add_label") return { label: paramLabel, color: paramLabelColor };
    if (actionType === "comment") return { text: paramCommentText };
    if (actionType === "run_workflow") return { workflow_name: paramWorkflow };
    if (actionType === "create_task") {
      const p: Record<string, unknown> = { title: paramTaskTitle };
      if (paramColId) p.column_id = paramColId;
      return p;
    }
    return {};
  };

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run_action(
      () => api.post(`/api/kanban/boards/${encodeURIComponent(board_id)}/rules`, {
        trigger, action_type: actionType,
        condition: build_condition(), action_params: build_params(),
      }).then(() => onCreated()),
      t("kanban.rule_created"),
      t("kanban.create_failed"),
    );
  };

  return (
    <form className="kanban-rules__form" onSubmit={handle_submit}>
      <div className="kanban-rules__form-row">
        <div className="kanban-rules__form-field">
          <label className="form-label">{t("kanban.trigger")}</label>
          <select autoFocus className="form-input" value={trigger} onChange={e => setTrigger(e.target.value)}>
            {TRIGGER_OPTIONS.map(tr => <option key={tr} value={tr}>{TRIGGER_LABELS[tr] ? t(TRIGGER_LABELS[tr]!) : tr}</option>)}
          </select>
        </div>
        <div className="kanban-rules__form-field">
          <label className="form-label">{t("kanban.action_type")}</label>
          <select className="form-input" value={actionType} onChange={e => setActionType(e.target.value)}>
            {ACTION_TYPE_OPTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a] ? t(ACTION_LABELS[a]!) : a}</option>)}
          </select>
        </div>
      </div>

      {trigger === "card_moved" && (
        <div className="kanban-rules__form-row">
          <div className="kanban-rules__form-field">
            <label className="form-label">{t("kanban.condition_from_col")}</label>
            <select className="form-input" value={condFromCol} onChange={e => setCondFromCol(e.target.value)}>
              <option value="">{t("kanban.any_column")}</option>
              {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="kanban-rules__form-field">
            <label className="form-label">{t("kanban.condition_to_col")}</label>
            <select className="form-input" value={condToCol} onChange={e => setCondToCol(e.target.value)}>
              <option value="">{t("kanban.any_column")}</option>
              {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}
      {trigger === "card_stale" && (
        <div className="kanban-rules__form-field">
          <label className="form-label">{t("kanban.condition_stale_hours")}</label>
          <input className="form-input" type="number" min={1} value={condStaleHours} onChange={e => setCondStaleHours(Number(e.target.value))} />
        </div>
      )}

      {actionType === "move_card" && (
        <div className="kanban-rules__form-field">
          <label className="form-label">{t("kanban.param_target_col")}</label>
          <select className="form-input" value={paramColId} onChange={e => setParamColId(e.target.value)}>
            <option value="">{t("kanban.select_column")}</option>
            {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {actionType === "assign" && (
        <div className="kanban-rules__form-field">
          <label className="form-label">{t("kanban.assignee")}</label>
          <input className="form-input" value={paramAssignee} onChange={e => setParamAssignee(e.target.value)} placeholder={t("kanban.assignee_placeholder")} />
        </div>
      )}
      {actionType === "add_label" && (
        <div className="kanban-rules__form-row">
          <div className="kanban-rules__form-field">
            <label className="form-label">{t("kanban.param_label_name")}</label>
            <input className="form-input" value={paramLabel} onChange={e => setParamLabel(e.target.value)} placeholder="bug" />
          </div>
          <div className="kanban-rules__form-field">
            <label className="form-label">{t("kanban.param_label_color")}</label>
            <input className="form-input" type="color" value={paramLabelColor} onChange={e => setParamLabelColor(e.target.value)} />
          </div>
        </div>
      )}
      {actionType === "comment" && (
        <div className="kanban-rules__form-field">
          <label className="form-label">{t("kanban.param_comment_text")}</label>
          <input className="form-input" value={paramCommentText} onChange={e => setParamCommentText(e.target.value)} placeholder={t("kanban.param_comment_placeholder")} />
        </div>
      )}
      {actionType === "run_workflow" && (
        <div className="kanban-rules__form-field">
          <label className="form-label">{t("kanban.param_workflow_name")}</label>
          <input className="form-input" value={paramWorkflow} onChange={e => setParamWorkflow(e.target.value)} />
        </div>
      )}
      {actionType === "create_task" && (
        <div className="kanban-rules__form-row">
          <div className="kanban-rules__form-field">
            <label className="form-label">{t("kanban.param_task_title")}</label>
            <input className="form-input" value={paramTaskTitle} onChange={e => setParamTaskTitle(e.target.value)} />
          </div>
          <div className="kanban-rules__form-field">
            <label className="form-label">{t("kanban.param_target_col")}</label>
            <select className="form-input" value={paramColId} onChange={e => setParamColId(e.target.value)}>
              <option value="">{t("kanban.select_column")}</option>
              {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}

      <div className="kanban-rules__form-actions">
        <button type="submit" className="btn btn--accent btn--sm">{t("kanban.create_rule")}</button>
        <button type="button" className="btn btn--sm" onClick={onClose}>{t("common.cancel")}</button>
      </div>
    </form>
  );
}
