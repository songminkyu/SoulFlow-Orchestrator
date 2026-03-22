/**
 * AP-3: FE-BE 공유 API 응답 타입.
 *
 * BE `src/contracts/api-responses.ts`와 동일한 shape을 FE에서 소비.
 * useQuery 제네릭에 사용하여 FE-BE 타입 안전성을 확보한다.
 *
 * 유지 규칙: BE 타입 변경 시 이 파일도 동기화.
 * FVM 자동 검증으로 mismatch 감지.
 */

/* ─── Common ─── */
export type ApiError = { error: string };
export type ApiOk = { ok: true };

/* ─── Auth ─── */
export type ApiAuthStatus = { enabled: boolean; initialized: boolean };
export type ApiLoginResult = { ok: true; username: string; role: string; tid: string; token?: string; refresh_token?: string };
export type ApiAuthMe = { sub: string; username: string; role: string; tid: string; wdir: string; exp: number; team_role: string | null };
export type ApiMyTeams = { teams: Array<{ id: string; name: string; created_at: string; role: string }> };

export type ApiBootstrapStatus = { needed: boolean };
export type ApiSetupResult = { ok: true; username: string; role: string };
export type ApiScopedProvider = { id: string; name: string; type: string; model: string; config: Record<string, unknown>; api_key_ref: string; enabled: boolean; created_at: string; scope: "global" | "team" | "personal"; team_id?: string };
export type ApiScopedProviderList = { providers: ApiScopedProvider[] };

/* ─── Admin ─── */
export type ApiAdminUser = { id: string; username: string; system_role: string; default_team_id: string | null; created_at: string; last_login_at: string | null; disabled_at: string | null };
export type ApiAdminUserList = { users: ApiAdminUser[] };
export type ApiAdminUserCreated = { id: string; username: string; system_role: string; default_team_id: string | null };
export type ApiAdminTeam = { id: string; name: string; created_at: string; member_count: number };
export type ApiAdminTeamList = { teams: ApiAdminTeam[] };
export type ApiTeamMember = { user_id: string; role: string; joined_at: string; username: string | null; system_role: string | null; wdir: string };
export type ApiTeamMemberList = { team_id: string; members: ApiTeamMember[] };
export type ApiSecuritySummary = { webhook_secret_set: boolean; trust_zone: string; security_regressions: number; latency_p95_ms: number | null; failure_rate: number | null };

/* ─── Chat ─── */
export type ApiChatSessionSummary = { id: string; created_at: string; message_count: number; name?: string | null };
export type ApiChatSessionCreated = { id: string; created_at: string };
export type ApiChatSessionUpdated = { id: string; name: string | null };
export type ApiMirrorSessionSummary = { key: string; provider: string; team_id: string; chat_id: string; alias: string; thread: string; created_at: string; updated_at: string; message_count: number };

/* ─── Config ─── */
export type ApiLocale = { locale: string };
export type ApiProviderInstance = { instance_id: string; label: string; provider_type: string; connection_id: string; model: string; available: boolean };

/* ─── Workflow ─── */
export type ApiWorkflowDefinition = { name: string; slug: string; objective: string; phase_count: number; aliases: string[] };

/* ─── Kanban ─── */
export type ApiKanbanCard = { card_id: string; board_id: string; column_id: string; title: string; body: string; priority: number; position: number; assignee: string | null; created_at: string; updated_at: string };

/* ─── Process ─── */
export type ApiProcessEntry = { run_id: string; alias: string; provider: string; status: string; mode: string; started_at: string; ended_at?: string; finished_at?: string; error?: string; sender_id: string; chat_id: string; team_id?: string; executor_provider?: string; tool_calls_count: number; loop_id?: string; subagent_ids: string[] };
export type ApiProcessList = { active: ApiProcessEntry[]; recent: ApiProcessEntry[] };

/* ─── Eval ─── */
export type ApiEvalBundle = { name: string; description: string; smoke: boolean; dataset_files: string[]; tags: string[] };

/* ─── Memory ─── */
export type ApiMemoryAuditResult = { violations: Array<{ code: string; message: string }>; ok: boolean };
export type ApiMemoryLongterm = { content: string; audit_result: ApiMemoryAuditResult | null };
export type ApiMemoryDailyList = { days: string[] };

/* ─── Usage ─── */
export type ApiUsageSummaryDaily = { date: string; total_tokens: number; total_cost: number; by_provider: Record<string, { tokens: number; cost: number }> };

/* ─── Health ─── */
export type ApiHealthz = { ok: true; at: string };
export type ApiToolsInfo = { names: string[]; definitions: Array<Record<string, unknown>>; mcp_servers: Array<{ name: string; connected: boolean; tools: string[]; error?: string }>; native_tools: readonly string[] };

/* ─── Reconcile ─── */
export type ApiReconcileModel = { task_id: string; reconcile_summaries: unknown[]; critic_summaries: unknown[] };
export type ApiReconcileList = { data: ApiReconcileModel[] };
