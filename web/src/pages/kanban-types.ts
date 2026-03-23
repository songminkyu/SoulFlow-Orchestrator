/* ─── 칸반 공유 타입 + 상수 ─── */

export interface ColumnDef { id: string; name: string; color: string; wip_limit?: number }
export interface Board { board_id: string; name: string; prefix: string; columns: ColumnDef[]; scope_type: string; scope_id: string; cards?: Card[] }
export interface Card {
  card_id: string; seq: number; board_id: string; title: string; description: string;
  column_id: string; position: number; priority: string; labels: string[];
  assignee?: string; created_by: string; task_id?: string;
  metadata: Record<string, unknown>; comment_count: number;
  participants?: string[];
  created_at: string; updated_at: string;
}
export interface Comment { comment_id: string; card_id: string; author: string; text: string; created_at: string }
export interface Relation { relation_id: string; source_card_id: string; target_card_id: string; type: string }
export interface Rule {
  rule_id: string; board_id: string; trigger: string; condition: Record<string, unknown>;
  action_type: string; action_params: Record<string, unknown>; enabled: boolean; created_at: string;
}

export type ViewMode = "board" | "list";
export type Filter = "active" | "all" | "backlog" | "done";

export const PRIORITY_ICON: Record<string, string> = { urgent: "↑↑", high: "↑", medium: "−", low: "↓", none: "" };
export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

export const FILTER_KEYS: Filter[] = ["active", "all", "backlog", "done"];
export const FILTER_I18N: Record<Filter, string> = {
  active: "kanban.filter_active", all: "kanban.filter_all",
  backlog: "kanban.filter_backlog", done: "kanban.filter_done",
};

export const SCOPE_TYPES = ["workflow", "channel", "session"] as const;

export const TRIGGER_OPTIONS = ["card_moved", "subtasks_done", "card_stale"] as const;
export const TRIGGER_LABELS: Record<string, string> = {
  card_moved: "kanban.trigger_card_moved",
  subtasks_done: "kanban.trigger_subtasks_done",
  card_stale: "kanban.trigger_card_stale",
};

export const ACTION_TYPE_OPTIONS = ["move_card", "assign", "add_label", "comment", "run_workflow", "create_task"] as const;
export const ACTION_LABELS: Record<string, string> = {
  move_card: "kanban.action_move_card", assign: "kanban.action_assign",
  add_label: "kanban.action_add_label", comment: "kanban.action_comment",
  run_workflow: "kanban.action_run_workflow", create_task: "kanban.action_create_task",
};
