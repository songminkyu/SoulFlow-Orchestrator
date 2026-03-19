/**
 * H-1: EventBus payload 런타임 검증.
 * H-2: team_id 미존재 시 BusValidationError throw (tenant 격리 강제화).
 * H-3: correlation_id 미존재 시 crypto.randomUUID()로 자동 생성 (trace 연속성 보장).
 *
 * publish 시점에서 호출하여 잘못된 메시지가 큐에 진입하는 것을 차단한다.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { create_logger } from "../logger.js";

const log = create_logger("bus-validation");

/* ── 상수 ── */

/** payload 최대 바이트 (256 KB). content + metadata 합산. */
export const MAX_PAYLOAD_BYTES = 256 * 1024;
/** media 배열 최대 항목 수. */
const MAX_MEDIA_ITEMS = 20;

/* ── 스키마 ── */

const MediaItemSchema = z.object({
  type: z.enum(["image", "video", "audio", "file", "link"]),
  url: z.string().min(1),
  mime: z.string().optional(),
  name: z.string().optional(),
  size: z.number().nonnegative().optional(),
});

export const MessageSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  instance_id: z.string().optional(),
  channel: z.string().min(1),
  sender_id: z.string().min(1),
  chat_id: z.string().min(1),
  content: z.string().refine(
    (s) => Buffer.byteLength(s, "utf-8") <= MAX_PAYLOAD_BYTES,
    { message: `content exceeds ${MAX_PAYLOAD_BYTES} bytes` },
  ),
  at: z.string().min(1),
  reply_to: z.string().optional(),
  thread_id: z.string().optional(),
  media: z.array(MediaItemSchema).max(MAX_MEDIA_ITEMS).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  team_id: z.string().min(1),
  correlation_id: z.string().optional(),
});

export const ProgressEventSchema = z.object({
  task_id: z.string().min(1),
  step: z.number(),
  total_steps: z.number().nonnegative().optional(),
  description: z.string().refine(
    (s) => Buffer.byteLength(s, "utf-8") <= MAX_PAYLOAD_BYTES,
    { message: `description exceeds ${MAX_PAYLOAD_BYTES} bytes` },
  ),
  provider: z.string().min(1),
  chat_id: z.string().min(1),
  at: z.string().min(1),
  team_id: z.string().min(1),
  correlation_id: z.string().optional(),
});

/* ── 검증 함수 ── */

export class BusValidationError extends Error {
  constructor(
    public readonly direction: string,
    public readonly issues: z.ZodIssue[],
  ) {
    super(`bus validation failed (${direction}): ${issues.map((i) => i.message).join("; ")}`);
    this.name = "BusValidationError";
  }
}

/**
 * Message payload 검증. 실패 시 BusValidationError throw.
 * H-2: team_id 미존재 시 BusValidationError throw (tenant 격리 강제화).
 * H-3: correlation_id 미존재 시 crypto.randomUUID()로 자동 생성.
 *
 * 반환값: 정규화된 메시지 (correlation_id 자동 주입).
 */
export function validate_message(
  direction: "inbound" | "outbound",
  message: unknown,
): asserts message is { correlation_id: string } {
  const result = MessageSchema.safeParse(message);
  if (!result.success) {
    throw new BusValidationError(direction, result.error.issues);
  }
  // H-1: 전체 payload 바이트 상한 (content + metadata + media 합산)
  const payload_bytes = Buffer.byteLength(JSON.stringify(message), "utf-8");
  if (payload_bytes > MAX_PAYLOAD_BYTES) {
    throw new BusValidationError(direction, [{
      code: "custom" as const,
      message: `total payload exceeds ${MAX_PAYLOAD_BYTES} bytes (actual: ${payload_bytes})`,
      path: [],
    }]);
  }
  // H-3: correlation_id 미존재 시 자동 생성하여 메시지에 주입
  const msg = message as Record<string, unknown>;
  if (!result.data.correlation_id) {
    msg["correlation_id"] = randomUUID();
    log.debug("correlation_id auto-generated", { direction, id: result.data.id });
  }
}

/**
 * ProgressEvent payload 검증.
 * H-2: team_id 미존재 시 BusValidationError throw.
 * H-3: correlation_id 미존재 시 자동 생성 (task_id 기반 연결 추적 가능).
 */
export function validate_progress(event: unknown): void {
  const result = ProgressEventSchema.safeParse(event);
  if (!result.success) {
    throw new BusValidationError("progress", result.error.issues);
  }
  const payload_bytes = Buffer.byteLength(JSON.stringify(event), "utf-8");
  if (payload_bytes > MAX_PAYLOAD_BYTES) {
    throw new BusValidationError("progress", [{
      code: "custom" as const,
      message: `total payload exceeds ${MAX_PAYLOAD_BYTES} bytes (actual: ${payload_bytes})`,
      path: [],
    }]);
  }
  // H-3: correlation_id 미존재 시 자동 생성
  const ev = event as Record<string, unknown>;
  if (!result.data.correlation_id) {
    ev["correlation_id"] = randomUUID();
    log.debug("progress correlation_id auto-generated", { task_id: result.data.task_id });
  }
}
