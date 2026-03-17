/**
 * GW-1: RequestPlan / ResultEnvelope 계약 테스트.
 *
 * 대상:
 * - to_request_plan(): GatewayDecision → RequestPlan 변환
 * - to_result_envelope(): OrchestrationResult → ResultEnvelope 변환
 * - build_reply_ref(): ReplyChannelRef 생성
 * - plan_cost_tier(): RequestPlan → CostTier 추출
 * - result_cost_tier(): ExecutionMode → CostTier 매핑
 */

import { describe, it, expect } from "vitest";
import {
  to_request_plan,
  to_result_envelope,
  build_reply_ref,
  plan_cost_tier,
  result_cost_tier,
  build_delivery_envelope,
  build_route_preview,
} from "@src/orchestration/gateway-contracts.js";
import type { GatewayDecision } from "@src/orchestration/gateway.js";
import type { OrchestrationResult } from "@src/orchestration/types.js";

describe("to_request_plan — GatewayDecision → RequestPlan", () => {
  it("identity → no_token/identity", () => {
    const decision: GatewayDecision = { action: "identity" };
    const plan = to_request_plan(decision);
    expect(plan).toEqual({ route: "no_token", kind: "identity" });
  });

  it("builtin → no_token/builtin with command+args", () => {
    const decision: GatewayDecision = { action: "builtin", command: "help", args: "list" };
    const plan = to_request_plan(decision);
    expect(plan).toEqual({ route: "no_token", kind: "builtin", command: "help", args: "list" });
  });

  it("builtin → args undefined when absent", () => {
    const decision: GatewayDecision = { action: "builtin", command: "status" };
    const plan = to_request_plan(decision);
    expect(plan.route).toBe("no_token");
    if (plan.kind === "builtin") {
      expect(plan.args).toBeUndefined();
    }
  });

  it("inquiry → no_token/inquiry with summary", () => {
    const decision: GatewayDecision = { action: "inquiry", summary: "2 active tasks" };
    const plan = to_request_plan(decision);
    expect(plan).toEqual({ route: "no_token", kind: "inquiry", summary: "2 active tasks" });
  });

  it("execute once → model_direct/once", () => {
    const decision: GatewayDecision = { action: "execute", mode: "once", executor: "chatgpt", tool_categories: ["web"] };
    const plan = to_request_plan(decision);
    expect(plan).toEqual({ route: "model_direct", kind: "once", executor: "chatgpt", tool_categories: ["web"] });
  });

  it("execute agent → agent_required/agent", () => {
    const decision: GatewayDecision = { action: "execute", mode: "agent", executor: "claude_code" };
    const plan = to_request_plan(decision);
    expect(plan).toEqual({ route: "agent_required", kind: "agent", executor: "claude_code", tool_categories: undefined });
  });

  it("execute task → agent_required/task", () => {
    const decision: GatewayDecision = { action: "execute", mode: "task", executor: "chatgpt" };
    const plan = to_request_plan(decision);
    expect(plan).toEqual({ route: "agent_required", kind: "task", executor: "chatgpt", tool_categories: undefined });
  });

  it("execute phase → agent_required/workflow", () => {
    const decision: GatewayDecision = {
      action: "execute", mode: "phase", executor: "chatgpt",
      workflow_id: "wf-1", node_categories: ["data"],
    };
    const plan = to_request_plan(decision);
    expect(plan).toEqual({
      route: "agent_required", kind: "workflow", executor: "chatgpt",
      workflow_id: "wf-1", node_categories: ["data"],
    });
  });
});

describe("plan_cost_tier — RequestPlan → CostTier", () => {
  it("no_token 계획 → no_token", () => {
    expect(plan_cost_tier({ route: "no_token", kind: "identity" })).toBe("no_token");
  });

  it("model_direct 계획 → model_direct", () => {
    expect(plan_cost_tier({ route: "model_direct", kind: "once", executor: "chatgpt" })).toBe("model_direct");
  });

  it("agent_required 계획 → agent_required", () => {
    expect(plan_cost_tier({ route: "agent_required", kind: "agent", executor: "chatgpt" })).toBe("agent_required");
  });
});

describe("result_cost_tier — ExecutionMode → CostTier", () => {
  it("once → model_direct", () => expect(result_cost_tier("once")).toBe("model_direct"));
  it("agent → agent_required", () => expect(result_cost_tier("agent")).toBe("agent_required"));
  it("task → agent_required", () => expect(result_cost_tier("task")).toBe("agent_required"));
  it("phase → agent_required", () => expect(result_cost_tier("phase")).toBe("agent_required"));

  it("execution_route=identity + once → no_token", () => expect(result_cost_tier("once", "identity")).toBe("no_token"));
  it("execution_route=builtin + once → no_token", () => expect(result_cost_tier("once", "builtin")).toBe("no_token"));
  it("execution_route=inquiry + once → no_token", () => expect(result_cost_tier("once", "inquiry")).toBe("no_token"));
  it("execution_route=direct_tool + once → no_token", () => expect(result_cost_tier("once", "direct_tool")).toBe("no_token"));
  it("execution_route=once + once → model_direct (LLM 사용)", () => expect(result_cost_tier("once", "once")).toBe("model_direct"));
  it("execution_route=agent + agent → agent_required", () => expect(result_cost_tier("agent", "agent")).toBe("agent_required"));
});

describe("build_reply_ref — ReplyChannelRef 생성", () => {
  it("thread_id 포함", () => {
    const ref = build_reply_ref("slack", "C123", "T456");
    expect(ref).toEqual({ provider: "slack", chat_id: "C123", thread_id: "T456" });
  });

  it("thread_id 없으면 필드 미포함", () => {
    const ref = build_reply_ref("web", "chat-1");
    expect(ref).toEqual({ provider: "web", chat_id: "chat-1" });
    expect("thread_id" in ref).toBe(false);
  });
});

describe("to_result_envelope — OrchestrationResult → ResultEnvelope", () => {
  const ref = build_reply_ref("slack", "C123");

  it("성공 결과 봉투 변환", () => {
    const result: OrchestrationResult = {
      reply: "Hello", mode: "once", tool_calls_count: 2, streamed: false,
      tools_used: ["web_search"], usage: { total_tokens: 100 },
    };
    const envelope = to_result_envelope(result, ref);
    expect(envelope).toEqual({
      reply_to: ref,
      content: "Hello",
      cost_tier: "model_direct",
      mode: "once",
      usage: { total_tokens: 100 },
      tools_used: ["web_search"],
      streamed: false,
      error: undefined,
      suppress_reply: undefined,
    });
  });

  it("에러 결과 봉투 변환", () => {
    const result: OrchestrationResult = {
      reply: null, mode: "agent", tool_calls_count: 0, streamed: false,
      error: "timeout",
    };
    const envelope = to_result_envelope(result, ref);
    expect(envelope.content).toBeNull();
    expect(envelope.error).toBe("timeout");
    expect(envelope.cost_tier).toBe("agent_required");
  });

  it("스트리밍 + suppress_reply", () => {
    const result: OrchestrationResult = {
      reply: "streamed", mode: "once", tool_calls_count: 0,
      streamed: true, suppress_reply: true,
    };
    const envelope = to_result_envelope(result, ref);
    expect(envelope.streamed).toBe(true);
    expect(envelope.suppress_reply).toBe(true);
  });
});

describe("GW-6: build_delivery_envelope — channel affinity regression", () => {
  it("slack once → reply_to에 slack provider + chat_id 보존", () => {
    const result: OrchestrationResult = { reply: "hello", mode: "once", tool_calls_count: 1, streamed: false };
    const env = build_delivery_envelope(result, "slack", "C123");
    expect(env.reply_to).toEqual({ provider: "slack", chat_id: "C123" });
    expect(env.content).toBe("hello");
    expect(env.cost_tier).toBe("model_direct");
  });

  it("telegram agent → reply_to에 telegram provider 보존 + cost_tier=agent_required", () => {
    const result: OrchestrationResult = { reply: "done", mode: "agent", tool_calls_count: 5, streamed: true };
    const env = build_delivery_envelope(result, "telegram", "T456");
    expect(env.reply_to).toEqual({ provider: "telegram", chat_id: "T456" });
    expect(env.cost_tier).toBe("agent_required");
    expect(env.streamed).toBe(true);
  });

  it("thread_id 보존 → channel affinity + thread routing", () => {
    const result: OrchestrationResult = { reply: "reply", mode: "once", tool_calls_count: 0, streamed: false };
    const env = build_delivery_envelope(result, "slack", "C123", "ts1234.5678");
    expect(env.reply_to).toEqual({ provider: "slack", chat_id: "C123", thread_id: "ts1234.5678" });
  });

  it("web 채널 → reply_to에 web provider 보존", () => {
    const result: OrchestrationResult = { reply: null, mode: "once", tool_calls_count: 0, streamed: false, suppress_reply: true };
    const env = build_delivery_envelope(result, "web", "W789");
    expect(env.reply_to.provider).toBe("web");
    expect(env.content).toBeNull();
    expect(env.suppress_reply).toBe(true);
  });

  it("phase 모드 → cost_tier=agent_required", () => {
    const result: OrchestrationResult = { reply: "workflow done", mode: "phase", tool_calls_count: 0, streamed: false };
    const env = build_delivery_envelope(result, "slack", "C999");
    expect(env.cost_tier).toBe("agent_required");
    expect(env.mode).toBe("phase");
  });

  it("error 전파 → envelope.error 보존", () => {
    const result: OrchestrationResult = { reply: null, mode: "agent", tool_calls_count: 0, streamed: false, error: "timeout" };
    const env = build_delivery_envelope(result, "slack", "C123");
    expect(env.error).toBe("timeout");
    expect(env.content).toBeNull();
  });

  it("direct_tool execution_route → cost_tier=no_token", () => {
    const result: OrchestrationResult = { reply: "tool output", mode: "once", tool_calls_count: 1, streamed: false, execution_route: "direct_tool" };
    const env = build_delivery_envelope(result, "web", "W1");
    expect(env.cost_tier).toBe("no_token");
  });

  it("usage + tools_used 전파", () => {
    const result: OrchestrationResult = {
      reply: "done", mode: "once", tool_calls_count: 2, streamed: false,
      usage: { prompt_tokens: 100, completion_tokens: 50 },
      tools_used: ["bash", "read_file"],
    };
    const env = build_delivery_envelope(result, "slack", "C123");
    expect(env.usage).toEqual({ prompt_tokens: 100, completion_tokens: 50 });
    expect(env.tools_used).toEqual(["bash", "read_file"]);
  });
});

describe("GW-5: build_route_preview — RequestPlan → RoutePreview", () => {
  it("no_token/identity + node_stats 미제공 → 기본값 0", () => {
    const preview = build_route_preview({ route: "no_token", kind: "identity" });
    expect(preview).toEqual({
      plan_kind: "identity",
      cost_tier: "no_token",
      direct_node_count: 0,
      agent_node_count: 0,
      total_node_count: 0,
    });
  });

  it("model_direct/once + node_stats → 통계 반영", () => {
    const preview = build_route_preview(
      { route: "model_direct", kind: "once", executor: "chatgpt" },
      { direct: 3, agent: 0, total: 3 },
    );
    expect(preview.plan_kind).toBe("once");
    expect(preview.cost_tier).toBe("model_direct");
    expect(preview.direct_node_count).toBe(3);
    expect(preview.agent_node_count).toBe(0);
    expect(preview.total_node_count).toBe(3);
  });

  it("agent_required/workflow + node_stats → 노드 통계 전달", () => {
    const preview = build_route_preview(
      { route: "agent_required", kind: "workflow", executor: "chatgpt", workflow_id: "wf-1" },
      { direct: 5, agent: 2, total: 7 },
    );
    expect(preview).toEqual({
      plan_kind: "workflow",
      cost_tier: "agent_required",
      direct_node_count: 5,
      agent_node_count: 2,
      total_node_count: 7,
    });
  });

  it("plan_kind가 RequestPlan.kind를 정확히 보존", () => {
    const kinds = [
      { route: "no_token" as const, kind: "builtin" as const, command: "help" },
      { route: "no_token" as const, kind: "inquiry" as const, summary: "s" },
      { route: "no_token" as const, kind: "direct_tool" as const, plan: { tool_name: "t" } },
      { route: "agent_required" as const, kind: "agent" as const, executor: "chatgpt" as const },
      { route: "agent_required" as const, kind: "task" as const, executor: "chatgpt" as const },
    ];
    for (const plan of kinds) {
      expect(build_route_preview(plan).plan_kind).toBe(plan.kind);
    }
  });
});
