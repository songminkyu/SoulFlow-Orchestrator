/**
 * AiSuggestions: 빈 상태에서 AI 추천 프롬프트 카드 그리드.
 * 각 카드 클릭 시 onSelect(text) 콜백.
 */
import { useT } from "../../i18n";

export interface AiSuggestionsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
  className?: string;
}

export function AiSuggestions({ suggestions, onSelect, className }: AiSuggestionsProps) {
  const t = useT();

  if (suggestions.length === 0) return null;

  return (
    <div
      className={`ai-suggestions${className ? ` ${className}` : ""}`}
      aria-label={t("ai_suggestions.label")}
    >
      {suggestions.map((text, i) => (
        <button
          key={`suggestion-${i}-${text.slice(0, 8)}`}
          type="button"
          className="ai-suggestions__card"
          onClick={() => onSelect(text)}
        >
          <span className="ai-suggestions__text">{text}</span>
          <svg
            className="ai-suggestions__arrow"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      ))}
    </div>
  );
}
