/**
 * TypingRenderer — SSE 토큰 단위 타이핑 애니메이션.
 * text prop이 늘어날 때마다 새 텍스트만 DOM에 append (전체 리렌더 방지).
 * streaming=true 일 때 블링킹 커서 표시, false 전환 시 커서 fade out.
 */

import { useRef, useEffect } from "react";

export interface TypingRendererProps {
  /** 현재까지 누적된 텍스트 (SSE로 점진 추가) */
  text: string;
  /** 스트리밍 진행 중 여부 */
  streaming: boolean;
  /** 추가 CSS 클래스 */
  className?: string;
}

export function TypingRenderer({ text, streaming, className }: TypingRendererProps) {
  const text_ref = useRef<HTMLSpanElement>(null);
  const prev_text_ref = useRef<string>("");

  useEffect(() => {
    const el = text_ref.current;
    if (!el) return;

    const prev = prev_text_ref.current;

    // 전체 리렌더 없이 새로 추가된 텍스트만 DOM에 append
    if (text.startsWith(prev)) {
      const appended = text.slice(prev.length);
      if (appended) {
        el.appendChild(document.createTextNode(appended));
      }
    } else {
      // 텍스트가 완전히 바뀐 경우 (예: 리셋) — 전체 교체
      el.textContent = text;
    }

    prev_text_ref.current = text;
  }, [text]);

  return (
    <span className={`typing-renderer${className ? ` ${className}` : ""}`}>
      <span className="typing-renderer__text" ref={text_ref} />
      <span
        className={`typing-renderer__cursor${streaming ? " typing-renderer__cursor--active" : ""}`}
        aria-hidden="true"
      />
    </span>
  );
}
