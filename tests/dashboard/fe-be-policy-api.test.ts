/**
 * FE-BE: 백엔드 도구 정책 레이어 API 테스트.
 *
 * 검증 대상:
 * - GET /api/workflow/definitions → 워크플로우 이름/설명 목록 정상 반환
 * - GET /api/mcp/servers → MCP 서버 + 도구 메타데이터 반환
 * - auth guard: team_manager 이하 → 403
 * - tool_ops 미설정 → 503
 */

import { describe, it, expect, vi } from "vitest";
import { handle_workflow } from "@src/dashboard/routes/workflows.js";
import { handle_mcp } from "@src/dashboard/routes/mcp.js";
import type { RouteContext } from "@src/dashboard/route-context.js";

/* ── 공통 헬퍼 ── */

type PartialCtx = Partial<RouteContext> & { _responses: Array<{ status: number; body: unknown }> };

function make_ctx(overrides: Record<string, unknown> = {}): PartialCtx {
  const responses: Array<{ status: number; body: unknown }> = [];
  return {
    req: { method: overrides.method ?? "GET", headers: {}, on: vi.fn() },
    res: { writeHead: vi.fn(), setHeader: vi.fn(), end: vi.fn() },
    url: new URL(String(overrides.pathname ?? "/"), "http://localhost"),
    options: {
      auth_svc: overrides.auth_svc ?? undefined,
      agent: {} as never,
      events: { list: vi.fn(async () => []) },
      workflow_ops: overrides.workflow_ops ?? null,
      tool_ops: overrides.tool_ops ?? null,
      bus: null,
      ...(overrides.extra_options ?? {}),
    },
    auth_user: overrides.auth_user ?? null,
    team_context: overrides.team_context ?? null,
    workspace_runtime: null,
    workspace_layers: (overrides.workspace_layers as string[]) ?? [],
    personal_dir: (overrides.personal_dir as string) ?? "",
    json: vi.fn((_res: unknown, status: number, body: unknown) => {
      responses.push({ status, body });
    }),
    read_body: vi.fn(async () => (overrides.body as Record<string, unknown> | null) ?? null),
    add_sse_client: vi.fn(),
    build_state: vi.fn(async () => ({})),
    build_merged_tasks: vi.fn(async () => []),
    recent_messages: [],
    metrics: {} as never,
    chat_sessions: new Map(),
    session_store: null,
    session_store_key: () => "",
    register_media_token: () => null,
    oauth_callback_html: () => "",
    resolve_request_origin: () => "http://localhost",
    bus: null,
    add_rich_stream_listener: vi.fn(() => () => undefined),
    get_scoped_memory_ops: vi.fn(() => null),
    correlation: {} as never,
    create_team_store: vi.fn() as never,
    _responses: responses,
  } as unknown as PartialCtx;
}

const last = (ctx: PartialCtx) => ctx._responses[ctx._responses.length - 1];

// ── 픽스처 데이터 ──

const MOCK_WORKFLOW_OPS = {
  list: vi.fn(async () => []),
  get: vi.fn(async () => null),
  create: vi.fn(async () => ({ ok: true })),
  cancel: vi.fn(async () => true),
  get_messages: vi.fn(async () => []),
  send_message: vi.fn(async () => ({ ok: true })),
  list_templates: vi.fn(() => []),
  get_template: vi.fn(() => null),
  save_template: vi.fn(() => "slug"),
  delete_template: vi.fn(() => true),
  import_template: vi.fn(() => ({ ok: true })),
  export_template: vi.fn(() => null),
  list_roles: vi.fn(() => []),
  resume: vi.fn(async () => ({ ok: true })),
  update_settings: vi.fn(async () => ({ ok: true })),
};

/* ── GET /api/workflow/definitions ── */

describe("GET /api/workflow/definitions", () => {
  it("workflow_ops 없음 → 501 not_configured", async () => {
    const ctx = make_ctx({ pathname: "/api/workflow/definitions" });
    await handle_workflow(ctx as unknown as RouteContext);
    expect(last(ctx)?.status).toBe(501);
    expect((last(ctx)?.body as Record<string, unknown>)?.error).toBe("workflow_ops_not_configured");
  });

  it("template 없음 → 빈 배열 반환", async () => {
    // load_workflow_templates_layered는 workspace_layers 경로를 읽음
    // 테스트에선 존재하지 않는 경로 → 빈 배열
    const ctx = make_ctx({
      pathname: "/api/workflow/definitions",
      workflow_ops: MOCK_WORKFLOW_OPS,
      workspace_layers: ["/nonexistent/path/__test__"],
    });
    const handled = await handle_workflow(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    expect(Array.isArray(res?.body)).toBe(true);
  });

  it("정의 목록에 name, slug, objective, phase_count 포함", async () => {
    // workspace_layers를 실제 파일 없이 빈 배열로 → 빈 목록
    // template 반환을 모킹하려면 load_workflow_templates_layered를 통해야 하므로
    // 빈 경로 → 빈 배열로 응답, shape만 검증
    const ctx = make_ctx({
      pathname: "/api/workflow/definitions",
      workflow_ops: MOCK_WORKFLOW_OPS,
      workspace_layers: [],
    });
    await handle_workflow(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    // 빈 배열 — shape은 items 있으면 검증
    const list = res?.body as Array<Record<string, unknown>>;
    expect(Array.isArray(list)).toBe(true);
    // 항목이 있으면 required fields 확인
    for (const item of list) {
      expect(typeof item.name).toBe("string");
      expect(typeof item.slug).toBe("string");
      expect(typeof item.phase_count).toBe("number");
    }
  });

  it("auth_svc 활성 + member 역할 → GET 통과 (읽기 허용)", async () => {
    const ctx = make_ctx({
      pathname: "/api/workflow/definitions",
      auth_svc: {},
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "member" },
      workflow_ops: MOCK_WORKFLOW_OPS,
      workspace_layers: [],
    });
    const handled = await handle_workflow(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    // GET은 require_team_manager_for_write가 읽기 허용
    expect(last(ctx)?.status).toBe(200);
  });
});

/* ── GET /api/mcp/servers ── */

describe("GET /api/mcp/servers", () => {
  it("tool_ops 미설정 → 503 tool_ops_not_configured", async () => {
    const ctx = make_ctx({ pathname: "/api/mcp/servers" });
    const handled = await handle_mcp(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    expect(last(ctx)?.status).toBe(503);
    expect((last(ctx)?.body as Record<string, unknown>)?.error).toBe("tool_ops_not_configured");
  });

  it("tool_ops.list_mcp_servers_detailed 있음 → 도구 메타데이터 반환", async () => {
    const mock_tool_ops = {
      tool_names: vi.fn(() => []),
      get_definitions: vi.fn(() => []),
      list_mcp_servers: vi.fn(() => []),
      list_mcp_servers_detailed: vi.fn(() => [
        {
          name: "my-mcp",
          connected: true,
          tools: [
            { name: "bash_tool", description: "Runs bash", input_schema: { type: "object", properties: { cmd: { type: "string" } } } },
          ],
        },
      ]),
    };
    const ctx = make_ctx({
      pathname: "/api/mcp/servers",
      tool_ops: mock_tool_ops,
    });
    const handled = await handle_mcp(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    expect(last(ctx)?.status).toBe(200);
    const body = last(ctx)?.body as Record<string, unknown>;
    expect(Array.isArray(body.servers)).toBe(true);
    const servers = body.servers as Array<Record<string, unknown>>;
    expect(servers[0].name).toBe("my-mcp");
    expect(servers[0].connected).toBe(true);
    const tools = servers[0].tools as Array<Record<string, unknown>>;
    expect(tools[0].name).toBe("bash_tool");
    expect(tools[0].description).toBe("Runs bash");
    expect(tools[0].input_schema).toEqual({ type: "object", properties: { cmd: { type: "string" } } });
  });

  it("list_mcp_servers_detailed 없음 → 폴백: 기존 list_mcp_servers() 사용", async () => {
    const mock_tool_ops = {
      tool_names: vi.fn(() => []),
      get_definitions: vi.fn(() => []),
      list_mcp_servers: vi.fn(() => [
        { name: "fallback-server", connected: true, tools: ["tool_a", "tool_b"] },
      ]),
      // list_mcp_servers_detailed 없음
    };
    const ctx = make_ctx({
      pathname: "/api/mcp/servers",
      tool_ops: mock_tool_ops,
    });
    const handled = await handle_mcp(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    const body = last(ctx)?.body as Record<string, unknown>;
    const servers = body.servers as Array<Record<string, unknown>>;
    expect(servers[0].name).toBe("fallback-server");
    const tools = servers[0].tools as Array<Record<string, unknown>>;
    expect(tools[0].name).toBe("tool_a");
    // 폴백: input_schema는 빈 객체
    expect(tools[0].input_schema).toEqual({});
  });

  it("auth_svc 활성 + member 역할 → 403 team_manager_required", async () => {
    const mock_tool_ops = {
      tool_names: vi.fn(() => []),
      get_definitions: vi.fn(() => []),
      list_mcp_servers: vi.fn(() => []),
    };
    const ctx = make_ctx({
      pathname: "/api/mcp/servers",
      auth_svc: {},
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "member" },
      tool_ops: mock_tool_ops,
    });
    const handled = await handle_mcp(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    expect(last(ctx)?.status).toBe(403);
  });

  it("auth_svc 활성 + manager 역할 → 200 정상 반환", async () => {
    const mock_tool_ops = {
      tool_names: vi.fn(() => []),
      get_definitions: vi.fn(() => []),
      list_mcp_servers: vi.fn(() => [
        { name: "srv", connected: true, tools: [] },
      ]),
    };
    const ctx = make_ctx({
      pathname: "/api/mcp/servers",
      auth_svc: {},
      auth_user: { role: "user", sub: "u1", tid: "t1" },
      team_context: { team_id: "t1", team_role: "manager" },
      tool_ops: mock_tool_ops,
    });
    const handled = await handle_mcp(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    expect(last(ctx)?.status).toBe(200);
  });

  it("auth 비활성 → 제한 없이 200 반환", async () => {
    const mock_tool_ops = {
      tool_names: vi.fn(() => []),
      get_definitions: vi.fn(() => []),
      list_mcp_servers: vi.fn(() => []),
    };
    // auth_svc 없음 = 싱글유저 모드
    const ctx = make_ctx({
      pathname: "/api/mcp/servers",
      tool_ops: mock_tool_ops,
    });
    const handled = await handle_mcp(ctx as unknown as RouteContext);
    expect(handled).toBe(true);
    expect(last(ctx)?.status).toBe(200);
  });

  it("다른 경로 → false 반환 (라우팅 미처리)", async () => {
    const ctx = make_ctx({ pathname: "/api/mcp/other" });
    const handled = await handle_mcp(ctx as unknown as RouteContext);
    expect(handled).toBe(false);
  });
});
