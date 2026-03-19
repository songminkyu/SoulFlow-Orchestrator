/**
 * LF-4: ResultEnvelope / Dashboard Read Model 검증.
 */

import { describe, it, expect } from "vitest";
import {
  to_result_kind,
  resolve_channel_affinity,
  to_dashboard_model,
  type DashboardResultModel,
} from "@src/orchestration/result-envelope.js";
import type { ExecutionMode } from "@src/orchestration/types.js";

/* ── to_result_kind ── */

describe("to_result_kind", () => {
  it("error 있으면 error_reply", () => {
    expect(to_result_kind("once", undefined, "some error")).toBe("error_reply");
  });

  it("no_token 경로 — identity → direct_reply", () => {
    expect(to_result_kind("once", "identity")).toBe("direct_reply");
    expect(to_result_kind("once", "builtin")).toBe("direct_reply");
    expect(to_result_kind("once", "inquiry")).toBe("direct_reply");
    expect(to_result_kind("once", "direct_tool")).toBe("direct_reply");
  });

  it("once 모드 → model_reply", () => {
    expect(to_result_kind("once")).toBe("model_reply");
    expect(to_result_kind("once", "once")).toBe("model_reply");
  });

  it("agent 모드 → agent_reply", () => {
    expect(to_result_kind("agent")).toBe("agent_reply");
  });

  it("task 모드 → task_reply", () => {
    expect(to_result_kind("task")).toBe("task_reply");
  });

  it("phase 모드 → workflow_reply", () => {
    expect(to_result_kind("phase")).toBe("workflow_reply");
  });

  it("error 우선 — 에러 있으면 mode 무시", () => {
    expect(to_result_kind("phase", "workflow", "workflow failed")).toBe("error_reply");
  });
});

/* ── resolve_channel_affinity ── */

describe("resolve_channel_affinity", () => {
  it("동일 채널 → same_channel", () => {
    expect(resolve_channel_affinity("slack", "slack")).toBe("same_channel");
    expect(resolve_channel_affinity("web", "web")).toBe("same_channel");
  });

  it("다른 채널 → cross_channel", () => {
    expect(resolve_channel_affinity("slack", "web")).toBe("cross_channel");
    expect(resolve_channel_affinity("telegram", "discord")).toBe("cross_channel");
  });
});

/* ── to_dashboard_model ── */

function make_result(overrides: Partial<{
  reply: string | null;
  error: string;
  suppress_reply: boolean;
  mode: ExecutionMode;
  tool_calls_count: number;
  streamed: boolean;
  execution_route: string;
  usage: { total_tokens: number };
  run_id: string;
}> = {}) {
  return {
    reply: "Hello!",
    mode: "once" as ExecutionMode,
    tool_calls_count: 0,
    streamed: false,
    ...overrides,
  };
}

describe("to_dashboard_model", () => {
  it("기본 변환 — 필수 필드 채워짐", () => {
    const model: DashboardResultModel = to_dashboard_model(
      make_result(),
      "slack",
      "slack",
      "run-1",
    );
    expect(model.run_id).toBe("run-1");
    expect(model.kind).toBe("model_reply");
    expect(model.mode).toBe("once");
    expect(model.content).toBe("Hello!");
    expect(model.channel_affinity).toBe("same_channel");
    expect(model.request_channel).toBe("slack");
    expect(model.reply_channel).toBe("slack");
    expect(model.tool_calls_count).toBe(0);
    expect(model.streamed).toBe(false);
    expect(model.suppressed).toBe(false);
  });

  it("result.run_id가 있으면 인자 run_id 대신 사용", () => {
    const model = to_dashboard_model(
      make_result({ run_id: "from-result" }),
      "slack",
      "slack",
      "from-arg",
    );
    expect(model.run_id).toBe("from-result");
  });

  it("에러 결과 → kind=error_reply", () => {
    const model = to_dashboard_model(
      make_result({ error: "timeout" }),
      "slack",
      "slack",
      "run-err",
    );
    expect(model.kind).toBe("error_reply");
    expect(model.error).toBe("timeout");
  });

  it("suppress_reply=true → suppressed=true", () => {
    const model = to_dashboard_model(
      make_result({ suppress_reply: true }),
      "slack",
      "slack",
      "run-s",
    );
    expect(model.suppressed).toBe(true);
  });

  it("cross_channel 요청: affinity=cross_channel", () => {
    const model = to_dashboard_model(
      make_result(),
      "slack",
      "web",
      "run-cross",
    );
    expect(model.channel_affinity).toBe("cross_channel");
  });

  it("usage 있으면 total_tokens 포함", () => {
    const model = to_dashboard_model(
      make_result({ usage: { total_tokens: 1234 } }),
      "slack",
      "slack",
      "run-tok",
    );
    expect(model.total_tokens).toBe(1234);
  });

  it("usage 없으면 total_tokens undefined", () => {
    const model = to_dashboard_model(
      make_result(),
      "slack",
      "slack",
      "run-nok",
    );
    expect(model.total_tokens).toBeUndefined();
  });

  it("completed_at는 ISO 8601 형식", () => {
    const model = to_dashboard_model(make_result(), "slack", "slack", "run-dt");
    expect(() => new Date(model.completed_at)).not.toThrow();
    expect(new Date(model.completed_at).toISOString()).toBe(model.completed_at);
  });

  it("phase 모드 + workflow 경로 → workflow_reply", () => {
    const model = to_dashboard_model(
      make_result({ mode: "phase", execution_route: "workflow" }),
      "slack",
      "slack",
      "run-wf",
    );
    expect(model.kind).toBe("workflow_reply");
  });

  it("identity 경로 → direct_reply", () => {
    const model = to_dashboard_model(
      make_result({ execution_route: "identity" }),
      "slack",
      "slack",
      "run-id",
    );
    expect(model.kind).toBe("direct_reply");
  });
});
