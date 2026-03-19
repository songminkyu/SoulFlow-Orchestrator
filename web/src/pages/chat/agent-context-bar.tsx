/**
 * @deprecated FE-2b: 에이전트 선택 기능이 ChatPromptBar의 @mention으로 대체됨.
 * compose_agent_prompt 유틸만 re-export하고, AgentContextBar는 noop 렌더.
 * 기존 import 호환성을 위해 파일 유지.
 */
import type { AgentDefinition } from "../../../../src/agent/agent-definition.types";

/** soul + heart 필드를 결합해 기본 시스템 프롬프트 생성 */
export function compose_agent_prompt(def: AgentDefinition): string {
  return [def.soul, def.heart].filter(Boolean).join("\n\n");
}

interface AgentContextBarProps {
  definitions: AgentDefinition[];
  activeDefinition: AgentDefinition | null;
  systemPrompt: string;
  onDefinitionChange: (def: AgentDefinition | null) => void;
  onSystemPromptChange: (v: string) => void;
}

/**
 * @deprecated FE-2b: ChatPromptBar의 @mention으로 대체.
 * 하위 호환을 위해 유지하지만 UI를 렌더하지 않음.
 */
export function AgentContextBar(_props: AgentContextBarProps) {
  return null;
}
