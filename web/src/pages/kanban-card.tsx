import { useState } from "react";
import { useT } from "../i18n";
import { StatusBadge } from "../components/shared/status-badges";
import type { ColumnDef, Card } from "./kanban-types";
import { PRIORITY_ICON } from "./kanban-types";

/* ─── 헬퍼 ─── */

export function parse_label(label: string): { name: string; color: string } {
  const idx = label.lastIndexOf(":");
  if (idx > 0 && label[idx + 1] === "#") return { name: label.slice(0, idx), color: label.slice(idx + 1) };
  return { name: label, color: "#6b7e8f" };
}

export function Participants({ list }: { list?: string[] }) {
  if (!list || list.length === 0) return null;
  const shown = list.slice(0, 3);
  const extra = list.length - shown.length;
  return (
    <span className="kanban-participants">
      {shown.map(p => <span key={p} className="kanban-participant" title={p}>{p.startsWith("user") ? "👤" : "🤖"}</span>)}
      {extra > 0 && <span className="kanban-participant kanban-participant--extra">+{extra}</span>}
    </span>
  );
}

/* ─── 카드 아이템 ─── */

export function KanbanCardItem({ card, selected, onClick }: { card: Card; selected: boolean; onClick: () => void }) {
  const subtask_count = (card.metadata?.subtask_total as number) ?? 0;
  const subtask_done = (card.metadata?.subtask_done as number) ?? 0;

  return (
    <div className={`kanban-card ${selected ? "kanban-card--selected" : ""}`} onClick={onClick}
      role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      draggable onDragStart={(e) => { e.dataTransfer.setData("text/card-id", card.card_id); e.dataTransfer.effectAllowed = "move"; }}>
      <div className="kanban-card__id">{card.card_id}</div>
      <div className="kanban-card__title" title={card.title}>{card.title}</div>
      {card.description && <div className="kanban-card__desc" title={card.description}>{card.description}</div>}
      <div className="kanban-card__footer">
        {card.labels.length > 0 && (
          <div className="kanban-card__labels">
            {card.labels.map(l => { const { name, color } = parse_label(l); return (
              <span key={l} className="kanban-label"><span className="kanban-label__dot" style={{ background: color }} />{name}</span>
            ); })}
          </div>
        )}
        <div className="kanban-card__meta">
          {card.priority !== "none" && (
            <span className={`kanban-card__priority kanban-card__priority--${card.priority}`}>{PRIORITY_ICON[card.priority]}</span>
          )}
          {subtask_count > 0 && <span className="kanban-card__subtask-badge">{subtask_done}/{subtask_count}</span>}
          {card.comment_count > 0 && <span>💬{card.comment_count}</span>}
          <Participants list={card.participants} />
        </div>
      </div>
    </div>
  );
}

/* ─── 컬럼 ─── */

export function KanbanColumn({ column, cards, selectedCard, onSelect, onAddCard, onDrop }: {
  column: ColumnDef; cards: Card[]; selectedCard: string | null;
  onSelect: (id: string) => void; onAddCard: (title: string) => void;
  onDrop: (card_id: string) => void;
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handle_add = () => {
    if (newTitle.trim()) { onAddCard(newTitle.trim()); setNewTitle(""); setAdding(false); }
  };

  const over_wip = !!(column.wip_limit && cards.length > column.wip_limit);

  return (
    <div className={`kanban-col${dragOver ? " kanban-col--drag-over" : ""}${over_wip ? " kanban-col--over-wip" : ""}`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); }}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData("text/card-id"); if (id) onDrop(id); }}>
      <div className="kanban-col__header">
        <span className="kanban-col__dot" style={{ background: column.color }} />
        {column.name}
        <StatusBadge
          variant={over_wip ? "warn" : "off"}
          label={`${cards.length}${column.wip_limit ? `/${column.wip_limit}` : ""}`}
          size="sm"
          className="kanban-col__count-badge"
        />
        <button className="kanban-col__add" onClick={() => setAdding(true)} aria-label={`${column.name} add card`}>+</button>
      </div>
      <div className="kanban-col__cards">
        {adding && (
          <div className="kanban-inline-add">
            <input autoFocus placeholder={t("kanban.issue_title_placeholder")} value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handle_add(); if (e.key === "Escape") { setAdding(false); setNewTitle(""); } }}
              onBlur={() => { if (newTitle.trim()) handle_add(); else setAdding(false); }} />
          </div>
        )}
        {cards.map(card => (
          <KanbanCardItem key={card.card_id} card={card} selected={card.card_id === selectedCard} onClick={() => onSelect(card.card_id)} />
        ))}
        {cards.length === 0 && !adding && (
          <div className="kanban-col__empty">{t("kanban.empty_column")}</div>
        )}
      </div>
    </div>
  );
}

/* ─── 보드 뷰 ─── */

export function BoardView({ columns, cards, selectedCard, onSelect, onAddCard, onMoveCard }: {
  columns: ColumnDef[]; cards: Card[]; selectedCard: string | null;
  onSelect: (id: string) => void; onAddCard: (col: string, title: string) => void;
  onMoveCard: (card_id: string, col: string) => void;
}) {
  return (
    <div className="kanban-board">
      {columns.map(col => {
        const col_cards = cards.filter(c => c.column_id === col.id).sort((a, b) => a.position - b.position);
        return (
          <KanbanColumn key={col.id} column={col} cards={col_cards} selectedCard={selectedCard}
            onSelect={onSelect} onAddCard={(title) => onAddCard(col.id, title)}
            onDrop={(card_id) => onMoveCard(card_id, col.id)} />
        );
      })}
    </div>
  );
}
