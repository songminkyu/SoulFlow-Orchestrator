/** 에이전트 AI 생성 공통 hook — agent-panel + agent-modal 중복 제거. */

import { api } from "../api/client";
import type { GeneratedAgentFields } from "../../../src/agent/agent-definition.types";

export type AgentFormFields = {
  name: string;
  description: string;
  icon: string;
  role_skill: string;
  soul: string;
  heart: string;
  tools: string;
  shared_protocols: string[];
  skills: string;
  use_when: string;
  not_use_for: string;
  extra_instructions: string;
  preferred_providers?: string;
  model?: string;
};


/**
 * AI 에이전트 생성 API 호출 + 폼 필드 매핑.
 * 성공 시 GeneratedAgentFields 반환, 실패 시 throw.
 */
export async function generate_agent_fields(
  prompt: string,
  provider_id?: string,
): Promise<GeneratedAgentFields> {
  const body: Record<string, unknown> = { prompt };
  if (provider_id) body.provider_id = provider_id;

  const res = await api.post<{ ok: boolean; data?: GeneratedAgentFields; error?: string }>(
    "/api/agent-definitions/generate",
    body,
  );
  console.debug("[agent-generate] response:", JSON.stringify(res).slice(0, 500));

  if (!res.ok || !res.data) {
    throw new Error(res.error || "generate_failed");
  }
  return res.data;
}

/** GeneratedAgentFields → 폼 상태 업데이트 함수. 기존 값 유지 (falsy면 스킵). */
export function apply_generated_to_form<T extends AgentFormFields>(
  prev: T,
  data: GeneratedAgentFields,
): T {
  return {
    ...prev,
    name: data.name || prev.name,
    description: data.description || prev.description,
    icon: data.icon || prev.icon,
    role_skill: data.role_skill || prev.role_skill,
    soul: data.soul || prev.soul,
    heart: data.heart || prev.heart,
    tools: data.tools?.join(", ") || prev.tools,
    shared_protocols: data.shared_protocols?.length ? data.shared_protocols : prev.shared_protocols,
    skills: data.skills?.join(", ") || prev.skills,
    use_when: data.use_when || prev.use_when,
    not_use_for: data.not_use_for || prev.not_use_for,
    extra_instructions: data.extra_instructions || prev.extra_instructions,
    ...(prev.preferred_providers !== undefined
      ? { preferred_providers: data.preferred_providers?.join(", ") || prev.preferred_providers }
      : {}),
    ...(prev.model !== undefined
      ? { model: data.model || prev.model }
      : {}),
  };
}
