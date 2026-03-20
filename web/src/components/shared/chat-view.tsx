/**
 * SharedChatView — Layer 3: PromptBar + ResponseView + 메시지 히스토리 조합.
 * 자동 스크롤, 스트리밍 메시지, 빈 상태 지원.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { ResponseView } from "./response-view";
import type { ResponseMessage } from "./response-view";
import { SharedPromptBar } from "./prompt-bar";
import type { SharedPromptBarProps } from "./prompt-bar";

export type { ResponseMessage };

export interface ChatViewMessage extends ResponseMessage {
  id: string;
}

export interface SharedChatViewProps {
  /** 메시지 히스토리 */
  messages: ChatViewMessage[];
  /** 현재 스트리밍 메시지 (있으면 마지막에 추가) */
  streamingMessage?: ResponseMessage;
  /** PromptBar props 전달 */
  promptBarProps: SharedPromptBarProps;
  /** 빈 상태 표시 여부 */
  showEmpty?: boolean;
  /** 자동 스크롤 (기본 true) */
  autoScroll?: boolean;
  className?: string;
}

export function SharedChatView({
  messages,
  streamingMessage,
  promptBarProps,
  showEmpty = true,
  autoScroll = true,
  className,
}: SharedChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  const is_empty = messages.length === 0 && !streamingMessage;

  // 사용자 스크롤 감지
  const handle_scroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const near_bottom = scrollHeight - scrollTop - clientHeight < 80;
    setUserScrolled(!near_bottom);
  }, []);

  // 자동 스크롤 (메시지 비워질 때 userScrolled 초기화 포함)
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    const prevLen = prevLengthRef.current;
    prevLengthRef.current = messages.length;
    // 메시지가 0으로 리셋되면 스크롤 잠금 해제 (next render에 반영)
    if (messages.length === 0 && prevLen > 0) {
      setUserScrolled(false);
      return;
    }
    if (!autoScroll || userScrolled) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage, autoScroll, userScrolled]);

  return (
    <div
      className={[
        "shared-chat-view",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* 메시지 히스토리 스크롤 영역 */}
      <div
        ref={scrollContainerRef}
        className="shared-chat-view__messages"
        onScroll={handle_scroll}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--content-padding, 16px)",
          maxWidth: "var(--msg-max-width, 800px)",
          margin: "0 auto",
          width: "100%",
        }}
        aria-live="polite"
        aria-atomic="false"
      >
        {/* 빈 상태 */}
        {is_empty && showEmpty && (
          <div className="shared-chat-view__empty" data-testid="chat-empty-state">
            {/* greeting + suggestions는 PromptBar에서 처리 */}
          </div>
        )}

        {/* 히스토리 메시지 */}
        {messages.map(({ id, ...msg }) => (
          <ResponseView
            key={id}
            message={msg}
            className="shared-chat-view__message"
          />
        ))}

        {/* 스트리밍 메시지 */}
        {streamingMessage && (
          <ResponseView
            message={streamingMessage}
            className="shared-chat-view__message shared-chat-view__message--streaming"
          />
        )}

        {/* 자동 스크롤 앵커 */}
        <div ref={messagesEndRef} />
      </div>

      {/* 프롬프트바 */}
      <div
        className="shared-chat-view__prompt"
        style={{
          padding: "0 var(--content-padding, 16px) var(--content-padding, 16px)",
          flexShrink: 0,
        }}
      >
        <SharedPromptBar
          {...promptBarProps}
          // 빈 상태 greeting + suggestions는 prompt bar에서 렌더링
          greeting={is_empty && showEmpty ? promptBarProps.greeting : undefined}
          suggestions={is_empty && showEmpty ? promptBarProps.suggestions : undefined}
        />
      </div>
    </div>
  );
}
