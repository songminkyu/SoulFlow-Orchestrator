/**
 * QC-4 + QC-5: BE API 품질 감사 결과 첨부 테스트.
 *
 * 검증 대상:
 * - GET /api/workflow/runs/:id → compiler_verdict 첨부 (definition.nodes 있을 때)
 * - GET /api/workflow/runs/:id → compiler_verdict: null (nodes 없을 때)
 * - GET /api/memory/longterm → audit_result 첨부
 * - GET /api/memory/daily/:day → audit_result 첨부
 */

import { describe, it, expect, vi } from "vitest";
import { handle_workflow } from "@src/dashboard/routes/workflows.js";
import { handle_memory } from "@src/dashboard/routes/memory.js";
import type { RouteContext } from "@src/dashboard/route-context.js";

/* ── 공통 헬퍼 ── */

type PartialCtx = Partial<RouteContext> & { _responses: Array<{ status: number; body: unknown }> };

function make_wf_ctx(overrides: Record<string, unknown> = {}): PartialCtx {
  const responses: Array<{ status: number; body: unknown }> = [];
  return {
    req: { method: overrides.method ?? "GET", headers: {}, on: vi.fn() },
    res: { writeHead: vi.fn(), setHeader: vi.fn(), end: vi.fn() },
    url: new URL(String(overrides.pathname ?? "/"), "http://localhost"),
    options: {
      auth_svc: undefined,
      agent: {} as never,
      events: { list: vi.fn(async () => []) },
      workflow_ops: overrides.workflow_ops ?? null,
      tool_ops: null,
      bus: null,
    },
    auth_user: null,
    team_context: null,
    workspace_runtime: null,
    workspace_layers: [],
    personal_dir: "",
    json: vi.fn((_res: unknown, status: number, body: unknown) => {
      responses.push({ status, body });
    }),
    read_body: vi.fn(async () => null),
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

function make_mem_ctx(overrides: Record<string, unknown> = {}): PartialCtx {
  const responses: Array<{ status: number; body: unknown }> = [];
  const mem_ops = overrides.mem_ops ?? null;
  return {
    req: { method: "GET", headers: {}, on: vi.fn() },
    res: { writeHead: vi.fn(), setHeader: vi.fn(), end: vi.fn() },
    url: new URL(String(overrides.pathname ?? "/"), "http://localhost"),
    options: { agent: {} as never, events: { list: vi.fn(async () => []) }, bus: null },
    auth_user: null,
    team_context: null,
    workspace_runtime: null,
    workspace_layers: [],
    personal_dir: "",
    json: vi.fn((_res: unknown, status: number, body: unknown) => {
      responses.push({ status, body });
    }),
    read_body: vi.fn(async () => null),
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
    get_scoped_memory_ops: vi.fn(() => mem_ops),
    correlation: {} as never,
    create_team_store: vi.fn() as never,
    _responses: responses,
  } as unknown as PartialCtx;
}

const last = (ctx: PartialCtx) => ctx._responses[ctx._responses.length - 1];

/* ── QC-4: workflow runs/:id compiler_verdict ── */

describe("QC-4: GET /api/workflow/runs/:id — compiler_verdict 첨부", () => {
  const WORKFLOW_NO_NODES = {
    workflow_id: "wf-1",
    title: "Test",
    objective: "test",
    status: "running",
    phases: [],
    memory: {},
    current_phase: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    // definition이 없거나 nodes가 빈 배열
  };

  const WORKFLOW_WITH_NODES = {
    ...WORKFLOW_NO_NODES,
    workflow_id: "wf-2",
    definition: {
      title: "Test",
      objective: "test",
      nodes: [
        { node_id: "n1", title: "Phase 1", node_type: "phase", agents: [] },
        { node_id: "n2", title: "Phase 2", node_type: "phase", agents: [] },
        { node_id: "n3", title: "Phase 3", node_type: "phase", agents: [] },
        // phase 노드만 3개 → agent_heavy (ratio = 1.0 > 0.5)
      ],
    },
  };

  const WORKFLOW_WITH_DIRECT_NODES = {
    ...WORKFLOW_NO_NODES,
    workflow_id: "wf-3",
    definition: {
      title: "Test",
      objective: "test",
      nodes: [
        { node_id: "t1", title: "Trigger", node_type: "trigger", trigger_type: "manual" },
        { node_id: "h1", title: "HTTP", node_type: "http", url: "https://example.com", method: "GET" },
        { node_id: "p1", title: "Phase", node_type: "phase", agents: [] },
      ],
    },
  };

  it("definition.nodes 없음 → compiler_verdict: null", async () => {
    const wf_ops = {
      get: vi.fn(async () => WORKFLOW_NO_NODES),
      list: vi.fn(async () => []),
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
    const ctx = make_wf_ctx({
      pathname: "/api/workflow/runs/wf-1",
      workflow_ops: wf_ops,
    });
    await handle_workflow(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    expect((res?.body as Record<string, unknown>)?.compiler_verdict).toBeNull();
  });

  it("agent_heavy workflow → compiler_verdict.passed: false, violations 포함", async () => {
    const wf_ops = {
      get: vi.fn(async () => WORKFLOW_WITH_NODES),
      list: vi.fn(async () => []),
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
    const ctx = make_wf_ctx({
      pathname: "/api/workflow/runs/wf-2",
      workflow_ops: wf_ops,
    });
    await handle_workflow(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    const verdict = (res?.body as Record<string, unknown>)?.compiler_verdict as Record<string, unknown>;
    expect(verdict).not.toBeNull();
    expect(verdict.passed).toBe(false);
    const violations = verdict.violations as Array<{ code: string; severity: string }>;
    expect(violations.some((v) => v.code === "agent_heavy")).toBe(true);
    expect(verdict.agent_node_ratio).toBe(1.0);
  });

  it("양호한 workflow → compiler_verdict.passed: true, violations 없음", async () => {
    const wf_ops = {
      get: vi.fn(async () => WORKFLOW_WITH_DIRECT_NODES),
      list: vi.fn(async () => []),
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
    const ctx = make_wf_ctx({
      pathname: "/api/workflow/runs/wf-3",
      workflow_ops: wf_ops,
    });
    await handle_workflow(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    const verdict = (res?.body as Record<string, unknown>)?.compiler_verdict as Record<string, unknown>;
    expect(verdict).not.toBeNull();
    expect(verdict.passed).toBe(true);
    expect((verdict.violations as unknown[]).length).toBe(0);
  });

  it("workflow not found → 404 반환", async () => {
    const wf_ops = {
      get: vi.fn(async () => null),
      list: vi.fn(async () => []),
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
    const ctx = make_wf_ctx({
      pathname: "/api/workflow/runs/nonexistent",
      workflow_ops: wf_ops,
    });
    await handle_workflow(ctx as unknown as RouteContext);
    expect(last(ctx)?.status).toBe(404);
  });
});

/* ── QC-5: memory longterm + daily audit_result ── */

describe("QC-5: GET /api/memory — audit_result 첨부", () => {
  const CLEAN_CONTENT = "사용자는 코드 품질을 중시합니다. 테스트 커버리지 85% 이상을 목표로 합니다.";
  const NOISY_CONTENT = "$ npm test\n✓ test passes\nPASS all tests\nError: something failed at line 42";

  it("GET /api/memory/longterm — 정상 콘텐츠 → audit_result.passed: true", async () => {
    const mem_ops = {
      read_longterm: vi.fn(async () => CLEAN_CONTENT),
      write_longterm: vi.fn(async () => {}),
      list_daily: vi.fn(async () => []),
      read_daily: vi.fn(async () => ""),
      write_daily: vi.fn(async () => {}),
    };
    const ctx = make_mem_ctx({
      pathname: "/api/memory/longterm",
      mem_ops,
    });
    await handle_memory(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    const body = res?.body as Record<string, unknown>;
    expect(body.content).toBe(CLEAN_CONTENT);
    const audit = body.audit_result as Record<string, unknown>;
    expect(audit).not.toBeNull();
    expect(audit.passed).toBe(true);
    expect((audit.violations as unknown[]).length).toBe(0);
  });

  it("GET /api/memory/longterm — 노이즈 콘텐츠 → audit_result.violations에 noisy_content 포함", async () => {
    const mem_ops = {
      read_longterm: vi.fn(async () => NOISY_CONTENT),
      write_longterm: vi.fn(async () => {}),
      list_daily: vi.fn(async () => []),
      read_daily: vi.fn(async () => ""),
      write_daily: vi.fn(async () => {}),
    };
    const ctx = make_mem_ctx({
      pathname: "/api/memory/longterm",
      mem_ops,
    });
    await handle_memory(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    const body = res?.body as Record<string, unknown>;
    const audit = body.audit_result as Record<string, unknown>;
    expect(audit).not.toBeNull();
    const violations = audit.violations as Array<{ code: string }>;
    expect(violations.some((v) => v.code === "noisy_content")).toBe(true);
  });

  it("GET /api/memory/longterm — 빈 콘텐츠 → audit_result: null", async () => {
    const mem_ops = {
      read_longterm: vi.fn(async () => ""),
      write_longterm: vi.fn(async () => {}),
      list_daily: vi.fn(async () => []),
      read_daily: vi.fn(async () => ""),
      write_daily: vi.fn(async () => {}),
    };
    const ctx = make_mem_ctx({
      pathname: "/api/memory/longterm",
      mem_ops,
    });
    await handle_memory(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    const body = res?.body as Record<string, unknown>;
    expect(body.audit_result).toBeNull();
  });

  it("GET /api/memory/daily/:day — 정상 콘텐츠 → audit_result 포함 + day 반환", async () => {
    const mem_ops = {
      read_longterm: vi.fn(async () => ""),
      write_longterm: vi.fn(async () => {}),
      list_daily: vi.fn(async () => ["2026-03-20"]),
      read_daily: vi.fn(async () => CLEAN_CONTENT),
      write_daily: vi.fn(async () => {}),
    };
    const ctx = make_mem_ctx({
      pathname: "/api/memory/daily/2026-03-20",
      mem_ops,
    });
    await handle_memory(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    const body = res?.body as Record<string, unknown>;
    expect(body.day).toBe("2026-03-20");
    expect(body.content).toBe(CLEAN_CONTENT);
    const audit = body.audit_result as Record<string, unknown>;
    expect(audit).not.toBeNull();
    expect(audit.passed).toBe(true);
  });

  it("GET /api/memory/daily/:day — 노이즈 콘텐츠 → audit_result.violations 반환", async () => {
    const mem_ops = {
      read_longterm: vi.fn(async () => ""),
      write_longterm: vi.fn(async () => {}),
      list_daily: vi.fn(async () => ["2026-03-20"]),
      read_daily: vi.fn(async () => NOISY_CONTENT),
      write_daily: vi.fn(async () => {}),
    };
    const ctx = make_mem_ctx({
      pathname: "/api/memory/daily/2026-03-20",
      mem_ops,
    });
    await handle_memory(ctx as unknown as RouteContext);
    const res = last(ctx);
    expect(res?.status).toBe(200);
    const body = res?.body as Record<string, unknown>;
    const audit = body.audit_result as Record<string, unknown>;
    expect(audit).not.toBeNull();
    const violations = audit.violations as Array<{ code: string }>;
    expect(violations.some((v) => v.code === "noisy_content")).toBe(true);
  });

  it("mem_ops 없음 → 503 memory_unavailable", async () => {
    const ctx = make_mem_ctx({ pathname: "/api/memory/longterm" });
    await handle_memory(ctx as unknown as RouteContext);
    expect(last(ctx)?.status).toBe(503);
  });
});
