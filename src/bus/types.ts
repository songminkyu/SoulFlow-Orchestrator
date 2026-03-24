export type MessageProvider = "slack" | "discord" | "telegram" | "web" | "system" | string;

/* ── Rich Payload (IC-8a / IC-8b) ── */

export type RichEmbed = {
  title?: string;
  description?: string;
  /** Named color or hex string (e.g. "#4a9eff"). */
  color?: "green" | "yellow" | "red" | "blue" | string;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  image_url?: string;
  thumbnail_url?: string;
  footer?: string;
};

/** IC-8b: Interactive button action attached to a RichPayload. */
export type RichAction = {
  /** Unique action identifier, e.g. "approve" | "deny" | custom string. */
  id: string;
  /** Display label shown on the button, e.g. "✅ 승인" | "❌ 거절". */
  label: string;
  /** Visual emphasis. Maps to channel-native styles. */
  style: "primary" | "danger" | "secondary";
  /** Optional key-value metadata forwarded with the callback. */
  payload?: Record<string, string>;
};

export type RichPayload = {
  embeds: RichEmbed[];
  attachments?: Array<{ url: string; name?: string; mime?: string }>;
  /** IC-8b: Optional interactive buttons rendered after embeds. */
  actions?: RichAction[];
};

export type MediaItemType = "image" | "video" | "audio" | "file" | "link";

export type MediaItem = {
  type: MediaItemType;
  url: string;
  mime?: string;
  name?: string;
  size?: number;
};

export type Message = {
  id: string;
  provider: MessageProvider;
  instance_id?: string;
  channel: string;
  sender_id: string;
  chat_id: string;
  content: string;
  at: string;
  reply_to?: string;
  thread_id?: string;
  media?: MediaItem[];
  metadata?: Record<string, unknown>;
  /** H-2: 멀티테넌트 격리 — 메시지가 속한 팀. 필수 (미존재 시 BusValidationError). */
  team_id: string;
  /** H-3: trace 연속성 — publish 시점의 trace_id를 운반. 미존재 시 자동 생성. */
  correlation_id?: string;
};

export type InboundMessage = Message;
export type OutboundMessage = Message & {
  /** IC-8a: 구조화된 리치 메시지 (임베드 + 첨부). 없으면 기존 plain text 동작 유지. */
  rich?: RichPayload;
};

export type ConsumeMessageOptions = {
  timeout_ms?: number;
};

export type ProgressEvent = {
  task_id: string;
  step: number;
  total_steps?: number;
  description: string;
  provider: string;
  chat_id: string;
  at: string;
  /** H-2: 멀티테넌트 격리 — SSE 스코프 브로드캐스트에 사용. 필수. */
  team_id: string;
  /** H-3: trace 연속성 — 미존재 시 자동 생성. */
  correlation_id?: string;
};

export type MessageBusObserver = (direction: "inbound" | "outbound", message: Message) => void;

/* ── 기본 publish/consume 인터페이스 ── */

export interface MessageBusLike {
  publish_inbound(message: InboundMessage): Promise<void>;
  publish_outbound(message: OutboundMessage): Promise<void>;
  consume_inbound(options?: ConsumeMessageOptions): Promise<InboundMessage | null>;
  consume_outbound(options?: ConsumeMessageOptions): Promise<OutboundMessage | null>;
  publish_progress(event: ProgressEvent): Promise<void>;
  consume_progress(options?: ConsumeMessageOptions): Promise<ProgressEvent | null>;
  get_size(direction?: "inbound" | "outbound"): number;
  get_sizes(): { inbound: number; outbound: number; total: number };
  close(): Promise<void>;
  is_closed(): boolean;
}

/* ── observer/tap 포트 (concrete leak 제거) ── */

export interface MessageBusTap {
  on_publish(observer: MessageBusObserver): void;
}

/* ── lease/ack 인터페이스 (Redis Streams 지원) ── */

export interface MessageLease<T> {
  value: T;
  ack(): Promise<void>;
  retry(delay_ms?: number): Promise<void>;
  release(): Promise<void>;
}

export interface ReliableMessageBus extends MessageBusLike {
  consume_inbound_lease(options?: ConsumeMessageOptions): Promise<MessageLease<InboundMessage> | null>;
  consume_outbound_lease(options?: ConsumeMessageOptions): Promise<MessageLease<OutboundMessage> | null>;
  consume_progress_lease(options?: ConsumeMessageOptions): Promise<MessageLease<ProgressEvent> | null>;
}

/* ── 메트릭 ── */

type BusQueueStats = {
  depth: number;
  overflow: number;
};

export type BusMetrics = {
  inbound: BusQueueStats;
  outbound: BusQueueStats;
  progress: BusQueueStats;
  capacity: number;
  /** Redis 전용 — pending count, oldest age 등. */
  pending_count?: number;
  oldest_pending_age_ms?: number;
  consumer_lag?: number;
  /** 옵저버 콜백 에러 누적 카운터. */
  observer_errors?: number;
  /** ACK 실패 누적 카운터. */
  ack_failures?: number;
};

/* ── 런타임 통합 타입 ── */

export type MessageBusRuntime = MessageBusLike & MessageBusTap & {
  readonly kind: "memory" | "redis";
  get_metrics(): BusMetrics;
};
