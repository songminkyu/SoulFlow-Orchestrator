/**
 * H-1: EventBus payload 런타임 검증.
 * H-2: team_id 존재 검증 (tenant 격리 기반).
 * H-3: correlation_id 존재 검증 (trace 연속성 기반).
 *
 * publish 시점에서 호출하여 잘못된 메시지가 큐에 진입하는 것을 차단한다.
 */
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
  team_id: z.string().optional(),
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
  team_id: z.string().optional(),
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
 * H-2: team_id 미존재 시 경고 로그 (단계적 필수화 대비).
 * H-3: correlation_id 미존재 시 경고 로그.
 */
export function validate_message(direction: "inbound" | "outbound", message: unknown): void {
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
  const msg = result.data;
  if (!msg.team_id) {
    log.warn("message missing team_id — tenant isolation incomplete", {
      direction,
      id: msg.id,
      channel: msg.channel,
    });
  }
  if (!msg.correlation_id) {
    log.warn("message missing correlation_id — trace continuity broken", {
      direction,
      id: msg.id,
    });
  }
}

/** ProgressEvent payload 검증. */
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
}
