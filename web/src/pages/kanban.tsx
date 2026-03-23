import { useState, useRef, useEffect } from "react";
import { useClickOutside } from "../hooks/use-click-outside";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { create_sse } from "../api/sse";
import { SearchInput } from "../components/search-input";
import { DeleteConfirmModal } from "../components/modal";
import { useT } from "../i18n";
import { useAsyncAction } from "../hooks/use-async-action";
import { useDeleteConfirmation } from "../hooks/use-delete-confirmation";
import { usePageAccess } from "../hooks/use-page-access";
import { get_page_policy } from "./access-policy";
import type { Board, Card, ColumnDef, ViewMode, Filter } from "./kanban-types";
import { FILTER_KEYS, FILTER_I18N } from "./kanban-types";
import { BoardView } from "./kanban-card";
import { ListView } from "./kanban-list-view";
import { CardDetailPanel } from "./kanban-card-detail";
import { CreateBoardModal } from "./kanban-board-modal";
import { RulesPanel } from "./kanban-rules";
import "../styles/kanban.css";

/* ─── SSE 실시간 구독 ─── */

function useKanbanSSE(board_id: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!board_id) return;
    const sse = create_sse(`/api/kanban/boards/${encodeURIComponent(board_id)}/events`, {
      activity: () => {
        void qc.invalidateQueries({ queryKey: ["kanban-board", board_id] });
        void qc.invalidateQueries({ queryKey: ["kanban-boards"] });
      },
    });
    return () => sse.close();
  }, [board_id, qc]);
}

/* ═══ Main Page ═══ */

export default function KanbanPage() {
  const t = useT();
  const qc = useQueryClient();
  const run_action = useAsyncAction();
  const [params, setParams] = useSearchParams();
  const { can_manage } = usePageAccess(get_page_policy("/kanban")!);

  const board_id_param = params.get("board") || "";
  const view = (params.get("view") as ViewMode) || "board";
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showBoardSelector, setShowBoardSelector] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  const set_view = (v: ViewMode) => setParams((p) => { p.set("view", v); return p; }, { replace: true });
  const set_board = (id: string) => { setParams((p) => { p.set("board", id); return p; }, { replace: true }); setSelectedCard(null); };

  useClickOutside(selectorRef, () => setShowBoardSelector(false), showBoardSelector);
  useEffect(() => {
    if (!showBoardSelector) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowBoardSelector(false); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [showBoardSelector]);

  /* ─── Queries ─── */

  const { data: boards } = useQuery<Board[]>({
    queryKey: ["kanban-boards"],
    queryFn: () => api.get("/api/kanban/boards"),
  });

  const board_id = board_id_param || boards?.[0]?.board_id || "";

  useKanbanSSE(board_id);

  const { data: boardDetail, isPending: boardLoading } = useQuery<Board>({
    queryKey: ["kanban-board", board_id],
    queryFn: () => api.get(`/api/kanban/boards/${encodeURIComponent(board_id)}`),
    enabled: !!board_id,
  });

  const cards = boardDetail?.cards ?? [];
  const columns: ColumnDef[] = boardDetail?.columns ?? [];

  /* ─── Filter ─── */

  const filtered_cards = (() => {
    let result = cards;
    if (filter === "active") result = result.filter((c: Card) => c.column_id !== "done");
    else if (filter === "backlog") result = result.filter((c: Card) => c.column_id === "todo");
    else if (filter === "done") result = result.filter((c: Card) => c.column_id === "done");
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: Card) => c.title.toLowerCase().includes(q) || c.card_id.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    return result;
  })();

  const refresh = () => void qc.invalidateQueries({ queryKey: ["kanban-board", board_id] });
  const refresh_boards = () => void qc.invalidateQueries({ queryKey: ["kanban-boards"] });

  /* ─── Actions ─── */

  const create_board = (name: string, scope_type: string, scope_id: string) =>
    run_action(
      async () => {
        const board = await api.post<Board>("/api/kanban/boards", { name, scope_type, scope_id });
        refresh_boards();
        set_board(board.board_id);
        setShowCreateBoard(false);
      },
      t("kanban.board_created"),
      t("kanban.create_failed"),
    );

  const { deleteTarget: deleteBoardTarget, setDeleteTarget: setDeleteBoardTarget,
    confirmDelete: confirm_delete_board, modalOpen: deleteBoardModalOpen, closeModal: closeBoardDeleteModal } =
    useDeleteConfirmation<Board>({
      getEndpoint: (b) => `/api/kanban/boards/${encodeURIComponent(b.board_id)}`,
      onDeleted: (b) => {
        refresh_boards();
        if (b.board_id === board_id) setParams((p) => { p.delete("board"); return p; }, { replace: true });
      },
      okMsg: t("kanban.board_deleted"),
      errMsg: t("kanban.delete_failed"),
    });

  const add_card = (column_id: string, title: string) => {
    if (!title.trim() || !board_id) return Promise.resolve();
    return run_action(
      () => api.post(`/api/kanban/boards/${encodeURIComponent(board_id)}/cards`, { title, column_id }).then(refresh),
      undefined,
      t("kanban.create_failed"),
    );
  };

  const move_card = (card_id: string, column_id: string) =>
    run_action(
      () => api.put(`/api/kanban/cards/${encodeURIComponent(card_id)}`, { column_id }).then(refresh),
      undefined,
      t("kanban.move_failed"),
    );

  const update_card = (card_id: string, data: Record<string, unknown>) =>
    run_action(
      () => api.put(`/api/kanban/cards/${encodeURIComponent(card_id)}`, data).then(refresh),
      undefined,
      t("kanban.update_failed"),
    );

  const delete_card = (card_id: string) =>
    run_action(
      () => api.del(`/api/kanban/cards/${encodeURIComponent(card_id)}`).then(() => {
        if (selectedCard === card_id) setSelectedCard(null);
        refresh();
      }),
      t("kanban.card_deleted"),
      t("kanban.delete_failed"),
    );

  /* ─── No board ─── */

  if (!board_id && (!boards || boards.length === 0)) {
    return (
      <div className="page">
        <div className="kanban-empty">
          <div className="kanban-empty__icon">📋</div>
          <div>{t("kanban.no_boards")}</div>
          {can_manage && <button className="btn btn--accent kanban-empty__btn" onClick={() => setShowCreateBoard(true)}>
            + {t("kanban.new_board")}
          </button>}
        </div>
        <CreateBoardModal open={showCreateBoard} onClose={() => setShowCreateBoard(false)} onCreate={create_board} />
      </div>
    );
  }

  /* ─── Render ─── */

  return (
    <div className="kanban-page">
      {/* Header */}
      <div className="kanban-header">
        <div className="board-selector" ref={selectorRef}>
          <button className="kanban-header__title" onClick={() => setShowBoardSelector(!showBoardSelector)}
            aria-expanded={showBoardSelector} aria-haspopup="listbox">
            {boardDetail?.name ?? "..."} ▾
          </button>
          {showBoardSelector && boards && (
            <div className="board-selector__dropdown" role="listbox">
              {boards.map(b => (
                <div key={b.board_id} className={`board-selector__item ${b.board_id === board_id ? "board-selector__item--active" : ""}`} role="option" aria-selected={b.board_id === board_id}>
                  <button className="board-selector__item-name"
                    onClick={() => { set_board(b.board_id); setShowBoardSelector(false); }}>
                    {b.name}
                    <span className="board-selector__item-scope">{b.scope_type}:{b.scope_id}</span>
                  </button>
                  {can_manage && <button className="board-selector__item-del" title={t("kanban.delete_board")}
                    aria-label={t("kanban.delete_board")}
                    onClick={(e) => { e.stopPropagation(); setDeleteBoardTarget(b); }}>
                    ✕
                  </button>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="kanban-header__actions">
          <div className="view-toggle" role="tablist">
            <button id="kanban-tab-board" className={`view-toggle__btn ${view === "board" ? "view-toggle__btn--active" : ""}`}
              role="tab" aria-selected={view === "board"} aria-controls="kanban-panel-board" onClick={() => set_view("board")}>{t("kanban.view_board")}</button>
            <button id="kanban-tab-list" className={`view-toggle__btn ${view === "list" ? "view-toggle__btn--active" : ""}`}
              role="tab" aria-selected={view === "list"} aria-controls="kanban-panel-list" onClick={() => set_view("list")}>{t("kanban.view_list")}</button>
          </div>
          <div className="kanban-filters">
            {FILTER_KEYS.map(f => (
              <button key={f} className={`kanban-filters__btn ${filter === f ? "kanban-filters__btn--active" : ""}`} onClick={() => setFilter(f)}>
                {t(FILTER_I18N[f])}
              </button>
            ))}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder={t("kanban.search")} onClear={() => setSearch("")} className="kanban-search" />
          {board_id && <button className={`btn btn--sm ${showRules ? "btn--accent" : ""}`} onClick={() => setShowRules(!showRules)}>{t("kanban.rules")}</button>}
          {can_manage && boardDetail && (
            <button className="btn btn--sm btn--danger" title={t("kanban.delete_board")} aria-label={t("kanban.delete_board")}
              onClick={() => setDeleteBoardTarget(boardDetail)}>
              🗑
            </button>
          )}
          {can_manage && <button className="btn btn--accent btn--sm" onClick={() => setShowCreateBoard(true)}>+ {t("kanban.new_board")}</button>}
        </div>
      </div>
      <CreateBoardModal open={showCreateBoard} onClose={() => setShowCreateBoard(false)} onCreate={create_board} />

      <DeleteConfirmModal
        open={deleteBoardModalOpen}
        title={t("kanban.delete_board")}
        message={deleteBoardTarget ? t("kanban.confirm_delete_board", { name: deleteBoardTarget.name }) : ""}
        onClose={closeBoardDeleteModal}
        onConfirm={confirm_delete_board}
        confirmLabel={t("kanban.delete_board")}
      />

      {showRules && board_id && <RulesPanel board_id={board_id} columns={columns} onClose={() => setShowRules(false)} />}

      {/* Body */}
      <div className="kanban-body">
        {boardLoading && board_id ? (
          <div className="kanban-loading">
            <div className="spinner" aria-label={t("kanban.loading")}></div>
            <p>{t("kanban.loading")}</p>
          </div>
        ) : (
          <>
            {view === "board"
              ? <div id="kanban-panel-board" role="tabpanel" aria-labelledby="kanban-tab-board"><BoardView columns={columns} cards={filtered_cards} selectedCard={selectedCard} onSelect={setSelectedCard} onAddCard={add_card} onMoveCard={move_card} /></div>
              : <div id="kanban-panel-list" role="tabpanel" aria-labelledby="kanban-tab-list"><ListView cards={filtered_cards} columns={columns} selectedCard={selectedCard} onSelect={setSelectedCard} /></div>
            }

            {selectedCard && (
              <CardDetailPanel card_id={selectedCard} columns={columns}
                onClose={() => setSelectedCard(null)} onUpdate={update_card} onMove={move_card} onDelete={delete_card}
                onSelectCard={setSelectedCard} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
