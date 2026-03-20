/**
 * QC-2 / QC-3: /api/prompt/run + /api/prompt/compare — quality metadata 추가 테스트.
 * compute_quality_meta 경로: eval_score → rubric_verdict, expected_mode → route_verdict.
 */
import { describe, it, expect } from "vitest";
import { handle_prompt } from "@src/dashboard/routes/prompt.js";
import type { RouteContext } from "@src/dashboard/route-context.js";
import type { IncomingMessage, ServerResponse } from "node:http";

function make_ctx(
  pathname: string,
  method = "POST",
  body?: Record<string, unknown>,
  prompt_ops?: object,
): RouteContext {
  const url = new URL(`http://localhost${pathname}`);
  let json_result: { status: number; data: unknown } | null = null;

  return {
    req: { method, url: pathname } as IncomingMessage,
    res: {} as ServerResponse,
    url,
    options: {
      auth_svc: null,
      prompt_ops: prompt_ops ?? {
        async run() {
          return {
            content: "hello",
            provider_id: "openai",
            finish_reason: "stop",
            model: "gpt-4",
            latency_ms: 200,
            usage: { total_tokens: 50 },
          };
        },
      },
    } as any,
    auth_user: { role: "superadmin", sub: "u1", tid: "t1" } as any,
    team_context: null,
    workspace_runtime: null,
    workspace_layers: [],
    personal_dir: "",
    json: (_res: ServerResponse, status: number, data: unknown) => { json_result = { status, data }; },
    read_body: async () => body ?? null,
    add_sse_client: () => {},
    build_state: async () => ({}),
    build_merged_tasks: async () => [],
    recent_messages: [],
    metrics: {} as any,
    chat_sessions: new Map(),
    session_store: null,
    session_store_key: () => "",
    register_media_token: () => null,
    oauth_callback_handler: undefined,
    oauth_callback_html: () => "",
    resolve_request_origin: () => "",
    bus: null as any,
    add_rich_stream_listener: () => () => {},
    get_scoped_memory_ops: () => null,
    correlation: { trace_id: "test" } as any,
    get json_response() { return json_result; },
  } as any;
}

describe("/api/prompt/run — quality metadata", () => {
  it("eval_score 없으면 rubric_verdict 미포함", async () => {
    const ctx = make_ctx("/api/prompt/run", "POST", { prompt: "hello" });
    const handled = await handle_prompt(ctx);
    expect(handled).toBe(true);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(200);
    expect((res.data as Record<string, unknown>).rubric_verdict).toBeUndefined();
  });

  it("eval_score=0.9 → rubric_verdict.overall=pass 포함", async () => {
    const ctx = make_ctx("/api/prompt/run", "POST", { prompt: "hello", eval_score: 0.9 });
    await handle_prompt(ctx);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(200);
    const data = res.data as Record<string, unknown>;
    expect(data.rubric_verdict).toBeDefined();
    const rv = data.rubric_verdict as { overall: string; dimensions: unknown[] };
    expect(rv.overall).toBe("pass");
    expect(Array.isArray(rv.dimensions)).toBe(true);
  });

  it("eval_score=0.6 → rubric_verdict.overall=warn", async () => {
    const ctx = make_ctx("/api/prompt/run", "POST", { prompt: "hello", eval_score: 0.6 });
    await handle_prompt(ctx);
    const data = ((ctx as any).json_response.data) as Record<string, unknown>;
    const rv = data.rubric_verdict as { overall: string };
    expect(rv.overall).toBe("warn");
  });

  it("eval_score=0.3 → rubric_verdict.overall=fail", async () => {
    const ctx = make_ctx("/api/prompt/run", "POST", { prompt: "hello", eval_score: 0.3 });
    await handle_prompt(ctx);
    const data = ((ctx as any).json_response.data) as Record<string, unknown>;
    const rv = data.rubric_verdict as { overall: string };
    expect(rv.overall).toBe("fail");
  });

  it("expected_mode 없으면 route_verdict 미포함", async () => {
    const ctx = make_ctx("/api/prompt/run", "POST", { prompt: "hello" });
    await handle_prompt(ctx);
    const data = ((ctx as any).json_response.data) as Record<string, unknown>;
    expect(data.route_verdict).toBeUndefined();
  });

  it("expected_mode='once' → route_verdict 포함, passed=true (DEFAULT_ROUTE_CRITERIA preferred)", async () => {
    const ctx = make_ctx("/api/prompt/run", "POST", { prompt: "hello", expected_mode: "once" });
    await handle_prompt(ctx);
    const data = ((ctx as any).json_response.data) as Record<string, unknown>;
    expect(data.route_verdict).toBeDefined();
    const rv = data.route_verdict as { passed: boolean };
    expect(rv.passed).toBe(true);
  });

  it("eval_score + expected_mode 둘 다 제공 → 두 필드 모두 포함", async () => {
    const ctx = make_ctx("/api/prompt/run", "POST", {
      prompt: "hello",
      eval_score: 0.85,
      expected_mode: "once",
    });
    await handle_prompt(ctx);
    const data = ((ctx as any).json_response.data) as Record<string, unknown>;
    expect(data.rubric_verdict).toBeDefined();
    expect(data.route_verdict).toBeDefined();
  });
});

describe("/api/prompt/compare — quality metadata", () => {
  it("eval_score=0.9 → 각 결과에 rubric_verdict 포함", async () => {
    const ctx = make_ctx("/api/prompt/compare", "POST", {
      prompt: "hello",
      targets: [{ provider_id: "openai", model: "gpt-4" }],
      eval_score: 0.9,
    });
    await handle_prompt(ctx);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(200);
    const results = res.data as Array<Record<string, unknown>>;
    expect(results[0].rubric_verdict).toBeDefined();
    expect((results[0].rubric_verdict as { overall: string }).overall).toBe("pass");
  });

  it("eval_score 없으면 compare 결과에 rubric_verdict 미포함", async () => {
    const ctx = make_ctx("/api/prompt/compare", "POST", {
      prompt: "hello",
      targets: [{ provider_id: "openai" }],
    });
    await handle_prompt(ctx);
    const results = ((ctx as any).json_response.data) as Array<Record<string, unknown>>;
    expect(results[0].rubric_verdict).toBeUndefined();
  });
});
