/**
 * H-1: EventBus payload 런타임 검증 테스트.
 * H-2: team_id 존재 검증.
 * H-3: correlation_id 존재 검증.
 */
import { describe, it, expect } from "vitest";
import {
  validate_message,
  validate_progress,
  BusValidationError,
  MAX_PAYLOAD_BYTES,
} from "../../src/bus/validation.js";

const TS = "2024-01-01T00:00:00Z";

const valid_message = (overrides?: Record<string, unknown>) => ({
  id: "m1",
  provider: "test",
  channel: "general",
  sender_id: "u1",
  chat_id: "c1",
  content: "hello",
  at: TS,
  team_id: "team-1",
  correlation_id: "trace-abc",
  ...overrides,
});

const valid_progress = (overrides?: Record<string, unknown>) => ({
  task_id: "t1",
  step: 1,
  description: "working",
  provider: "test",
  chat_id: "c1",
  at: TS,
  team_id: "team-1",
  ...overrides,
});

describe("validate_message", () => {
  it("유효한 메시지 — 통과", () => {
    expect(() => validate_message("inbound", valid_message())).not.toThrow();
  });

  it("H-1: content가 MAX_PAYLOAD_BYTES 초과 시 거부", () => {
    const huge = "x".repeat(MAX_PAYLOAD_BYTES + 1);
    expect(() => validate_message("inbound", valid_message({ content: huge }))).toThrow(BusValidationError);
  });

  it("H-1: 빈 id 거부", () => {
    expect(() => validate_message("inbound", valid_message({ id: "" }))).toThrow(BusValidationError);
  });

  it("H-1: 빈 channel 거부", () => {
    expect(() => validate_message("inbound", valid_message({ channel: "" }))).toThrow(BusValidationError);
  });

  it("H-1: 빈 at 거부", () => {
    expect(() => validate_message("inbound", valid_message({ at: "" }))).toThrow(BusValidationError);
  });

  it("H-1: media 배열 항목 수 제한 (20)", () => {
    const media = Array.from({ length: 21 }, (_, i) => ({
      type: "image" as const,
      url: `https://example.com/${i}.png`,
    }));
    expect(() => validate_message("inbound", valid_message({ media }))).toThrow(BusValidationError);
  });

  it("H-1: metadata 대형 입력으로 전체 payload 초과 시 거부", () => {
    const huge_metadata = { blob: "x".repeat(MAX_PAYLOAD_BYTES) };
    expect(() => validate_message("inbound", valid_message({ metadata: huge_metadata }))).toThrow(BusValidationError);
  });

  it("H-2: team_id 없어도 통과 (경고만)", () => {
    expect(() => validate_message("inbound", valid_message({ team_id: undefined }))).not.toThrow();
  });

  it("H-3: correlation_id 없어도 통과 (경고만)", () => {
    expect(() => validate_message("outbound", valid_message({ correlation_id: undefined }))).not.toThrow();
  });

  it("완전히 잘못된 입력 거부", () => {
    expect(() => validate_message("inbound", { foo: "bar" })).toThrow(BusValidationError);
  });

  it("BusValidationError에 direction과 issues 포함", () => {
    try {
      validate_message("inbound", {});
    } catch (err) {
      expect(err).toBeInstanceOf(BusValidationError);
      const e = err as BusValidationError;
      expect(e.direction).toBe("inbound");
      expect(e.issues.length).toBeGreaterThan(0);
      return;
    }
    expect.unreachable("should have thrown");
  });
});

describe("validate_progress", () => {
  it("유효한 이벤트 — 통과", () => {
    expect(() => validate_progress(valid_progress())).not.toThrow();
  });

  it("H-1: description 크기 초과 시 거부", () => {
    const huge = "y".repeat(MAX_PAYLOAD_BYTES + 1);
    expect(() => validate_progress(valid_progress({ description: huge }))).toThrow(BusValidationError);
  });

  it("필수 필드 누락 시 거부", () => {
    expect(() => validate_progress({})).toThrow(BusValidationError);
  });
});
