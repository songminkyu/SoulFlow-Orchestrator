/** Orchestration bundle: OrchestrationService, CronService, oauth_fetch, create_task. */

import { join } from "node:path";
import { error_message, now_iso, make_run_id } from "../utils/common.js";
import type { AppConfig } from "../config/schema.js";
import type { ProviderCapabilities } from "../providers/executor.js";
import type { MessageBusRuntime } from "../bus/types.js";
import type { MutableBroadcaster } from "../dashboard/broadcaster.js";
import type { AgentDomain } from "../agent/index.js";
import type { create_agent_runtime } from "../agent/runtime.service.js";
import type { AgentBackendRegistry } from "../agent/agent-registry.js";
import type { WorkflowEventService } from "../events/index.js";
import type { DecisionService } from "../decision/index.js";
import type { OAuthIntegrationStore } from "../oauth/integration-store.js";
import type { OAuthFlowService } from "../oauth/flow-service.js";
import type { KanbanStoreLike, KanbanEvent } from "../services/kanban-store.js";
import type { McpClientManager } from "../mcp/index.js";
import type { PersonaMessageRenderer } from "../channels/persona-message-renderer.js";
import type { ProcessTracker } from "../orchestration/process-tracker.js";
import type { ConfirmationGuard } from "../orchestration/confirmation-guard.js";
import type { HitlPendingStore } from "../orchestration/hitl-pending-store.js";
import type { ToolIndex } from "../orchestration/tool-index.js";
import type { ProviderRegistry } from "../providers/index.js";
import type { PhaseWorkflowStore } from "../agent/phase-workflow-store.js";
import type { WebhookStore } from "../services/webhook-store.service.js";
import type { create_vector_store_service } from "../services/vector-store.service.js";
import type { create_query_db_service } from "../services/query-db.service.js";
import type { EmbedServiceFn } from "./agent-core.js";
import { parse_executor_preference, resolve_executor_provider } from "../providers/executor.js";
import { DefaultRuntimePolicyResolver } from "../channels/runtime-policy.js";
import { OrchestrationService } from "../orchestration/service.js";
import { create_cron_job_handler, CronService } from "../cron/index.js";
import { create_task_service } from "../services/create-task.service.js";
import { create_logger } from "../logger.js";
import { create_cd_observer } from "../agent/cd-scoring.js";
import { HookRunner, load_hooks_from_file } from "../hooks/index.js";
import type { TeamWorkspace } from "../workspace/workspace-context.js";
import type { ObservabilityLike } from "../observability/context.js";
import { create_execution_gateway } from "../orchestration/execution-gateway.js";
import { create_direct_executor } from "../orchestration/execution/direct-executor.js";
import { create_prompt_profile_compiler } from "../orchestration/prompt-profile-compiler.js";
import { create_role_policy_resolver } from "../orchestration/role-policy-resolver.js";
import { create_protocol_resolver } from "../orchestration/protocol-resolver.js";
import type { ArtifactStoreLike } from "../services/artifact-store.js";
import { create_local_artifact_store } from "../services/artifact-store.js";
import type { CoordinationStoreLike } from "../bus/coordination-store.js";
import { create_local_coordination_store } from "../bus/coordination-store.js";

/* ─── AP-1: Sub-bundle 타입 정의 ─────────────────────────────────────────── */

/** 인프라/설정 의존성. workspace 경로, 앱 설정, 로거, observability. */
export interface OrchInfraDeps {
  ctx: TeamWorkspace;
  workspace: string;
  user_dir: string;
  data_dir: string;
  app_config: AppConfig;
  logger: ReturnType<typeof create_logger>;
  observability?: ObservabilityLike | null;
  primary_provider: string;
  default_chat_id: string;
  resolve_instance_to_type: (id: string) => string;
}

/** 에이전트 런타임 의존성. provider, backend registry, 프로세스/확인/HITL. */
export interface OrchAgentDeps {
  providers: ProviderRegistry;
  agent: AgentDomain;
  agent_runtime: ReturnType<typeof create_agent_runtime>;
  agent_backend_registry: AgentBackendRegistry;
  provider_caps: ProviderCapabilities;
  process_tracker: ProcessTracker;
  persona_renderer: PersonaMessageRenderer;
  hitl_pending_store: HitlPendingStore;
  confirmation_guard: ConfirmationGuard;
  usage_store?: import("../orchestration/agent-hooks-builder.js").UsageRecorderLike | null;
}

/** 이벤트/메시징 의존성. bus, broadcaster, kanban. */
export interface OrchEventDeps {
  bus: MessageBusRuntime;
  events: WorkflowEventService;
  decisions: DecisionService;
  broadcaster: MutableBroadcaster;
  kanban_store: KanbanStoreLike;
}

/** 저장소 의존성. workflow, webhook, artifact, coordination. */
export interface OrchStorageDeps {
  phase_workflow_store: PhaseWorkflowStore;
  webhook_store: WebhookStore;
  /** PA-5: 아티팩트 저장 포트. 미지정 시 bootstrap이 로컬 어댑터를 생성. */
  artifact_store?: ArtifactStoreLike | null;
  /** PA-5: 에이전트 협업 상태 조율 포트. 미지정 시 bootstrap이 로컬 어댑터를 생성. */
  coordination_store?: CoordinationStoreLike | null;
}

/** 인증/OAuth 의존성. */
export interface OrchSecurityDeps {
  oauth_store: OAuthIntegrationStore;
  oauth_flow: OAuthFlowService;
}

/** 도구/서비스 의존성. MCP, embed, vector, query DB. */
export interface OrchToolDeps {
  mcp: McpClientManager;
  tool_index: ToolIndex;
  embed_service: EmbedServiceFn | undefined;
  vector_store_service: ReturnType<typeof create_vector_store_service> | undefined;
  query_db_service: ReturnType<typeof create_query_db_service> | undefined;
}

/* ─── Composition: 기존 OrchestrationBundleDeps 하위 호환 ────────────── */

export type OrchestrationBundleDeps =
  OrchInfraDeps &
  OrchAgentDeps &
  OrchEventDeps &
  OrchStorageDeps &
  OrchSecurityDeps &
  OrchToolDeps;

export interface OrchestrationBundleResult {
  orchestration: OrchestrationService;
  cron: CronService;
  create_task_fn: ReturnType<typeof create_task_service>;
  /** PA-5: 아티팩트 저장 포트 (로컬 파일시스템 어댑터). */
  artifact_store: ArtifactStoreLike;
  /** PA-5: 에이전트 협업 상태 조율 포트 (인메모리 어댑터). */
  coordination_store: CoordinationStoreLike;
  oauth_fetch_service: (
    service_id: string,
    opts: { url: string; method: string; headers?: Record<string, string>; body?: unknown },
  ) => Promise<{ status: number; body: unknown; headers: Record<string, string> }>;
}

/** KanbanStore subscribe를 Promise 기반 one-shot 대기로 변환. */
export function make_wait_kanban_event(store: KanbanStoreLike) {
  return async (raw_board_id: string, filter: { actions?: string[]; column_id?: string }) => {
    let board_id = raw_board_id;
    const scope_match = raw_board_id.match(/^scope:(\w+):(.+)$/);
    if (scope_match) {
      const boards = await store.list_boards(scope_match[1] as import("../services/kanban-store.js").ScopeType, scope_match[2]);
      if (boards.length > 0) board_id = boards[0].board_id;
    }
    return new Promise<{ card_id: string; board_id: string; action: string; actor: string; detail: Record<string, unknown>; created_at: string } | null>((resolve) => {
      const timeout = setTimeout(() => { store.unsubscribe(board_id, handler); resolve(null); }, 60_000);
      const handler = (event: KanbanEvent) => {
        const act = event.data;
        if (filter.actions?.length && !filter.actions.includes(act.action)) return;
        if (filter.column_id) {
          const d = act.detail as Record<string, unknown>;
          const matches = d.column_id === filter.column_id || d.to === filter.column_id;
          if (!matches) return;
        }
        clearTimeout(timeout);
        store.unsubscribe(board_id, handler);
        resolve({ card_id: act.card_id, board_id: act.board_id, action: act.action, actor: act.actor, detail: act.detail, created_at: act.created_at });
      };
      store.subscribe(board_id, handler);
    });
  };
}

export async function create_orchestration_bundle(deps: OrchestrationBundleDeps): Promise<OrchestrationBundleResult> {
  const {
    workspace, user_dir, data_dir: _data_dir, app_config,
    providers, agent, agent_runtime, agent_backend_registry, provider_caps,
    bus, events, decisions, process_tracker, mcp,
    phase_workflow_store, broadcaster, confirmation_guard,
    oauth_store, oauth_flow,
    embed_service, vector_store_service, webhook_store, kanban_store, query_db_service,
    persona_renderer, hitl_pending_store, tool_index,
    resolve_instance_to_type, primary_provider, default_chat_id, logger,
  } = deps;

  // oauth_fetch 서비스: 워크플로우 노드에서 OAuth 인증 HTTP 호출 지원
  const oauth_fetch_service = async (
    service_id: string,
    opts: { url: string; method: string; headers?: Record<string, string>; body?: unknown },
  ): Promise<{ status: number; body: unknown; headers: Record<string, string> }> => {
    const { normalize_headers, serialize_body, timed_fetch, validate_url } = await import("../agent/tools/http-utils.js");
    const integration = oauth_store.get(service_id);
    if (!integration) throw new Error(`OAuth integration "${service_id}" not found`);
    if (!integration.enabled) throw new Error(`OAuth integration "${service_id}" is disabled`);

    // SH-2: OAuthFetchTool과 동일한 allowed_hosts 검증 — 공유 헬퍼 사용
    const parsed_url = validate_url(opts.url);
    if (typeof parsed_url === "string") throw new Error(parsed_url);
    const { check_allowed_hosts } = await import("../agent/tools/http-utils.js");
    const hosts_error = check_allowed_hosts(parsed_url.hostname, integration.settings, service_id);
    if (hosts_error) throw new Error(hosts_error);

    const { token, error } = await oauth_flow.get_valid_access_token(service_id);
    if (!token) throw new Error(`No valid token for "${service_id}": ${error || "not configured"}`);

    const method = (opts.method || "GET").toUpperCase();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...normalize_headers(opts.headers),
    };
    const body = serialize_body(opts.body, headers);

    let res = await timed_fetch(opts.url, { method, headers, body, timeout_ms: 15_000 });

    if (res.status === 401) {
      const refresh_result = await oauth_flow.refresh_token(service_id);
      if (refresh_result.ok) {
        const new_token = await oauth_store.get_access_token(service_id);
        if (new_token) {
          headers.Authorization = `Bearer ${new_token}`;
          res = await timed_fetch(opts.url, { method, headers, body, timeout_ms: 15_000 });
        }
      }
    }

    const res_headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { res_headers[k] = v; });
    const content_type = res.headers.get("content-type") || "";
    const res_body = content_type.includes("json") ? await res.json() : await res.text();
    return { status: res.status, body: res_body, headers: res_headers };
  };

  // create_task: lazy thunk — 클로저 내부에서 orchestration을 참조하지만, 호출 시점에만 resolve됨
  const create_task_fn = create_task_service(() => ({
    execute: async (opts) => {
      const run_id = make_run_id("task");
      const result = await orchestration.execute({
        message: {
          id: run_id,
          provider: opts.channel,
          channel: opts.channel,
          sender_id: "workflow",
          chat_id: opts.chat_id,
          content: opts.objective,
          at: now_iso(),
          team_id: opts.channel,
        },
        alias: opts.title || "default",
        provider: opts.channel,
        media_inputs: [],
        session_history: [],
        run_id,
        max_turns: opts.max_turns,
        initial_memory: opts.initial_memory,
      });
      const has_error = !!result.error;
      return {
        task_id: result.run_id || run_id,
        status: has_error ? "failed" : "completed",
        result: result.reply ?? undefined,
        error: has_error ? (result.error || result.reply || undefined) : undefined,
      };
    },
  }));

  // HOOK.md 기반 사용자 정의 훅 로드
  const hooks_config = load_hooks_from_file(workspace);
  const hook_runner = new HookRunner(workspace, hooks_config);

  const orchestration = new OrchestrationService({
    providers,
    agent_runtime,
    secret_vault: providers.get_secret_vault(),
    runtime_policy_resolver: new DefaultRuntimePolicyResolver(),
    config: {
      executor_provider: resolve_executor_provider(
        parse_executor_preference(resolve_instance_to_type(app_config.orchestration.executorProvider) || app_config.orchestration.executorProvider),
        provider_caps,
      ),
      agent_loop_max_turns: app_config.agentLoopMaxTurns,
      task_loop_max_turns: app_config.taskLoopMaxTurns,
      streaming_enabled: app_config.channel.streaming.enabled,
      streaming_interval_ms: app_config.channel.streaming.intervalMs,
      streaming_min_chars: app_config.channel.streaming.minChars,
      streaming_max_chars: app_config.channel.streaming.coalesceMaxChars,
      max_tool_result_chars: app_config.orchestration.maxToolResultChars,
      orchestrator_max_tokens: app_config.orchestration.orchestratorMaxTokens,
      max_tool_calls_per_run: app_config.orchestration.maxToolCallsPerRun,
      freshness_window_ms: app_config.orchestration.freshnessWindowMs,
      provider_caps,
    },
    logger: logger.child("orchestration"),
    agent_backends: agent_backend_registry,
    process_tracker,
    get_mcp_configs: () => mcp.get_server_configs(),
    events,
    workspace,
    user_dir,
    subagents: agent.subagents,
    phase_workflow_store,
    get_sse_broadcaster: () => broadcaster,
    confirmation_guard,
    bus,
    decision_service: decisions,
    promise_service: agent.context.promise_service,
    oauth_fetch: oauth_fetch_service,
    embed: embed_service,
    vector_store: vector_store_service,
    get_webhook_data: (path) => webhook_store.get(path),
    wait_kanban_event: make_wait_kanban_event(kanban_store),
    query_db: query_db_service,
    renderer: persona_renderer,
    hitl_pending_store,
    session_cd: create_cd_observer(),
    tool_index,
    create_task: create_task_fn,
    hook_runner,
    observability: deps.observability,
    usage_store: deps.usage_store,
    // PA-4: composition root에서 포트 생성 → OrchestrationService에 DI
    execution_gateway: create_execution_gateway(),
    direct_executor: create_direct_executor(),
    profile_compiler: create_prompt_profile_compiler(
      create_role_policy_resolver(agent_runtime.get_context_builder().skills_loader),
      create_protocol_resolver(agent_runtime.get_context_builder().skills_loader),
    ),
  });

  // 팀 스코프: 크론 잡은 팀 멤버 간 공유
  const cron = new CronService(join(deps.ctx.team_runtime, "cron"), create_cron_job_handler({
    config: {
      agent_loop_max_turns: app_config.agentLoopMaxTurns,
      per_turn_timeout_ms: 600_000,
      default_alias: app_config.channel.defaultAlias,
      executor_provider: resolve_instance_to_type(app_config.orchestration.executorProvider) || app_config.orchestration.executorProvider,
      provider_caps,
      resolve_default_target: () => {
        if (!default_chat_id) return null;
        return { provider: primary_provider, chat_id: default_chat_id };
      },
    },
    bus,
    events,
    agent_runtime,
    agent_backends: agent_backend_registry,
    secret_vault: providers.get_secret_vault(),
    on_workflow_trigger: async (slug, channel, chat_id) => {
      try {
        const { load_workflow_template, substitute_variables } = await import("../orchestration/workflow-loader.js");
        const template = load_workflow_template(user_dir, slug);
        if (!template) return { ok: false, error: `template not found: ${slug}` };
        const substituted = substitute_variables(template, { ...template.variables, channel });
        const run_id = make_run_id("wf-cron");
        const result = await orchestration.execute({
          message: { id: run_id, provider: channel, channel, sender_id: "cron", chat_id, content: substituted.objective || substituted.title, at: now_iso(), team_id: channel },
          alias: app_config.channel.defaultAlias,
          provider: channel,
          media_inputs: [],
          session_history: [],
          run_id,
        });
        return { ok: !result.error, workflow_id: result.run_id || run_id, error: result.error || undefined };
      } catch (e) {
        return { ok: false, error: error_message(e) };
      }
    },
  }), {
    on_change: (type, job_id, team_id) => broadcaster.broadcast_cron_event(type, job_id, team_id),
  });

  // PA-5: 아티팩트 및 협업 상태 포트 생성 (bootstrap이 로컬 어댑터를 기본값으로 제공)
  const artifact_store: ArtifactStoreLike = deps.artifact_store ?? create_local_artifact_store(join(deps.data_dir, "artifacts"));
  const coordination_store: CoordinationStoreLike = deps.coordination_store ?? create_local_coordination_store();

  return { orchestration, cron, create_task_fn, oauth_fetch_service, artifact_store, coordination_store };
}
