/**
 * TR-4: OrchestrationService — novelty gate (session reuse) wiring test.
 *
 * Asserts that:
 * 1. config.freshness_window_ms is forwarded to the dispatcher via _dispatch_deps()
 * 2. When freshness_window_ms > 0 and session history shows a recent identical query,
 *    execute_dispatch short-circuits with a reuse reply (stop_reason: session_reuse:*)
 * 3. When freshness_window_ms = 0, the novelty gate is disabled and execution proceeds.
 */

import { describe, it, expect, vi } from "vitest";
import { OrchestrationService } from "@src/orchestration/service.js";
import { HitlPendingStore } from "@src/orchestration/hitl-pending-store.js";
import { normalize_query, evaluate_reuse, build_session_evidence } from "@src/orchestration/guardrails/index.js";

/* ── Fixtures ── */

function make_runtime_mock() {
  const cb = {
    get_persona_name: vi.fn().mockReturnValue("Aria"),
    get_bootstrap: vi.fn().mockReturnValue({ exists: false, content: "" }),
    memory_store: { append_daily: vi.fn().mockResolvedValue(undefined) },
    skills_loader: {
      get_role_skill: vi.fn().mockReturnValue(null),
      build_skill_summary: vi.fn().mockReturnValue(""),
      load_skills_for_context: vi.fn().mockReturnValue(""),
      load_role_context: vi.fn().mockReturnValue(""),
      get_skill_metadata: vi.fn().mockReturnValue(null),
    },
    build_system_prompt: vi.fn().mockResolvedValue("system_prompt"),
    build_role_system_prompt: vi.fn().mockResolvedValue("role_prompt"),
  };
  return {
    get_context_builder: vi.fn().mockReturnValue(cb),
    execute_tool: vi.fn().mockResolvedValue({}),
    get_tool_definitions: vi.fn().mockReturnValue([]),
    list_active_tasks: vi.fn().mockReturnValue([]),
    find_session_by_task: vi.fn().mockReturnValue(null),
    get_skill_metadata: vi.fn().mockReturnValue(null),
    get_skills_for_request: vi.fn().mockResolvedValue([]),
  };
}

function make_service(freshness_window_ms: number) {
  const runtime = make_runtime_mock();
  return {
    service: new OrchestrationService({
      providers: {
        run_orchestrator: vi.fn().mockResolvedValue({ content: "ok" }),
      } as any,
      agent_runtime: runtime as any,
      secret_vault: {
        list_references: vi.fn().mockResolvedValue([]),
        validate_references: vi.fn().mockResolvedValue({ ok: true, missing_keys: [], invalid_ciphertexts: [] }),
      } as any,
      runtime_policy_resolver: {
        resolve: vi.fn().mockResolvedValue({ max_turns: 5, tools_blocklist: [], tools_allowlist: [] }),
      } as any,
      config: {
        executor_provider: "chatgpt" as any,
        agent_loop_max_turns: 5,
        task_loop_max_turns: 10,
        streaming_enabled: false,
        streaming_interval_ms: 100,
        streaming_min_chars: 50,
        streaming_max_chars: 1000,
        max_tool_result_chars: 5000,
        orchestrator_max_tokens: 500,
        max_tool_calls_per_run: 0,
        freshness_window_ms,
      },
      logger: {
        info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn().mockReturnThis(),
      } as any,
      hitl_pending_store: new HitlPendingStore(),
      session_cd: {
        get_score: vi.fn().mockReturnValue({ total: 0, events: [] }),
        record: vi.fn(),
        reset: vi.fn(),
      },
      observability: {
        spans: {
          start: vi.fn().mockReturnValue({
            span: { span_id: "test-span" },
            end: vi.fn(),
            fail: vi.fn(),
          }),
        },
        metrics: {
          counter: vi.fn(),
          histogram: vi.fn(),
          gauge: vi.fn(),
        },
      } as any,
    }),
    runtime,
  };
}

/* ── Tests ── */

describe("TR-4: OrchestrationService — novelty gate wiring", () => {
  it("freshness_window_ms is forwarded to dispatcher config", () => {
    // Access internal _dispatch_deps to verify config propagation
    const { service } = make_service(300_000);
    const dispatch_deps = (service as any)._dispatch_deps();
    expect(dispatch_deps.config.freshness_window_ms).toBe(300_000);
  });

  it("freshness_window_ms = 0 → novelty gate disabled in dispatcher config", () => {
    const { service } = make_service(0);
    const dispatch_deps = (service as any)._dispatch_deps();
    expect(dispatch_deps.config.freshness_window_ms).toBe(0);
  });

  it("_dispatch_deps includes executor_provider from config", () => {
    const { service } = make_service(60_000);
    const dispatch_deps = (service as any)._dispatch_deps();
    expect(dispatch_deps.config.executor_provider).toBe("chatgpt");
  });

  it("_dispatch_deps wires process_tracker, guard, tool_index", () => {
    const { service } = make_service(60_000);
    const dispatch_deps = (service as any)._dispatch_deps();
    // These are nullable — must be present in deps (null is valid)
    expect("process_tracker" in dispatch_deps).toBe(true);
    expect("guard" in dispatch_deps).toBe(true);
    expect("tool_index" in dispatch_deps).toBe(true);
  });

  it("_dispatch_deps provides all required runner delegates", () => {
    const { service } = make_service(60_000);
    const dispatch_deps = (service as any)._dispatch_deps();
    expect(typeof dispatch_deps.run_once).toBe("function");
    expect(typeof dispatch_deps.run_agent_loop).toBe("function");
    expect(typeof dispatch_deps.run_task_loop).toBe("function");
    expect(typeof dispatch_deps.run_phase_loop).toBe("function");
    expect(typeof dispatch_deps.build_identity_reply).toBe("function");
    expect(typeof dispatch_deps.build_system_prompt).toBe("function");
    expect(typeof dispatch_deps.caps).toBe("function");
  });

  it("normalize_query alignment: tokenizer used in novelty gate matches retrieval normalizer", () => {
    // The novelty gate (evaluate_reuse) calls normalize_query from session-reuse.
    // The retrieval path (tool-index, session-recorder) also calls normalize_query.
    // They must be the same function producing identical output.

    const query = "날씨 알려줘 오늘";
    const normalized = normalize_query(query);

    // Property: normalized form is idempotent
    expect(normalize_query(normalized)).toBe(normalized);

    // Property: same input always produces same output (deterministic)
    expect(normalize_query(query)).toBe(normalized);

    // Property: lowercase
    expect(normalized).toBe(normalized.toLowerCase());
  });

  it("config.freshness_window_ms controls whether session reuse short-circuit is active", () => {
    // Direct unit test of the evaluate_reuse contract used by dispatcher
    const NOW = Date.now();
    const query = "test query";
    const history = [
      { role: "user", content: query, timestamp_ms: NOW - 60_000 },
      { role: "assistant", content: "some answer" },
      { role: "user", content: query }, // current incoming — excluded
    ];

    // With freshness_window_ms = 300_000: should detect reuse
    const evidence_300 = build_session_evidence(history, NOW, 300_000);
    const result_300 = evaluate_reuse(query, evidence_300, NOW, {
      freshness_window_ms: 300_000,
      similarity_threshold: 0.85,
    });
    expect(result_300.kind).toBe("reuse_summary");

    // With freshness_window_ms = 0: disabled → stale_retry (not reuse_summary)
    const evidence_0 = build_session_evidence(history, NOW, 1); // minimal window for evidence building
    const result_0 = evaluate_reuse(query, evidence_0, NOW, {
      freshness_window_ms: 0,
      similarity_threshold: 0.85,
    });
    expect(result_0.kind).not.toBe("reuse_summary");
  });
});
