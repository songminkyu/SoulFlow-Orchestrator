import { useState } from "react";
import { useT } from "../i18n";
import { time_ago } from "../utils/format";
import type { ColumnDef, Card } from "./kanban-types";
import { PRIORITY_ICON, PRIORITY_ORDER } from "./kanban-types";

export function ListView({ cards, columns, selectedCard, onSelect }: {
  cards: Card[]; columns: ColumnDef[]; selectedCard: string | null; onSelect: (id: string) => void;
}) {
  const t = useT();
  const [sortKey, setSortKey] = useState<"priority" | "updated_at" | "card_id">("priority");
  const [sortAsc, setSortAsc] = useState(true);

  const col_map = new Map(columns.map(c => [c.id, c]));

  const sorted = (() => {
    const arr = [...cards];
    arr.sort((a, b) => {
      const cmp = sortKey === "priority"
        ? (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
        : sortKey === "updated_at" ? b.updated_at.localeCompare(a.updated_at)
        : a.card_id.localeCompare(b.card_id);
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  })();

  const toggle_sort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const sort_indicator = (key: typeof sortKey) => sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

  return (
    <div className="kanban-list">
      <table>
        <thead>
          <tr>
            <th role="button" tabIndex={0} onClick={() => toggle_sort("priority")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle_sort("priority"); } }}>{t("kanban.priority")}{sort_indicator("priority")}</th>
            <th role="button" tabIndex={0} onClick={() => toggle_sort("card_id")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle_sort("card_id"); } }}>{t("kanban.id")}{sort_indicator("card_id")}</th>
            <th>{t("kanban.title")}</th>
            <th>{t("kanban.status")}</th>
            <th>{t("kanban.assignee")}</th>
            <th role="button" tabIndex={0} onClick={() => toggle_sort("updated_at")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle_sort("updated_at"); } }}>{t("kanban.updated")}{sort_indicator("updated_at")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(card => {
            const col = col_map.get(card.column_id);
            return (
              <tr key={card.card_id} className={card.card_id === selectedCard ? "kanban-list__row--selected" : ""} tabIndex={0} onClick={() => onSelect(card.card_id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(card.card_id); } }}>
                <td><span className={`kanban-card__priority kanban-card__priority--${card.priority}`}>{PRIORITY_ICON[card.priority] || "—"}</span></td>
                <td className="kanban-list__cell--id">{card.card_id}</td>
                <td>{card.title}</td>
                <td>
                  <span className="kanban-list__status">
                    <span className="kanban-col__dot" style={{ background: col?.color ?? "#6b7e8f" }} />
                    {col?.name ?? card.column_id}
                  </span>
                </td>
                <td className="kanban-list__cell--muted">{card.assignee ?? "—"}</td>
                <td className="kanban-list__cell--muted kanban-list__cell--xs">{time_ago(card.updated_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
