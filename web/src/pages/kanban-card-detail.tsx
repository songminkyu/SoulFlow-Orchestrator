import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { DeleteConfirmModal } from "../components/modal";
import { useT } from "../i18n";
import { time_ago } from "../utils/format";
import { useAsyncAction } from "../hooks/use-async-action";
import type { ColumnDef, Card, Comment, Relation } from "./kanban-types";
import { PRIORITIES, PRIORITY_ICON } from "./kanban-types";
import { parse_label, Participants } from "./kanban-card";

export function CardDetailPanel({ card_id, columns, onClose, onUpdate, onMove, onDelete, onSelectCard }: {
  card_id: string; columns: ColumnDef[];
  onClose: () => void; onUpdate: (id: string, data: Record<string, unknown>) => void;
  onMove: (id: string, col: string) => void; onDelete: (id: string) => void;
  onSelectCard: (id: string) => void;
}) {
  const t = useT();
  const run_action = useAsyncAction();
  const [commentText, setCommentText] = useState("");
  const [confirmDeleteCard, setConfirmDeleteCard] = useState(false);

  const { data: card } = useQuery<Card>({
    queryKey: ["kanban-card", card_id],
    queryFn: () => api.get<Card>(`/api/kanban/cards/${encodeURIComponent(card_id)}`),
    enabled: !!card_id,
  });

  const { data: comments } = useQuery<Comment[]>({
    queryKey: ["kanban-comments", card_id],
    queryFn: () => api.get(`/api/kanban/cards/${encodeURIComponent(card_id)}/comments`),
    enabled: !!card_id,
  });

  const { data: relations } = useQuery<Relation[]>({
    queryKey: ["kanban-relations", card_id],
    queryFn: () => api.get(`/api/kanban/cards/${encodeURIComponent(card_id)}/relations`),
    enabled: !!card_id,
  });

  const { data: subtasks } = useQuery<Card[]>({
    queryKey: ["kanban-subtasks", card_id],
    queryFn: () => api.get(`/api/kanban/cards/${encodeURIComponent(card_id)}/subtasks`),
    enabled: !!card_id,
  });

  const qc = useQueryClient();

  const add_comment = () => {
    if (!commentText.trim()) return;
    void run_action(
      () => api.post(`/api/kanban/cards/${encodeURIComponent(card_id)}/comments`, { text: commentText.trim() })
        .then(() => { setCommentText(""); void qc.invalidateQueries({ queryKey: ["kanban-comments", card_id] }); }),
      undefined,
      t("kanban.comment_failed"),
    );
  };

  if (!card) return <div className="kanban-detail"><div className="kanban-detail__loading">{t("kanban.loading")}</div></div>;

  const col = columns.find(c => c.id === card.column_id);
  const meta = card.metadata;
  const non_subtask_relations = (relations ?? []).filter(r => r.type !== "parent_of" && r.type !== "child_of");
  const done_count = (subtasks ?? []).filter(s => s.column_id === "done").length;
  const total_count = subtasks?.length ?? 0;

  return (
    <div className="kanban-detail">
      <div className="kanban-detail__header">
        <span className="kanban-detail__card-id">{card.card_id}</span>
        <button className="kanban-detail__close" onClick={onClose} aria-label={t("common.close")}>✕</button>
      </div>
      <div className="kanban-detail__body">
        {/* Meta */}
        <div className="kanban-detail__meta">
          <span className="kanban-detail__badge">
            <span className="kanban-col__dot" style={{ background: col?.color ?? "#6b7e8f" }} />
            {col?.name ?? card.column_id}
          </span>
          <select className="kanban-detail__select" value={card.priority} aria-label={t("kanban.priority")}
            onChange={(e) => onUpdate(card.card_id, { priority: e.target.value })}>
            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_ICON[p]} {p}</option>)}
          </select>
          <input key={`assignee-${card.updated_at}`} className="kanban-detail__assignee-input" defaultValue={card.assignee ?? ""} placeholder={t("kanban.assignee_placeholder")} aria-label={t("kanban.assignee")}
            onBlur={(e) => { const v = e.target.value.trim(); if (v !== (card.assignee ?? "")) onUpdate(card.card_id, { assignee: v || null }); }} />
          <span className="kanban-detail__badge">{card.created_by}</span>
          <Participants list={card.participants} />
        </div>

        {/* Column selector */}
        <div className="kanban-detail__col-selector">
          {columns.map(c => (
            <button key={c.id} className={`kanban-filters__btn ${c.id === card.column_id ? "kanban-filters__btn--active" : ""}`}
              onClick={() => onMove(card.card_id, c.id)}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Title */}
        <input key={`title-${card.updated_at}`} className="kanban-detail__title" defaultValue={card.title}
          onBlur={(e) => { if (e.target.value !== card.title) onUpdate(card.card_id, { title: e.target.value }); }} />

        {/* Labels */}
        <div className="kanban-card__labels kanban-detail__labels">
          {card.labels.map(l => { const { name, color } = parse_label(l); return (
            <span key={l} className="kanban-label">
              <span className="kanban-label__dot" style={{ background: color }} />{name}
              <button className="kanban-label__remove" aria-label={`Remove ${name}`}
                onClick={() => onUpdate(card.card_id, { labels: card.labels.filter(x => x !== l) })}>✕</button>
            </span>
          ); })}
          <input className="kanban-detail__label-input" placeholder={t("kanban.label_placeholder")} size={10}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); const v = (e.target as HTMLInputElement).value.trim(); if (v && !card.labels.includes(v)) { onUpdate(card.card_id, { labels: [...card.labels, v] }); (e.target as HTMLInputElement).value = ""; } } }} />
        </div>

        {/* Description */}
        <textarea key={`desc-${card.updated_at}`} className="kanban-detail__desc" defaultValue={card.description} placeholder={t("kanban.no_description")}
          onBlur={(e) => { if (e.target.value !== card.description) onUpdate(card.card_id, { description: e.target.value }); }} />

        {/* Subtasks */}
        {total_count > 0 && (
          <div className="kanban-detail__section">
            <div className="kanban-detail__section-title">{t("kanban.subtasks")} ({done_count}/{total_count})</div>
            <div className="kanban-subtasks__progress">
              <div className="kanban-subtasks__progress-bar" style={{ width: `${total_count > 0 ? (done_count / total_count) * 100 : 0}%` }} />
            </div>
            {(subtasks ?? []).map(s => (
              <div key={s.card_id} className={`kanban-subtask-item ${s.column_id === "done" ? "kanban-subtask-item--done" : ""}`}
                onClick={() => onSelectCard(s.card_id)} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectCard(s.card_id); } }}>
                <span>{s.column_id === "done" ? "☑" : "☐"}</span>
                <span className="kanban-subtask-item__id">{s.card_id}</span>
                <span>{s.title}</span>
                <span className="kanban-subtask-item__col">{s.column_id}</span>
              </div>
            ))}
          </div>
        )}

        {/* Workspaces */}
        {!!(meta?.branch || meta?.pr_url || meta?.files) && (
          <div className="kanban-detail__section">
            <div className="kanban-detail__section-title">{t("kanban.workspaces")}</div>
            <div className="kanban-workspace">
              {!!meta.branch && <div className="kanban-workspace__stat">🔀 {String(meta.branch)}</div>}
              {!!meta.pr_url && <div className="kanban-workspace__stat"><a href={String(meta.pr_url)} target="_blank" rel="noopener" className="kanban-workspace__link">PR #{String(meta.pr_number ?? "")}</a></div>}
              {Array.isArray(meta.files) && <div className="kanban-workspace__stat">📁 {t("kanban.files_count", { count: meta.files.length })}</div>}
              {typeof meta.lines_added === "number" && <div className="kanban-workspace__stat kanban-workspace__stat--added">+{Number(meta.lines_added)}</div>}
              {typeof meta.lines_removed === "number" && <div className="kanban-workspace__stat kanban-workspace__stat--removed">-{Number(meta.lines_removed)}</div>}
            </div>
          </div>
        )}

        {/* Relations */}
        {non_subtask_relations.length > 0 && (
          <div className="kanban-detail__section">
            <div className="kanban-detail__section-title">{t("kanban.relationships")}</div>
            {non_subtask_relations.map(r => {
              const target = r.source_card_id === card.card_id ? r.target_card_id : r.source_card_id;
              return (
                <div key={r.relation_id} className="kanban-relation">
                  <span className="kanban-relation__type">{r.type}</span>
                  <button className="kanban-relation__target" onClick={() => onSelectCard(target)}>{target}</button>
                </div>
              );
            })}
          </div>
        )}

        {/* Comments */}
        <div className="kanban-detail__section">
          <div className="kanban-detail__section-title">{t("kanban.comments")} ({comments?.length ?? 0})</div>
          {(comments ?? []).map(c => (
            <div key={c.comment_id} className="kanban-comment">
              <div className="kanban-comment__author">{c.author}</div>
              <div className="kanban-comment__text">{c.text}</div>
              <div className="kanban-comment__time">{time_ago(c.created_at)}</div>
            </div>
          ))}
          <div className="kanban-comment-input">
            <textarea placeholder={t("kanban.add_comment_hint")} value={commentText} onChange={e => setCommentText(e.target.value)}
              aria-label={t("kanban.add_comment")}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) { e.preventDefault(); add_comment(); } }} />
            <button onClick={add_comment} disabled={!commentText.trim()}>{t("kanban.post")}</button>
          </div>
        </div>

        {/* Delete */}
        <button className="kanban-detail__delete" onClick={() => setConfirmDeleteCard(true)}>
          {t("kanban.delete_card")}
        </button>
        <DeleteConfirmModal
          open={confirmDeleteCard}
          title={t("kanban.delete_card")}
          message={t("kanban.confirm_delete_card", { id: card.card_id })}
          onClose={() => setConfirmDeleteCard(false)}
          onConfirm={() => { setConfirmDeleteCard(false); onDelete(card.card_id); }}
          confirmLabel={t("kanban.delete_card")}
        />
      </div>
    </div>
  );
}
