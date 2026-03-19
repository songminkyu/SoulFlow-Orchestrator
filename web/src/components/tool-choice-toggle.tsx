/**
 * ToolChoiceToggle: Auto / Manual / None 3단계 토글 버튼 그룹.
 * ToolChoiceMode 타입을 사용하며, i18n 키로 라벨 표시.
 */
import { useT } from "../i18n";
import type { ToolChoiceMode } from "../../../src/contracts";

const MODES: ToolChoiceMode[] = ["auto", "manual", "none"];

export interface ToolChoiceToggleProps {
  value: ToolChoiceMode;
  onChange: (mode: ToolChoiceMode) => void;
  disabled?: boolean;
  className?: string;
}

export function ToolChoiceToggle({ value, onChange, disabled, className }: ToolChoiceToggleProps) {
  const t = useT();

  return (
    <div
      className={`tool-choice-toggle${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label={t("tool_choice.auto")}
    >
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          className={`tool-choice-toggle__btn${value === mode ? " tool-choice-toggle__btn--active" : ""}`}
          onClick={() => onChange(mode)}
          disabled={disabled}
        >
          {t(`tool_choice.${mode}`)}
        </button>
      ))}
    </div>
  );
}
