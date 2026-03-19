/**
 * RP-4: gateway plan respects use_when.
 *
 * RolePolicy.use_when 필드가 실행 경로 분기에 영향을 주는지 검증.
 *
 * 검증 포인트:
 * 1. PromptProfile.use_when이 RolePolicyResolver에서 올바르게 파싱됨
 * 2. to_request_plan이 GatewayDecision의 action에 따라
 *    direct_tool(no_token) vs agent-loop(agent_required) 경로를 분기함
 * 3. direct_tool 결정 → RequestPlan.route === "no_token"
 * 4. agent-loop 결정 → RequestPlan.route === "agent_required"
 * 5. ExecutionGateway.resolve가 no_token plan에서 fallback 없음을 보장
 */
import { describe, it, expect } from "vitest";
import { to_request_plan } from "@src/orchestration/gateway-contracts.js";
import { create_execution_gateway } from "@src/orchestration/execution-gateway.js";
import { create_role_policy_resolver } from "@src/orchestration/role-policy-resolver.js";
import { create_prompt_profile_compiler } from "@src/orchestration/prompt-profile-compiler.js";
import type { GatewayDecision } from "@src/orchestration/gateway.js";
import type { RolePolicySkillSource } from "@src/orchestration/role-policy-resolver.js";
import type { SkillMetadata } from "@src/agent/skills.types.js";
import type { ProviderCapabilities } from "@src/providers/executor.js";

const ALL_CAPS: ProviderCapabilities = {
  chatgpt_available: true,
  claude_available: true,
  openrouter_available: true,
};

// ── Fixture 헬퍼 ──────────────────────────────────────────────────

function make_role_meta(
  use_when: string,
  overrides: Partial<SkillMetadata> = {},
): SkillMetadata {
  return {
    name: "role:implementer",
    path: "d:/test/SKILL.md",
    source: "builtin_skills",
    type: "role",
    always: false,
    summary: `코드 구현. Use when ${use_when}. Do NOT use for 설계, 리뷰.`,
    aliases: [],
    triggers: [],
    tools: ["read_file", "write_file"],
    requirements: [],
    model: "remote",
    frontmatter: {},
    role: "implementer",
    soul: "",
    heart: "",
    shared_protocols: [],
    preferred_providers: [],
    oauth: [],
    intents: [],
    file_patterns: [],
    code_patterns: [],
    checks: [],
    project_docs: false,
    ...overrides,
  };
}

function make_source(roles: SkillMetadata[]): RolePolicySkillSource {
  return {
    get_role_skill: (role: string) => roles.find((r) => r.role === role) ?? null,
    list_role_skills: () => roles,
  };
}

// ── 1. use_when 파싱 검증 ────────────────────────────────────────

describe("RP-4: use_when — RolePolicyResolver 파싱", () => {
  it("Use when ... 텍스트에서 use_when 추출", () => {
    const source = make_source([make_role_meta("스펙 확정된 코드 작성")]);
    const resolver = create_role_policy_resolver(source);
    const policy = resolver.resolve("implementer")!;

    expect(policy.use_when).toBe("스펙 확정된 코드 작성");
  });

  it("Use when 없는 summary → 빈 문자열", () => {
    const meta = make_role_meta("X");
    meta.summary = "단순 역할 설명";
    const source = make_source([meta]);
    const resolver = create_role_policy_resolver(source);
    const policy = resolver.resolve("implementer")!;

    expect(policy.use_when).toBe("");
  });

  it("Do NOT use for 텍스트에서 not_use_for 추출", () => {
    const source = make_source([make_role_meta("코드 작성")]);
    const resolver = create_role_policy_resolver(source);
    const policy = resolver.resolve("implementer")!;

    expect(policy.not_use_for).toBe("설계, 리뷰");
  });

  it("PromptProfile.use_when이 RolePolicy.use_when과 동일", () => {
    const source = make_source([make_role_meta("테스트 작성")]);
    const resolver = create_role_policy_resolver(source);
    const compiler = create_prompt_profile_compiler(resolver, {
      resolve: () => [],
      resolve_one: () => null,
      list_available: () => [],
    });
    const profile = compiler.compile("implementer")!;

    expect(profile.use_when).toBe("테스트 작성");
    expect(profile.not_use_for).toBe("설계, 리뷰");
  });
});

// ── 2. direct_tool → no_token 경로 분기 ─────────────────────────

describe("RP-4: direct_tool use_when → no_token 경로", () => {
  it("direct_tool action → RequestPlan.route === 'no_token'", () => {
    const decision: GatewayDecision = {
      action: "direct_tool",
      tool_name: "datetime",
      args: {},
    };
    const plan = to_request_plan(decision);

    expect(plan.route).toBe("no_token");
    expect(plan.kind).toBe("direct_tool");
  });

  it("direct_tool plan → ExecutionGateway.resolve 시 fallback 없음", () => {
    const decision: GatewayDecision = { action: "direct_tool", tool_name: "read_file" };
    const plan = to_request_plan(decision);
    const gw = create_execution_gateway();
    const route = gw.resolve(plan, ALL_CAPS, "chatgpt");

    expect(route.primary).toBe("chatgpt");
    expect(route.fallbacks).toEqual([]);
  });

  it("direct_tool tool_name이 plan에 전달됨", () => {
    const decision: GatewayDecision = {
      action: "direct_tool",
      tool_name: "task_query",
      args: { filter: "active" },
    };
    const plan = to_request_plan(decision);

    expect(plan.kind).toBe("direct_tool");
    if (plan.route === "no_token" && plan.kind === "direct_tool") {
      expect(plan.plan.tool_name).toBe("task_query");
      expect(plan.plan.args).toEqual({ filter: "active" });
    }
  });
});

// ── 3. agent-loop → agent_required 경로 분기 ────────────────────

describe("RP-4: agent-loop use_when → agent_required 경로", () => {
  it("execute agent action → RequestPlan.route === 'agent_required'", () => {
    const decision: GatewayDecision = {
      action: "execute",
      mode: "agent",
      executor: "claude_code",
    };
    const plan = to_request_plan(decision);

    expect(plan.route).toBe("agent_required");
    expect(plan.kind).toBe("agent");
  });

  it("execute agent plan → ExecutionGateway.resolve 시 fallback 있음", () => {
    const decision: GatewayDecision = {
      action: "execute",
      mode: "agent",
      executor: "claude_code",
    };
    const plan = to_request_plan(decision);
    const gw = create_execution_gateway();
    const route = gw.resolve(plan, ALL_CAPS, "chatgpt");

    expect(route.primary).toBe("claude_code");
    expect(route.fallbacks.length).toBeGreaterThan(0);
  });

  it("execute once → model_direct (직접 실행, fallback 있음)", () => {
    const decision: GatewayDecision = {
      action: "execute",
      mode: "once",
      executor: "chatgpt",
    };
    const plan = to_request_plan(decision);
    const gw = create_execution_gateway();
    const route = gw.resolve(plan, ALL_CAPS, "chatgpt");

    expect(plan.route).toBe("model_direct");
    expect(route.fallbacks.length).toBeGreaterThan(0);
  });
});

// ── 4. no_token vs agent_required 경로 패리티 검증 ──────────────

describe("RP-4: no_token vs agent_required — 분기 명세", () => {
  it("identity → no_token, inquiry → no_token, builtin → no_token", () => {
    const cases: GatewayDecision[] = [
      { action: "identity" },
      { action: "inquiry", summary: "active tasks" },
      { action: "builtin", command: "help" },
    ];
    for (const decision of cases) {
      const plan = to_request_plan(decision);
      expect(plan.route).toBe("no_token");
    }
  });

  it("task/agent/workflow → agent_required", () => {
    const cases: GatewayDecision[] = [
      { action: "execute", mode: "task", executor: "claude_code" },
      { action: "execute", mode: "agent", executor: "chatgpt" },
      { action: "execute", mode: "phase", executor: "openrouter", workflow_id: "wf-1" },
    ];
    for (const decision of cases) {
      const plan = to_request_plan(decision);
      expect(plan.route).toBe("agent_required");
    }
  });
});
