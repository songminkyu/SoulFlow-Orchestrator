/**
 * ToolChoiceToggle (shared): Auto / Manual / None 3단계 세그먼트 버튼.
 * 기존 components/tool-choice-toggle.tsx를 shared 레이어로 재노출.
 * - 이 파일은 shared/ 레이어 진입점; 직접 구현 대신 기존 컴포넌트 re-export.
 */
export type { ToolChoiceToggleProps } from "../tool-choice-toggle";
export { ToolChoiceToggle } from "../tool-choice-toggle";

/**
 * ToolChoiceMode 타입을 shared 레이어에서도 쓸 수 있도록 re-export.
 */
export type { ToolChoiceMode } from "../../../../src/contracts";
