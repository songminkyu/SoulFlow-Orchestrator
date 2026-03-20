import { useT } from "../../i18n";
import { AiSuggestions } from "../../components/shared/ai-suggestions";

export interface EmptyStateProps {
  onNewSession: () => void;
  /** Optional starter suggestions. Clicking one creates a session and seeds the input. */
  suggestions?: string[];
  onSuggestionSelect?: (text: string) => void;
}

export function EmptyState({ onNewSession, suggestions, onSuggestionSelect }: EmptyStateProps) {
  const t = useT();
  return (
    <div className="chat-empty">
      <div className="chat-empty__icon" aria-hidden="true">💬</div>
      <h2 className="chat-empty__title">{t("chat.welcome_title")}</h2>
      <p className="chat-empty__subtitle">{t("chat.welcome_subtitle")}</p>
      <button className="btn btn--ok" onClick={() => void onNewSession()}>
        {t("chat.new_session")}
      </button>
      {suggestions && suggestions.length > 0 && onSuggestionSelect && (
        <AiSuggestions
          suggestions={suggestions}
          onSelect={onSuggestionSelect}
          className="chat-empty__suggestions"
        />
      )}
    </div>
  );
}
