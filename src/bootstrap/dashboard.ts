/** Dashboard bundle: DashboardService 생성 + ops 팩토리 조립 + SSE/webhook/bus wiring. */

import type { AppConfig } from "../config/schema.js";
import type { ConfigStore } from "../config/config-store.js";
import type { AgentDomain } from "../agent/index.js";
import type { create_agent_runtime } from "../agent/runtime.service.js";
import type { create_agent_inspector } from "../agent/inspector.service.js";
import type { AgentBackendRegistry } from "../agent/agent-registry.js";
import type { AgentProviderStore } from "../agent/provider-store.js";
import type { AgentDefinitionStore } from "../agent/agent-definition.store.js";
import { MemoryStore } from "../agent/memory.service.js";
import type { MessageBusRuntime } from "../bus/types.js";
import type { ChannelManager } from "../channels/manager.js";
import type { ChannelInstanceStore, ChannelRegistryLike } from "../channels/index.js";
import type { SqliteDispatchDlqStore } from "../channels/index.js";
import type { DispatchService } from "../channels/dispatch.service.js";
import type { CliAuthService } from "../agent/cli-auth.service.js";
import type { DecisionService } from "../decision/index.js";
import type { WorkflowEventService } from "../events/index.js";
import type { HeartbeatService } from "../heartbeat/index.js";
import type { McpClientManager } from "../mcp/index.js";
import type { OpsRuntimeService } from "../ops/index.js";
import type { OrchestratorLlmRuntime, ProviderRegistry } from "../providers/index.js";
import type { ProcessTracker } from "../orchestration/process-tracker.js";
import type { CronService } from "../cron/index.js";
import type { OrchestrationServiceLike } from "../orchestration/types.js";
import type { SessionStoreLike } from "../session/index.js";
import type { OAuthIntegrationStore } from "../oauth/integration-store.js";
import type { OAuthFlowService } from "../oauth/flow-service.js";
import type { KanbanStore } from "../services/kanban-store.js";
import type { KanbanAutomationRuntime } from "../services/kanban-automation-runtime.js";
import type { ReferenceStore } from "../services/reference-store.js";
import type { WebhookStore } from "../services/webhook-store.service.js";
import type { MutableBroadcaster } from "../dashboard/broadcaster.js";
import { DashboardService, type DashboardWorkflowOps } from "../dashboard/service.js";
import {
  create_template_ops, create_channel_ops, create_agent_provider_ops,
  create_bootstrap_ops, create_memory_ops, create_workspace_ops, create_oauth_ops,
  create_config_ops, create_skill_ops, create_tool_ops, create_cli_auth_ops, create_model_ops,
  create_agent_definition_ops,
} from "../dashboard/ops-factory.js";
import { UsageStore } from "../gateway/usage-store.js";
import type { AuthService } from "../auth/auth-service.js";
import { WorkspaceResolver } from "../workspace/resolver.js";
import type { WorkspaceRegistry } from "../workspace/registry.js";
import type { ObservabilityLike } from "../observability/context.js";
import type { ProviderScopeFilter } from "../agent/provider-store.js";

/** TN-5: scope-aware chat provider 선택. 테스트에서 직접 호출 가능. */
export function find_scoped_chat_provider(provider_store: AgentProviderStore, scope?: ProviderScopeFilter) {
  // chat 용도만 선택 — embedding 모델은 생성/대화에 사용 불가
  return provider_store.list(scope).find((p) => p.enabled && p.model_purpose === "chat") ?? null;
}

export interface DashboardBundleDeps {
  workspace: string;
  app_config: AppConfig;
  config_store: ConfigStore;
  agent: AgentDomain;
  agent_runtime: ReturnType<typeof create_agent_runtime>;
  agent_inspector: ReturnType<typeof create_agent_inspector>;
  agent_backend_registry: AgentBackendRegistry;
  provider_store: AgentProviderStore;
  providers: ProviderRegistry;
  bus: MessageBusRuntime;
  broadcaster: MutableBroadcaster;
  channel_manager: ChannelManager;
  channels: ChannelRegistryLike;
  instance_store: ChannelInstanceStore;
  cli_auth: CliAuthService;
  decisions: DecisionService;
  events: WorkflowEventService;
  heartbeat: HeartbeatService;
  mcp: McpClientManager;
  ops: OpsRuntimeService;
  orchestrator_llm_runtime: OrchestratorLlmRuntime;
  orchestration: OrchestrationServiceLike;
  process_tracker: ProcessTracker;
  cron: CronService;
  sessions: SessionStoreLike;
  dlq_store: InstanceType<typeof SqliteDispatchDlqStore> | null;
  dispatch: DispatchService;
  oauth_store: OAuthIntegrationStore;
  oauth_flow: OAuthFlowService;
  kanban_store: KanbanStore;
  kanban_automation: KanbanAutomationRuntime;
  reference_store: ReferenceStore;
  webhook_store: WebhookStore;
  agent_definition_store: AgentDefinitionStore;
  user_dir: string;
  workflow_ops_result: DashboardWorkflowOps | null;
  usage_store?: UsageStore | null;
  auth_svc?: AuthService | null;
  workspace_registry?: WorkspaceRegistry | null;
  observability?: ObservabilityLike | null;
}

export interface DashboardBundleResult {
  dashboard: DashboardService | null;
  agent_provider_ops: ReturnType<typeof create_agent_provider_ops>;
  /** RPF-4F: 최신 ValidatorSummary 공급/업데이트 포트. 외부에서 set_latest()로 push 가능. */
  validator_summary_ops: {
    get_latest(): import("../repo-profile/validator-summary-adapter.js").ValidatorSummary | null;
    set_latest(s: import("../repo-profile/validator-summary-adapter.js").ValidatorSummary | null): void;
  };
}

export function create_dashboard_bundle(deps: DashboardBundleDeps): DashboardBundleResult {
  const {
    workspace, app_config, config_store,
    agent, agent_runtime, agent_inspector, agent_backend_registry, provider_store, providers,
    bus, broadcaster, channel_manager, channels, instance_store,
    cli_auth, decisions, events, heartbeat, mcp, ops,
    orchestrator_llm_runtime, orchestration, process_tracker, cron,
    sessions, dlq_store, dispatch, oauth_store, oauth_flow,
    kanban_store, kanban_automation, reference_store, webhook_store,
    agent_definition_store, workflow_ops_result, usage_store: provided_usage_store,
    user_dir, auth_svc, workspace_registry,
  } = deps;

  const agent_provider_ops = create_agent_provider_ops({
    provider_store, agent_backends: agent_backend_registry,
    provider_registry: providers, workspace,
  });

  let _latest_summary: import("../repo-profile/validator-summary-adapter.js").ValidatorSummary | null = null;
  const validator_summary_ops = {
    get_latest: () => _latest_summary,
    set_latest: (s: import("../repo-profile/validator-summary-adapter.js").ValidatorSummary | null) => { _latest_summary = s; },
  };

  if (!app_config.dashboard.enabled) {
    return { dashboard: null, agent_provider_ops, validator_summary_ops };
  }

  const usage_store = provided_usage_store ?? new UsageStore(user_dir);

  const dash = new DashboardService({
    host: app_config.dashboard.host,
    port: app_config.dashboard.port,
    port_fallback: app_config.dashboard.portFallback,
    agent: agent_inspector,
    bus,
    channels: channel_manager,
    heartbeat,
    ops,
    decisions,
    promises: agent.context.promise_service,
    events,
    process_tracker,
    cron,
    task_ops: {
      async cancel_task(id, reason, opts) {
        if (opts?.team_id !== undefined) {
          const t = await agent_runtime.get_task(id);
          if (!t || t.team_id !== opts.team_id) return null;
        }
        return agent_runtime.cancel_task(id, reason);
      },
      async get_task(id, opts) {
        const t = await agent_runtime.get_task(id);
        if (!t) return null;
        if (opts?.team_id !== undefined && t.team_id !== opts.team_id) return null;
        return t;
      },
      async resume_task(id, text, opts) {
        if (opts?.team_id !== undefined) {
          const t = await agent_runtime.get_task(id);
          if (!t || t.team_id !== opts.team_id) return null;
        }
        return agent_runtime.resume_task(id, text);
      },
    },
    stats_ops: {
      get_cd_score: () => orchestration.get_cd_score(),
      reset_cd_score: () => orchestration.reset_cd_score(),
    },
    dlq: dlq_store,
    dispatch,
    secrets: providers.get_secret_vault(),
    config_ops: create_config_ops({ app_config, config_store }),
    skill_ops: create_skill_ops({ skills_loader: agent.context.skills_loader, workspace: user_dir }),
    tool_ops: create_tool_ops({ tool_names: () => agent.tools.tool_names(), get_definitions: () => agent.tools.get_definitions(), mcp }),
    template_ops: create_template_ops(workspace),
    channel_ops: create_channel_ops({ channels, instance_store, app_config, workspace_dir: workspace }),
    agent_provider_ops,
    bootstrap_ops: create_bootstrap_ops({ provider_store, config_store, provider_registry: providers, agent_backends: agent_backend_registry, workspace }),
    session_store: sessions,
    memory_ops: create_memory_ops(agent.context.memory_store),
    memory_store_factory: auth_svc ? (root: string) => new MemoryStore(root) : null,
    workspace_ops: create_workspace_ops(user_dir),
    oauth_ops: create_oauth_ops({ oauth_store, oauth_flow, dashboard_port: app_config.dashboard.port, public_url: app_config.dashboard.publicUrl }),
    cli_auth_ops: create_cli_auth_ops({ cli_auth }),
    model_ops: orchestrator_llm_runtime ? create_model_ops(orchestrator_llm_runtime) : null,
    usage_ops: usage_store,
    prompt_ops: {
      async run(input) {
        const chat_provider = find_scoped_chat_provider(provider_store, input.scope_filter);
        const resolved_provider = input.provider_id ?? chat_provider?.provider_type ?? null;
        const t0 = Date.now();
        const result = await providers.run_headless_prompt({
          provider_id: (input.provider_id ?? chat_provider?.provider_type) as import("../providers/types.js").ProviderId | undefined,
          prompt: input.prompt,
          system: input.system,
          model: input.model,
          temperature: input.temperature,
          max_tokens: input.max_tokens,
        });
        const latency_ms = Date.now() - t0;
        return {
          content: result?.content ?? null,
          provider_id: resolved_provider,
          finish_reason: result?.finish_reason ?? "stop",
          model: (result?.metadata?.["model"] as string) ?? input.model ?? "",
          latency_ms,
          usage: {
            prompt_tokens: result?.usage.prompt_tokens,
            completion_tokens: result?.usage.completion_tokens,
            total_tokens: result?.usage.total_tokens,
            cost_usd: result?.usage.total_cost_usd,
          },
        };
      },
    },
    agent_definition_ops: create_agent_definition_ops({
      store: agent_definition_store,
      generate_fn: async (prompt, scope, explicit_provider_id) => {
        const chat_provider = find_scoped_chat_provider(provider_store, scope);
        // 사용자 프롬프트 언어 감지 → 응답 언어 지시
        const has_korean = /[가-힣]/.test(prompt);
        const lang_instruction = has_korean
          ? "IMPORTANT: All string values in the JSON MUST be written in Korean (한국어). Field names remain in English."
          : "";
        // 등록된 도구/스킬 목록을 프롬프트에 주입 — 존재하지 않는 이름 방지
        const available_tools = agent.tools.tool_names();
        const available_skills = agent.context.skills_loader
          .list_skills(false).map((s) => s.name).filter(Boolean);
        const tools_constraint = available_tools.length > 0
          ? `\nAvailable tools (ONLY pick from this list): [${available_tools.join(", ")}]`
          : "";
        const skills_constraint = available_skills.length > 0
          ? `\nAvailable skills (ONLY pick from this list): [${available_skills.join(", ")}]`
          : "";
        const gen_messages = [
          {
            role: "user" as const,
            content: `IMPORTANT: Do NOT use any tools. Respond with plain text only.

You are an AI agent designer. Given a description, output a JSON object with these exact fields:
{"name":"string","description":"string (one-line summary)","icon":"single emoji","role_skill":"string|null (e.g. role:pm, role:implementer, or null if custom)","soul":"string (persona/character)","heart":"string (behavior/manner)","tools":["string array"],"shared_protocols":["string array from: clarification-protocol,phase-gates,error-escalation,session-metrics,difficulty-guide"],"skills":["string array"],"use_when":"string","not_use_for":"string","extra_instructions":"","preferred_providers":[],"model":null}
${tools_constraint}${skills_constraint}

${lang_instruction}
Output ONLY the JSON object, no markdown, no explanation.

Description: ${prompt}`,
          },
        ];
        // 프로바이더 fallback: explicit → scoped chat → 전체 chat 프로바이더 순회 (embedding 제외)
        const chat_list = provider_store.list().filter((p) => p.enabled && p.model_purpose === "chat");
        const candidates = explicit_provider_id
          ? [explicit_provider_id, ...chat_list.filter((p) => p.provider_type !== explicit_provider_id).map((p) => p.provider_type)]
          : chat_provider
            ? [chat_provider.provider_type, ...chat_list.filter((p) => p.provider_type !== chat_provider.provider_type).map((p) => p.provider_type)]
            : chat_list.map((p) => p.provider_type);
        let last_error: unknown;
        for (const pid of candidates) {
          try {
            const result = await providers.run_headless({
              provider_id: pid as import("../providers/types.js").ProviderId | undefined,
              messages: gen_messages,
              tools: [], // 도구 비활성화 — 텍스트 전용 응답 강제
            });
            // content 또는 tool_calls에서 텍스트 추출
            let raw = result?.content ?? "";
            if (!raw && result?.tool_calls?.length) {
              // tool_calls arguments에서 JSON 추출 시도
              raw = result.tool_calls.map((tc) => JSON.stringify(tc.arguments)).join("\n");
            }
            if (!raw) continue;
            let text = raw.trim();
            // CLI 프로바이더 래핑 제거 + JSON 블록 추출
            text = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
            // 응답에서 첫 번째 JSON 객체 추출 (텍스트가 섞여있을 수 있음)
            const json_match = text.match(/\{[\s\S]*\}/);
            if (!json_match) continue;
            const parsed = JSON.parse(json_match[0]) as import("../agent/agent-definition.types.js").GeneratedAgentFields;
            // 유효성 검증: 최소한 name 또는 soul 필드가 있어야 유효한 에이전트 정의
            if (parsed.name || parsed.soul || parsed.heart) return parsed;
          } catch (e) {
            last_error = e;
          }
        }
        if (last_error) throw last_error;
        return null;
      },
    }),
    workflow_ops: workflow_ops_result,
    auth_svc: auth_svc ?? null,
    workspace_resolver: auth_svc ? new WorkspaceResolver(workspace) : null,
    workspace_registry: workspace_registry ?? null,
    kanban_store,
    kanban_rule_executor: () => kanban_automation.get_rule_executor(),
    reference_store,
    default_alias: app_config.channel.defaultAlias,
    workspace,
    webhookSecret: app_config.dashboard.webhookSecret,
    /** H-10: CORS 허용 origin 목록을 설정에서 주입. */
    cors_origins: app_config.dashboard.corsOrigins ?? [],
    observability: deps.observability,
    validator_summary_ops,
  });

  broadcaster.attach(dash.sse);
  if (deps.observability) dash.sse.set_observability(deps.observability);
  dash.set_oauth_callback_handler((code: string, state: string) => oauth_flow.handle_callback(code, state));
  dash.set_webhook_store(webhook_store);
  dash.register_channel_callbacks();
  bus.on_publish((dir, msg) => {
    const meta = (msg.metadata ?? {}) as Record<string, unknown>;
    const msg_team_id = typeof meta.team_id === "string" ? meta.team_id : undefined;
    // TN-6b: user_id — web inbound는 sender_id가 user_id, 그 외는 metadata에서 추출
    const msg_user_id = typeof meta.user_id === "string" ? meta.user_id : (msg.provider === "web" ? msg.sender_id : undefined);
    broadcaster.broadcast_message_event(dir, msg.sender_id, msg.content, msg.chat_id, msg_team_id, msg_user_id);
    if (dir === "outbound" && msg.provider === "web" && msg.chat_id) {
      const media = msg.media?.map((m) => ({ type: m.type as string, url: m.url, mime: m.mime, name: m.name }));
      const msg_meta = (msg.metadata ?? {}) as Record<string, unknown>;
      const routing = {
        requested_channel: typeof msg_meta.origin_channel === "string" ? msg_meta.origin_channel : msg.provider,
        delivered_channel: msg.provider,
        execution_route: typeof msg_meta.execution_route === "string" ? msg_meta.execution_route : undefined,
      };
      dash.capture_web_outbound(msg.chat_id, msg.content, media, routing);
      broadcaster.broadcast_web_message(msg.chat_id, msg_team_id);
    }
  });

  return { dashboard: dash, agent_provider_ops, validator_summary_ops };
}
