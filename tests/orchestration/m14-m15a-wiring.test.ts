/**
 * M-14 reducer + M-15a evaluate_route wiring integration tests.
 * GPT 감사 [T-2] 보정 — production 코드 직접 호출.
 *
 * M-14: OrchestrationService.constructor (service.ts:245) wires
 *       create_tool_output_reducer into tool_deps.reducer.
 *       This test verifies the production OrchestrationService instance
 *       exposes a functional reducer through its internal tool_deps.
 *
 * M-15a: execute_dispatch finalize (execute-dispatcher.ts:202-211) calls
 *        evaluate_route and emits misroute events via deps.log_event.
 *        This test verifies that execute_dispatch invokes evaluate_route
 *        for each completed request and logs misroute events when the
 *        actual mode differs from the preferred mode in DEFAULT_ROUTE_CRITERIA.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── M-14: OrchestrationService reducer wiring ─────────────────────

import { OrchestrationService } from "@src/orchestration/service.js";
import { HitlPendingStore } from "@src/orchestration/hitl-pending-store.js";
import type { ToolCallHandlerDeps } from "@src/orchestration/tool-call-handler.js";
import { create_tool_call_handler } from "@src/orchestration/tool-call-handler.js";
import type { ToolOutputReducer } from "@src/orchestration/tool-output-reducer.js";

// ── M-15a: execute_dispatch evaluate_route wiring ──────────────────

import { execute_dispatch } from "@src/orchestration/execution/execute-dispatcher.js";
import type { ExecuteDispatcherDeps } from "@src/orchestration/execution/execute-dispatcher.js";
import type { ReadyPreflight } from "@src/orchestration/request-preflight.js";
import type { OrchestrationRequest } from "@src/orchestration/types.js";
import type { Logger } from "@src/logger.js";
import * as gatewayModule from "@src/orchestration/gateway.js";
import type { GatewayDecision } from "@src/orchestration/gateway.js";
import { evaluate_route, DEFAULT_ROUTE_CRITERIA } from "@src/quality/route-calibration-policy.js";

// ═══════════════════════════════════════════════════════════════════
// M-14: OrchestrationService constructor wires reducer into tool_deps
// ═══════════════════════════════════════════════════════════════════

describe("M-14: OrchestrationService.constructor — reducer wiring", () => {
  function make_service(max_tool_result_chars: number) {
    const cb = {
      get_persona_name: vi.fn().mockReturnValue("Aria"),
      get_bootstrap: vi.fn().mockReturnValue({ exists: false, content: "" }),
      memory_store: { append_daily: vi.fn().mockResolvedValue(undefined) },
      skills_loader: {
        get_role_skill: vi.fn().mockReturnValue(null),
        build_skill_summary: vi.fn().mockReturnValue(""),
        load_skills_for_context: vi.fn().mockReturnValue(""),
        load_role_context: vi.fn().mockReturnValue(""),
      },
      build_system_prompt: vi.fn().mockResolvedValue("system_prompt"),
    };
    const service = new OrchestrationService({
      providers: {
        run_orchestrator: vi.fn().mockResolvedValue({ content: "ok" }),
      } as never,
      agent_runtime: {
        get_context_builder: vi.fn().mockReturnValue(cb),
        execute_tool: vi.fn().mockResolvedValue("tool_result_text"),
        get_tool_definitions: vi.fn().mockReturnValue([]),
      } as never,
      secret_vault: { list_references: vi.fn().mockResolvedValue([]) } as never,
      runtime_policy_resolver: { resolve: vi.fn().mockResolvedValue({}) } as never,
      config: {
        executor_provider: "chatgpt" as never,
        agent_loop_max_turns: 10,
        task_loop_max_turns: 20,
        streaming_enabled: true,
        streaming_interval_ms: 100,
        streaming_min_chars: 50,
        streaming_max_chars: 0,
        max_tool_result_chars,
        orchestrator_max_tokens: 1000,
        max_tool_calls_per_run: 0,
        freshness_window_ms: 0,
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as never,
      hitl_pending_store: new HitlPendingStore(),
      session_cd: {
        get_score: vi.fn().mockReturnValue({ total: 0, events: [] }),
        record: vi.fn(),
        observe: vi.fn(),
        reset: vi.fn(),
      },
    });
    return service;
  }

  it("constructor sets reducer on tool_deps from config.max_tool_result_chars", () => {
    const service = make_service(200);
    // Access the private tool_deps via the service instance.
    // The field is private but exists on the runtime object.
    const tool_deps = (service as Record<string, unknown>)["tool_deps"] as ToolCallHandlerDeps;

    expect(tool_deps).toBeDefined();
    expect(tool_deps.reducer).toBeDefined();
  });

  it("tool_deps.reducer.reduce produces 3 projections for non-error input", () => {
    const service = make_service(100);
    const tool_deps = (service as Record<string, unknown>)["tool_deps"] as ToolCallHandlerDeps;
    const reducer = tool_deps.reducer as ToolOutputReducer;

    const long_text = "x".repeat(500);
    const reduced = reducer.reduce({
      tool_name: "read_file",
      params: { path: "/test.txt" },
      result_text: long_text,
      is_error: false,
    });

    // prompt_text should be truncated (max_prompt_chars=100)
    expect(reduced.prompt_text.length).toBeLessThan(long_text.length);
    // display_text uses 2x the max, also truncated
    expect(reduced.display_text.length).toBeLessThan(long_text.length);
    // storage_text uses 1.5x the max, also truncated
    expect(reduced.storage_text.length).toBeLessThan(long_text.length);
    // meta.truncated should be true
    expect(reduced.meta.truncated).toBe(true);
    expect(reduced.meta.raw_chars).toBe(500);
  });

  it("tool_deps.reducer passes through error text without truncation", () => {
    const service = make_service(50);
    const tool_deps = (service as Record<string, unknown>)["tool_deps"] as ToolCallHandlerDeps;
    const reducer = tool_deps.reducer as ToolOutputReducer;

    const error_text = "Error: ENOENT: no such file or directory '/missing.txt'";
    const reduced = reducer.reduce({
      tool_name: "read_file",
      params: { path: "/missing.txt" },
      result_text: error_text,
      is_error: true,
    });

    expect(reduced.prompt_text).toBe(error_text);
    expect(reduced.display_text).toBe(error_text);
    expect(reduced.storage_text).toBe(error_text);
    expect(reduced.meta.truncated).toBe(false);
  });

  it("tool_deps.reducer integrates with create_tool_call_handler — prompt_text flows to handler output", async () => {
    const service = make_service(80);
    const tool_deps = (service as Record<string, unknown>)["tool_deps"] as ToolCallHandlerDeps;

    // Build a handler using the production tool_deps (with the wired reducer)
    const mock_tool_ctx = {
      task_id: "t-1",
      signal: undefined as never,
      channel: "slack",
      chat_id: "c-1",
      sender_id: "u-1",
      reply_to: "m-1",
    };
    const state = { suppress: false, tool_count: 0 };

    // Override execute_tool to return a long result
    const long_result = "data_line ".repeat(100);
    const handler_deps: ToolCallHandlerDeps = {
      ...tool_deps,
      execute_tool: vi.fn(async () => long_result),
    };

    const handler = create_tool_call_handler(handler_deps, mock_tool_ctx, state);
    const output = await handler({
      tool_calls: [{ name: "read_file", arguments: { path: "/big.txt" } }],
    });

    // The handler output should contain the tool prefix and the truncated prompt_text
    expect(output).toContain("[tool:read_file]");
    // The output length should be shorter than the raw result
    // because the reducer (max_prompt_chars=80) truncates long text
    expect(output.length).toBeLessThan(long_result.length);
    expect(state.tool_count).toBe(1);
  });

  it("tool_deps flows through _runner_deps and preserves reducer reference", () => {
    const service = make_service(300);
    // _runner_deps returns an object with tool_deps.reducer intact
    const runner_deps = (service as Record<string, (...args: unknown[]) => unknown>)["_runner_deps"]();
    const runner_tool_deps = (runner_deps as Record<string, unknown>)["tool_deps"] as ToolCallHandlerDeps;

    expect(runner_tool_deps.reducer).toBeDefined();
    // Verify it is the same reducer instance as in the service
    const direct_tool_deps = (service as Record<string, unknown>)["tool_deps"] as ToolCallHandlerDeps;
    // _runner_deps spreads tool_deps with a custom log_event, so reducer reference is preserved
    expect(runner_tool_deps.reducer).toBe(direct_tool_deps.reducer);
  });
});

// ═══════════════════════════════════════════════════════════════════
// M-15a: execute_dispatch finalize calls evaluate_route + misroute event
// ═══════════════════════════════════════════════════════════════════

describe("M-15a: execute_dispatch finalize — evaluate_route + misroute event", () => {
  let gatewaySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    gatewaySpy = vi.spyOn(gatewayModule, "resolve_gateway");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockRequest: OrchestrationRequest = {
    message: {
      id: "msg-1",
      provider: "slack",
      channel: "general",
      sender_id: "user1",
      chat_id: "chat1",
      content: "deploy the service",
      at: new Date().toISOString(),
      thread_id: undefined,
      metadata: { message_id: "msg-1" },
    },
    provider: "slack",
    alias: "",
    run_id: "run-1",
    media_inputs: [],
    session_history: [],
    signal: undefined as never,
  };

  const mockPreflight: ReadyPreflight = {
    kind: "ready",
    task_with_media: "deploy the service",
    media: [],
    skill_names: [],
    secret_guard: { ok: true, missing_keys: [], invalid_ciphertexts: [] },
    runtime_policy: { max_turns: 5, tools_blocklist: [], tools_allowlist: [] },
    all_tool_definitions: [],
    request_scope: "scope-1",
    request_task_id: "task-1",
    run_id: "run-1",
    evt_base: {
      run_id: "run-1",
      task_id: "task-1",
      agent_id: "test",
      provider: "slack",
      channel: "slack",
      chat_id: "chat1",
      source: "inbound",
    },
    context_block: "",
    tool_ctx: {
      task_id: "task-1",
      signal: undefined as never,
      channel: "slack",
      chat_id: "chat1",
      sender_id: "user1",
    },
    skill_tool_names: [],
    skill_provider_prefs: [],
    category_map: {},
    tool_categories: [],
    active_tasks_in_chat: [],
  } as ReadyPreflight;

  function make_dispatch_deps(overrides: Partial<ExecuteDispatcherDeps> = {}): ExecuteDispatcherDeps {
    return {
      providers: { run_orchestrator: vi.fn(async () => ({ content: "mock" })) } as never,
      runtime: {
        list_active_tasks: vi.fn(() => []),
        find_session_by_task: vi.fn(() => null),
        get_context_builder: vi.fn(() => ({
          skills_loader: { get_skill_metadata: vi.fn(() => null), get_role_skill: vi.fn(() => null) },
        })),
      } as never,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as Logger,
      config: {
        executor_provider: "chatgpt",
        provider_caps: { chatgpt_available: true, claude_available: false, openrouter_available: false },
      },
      process_tracker: null,
      guard: null,
      tool_index: null,
      log_event: vi.fn(),
      build_identity_reply: vi.fn(() => "I am Claude"),
      build_system_prompt: vi.fn(async () => "system"),
      generate_guard_summary: vi.fn(async () => "summary"),
      run_once: vi.fn(async () => ({ reply: "done", mode: "once" as const, tool_calls_count: 0, streamed: false })),
      run_agent_loop: vi.fn(async () => ({ reply: "done", mode: "agent" as const, tool_calls_count: 2, streamed: false })),
      run_task_loop: vi.fn(async () => ({ reply: "done", mode: "task" as const, tool_calls_count: 0, streamed: false })),
      run_phase_loop: vi.fn(async () => ({ reply: "done", mode: "phase" as const, tool_calls_count: 0, streamed: false })),
      caps: vi.fn(() => ({ chatgpt_available: true, claude_available: false, openrouter_available: false })),
      ...overrides,
    };
  }

  it("once mode — evaluate_route returns passed=true, no misroute event", async () => {
    const logEventSpy = vi.fn();
    const deps = make_dispatch_deps({ log_event: logEventSpy });

    gatewaySpy.mockResolvedValue({
      action: "execute",
      mode: "once",
      executor: "chatgpt",
    } as GatewayDecision);

    await execute_dispatch(deps, mockRequest, mockPreflight);

    // DEFAULT_ROUTE_CRITERIA prefers "once", allowed: ["once","agent"]
    // actual=once matches preferred → passed=true, no misroute
    const route_eval = evaluate_route("once", DEFAULT_ROUTE_CRITERIA);
    expect(route_eval.passed).toBe(true);
    expect(route_eval.misroute).toBeUndefined();

    // Verify no misroute event was logged
    const misroute_events = logEventSpy.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null &&
        (call[0] as Record<string, unknown>).summary &&
        String((call[0] as Record<string, unknown>).summary).startsWith("misroute:"),
    );
    expect(misroute_events).toHaveLength(0);
  });

  it("agent mode — evaluate_route detects cost_tradeoff misroute + event emitted", async () => {
    const logEventSpy = vi.fn();
    const deps = make_dispatch_deps({ log_event: logEventSpy });

    gatewaySpy.mockResolvedValue({
      action: "execute",
      mode: "agent",
      executor: "chatgpt",
    } as GatewayDecision);

    const result = await execute_dispatch(deps, mockRequest, mockPreflight);

    expect(result.reply).toBe("done");
    expect(result.mode).toBe("agent");

    // evaluate_route with actual="agent", preferred="once" → passed=true, misroute=cost_tradeoff
    const route_eval = evaluate_route("agent", DEFAULT_ROUTE_CRITERIA);
    expect(route_eval.passed).toBe(true);
    expect(route_eval.misroute).toBeDefined();
    expect(route_eval.misroute!.codes).toContain("cost_tradeoff");
    expect(route_eval.misroute!.severity).toBe("minor");

    // Verify misroute event was logged in finalize
    const misroute_events = logEventSpy.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null &&
        (call[0] as Record<string, unknown>).summary &&
        String((call[0] as Record<string, unknown>).summary).startsWith("misroute:"),
    );
    expect(misroute_events).toHaveLength(1);
    const event_payload = (misroute_events[0][0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect(event_payload.actual).toBe("agent");
    expect(event_payload.expected).toBe("once");
    expect(event_payload.severity).toBe("minor");
  });

  it("task mode — evaluate_route detects NOT-allowed mode + major misroute event", async () => {
    const logEventSpy = vi.fn();
    const deps = make_dispatch_deps({ log_event: logEventSpy });

    gatewaySpy.mockResolvedValue({
      action: "execute",
      mode: "task",
      executor: "chatgpt",
    } as GatewayDecision);

    const result = await execute_dispatch(deps, mockRequest, mockPreflight);

    expect(result.reply).toBe("done");
    expect(result.mode).toBe("task");

    // task is NOT in allowed_modes=["once","agent"] → passed=false, misroute
    const route_eval = evaluate_route("task", DEFAULT_ROUTE_CRITERIA);
    expect(route_eval.passed).toBe(false);
    expect(route_eval.misroute).toBeDefined();
    expect(route_eval.misroute!.codes).toContain("unnecessary_task");
    expect(route_eval.misroute!.severity).toBe("major");

    // Verify misroute event in finalize with major severity
    const misroute_events = logEventSpy.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null &&
        (call[0] as Record<string, unknown>).summary &&
        String((call[0] as Record<string, unknown>).summary).startsWith("misroute:"),
    );
    expect(misroute_events).toHaveLength(1);
    const event = misroute_events[0][0] as Record<string, unknown>;
    expect(String(event.summary)).toContain("major");
    expect(String(event.summary)).toContain("unnecessary_task");
    const payload = event.payload as Record<string, unknown>;
    expect(payload.severity).toBe("major");
    expect(payload.passed).toBe(false);
  });

  it("phase mode — finalize still calls evaluate_route on phase result", async () => {
    const logEventSpy = vi.fn();
    const deps = make_dispatch_deps({ log_event: logEventSpy });

    gatewaySpy.mockResolvedValue({
      action: "execute",
      mode: "phase",
      executor: "chatgpt",
      workflow_id: "wf-1",
    } as GatewayDecision);

    const result = await execute_dispatch(deps, mockRequest, mockPreflight);

    expect(result.mode).toBe("phase");

    // phase is NOT in allowed_modes → misroute
    const route_eval = evaluate_route("phase", DEFAULT_ROUTE_CRITERIA);
    expect(route_eval.passed).toBe(false);
    expect(route_eval.misroute).toBeDefined();
    expect(route_eval.misroute!.codes).toContain("phase_over_once");

    // Verify misroute event emitted for phase
    const misroute_events = logEventSpy.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null &&
        (call[0] as Record<string, unknown>).summary &&
        String((call[0] as Record<string, unknown>).summary).startsWith("misroute:"),
    );
    expect(misroute_events).toHaveLength(1);
    const payload = (misroute_events[0][0] as Record<string, unknown>).payload as Record<string, unknown>;
    expect(payload.actual).toBe("phase");
    expect(payload.expected).toBe("once");
  });

  it("error result — finalize still calls evaluate_route and emits misroute if applicable", async () => {
    const logEventSpy = vi.fn();
    const deps = make_dispatch_deps({
      log_event: logEventSpy,
      run_agent_loop: vi.fn(async () => ({
        error: "agent execution failed",
        mode: "agent" as const,
        tool_calls_count: 0,
        streamed: false,
      })),
    });

    gatewaySpy.mockResolvedValue({
      action: "execute",
      mode: "agent",
      executor: "chatgpt",
    } as GatewayDecision);

    const result = await execute_dispatch(deps, mockRequest, mockPreflight);

    expect(result.error).toContain("agent execution failed");

    // Even on error, finalize calls evaluate_route — agent vs preferred once
    const misroute_events = logEventSpy.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === "object" && call[0] !== null &&
        (call[0] as Record<string, unknown>).summary &&
        String((call[0] as Record<string, unknown>).summary).startsWith("misroute:"),
    );
    expect(misroute_events).toHaveLength(1);
  });
});
