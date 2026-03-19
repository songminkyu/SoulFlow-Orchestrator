/**
 * ToolChoiceToggle: Auto / Manual / None 3단계 토글 버튼 그룹.
 * ToolChoiceMode 타입을 사용하며, i18n 키로 라벨 표시.
 * 각 모드에 아이콘 + 설명 텍스트 포함 (A2.1).
 */
import { useT } from "../i18n";
import type { ToolChoiceMode } from "../../../src/contracts";

const MODE_ICONS: Record<ToolChoiceMode, string> = {
  auto: "\u221E",
  manual: "\uD83D\uDCCB",
  none: "\u2715",
};

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
          <span className="tool-choice-toggle__icon">{MODE_ICONS[mode]}</span>
          <span className="tool-choice-toggle__info">
            <span className="tool-choice-toggle__label">{t(`tool_choice.${mode}`)}</span>
            <span className="tool-choice-toggle__desc">{t(`tool_choice.${mode}_desc`)}</span>
          </span>
          {value === mode && <span className="tool-choice-toggle__check" aria-hidden="true">{"\u2713"}</span>}
        </button>
      ))}
    </div>
  );
}
