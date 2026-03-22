/**
 * IC-8b: 버튼 콜백 핸들러 테스트.
 * 1. ApprovalService.try_handle_button_callback 로직
 * 2. Telegram callback_query allowed_updates 포함 확인
 * 3. channel-callbacks.ts 라우트 구조 검증
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

function src(rel: string): string {
  return readFileSync(resolve(root, rel), "utf-8");
}

describe("IC-8b: ApprovalService 버튼 콜백", () => {
  const code = src("src/channels/approval.service.ts");

  it("try_handle_button_callback 메서드 존재", () => {
    expect(code).toContain("try_handle_button_callback");
  });

  it("is_button_callback 메타데이터 검사", () => {
    expect(code).toContain("is_button_callback");
  });

  it("button_action_id에서 decision 추출 (approve/deny/defer/cancel)", () => {
    expect(code).toContain("action_id.startsWith(\"approve\")");
    expect(code).toContain("action_id.startsWith(\"deny\")");
  });

  it("source 타입에 button 추가됨", () => {
    expect(code).toContain('"button"');
  });
});

describe("IC-8b: Telegram callback_query 폴링", () => {
  const code = src("src/channels/telegram.channel.ts");

  it("allowed_updates에 callback_query 포함", () => {
    expect(code).toContain('"callback_query"');
  });

  it("to_callback_query_message 메서드 존재", () => {
    expect(code).toContain("to_callback_query_message");
  });

  it("answerCallbackQuery API 호출", () => {
    expect(code).toContain("answerCallbackQuery");
  });

  it("callback_data 파싱: action_id + payload 분리", () => {
    expect(code).toContain("callback_data.indexOf(\":\")");
  });

  it("버튼 콜백 InboundMessage에 is_button_callback 메타데이터", () => {
    expect(code).toContain("is_button_callback: true");
    expect(code).toContain("button_action_id");
    expect(code).toContain("button_payload");
  });
});

describe("IC-8b: Discord interaction 엔드포인트", () => {
  const code = src("src/dashboard/routes/channel-callbacks.ts");

  it("/api/channels/discord/interaction 라우트", () => {
    expect(code).toContain("/api/channels/discord/interaction");
  });

  it("Ed25519 서명 검증", () => {
    expect(code).toContain("Ed25519");
    expect(code).toContain("x-signature-ed25519");
  });

  it("PING 응답 (type 1)", () => {
    expect(code).toContain("interaction_type === 1");
    expect(code).toContain("{ type: 1 }");
  });

  it("MESSAGE_COMPONENT 처리 (type 3)", () => {
    expect(code).toContain("interaction_type === 3");
    expect(code).toContain("DEFERRED_UPDATE_MESSAGE");
  });

  it("discord_public_key 미설정 시 503 거부 (S-2)", () => {
    expect(code).toContain("discord_public_key_not_configured");
    expect(code).not.toContain("if (deps.discord_public_key)"); // 조건부 건너뛰기 제거됨
  });
});

describe("IC-8b: Slack action 엔드포인트", () => {
  const code = src("src/dashboard/routes/channel-callbacks.ts");

  it("/api/channels/slack/action 라우트", () => {
    expect(code).toContain("/api/channels/slack/action");
  });

  it("Slack payload 파싱 (payload 필드 JSON 문자열)", () => {
    expect(code).toContain("payload_str");
    expect(code).toContain("JSON.parse(payload_str)");
  });

  it("actions 배열 순회 + action_id 추출", () => {
    expect(code).toContain("action.action_id");
    expect(code).toContain("action.value");
  });

  it("즉시 200 응답 (3초 제한 준수)", () => {
    expect(code).toContain("deps.json(res, 200, { ok: true })");
  });

  it("Slack HMAC-SHA256 서명 검증 (S-2)", () => {
    expect(code).toContain("x-slack-signature");
    expect(code).toContain("x-slack-request-timestamp");
    expect(code).toContain("createHmac");
    expect(code).toContain("timingSafeEqual");
  });

  it("slack_signing_secret 미설정 시 503 거부 (S-2)", () => {
    expect(code).toContain("slack_signing_secret_not_configured");
  });

  it("리플레이 방지: 5분 타임스탬프 검증", () => {
    expect(code).toContain("slack_timestamp_expired");
  });
});

describe("IC-8b: Dashboard 서비스 연결", () => {
  const svc = src("src/dashboard/service.ts");

  it("channel-callbacks import", () => {
    expect(svc).toContain("dispatch_channel_callback");
  });

  it("register_channel_callbacks 메서드", () => {
    expect(svc).toContain("register_channel_callbacks");
  });

  it("bootstrap에서 register_channel_callbacks 호출 (CL-2)", () => {
    const bootstrap = src("src/bootstrap/dashboard.ts");
    expect(bootstrap).toContain("register_channel_callbacks()");
  });

  const types = src("src/dashboard/service.types.ts");

  it("discord_public_key 옵션", () => {
    expect(types).toContain("discord_public_key");
  });

  it("slack_signing_secret 옵션", () => {
    expect(types).toContain("slack_signing_secret");
  });
});
