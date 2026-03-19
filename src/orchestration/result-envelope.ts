/**
 * LF-4: ResultEnvelope / Dashboard Read Model — 결과 전달과 읽기 모델 표준화.
 *
 * direct / model / workflow 결과가 같은 전달 규약을 따르도록 표준화.
 * display model과 storage model을 분리 — 이 파일은 delivery/dashboard 관심사만 포함.
 *
 * 참고: 기존 ResultEnvelope (gateway-contracts.ts)는 orchestration 계층 내부 계약.
 * 이 파일은 dashboard read model — UI 소비용으로 최적화된 변환 계층.
 */

import type { ExecutionMode } from "./types.js";

/* ── Dashboard Read Model ────────────────────────────────────────────────── */

/** 실행 결과 유형 — 사용자에게 보이는 분류. */
export type ResultKind =
  | "direct_reply"   // 즉시 응답 (identity, builtin, inquiry)
  | "model_reply"    // 단일 LLM 호출 결과
  | "agent_reply"    // 에이전트 루프 결과
  | "task_reply"     // Task 완료 결과
  | "workflow_reply" // 워크플로우 완료 결과
  | "error_reply";   // 에러 응답

/** 채널 어피니티 — 요청이 들어온 채널과 응답 채널의 관계. */
export type ChannelAffinity =
  | "same_channel"   // 요청과 동일 채널로 응답
  | "cross_channel"  // 다른 채널로 응답 (예: Slack → Web dashboard)
  | "broadcast";     // 다수 채널에 브로드캐스트

/** dashboard read model — UI 렌더링용 결과 표현. */
export type DashboardResultModel = {
  /** 실행 run ID. */
  run_id: string;
  /** 결과 종류 — UI 분류 기준. */
  kind: ResultKind;
  /** 실행 모드 (내부 기술 분류). */
  mode: ExecutionMode;
  /** 최종 응답 텍스트. null이면 suppress_reply 또는 에러. */
  content: string | null;
  /** 에러 메시지. 성공 시 undefined. */
  error?: string;
  /** 채널 어피니티 — 요청 채널과 응답 채널의 관계. */
  channel_affinity: ChannelAffinity;
  /** 요청 채널 식별자. */
  request_channel: string;
  /** 응답 채널 식별자. */
  reply_channel: string;
  /** 도구 사용 횟수 — 복잡도 지표. */
  tool_calls_count: number;
  /** 스트리밍 방식으로 전달됐는지. */
  streamed: boolean;
  /** 응답 억제 여부 (suppress_reply). */
  suppressed: boolean;
  /** 완료 시간 (ISO 8601). */
  completed_at: string;
  /** 사용된 토큰 수 (선택). */
  total_tokens?: number;
};

/** OrchestrationResult → ResultKind 변환. */
export function to_result_kind(
  mode: ExecutionMode,
  execution_route?: string,
  error?: string,
): ResultKind {
  if (error) return "error_reply";

  // no_token 경로
  const NO_TOKEN = new Set(["identity", "builtin", "inquiry", "direct_tool"]);
  if (execution_route && NO_TOKEN.has(execution_route)) return "direct_reply";

  switch (mode) {
    case "once": return "model_reply";
    case "agent": return "agent_reply";
    case "task": return "task_reply";
    case "phase": return "workflow_reply";
    default: return "model_reply";
  }
}

/** 채널 어피니티 판별. */
export function resolve_channel_affinity(
  request_channel: string,
  reply_channel: string,
): ChannelAffinity {
  if (request_channel === reply_channel) return "same_channel";
  return "cross_channel";
}

/**
 * OrchestrationResult를 DashboardResultModel로 변환.
 *
 * @param result 오케스트레이션 결과
 * @param request_channel 요청이 들어온 채널 식별자
 * @param reply_channel 응답을 보낼 채널 식별자
 * @param run_id 실행 추적 ID
 */
export function to_dashboard_model(
  result: {
    reply: string | null;
    error?: string;
    suppress_reply?: boolean;
    mode: ExecutionMode;
    tool_calls_count: number;
    streamed: boolean;
    execution_route?: string;
    usage?: { total_tokens?: number };
    run_id?: string;
  },
  request_channel: string,
  reply_channel: string,
  run_id: string,
): DashboardResultModel {
  const kind = to_result_kind(result.mode, result.execution_route, result.error);
  const affinity = resolve_channel_affinity(request_channel, reply_channel);

  return {
    run_id: result.run_id ?? run_id,
    kind,
    mode: result.mode,
    content: result.reply,
    error: result.error,
    channel_affinity: affinity,
    request_channel,
    reply_channel,
    tool_calls_count: result.tool_calls_count,
    streamed: result.streamed,
    suppressed: result.suppress_reply ?? false,
    completed_at: new Date().toISOString(),
    total_tokens: result.usage?.total_tokens,
  };
}
