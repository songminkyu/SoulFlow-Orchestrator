/**
 * PA-7 Adapter Conformance — 각 concrete adapter가 포트 인터페이스의
 * 모든 메서드를 런타임에서 구현하는지 구조적으로 검증.
 *
 * TypeScript `implements`는 컴파일 타임 보장. 이 테스트는 런타임 회귀 방지.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── ProviderRegistry mock (생성자에서 각 Provider를 new로 생성하므로 class mock 필요) ──
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
import {
  MutableBroadcaster,
  NULL_BROADCASTER,
} from "@src/dashboard/broadcaster.js";
import type { SseBroadcasterLike } from "@src/dashboard/broadcaster.js";
import { SseManager } from "@src/dashboard/sse-manager.js";

// ── 포트별 required 메서드 목록 ──

const PROVIDER_REGISTRY_METHODS: (keyof ProviderRegistryLike)[] = [
  "list_providers",
  "get_active_provider_id",
  "set_active_provider",
  "get_orchestrator_provider_id",
  "set_orchestrator_provider",
  "get_provider_instance",
  "get_circuit_breaker",
  "is_provider_available",
  "get_health_scorer",
  "get_secret_vault",
  "supports_tool_loop",
  "run_headless",
  "run_headless_prompt",
  "run_headless_with_context",
  "run_orchestrator",
];

const WORKFLOW_EVENT_SERVICE_METHODS: (keyof WorkflowEventServiceLike)[] = [
  "append",
  "list",
  "read_task_detail",
  "bind_task_store",
];

const SSE_BROADCASTER_REQUIRED_METHODS: (keyof SseBroadcasterLike)[] = [
  "broadcast_process_event",
  "broadcast_message_event",
  "broadcast_cron_event",
  "broadcast_progress_event",
  "broadcast_task_event",
  "broadcast_web_stream",
  "broadcast_web_message",
  "broadcast_mirror_message",
  "broadcast_workflow_event",
  "broadcast_agent_event",
  "broadcast_web_rich_event",
];

/** add_rich_stream_listener는 optional(?) 메서드 — 구현체에 따라 존재하거나 안 할 수 있음. */
const SSE_BROADCASTER_OPTIONAL_METHOD = "add_rich_stream_listener";

// ── 헬퍼 ──

function make_vault() {
  return { mask_known_secrets: vi.fn().mockResolvedValue("masked") } as any;
}

/** 인스턴스에 지정된 메서드가 모두 function 타입인지 검증. */
function assert_port_methods(instance: unknown, methods: string[], label: string): void {
  for (const method of methods) {
    const val = (instance as Record<string, unknown>)[method];
    expect(typeof val, `${label}.${method} — expected function, got ${typeof val}`).toBe("function");
  }
}

// ══════════════════════════════════════════════════════════════════
// ProviderRegistry → ProviderRegistryLike
// ══════════════════════════════════════════════════════════════════

describe("PA-7 Conformance — ProviderRegistry", () => {
  it("ProviderRegistryLike 포트의 모든 required 메서드를 런타임에서 구현", () => {
    const registry = new ProviderRegistry({ secret_vault: make_vault() });
    assert_port_methods(registry, PROVIDER_REGISTRY_METHODS, "ProviderRegistry");
  });

  it("포트 메서드 수가 인터페이스 정의와 일치 (15개)", () => {
    expect(PROVIDER_REGISTRY_METHODS).toHaveLength(15);
  });
});

// ══════════════════════════════════════════════════════════════════
// WorkflowEventService → WorkflowEventServiceLike
// ══════════════════════════════════════════════════════════════════

describe("PA-7 Conformance — WorkflowEventService", () => {
  let workspace: string;

  afterEach(async () => {
    if (workspace) await rm(workspace, { recursive: true, force: true }).catch(() => {});
  });

  it("WorkflowEventServiceLike 포트의 모든 required 메서드를 런타임에서 구현", async () => {
    workspace = await mkdtemp(join(tmpdir(), "pa7-evt-"));
    const svc = new WorkflowEventService(workspace);
    assert_port_methods(svc, WORKFLOW_EVENT_SERVICE_METHODS, "WorkflowEventService");
  });

  it("포트 메서드 수가 인터페이스 정의와 일치 (4개)", () => {
    expect(WORKFLOW_EVENT_SERVICE_METHODS).toHaveLength(4);
  });
});

// ══════════════════════════════════════════════════════════════════
// SseBroadcasterLike 구현체 3종
// ══════════════════════════════════════════════════════════════════

describe("PA-7 Conformance — SseBroadcasterLike implementations", () => {
  // ── MutableBroadcaster ──
  describe("MutableBroadcaster", () => {
    it("필수 메서드 모두 구현", () => {
      const broadcaster = new MutableBroadcaster();
      assert_port_methods(broadcaster, SSE_BROADCASTER_REQUIRED_METHODS, "MutableBroadcaster");
    });

    it("optional add_rich_stream_listener 구현 (프록시 위임)", () => {
      const broadcaster = new MutableBroadcaster();
      expect(typeof broadcaster.add_rich_stream_listener).toBe("function");
    });
  });

  // ── NULL_BROADCASTER ──
  describe("NULL_BROADCASTER", () => {
    it("필수 메서드 모두 구현 (no-op)", () => {
      assert_port_methods(NULL_BROADCASTER, SSE_BROADCASTER_REQUIRED_METHODS, "NULL_BROADCASTER");
    });

    it("optional add_rich_stream_listener는 미구현 (설계 의도)", () => {
      // NULL_BROADCASTER는 no-op 상수이므로 optional 메서드를 구현하지 않음.
      // MutableBroadcaster가 fallback으로 () => undefined를 반환하여 처리.
      expect(NULL_BROADCASTER[SSE_BROADCASTER_OPTIONAL_METHOD]).toBeUndefined();
    });
  });

  // ── SseManager ──
  describe("SseManager", () => {
    it("필수 메서드 모두 구현", () => {
      const manager = new SseManager();
      assert_port_methods(manager, SSE_BROADCASTER_REQUIRED_METHODS, "SseManager");
    });

    it("optional add_rich_stream_listener 구현 (실제 리스너 관리)", () => {
      const manager = new SseManager();
      expect(typeof manager.add_rich_stream_listener).toBe("function");
    });
  });

  // ── 포트 정합성 ──
  it("필수 메서드 수가 인터페이스 정의와 일치 (11개)", () => {
    expect(SSE_BROADCASTER_REQUIRED_METHODS).toHaveLength(11);
  });
});
