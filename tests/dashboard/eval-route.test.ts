/** EV-4/5/6: /api/eval/* 라우트 직접 호출 테스트. */
import { describe, it, expect } from "vitest";
import { handle_eval } from "@src/dashboard/routes/eval.js";
import type { RouteContext } from "@src/dashboard/route-context.js";
import type { IncomingMessage, ServerResponse } from "node:http";

function make_ctx(pathname: string, method = "GET", body?: Record<string, unknown>): RouteContext {
  const url = new URL(`http://localhost${pathname}`);
  let json_result: { status: number; data: unknown } | null = null;

  return {
    req: { method, url: pathname } as IncomingMessage,
    res: {} as ServerResponse,
    url,
    options: { auth_svc: null } as any,
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

describe("/api/eval/bundles", () => {
  it("GET → 번들 목록 반환", async () => {
    const ctx = make_ctx("/api/eval/bundles");
    const handled = await handle_eval(ctx);
    expect(handled).toBe(true);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data[0]).toHaveProperty("name");
  });

  it("smoke=true → smoke 번들만", async () => {
    const ctx = make_ctx("/api/eval/bundles?smoke=true");
    await handle_eval(ctx);
    const res = (ctx as any).json_response;
    expect(res.data.every((b: any) => b.smoke === true)).toBe(true);
  });
});

describe("/api/eval/bundles/:name", () => {
  it("존재하는 번들 → 200", async () => {
    const ctx = make_ctx("/api/eval/bundles/routing");
    await handle_eval(ctx);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(200);
    expect(res.data.name).toBe("routing");
  });

  it("없는 번들 → 404", async () => {
    const ctx = make_ctx("/api/eval/bundles/nonexistent");
    await handle_eval(ctx);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(404);
  });
});

describe("/api/eval/run", () => {
  it("POST + bundle → report + summaries 반환", async () => {
    const ctx = make_ctx("/api/eval/run", "POST", { bundle: "routing" });
    await handle_eval(ctx);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty("report");
    expect(res.data).toHaveProperty("summaries");
    expect(res.data.report).toHaveProperty("scorecards");
    expect(res.data.report.total).toBeGreaterThan(0);
  });

  it("없는 번들 → 404", async () => {
    const ctx = make_ctx("/api/eval/run", "POST", { bundle: "nonexistent" });
    await handle_eval(ctx);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(404);
  });

  it("body 없음 → 400", async () => {
    const ctx = make_ctx("/api/eval/run", "POST");
    await handle_eval(ctx);
    const res = (ctx as any).json_response;
    expect(res.status).toBe(400);
  });
});

describe("비관련 경로", () => {
  it("/api/other → false 반환", async () => {
    const ctx = make_ctx("/api/other");
    const handled = await handle_eval(ctx);
    expect(handled).toBe(false);
  });
});
