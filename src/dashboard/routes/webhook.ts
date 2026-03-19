/**
 * Webhook 라우트 — /hooks/wake, /hooks/agent, /hooks/* (수동 저장소).
 * 토큰 인증 + 세션 wake + 직접 에이전트 호출 지원.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { now_iso, short_id } from "../../utils/common.js";
import type { WebhookStore } from "../../services/webhook-store.service.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export type WebhookDeps = {
  webhook_store: WebhookStore;
  /** Bearer 토큰. */
  webhook_secret?: string;
  /** auth가 활성화되어 있는지. true이면 webhook_secret 필수. */
  auth_enabled?: boolean;
  /** 인바운드 메시지 발행. wake/agent에서 사용. */
  publish_inbound: (msg: import("../../bus/types.js").InboundMessage) => Promise<void>;
  json: (res: ServerResponse, status: number, data: unknown) => void;
  read_body: (req: IncomingMessage) => Promise<Record<string, unknown> | null>;
  /** HMAC 서명 검증을 위한 원본 바이트 읽기. 선택적 — 제공 시 HMAC 검증 활성화. */
  read_raw_body?: (req: IncomingMessage) => Promise<Buffer>;
};

/** Authorization 헤더 검증. auth 활성 + secret 미설정 시 거부 (TN-6a: 무인증 차단). */
function verify_token(req: IncomingMessage, secret: string | undefined, auth_enabled?: boolean): boolean {
  if (!secret) return !auth_enabled; // auth 비활성(싱글유저) 시만 허용
  const auth = String(req.headers.authorization || "").trim();
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  // SHA-256 해시 후 timingSafeEqual — 길이/내용 모두 timing leak 방지
  const expected = createHash("sha256").update(secret, "utf8").digest();
  const actual = createHash("sha256").update(token, "utf8").digest();
  return timingSafeEqual(expected, actual);
}

/**
 * HMAC-SHA256 본문 서명 검증.
 * X-Signature-256 또는 X-Hub-Signature-256 헤더 지원 (GitHub 스타일).
 * timing-safe 비교로 타이밍 공격 방지.
 */
function verify_hmac_signature(
  raw_body: Buffer | string,
  secret: string,
  signature_header: string | undefined,
): boolean {
  if (!signature_header) return false;
  const expected_sig = createHmac("sha256", secret).update(raw_body).digest("hex");
  const expected = `sha256=${expected_sig}`;
  // 길이가 다르면 timingSafeEqual 전에 거부 (길이 노출은 허용 — sha256 출력은 고정 길이)
  if (signature_header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature_header), Buffer.from(expected));
}

/**
 * 리플레이 공격 방지: X-Webhook-Timestamp 헤더 검사.
 * 헤더가 없으면 허용(선택적). 5분 초과 시 거부.
 */
function verify_timestamp(req: IncomingMessage): boolean {
  const ts_header = req.headers["x-webhook-timestamp"];
  if (!ts_header) return true; // 헤더 없으면 선택적 — 허용
  const ts = Number(String(ts_header).trim());
  if (!Number.isFinite(ts)) return false;
  const now_sec = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now_sec - ts);
  return diff <= 300; // 5분(300초) 이내만 허용
}

/**
 * /hooks/wake — 기존 세션 wake.
 * POST body: { session_key, message, provider?, chat_id? }
 */
async function handle_wake(deps: WebhookDeps, req: IncomingMessage, res: ServerResponse, pre_body?: Record<string, unknown> | null): Promise<void> {
  if (req.method !== "POST") {
    deps.json(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const body = pre_body !== undefined ? pre_body : await deps.read_body(req);
  const session_key = String(body?.session_key || "").trim();
  const message = String(body?.message || "").trim();
  if (!session_key) {
    deps.json(res, 400, { ok: false, error: "session_key_required" });
    return;
  }

  const provider = String(body?.provider || "webhook").trim();
  const chat_id = String(body?.chat_id || session_key).trim();

  await deps.publish_inbound({
    id: `hook_wake_${short_id(8)}`,
    provider,
    channel: provider,
    sender_id: "webhook",
    chat_id,
    content: message || `[webhook wake: ${session_key}]`,
    at: now_iso(),
    team_id: provider,
    metadata: {
      kind: "webhook_wake",
      session_key,
      source: "webhook",
    },
  });

  deps.json(res, 200, { ok: true, session_key, message_id: `hook_wake_${session_key}` });
}

/**
 * /hooks/agent — 직접 에이전트 호출.
 * POST body: { task, provider?, chat_id?, alias? }
 */
async function handle_agent_hook(deps: WebhookDeps, req: IncomingMessage, res: ServerResponse, pre_body?: Record<string, unknown> | null): Promise<void> {
  if (req.method !== "POST") {
    deps.json(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const body = pre_body !== undefined ? pre_body : await deps.read_body(req);
  const task = String(body?.task || "").trim();
  if (!task) {
    deps.json(res, 400, { ok: false, error: "task_required" });
    return;
  }

  const provider = String(body?.provider || "webhook").trim();
  const chat_id = String(body?.chat_id || `hook_agent_${short_id(8)}`).trim();
  const alias = String(body?.alias || "").trim() || undefined;

  const msg_id = `hook_agent_${short_id(8)}`;
  await deps.publish_inbound({
    id: msg_id,
    provider,
    channel: provider,
    sender_id: "webhook",
    chat_id,
    content: task,
    at: now_iso(),
    team_id: provider,
    metadata: {
      kind: "webhook_agent",
      source: "webhook",
      ...(alias ? { target_alias: alias } : {}),
    },
  });

  deps.json(res, 200, { ok: true, message_id: msg_id, chat_id });
}

/**
 * /hooks/* — 기존 패시브 데이터 저장소.
 * GET/POST/PUT/DELETE → WebhookStore에 페이로드 저장.
 */
async function handle_passive(
  deps: WebhookDeps, req: IncomingMessage, res: ServerResponse, hook_path: string, url: URL,
  pre_body?: Record<string, unknown> | null,
): Promise<void> {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers[k] = v;
  }
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => { query[k] = v; });

  let body: unknown = null;
  if (req.method !== "GET") {
    body = pre_body !== undefined ? pre_body : await deps.read_body(req);
  }

  deps.webhook_store.push(hook_path, {
    method: req.method || "GET",
    headers,
    body,
    query,
    received_at: now_iso(),
  });

  deps.json(res, 200, { ok: true, path: hook_path });
}

/** 메인 webhook 라우트 디스패처. */
export async function dispatch_webhook(
  deps: WebhookDeps, req: IncomingMessage, res: ServerResponse, url: URL,
): Promise<boolean> {
  if (!url.pathname.startsWith("/hooks/")) return false;

  // HMAC 서명 헤더 확인 (GitHub 스타일 X-Signature-256 / X-Hub-Signature-256)
  const sig_header = String(
    req.headers["x-signature-256"] ?? req.headers["x-hub-signature-256"] ?? "",
  ).trim() || undefined;

  let bearer_ok = false;
  let hmac_ok = false;
  // HMAC 경로에서 스트림을 소비한 경우, raw buffer에서 파싱한 body를 재사용
  let pre_body: Record<string, unknown> | null | undefined;

  // Bearer 토큰 인증 시도
  bearer_ok = verify_token(req, deps.webhook_secret, deps.auth_enabled);

  // HMAC 서명 인증 시도 (secret + read_raw_body 모두 있을 때만)
  if (sig_header && deps.webhook_secret && deps.read_raw_body) {
    const raw = await deps.read_raw_body(req);
    hmac_ok = verify_hmac_signature(raw, deps.webhook_secret, sig_header);
    // 스트림이 이미 소비됐으므로 raw buffer에서 JSON 파싱 (Bearer fallback 시에도 필요)
    try {
      pre_body = JSON.parse(raw.toString("utf-8")) as Record<string, unknown>;
    } catch {
      pre_body = null;
    }
  }

  // 둘 중 하나라도 통과해야 함 (OR 로직)
  if (!bearer_ok && !hmac_ok) {
    deps.json(res, 401, { ok: false, error: "unauthorized" });
    return true;
  }

  // 리플레이 공격 방지: 타임스탬프 검증
  if (!verify_timestamp(req)) {
    deps.json(res, 401, { ok: false, error: "replay_detected" });
    return true;
  }

  const sub_path = url.pathname.slice(6); // "/hooks/wake" → "/wake"

  if (sub_path === "/wake") {
    await handle_wake(deps, req, res, pre_body);
    return true;
  }

  if (sub_path === "/agent") {
    await handle_agent_hook(deps, req, res, pre_body);
    return true;
  }

  // 나머지는 패시브 데이터 저장소
  await handle_passive(deps, req, res, sub_path, url, pre_body);
  return true;
}
