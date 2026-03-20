/**
 * PA-6 Outbound Adapter Conformance Tests
 *
 * Verifies that all outbound adapters (agent backends, bus, provider factory)
 * implement the expected port contracts at runtime.
 *
 * - Agent provider factory produces correctly typed AgentBackend instances
 * - AgentBackend implementations (Claude SDK, Codex, OpenAI-compatible, etc.) expose required interface
 * - InMemoryMessageBus implements MessageBusLike (outbound event port)
 * - Bus port adapter (to_realtime_port) produces RealtimeEventPort
 */
import { describe, it, expect, vi, afterEach } from "vitest";

// -- Provider mocks (prevent real network/process side-effects) --
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

import type { AgentBackend } from "@src/agent/agent.types.js";
import {
  register_agent_provider_factory,
  create_agent_provider,
  list_registered_provider_types,
  get_agent_provider_factory,
} from "@src/agent/provider-factory.js";
import type { ProviderRegistryLike } from "@src/providers/index.js";
import { InMemoryMessageBus } from "@src/bus/service.js";
import type { MessageBusLike } from "@src/bus/types.js";
import { to_realtime_port } from "@src/bus/ports.js";
import type { RealtimeEventPort } from "@src/bus/ports.js";

// -- AgentBackend port required members --

const AGENT_BACKEND_METHODS: (keyof AgentBackend)[] = [
  "run",
  "is_available",
];

const AGENT_BACKEND_PROPERTIES: (keyof AgentBackend)[] = [
  "id",
  "native_tool_loop",
  "supports_resume",
  "capabilities",
];

const MESSAGE_BUS_METHODS: (keyof MessageBusLike)[] = [
  "publish_inbound",
  "publish_outbound",
  "consume_inbound",
  "consume_outbound",
  "publish_progress",
  "consume_progress",
  "get_size",
  "get_sizes",
  "close",
  "is_closed",
];

const REALTIME_EVENT_PORT_METHODS: (keyof RealtimeEventPort)[] = [
  "publish_progress",
  "consume_progress",
];

// -- Helpers --

function assert_port_methods(instance: unknown, methods: string[], label: string): void {
  for (const method of methods) {
    const val = (instance as Record<string, unknown>)[method];
    expect(typeof val, label + "." + method + " -- expected function, got " + typeof val).toBe("function");
  }
}

function assert_port_properties(instance: unknown, props: string[], label: string): void {
  for (const prop of props) {
    const val = (instance as Record<string, unknown>)[prop];
    expect(val !== undefined, label + "." + prop + " -- expected defined").toBe(true);
  }
}

function make_mock_provider_registry(): ProviderRegistryLike {
  return {
    list_providers: vi.fn().mockReturnValue([]),
    get_active_provider_id: vi.fn().mockReturnValue(null),
    set_active_provider: vi.fn(),
    get_orchestrator_provider_id: vi.fn().mockReturnValue(null),
    set_orchestrator_provider: vi.fn(),
    get_provider_instance: vi.fn().mockReturnValue(null),
    get_circuit_breaker: vi.fn().mockReturnValue(null),
    is_provider_available: vi.fn().mockReturnValue(false),
    get_health_scorer: vi.fn().mockReturnValue(null),
    get_secret_vault: vi.fn().mockReturnValue(null),
    supports_tool_loop: vi.fn().mockReturnValue(false),
    run_headless: vi.fn(),
    run_headless_prompt: vi.fn(),
    run_headless_with_context: vi.fn(),
    run_orchestrator: vi.fn(),
  } as unknown as ProviderRegistryLike;
}

// ==================================================================
// Agent Provider Factory -- structural verification
// ==================================================================

describe("PA-6 Conformance -- Agent Provider Factory", () => {
  it("builtin provider types are registered", () => {
    const types = list_registered_provider_types();
    expect(types).toContain("claude_cli");
    expect(types).toContain("codex_cli");
    expect(types).toContain("gemini_cli");
    expect(types).toContain("claude_sdk");
    expect(types).toContain("codex_appserver");
    expect(types).toContain("openai_compatible");
    expect(types).toContain("openrouter");
    expect(types).toContain("ollama");
    expect(types).toContain("container_cli");
  });

  it("get_agent_provider_factory returns function for known types", () => {
    const factory = get_agent_provider_factory("claude_sdk");
    expect(typeof factory).toBe("function");
  });

  it("get_agent_provider_factory returns null for unknown types", () => {
    const factory = get_agent_provider_factory("nonexistent_xyz");
    expect(factory).toBeNull();
  });

  it("create_agent_provider returns null for unknown type", () => {
    const result = create_agent_provider(
      { instance_id: "x", provider_type: "nonexistent", label: "", enabled: true, priority: 0, model_purpose: "chat", supported_modes: [], settings: {}, scope_type: "global", scope_id: "", created_at: "", updated_at: "" },
      null,
      { provider_registry: make_mock_provider_registry(), workspace: "/tmp" },
    );
    expect(result).toBeNull();
  });

  it("create_agent_provider produces AgentBackend for claude_sdk", () => {
    const backend = create_agent_provider(
      { instance_id: "test-sdk", provider_type: "claude_sdk", label: "SDK", enabled: true, priority: 0, model_purpose: "chat", supported_modes: [], settings: { cwd: "/tmp", model: "claude-sonnet-4-20250514" }, scope_type: "global", scope_id: "", created_at: "", updated_at: "" },
      null,
      { provider_registry: make_mock_provider_registry(), workspace: "/tmp" },
    );
    expect(backend).not.toBeNull();
    assert_port_methods(backend!, AGENT_BACKEND_METHODS, "ClaudeSdkAgent");
    assert_port_properties(backend!, AGENT_BACKEND_PROPERTIES, "ClaudeSdkAgent");
    expect(backend!.id).toBe("test-sdk");
  });

  it("create_agent_provider produces AgentBackend for codex_appserver", () => {
    const backend = create_agent_provider(
      { instance_id: "test-codex", provider_type: "codex_appserver", label: "Codex", enabled: true, priority: 0, model_purpose: "chat", supported_modes: [], settings: { cwd: "/tmp" }, scope_type: "global", scope_id: "", created_at: "", updated_at: "" },
      null,
      { provider_registry: make_mock_provider_registry(), workspace: "/tmp" },
    );
    expect(backend).not.toBeNull();
    assert_port_methods(backend!, AGENT_BACKEND_METHODS, "CodexAppServerAgent");
    assert_port_properties(backend!, AGENT_BACKEND_PROPERTIES, "CodexAppServerAgent");
  });

  it("create_agent_provider produces AgentBackend for openai_compatible", () => {
    const backend = create_agent_provider(
      { instance_id: "test-oai", provider_type: "openai_compatible", label: "OAI", enabled: true, priority: 0, model_purpose: "chat", supported_modes: [], settings: {}, scope_type: "global", scope_id: "", created_at: "", updated_at: "" },
      "sk-test",
      { provider_registry: make_mock_provider_registry(), workspace: "/tmp" },
    );
    expect(backend).not.toBeNull();
    assert_port_methods(backend!, AGENT_BACKEND_METHODS, "OpenAiCompatibleAgent");
    assert_port_properties(backend!, AGENT_BACKEND_PROPERTIES, "OpenAiCompatibleAgent");
  });

  it("register_agent_provider_factory allows custom provider type", () => {
    const custom_backend = {
      id: "custom-be",
      native_tool_loop: false,
      supports_resume: false,
      capabilities: { approval: false, structured_output: false, thinking: false, budget_tracking: false, tool_filtering: false, tool_result_events: false, send_input: false, tool_executors: false },
      run: vi.fn(),
      is_available: vi.fn().mockReturnValue(true),
    };
    register_agent_provider_factory("custom_test_pa6", () => custom_backend as unknown as AgentBackend);
    expect(list_registered_provider_types()).toContain("custom_test_pa6");
    const result = create_agent_provider(
      { instance_id: "ct", provider_type: "custom_test_pa6", label: "", enabled: true, priority: 0, model_purpose: "chat", supported_modes: [], settings: {}, scope_type: "global", scope_id: "", created_at: "", updated_at: "" },
      null,
      { provider_registry: make_mock_provider_registry(), workspace: "/tmp" },
    );
    expect(result).toBe(custom_backend);
  });
});

// ==================================================================
// InMemoryMessageBus -> MessageBusLike (outbound event port)
// ==================================================================

describe("PA-6 Conformance -- InMemoryMessageBus implements MessageBusLike", () => {
  let bus: InstanceType<typeof InMemoryMessageBus>;

  afterEach(async () => {
    if (bus && !bus.is_closed()) await bus.close();
  });

  it("all MessageBusLike methods are implemented", () => {
    bus = new InMemoryMessageBus();
    assert_port_methods(bus, MESSAGE_BUS_METHODS, "InMemoryMessageBus");
  });

  it("port method count matches interface definition (10)", () => {
    expect(MESSAGE_BUS_METHODS).toHaveLength(10);
  });

  it("kind property is memory", () => {
    bus = new InMemoryMessageBus();
    expect(bus.kind).toBe("memory");
  });

  it("is_closed returns false initially, true after close", async () => {
    bus = new InMemoryMessageBus();
    expect(bus.is_closed()).toBe(false);
    await bus.close();
    expect(bus.is_closed()).toBe(true);
  });

  it("get_sizes returns zero counts on fresh bus", () => {
    bus = new InMemoryMessageBus();
    const sizes = bus.get_sizes();
    expect(sizes).toEqual({ inbound: 0, outbound: 0, total: 0 });
  });
});

// ==================================================================
// Bus Port Adapter -- to_realtime_port
// ==================================================================

describe("PA-6 Conformance -- to_realtime_port adapter", () => {
  it("wraps MessageBusLike into RealtimeEventPort", () => {
    const bus = new InMemoryMessageBus();
    const port = to_realtime_port(bus);
    assert_port_methods(port, REALTIME_EVENT_PORT_METHODS, "RealtimeEventPort");
    bus.close();
  });

  it("RealtimeEventPort method count matches interface (2)", () => {
    expect(REALTIME_EVENT_PORT_METHODS).toHaveLength(2);
  });

  it("delegates publish_progress to underlying bus", async () => {
    const bus = new InMemoryMessageBus();
    const port = to_realtime_port(bus);
    const event = { task_id: "t1", step: 1, total_steps: 2, description: "test", provider: "slack", chat_id: "c1", at: new Date().toISOString(), team_id: "team1" };
    await port.publish_progress(event);
    const consumed = await port.consume_progress({ timeout_ms: 100 });
    expect(consumed).not.toBeNull();
    expect(consumed!.task_id).toBe("t1");
    await bus.close();
  });
});

// ==================================================================
// AgentBackend port shape counts
// ==================================================================

describe("PA-6 Conformance -- Port Shape Counts", () => {
  it("AgentBackend has 2 required methods + 4 required properties", () => {
    expect(AGENT_BACKEND_METHODS).toHaveLength(2);
    expect(AGENT_BACKEND_PROPERTIES).toHaveLength(4);
  });

  it("builtin provider types count is at least 9", () => {
    const types = list_registered_provider_types();
    expect(types.length).toBeGreaterThanOrEqual(9);
  });
});
