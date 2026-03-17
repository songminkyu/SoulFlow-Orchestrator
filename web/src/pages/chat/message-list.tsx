import { forwardRef } from "react";
import { EmptyState } from "../../components/empty-state";
import { useT } from "../../i18n";
import { ChatMessageBubble } from "./message-bubble";
import { ToolCallList } from "./tool-call-block";
import { ApprovalBanner } from "../../components/approval-banner";
import type { PendingApproval } from "../../components/approval-banner";
import type { ToolCallEntry, ThinkingEntry } from "../../hooks/use-ndjson-stream";
import type { ChatMessage } from "./types";

interface MessageListProps {
  messages: ChatMessage[];
  sending: boolean;
  last_is_user: boolean;
  is_streaming: boolean;
  tool_calls?: ToolCallEntry[];
  thinking_blocks?: ThinkingEntry[];
  pending_approvals: PendingApproval[];
  onResolveApproval: (id: string, text: string) => void;
}

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(function MessageList(props, ref) {
  const t = useT();
  const last_idx = props.messages.length - 1;

  return (
    <div className="chat-messages" ref={ref}>
      <div className="chat-messages__inner">
        {!props.messages.length && !props.pending_approvals.length && (
          <EmptyState icon="💬" title={t("chat.no_messages")} />
        )}

        {props.messages.map((m, i) => {
          const is_streaming_bubble = props.is_streaming && i === last_idx && m.direction === "assistant";
          const has_mismatch = m.requested_channel && m.delivered_channel && m.requested_channel !== m.delivered_channel;
          return (
            <div key={`${m.at}-${m.direction}-${i}`}>
              <ChatMessageBubble
                message={m}
                streaming={is_streaming_bubble}
                thinking_blocks={is_streaming_bubble ? props.thinking_blocks : undefined}
              />
              {/* GW-6: delivery trace — 채널 불일치 표시 */}
              {has_mismatch && (
                <div className="text-xs text-muted" style={{ paddingLeft: 12, marginTop: -4, marginBottom: 8 }}>
                  {m.requested_channel} → {m.delivered_channel}
                </div>
              )}
              {/* GW-6: execution route 표시 */}
              {m.execution_route && m.direction === "assistant" && (
                <div className="text-xs text-muted" style={{ paddingLeft: 12, marginTop: -4, marginBottom: 8 }}>
                  route: {m.execution_route}
                </div>
              )}
            </div>
          );
        })}

        {/* 스트리밍 중 도구 호출 블록 — 마지막 버블 아래 */}
        {props.is_streaming && props.tool_calls && props.tool_calls.length > 0 && (
          <ToolCallList calls={props.tool_calls} />
        )}

        {props.pending_approvals.map((ap) => (
          <ApprovalBanner
            key={ap.request_id}
            approval={ap}
            onResolve={(text) => props.onResolveApproval(ap.request_id, text)}
          />
        ))}
      </div>
    </div>
  );
});
