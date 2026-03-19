/**
 * SO-6: execution path parity tests.
 */
import { describe, it, expect, vi } from "vitest";
import { make_content_result, make_error_result, make_parsed_result, run_schema_repair } from "@src/orchestration/output-contracts.js";
import { error_result, reply_result, suppress_result } from "@src/orchestration/execution/helpers.js";
import { to_result_envelope, build_reply_ref } from "@src/orchestration/gateway-contracts.js";
import type { OrchestrationResult } from "@src/orchestration/types.js";
import { StreamBuffer } from "@src/channels/stream-buffer.js";

function make_stream(): StreamBuffer { return new StreamBuffer(); }

function assert_orch(r: OrchestrationResult, mode: string) {
  expect(r.mode).toBe(mode);
  expect(typeof r.tool_calls_count).toBe("number");
  expect(typeof r.streamed).toBe("boolean");
  expect(r.reply === null || typeof r.reply === "string").toBe(true);
}

describe("SO-6: ContentResult contract", () => {
  it("make_content_result - content, no error", () => {
    const r = make_content_result("hello");
    expect(r.content).toBe("hello");
    expect(r.error).toBeUndefined();
  });
  it("make_content_result - null content", () => {
    expect(make_content_result(null).content).toBeNull();
  });
  it("make_content_result - with error", () => {
    const r = make_content_result("p", "broke");
    expect(r.content).toBe("p"); expect(r.error).toBe("broke");
  });
  it("make_error_result - null content", () => {
    const r = make_error_result("fail");
    expect(r.content).toBeNull(); expect(r.error).toBe("fail");
  });
  it("make_parsed_result - content and parsed", () => {
    const r = make_parsed_result("raw", { key: 1 });
    expect(r.content).toBe("raw"); expect(r.parsed).toEqual({ key: 1 });
  });
  it("make_parsed_result - null/undefined", () => {
    const r = make_parsed_result(null, undefined);
    expect(r.content).toBeNull(); expect(r.parsed).toBeUndefined();
  });
});

describe("SO-6: direct executor path (once)", () => {
  it("error_result once - OrchestrationResult contract", () => {
    const r = error_result("once", null, "tool_not_found");
    assert_orch(r, "once");
    expect(r.reply).toBeNull(); expect(r.error).toBe("tool_not_found");
  });
  it("reply_result once - OrchestrationResult contract", () => {
    const r = reply_result("once", make_stream(), "result", 0);
    assert_orch(r, "once"); expect(r.reply).toBe("result");
  });
  it("suppress_result once - suppress_reply true", () => {
    const r = suppress_result("once", make_stream(), 1);
    assert_orch(r, "once");
    expect(r.suppress_reply).toBe(true); expect(r.reply).toBeNull();
  });
});

describe("SO-6: phase-workflow path", () => {
  it("error_result phase - OrchestrationResult contract", () => {
    const r = error_result("phase", null, "no_matching_workflow_template");
    assert_orch(r, "phase"); expect(r.error).toContain("no_matching_workflow_template");
  });
  it("reply_result phase - OrchestrationResult contract", () => {
    const r = reply_result("phase", make_stream(), "workflow complete", 0);
    assert_orch(r, "phase"); expect(r.reply).toContain("workflow complete");
  });
});

describe("SO-6: agent-loop path", () => {
  it("error_result agent - OrchestrationResult contract", () => {
    assert_orch(error_result("agent", null, "agent_failed"), "agent");
  });
  it("reply_result agent - tool_calls_count", () => {
    const r = reply_result("agent", make_stream(), "done", 3);
    assert_orch(r, "agent"); expect(r.tool_calls_count).toBe(3);
  });
  it("task mode - same contract", () => {
    const r = reply_result("task", make_stream(), "done", 5);
    assert_orch(r, "task"); expect(r.tool_calls_count).toBe(5);
  });
});

describe("SO-6: cross-path schema parity", () => {
  const MODES = ["once", "agent", "phase", "task"] as const;
  it("all modes error_result have same field set", () => {
    const results = MODES.map((m) => error_result(m, null, "err"));
    const first = Object.keys(results[0]).sort();
    for (const r of results.slice(1)) expect(Object.keys(r).sort()).toEqual(first);
  });
  it("all modes reply_result have same field set", () => {
    const results = MODES.map((m) => reply_result(m, make_stream(), "r", 0));
    const first = Object.keys(results[0]).sort();
    for (const r of results.slice(1)) expect(Object.keys(r).sort()).toEqual(first);
  });
  it("tool_calls_count always number", () => {
    for (const m of MODES) expect(typeof reply_result(m, make_stream(), "r", 7).tool_calls_count).toBe("number");
  });
});

describe("SO-6: schema repair - ContentResult contract", () => {
  const SCHEMA = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"] };
  it("valid JSON - no repair", async () => {
    const retry = vi.fn();
    const initial = JSON.stringify({ reply: "done" });
    const repaired = await run_schema_repair(retry, SCHEMA, initial);
    const r = make_content_result(repaired.content);
    expect(r.content).toBe(initial); expect(r.error).toBeUndefined();
    expect(retry).not.toHaveBeenCalled();
  });
  it("invalid JSON - repair succeeds", async () => {
    const good = JSON.stringify({ reply: "fixed" });
    const retry = vi.fn().mockResolvedValueOnce(good);
    const repaired = await run_schema_repair(retry, SCHEMA, JSON.stringify({ wrong: true }));
    const r = repaired.errors.length === 0 ? make_content_result(repaired.content) : make_error_result("schema_error");
    expect(r.content === null || typeof r.content === "string").toBe(true);
    expect(retry).toHaveBeenCalledOnce();
  });
  it("repair failure - error wrapping", async () => {
    const retry = vi.fn().mockResolvedValueOnce("bad").mockResolvedValueOnce("bad2");
    const repaired = await run_schema_repair(retry, SCHEMA, "bad input");
    const r = repaired.errors.length > 0 ? make_error_result("schema_repair_failed") : make_content_result(repaired.content);
    expect(r.content).toBeNull(); expect(r.error).toBe("schema_repair_failed");
  });
});

describe("SO-6: ResultEnvelope delivery contract parity", () => {
  const ref = build_reply_ref("slack", "chat-1");
  it("once - model_direct cost_tier", () => {
    const env = to_result_envelope(reply_result("once", make_stream(), "resp", 0), ref);
    expect(env.mode).toBe("once"); expect(env.cost_tier).toBe("model_direct");
    expect(env.content).toBe("resp"); expect(env.reply_to).toEqual(ref);
  });
  it("agent - agent_required cost_tier", () => {
    const env = to_result_envelope(reply_result("agent", make_stream(), "r", 0), ref);
    expect(env.mode).toBe("agent"); expect(env.cost_tier).toBe("agent_required");
  });
  it("phase - agent_required cost_tier", () => {
    const env = to_result_envelope(reply_result("phase", make_stream(), "r", 0), ref);
    expect(env.mode).toBe("phase"); expect(env.cost_tier).toBe("agent_required");
  });
  it("error result - error field in envelope", () => {
    const env = to_result_envelope(error_result("once", null, "executor_failed"), ref);
    expect(env.content).toBeNull();
    expect(env.error).toBe("executor_failed");
  });
  it("suppress_reply - envelope.suppress_reply true", () => {
    const env = to_result_envelope(suppress_result("once", make_stream(), 0), ref);
    expect(env.suppress_reply).toBe(true); expect(env.content).toBeNull();
  });
  it("all modes - same ResultEnvelope fields", () => {
    const orches = ["once", "agent", "phase", "task"].map((m) => reply_result(m as "once", make_stream(), "r", 0));
    const envs = orches.map((o) => to_result_envelope(o, ref));
    const first = Object.keys(envs[0]).sort();
    for (const e of envs.slice(1)) expect(Object.keys(e).sort()).toEqual(first);
  });
});