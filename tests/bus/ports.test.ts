/**
 * LF-3: Event Bus Port Split — durable/realtime/coordination 포트 분리 검증.
 */

import { describe, it, expect } from "vitest";
import {
  to_realtime_port,
  type DurableEvent,
  type CoordinationEvent,
} from "@src/bus/ports.js";
import { InMemoryMessageBus } from "@src/bus/service.js";
import type { ProgressEvent } from "@src/bus/types.js";

/* ── to_realtime_port 어댑터 ── */

describe("to_realtime_port — MessageBusLike 어댑터", () => {
  it("RealtimeEventPort 인터페이스 구현 확인", () => {
    const bus = new InMemoryMessageBus();
    const port = to_realtime_port(bus);

    expect(typeof port.publish_progress).toBe("function");
    expect(typeof port.consume_progress).toBe("function");
  });

  it("publish_progress → consume_progress 왕복", async () => {
    const bus = new InMemoryMessageBus();
    const port = to_realtime_port(bus);

    const event: ProgressEvent = {
      task_id: "task-lf3",
      step: 1,
      total_steps: 3,
      description: "LF-3 test step",
      provider: "slack",
      chat_id: "chat-1",
      team_id: "team-1",
      at: new Date().toISOString(),
    };

    await port.publish_progress(event);
    const consumed = await port.consume_progress({ timeout_ms: 100 });

    expect(consumed).not.toBeNull();
    expect(consumed?.task_id).toBe("task-lf3");
    expect(consumed?.description).toBe("LF-3 test step");
  });

  it("이벤트 없을 때 consume_progress → null 반환", async () => {
    const bus = new InMemoryMessageBus();
    const port = to_realtime_port(bus);

    const result = await port.consume_progress({ timeout_ms: 50 });
    expect(result).toBeNull();
  });

  it("bus 닫힘 후 publish_progress → 유실 (closed 상태)", async () => {
    const bus = new InMemoryMessageBus();
    const port = to_realtime_port(bus);
    await bus.close();

    // 닫힌 버스에 publish — 유실 허용 (no throw)
    await expect(port.publish_progress({
      task_id: "t", step: 1, description: "d", provider: "slack", chat_id: "c",
      at: new Date().toISOString(),
    })).resolves.not.toThrow();
  });
});

/* ── DurableEvent 타입 검증 (타입 레벨 — 런타임에선 구조 확인) ── */

describe("DurableEvent 구조", () => {
  it("필수 필드를 가진 DurableEvent 생성 가능", () => {
    const event: DurableEvent = {
      kind: "task.completed",
      at: new Date().toISOString(),
      payload: { task_id: "t1", status: "done" },
    };
    expect(event.kind).toBe("task.completed");
    expect(typeof event.payload).toBe("object");
  });

  it("선택 필드 포함한 DurableEvent 생성 가능", () => {
    const event: DurableEvent = {
      kind: "workflow.started",
      at: new Date().toISOString(),
      payload: { workflow_id: "wf-1" },
      idempotency_key: "wf-1-start",
      team_id: "team-abc",
    };
    expect(event.idempotency_key).toBe("wf-1-start");
    expect(event.team_id).toBe("team-abc");
  });
});

/* ── CoordinationEvent 타입 검증 ── */

describe("CoordinationEvent 구조", () => {
  it("lock_acquire 이벤트 생성 가능", () => {
    const event: CoordinationEvent = {
      kind: "lock_acquire",
      resource_id: "audit.lock",
      holder_id: "proc-1234",
      at: new Date().toISOString(),
      ttl_ms: 60_000,
    };
    expect(event.kind).toBe("lock_acquire");
    expect(event.ttl_ms).toBe(60_000);
  });

  it("heartbeat 이벤트 생성 가능", () => {
    const event: CoordinationEvent = {
      kind: "heartbeat",
      resource_id: "main",
      holder_id: "svc-1",
      at: new Date().toISOString(),
    };
    expect(event.kind).toBe("heartbeat");
    expect(event.ttl_ms).toBeUndefined();
  });
});
