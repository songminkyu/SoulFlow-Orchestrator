/** 칸반 스토어 공개 타입 정의. kanban-store.ts에서 re-export됨. */

/* ─── 기본 타입 ─── */

export type ScopeType = "channel" | "session" | "workflow";
export type Priority = "urgent" | "high" | "medium" | "low" | "none";
export type RelationType = "blocked_by" | "blocks" | "related_to" | "parent_of" | "child_of";

export interface KanbanColumnDef {
  id: string;
  name: string;
  color: string;
  wip_limit?: number;
}

export interface KanbanBoard {
  board_id: string;
  name: string;
  prefix: string;
  next_seq: number;
  scope_type: ScopeType;
  scope_id: string;
  columns: KanbanColumnDef[];
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  card_id: string;
  seq: number;
  board_id: string;
  title: string;
  description: string;
  column_id: string;
  position: number;
  priority: Priority;
  labels: string[];
  assignee?: string;
  created_by: string;
  task_id?: string;
  due_date?: string;
  metadata: Record<string, unknown>;
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanComment {
  comment_id: string;
  card_id: string;
  author: string;
  text: string;
  created_at: string;
}

export interface KanbanRelation {
  relation_id: string;
  source_card_id: string;
  target_card_id: string;
  type: RelationType;
}

export type ActivityAction = "created" | "moved" | "updated" | "archived" | "commented"
  | "relation_added" | "relation_removed" | "assigned" | "priority_changed" | "labels_changed" | "due_date_set";

export interface KanbanActivity {
  activity_id: string;
  card_id: string;
  board_id: string;
  actor: string;
  action: ActivityAction;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface KanbanRule {
  rule_id: string;
  board_id: string;
  trigger: "card_moved" | "subtasks_done" | "card_stale";
  condition: Record<string, unknown>;
  action_type: "move_card" | "assign" | "add_label" | "comment" | "run_workflow" | "create_task";
  action_params: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface KanbanTemplate {
  template_id: string;
  name: string;
  description: string;
  columns?: KanbanColumnDef[];
  cards: Array<{ title: string; description?: string; column_id?: string; priority?: Priority; labels?: string[] }>;
  created_at: string;
}

export interface ColumnDwellTime {
  column_id: string;
  entered_at: string;
  exited_at?: string;
  duration_hours: number;
}

export interface CardTimeTracking {
  card_id: string;
  total_hours: number;
  column_times: ColumnDwellTime[];
}

export interface SearchResult {
  card_id: string;
  board_id: string;
  board_name: string;
  title: string;
  description_snippet: string;
  column_id: string;
  priority: Priority;
  score: number;
}

export interface KanbanFilter {
  filter_id: string;
  board_id: string;
  name: string;
  criteria: FilterCriteria;
  created_by: string;
  created_at: string;
}

export interface FilterCriteria {
  column_ids?: string[];
  priority?: Priority[];
  assignee?: string;
  labels?: string[];
  due_before?: string;
  overdue?: boolean;
  search?: string;
}

/* ─── 입력 타입 ─── */

export interface CreateBoardInput {
  name: string;
  scope_type: ScopeType;
  scope_id: string;
  columns?: KanbanColumnDef[];
}

export interface CreateCardInput {
  board_id: string;
  title: string;
  description?: string;
  column_id?: string;
  priority?: Priority;
  labels?: string[];
  assignee?: string;
  created_by: string;
  parent_id?: string;
  task_id?: string;
  due_date?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCardInput {
  title?: string;
  description?: string;
  priority?: Priority;
  labels?: string[];
  assignee?: string | null;
  metadata?: Record<string, unknown>;
  task_id?: string | null;
  due_date?: string | null;
  /** 변경 수행자 (activity 기록용). 미지정 시 "system". */
  actor?: string;
}

/* ─── SSE 이벤트 ─── */

/** SSE 이벤트 페이로드. */
export interface KanbanEvent {
  type: "activity";
  board_id: string;
  data: KanbanActivity;
}

export type KanbanEventListener = (event: KanbanEvent) => void;

/* ─── 스토어 인터페이스 ─── */

export interface KanbanStoreLike {
  /* board */
  create_board(input: CreateBoardInput): Promise<KanbanBoard>;
  get_board(board_id: string): Promise<KanbanBoard | null>;
  list_boards(scope_type?: ScopeType, scope_id?: string): Promise<KanbanBoard[]>;
  update_board(board_id: string, updates: { name?: string; columns?: KanbanColumnDef[] }): Promise<KanbanBoard | null>;
  delete_board(board_id: string): Promise<boolean>;

  /* card */
  create_card(input: CreateCardInput): Promise<KanbanCard>;
  get_card(card_id: string): Promise<KanbanCard | null>;
  list_cards(board_id: string, column_id?: string, limit?: number, assignee?: string): Promise<KanbanCard[]>;
  move_card(card_id: string, column_id: string, position?: number, actor?: string): Promise<KanbanCard | null>;
  update_card(card_id: string, updates: UpdateCardInput): Promise<KanbanCard | null>;
  delete_card(card_id: string): Promise<boolean>;

  /* comment */
  add_comment(card_id: string, author: string, text: string): Promise<KanbanComment>;
  list_comments(card_id: string, limit?: number): Promise<KanbanComment[]>;

  /* relation */
  add_relation(source_card_id: string, target_card_id: string, type: RelationType): Promise<KanbanRelation>;
  remove_relation(relation_id: string): Promise<boolean>;
  list_relations(card_id: string): Promise<KanbanRelation[]>;

  /* query */
  get_card_by_readable_id(readable_id: string): Promise<KanbanCard | null>;
  board_summary(board_id: string): Promise<BoardSummary | null>;
  get_subtasks(parent_card_id: string): Promise<KanbanCard[]>;
  get_participants(card_id: string): Promise<string[]>;
  get_subtask_counts(board_id: string): Promise<Map<string, { total: number; done: number }>>;

  /* activity */
  log_activity(card_id: string, board_id: string, actor: string, action: ActivityAction, detail?: Record<string, unknown>): Promise<KanbanActivity>;
  list_activities(opts: { card_id?: string; board_id?: string; limit?: number }): Promise<KanbanActivity[]>;

  /* rules */
  add_rule(input: { board_id: string; trigger: KanbanRule["trigger"]; condition: Record<string, unknown>; action_type: KanbanRule["action_type"]; action_params: Record<string, unknown> }): Promise<KanbanRule>;
  list_rules(board_id: string): Promise<KanbanRule[]>;
  update_rule(rule_id: string, updates: { enabled?: boolean; condition?: Record<string, unknown>; action_params?: Record<string, unknown> }): Promise<KanbanRule | null>;
  remove_rule(rule_id: string): Promise<boolean>;
  get_rules_by_trigger(board_id: string, trigger: KanbanRule["trigger"]): Promise<KanbanRule[]>;

  /* templates */
  create_template(input: { name: string; description?: string; columns?: KanbanColumnDef[]; cards: KanbanTemplate["cards"] }): Promise<KanbanTemplate>;
  list_templates(): Promise<KanbanTemplate[]>;
  get_template(template_id_or_name: string): Promise<KanbanTemplate | null>;
  delete_template(template_id: string): Promise<boolean>;

  /* metrics */
  get_board_metrics(board_id: string, days?: number): Promise<BoardMetrics | null>;

  /* time tracking */
  get_card_time_tracking(card_id: string): Promise<CardTimeTracking | null>;

  /* search */
  search_cards(query: string, opts?: { board_id?: string; limit?: number }): Promise<SearchResult[]>;

  /* filters */
  save_filter(input: { board_id: string; name: string; criteria: FilterCriteria; created_by?: string }): Promise<KanbanFilter>;
  list_filters(board_id: string): Promise<KanbanFilter[]>;
  delete_filter(filter_id: string): Promise<boolean>;

  /* event stream */
  subscribe(board_id: string, listener: KanbanEventListener): void;
  unsubscribe(board_id: string, listener: KanbanEventListener): void;
}

export interface BoardSummary {
  board_id: string;
  name: string;
  columns: Array<{ id: string; name: string; color: string; count: number }>;
  total: number;
  done: number;
  blockers: Array<{ card_id: string; title: string; blocked_by: string[] }>;
  overdue: Array<{ card_id: string; title: string; due_date: string; column_id: string }>;
}

export interface BoardMetrics {
  board_id: string;
  period_days: number;
  throughput: number;
  avg_cycle_time_hours: number;
  cards_by_column: Record<string, number>;
  cards_by_priority: Record<string, number>;
  velocity: Array<{ week: string; done: number }>;
}
