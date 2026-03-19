import { useT } from "../../i18n";

export function EmptyState({ onNewSession }: { onNewSession: () => void }) {
  const t = useT();
  return (
    <div className="chat-empty">
      <div className="chat-empty__icon" aria-hidden="true">💬</div>
      <h2 className="chat-empty__title">{t("chat.welcome_title")}</h2>
      <p className="chat-empty__subtitle">{t("chat.welcome_subtitle")}</p>
      <button className="btn btn--ok" onClick={() => void onNewSession()}>
        {t("chat.new_session")}
      </button>
    </div>
  );
}
