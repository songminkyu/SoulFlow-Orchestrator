/**
 * create_default_tool_registry — 미커버 분기 보충.
 * bus/spawn_callback/cron/task_query_callback 선택적 파라미터,
 * runtime_policy pre_hook 주입, workspace 없음 → Error.
 */
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { create_default_tool_registry } from "@src/agent/tools/index.js";

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "tool-reg-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

// ══════════════════════════════════════════
// 기본 생성
// ══════════════════════════════════════════

describe("create_default_tool_registry — 기본", () => {
  it("workspace만 있어도 registry 생성됨", () => {
    const { registry, installer, dynamic_loader } = create_default_tool_registry({ workspace });
    expect(registry).toBeDefined();
    expect(installer).toBeDefined();
    expect(dynamic_loader).toBeDefined();
    // 핵심 도구 등록됨 확인
    expect(registry.tool_names()).toContain("read_file");
    expect(registry.tool_names()).toContain("exec");
  });

  it("workspace 없음 → Error 발생", () => {
    expect(() => create_default_tool_registry({ workspace: "" })).toThrow("workspace is required");
  });
});

// ══════════════════════════════════════════
// bus 옵션 — message/ask_user/send_file 도구 등록
// ══════════════════════════════════════════

describe("create_default_tool_registry — bus 옵션", () => {
  it("bus 있으면 message/ask_user/send_file 도구 등록됨", async () => {
    const bus = {
      publish_outbound: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
    };
    const { registry } = create_default_tool_registry({ workspace, bus: bus as any });
    expect(registry.tool_names()).toContain("message");
    expect(registry.tool_names()).toContain("ask_user");
    expect(registry.tool_names()).toContain("send_file");
  });

  it("bus 없으면 message/ask_user/send_file 도구 없음", () => {
    const { registry } = create_default_tool_registry({ workspace });
    expect(registry.tool_names()).not.toContain("message");
  });
});

// ══════════════════════════════════════════
// spawn_callback 옵션 — spawn 도구 등록
// ══════════════════════════════════════════

describe("create_default_tool_registry — spawn_callback 옵션", () => {
  it("spawn_callback 있으면 spawn 도구 등록됨", () => {
    const spawn_callback = vi.fn().mockResolvedValue({ subagent_id: "sa1", status: "running" });
    const { registry } = create_default_tool_registry({ workspace, spawn_callback });
    expect(registry.tool_names()).toContain("spawn");
  });

  it("spawn_callback 없으면 spawn 도구 없음", () => {
    const { registry } = create_default_tool_registry({ workspace });
    expect(registry.tool_names()).not.toContain("spawn");
  });
});

// ══════════════════════════════════════════
// cron 옵션 — cron 도구 등록
// ══════════════════════════════════════════

describe("create_default_tool_registry — cron 옵션", () => {
  it("cron 있으면 cron 도구 등록됨", () => {
    const cron = {
      add_job: vi.fn(),
      remove_job: vi.fn(),
      list_jobs: vi.fn(),
    };
    const { registry } = create_default_tool_registry({ workspace, cron: cron as any });
    expect(registry.tool_names()).toContain("cron");
  });

  it("cron 없으면 cron 도구 없음 (기본 등록 안 됨)", () => {
    const { registry } = create_default_tool_registry({ workspace });
    // cron이 없는 경우 CronTool은 등록 안 됨
    // (cron null은 else 분기)
    expect(registry.tool_names()).not.toContain("cron");
  });
});

// ══════════════════════════════════════════
// task_query_callback 옵션
// ══════════════════════════════════════════

describe("create_default_tool_registry — task_query_callback 옵션", () => {
  it("task_query_callback 있으면 task_query 도구 등록됨", () => {
    const task_query_callback = vi.fn().mockResolvedValue([]);
    const { registry } = create_default_tool_registry({ workspace, task_query_callback });
    expect(registry.tool_names()).toContain("task_query");
  });

  it("task_query_callback 없으면 task_query 도구 없음", () => {
    const { registry } = create_default_tool_registry({ workspace });
    expect(registry.tool_names()).not.toContain("task_query");
  });
});

// ══════════════════════════════════════════
// runtime_policy 옵션 — pre_hook 주입
// ══════════════════════════════════════════

describe("create_default_tool_registry — runtime_policy 옵션", () => {
  it("runtime_policy 있으면 policy pre_hook이 추가됨", async () => {
    const { registry } = create_default_tool_registry({
      workspace,
      runtime_policy: {
        sandbox: {
          approval: "auto-approve",
          network_access: true,
          fs_access: "workspace-write",
        },
      } as any,
    });
    // auto-approve이므로 read_file 실행 허용됨
    const result = await registry.execute("read_file", { path: "/nonexistent" });
    expect(typeof result).toBe("string"); // 실행됨 (파일 없어도 Error 문자열 반환)
  });

  it("pre_hooks 커스텀 훅이 실행 차단 가능", async () => {
    // pre_hooks 파라미터로 직접 주입하는 경로 테스트
    const block_hook = vi.fn().mockReturnValue({ permission: "deny", reason: "blocked by test hook" });
    const { registry } = create_default_tool_registry({
      workspace,
      pre_hooks: [block_hook],
    });
    // exec 실행 시 hook이 deny → 차단됨
    const result = await registry.execute("exec", { command: "echo hello" });
    expect(block_hook).toHaveBeenCalled();
    expect(String(result)).toContain("blocked by test hook");
  });
});

// ══════════════════════════════════════════
// dynamic_store_path 커스텀
// ══════════════════════════════════════════

describe("create_default_tool_registry — dynamic_store_path", () => {
  it("dynamic_store_path 지정 시 해당 경로 사용", () => {
    const custom_path = join(workspace, "custom-tools.db");
    const { registry } = create_default_tool_registry({ workspace, dynamic_store_path: custom_path });
    expect(registry).toBeDefined();
  });
});

// ══════════════════════════════════════════
// L598: sender 클로저 — bus.publish_outbound 호출
// ══════════════════════════════════════════

describe("create_default_tool_registry — bus.publish_outbound 호출 (L598)", () => {
  it("message 도구 execute → sender → bus.publish_outbound 호출 (L598)", async () => {
    const publish_outbound = vi.fn().mockResolvedValue(undefined);
    const bus = { publish_outbound, subscribe: vi.fn() };
    const { registry } = create_default_tool_registry({ workspace, bus: bus as any });
    const result = await registry.execute("message", {
      channel: "slack",
      chat_id: "C123",
      content: "Hello from test",
    });
    // sender가 호출됨 → publish_outbound 호출됨 (L598)
    expect(publish_outbound).toHaveBeenCalled();
    expect(String(result)).toContain("Event sent");
  });
});

// ══════════════════════════════════════════
// L624, L627-629: runtime_admin 도구 — list_registered_tool_names + refresh_dynamic_tools
// ══════════════════════════════════════════

describe("create_default_tool_registry — runtime_admin 콜백 (L624, L627-629)", () => {
  it("tool_install_shell → list_registered_tool_names + refresh_dynamic_tools 호출 (L624, L627-629)", async () => {
    const { registry } = create_default_tool_registry({ workspace });
    const result = await registry.execute("runtime_admin", {
      action: "tool_install_shell",
      tool_name: "test_shell_tool",
      tool_description: "Test shell tool",
      tool_command_template: "echo {{input}}",
      tool_overwrite: true,
    });
    const parsed = JSON.parse(String(result));
    // tool 설치 성공 → refresh_dynamic_tools 호출됨 (L627-629)
    expect(parsed.ok).toBe(true);
    expect(parsed.tool_name).toBe("test_shell_tool");
  });
});

// ── T-2: factory reducer wiring (L447) — create_default_tool_registry에서 reducer 주입 ──────────

describe("create_default_tool_registry — reducer wiring (L447)", () => {
  it("생성된 registry가 reducer를 사용하여 tool 실행 결과를 변환한다", async () => {
    const { registry } = create_default_tool_registry({ workspace });

    // 긴 plain text 결과를 반환하는 도구를 등록
    const long_text = "A".repeat(10_000);
    const tool = {
      name: "verbose_tool",
      description: "Returns long text",
      category: "data" as const,
      parameters: { type: "object" as const, properties: {} },
      execute: vi.fn().mockResolvedValue(long_text),
      validate_params: vi.fn().mockReturnValue([]),
      to_schema: () => ({
        type: "function" as const,
        function: { name: "verbose_tool", description: "Returns long text", parameters: { type: "object", properties: {} } },
      }),
    };
    registry.register(tool as any);

    const result = await registry.execute("verbose_tool", {});

    // reducer가 적용되어 10,000자 원본보다 짧아져야 함
    expect(result.length).toBeLessThan(long_text.length);
    // 원본이 아닌 축소된 결과임을 확인
    expect(result).not.toBe(long_text);
  });

  it("생성된 registry가 JSON 결과에는 reducer를 bypass한다", async () => {
    const { registry } = create_default_tool_registry({ workspace });

    const json_result = '{"status":"ok","data":[1,2,3]}';
    const tool = {
      name: "json_api_tool",
      description: "Returns JSON",
      category: "data" as const,
      parameters: { type: "object" as const, properties: {} },
      execute: vi.fn().mockResolvedValue(json_result),
      validate_params: vi.fn().mockReturnValue([]),
      to_schema: () => ({
        type: "function" as const,
        function: { name: "json_api_tool", description: "Returns JSON", parameters: { type: "object", properties: {} } },
      }),
    };
    registry.register(tool as any);

    const result = await registry.execute("json_api_tool", {});

    // JSON 결과는 bypass되므로 원본 그대로
    expect(result).toBe(json_result);
  });
});

// ══════════════════════════════════════════
// CV-2: create_policy_pre_hook branch coverage
// ══════════════════════════════════════════

import { create_policy_pre_hook } from "@src/agent/tools/index.js";
import { ToolRegistry } from "@src/agent/tools/registry.js";

function make_mock_registry_with_tool(name: string, flags: { write?: boolean; network?: boolean }) {
  const registry = new ToolRegistry();
  const tool = {
    name,
    description: `mock ${name}`,
    category: "data" as const,
    policy_flags: flags,
    parameters: { type: "object" as const, properties: {} },
    execute: vi.fn().mockResolvedValue("ok"),
    validate_params: vi.fn().mockReturnValue([]),
    to_schema: () => ({
      type: "function" as const,
      function: { name, description: `mock ${name}`, parameters: { type: "object", properties: {} } },
    }),
  };
  registry.register(tool as any);
  return registry;
}

describe("create_policy_pre_hook -- branch coverage", () => {
  it("network_access=false + network tool -> deny", () => {
    const registry = make_mock_registry_with_tool("web_fetch", { network: true });
    const hook = create_policy_pre_hook({
      sandbox: { approval: "auto-approve-non-destructive", network_access: false, fs_access: "workspace-write" },
    } as any, registry);
    const result = hook("web_fetch", {});
    expect(result.permission).toBe("deny");
    expect(result.reason).toContain("network access disabled");
  });

  it("fs_access=read-only + write tool -> ask", () => {
    const registry = make_mock_registry_with_tool("write_file", { write: true });
    const hook = create_policy_pre_hook({
      sandbox: { approval: "auto-approve-non-destructive", network_access: true, fs_access: "read-only" },
    } as any, registry);
    const result = hook("write_file", {});
    expect(result.permission).toBe("ask");
    expect(result.reason).toContain("read-only policy");
  });

  it("workspace-write + exec with dangerous command -> deny", () => {
    const registry = make_mock_registry_with_tool("exec", { write: true });
    const hook = create_policy_pre_hook({
      sandbox: { approval: "auto-approve-non-destructive", network_access: true, fs_access: "workspace-write" },
    } as any, registry);
    const result = hook("exec", { command: "rm -rf /" });
    expect(result.permission).toBe("deny");
    expect(result.reason).toContain("dangerous command blocked");
  });

  it("always-ask + write tool -> ask", () => {
    const registry = make_mock_registry_with_tool("write_file", { write: true });
    const hook = create_policy_pre_hook({
      sandbox: { approval: "always-ask", network_access: true, fs_access: "workspace-write" },
    } as any, registry);
    const result = hook("write_file", {});
    expect(result.permission).toBe("ask");
    expect(result.reason).toContain("approval required");
  });

  it("trusted-only + write tool (non-dangerous) -> ask", () => {
    const registry = make_mock_registry_with_tool("write_file", { write: true });
    const hook = create_policy_pre_hook({
      sandbox: { approval: "trusted-only", network_access: true, fs_access: "workspace-write" },
    } as any, registry);
    const result = hook("write_file", {});
    expect(result.permission).toBe("ask");
    expect(result.reason).toContain("trusted-only");
  });

  it("trusted-only + exec with dangerous command -> deny", () => {
    const registry = make_mock_registry_with_tool("exec", { write: true });
    const hook = create_policy_pre_hook({
      sandbox: { approval: "trusted-only", network_access: true, fs_access: "workspace-write" },
    } as any, registry);
    const result = hook("exec", { command: "drop table users" });
    expect(result.permission).toBe("deny");
    expect(result.reason).toContain("dangerous command blocked");
  });

  it("no sandbox -> allow", () => {
    const hook = create_policy_pre_hook({} as any, null);
    const result = hook("any_tool", {});
    expect(result.permission).toBe("allow");
  });

  it("unknown tool (not in registry) -> allow (no policy_flags)", () => {
    const registry = new ToolRegistry();
    const hook = create_policy_pre_hook({
      sandbox: { approval: "always-ask", network_access: true, fs_access: "workspace-write" },
    } as any, registry);
    const result = hook("unknown_tool", {});
    // No policy_flags -> is_write=false, is_network=false -> allow
    expect(result.permission).toBe("allow");
  });
});

// ══════════════════════════════════════════
// CV-2: conditional tool registrations (channels, llm_callback, canvas_broadcast)
// ══════════════════════════════════════════

describe("create_default_tool_registry -- conditional tool registrations", () => {
  it("channels provided -> poll tool registered", () => {
    const channels = {
      list: vi.fn().mockReturnValue([]),
      get: vi.fn(),
    };
    const { registry } = create_default_tool_registry({ workspace, channels: channels as any });
    expect(registry.tool_names()).toContain("poll");
  });

  it("channels not provided -> poll tool not registered", () => {
    const { registry } = create_default_tool_registry({ workspace });
    expect(registry.tool_names()).not.toContain("poll");
  });

  it("llm_callback provided -> llm_task tool registered", () => {
    const llm_callback = vi.fn().mockResolvedValue({ result: "ok" });
    const { registry } = create_default_tool_registry({ workspace, llm_callback });
    expect(registry.tool_names()).toContain("llm_task");
  });

  it("llm_callback not provided -> llm_task tool not registered", () => {
    const { registry } = create_default_tool_registry({ workspace });
    expect(registry.tool_names()).not.toContain("llm_task");
  });

  it("canvas_broadcast provided -> canvas tool registered", () => {
    const canvas_broadcast = vi.fn().mockResolvedValue(undefined);
    const { registry } = create_default_tool_registry({ workspace, canvas_broadcast });
    expect(registry.tool_names()).toContain("canvas_render");
  });

  it("canvas_broadcast not provided -> canvas tool not registered", () => {
    const { registry } = create_default_tool_registry({ workspace });
    expect(registry.tool_names()).not.toContain("canvas_render");
  });
});
