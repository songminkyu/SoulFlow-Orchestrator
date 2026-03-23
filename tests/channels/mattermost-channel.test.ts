/**
 * MattermostChannel — 단위 테스트.
 * HTTP 호출을 mock하여 send/read/edit/reaction/typing/health 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MattermostChannel } from "@src/channels/mattermost.channel.js";
import type { OutboundMessage } from "@src/bus/types.js";

// ── fetch mock ──
const fetch_mock = vi.fn();
vi.stubGlobal("fetch", fetch_mock);

function json_response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  } as unknown as Response;
}

function make_channel(overrides?: Partial<ConstructorParameters<typeof MattermostChannel>[0]>): MattermostChannel {
  return new MattermostChannel({
    instance_id: "mm-test",
    bot_token: "test-token-123",
    default_channel: "ch-town-square",
    api_base: "http://localhost:8065",
    ...overrides,
  });
}

function make_outbound(overrides?: Partial<OutboundMessage>): OutboundMessage {
  return {
    id: "out-1",
    provider: "mattermost",
    channel: "mattermost",
    sender_id: "agent",
    chat_id: "ch-town-square",
    content: "hello world",
    at: new Date().toISOString(),
    team_id: "mattermost",
    ...overrides,
  };
}

beforeEach(() => {
  fetch_mock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ══════════════════════════════════════════
// Lifecycle
// ══════════════════════════════════════════

describe("MattermostChannel — lifecycle", () => {
  it("start: 토큰 없으면 에러", async () => {
    const ch = make_channel({ bot_token: "" });
    await expect(ch.start()).rejects.toThrow("mattermost_bot_token_missing");
  });

  it("start: api_base 없으면 에러", async () => {
    const ch = make_channel({ api_base: "" });
    await expect(ch.start()).rejects.toThrow("mattermost_api_base_missing");
  });

  it("start: /users/me 인증 성공 → running", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({ id: "bot-id-1", username: "soulflow-bot" }),
    );
    const ch = make_channel();
    await ch.start();
    expect(ch.is_running()).toBe(true);
  });

  it("start: /users/me 401 → 에러", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({ message: "invalid token" }, 401),
    );
    const ch = make_channel();
    await expect(ch.start()).rejects.toThrow("auth_failed");
  });

  it("stop: running false", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({ id: "bot-id-1", username: "soulflow-bot" }),
    );
    const ch = make_channel();
    await ch.start();
    await ch.stop();
    expect(ch.is_running()).toBe(false);
  });
});

// ══════════════════════════════════════════
// Send
// ══════════════════════════════════════════

describe("MattermostChannel — send", () => {
  it("일반 메시지 전송 성공", async () => {
    // typing + post
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockResolvedValueOnce(json_response({ id: "post-1" })) // create_post
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(make_outbound());
    expect(result.ok).toBe(true);
    expect(result.message_id).toBe("post-1");
  });

  it("chat_id 없으면 에러", async () => {
    const ch = make_channel({ default_channel: "" });
    const result = await ch.send(make_outbound({ chat_id: "" }));
    expect(result.ok).toBe(false);
    expect(result.error).toBe("chat_id_required");
  });

  it("토큰 없으면 에러", async () => {
    const ch = make_channel({ bot_token: "" });
    const result = await ch.send(make_outbound());
    expect(result.ok).toBe(false);
    expect(result.error).toBe("mattermost_bot_token_missing");
  });

  it("긴 텍스트 → 청킹", async () => {
    const long_text = "a".repeat(8000);
    // typing + 2 chunks + typing off = 4 fetch calls
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockResolvedValueOnce(json_response({ id: "p1" }))
      .mockResolvedValueOnce(json_response({ id: "p2" }))
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(make_outbound({ content: long_text }));
    expect(result.ok).toBe(true);
    // post 호출이 2번 이상
    const post_calls = fetch_mock.mock.calls.filter(
      (c) => String(c[0]).includes("/api/v4/posts"),
    );
    expect(post_calls.length).toBeGreaterThanOrEqual(2);
  });

  it("rich embed → attachment 포함 전송", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockResolvedValueOnce(json_response({ id: "rich-1" })) // post
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(
      make_outbound({
        content: "summary",
        rich: {
          embeds: [
            { title: "Test", description: "Desc", color: "green" },
          ],
        },
      }),
    );
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}"));
    expect(body.props?.attachments).toBeDefined();
    expect(body.props.attachments[0].color).toBe("#2fb171");
  });

  it("reply_to → root_id 설정", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "reply-1" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel();
    await ch.send(make_outbound({ reply_to: "parent-post-id" }));
    const body = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}"));
    expect(body.root_id).toBe("parent-post-id");
  });
});

// ══════════════════════════════════════════
// Read
// ══════════════════════════════════════════

describe("MattermostChannel — read", () => {
  it("포스트 읽기 성공", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({
        order: ["p1", "p2"],
        posts: {
          p1: { id: "p1", message: "hello", user_id: "u1", channel_id: "ch1" },
          p2: { id: "p2", message: "world", user_id: "u2", channel_id: "ch1" },
        },
      }),
    );
    const ch = make_channel();
    const msgs = await ch.read("ch1", 10);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe("hello");
    expect(msgs[1].content).toBe("world");
    expect(msgs[0].provider).toBe("mattermost");
  });

  it("토큰 없으면 빈 배열", async () => {
    const ch = make_channel({ bot_token: "" });
    const msgs = await ch.read("ch1");
    expect(msgs).toEqual([]);
  });

  it("API 에러 → 빈 배열", async () => {
    fetch_mock.mockResolvedValueOnce(json_response({}, 500));
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    expect(msgs).toEqual([]);
  });

  it("중복 메시지 필터링", async () => {
    const response = json_response({
      order: ["p1"],
      posts: { p1: { id: "p1", message: "dup", user_id: "u1", channel_id: "ch1" } },
    });
    fetch_mock.mockResolvedValue(response);
    const ch = make_channel();
    const first = await ch.read("ch1");
    expect(first).toHaveLength(1);
    // 두 번째 read — 같은 id는 필터링
    fetch_mock.mockResolvedValue(
      json_response({
        order: ["p1"],
        posts: { p1: { id: "p1", message: "dup", user_id: "u1", channel_id: "ch1" } },
      }),
    );
    const second = await ch.read("ch1");
    expect(second).toHaveLength(0);
  });
});

// ══════════════════════════════════════════
// Edit
// ══════════════════════════════════════════

describe("MattermostChannel — edit", () => {
  it("메시지 수정 성공", async () => {
    fetch_mock.mockResolvedValueOnce(json_response({ id: "p1" }));
    const ch = make_channel();
    const result = await ch.edit_message("ch1", "p1", "updated");
    expect(result.ok).toBe(true);
    expect(fetch_mock.mock.calls[0][0]).toContain("/api/v4/posts/p1/patch");
  });

  it("토큰 없으면 에러", async () => {
    const ch = make_channel({ bot_token: "" });
    const result = await ch.edit_message("ch1", "p1", "updated");
    expect(result.ok).toBe(false);
  });
});

// ══════════════════════════════════════════
// Reactions
// ══════════════════════════════════════════

describe("MattermostChannel — reactions", () => {
  it("리액션 추가 성공", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({ id: "bot-id" })) // /users/me
      .mockResolvedValueOnce(json_response({})); // /reactions POST
    const ch = make_channel();
    const result = await ch.add_reaction("ch1", "p1", "thumbsup");
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}"));
    expect(body.emoji_name).toBe("thumbsup");
    expect(body.post_id).toBe("p1");
  });

  it("리액션 제거 성공", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({ id: "bot-id" })) // /users/me
      .mockResolvedValueOnce(json_response({}, 204)); // DELETE
    const ch = make_channel();
    const result = await ch.remove_reaction("ch1", "p1", "thumbsup");
    expect(result.ok).toBe(true);
  });
});

// ══════════════════════════════════════════
// Health
// ══════════════════════════════════════════

describe("MattermostChannel — health", () => {
  it("provider와 instance_id 반환", () => {
    const ch = make_channel();
    const h = ch.get_health();
    expect(h.provider).toBe("mattermost");
    expect(h.instance_id).toBe("mm-test");
    expect(h.running).toBe(false);
  });
});

// ══════════════════════════════════════════
// Factory registration
// ══════════════════════════════════════════

describe("MattermostChannel — factory", () => {
  it("mattermost 팩토리 등록됨", async () => {
    const { get_channel_factory } = await import("@src/channels/channel-factory.js");
    expect(get_channel_factory("mattermost")).not.toBeNull();
  });

  it("list_registered_providers에 mattermost 포함", async () => {
    const { list_registered_providers } = await import("@src/channels/channel-factory.js");
    expect(list_registered_providers()).toContain("mattermost");
  });
});
