/**
 * PA-7 Bootstrap Smoke — composition root가 생성하는 서비스 인스턴스가
 * 포트 인터페이스 계약을 만족하고, 조립(wiring) 후 올바르게 동작하는지 검증.
 *
 * 전체 createRuntime()은 Redis/CLI 등 외부 의존성이 무거우므로,
 * 각 번들의 핵심 조립 패턴을 최소 의존성으로 재현.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── ProviderRegistry mock (conformance 테스트와 동일) ──
vi.mock("@src/providers/cli.provider.js", () => ({
  CliHeadlessProvider: class {
    id: string;
    default_model: string;
    supports_tool_loop = false;
    constructor(opts: { id: string; default_model: string }) {
      this.id = opts.id;
      this.default_model = opts.default_model;
    }
    chat = vi.fn();
  },
}));

vi.mock("@src/providers/openrouter.provider.js", () => ({
  OpenRouterProvider: class {
    id = "openrouter";
    default_model = "gpt-4o";
    supports_tool_loop = true;
    chat = vi.fn();
  },
}));

vi.mock("@src/providers/orchestrator-llm.provider.js", () => ({
  OrchestratorLlmProvider: class {
    id = "orchestrator_llm";
    default_model = "gpt-4o";
    supports_tool_loop = false;
    chat = vi.fn();
  },
}));

import { ProviderRegistry } from "@src/providers/service.js";
import type { ProviderRegistryLike } from "@src/providers/service.js";
import { WorkflowEventService } from "@src/events/service.js";
import type { WorkflowEventServiceLike } from "@src/events/service.js";
import { MutableBroadcaster, NULL_BROADCASTER } from "@src/dashboard/broadcaster.js";
import type { SseBroadcasterLike } from "@src/dashboard/broadcaster.js";
import { SseManager } from "@src/dashboard/sse-manager.js";

// ── 헬퍼 ──

function make_vault() {
  return { mask_known_secrets: vi.fn().mockResolvedValue("masked") } as any;
}

// ══════════════════════════════════════════════════════════════════
// 1. ProviderRegistry — bootstrap/providers.ts 조립 패턴 재현
// ══════════════════════════════════════════════════════════════════

describe("Bootstrap Smoke — ProviderRegistry 조립", () => {
  it("최소 설정으로 생성 후 포트 인터페이스로 사용 가능", () => {
    // bootstrap/providers.ts: new ProviderRegistry({ secret_vault, ... })
    const registry = new ProviderRegistry({ secret_vault: make_vault() });

    // 소비자는 ProviderRegistryLike 포트로 수신
    const port: ProviderRegistryLike = registry;

    // 포트를 통한 기본 조회가 동작
    expect(port.list_providers()).toBeInstanceOf(Array);
    expect(typeof port.get_active_provider_id()).toBe("string");
    expect(typeof port.get_orchestrator_provider_id()).toBe("string");
    expect(typeof port.is_provider_available("chatgpt")).toBe("boolean");
    expect(typeof port.supports_tool_loop()).toBe("boolean");
  });

  it("set/get 메서드 왕복 일관성", () => {
    const registry = new ProviderRegistry({ secret_vault: make_vault() });
    const port: ProviderRegistryLike = registry;

    port.set_active_provider("openrouter");
    expect(port.get_active_provider_id()).toBe("openrouter");

    port.set_orchestrator_provider("orchestrator_llm");
    expect(port.get_orchestrator_provider_id()).toBe("orchestrator_llm");
  });

  it("get_health_scorer / get_secret_vault 반환값이 존재", () => {
    const vault = make_vault();
    const registry = new ProviderRegistry({ secret_vault: vault });
    const port: ProviderRegistryLike = registry;

    expect(port.get_health_scorer()).toBeTruthy();
    expect(port.get_secret_vault()).toBe(vault);
  });
});

// ══════════════════════════════════════════════════════════════════
// 2. WorkflowEventService — bootstrap/runtime-data.ts 조립 패턴 재현
// ══════════════════════════════════════════════════════════════════

describe("Bootstrap Smoke — WorkflowEventService 조립", () => {
  let workspace: string;

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => {});
  });

  it("runtime-data.ts와 동일한 생성 인자로 조립 후 포트 CRUD 동작", async () => {
    workspace = await mkdtemp(join(tmpdir(), "pa7-bs-evt-"));
    const events_dir = join(workspace, "custom-events");
    const task_loop_max_turns = 20;

    // bootstrap/runtime-data.ts:L80 재현:
    // new WorkflowEventService(ctx.user_content, events_dir, null, app_config.taskLoopMaxTurns)
    const svc = new WorkflowEventService(workspace, events_dir, null, task_loop_max_turns);

    // 소비자는 WorkflowEventServiceLike 포트로 수신
    const port: WorkflowEventServiceLike = svc;

    // events_dir override가 반영되었는지 확인
    expect(svc.events_dir).toBe(events_dir);

    // append → list → read_task_detail: 포트 4개 메서드 중 3개 직접 검증
    const { deduped, event } = await port.append({
      phase: "assign",
      summary: "bootstrap smoke test",
      task_id: "smoke-t1",
      run_id: "smoke-r1",
      chat_id: "smoke-c1",
      detail: "step 1: composition root wiring",
    });
    expect(deduped).toBe(false);
    expect(event.phase).toBe("assign");

    const events = await port.list({ task_id: "smoke-t1" });
    expect(events).toHaveLength(1);

    // read_task_detail: detail 필드로 저장된 내용이 조회됨
    const detail = await port.read_task_detail("smoke-t1");
    expect(detail).toContain("step 1: composition root wiring");
  });

  it("bind_task_store: 포트를 통한 TaskStore 바인딩", async () => {
    workspace = await mkdtemp(join(tmpdir(), "pa7-bs-evt2-"));
    const svc = new WorkflowEventService(workspace);
    const port: WorkflowEventServiceLike = svc;

    // null 바인딩 → 오류 없음
    expect(() => port.bind_task_store(null)).not.toThrow();

    // fake TaskStore 바인딩
    const fake_store = {
      list: vi.fn().mockReturnValue([]),
      get: vi.fn().mockReturnValue(undefined),
      upsert: vi.fn(),
      delete_task: vi.fn(),
    };
    expect(() => port.bind_task_store(fake_store as any)).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// 3. MutableBroadcaster — main.ts 조립 패턴 재현
// ══════════════════════════════════════════════════════════════════

describe("Bootstrap Smoke — MutableBroadcaster 조립", () => {
  it("생성 직후 → NULL_BROADCASTER로 위임 (dashboard 미활성 상태)", () => {
    // main.ts: const broadcaster = new MutableBroadcaster()
    const broadcaster = new MutableBroadcaster();
    const port: SseBroadcasterLike = broadcaster;

    // dashboard가 아직 생성되지 않은 상태 — 모든 호출이 no-op
    expect(() => {
      port.broadcast_process_event("start", {} as any);
      port.broadcast_message_event("inbound", "u1");
      port.broadcast_cron_event("tick");
      port.broadcast_progress_event({} as any);
      port.broadcast_task_event("status_change", {} as any);
      port.broadcast_web_stream("c1", "text", false);
      port.broadcast_web_message("c1");
      port.broadcast_mirror_message({} as any);
      port.broadcast_workflow_event({} as any);
      port.broadcast_agent_event({} as any);
      port.broadcast_web_rich_event("c1", { type: "done" });
    }).not.toThrow();
  });

  it("attach(SseManager) → 실제 SSE 구현으로 위임", () => {
    const broadcaster = new MutableBroadcaster();
    const sse = new SseManager();

    // bootstrap/dashboard.ts: broadcaster.attach(dash.sse)
    broadcaster.attach(sse);

    // SseManager의 메서드가 실제로 호출되는지 검증
    // (클라이언트 미연결 상태이므로 내부에서 early return하지만 오류 없음)
    expect(() => {
      broadcaster.broadcast_message_event("outbound", "bot", "hello", "c1");
      broadcaster.broadcast_cron_event("tick", "job1");
      broadcaster.broadcast_web_stream("c1", "response text", false);
      broadcaster.broadcast_web_message("c1");
    }).not.toThrow();
  });

  it("attach → detach → NULL_BROADCASTER 복귀", () => {
    const broadcaster = new MutableBroadcaster();
    const mock_target: SseBroadcasterLike = {
      broadcast_process_event: vi.fn(),
      broadcast_message_event: vi.fn(),
      broadcast_cron_event: vi.fn(),
      broadcast_progress_event: vi.fn(),
      broadcast_task_event: vi.fn(),
      broadcast_web_stream: vi.fn(),
      broadcast_web_message: vi.fn(),
      broadcast_mirror_message: vi.fn(),
      broadcast_workflow_event: vi.fn(),
      broadcast_agent_event: vi.fn(),
      broadcast_web_rich_event: vi.fn(),
    };

    broadcaster.attach(mock_target);
    broadcaster.broadcast_cron_event("tick");
    expect(mock_target.broadcast_cron_event).toHaveBeenCalledTimes(1);

    // detach 후 → mock_target으로 더 이상 위임하지 않음
    broadcaster.detach();
    broadcaster.broadcast_cron_event("tick");
    expect(mock_target.broadcast_cron_event).toHaveBeenCalledTimes(1); // 여전히 1회
  });

  it("add_rich_stream_listener: attach 전 → no-op 해제 함수 반환", () => {
    const broadcaster = new MutableBroadcaster();
    const off = broadcaster.add_rich_stream_listener("c1", () => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });

  it("add_rich_stream_listener: SseManager attach 후 → 실제 리스너 등록", () => {
    const broadcaster = new MutableBroadcaster();
    const sse = new SseManager();
    broadcaster.attach(sse);

    const events: unknown[] = [];
    const off = broadcaster.add_rich_stream_listener("c1", (ev) => events.push(ev));

    // rich event 발행 → 리스너가 수신
    broadcaster.broadcast_web_rich_event("c1", { type: "done" });
    expect(events).toHaveLength(1);
    expect((events[0] as any).type).toBe("done");

    // 해제 후 → 더 이상 수신하지 않음
    off();
    broadcaster.broadcast_web_rich_event("c1", { type: "done" });
    expect(events).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// 4. NULL_BROADCASTER — dashboard 비활성 시 bootstrap 기본값
// ══════════════════════════════════════════════════════════════════

describe("Bootstrap Smoke — NULL_BROADCASTER 기본값 역할", () => {
  it("SseBroadcasterLike 포트로 할당 가능", () => {
    // MutableBroadcaster 내부 기본값이자, dashboard 미활성 시 직접 사용
    const port: SseBroadcasterLike = NULL_BROADCASTER;
    expect(typeof port.broadcast_message_event).toBe("function");
    expect(typeof port.broadcast_web_stream).toBe("function");
  });

  it("모든 메서드가 void 반환 (no-op 계약)", () => {
    // bootstrap에서 dashboard가 비활성이면 NULL_BROADCASTER가 직접 주입될 수 있음
    expect(NULL_BROADCASTER.broadcast_process_event("start", {} as any)).toBeUndefined();
    expect(NULL_BROADCASTER.broadcast_message_event("inbound", "u1")).toBeUndefined();
    expect(NULL_BROADCASTER.broadcast_cron_event("tick")).toBeUndefined();
    expect(NULL_BROADCASTER.broadcast_web_stream("c1", "", true)).toBeUndefined();
    expect(NULL_BROADCASTER.broadcast_web_message("c1")).toBeUndefined();
  });

  it("MutableBroadcaster detach 후 NULL_BROADCASTER로 복귀 검증", () => {
    const broadcaster = new MutableBroadcaster();
    const spy = vi.fn();
    const target: SseBroadcasterLike = {
      broadcast_process_event: vi.fn(),
      broadcast_message_event: spy,
      broadcast_cron_event: vi.fn(),
      broadcast_progress_event: vi.fn(),
      broadcast_task_event: vi.fn(),
      broadcast_web_stream: vi.fn(),
      broadcast_web_message: vi.fn(),
      broadcast_mirror_message: vi.fn(),
      broadcast_workflow_event: vi.fn(),
      broadcast_agent_event: vi.fn(),
      broadcast_web_rich_event: vi.fn(),
    };

    // attach → 위임 확인
    broadcaster.attach(target);
    broadcaster.broadcast_message_event("inbound", "u1");
    expect(spy).toHaveBeenCalledTimes(1);

    // detach → NULL_BROADCASTER 복귀 (spy 더 이상 호출 안 됨)
    broadcaster.detach();
    broadcaster.broadcast_message_event("inbound", "u2");
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// 5. 포트 조합 — 복수 서비스를 함께 주입하는 소비자 시나리오
// ══════════════════════════════════════════════════════════════════

describe("Bootstrap Smoke — 포트 조합 주입", () => {
  let workspace: string;

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => {});
  });

  it("소비자 함수가 3개 포트를 동시에 수신하여 사용", async () => {
    workspace = await mkdtemp(join(tmpdir(), "pa7-bs-combo-"));

    // bootstrap이 생성하는 3개 서비스
    const providers = new ProviderRegistry({ secret_vault: make_vault() });
    const events = new WorkflowEventService(workspace);
    const broadcaster = new MutableBroadcaster();

    // 소비자는 포트 타입으로 수신 (e.g., AgentDomain, OrchestrationService)
    function consumer_smoke(
      p: ProviderRegistryLike,
      e: WorkflowEventServiceLike,
      b: SseBroadcasterLike,
    ): { providers_ok: boolean; events_ok: boolean; broadcaster_ok: boolean } {
      return {
        providers_ok: p.list_providers().length >= 0,
        events_ok: typeof e.append === "function",
        broadcaster_ok: typeof b.broadcast_message_event === "function",
      };
    }

    const result = consumer_smoke(providers, events, broadcaster);
    expect(result.providers_ok).toBe(true);
    expect(result.events_ok).toBe(true);
    expect(result.broadcaster_ok).toBe(true);
  });
});
