/**
 * GW-3: ExecutionGateway — provider 결정 + fallback chain 테스트.
 *
 * 대상:
 * - create_execution_gateway(): resolve(plan, caps, pref)
 * - build_fallback_chain(): primary 제외 + 가용 provider 순회
 */

import { describe, it, expect, beforeEach } from "vitest";
import { create_execution_gateway, build_fallback_chain } from "@src/orchestration/execution-gateway.js";
import type { ExecutionGatewayLike, ExecutionRoute } from "@src/orchestration/execution-gateway.js";
import type { RequestPlan } from "@src/orchestration/gateway-contracts.js";
import type { ProviderCapabilities } from "@src/providers/executor.js";

const ALL_CAPS: ProviderCapabilities = { chatgpt_available: true, claude_available: true, openrouter_available: true, orchestrator_llm_available: true, gemini_available: true };
const NO_CAPS: ProviderCapabilities = { chatgpt_available: false, claude_available: false, openrouter_available: false, orchestrator_llm_available: false, gemini_available: false };
const CHATGPT_ONLY: ProviderCapabilities = { chatgpt_available: true, claude_available: false, openrouter_available: false };
const CLAUDE_ONLY: ProviderCapabilities = { chatgpt_available: false, claude_available: true, openrouter_available: false };

let gw: ExecutionGatewayLike;

describe("build_fallback_chain", () => {
  it("chatgpt primary → claude_code, openrouter, orchestrator_llm, gemini", () => {
    const chain = build_fallback_chain("chatgpt", ALL_CAPS);
    expect(chain).toEqual(["claude_code", "openrouter", "orchestrator_llm", "gemini"]);
  });

  it("claude_code primary → chatgpt, openrouter, orchestrator_llm, gemini", () => {
    const chain = build_fallback_chain("claude_code", ALL_CAPS);
    expect(chain).toEqual(["chatgpt", "openrouter", "orchestrator_llm", "gemini"]);
  });

  it("openrouter primary → chatgpt, claude_code, orchestrator_llm, gemini", () => {
    const chain = build_fallback_chain("openrouter", ALL_CAPS);
    expect(chain).toEqual(["chatgpt", "claude_code", "orchestrator_llm", "gemini"]);
  });

  it("orchestrator_llm primary → chatgpt, claude_code, openrouter, gemini", () => {
    const chain = build_fallback_chain("orchestrator_llm", ALL_CAPS);
    expect(chain).toEqual(["chatgpt", "claude_code", "openrouter", "gemini"]);
  });

  it("caps에서 일부 비활성 → 해당 provider 제외", () => {
    const chain = build_fallback_chain("chatgpt", CLAUDE_ONLY);
    // claude_code만 사용 가능, 나머지 비활성 (orchestrator_llm/gemini도 미설정=false)
    expect(chain).toEqual(["claude_code"]);
  });

  it("모든 provider 비활성 → 빈 배열", () => {
    const chain = build_fallback_chain("chatgpt", NO_CAPS);
    expect(chain).toEqual([]);
  });

  it("gemini primary → 나머지 사용 가능 provider 반환", () => {
    const chain = build_fallback_chain("gemini", ALL_CAPS);
    expect(chain).toEqual(["chatgpt", "claude_code", "openrouter", "orchestrator_llm"]);
  });
});

describe("ExecutionGateway.resolve", () => {
  beforeEach(() => {
    gw = create_execution_gateway();
  });

  describe("no_token plans", () => {
    it("identity → primary=preference, fallbacks=[]", () => {
      const plan: RequestPlan = { route: "no_token", kind: "identity" };
      const route = gw.resolve(plan, ALL_CAPS, "chatgpt");
      expect(route).toEqual({ primary: "chatgpt", fallbacks: [] });
    });

    it("builtin → primary=preference, fallbacks=[]", () => {
      const plan: RequestPlan = { route: "no_token", kind: "builtin", command: "help" };
      const route = gw.resolve(plan, ALL_CAPS, "claude_code");
      expect(route).toEqual({ primary: "claude_code", fallbacks: [] });
    });

    it("inquiry → primary=preference, fallbacks=[]", () => {
      const plan: RequestPlan = { route: "no_token", kind: "inquiry", summary: "test" };
      const route = gw.resolve(plan, CHATGPT_ONLY, "chatgpt");
      expect(route).toEqual({ primary: "chatgpt", fallbacks: [] });
    });

    it("direct_tool → primary=preference, fallbacks=[]", () => {
      const plan: RequestPlan = { route: "no_token", kind: "direct_tool", plan: { tool_name: "datetime" } };
      const route = gw.resolve(plan, ALL_CAPS, "chatgpt");
      expect(route).toEqual({ primary: "chatgpt", fallbacks: [] });
    });
  });

  describe("model_direct plans", () => {
    it("once plan → primary=plan.executor, fallbacks=chain", () => {
      const plan: RequestPlan = { route: "model_direct", kind: "once", executor: "chatgpt" };
      const route = gw.resolve(plan, ALL_CAPS, "chatgpt");
      expect(route.primary).toBe("chatgpt");
      expect(route.fallbacks).toEqual(["claude_code", "openrouter", "orchestrator_llm", "gemini"]);
    });

    it("once plan executor와 preference가 달라도 plan.executor 우선", () => {
      const plan: RequestPlan = { route: "model_direct", kind: "once", executor: "claude_code" };
      const route = gw.resolve(plan, ALL_CAPS, "chatgpt");
      expect(route.primary).toBe("claude_code");
    });
  });

  describe("agent_required plans", () => {
    it("agent plan → primary=plan.executor, fallbacks=chain", () => {
      const plan: RequestPlan = { route: "agent_required", kind: "agent", executor: "claude_code" };
      const route = gw.resolve(plan, ALL_CAPS, "chatgpt");
      expect(route.primary).toBe("claude_code");
      expect(route.fallbacks).toContain("chatgpt");
    });

    it("task plan → primary=plan.executor", () => {
      const plan: RequestPlan = { route: "agent_required", kind: "task", executor: "chatgpt" };
      const route = gw.resolve(plan, CHATGPT_ONLY, "chatgpt");
      expect(route.primary).toBe("chatgpt");
      expect(route.fallbacks).not.toContain("claude_code");
    });

    it("workflow plan → primary=plan.executor", () => {
      const plan: RequestPlan = { route: "agent_required", kind: "workflow", executor: "openrouter", workflow_id: "wf-1" };
      const route = gw.resolve(plan, ALL_CAPS, "chatgpt");
      expect(route.primary).toBe("openrouter");
    });

    it("caps에서 fallback 제한 반영", () => {
      const plan: RequestPlan = { route: "agent_required", kind: "agent", executor: "claude_code" };
      const route = gw.resolve(plan, NO_CAPS, "chatgpt");
      // claude_code는 NO_CAPS에서 비활성이지만 plan.executor로 지정 → primary는 plan.executor
      expect(route.primary).toBe("claude_code");
      // fallback: 모든 caps 비활성 → 빈 배열
      expect(route.fallbacks).toEqual([]);
    });
  });
});

describe("ExecutionGateway — 통합 시나리오", () => {
  it("to_request_plan → resolve → fallback chain 순회 시뮬레이션", async () => {
    const { to_request_plan } = await import("@src/orchestration/gateway-contracts.js");
    const gw = create_execution_gateway();

    // GatewayDecision → RequestPlan → ExecutionRoute
    const plan = to_request_plan({ action: "execute", mode: "agent", executor: "claude_code" });
    const route = gw.resolve(plan, ALL_CAPS, "chatgpt");

    expect(route.primary).toBe("claude_code");
    expect(route.fallbacks.length).toBeGreaterThan(0);
    expect(route.fallbacks[0]).toBe("chatgpt");
  });

  it("direct_tool decision → plan → no fallback needed", async () => {
    const { to_request_plan } = await import("@src/orchestration/gateway-contracts.js");
    const gw = create_execution_gateway();

    const plan = to_request_plan({ action: "direct_tool", tool_name: "datetime" });
    const route = gw.resolve(plan, ALL_CAPS, "chatgpt");

    expect(route.primary).toBe("chatgpt");
    expect(route.fallbacks).toEqual([]);
  });
});
