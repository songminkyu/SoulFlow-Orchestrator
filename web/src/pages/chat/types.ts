export interface ChatMediaItem {
  type: string;
  url: string;
  mime?: string;
  name?: string;
}

export interface ChatSessionSummary {
  id: string;
  created_at: string;
  message_count: number;
  name?: string;
}

export interface ChatThinkingBlock {
  tokens: number;
  preview: string;
}

export interface ChatMessage {
  direction: "user" | "assistant";
  content: string;
  at: string;
  media?: ChatMediaItem[];
  model?: string;
  provider_instance_id?: string;
  /** 스트리밍 완료 후에도 유지되는 thinking 블록 (클라이언트 측 보존) */
  thinking_blocks?: ChatThinkingBlock[];
  /** GW-6: delivery trace — 요청 채널 vs 실제 전달 채널. */
  requested_channel?: string;
  delivered_channel?: string;
  /** GW-6: 실행 경로 (direct/model/workflow/agent). */
  execution_route?: string;
}

export interface ChatSession {
  id: string;
  created_at: string;
  messages: ChatMessage[];
}