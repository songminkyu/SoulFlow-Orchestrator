import { useT } from "../../i18n";

export interface EmptyStateProps {
  onNewSession: () => void;
}

/**
 * 채팅 빈 상태 — samples/ 레퍼런스 기반.
 * greeting + suggestions는 SharedPromptBar가 처리하므로,
 * EmptyState는 그라데이션 배경 + 최소 안내만 표시.
 */
export function EmptyState({ onNewSession }: EmptyStateProps) {
  const t = useT();
  return (
    <div className="chat-empty" onClick={() => void onNewSession()}>
      <h2 className="chat-empty__title">{t("chat.greeting")}</h2>
    </div>
  );
}
