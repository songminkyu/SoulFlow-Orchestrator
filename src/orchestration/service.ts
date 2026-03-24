import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentRuntimeLike } from "../agent/runtime.types.js";
import type { ProviderRegistryLike } from "../providers/index.js";
import type { RuntimeExecutionPolicy } from "../providers/types.js";
import type { RuntimePolicyResolver } from "../channels/runtime-policy.js";
import type { SecretVaultLike } from "../security/secret-vault.js";
import type { CompactionFlushConfig } from "../agent/loop.js";
import type { Logger } from "../logger.js";
import { correlation_to_log_context } from "../logger.js";
import { NOOP_OBSERVABILITY as NOOP_OBS } from "../observability/context.js";
import { extend_correlation } from "../observability/correlation.js";
import type { ToolExecutionContext } from "../agent/tools/types.js";
import type { ExecutionMode, OrchestrationRequest, OrchestrationResult, OrchestrationServiceLike } from "./types.js";
import { StreamBuffer } from "../channels/stream-buffer.js";
import {
  sanitize_provider_output,
  normalize_agent_reply,
  extract_provider_error,
} from "../channels/output-sanitizer.js";
import { create_tool_output_reducer } from "./tool-output-reducer.js";
import type { ExecutorProvider, ProviderCapabilities } from "../providers/executor.js";
import type { AgentBackendRegistry } from "../agent/agent-registry.js";
import type { AgentRunResult } from "../agent/agent.types.js";
import type { CDObserver } from "../agent/cd-scoring.js";
import type { ProcessTrackerLike } from "./process-tracker.js";
import type { WorkflowEventServiceLike, AppendWorkflowEventInput } from "../events/index.js";
// ── 추출 모듈 ──
import {
  build_once_overlay, build_agent_overlay, build_bootstrap_overlay,
  format_secret_notice, GUARD_SUMMARY_PROMPT,
} from "./prompts.js";
import { ConfirmationGuard } from "./confirmation-guard.js";
import { FINISH_REASON_WARNINGS } from "../agent/finish-reason-warnings.js";
import { detect_escalation } from "./classifier.js";
import { append_no_tool_notice, error_result, suppress_result, reply_result, extract_usage } from "./execution/helpers.js";
import {
  type ToolCallHandlerDeps,
} from "./tool-call-handler.js";
import {
  build_agent_hooks,
  type AgentHooksBuilderDeps,
} from "./agent-hooks-builder.js";
import { PersonaMessageRenderer, type PersonaMessageRendererLike } from "../channels/persona-message-renderer.js";
import { HitlPendingStore } from "./hitl-pending-store.js";
// ── 실행 runner 모듈 ──
import { run_once as _run_once } from "./execution/run-once.js";
import { run_agent_loop as _run_agent_loop } from "./execution/run-agent-loop.js";
import { run_task_loop as _run_task_loop } from "./execution/run-task-loop.js";
import { continue_task_loop as _continue_task_loop, type ContinueTaskDeps } from "./execution/continue-task-loop.js";
import { run_phase_loop as _run_phase_loop, type PhaseWorkflowDeps } from "./execution/phase-workflow.js";
// ── Request Preflight ──
import {
  run_request_preflight,
  collect_skill_provider_prefs,
  type RequestPreflightDeps,
} from "./request-preflight.js";
// ── Execute Dispatcher ──
import {
  execute_dispatch,
  type ExecuteDispatcherDeps,
} from "./execution/execute-dispatcher.js";
// ── GW-3/GW-4: Gateway + DirectExecutor 바인딩 ──
import { create_execution_gateway, type ExecutionGatewayLike } from "./execution-gateway.js";
import { create_direct_executor, type DirectExecutorLike } from "./execution/direct-executor.js";
// ── RP-3/RP-4: PromptProfileCompiler 바인딩 ──
import { create_prompt_profile_compiler, type PromptProfileCompilerLike } from "./prompt-profile-compiler.js";
import { create_role_policy_resolver } from "./role-policy-resolver.js";
import { create_protocol_resolver } from "./protocol-resolver.js";
import { streaming_cfg_for } from "./execution/runner-deps.js";
import { record_turn_to_daily } from "./turn-memory-recorder.js";
import { record_guardrail_metrics } from "./guardrails/observability.js";
import { error_message } from "../utils/common.js";

type OrchestratorConfig = {
  executor_provider: ExecutorProvider;
  provider_caps?: ProviderCapabilities;
  agent_loop_max_turns: number;
  task_loop_max_turns: number;
  streaming_enabled: boolean;
  streaming_interval_ms: number;
  streaming_min_chars: number;
  streaming_max_chars: number;
  max_tool_result_chars: number;
  orchestrator_max_tokens: number;
  /** executor LLM 호출 최대 출력 토큰. 로컬 vLLM/Ollama 사용 시 높게 설정. */
  executor_max_tokens: number;
  /** 시스템 프롬프트 최대 토큰. 0 = 비활성. 양수면 ContextBudget 프루닝 적용. */
  system_prompt_max_tokens: number;
  /** EG-2: run당 최대 tool 호출 수. 0 = 비활성. */
  max_tool_calls_per_run: number;
  /** EG-1: 세션 재사용 freshness window (ms). 0 = 비활성. */
  freshness_window_ms: number;
};

export type OrchestrationServiceDeps = {
  providers: ProviderRegistryLike;
  agent_runtime: AgentRuntimeLike;
  secret_vault: SecretVaultLike;
  runtime_policy_resolver: RuntimePolicyResolver;
  config: OrchestratorConfig;
  logger: Logger;
  /** Phase 2: native_tool_loop 분기용. 없으면 기존 providers 경로만 사용. */
  agent_backends?: AgentBackendRegistry | null;
  process_tracker?: ProcessTrackerLike | null;
  /** SDK 백엔드에 전달할 MCP 서버 설정 조회. */
  get_mcp_configs?: () => Record<string, { command: string; args?: string[]; env?: Record<string, string>; cwd?: string }>;
  /** 워크플로우 이벤트 기록 서비스. 없으면 이벤트 기록 스킵. */
  events?: WorkflowEventServiceLike | null;
  /** Phase Loop에서 사용할 workspace 경로. */
  workspace?: string;
  /** 워크플로우/스킬 템플릿 로드에 사용할 사용자 콘텐츠 경로. 미설정 시 workspace 사용. */
  user_dir?: string;
  /** Phase Loop에서 사용할 SubagentRegistry. */
  subagents?: import("../agent/subagents.js").SubagentRegistry | null;
  /** Phase Loop 영속화 스토어. */
  phase_workflow_store?: import("../agent/phase-workflow-store.js").PhaseWorkflowStoreLike | null;
  /** SSE 브로드캐스트 (Phase Loop 이벤트 전파). lazy 참조 지원. */
  get_sse_broadcaster?: () => { broadcast_workflow_event(event: import("../agent/phase-loop.types.js").PhaseLoopEvent, team_id?: string): void } | null;
  /** 실행 전 확인 가드. */
  confirmation_guard?: ConfirmationGuard | null;
  /** 메시지 버스 (Phase Loop 내 interaction 노드용). */
  bus?: import("../bus/types.js").MessageBusLike | null;
  /** Decision/Promise 서비스 (워크플로우 노드용). */
  decision_service?: import("../decision/service.js").DecisionService | null;
  promise_service?: import("../decision/promise.service.js").PromiseService | null;
  embed?: (texts: string[], opts: { model?: string; dimensions?: number }) => Promise<{ embeddings: number[][]; token_usage?: number }>;
  vector_store?: (op: string, opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
  oauth_fetch?: (service_id: string, opts: { url: string; method: string; headers?: Record<string, string>; body?: unknown }) => Promise<{ status: number; body: unknown; headers: Record<string, string> }>;
  get_webhook_data?: (path: string) => Promise<{ method: string; headers: Record<string, string>; body: unknown; query: Record<string, string> } | null>;
  wait_kanban_event?: (board_id: string, filter: { actions?: string[]; column_id?: string }) => Promise<{ card_id: string; board_id: string; action: string; actor: string; detail: Record<string, unknown>; created_at: string } | null>;
  create_task?: (opts: { title: string; objective: string; channel?: string; chat_id?: string; max_turns?: number; initial_memory?: Record<string, unknown> }) => Promise<{ task_id: string; status: string; result?: unknown; error?: string }>;
  query_db?: (datasource: string, query: string, params?: Record<string, unknown>) => Promise<{ rows: unknown[]; affected_rows: number }>;
  /** 페르소나 메시지 렌더러. 없으면 내부에서 lazy 생성. */
  renderer?: PersonaMessageRendererLike | null;
  /** HITL pending 응답 공유 store. */
  hitl_pending_store: HitlPendingStore;
  /** 세션 CD 관찰자. collaborator로 외부에서 주입. */
  session_cd: import("../agent/cd-scoring.js").CDObserver;
  /** 도구 인덱스. 미지정 시 키워드 인덱스 미사용. */
  tool_index?: import("./tool-index.js").ToolIndex | null;
  /** 사용자 정의 훅 실행기 (HOOK.md / settings). */
  hook_runner?: import("../hooks/runner.js").HookRunner | null;
  /** OB-5: observability 주입. 미설정 시 no-op. */
  observability?: import("../observability/context.js").ObservabilityLike | null;
  /** OB: LLM 사용량 기록 (UsageStore). 미설정 시 스킵. */
  usage_store?: import("./agent-hooks-builder.js").UsageRecorderLike | null;
  /** PA-4: 실행 게이트웨이. 미설정 시 기본 생성. */
  execution_gateway?: import("./execution-gateway.js").ExecutionGatewayLike | null;
  /** PA-4: 직접 실행기. 미설정 시 기본 생성. */
  direct_executor?: import("./execution/direct-executor.js").DirectExecutorLike | null;
  /** PA-4: 프로필 컴파일러. 미설정 시 기본 생성. */
  profile_compiler?: import("./prompt-profile-compiler.js").PromptProfileCompilerLike | null;
};


/**
 * 메시지 수신 → 실행 모드 분류(once/agent/task) → 프로바이더 실행 → 결과 반환.
 * ChannelManager로부터 독립된 단일 책임 서비스.
 */
export class OrchestrationService implements OrchestrationServiceLike {
  private readonly providers: ProviderRegistryLike;
  private readonly runtime: AgentRuntimeLike;
  private readonly vault: SecretVaultLike;
  private readonly policy_resolver: RuntimePolicyResolver;
  private readonly config: OrchestratorConfig;
  private readonly logger: Logger;
  private readonly agent_backends: AgentBackendRegistry | null;
  private readonly process_tracker: ProcessTrackerLike | null;
  private readonly get_mcp_configs: (() => Record<string, { command: string; args?: string[]; env?: Record<string, string>; cwd?: string }>) | null;
  private readonly events: WorkflowEventServiceLike | null;
  private readonly guard: ConfirmationGuard | null;
  private readonly deps: OrchestrationServiceDeps;
  private readonly session_cd: CDObserver;
  private readonly streaming_cfg: { enabled: boolean; interval_ms: number; min_chars: number; max_chars?: number };
  private readonly hooks_deps: AgentHooksBuilderDeps;
  private readonly tool_deps: ToolCallHandlerDeps;
  private readonly hitl_store: HitlPendingStore;
  private readonly tool_index: import("./tool-index.js").ToolIndex | null;
  private readonly hook_runner: import("../hooks/runner.js").HookRunner | null;
  private _renderer: PersonaMessageRendererLike | null;
  private readonly _obs: import("../observability/context.js").ObservabilityLike;
  private readonly _execution_gateway: ExecutionGatewayLike;
  private readonly _direct_executor: DirectExecutorLike;
  private readonly _profile_compiler: PromptProfileCompilerLike;

  constructor(deps: OrchestrationServiceDeps) {
    this._renderer = deps.renderer ?? null;
    this.providers = deps.providers;
    this.runtime = deps.agent_runtime;
    this.vault = deps.secret_vault;
    this.policy_resolver = deps.runtime_policy_resolver;
    this.config = deps.config;
    this.logger = deps.logger;
    this.agent_backends = deps.agent_backends || null;
    this.process_tracker = deps.process_tracker || null;
    this.get_mcp_configs = deps.get_mcp_configs || null;
    this.events = deps.events || null;
    this.guard = deps.confirmation_guard || null;
    this.hitl_store = deps.hitl_pending_store;
    this.session_cd = deps.session_cd;
    this.tool_index = deps.tool_index ?? null;
    this.hook_runner = deps.hook_runner ?? null;
    this._obs = deps.observability ?? NOOP_OBS;
    // PA-4: 포트 DI 우선, 미설정 시 기본 생성 (하위 호환)
    this._execution_gateway = deps.execution_gateway ?? create_execution_gateway();
    this._direct_executor = deps.direct_executor ?? create_direct_executor();
    if (deps.profile_compiler) {
      this._profile_compiler = deps.profile_compiler;
    } else {
      const skills_loader = deps.agent_runtime.get_context_builder().skills_loader;
      this._profile_compiler = create_prompt_profile_compiler(
        create_role_policy_resolver(skills_loader),
        create_protocol_resolver(skills_loader),
      );
    }
    this.deps = deps;

    this.streaming_cfg = {
      enabled: this.config.streaming_enabled,
      interval_ms: this.config.streaming_interval_ms,
      min_chars: this.config.streaming_min_chars,
      max_chars: this.config.streaming_max_chars,
    };
    this.hooks_deps = {
      session_cd: this.session_cd,
      logger: this.logger,
      process_tracker: this.process_tracker,
      runtime: this.runtime,
      log_event: (e: AppendWorkflowEventInput) => this.log_event(e),
      streaming_config: this.streaming_cfg,
      usage_recorder: deps.usage_store ?? null,
      metrics: this._obs.metrics,
    };
    // known_tool_names: lazy getter — 생성자에서 runtime.get_tool_definitions()를 호출하면 mock 비호환
    let _known_tools: ReadonlySet<string> | undefined;
    const get_known_tools = (): ReadonlySet<string> => {
      if (!_known_tools) {
        _known_tools = new Set(this.runtime.get_tool_definitions().map((t) => String((t as Record<string, unknown>).name || "")).filter(Boolean));
      }
      return _known_tools;
    };
    this.tool_deps = {
      max_tool_result_chars: this.config.max_tool_result_chars,
      logger: this.logger,
      execute_tool: (name: string, params: Record<string, unknown>, ctx?: ToolExecutionContext) =>
        this.runtime.execute_tool(name, params, ctx),
      log_event: (e: AppendWorkflowEventInput) => this.log_event(e),
      /** M-14: 3-projection reducer — prompt/display/storage 분리. PTY와 동일 경로. */
      reducer: create_tool_output_reducer(this.config.max_tool_result_chars),
      metrics: this._obs.metrics,
      get known_tool_names() { return get_known_tools(); },
    };
  }

  // ── 페르소나 + 부트스트랩 ──

  /** SOUL.md에서 페르소나 이름 + BOOTSTRAP.md 존재 여부를 조회. */
  private _get_persona_context(): { name: string; bootstrap: { exists: boolean; content: string } } {
    const cb = this.runtime.get_context_builder();
    return { name: cb.get_persona_name(), bootstrap: cb.get_bootstrap() };
  }

  /** 모드에 맞는 overlay를 생성. bootstrap 모드면 bootstrap overlay가 우선. */
  private _build_overlay(mode: "once" | "agent", persona?: { name: string; bootstrap: { exists: boolean; content: string } }): string {
    const ctx = persona ?? this._get_persona_context();
    if (ctx.bootstrap.exists) return build_bootstrap_overlay(ctx.name, ctx.bootstrap.content);
    return mode === "once" ? build_once_overlay(ctx.name) : build_agent_overlay(ctx.name);
  }

/** Phase Loop HITL bridge — ChannelManager에서 사용자 응답을 라우팅. */
  get_phase_hitl_bridge(): import("../channels/manager.js").WorkflowHitlBridge {
    const store = this.hitl_store;
    return {
      async try_resolve(chat_id: string, content: string): Promise<boolean> {
        return store.try_resolve(chat_id, content);
      },
    };
  }

  private _caps(): ProviderCapabilities {
    return this.config.provider_caps ?? { chatgpt_available: true, claude_available: false, openrouter_available: false, orchestrator_llm_available: false, gemini_available: false };
  }

  /** 공통 AgentHooks 구성. args.req + stream + backend_id 조합. */
  private _hooks_for(stream: StreamBuffer, args: { req: OrchestrationRequest; runtime_policy: RuntimeExecutionPolicy }, backend_id: string, task_id?: string, tools_accumulator?: string[]) {
    const req_team_id = args.req.message?.metadata?.team_id as string | undefined;
    const req_user_id = args.req.message?.sender_id;
    const base_deps = args.req.provider === "web"
      ? { ...this.hooks_deps, streaming_config: streaming_cfg_for(this.streaming_cfg, "web") }
      : this.hooks_deps;
    const hooks_deps = {
      ...base_deps,
      log_event: (e: AppendWorkflowEventInput) => this.log_event(e, req_team_id, req_user_id),
    };
    return build_agent_hooks(hooks_deps, {
      buffer: stream, on_stream: args.req.on_stream, runtime_policy: args.runtime_policy,
      channel_context: { channel: args.req.provider, chat_id: String(args.req.message.chat_id || ""), task_id },
      on_tool_block: args.req.on_tool_block, backend_id, on_progress: args.req.on_progress,
      run_id: args.req.run_id, on_agent_event: args.req.on_agent_event,
      tools_accumulator,
      tool_choice: args.req.tool_choice,
      pinned_tools: args.req.pinned_tools,
      hook_runner: this.hook_runner,
      // web 채널: rate_limit 등은 on_agent_event → NDJSON rich event로 이미 전달 — 텍스트 스트림 중복 주입 방지
      skip_critical_text_inject: args.req.provider === "web",
    }).hooks;
  }

  /** 세션 누적 CD 점수 조회. */
  get_cd_score(): { total: number; events: Array<{ indicator: string; points: number; context: string; at: string }> } {
    return this.session_cd.get_score();
  }

  /** 세션 CD 점수 초기화. */
  reset_cd_score(): void {
    this.session_cd.reset();
  }

  /** 가드 확인용 요약 생성. 오케스트레이터 LLM 사용, 실패 시 텍스트 슬라이스 폴백. */
  private async _generate_guard_summary(task_text: string): Promise<string> {
    try {
      const result = await this.providers.run_orchestrator({
        messages: [
          { role: "system", content: GUARD_SUMMARY_PROMPT },
          { role: "user", content: task_text.slice(0, 500) },
        ],
        max_tokens: 150,
        temperature: 0,
      });
      const summary = String(result.content || "").trim();
      if (summary) return summary;
    } catch (e) { this.logger.debug("guard summary LLM fallback", { error: error_message(e) }); }
    return task_text.slice(0, 200) + (task_text.length > 200 ? "..." : "");
  }

/** 워크플로우 이벤트 기록. events 서비스가 없으면 무시. */
  private log_event(input: AppendWorkflowEventInput, team_id?: string, user_id?: string): void {
    if (!this.events) return;
    let patched = team_id && !input.team_id ? { ...input, team_id } : input;
    if (user_id && !patched.user_id) patched = { ...patched, user_id };
    this.events.append(patched).catch(() => { /* 이벤트 로깅 실패가 실행을 차단하면 안 됨 */ });
  }

  /** runner 함수에 전달할 공유 의존성 조립. req 전달 시 per-request workspace 우선 사용. */
  private _runner_deps(req?: OrchestrationRequest) {
    return {
      providers: this.providers,
      runtime: this.runtime,
      config: {
        agent_loop_max_turns: this.config.agent_loop_max_turns,
        task_loop_max_turns: this.config.task_loop_max_turns,
        executor_provider: this.config.executor_provider,
        max_tool_result_chars: this.config.max_tool_result_chars,
        executor_max_tokens: this.config.executor_max_tokens,
        max_tool_calls_per_run: this.config.max_tool_calls_per_run,
        freshness_window_ms: this.config.freshness_window_ms,
      },
      logger: this.logger,
      agent_backends: this.agent_backends,
      process_tracker: this.process_tracker,
      get_mcp_configs: this.get_mcp_configs,
      streaming_cfg: this.streaming_cfg,
      hooks_deps: this.hooks_deps,
      tool_deps: { ...this.tool_deps, log_event: (e: AppendWorkflowEventInput) => this.log_event(e, req?.message?.metadata?.team_id as string | undefined, req?.message?.sender_id) },
      session_cd: this.session_cd,
      observability: this._obs,
      workspace: req?.workspace_override ?? this.deps.workspace,
      build_overlay: (mode: "once" | "agent") => this._build_overlay(mode),
      hooks_for: (stream: StreamBuffer, args: { req: OrchestrationRequest; runtime_policy: RuntimeExecutionPolicy }, backend_id: string, task_id?: string, tools_accumulator?: string[]) => this._hooks_for(stream, args, backend_id, task_id, tools_accumulator),
      log_event: (input: AppendWorkflowEventInput) => this.log_event(input, req?.message?.metadata?.team_id as string | undefined, req?.message?.sender_id),
      convert_agent_result: (result: AgentRunResult, mode: ExecutionMode, stream: StreamBuffer, req: OrchestrationRequest) => this._convert_agent_result(result, mode, stream, req),
      build_persona_followup: (heart: string) => this.build_persona_followup(heart),
      build_compaction_flush: (req?: OrchestrationRequest) => this.build_compaction_flush(req),
    } as const;
  }

  /** continue_task_loop 전용 추가 의존성 포함 조립. */
  private _continue_deps(req?: OrchestrationRequest): ContinueTaskDeps {
    return {
      ...this._runner_deps(req),
      policy_resolver: this.policy_resolver,
      caps: () => this._caps(),
      build_system_prompt: (names, prov, chat, cats, alias) => this._build_system_prompt(names, prov, chat, cats, alias),
      collect_skill_provider_preferences: (names) => collect_skill_provider_prefs(this.runtime, names),
    };
  }

  /** phase workflow 실행용 의존성 조립. req 전달 시 per-request workspace 우선 사용. */
  private _phase_deps(req?: OrchestrationRequest): PhaseWorkflowDeps {
    return {
      providers: this.providers,
      runtime: this.runtime,
      logger: this.logger,
      process_tracker: this.process_tracker,
      workspace: req?.workspace_override ?? this.deps.workspace ?? "",
      user_dir: req?.user_dir_override ?? this.deps.user_dir ?? this.deps.workspace ?? "",
      subagents: this.deps.subagents || null,
      phase_workflow_store: this.deps.phase_workflow_store || null,
      bus: this.deps.bus ?? null,
      hitl_store: this.hitl_store,
      get_sse_broadcaster: this.deps.get_sse_broadcaster,
      observability: this._obs,
      render_hitl: (body, type) => this._render_hitl(body, type),
      decision_service: this.deps.decision_service || null,
      promise_service: this.deps.promise_service || null,
      embed: this.deps.embed,
      vector_store: this.deps.vector_store,
      oauth_fetch: this.deps.oauth_fetch,
      get_webhook_data: this.deps.get_webhook_data,
      wait_kanban_event: this.deps.wait_kanban_event,
      create_task: this.deps.create_task,
      query_db: this.deps.query_db,
    };
  }

  /** request preflight 처리용 의존성 조립. */
  private _preflight_deps(): RequestPreflightDeps {
    return {
      vault: this.vault,
      runtime: this.runtime,
      policy_resolver: this.policy_resolver,
      workspace: this.deps.workspace,
      tool_index: this.tool_index,
    };
  }

  /** execute dispatcher 처리용 의존성 조립. req에서 team_id를 추출하여 log_event에 주입. */
  private _dispatch_deps(req?: OrchestrationRequest): ExecuteDispatcherDeps {
    const team_id = req?.message?.metadata?.team_id as string | undefined;
    return {
      providers: this.providers,
      runtime: this.runtime,
      logger: this.logger,
      config: {
        executor_provider: this.config.executor_provider,
        provider_caps: this.config.provider_caps,
        freshness_window_ms: this.config.freshness_window_ms,
      },
      process_tracker: this.process_tracker,
      guard: this.guard,
      tool_index: this.tool_index,
      log_event: (e) => this.log_event(e, team_id, req?.message?.sender_id),
      build_identity_reply: () => this._build_identity_reply(),
      build_system_prompt: (names, prov, chat, cats, alias) => this._build_system_prompt(names, prov, chat, cats, alias),
      get_security_policy: () => this.runtime.get_context_builder().security_override_policy(),
      generate_guard_summary: (text) => this._generate_guard_summary(text),
      run_once: (args) => _run_once(this._runner_deps(args.req), args),
      run_agent_loop: (args) => _run_agent_loop(this._runner_deps(args.req), args),
      run_task_loop: (args) => _run_task_loop(this._runner_deps(args.req), args),
      run_phase_loop: (req, task, hint, cats) => _run_phase_loop(this._phase_deps(req), req, task, hint, cats),
      caps: () => this._caps(),
      execution_gateway: this._execution_gateway,
      direct_executor: this._direct_executor,
      execute_tool: (name, params, ctx) => this.runtime.execute_tool(name, params, ctx),
    };
  }

  async execute(req: OrchestrationRequest): Promise<OrchestrationResult> {
    // OB-1: correlation 확장 — run_id/provider를 추가하여 하위 경로에 전파
    if (req.correlation) {
      req.correlation = extend_correlation(req.correlation, { run_id: req.run_id, provider: req.provider });
      const corr_log = this.logger.child("orchestration:execute", correlation_to_log_context(req.correlation));
      corr_log.info("execute_start", { mode: "pending", provider: req.message.instance_id });
    }

    // OB-5: orchestration span + metrics
    const exec_start = Date.now();
    const exec_span = this._obs.spans.start("orchestration_run", "execute", req.correlation ?? {}, { provider: req.provider }, req._parent_span_id);
    // OB-3: parent_span_id 체인 — 하위 경로(workflow 등)가 이 span을 부모로 참조
    req._parent_span_id = exec_span.span.span_id;

    try {
    // Phase 4.4: Request Preflight — seal, skill 검색, secret 검증, context 조립을 한 경로로 수렴
    const preflight = await run_request_preflight(this._preflight_deps(), req);

    // resumed_task 조기 반환 (semantic 보존)
    if (preflight.kind === "resume") {
      const resume_result = await this.continue_task_loop(req, preflight.resumed_task, preflight.task_with_media, preflight.media);
      record_turn_to_daily(req, resume_result, this.runtime.get_context_builder()?.memory_store);
      exec_span.end("ok", { mode: resume_result.mode, ...(resume_result.stop_reason ? { stop_reason: resume_result.stop_reason } : {}) });
      this._record_orchestration_metrics(exec_start, req.provider);
      this._record_guardrail_metrics(resume_result, req.provider);
      return resume_result;
    }

    // secret 검증 실패 → 조기 차단
    if (!preflight.secret_guard.ok) {
      exec_span.end("ok", { mode: "once", secret_blocked: true });
      this._record_orchestration_metrics(exec_start, req.provider);
      return { reply: format_secret_notice(preflight.secret_guard), mode: "once", tool_calls_count: 0, streamed: false };
    }

    // Phase 4.5: Execute Dispatcher — gateway 라우팅 → short-circuit → mode 분기 → finalize
    const result = await execute_dispatch(this._dispatch_deps(req), req, preflight);
    // 오케스트레이터 레벨 daily 기록 — 에이전트가 memory 도구를 호출하지 않아도 보장
    record_turn_to_daily(req, result, this.runtime.get_context_builder()?.memory_store);
    exec_span.end(result.error ? "error" : "ok", { mode: result.mode, ...(result.stop_reason ? { stop_reason: result.stop_reason } : {}) });
    this._record_orchestration_metrics(exec_start, req.provider);
    this._record_guardrail_metrics(result, req.provider);
    return result;

    } catch (err) {
      exec_span.fail(error_message(err));
      this._obs.metrics.counter("orchestration_runs_total", 1, { provider: req.provider, status: "error" });
      this._obs.metrics.histogram("orchestration_run_duration_ms", Date.now() - exec_start, { provider: req.provider });
      throw err;
    }
  }

  private _record_orchestration_metrics(start: number, provider: string): void {
    this._obs.metrics.counter("orchestration_runs_total", 1, { provider });
    this._obs.metrics.histogram("orchestration_run_duration_ms", Date.now() - start, { provider });
  }

  /** EG-5: guardrail decision 메트릭 방출. stop_reason 기반. */
  private _record_guardrail_metrics(result: OrchestrationResult, provider: string): void {
    record_guardrail_metrics(this._obs.metrics, result, provider);
  }

  /** 컨텍스트 압축 전 메모리 자동 저장 설정 생성. 200K 컨텍스트 기준. */
  private build_compaction_flush(req?: import("./types.js").OrchestrationRequest): CompactionFlushConfig | undefined {
    const mem = this.runtime.get_context_builder()?.memory_store;
    if (!mem) return undefined;
    return {
      context_window: 200_000,
      flush: async () => {
        if (!req) return;
        // scope 지정 라인으로 기록 — session-recorder의 - [scope] 형식 사용
        const now = new Date().toISOString();
        const scope = `${req.provider}:${req.message.chat_id}:-`;
        const line = `- [${now}] [${scope}] SYSTEM: context compaction checkpoint\n`;
        try { await mem.append_daily(line); } catch (e) { this.logger.debug("compaction daily append failed", { error: error_message(e) }); }
      },
    };
  }

  private _get_renderer(): PersonaMessageRendererLike {
    if (!this._renderer) {
      const cb = this.runtime.get_context_builder();
      this._renderer = new PersonaMessageRenderer({
        get_persona_name: () => cb.get_persona_name(),
        get_heart: () => {
          try {
            const ws = this.deps.workspace || ".";
            for (const p of [join(ws, "templates", "HEART.md"), join(ws, "HEART.md")]) {
              if (existsSync(p)) { const r = readFileSync(p, "utf-8").trim(); if (r) return r; }
            }
          } catch { /* no heart */ }
          return "";
        },
      });
    }
    return this._renderer;
  }

  /** identity 질의에 대한 결정적 응답. executor/provider를 타지 않음. */
  private _build_identity_reply(): string {
    return this._get_renderer().render({ kind: "identity" });
  }

  /** 빈 응답 시 사용자-facing 안전 폴백. 내부 오류 메시지 노출 방지. */
  private _build_safe_fallback_reply(): string {
    return this._get_renderer().render({ kind: "safe_fallback" });
  }

  /** HITL 프롬프트를 renderer 기반으로 생성. renderer 없으면 format_hitl_prompt fallback. */
  private _render_hitl(body: string, type: "choice" | "confirmation" | "question" | "escalation" | "error"): string {
    return this._get_renderer().render({ kind: "hitl_prompt", hitl_type: type, body });
  }

  /** concierge 페르소나 어투를 followup 지시에 포함. */
  private build_persona_followup(concierge_heart: string): string {
    const base = "위 실행 결과를 바탕으로 간결하게 한국어로 답하세요.";
    return concierge_heart ? `[응답 어투] ${concierge_heart}\n\n${base}` : base;
  }

  /** AgentRunResult → OrchestrationResult 변환. native_tool_loop 백엔드 결과를 통합 형식으로 변환. */
  private _convert_agent_result(
    result: AgentRunResult,
    mode: ExecutionMode,
    stream: StreamBuffer,
    req: OrchestrationRequest,
  ): OrchestrationResult {
    if (result.finish_reason === "error") {
      const err_detail = String(result.metadata?.error || "")
        || String(result.content || "").slice(0, 200)
        || "agent_backend_error";
      return error_result(mode, stream, err_detail, result.tool_calls_count);
    }
    if (result.finish_reason === "cancelled") {
      return suppress_result(mode, stream, result.tool_calls_count);
    }
    const content = sanitize_provider_output(String(result.content || "")).trim();
    if (!content) {
      this.logger.warn("native_backend_empty", { mode, tool_calls: result.tool_calls_count });
      return reply_result(mode, stream, this._build_safe_fallback_reply(), result.tool_calls_count);
    }
    // agent 에스컬레이션 감지 (native 백엔드)
    if (mode === "agent") {
      const esc = detect_escalation(content, "agent");
      if (esc) return error_result("agent", stream, esc, result.tool_calls_count);
    }
    const provider_err = extract_provider_error(content);
    if (provider_err) return error_result(mode, stream, provider_err, result.tool_calls_count);
    const usage = extract_usage(result.usage);
    const reply = normalize_agent_reply(content, req.alias, req.message.sender_id);
    if (!reply) {
      this.logger.warn("native_backend_empty_after_normalize", { mode, tool_calls: result.tool_calls_count });
      return reply_result(mode, stream, this._build_safe_fallback_reply(), result.tool_calls_count);
    }
    const warn = FINISH_REASON_WARNINGS[result.finish_reason];
    const with_warn = warn ? `${reply}\n\n⚠️ ${warn}` : reply;
    const final_reply = mode === "agent" && result.tool_calls_count === 0
      ? append_no_tool_notice(with_warn)
      : with_warn;
    return reply_result(mode, stream, final_reply, result.tool_calls_count, result.parsed_output, usage);
  }

  /** 시스템 프롬프트를 빌드. alias에 대응하는 role skill이 있으면 컴파일된 role profile을 적용하고, 없으면 concierge 힌트를 사용. */
  private async _build_system_prompt(skill_names: string[], provider: string, chat_id: string, tool_categories?: ReadonlySet<string>, alias?: string): Promise<string> {
    const context_builder = this.runtime.get_context_builder();
    const session_ctx = { channel: provider, chat_id };
    // 시스템 프롬프트 예산. 0이면 무제한 (기본).
    const max_ctx = this.config.system_prompt_max_tokens || undefined;

    // RP-4: alias에 대응하는 role → PromptProfileCompiler로 합성
    const role = alias || "";
    if (role) {
      const profile = this._profile_compiler.compile(role);
      if (profile) {
        const base = await context_builder.build_system_prompt(skill_names, undefined, session_ctx, tool_categories, max_ctx);
        const role_section = this._profile_compiler.render_system_section(profile);
        return `${base}\n\n${role_section}`;
      }
    }

    // role 미매칭 → 기본 시스템 프롬프트 + concierge 힌트
    const system = await context_builder.build_system_prompt(
      skill_names, undefined, session_ctx, tool_categories, max_ctx,
    );
    const concierge_profile = this._profile_compiler.compile("concierge");
    const active_role_hint = concierge_profile?.heart
      ? `\n\n# Active Role: concierge\n${concierge_profile.heart}`
      : "";
    return `${system}${active_role_hint}`;
  }

  /** 재개된 Task loop를 이어서 실행. */
  private async continue_task_loop(
    req: OrchestrationRequest,
    task: import("../contracts.js").TaskState,
    task_with_media: string,
    media: string[],
  ): Promise<OrchestrationResult> {
    return _continue_task_loop(this._continue_deps(req), req, task, task_with_media, media);
  }
}

export type { HitlType } from "./execution/helpers.js";
export { format_hitl_prompt, detect_hitl_type, append_no_tool_notice } from "./execution/helpers.js";

