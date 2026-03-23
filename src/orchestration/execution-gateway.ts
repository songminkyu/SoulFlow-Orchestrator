/**
 * GW-3: ExecutionGateway — provider/executor 결정 + fallback chain.
 *
 * provider 결정 책임을 gateway로 집중.
 * orchestration이 provider decision 세부를 직접 소유하지 않음.
 * provider invocation 자체는 dispatcher가 담당 (경계 유지).
 */

import type { RequestPlan } from "./gateway-contracts.js";
import type { ExecutorProvider, ProviderCapabilities } from "../providers/executor.js";
import { resolve_executor_provider } from "../providers/executor.js";

/** gateway가 결정한 실행 경로. primary executor + 대체 fallback 목록. */
export type ExecutionRoute = {
  primary: ExecutorProvider;
  fallbacks: ExecutorProvider[];
};

/** provider/executor 결정을 소유하는 gateway 계약. */
export type ExecutionGatewayLike = {
  resolve(plan: RequestPlan, caps: ProviderCapabilities, preference: ExecutorProvider): ExecutionRoute;
};

/** capability 확인 매핑. orchestrator_llm은 항상 사용 가능하므로 제외. */
const CAPABILITY_CHECK: Partial<Record<string, keyof ProviderCapabilities>> = {
  chatgpt: "chatgpt_available",
  claude_code: "claude_available",
  openrouter: "openrouter_available",
};

/** caps에서 해당 executor가 사용 가능한지 판별. */
function is_available(executor: ExecutorProvider, caps: ProviderCapabilities): boolean {
  const key = CAPABILITY_CHECK[executor];
  if (!key) return true; // orchestrator_llm, gemini 등 → 항상 사용 가능
  return !!caps[key];
}

/** 프로바이더 priority 정보. provider store에서 주입. */
export type ProviderPriority = { provider_type: string; priority: number };

const DEFAULT_ORDER: ExecutorProvider[] = ["chatgpt", "claude_code", "openrouter", "orchestrator_llm"];

/** priority 기반 정렬. priority가 없으면 DEFAULT_ORDER 순서 사용. */
function sort_by_priority(
  executors: ExecutorProvider[],
  priorities?: ProviderPriority[],
): ExecutorProvider[] {
  if (!priorities || priorities.length === 0) return executors;
  const pmap = new Map(priorities.map((p) => [p.provider_type, p.priority]));
  return [...executors].sort((a, b) => {
    const pa = pmap.get(a) ?? pmap.get(EXECUTOR_TO_PROVIDER_TYPE[a] ?? "") ?? 999;
    const pb = pmap.get(b) ?? pmap.get(EXECUTOR_TO_PROVIDER_TYPE[b] ?? "") ?? 999;
    return pa - pb;
  });
}

/** executor 이름 → provider_type 매핑 (store의 provider_type과 일치시키기 위함). */
const EXECUTOR_TO_PROVIDER_TYPE: Record<string, string> = {
  chatgpt: "codex_appserver",
  claude_code: "claude_sdk",
  openrouter: "openrouter",
  orchestrator_llm: "orchestrator_llm",
  gemini: "gemini_cli",
};

/** primary를 제외하고 사용 가능한 executor를 priority 순으로 반환. */
export function build_fallback_chain(
  primary: ExecutorProvider,
  caps: ProviderCapabilities,
  priorities?: ProviderPriority[],
): ExecutorProvider[] {
  const ordered = sort_by_priority(DEFAULT_ORDER, priorities);
  const chain: ExecutorProvider[] = [];
  for (const candidate of ordered) {
    if (candidate === primary) continue;
    if (is_available(candidate, caps)) chain.push(candidate);
  }
  return chain;
}

/** ExecutionGateway 팩토리. priorities: provider store에서 읽은 priority 목록. */
export function create_execution_gateway(priorities?: ProviderPriority[]): ExecutionGatewayLike {
  return {
    resolve(plan, caps, preference) {
      // no_token (identity/builtin/inquiry/direct_tool) → LLM executor 불필요.
      if (plan.route === "no_token") {
        return { primary: preference, fallbacks: [] };
      }

      // priority 기반 primary 결정: preference가 명시적이면 그대로 사용,
      // 아니면 priority가 가장 높은(숫자 낮은) 사용 가능한 executor 선택.
      let primary: ExecutorProvider;
      if ("executor" in plan) {
        primary = plan.executor;
      } else if (priorities && priorities.length > 0) {
        const ordered = sort_by_priority(DEFAULT_ORDER, priorities);
        primary = ordered.find((e) => is_available(e, caps)) ?? resolve_executor_provider(preference, caps);
      } else {
        primary = resolve_executor_provider(preference, caps);
      }

      const fallbacks = build_fallback_chain(primary, caps, priorities);
      return { primary, fallbacks };
    },
  };
}
