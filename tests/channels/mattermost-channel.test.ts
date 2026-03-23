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

// ══════════════════════════════════════════
// Send — edge cases
// ══════════════════════════════════════════

describe("MattermostChannel — send edge cases", () => {
  it("빈 content → 빈 메시지 전송", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockResolvedValueOnce(json_response({ id: "p-empty" }))
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(make_outbound({ content: "" }));
    expect(result.ok).toBe(true);
  });

  it("default_channel 사용 (chat_id 없을 때)", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "p-default" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel({ default_channel: "ch-default" });
    const result = await ch.send(make_outbound({ chat_id: "" }));
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}"));
    expect(body.channel_id).toBe("ch-default");
  });

  it("파일 fallback threshold 초과 → 파일 업로드", async () => {
    const huge_text = "x".repeat(20000);
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockResolvedValueOnce(json_response({ id: "notice-1" })) // notice post
      .mockResolvedValueOnce(json_response({ file_infos: [{ id: "file-1" }] })) // file upload
      .mockResolvedValueOnce(json_response({ id: "file-post-1" })) // file post
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(make_outbound({ content: huge_text }));
    expect(result.ok).toBe(true);
    // file upload 호출 확인
    const file_calls = fetch_mock.mock.calls.filter(
      (c) => String(c[0]).includes("/api/v4/files"),
    );
    expect(file_calls.length).toBe(1);
  });

  it("post API 실패 → ok: false", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockResolvedValueOnce(json_response({ message: "forbidden" }, 403))
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(make_outbound());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("forbidden");
  });

  it("fetch 예외 → ok: false + error 메시지", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(make_outbound());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("network timeout");
  });

  it("청킹 중 중간 실패 → 즉시 반환", async () => {
    const text = "a".repeat(8000); // 2+ chunks
    fetch_mock
      .mockResolvedValueOnce(json_response({})) // typing
      .mockResolvedValueOnce(json_response({ id: "p1" })) // chunk 1 ok
      .mockResolvedValueOnce(json_response({ message: "rate limited" }, 429)) // chunk 2 fail
      .mockResolvedValueOnce(json_response({})); // typing off
    const ch = make_channel();
    const result = await ch.send(make_outbound({ content: text }));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("rate limited");
  });
});

// ══════════════════════════════════════════
// Send — rich embeds edge cases
// ══════════════════════════════════════════

describe("MattermostChannel — rich embeds", () => {
  it("여러 embed 전송", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "rich-multi" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel();
    const result = await ch.send(
      make_outbound({
        rich: {
          embeds: [
            { title: "E1", description: "Desc1", color: "red" },
            { title: "E2", description: "Desc2", color: "blue" },
          ],
        },
      }),
    );
    expect(result.ok).toBe(true);
    const body = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}"));
    expect(body.props.attachments).toHaveLength(2);
    expect(body.props.attachments[0].color).toBe("#c56a6a");
    expect(body.props.attachments[1].color).toBe("#4a9eff");
  });

  it("embed fields 변환", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "rich-fields" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel();
    await ch.send(
      make_outbound({
        rich: {
          embeds: [
            {
              title: "Status",
              fields: [
                { name: "CPU", value: "80%", inline: true },
                { name: "RAM", value: "4GB", inline: false },
              ],
            },
          ],
        },
      }),
    );
    const body = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}"));
    const fields = body.props.attachments[0].fields;
    expect(fields).toHaveLength(2);
    expect(fields[0]).toEqual({ title: "CPU", value: "80%", short: true });
    expect(fields[1]).toEqual({ title: "RAM", value: "4GB", short: false });
  });

  it("image_url, thumbnail_url, footer 변환", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "rich-img" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel();
    await ch.send(
      make_outbound({
        rich: {
          embeds: [
            {
              title: "Preview",
              image_url: "https://example.com/img.png",
              thumbnail_url: "https://example.com/thumb.png",
              footer: "footer text",
            },
          ],
        },
      }),
    );
    const att = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}")).props.attachments[0];
    expect(att.image_url).toBe("https://example.com/img.png");
    expect(att.thumb_url).toBe("https://example.com/thumb.png");
    expect(att.footer).toBe("footer text");
  });

  it("actions + actions_url → interactive buttons", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "rich-actions" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel({
      settings: { actions_url: "http://soulflow:4200/api/callback" },
    });
    await ch.send(
      make_outbound({
        rich: {
          embeds: [{ title: "Confirm" }],
          actions: [
            { id: "approve", label: "Approve", style: "primary" },
            { id: "reject", label: "Reject", style: "danger" },
          ],
        },
      }),
    );
    const att = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}")).props.attachments[0];
    expect(att.actions).toHaveLength(2);
    expect(att.actions[0].name).toBe("Approve");
    expect(att.actions[0].style).toBe("good");
    expect(att.actions[1].style).toBe("danger");
    expect(att.actions[0].integration.url).toBe("http://soulflow:4200/api/callback");
  });

  it("actions_url 없으면 버튼 미포함", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "no-btn" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel(); // no actions_url
    await ch.send(
      make_outbound({
        rich: {
          embeds: [{ title: "No buttons" }],
          actions: [{ id: "a1", label: "Click", style: "primary" }],
        },
      }),
    );
    const att = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}")).props.attachments[0];
    expect(att.actions).toBeUndefined();
  });

  it("unknown color → 그대로 전달", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({}))
      .mockResolvedValueOnce(json_response({ id: "custom-color" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel();
    await ch.send(
      make_outbound({
        rich: { embeds: [{ title: "Custom", color: "#ff00ff" }] },
      }),
    );
    const att = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}")).props.attachments[0];
    expect(att.color).toBe("#ff00ff");
  });
});

// ══════════════════════════════════════════
// Read — edge cases
// ══════════════════════════════════════════

describe("MattermostChannel — read edge cases", () => {
  it("limit 범위 클램핑 (max 200)", async () => {
    fetch_mock.mockResolvedValueOnce(json_response({ order: [], posts: {} }));
    const ch = make_channel();
    await ch.read("ch1", 999);
    expect(fetch_mock.mock.calls[0][0]).toContain("per_page=200");
  });

  it("limit 범위 클램핑 (min 1)", async () => {
    fetch_mock.mockResolvedValueOnce(json_response({ order: [], posts: {} }));
    const ch = make_channel();
    await ch.read("ch1", -5);
    expect(fetch_mock.mock.calls[0][0]).toContain("per_page=1");
  });

  it("응답이 배열이 아닌 경우 빈 배열", async () => {
    fetch_mock.mockResolvedValueOnce(json_response("not an object"));
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    expect(msgs).toEqual([]);
  });

  it("fetch 예외 → 빈 배열 + last_error 설정", async () => {
    fetch_mock.mockRejectedValueOnce(new Error("dns failed"));
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    expect(msgs).toEqual([]);
    const health = ch.get_health();
    expect(health.last_error).toContain("dns failed");
  });

  it("from_is_bot 감지 (props.from_bot)", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({
        order: ["p1"],
        posts: {
          p1: {
            id: "p1",
            message: "bot msg",
            user_id: "bot-1",
            channel_id: "ch1",
            props: { from_bot: true },
          },
        },
      }),
    );
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    expect(msgs[0].metadata?.from_is_bot).toBe(true);
  });

  it("file_ids → media 변환", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({
        order: ["p1"],
        posts: {
          p1: {
            id: "p1",
            message: "with file",
            user_id: "u1",
            channel_id: "ch1",
            file_ids: ["f1", "f2"],
          },
        },
      }),
    );
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    expect(msgs[0].media).toHaveLength(2);
    expect(msgs[0].media![0].url).toBe("f1");
  });
});

// ══════════════════════════════════════════
// Edit — edge cases
// ══════════════════════════════════════════

describe("MattermostChannel — edit edge cases", () => {
  it("message_id 없으면 에러", async () => {
    const ch = make_channel();
    const result = await ch.edit_message("ch1", "", "updated");
    expect(result.ok).toBe(false);
  });

  it("API 실패 → error 포함", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({ message: "not found" }, 404),
    );
    const ch = make_channel();
    const result = await ch.edit_message("ch1", "bad-id", "updated");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("fetch 예외 → error 포함", async () => {
    fetch_mock.mockRejectedValueOnce(new Error("connection refused"));
    const ch = make_channel();
    const result = await ch.edit_message("ch1", "p1", "updated");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("connection refused");
  });
});

// ══════════════════════════════════════════
// Reactions — edge cases
// ══════════════════════════════════════════

describe("MattermostChannel — reactions edge cases", () => {
  it("토큰 없으면 에러", async () => {
    const ch = make_channel({ bot_token: "" });
    const result = await ch.add_reaction("ch1", "p1", "thumbsup");
    expect(result.ok).toBe(false);
  });

  it("post_id 없으면 에러", async () => {
    const ch = make_channel();
    const result = await ch.add_reaction("ch1", "", "thumbsup");
    expect(result.ok).toBe(false);
  });

  it("reaction 이름 없으면 에러", async () => {
    const ch = make_channel();
    const result = await ch.add_reaction("ch1", "p1", "");
    expect(result.ok).toBe(false);
  });

  it("user_id resolve 실패 → 에러", async () => {
    fetch_mock.mockResolvedValueOnce(json_response({})); // /users/me → no id
    const ch = make_channel();
    const result = await ch.add_reaction("ch1", "p1", "heart");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("cannot_resolve_bot_user_id");
  });

  it("reaction API 에러 → 에러 반환", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({ id: "bot-1" }))
      .mockResolvedValueOnce(json_response({ message: "emoji not found" }, 400));
    const ch = make_channel();
    const result = await ch.add_reaction("ch1", "p1", "nonexistent_emoji");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("emoji not found");
  });

  it("fetch 예외 → 에러 반환", async () => {
    fetch_mock.mockRejectedValueOnce(new Error("timeout"));
    const ch = make_channel();
    const result = await ch.add_reaction("ch1", "p1", "heart");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("timeout");
  });

  it("콜론 제거 (:thumbsup: → thumbsup)", async () => {
    fetch_mock
      .mockResolvedValueOnce(json_response({ id: "bot-1" }))
      .mockResolvedValueOnce(json_response({}));
    const ch = make_channel();
    await ch.add_reaction("ch1", "p1", ":thumbsup:");
    const body = JSON.parse(String(fetch_mock.mock.calls[1][1]?.body || "{}"));
    expect(body.emoji_name).toBe("thumbsup");
  });
});

// ══════════════════════════════════════════
// Typing
// ══════════════════════════════════════════

describe("MattermostChannel — typing", () => {
  it("typing true → API 호출", async () => {
    fetch_mock.mockResolvedValueOnce(json_response({}));
    const ch = make_channel();
    await ch.set_typing("ch1", true);
    expect(fetch_mock.mock.calls[0][0]).toContain("/api/v4/users/me/typing");
    const body = JSON.parse(String(fetch_mock.mock.calls[0][1]?.body || "{}"));
    expect(body.channel_id).toBe("ch1");
  });

  it("typing false → API 호출 안 함", async () => {
    const ch = make_channel();
    await ch.set_typing("ch1", false);
    expect(fetch_mock).not.toHaveBeenCalled();
  });

  it("typing 실패해도 예외 안 던짐", async () => {
    fetch_mock.mockRejectedValueOnce(new Error("fail"));
    const ch = make_channel();
    await expect(ch.set_typing("ch1", true)).resolves.toBeUndefined();
  });
});

// ══════════════════════════════════════════
// InboundMessage conversion
// ══════════════════════════════════════════

describe("MattermostChannel — inbound message parsing", () => {
  it("command 파싱 (/help)", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({
        order: ["p1"],
        posts: {
          p1: { id: "p1", message: "/help arg1", user_id: "u1", channel_id: "ch1" },
        },
      }),
    );
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    const cmd = msgs[0].metadata?.command;
    expect(cmd).toBeDefined();
    expect(cmd.name).toBe("help");
  });

  it("agent mention 파싱 (@agent)", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({
        order: ["p1"],
        posts: {
          p1: { id: "p1", message: "@soulflow do something", user_id: "u1", channel_id: "ch1" },
        },
      }),
    );
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    const mentions = msgs[0].metadata?.mentions;
    expect(mentions).toHaveLength(1);
    expect(mentions[0].alias).toBe("soulflow");
  });

  it("thread_id (root_id) 매핑", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({
        order: ["p1"],
        posts: {
          p1: { id: "p1", message: "reply", user_id: "u1", channel_id: "ch1", root_id: "parent-1" },
        },
      }),
    );
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    expect(msgs[0].thread_id).toBe("parent-1");
  });

  it("root_id 없으면 thread_id undefined", async () => {
    fetch_mock.mockResolvedValueOnce(
      json_response({
        order: ["p1"],
        posts: {
          p1: { id: "p1", message: "top level", user_id: "u1", channel_id: "ch1", root_id: "" },
        },
      }),
    );
    const ch = make_channel();
    const msgs = await ch.read("ch1");
    expect(msgs[0].thread_id).toBeUndefined();
  });
});
