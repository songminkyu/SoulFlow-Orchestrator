import { forwardRef, memo, useState, useRef, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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

/** 가상화 적용 임계값. 이 수 미만이면 전체 렌더링 (오버헤드 회피). */
const VIRTUALIZE_THRESHOLD = 40;

export const MessageList = forwardRef<HTMLDivElement, MessageListProps>(function MessageList(props, ref) {
  const t = useT();
  const last_idx = props.messages.length - 1;
  const should_virtualize = props.messages.length >= VIRTUALIZE_THRESHOLD;

  // 가상화 비활성 시 기존 렌더링 (40개 미만)
  if (!should_virtualize) {
    return (
      <div className="chat-messages" ref={ref} role="log" aria-live="polite" aria-relevant="additions" aria-label={t("chat.message_log")}>
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
  }

  // 가상화 활성 경로
  return <VirtualizedMessageList {...props} forwardedRef={ref} />;
});

/** 가상 스크롤 MessageList. 40개 이상 메시지에서 활성화. */
function VirtualizedMessageList(
  props: MessageListProps & { forwardedRef: React.ForwardedRef<HTMLDivElement> },
) {
  "use no memo"; // TanStack Virtual's useVirtualizer is incompatible with React Compiler
  const t = useT();
  const last_idx = props.messages.length - 1;
  const localRef = useRef<HTMLDivElement>(null);

  // forwarded ref + local ref 머지
  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      (localRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      const fwd = props.forwardedRef;
      if (typeof fwd === "function") fwd(node);
      else if (fwd) (fwd as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [props.forwardedRef],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- opted out via "use no memo"
  const virtualizer = useVirtualizer({
    count: props.messages.length,
    getScrollElement: () => localRef.current,
    estimateSize: () => 120,
    overscan: 8,
  });

  // 새 메시지 추가 또는 스트리밍 시 마지막 항목으로 auto-scroll
  const prev_count = useRef(props.messages.length);
  useEffect(() => {
    const count = props.messages.length;
    if (count === 0) return;
    const el = localRef.current;
    if (!el) return;
    const near_bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (count > prev_count.current || (props.is_streaming && near_bottom)) {
      virtualizer.scrollToIndex(count - 1, { align: "end" });
    }
    prev_count.current = count;
  }, [props.messages.length, props.is_streaming, virtualizer]);

  const items = virtualizer.getVirtualItems();

  return (
    <div className="chat-messages" ref={setRef} role="log" aria-live="polite" aria-relevant="additions" aria-label={t("chat.message_log")}>
      {/* 가상 컨테이너 — 전체 높이를 확보하여 스크롤바 정확성 유지 */}
      <div
        className="chat-messages__inner"
        style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      >
        {items.map((vRow) => {
          const m = props.messages[vRow.index];
          if (!m) return null;
          const i = vRow.index;
          const is_streaming_bubble = props.is_streaming && i === last_idx && m.direction === "assistant";
          const has_mismatch = m.requested_channel && m.delivered_channel && m.requested_channel !== m.delivered_channel;
          return (
            <div
              key={`${m.at}-${m.direction}-${i}`}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vRow.start}px)`,
              }}
            >
              <ChatMessageBubble
                message={m}
                streaming={is_streaming_bubble}
                thinking_blocks={is_streaming_bubble ? props.thinking_blocks : undefined}
              />
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
      </div>

      {/* 가상 컨테이너 밖: 도구 호출 + 승인 배너 (항상 하단 표시) */}
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
  );
}

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
