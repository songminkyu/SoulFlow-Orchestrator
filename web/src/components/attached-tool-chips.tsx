/**
 * AttachedToolChips: 선택된 도구/워크플로우를 칩으로 표시.
 * 이름 + 설명 + X 삭제 버튼. 빈 상태 시 렌더링 안 함.
 */
import type { MentionItem } from "./mention-picker";

export interface AttachedToolChipsProps {
  items: MentionItem[];
  onRemove: (id: string) => void;
  className?: string;
}

export function AttachedToolChips({ items, onRemove, className }: AttachedToolChipsProps) {
  if (items.length === 0) return null;

  return (
    <div className={`attached-tool-chips${className ? ` ${className}` : ""}`}>
      {items.map((item) => (
        <span key={item.id} className="attached-tool-chips__chip">
          <span className="attached-tool-chips__name">{item.name}</span>
          {item.description && (
            <span className="attached-tool-chips__desc">{item.description}</span>
          )}
          <button
            type="button"
            className="attached-tool-chips__remove"
            onClick={() => onRemove(item.id)}
            aria-label={`Remove ${item.name}`}
          >
            &times;
          </button>
        </span>
      ))}
    </div>
  );
}
