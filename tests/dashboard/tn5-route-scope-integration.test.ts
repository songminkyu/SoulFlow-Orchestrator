/**
 * TN-5 Route-Level + Bootstrap Closure Scope 통합 검증.
 *
 * 1. route handler 직접 호출 → scope_filter 전달 검증
 * 2. 실제 export된 bootstrap closure 직접 호출 + 실제 AgentProviderStore
 * 3. suggest/stream 경로 포함
 */

import { describe, it, expect, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { RouteContext } from "@src/dashboard/route-context.js";
import { handle_agent_provider } from "@src/dashboard/routes/agent-provider.js";
import { handle_prompt } from "@src/dashboard/routes/prompt.js";
import { handle_agent_definition } from "@src/dashboard/routes/agent-definition.js";
import { handle_bootstrap } from "@src/dashboard/routes/bootstrap.js";
import { handle_workflow } from "@src/dashboard/routes/workflows.js";
import { AgentProviderStore, type ProviderScopeFilter } from "@src/agent/provider-store.js";
import { create_scoped_provider_summaries } from "@src/bootstrap/workflow-ops.js";
import { find_scoped_chat_provider } from "@src/bootstrap/dashboard.js";

// ── 헬퍼 ──

function make_ctx(overrides: Record<string, unknown> = {}): RouteContext & { _responses: Array<{ status: number; body: unknown }> } {
  const responses: Array<{ status: number; body: unknown }> = [];
  return {
    req: { method: overrides.method ?? "GET", headers: {}, on: vi.fn() },
    res: { writeHead: vi.fn(), setHeader: vi.fn(), end: vi.fn(), destroyed: false, write: vi.fn(), flush: vi.fn() },
    url: new URL(String(overrides.pathname ?? "/"), "http://localhost"),
    options: {
      auth_svc: Object.prototype.hasOwnProperty.call(overrides, "auth_svc") ? overrides.auth_svc : {},
      agent_provider_ops: overrides.agent_provider_ops ?? null,
      prompt_ops: overrides.prompt_ops ?? null,
      bootstrap_ops: overrides.bootstrap_ops ?? null,
      workflow_ops: overrides.workflow_ops ?? null,
    },
    auth_user: overrides.auth_user ?? null,
    team_context: overrides.team_context ?? null,
    workspace_runtime: null,
    workspace_layers: [],
    personal_dir: "",
    json: vi.fn((_res: unknown, status: number, body: unknown) => { responses.push({ status, body }); }),
    read_body: vi.fn(async () => overrides.body ?? null),
    add_sse_client: vi.fn(),
    build_state: vi.fn(),
    build_merged_tasks: vi.fn(),
    recent_messages: [],
    metrics: {} as never,
    chat_sessions: new Map(),
    session_store: null,
    session_store_key: () => "",
    register_media_token: () => null,
    oauth_callback_html: () => "",
    resolve_request_origin: () => "http://localhost",
    bus: null,
    add_rich_stream_listener: () => () => {},
    get_scoped_memory_ops: () => null,
    correlation: { trace_id: "test", team_id: undefined, user_id: undefined },
    _responses: responses,
  } as unknown as RouteContext & { _responses: Array<{ status: number; body: unknown }> };
}

function last(ctx: { _responses: Array<{ status: number; body: unknown }> }) {
  return ctx._responses[ctx._responses.length - 1];
}

const ALICE_SCOPE: ProviderScopeFilter = [
  { scope_type: "global", scope_id: "" },
  { scope_type: "team", scope_id: "team-a" },
  { scope_type: "personal", scope_id: "alice" },
];

function make_provider_store(): AgentProviderStore {
  const db_path = join(tmpdir(), `tn5-${randomUUID()}.db`);
  const vault = { get: async () => null, set: async () => {}, delete: async () => {}, list: () => [] };
  return new AgentProviderStore(db_path, vault as never);
}

function seed_providers(store: AgentProviderStore): void {
  store.upsert({ priority: 1, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "g1", provider_type: "openai", label: "Global", scope_type: "global", scope_id: "" });
  store.upsert({ priority: 2, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "ta", provider_type: "anthropic", label: "Team A", scope_type: "team", scope_id: "team-a" });
  store.upsert({ priority: 3, model_purpose: "chat", supported_modes: ["once"], settings: {}, enabled: true, instance_id: "pb", provider_type: "ollama", label: "Bob Personal", scope_type: "personal", scope_id: "bob" });
}

// ══════════════════════════════════════════
// Part 1: Route Handler → scope_filter 전달 (mock ops)
// ══════════════════════════════════════════

describe("TN-5 route: /api/prompt/run — scope_filter 전달", () => {
  it("일반 유저 → scope_filter 포함", async () => {
    const run_spy = vi.fn().mockResolvedValue({ content: "ok" });
    const ctx = make_ctx({ method: "POST", pathname: "/api/prompt/run", auth_user: { role: "user", sub: "alice", tid: "team-a" }, team_context: { team_id: "team-a", team_role: "manager" }, prompt_ops: { run: run_spy }, body: { prompt: "test" } });
    await handle_prompt(ctx);
    expect(run_spy.mock.calls[0][0].scope_filter).toEqual(ALICE_SCOPE);
  });
  it("superadmin → scope_filter undefined", async () => {
    const run_spy = vi.fn().mockResolvedValue({ content: "ok" });
    const ctx = make_ctx({ method: "POST", pathname: "/api/prompt/run", auth_user: { role: "superadmin", sub: "admin1", tid: "t1" }, prompt_ops: { run: run_spy }, body: { prompt: "test" } });
    await handle_prompt(ctx);
    expect(run_spy.mock.calls[0][0].scope_filter).toBeUndefined();
  });
});

describe("TN-5 route: /api/agent-definitions/generate — scope 전달", () => {
  it("일반 유저 → scope 포함", async () => {
    const gen_spy = vi.fn().mockResolvedValue({ ok: true, data: {} });
    const ctx = make_ctx({ method: "POST", pathname: "/api/agent-definitions/generate", auth_user: { role: "user", sub: "alice", tid: "team-a" }, team_context: { team_id: "team-a", team_role: "manager" }, body: { prompt: "create agent" } });
    (ctx.options as Record<string, unknown>).agent_definition_ops = { generate: gen_spy };
    await handle_agent_definition(ctx);
    expect(gen_spy.mock.calls[0][1]).toEqual(ALICE_SCOPE);
  });
});

describe("TN-5 route: /api/agents/providers — scope-filtered list", () => {
  it("일반 유저 → build_scope_filter 적용", async () => {
    const list_spy = vi.fn().mockResolvedValue([]);
    const ctx = make_ctx({ method: "GET", pathname: "/api/agents/providers", auth_user: { role: "user", sub: "alice", tid: "team-a" }, team_context: { team_id: "team-a", team_role: "member" }, agent_provider_ops: { list: list_spy } });
    await handle_agent_provider(ctx);
    expect(list_spy.mock.calls[0][0]).toEqual(ALICE_SCOPE);
  });
});

describe("TN-5 route: /api/workflow/suggest — scope_filter 전달", () => {
  it("일반 유저 → suggest options에 scope_filter", async () => {
    const sug_spy = vi.fn().mockResolvedValue({ ok: true, workflow: {} });
    const ctx = make_ctx({ method: "POST", pathname: "/api/workflow/suggest", auth_user: { role: "user", sub: "alice", tid: "team-a" }, team_context: { team_id: "team-a", team_role: "manager" }, workflow_ops: { suggest: sug_spy }, body: { instruction: "add trigger", workflow: { phases: [] } } });
    await handle_workflow(ctx);
    expect(sug_spy.mock.calls[0][1].scope_filter).toEqual(ALICE_SCOPE);
  });
  it("superadmin → scope_filter undefined", async () => {
    const sug_spy = vi.fn().mockResolvedValue({ ok: true, workflow: {} });
    const ctx = make_ctx({ method: "POST", pathname: "/api/workflow/suggest", auth_user: { role: "superadmin", sub: "admin1", tid: "t1" }, workflow_ops: { suggest: sug_spy }, body: { instruction: "modify", workflow: { phases: [] } } });
    await handle_workflow(ctx);
    expect(sug_spy.mock.calls[0][1].scope_filter).toBeUndefined();
  });
});

describe("TN-5 route: /api/workflow/suggest/stream — scope_filter 전달", () => {
  it("일반 유저 → suggest options에 scope_filter (stream)", async () => {
    const sug_spy = vi.fn().mockResolvedValue({ ok: true, workflow: {} });
    const ctx = make_ctx({ method: "POST", pathname: "/api/workflow/suggest/stream", auth_user: { role: "user", sub: "alice", tid: "team-a" }, team_context: { team_id: "team-a", team_role: "manager" }, workflow_ops: { suggest: sug_spy }, body: { instruction: "add node", workflow: { phases: [] } } });
    await handle_workflow(ctx);
    expect(sug_spy.mock.calls[0][1].scope_filter).toEqual(ALICE_SCOPE);
  });
});

describe("TN-5 route: POST /api/bootstrap — superadmin 가드", () => {
  it("일반 유저 → 403", async () => {
    const apply_spy = vi.fn().mockResolvedValue({ ok: true });
    const ctx = make_ctx({ method: "POST", pathname: "/api/bootstrap", auth_user: { role: "user", sub: "u1", tid: "t1" }, team_context: { team_id: "t1", team_role: "member" }, bootstrap_ops: { apply: apply_spy }, body: { providers: [] } });
    await handle_bootstrap(ctx);
    expect(last(ctx).status).toBe(403);
    expect(apply_spy).not.toHaveBeenCalled();
  });
  it("superadmin → 200", async () => {
    const apply_spy = vi.fn().mockResolvedValue({ ok: true });
    const ctx = make_ctx({ method: "POST", pathname: "/api/bootstrap", auth_user: { role: "superadmin", sub: "admin1" }, bootstrap_ops: { apply: apply_spy }, body: { providers: [] } });
    await handle_bootstrap(ctx);
    expect(last(ctx).status).toBe(200);
  });
  it("auth 비활성 → 허용", async () => {
    const apply_spy = vi.fn().mockResolvedValue({ ok: true });
    const ctx = make_ctx({ method: "POST", pathname: "/api/bootstrap", auth_svc: null, bootstrap_ops: { apply: apply_spy }, body: { providers: [] } });
    await handle_bootstrap(ctx);
    expect(apply_spy).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════
// Part 2: 실제 export된 closure 직접 호출 (실제 AgentProviderStore)
// ══════════════════════════════════════════

describe("TN-5 closure: create_scoped_provider_summaries (workflow-ops.ts:84)", () => {
  it("alice scope → global + team-a만, bob personal 제외", () => {
    const store = make_provider_store();
    seed_providers(store);
    const fn = create_scoped_provider_summaries(store);
    const result = fn(ALICE_SCOPE);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.backend)).toContain("g1");
    expect(result.map((p) => p.backend)).toContain("ta");
    expect(result.map((p) => p.backend)).not.toContain("pb");
  });

  it("undefined scope (superadmin) → 전체", () => {
    const store = make_provider_store();
    seed_providers(store);
    const fn = create_scoped_provider_summaries(store);
    expect(fn()).toHaveLength(3);
  });
});

describe("TN-5 closure: find_scoped_chat_provider (dashboard.ts:191,207)", () => {
  it("alice scope → bob personal 선택 불가", () => {
    const store = make_provider_store();
    seed_providers(store);
    const provider = find_scoped_chat_provider(store, ALICE_SCOPE);
    expect(provider).not.toBeNull();
    expect(provider!.instance_id).not.toBe("pb");
  });

  it("bob scope → team-a provider 선택 불가", () => {
    const store = make_provider_store();
    seed_providers(store);
    const bob_scope: ProviderScopeFilter = [
      { scope_type: "global", scope_id: "" },
      { scope_type: "team", scope_id: "team-b" },
      { scope_type: "personal", scope_id: "bob" },
    ];
    const provider = find_scoped_chat_provider(store, bob_scope);
    expect(provider).not.toBeNull();
    expect(["g1", "pb"]).toContain(provider!.instance_id);
    expect(provider!.instance_id).not.toBe("ta");
  });

  it("undefined scope → 전체에서 선택 (superadmin)", () => {
    const store = make_provider_store();
    seed_providers(store);
    const provider = find_scoped_chat_provider(store);
    expect(provider).not.toBeNull();
  });
});
