/**
 * LF-3: Event Bus Port Split — durable / realtime / coordination 분리.
 *
 * 구현 저장소는 하나(InMemoryMessageBus / RedisMessageBus)지만 개념적 포트를 분리.
 *   - DurableEventPort: 내구성 있는 이벤트 (workflow, task lifecycle)
 *   - RealtimeEventPort: 즉시 전달 이벤트 (SSE, 스트리밍, progress)
 *   - CoordinationEventPort: 상호 배제, 락, 복구 신호
 *
 * 컨슈머는 필요한 포트만 주입받아 경계를 명확히 유지.
 */

import type { ProgressEvent } from "./types.js";

/* ── Durable Event Port ──────────────────────────────────────────────────── */

/** 내구성 이벤트 페이로드 — 재처리 가능하도록 재현 정보를 포함. */
export type DurableEvent = {
  /** 이벤트 유형 식별자. */
  kind: string;
  /** 이벤트 발행 시간 (ISO 8601). */
  at: string;
  /** 이벤트 페이로드. */
  payload: Record<string, unknown>;
  /** 멱등 키 — 동일 이벤트 중복 처리 방지. */
  idempotency_key?: string;
  /** 팀 ID (멀티테넌트). */
  team_id?: string;
};

/**
 * DurableEventPort — 내구성 이벤트 게시/소비.
 *
 * 대상: workflow 라이프사이클, task 완료, kanban 자동화 트리거.
 * 특성: 최소 1회 전달 보장, 재시도 지원.
 */
export interface DurableEventPort {
  /** 내구성 이벤트 게시. */
  publish(event: DurableEvent): Promise<void>;
  /** 내구성 이벤트 소비 (없으면 null). */
  consume(options?: { timeout_ms?: number }): Promise<DurableEvent | null>;
}

/* ── Realtime Event Port ─────────────────────────────────────────────────── */

/**
 * RealtimeEventPort — 즉시 전달 이벤트 게시.
 *
 * 대상: SSE progress, 스트리밍 청크, 에이전트 이벤트.
 * 특성: 낮은 지연 우선, 유실 허용 (이미 전달된 스트림 청크는 재생 불필요).
 */
export interface RealtimeEventPort {
  /** 진행 이벤트 게시 (SSE relay 대상). */
  publish_progress(event: ProgressEvent): Promise<void>;
  /** 진행 이벤트 소비. */
  consume_progress(options?: { timeout_ms?: number }): Promise<ProgressEvent | null>;
}

/* ── Coordination Event Port ─────────────────────────────────────────────── */

/** 협조 신호 유형. */
export type CoordinationSignalKind =
  | "lock_acquire"    // 락 획득 요청
  | "lock_release"    // 락 해제 신호
  | "recovery_check"  // 복구 상태 확인
  | "heartbeat";      // 생존 신호

/** 협조 이벤트 — 분산 락, 복구 등 상호 배제 목적. */
export type CoordinationEvent = {
  kind: CoordinationSignalKind;
  resource_id: string;
  holder_id: string;
  at: string;
  ttl_ms?: number;
};

/**
 * CoordinationEventPort — 분산 락 및 복구 협조.
 *
 * 대상: process lock, audit lock, worktree isolation 신호.
 * 특성: 강한 순서 보장, 타임아웃 필수.
 */
export interface CoordinationEventPort {
  /** 협조 이벤트 게시. */
  signal(event: CoordinationEvent): Promise<void>;
  /** 협조 이벤트 소비. */
  receive(options?: { timeout_ms?: number }): Promise<CoordinationEvent | null>;
}

/* ── 통합 포트 선언 ───────────────────────────────────────────────────────── */

/**
 * EventBusPorts — 3분화된 relay model.
 *
 * 컨슈머가 필요한 포트만 주입받을 수 있도록 개별 포트로 분리.
 * 단일 MessageBusRuntime이 이 세 포트를 모두 구현할 수 있음 (어댑터 패턴).
 */
export type EventBusPorts = {
  durable: DurableEventPort;
  realtime: RealtimeEventPort;
  coordination: CoordinationEventPort;
};

/* ── 어댑터: MessageBusRuntime → RealtimeEventPort ───────────────────────── */

import type { MessageBusLike } from "./types.js";

/**
 * MessageBusLike를 RealtimeEventPort로 래핑.
 * 기존 InMemoryMessageBus / RedisMessageBus를 수정 없이 포트로 노출.
 */
export function to_realtime_port(bus: MessageBusLike): RealtimeEventPort {
  return {
    publish_progress: (event) => bus.publish_progress(event),
    consume_progress: (options) => bus.consume_progress(options),
  };
}

/* ─── FC-3: Cloud Adapter 계약 ─── */

/**
 * FC-3 cloud adapter 계약은 LF-3에서 정의한 DurableEvent/RealtimeEvent 타입을 재사용.
 * 중복 정의 없이 cloud 환경에서 필요한 저장소/릴레이 인터페이스만 추가.
 */

/** DurableEventStoreLike — 내구성 이벤트 저장소 포트. */
export interface DurableEventStoreLike {
  append(event: DurableEvent & { id: string; correlation_id?: string }): Promise<string>;
  consume_batch(cursor: string | null, limit: number): Promise<[DurableEvent[], string | null]>;
  ack(event_id: string, consumer_id: string): Promise<void>;
  query_by_kind(kind: string, limit: number): Promise<DurableEvent[]>;
  sweep(older_than_ms: number): Promise<number>;
}

/** RealtimeEvent 구독자 콜백. */
export type RealtimeEventSubscriber = (event: { kind: string; payload: Record<string, unknown>; channel: string; team_id: string }) => void | Promise<void>;

/** RealtimeEventRelayLike — 실시간 이벤트 브로드캐스트 포트. */
export interface RealtimeEventRelayLike {
  publish(event: { kind: string; payload: Record<string, unknown>; channel: string; team_id: string }): Promise<void>;
  subscribe(team_id: string, channel: string | null, subscriber: RealtimeEventSubscriber): () => void;
  close(): Promise<void>;
}

/** CloudCoordinationAdapterHint — cloud CoordinationStore 추가 계약. */
export interface CloudCoordinationAdapterHint {
  heartbeat(key: string, owner: string, extend_ms: number): Promise<boolean>;
  list_global(): Promise<import("./coordination-store.js").CoordinationEntry[]>;
}
