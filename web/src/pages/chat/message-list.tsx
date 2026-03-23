import { forwardRef, memo, useState } from "react";
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
              {/* GW-6: delivery trace + execution route drill-down */}
              {(has_mismatch || (m.execution_route && m.direction === "assistant")) && (
                <DeliveryTraceDrillDown
                  requested_channel={m.requested_channel}
                  delivered_channel={m.delivered_channel}
                  execution_route={m.execution_route}
                  has_mismatch={!!has_mismatch}
                />
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

/** FE-4/GW: 채널 어피니티 + 실행 경로 인터랙티브 drill-down. */
const DeliveryTraceDrillDown = memo(function DeliveryTraceDrillDown({
  requested_channel, delivered_channel, execution_route, has_mismatch,
}: {
  requested_channel?: string; delivered_channel?: string;
  execution_route?: string; has_mismatch: boolean;
}) {
  const t = useT();
  const [expanded, set_expanded] = useState(false);

  return (
    <div className="delivery-trace" style={{ paddingLeft: 12, marginTop: -4, marginBottom: 8 }}>
      <button
        className="delivery-trace__toggle text-xs"
        onClick={() => set_expanded((e) => !e)}
        aria-expanded={expanded}
        style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-xs)", color: has_mismatch ? "var(--warn)" : "var(--muted)" }}
      >
        {has_mismatch ? `⚡ ${requested_channel} → ${delivered_channel}` : `▸ ${execution_route}`}
        {" "}{expanded ? "▾" : "▸"}
      </button>
      {expanded && (
        <div className="delivery-trace__detail" style={{ marginTop: 4, padding: "6px 10px", background: "var(--surface-subtle)", borderRadius: "var(--radius-sm)", fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
          {execution_route && (
            <div><strong>{t("chat.route") || "Route"}:</strong> {execution_route}</div>
          )}
          {requested_channel && (
            <div><strong>{t("chat.requested_channel") || "Requested"}:</strong> {requested_channel}</div>
          )}
          {delivered_channel && (
            <div><strong>{t("chat.delivered_channel") || "Delivered"}:</strong> {delivered_channel}</div>
          )}
          {has_mismatch && (
            <div style={{ color: "var(--warn)", marginTop: 2 }}>
              {t("chat.channel_mismatch") || "Channel mismatch detected"}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
