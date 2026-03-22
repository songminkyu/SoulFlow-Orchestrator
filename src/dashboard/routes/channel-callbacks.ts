/**
 * IC-8b: 외부 채널 버튼 콜백 수신 라우트.
 *
 * - POST /api/channels/discord/interaction — Discord Interaction Endpoint
 * - POST /api/channels/slack/action       — Slack Block Action Endpoint
 *
 * 내부망 배포 전제: 봇과 서버가 같은 네트워크. 외부 터널 불필요.
 */

import { createVerify, createHmac, timingSafeEqual } from "node:crypto";
import { now_iso, short_id } from "../../utils/common.js";
import type { InboundMessage } from "../../bus/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export type ChannelCallbackDeps = {
  publish_inbound: (msg: InboundMessage) => Promise<void>;
  json: (res: ServerResponse, status: number, data: unknown) => void;
  read_body: (req: IncomingMessage) => Promise<Record<string, unknown> | null>;
  read_raw_body?: (req: IncomingMessage) => Promise<Buffer>;
  /** Discord application public key (Ed25519). Hex 문자열. */
  discord_public_key?: string;
  /** Slack signing secret. HMAC-SHA256 검증용. */
  slack_signing_secret?: string;
};

// ═══════════════════════════════════════════════
// Discord Interaction Endpoint
// ═══════════════════════════════════════════════

/**
 * Discord Interaction 핸들러.
 * 1. Ed25519 서명 검증
 * 2. type 1 (PING) → { type: 1 } 응답
 * 3. type 3 (MESSAGE_COMPONENT) → 버튼 콜백 → InboundMessage 발행
 */
async function handle_discord_interaction(
  deps: ChannelCallbackDeps, req: IncomingMessage, res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") { deps.json(res, 405, { error: "method_not_allowed" }); return; }

  // Ed25519 서명 검증
  const signature = String(req.headers["x-signature-ed25519"] || "").trim();
  const timestamp = String(req.headers["x-signature-timestamp"] || "").trim();
  if (!signature || !timestamp) { deps.json(res, 401, { error: "missing_signature" }); return; }

  if (!deps.read_raw_body) { deps.json(res, 500, { error: "raw_body_reader_not_configured" }); return; }
  const raw_body = await deps.read_raw_body(req);

  if (!deps.discord_public_key) { deps.json(res, 503, { error: "discord_public_key_not_configured" }); return; }
  const is_valid = verify_discord_ed25519(deps.discord_public_key, signature, timestamp, raw_body);
  if (!is_valid) { deps.json(res, 401, { error: "invalid_signature" }); return; }

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw_body.toString("utf-8")) as Record<string, unknown>; }
  catch { deps.json(res, 400, { error: "invalid_json" }); return; }

  const interaction_type = Number(body.type || 0);

  // Type 1: PING — Discord 검증용
  if (interaction_type === 1) {
    deps.json(res, 200, { type: 1 });
    return;
  }

  // Type 3: MESSAGE_COMPONENT (버튼 클릭)
  if (interaction_type === 3) {
    const data = (body.data && typeof body.data === "object") ? body.data as Record<string, unknown> : {};
    const custom_id = String(data.custom_id || "");
    const member = (body.member && typeof body.member === "object") ? body.member as Record<string, unknown> : {};
    const user = (member.user && typeof member.user === "object") ? member.user as Record<string, unknown> : {};
    const msg = (body.message && typeof body.message === "object") ? body.message as Record<string, unknown> : {};
    const channel_id = String(body.channel_id || msg.channel_id || "");

    // custom_id 파싱: "action_id" 또는 "action_id:{json}"
    const colon_idx = custom_id.indexOf(":");
    const action_id = colon_idx >= 0 ? custom_id.slice(0, colon_idx) : custom_id;
    let payload: Record<string, string> = {};
    if (colon_idx >= 0) {
      try { payload = JSON.parse(custom_id.slice(colon_idx + 1)) as Record<string, string>; }
      catch { /* 비-JSON 무시 */ }
    }

    await deps.publish_inbound({
      id: `discord_btn_${short_id(8)}`,
      provider: "discord",
      channel: "discord",
      sender_id: String(user.id || "unknown"),
      chat_id: channel_id,
      content: `[button:${action_id}]`,
      at: now_iso(),
      team_id: String(body.guild_id || "discord"),
      metadata: {
        is_button_callback: true,
        button_action_id: action_id,
        button_payload: payload,
        discord_interaction_id: String(body.id || ""),
        discord_message_id: String(msg.id || ""),
      },
    });

    // Discord Interaction Response Type 6: DEFERRED_UPDATE_MESSAGE (버튼 확인, 메시지 수정 안 함)
    deps.json(res, 200, { type: 6 });
    return;
  }

  // 미지원 interaction type
  deps.json(res, 200, { type: 1 });
}

/** Ed25519 서명 검증 (Node.js crypto). */
function verify_discord_ed25519(
  public_key_hex: string, signature_hex: string, timestamp: string, body: Buffer,
): boolean {
  try {
    const key = Buffer.from(public_key_hex, "hex");
    const sig = Buffer.from(signature_hex, "hex");
    const message = Buffer.concat([Buffer.from(timestamp, "utf-8"), body]);
    const verify = createVerify("Ed25519");
    // Node.js Ed25519: DER 인코딩 필요 — raw 32-byte key를 DER로 래핑
    const der_prefix = Buffer.from("302a300506032b6570032100", "hex");
    const der_key = Buffer.concat([der_prefix, key]);
    verify.end(message);
    return verify.verify({ key: der_key, format: "der", type: "spki" }, sig);
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════
// Slack Action Endpoint
// ═══════════════════════════════════════════════

/**
 * Slack Block Action 핸들러.
 * Slack은 action URL로 POST를 보내며, body는 `payload` 필드에 JSON 문자열.
 * 3초 내 200 응답 필수 — 처리는 비동기.
 */
async function handle_slack_action(
  deps: ChannelCallbackDeps, req: IncomingMessage, res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") { deps.json(res, 405, { error: "method_not_allowed" }); return; }
  if (!deps.slack_signing_secret) { deps.json(res, 503, { error: "slack_signing_secret_not_configured" }); return; }

  // Slack 서명 검증: X-Slack-Signature + X-Slack-Request-Timestamp
  if (deps.read_raw_body) {
    const slack_sig = String(req.headers["x-slack-signature"] || "").trim();
    const slack_ts = String(req.headers["x-slack-request-timestamp"] || "").trim();
    if (!slack_sig || !slack_ts) { deps.json(res, 401, { error: "missing_slack_signature" }); return; }
    // 리플레이 방지: 5분 이내
    const ts_sec = Number(slack_ts);
    if (!Number.isFinite(ts_sec) || Math.abs(Math.floor(Date.now() / 1000) - ts_sec) > 300) {
      deps.json(res, 401, { error: "slack_timestamp_expired" }); return;
    }
    const raw = await deps.read_raw_body(req);
    const sig_basestring = `v0:${slack_ts}:${raw.toString("utf-8")}`;
    const expected = "v0=" + createHmac("sha256", deps.slack_signing_secret).update(sig_basestring).digest("hex");
    if (slack_sig.length !== expected.length || !timingSafeEqual(Buffer.from(slack_sig), Buffer.from(expected))) {
      deps.json(res, 401, { error: "invalid_slack_signature" }); return;
    }
    // raw에서 body 파싱
    let parsed: Record<string, unknown> | null;
    try { parsed = JSON.parse(raw.toString("utf-8")) as Record<string, unknown>; }
    catch { parsed = null; }
    const payload_str = typeof parsed?.payload === "string" ? parsed.payload : null;
    const slack_payload = payload_str
      ? (JSON.parse(payload_str) as Record<string, unknown>)
      : parsed;
    if (!slack_payload) { deps.json(res, 400, { error: "invalid_payload" }); return; }
    // 즉시 200 응답 (3초 제한)
    deps.json(res, 200, { ok: true });
    await dispatch_slack_actions(deps, slack_payload);
    return;
  }

  // read_raw_body 미제공 시 fallback (HMAC 불가 — 거부)
  deps.json(res, 500, { error: "raw_body_reader_required_for_slack_verification" });
}

/** Slack action payload에서 버튼 클릭 → InboundMessage 발행. */
async function dispatch_slack_actions(
  deps: ChannelCallbackDeps, slack_payload: Record<string, unknown>,
): Promise<void> {
  const actions = Array.isArray(slack_payload.actions) ? slack_payload.actions as Array<Record<string, unknown>> : [];
  if (actions.length === 0) return;

  const user = (slack_payload.user && typeof slack_payload.user === "object") ? slack_payload.user as Record<string, unknown> : {};
  const channel = (slack_payload.channel && typeof slack_payload.channel === "object") ? slack_payload.channel as Record<string, unknown> : {};
  const msg = (slack_payload.message && typeof slack_payload.message === "object") ? slack_payload.message as Record<string, unknown> : {};

  for (const action of actions.slice(0, 5)) {
    const action_id = String(action.action_id || "");
    const value = String(action.value || "");

    // value 파싱: JSON payload 또는 action_id 그대로
    let payload: Record<string, string> = {};
    try { payload = JSON.parse(value) as Record<string, string>; }
    catch { /* 비-JSON → action_id를 그대로 사용 */ }

    await deps.publish_inbound({
      id: `slack_btn_${short_id(8)}`,
      provider: "slack",
      channel: "slack",
      sender_id: String(user.id || "unknown"),
      chat_id: String(channel.id || ""),
      content: `[button:${action_id}]`,
      at: now_iso(),
      team_id: String(
        ((slack_payload.team && typeof slack_payload.team === "object") ? (slack_payload.team as Record<string, unknown>).id : null)
        || slack_payload.team_id || "slack",
      ),
      metadata: {
        is_button_callback: true,
        button_action_id: action_id,
        button_payload: payload,
        slack_trigger_id: String(slack_payload.trigger_id || ""),
        slack_message_ts: String(msg.ts || ""),
      },
    });
  }
}

// ═══════════════════════════════════════════════
// 라우트 디스패처
// ═══════════════════════════════════════════════

export async function dispatch_channel_callback(
  deps: ChannelCallbackDeps, req: IncomingMessage, res: ServerResponse, path: string,
): Promise<boolean> {
  if (path === "/api/channels/discord/interaction") {
    await handle_discord_interaction(deps, req, res);
    return true;
  }
  if (path === "/api/channels/slack/action") {
    await handle_slack_action(deps, req, res);
    return true;
  }
  return false;
}
