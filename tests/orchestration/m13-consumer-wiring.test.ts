/**
 * M-13: span_recorder → reconcile_summary → __reconcile_read_model 소비자 연결 통합 검증.
 *
 * GPT 감사 [T-2][CL-2] — production 코드를 직접 호출하여 소비 경로 검증.
 * - run_phase_loop에 span_recorder 주입 → reconcile 노드 실행 시 span 기록
 * - on_event로 reconcile_summary 이벤트 수신
 * - 완료 후 state.memory.__reconcile_read_model 존재 확인
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { register_all_nodes } from "@src/agent/nodes/index.js";
import { run_phase_loop } from "@src/agent/phase-loop-runner.js";
import type { PhaseLoopRunOptions, PhaseLoopEvent } from "@src/agent/phase-loop.types.js";
import { ExecutionSpanRecorder } from "@src/observability/index.js";
import { filter_reconcile_spans } from "@src/orchestration/reconcile-trace.js";

vi.mock("@src/agent/worktree.js", () => ({
  create_worktree: vi.fn(),
  create_isolated_directory: vi.fn(),
  merge_worktrees: vi.fn(),
  cleanup_worktrees: vi.fn(),
}));

beforeAll(() => {
  register_all_nodes();
});

function make_store() {
  const states = new Map<string, unknown>();
  return {
    upsert: vi.fn().mockImplementation(async (s: { workflow_id: string }) => { states.set(s.workflow_id, s); }),
    get: vi.fn().mockImplementation(async (id: string) => states.get(id) ?? null),
    list: vi.fn().mockResolvedValue([]),
    insert_message: vi.fn().mockResolvedValue(undefined),
  };
}

function make_subagents(content = "agent output") {
  return {
    spawn: vi.fn().mockResolvedValue({ subagent_id: "sa1" }),
    wait_for_completion: vi.fn().mockResolvedValue({ status: "completed", content }),
    stop: vi.fn(),
    list: vi.fn().mockReturnValue([]),
  };
}

const noop_logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown;

// ── M-13: run_phase_loop에 span_recorder 주입 → reconcile trace 기록 ──

describe("M-13: run_phase_loop + span_recorder integration", () => {
  it("reconcile 노드 실행 시 span_recorder에 span이 기록된다", async () => {
    const recorder = new ExecutionSpanRecorder();
    const events: PhaseLoopEvent[] = [];

    // reconcile 노드를 포함하는 워크플로우 — nodes[] 배열 방식
    const opts: PhaseLoopRunOptions = {
      workflow_id: "wf-m13-span",
      title: "M-13 Span Test",
      objective: "test reconcile span recording",
      channel: "test",
      chat_id: "C-test",
      workspace: "/tmp/m13-test",
      nodes: [
        {
          node_id: "agent-a", node_type: "llm", role_prompt: "analyst",
          depends_on: [], backend: "openrouter",
        },
        {
          node_id: "agent-b", node_type: "llm", role_prompt: "reviewer",
          depends_on: [], backend: "openrouter",
        },
        {
          node_id: "rec-1", node_type: "reconcile",
          depends_on: ["agent-a", "agent-b"],
          source_node_ids: ["agent-a", "agent-b"],
          policy: "majority_vote",
        },
      ] as unknown,
    };

    const subagents = make_subagents(JSON.stringify({ policy_applied: "majority_vote", succeeded: 2, failed: 0 }));
    const result = await run_phase_loop(opts, {
      subagents: subagents as unknown,
      store: make_store() as unknown,
      logger: noop_logger,
      span_recorder: recorder,
      on_event: (e) => events.push(e),
    });

    expect(result.status).toBe("completed");

    // span_recorder에 reconcile span이 기록되었는지 검증
    const reconcile_spans = filter_reconcile_spans(recorder);
    expect(reconcile_spans.length).toBeGreaterThanOrEqual(2); // start + finalized
    expect(reconcile_spans.map((s) => s.name)).toContain("reconcile_start");
    expect(reconcile_spans.map((s) => s.name)).toContain("reconcile_finalized");
  });

  it("span_recorder 미주입 시 reconcile trace 생략 — 정상 완료", async () => {
    const events: PhaseLoopEvent[] = [];

    const opts: PhaseLoopRunOptions = {
      workflow_id: "wf-m13-no-span",
      title: "No Span Test",
      objective: "test without span_recorder",
      channel: "test",
      chat_id: "C-test",
      workspace: "/tmp/m13-test",
      nodes: [
        {
          node_id: "agent-a", node_type: "llm", role_prompt: "analyst",
          depends_on: [], backend: "openrouter",
        },
        {
          node_id: "rec-1", node_type: "reconcile",
          depends_on: ["agent-a"],
          source_node_ids: ["agent-a"],
          policy: "first_wins",
        },
      ] as unknown,
    };

    const subagents = make_subagents(JSON.stringify({ policy_applied: "first_wins", succeeded: 1, failed: 0 }));
    const result = await run_phase_loop(opts, {
      subagents: subagents as unknown,
      store: make_store() as unknown,
      logger: noop_logger,
      on_event: (e) => events.push(e),
      // span_recorder 미주입
    });

    expect(result.status).toBe("completed");
  });
});

// ── M-13: reconcile_summary 이벤트가 on_event로 전달되는지 ──

describe("M-13: reconcile_summary event via on_event", () => {
  it("reconcile 노드 포함 워크플로우 완료 시 reconcile_summary 이벤트 발행", async () => {
    const events: PhaseLoopEvent[] = [];

    const opts: PhaseLoopRunOptions = {
      workflow_id: "wf-m13-event",
      title: "Event Test",
      objective: "test reconcile_summary event",
      channel: "test",
      chat_id: "C-test",
      workspace: "/tmp/m13-test",
      nodes: [
        {
          node_id: "agent-a", node_type: "llm", role_prompt: "worker",
          depends_on: [], backend: "openrouter",
        },
        {
          node_id: "rec-1", node_type: "reconcile",
          depends_on: ["agent-a"],
          source_node_ids: ["agent-a"],
          policy: "majority_vote",
        },
      ] as unknown,
    };

    const subagents = make_subagents(JSON.stringify({ policy_applied: "majority_vote", succeeded: 1, failed: 0 }));
    await run_phase_loop(opts, {
      subagents: subagents as unknown,
      store: make_store() as unknown,
      logger: noop_logger,
      on_event: (e) => events.push(e),
    });

    const summary_events = events.filter((e) => e.type === "reconcile_summary");
    expect(summary_events.length).toBeGreaterThanOrEqual(1);

    const evt = summary_events[0] as Extract<PhaseLoopEvent, { type: "reconcile_summary" }>;
    expect(evt.workflow_id).toBe("wf-m13-event");
    expect(evt.reconcile_summaries).toBeDefined();
  });
});

// ── M-13: __reconcile_read_model이 state.memory에 저장되는지 ──

describe("M-13: __reconcile_read_model in workflow result", () => {
  it("reconcile 노드 실행 후 result.memory에 __reconcile_read_model 존재", async () => {
    const opts: PhaseLoopRunOptions = {
      workflow_id: "wf-m13-rm",
      title: "ReadModel Test",
      objective: "test __reconcile_read_model",
      channel: "test",
      chat_id: "C-test",
      workspace: "/tmp/m13-test",
      nodes: [
        {
          node_id: "agent-a", node_type: "llm", role_prompt: "worker",
          depends_on: [], backend: "openrouter",
        },
        {
          node_id: "rec-1", node_type: "reconcile",
          depends_on: ["agent-a"],
          source_node_ids: ["agent-a"],
          policy: "first_wins",
        },
      ] as unknown,
    };

    const subagents = make_subagents(JSON.stringify({ policy_applied: "first_wins", succeeded: 1, failed: 0 }));
    const result = await run_phase_loop(opts, {
      subagents: subagents as unknown,
      store: make_store() as unknown,
      logger: noop_logger,
      on_event: vi.fn(),
    });

    expect(result.status).toBe("completed");
    const rm = result.memory.__reconcile_read_model as { reconcile_summaries: unknown[] } | undefined;
    expect(rm).toBeDefined();
    expect(rm!.reconcile_summaries.length).toBeGreaterThanOrEqual(1);
  });
});
