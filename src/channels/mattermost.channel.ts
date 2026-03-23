import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { tmpdir } from "node:os";
import { validate_file_path } from "../utils/path-validation.js";
import type { InboundMessage, MediaItem, OutboundMessage, RichAction, RichEmbed } from "../bus/types.js";
import { now_iso, error_message, short_id } from "../utils/common.js";
import { BaseChannel } from "./base.js";
import { channel_fetch, parse_json_response } from "./http-utils.js";
import type { MattermostChannelSettings } from "./settings.types.js";

type MattermostChannelOptions = {
  instance_id?: string;
  bot_token?: string;
  default_channel?: string;
  api_base?: string;
  workspace_dir?: string;
  settings?: MattermostChannelSettings;
};

/** Mattermost post → SoulFlow InboundMessage 변환. */
function to_inbound_message(
  channel: MattermostChannel,
  raw: Record<string, unknown>,
  chat_id: string,
): InboundMessage {
  const content = String(raw.message || "");
  const command = channel.parse_command(content);
  const mentions = channel.parse_agent_mentions(content);
  const props = (raw.props && typeof raw.props === "object" ? raw.props : {}) as Record<string, unknown>;
  const from_is_bot = Boolean(props.from_bot || props.from_webhook);
  const file_ids = Array.isArray(raw.file_ids) ? (raw.file_ids as string[]) : [];
  const media: MediaItem[] = file_ids.map((id) => ({
    type: "file" as const,
    url: id, // file_id — request_file()로 다운로드
    name: id,
  }));

  return {
    id: String(raw.id || short_id()),
    provider: "mattermost",
    channel: "mattermost",
    sender_id: String(raw.user_id || "unknown"),
    chat_id,
    content,
    at: now_iso(),
    thread_id: String(raw.root_id || "") || undefined,
    media: media.length > 0 ? media : undefined,
    metadata: {
      mattermost: raw,
      command,
      mentions,
      from_is_bot,
      message_id: String(raw.id || ""),
    },
    team_id: String(raw.channel_id || "mattermost"),
  };
}

export class MattermostChannel extends BaseChannel {
  private readonly bot_token: string;
  private readonly default_channel: string;
  private readonly api_base: string;
  private readonly workspace_dir: string;
  private readonly settings: MattermostChannelSettings;

  constructor(options?: MattermostChannelOptions) {
    super("mattermost", options?.instance_id);
    this.bot_token = options?.bot_token || "";
    this.default_channel = options?.default_channel || "";
    this.api_base = (options?.api_base || "").replace(/\/+$/, "");
    this.workspace_dir = options?.workspace_dir || "";
    this.settings = options?.settings || {};
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.bot_token}`,
      "Content-Type": "application/json",
    };
  }

  // ── Lifecycle ──

  async start(): Promise<void> {
    if (!this.bot_token) throw new Error("mattermost_bot_token_missing");
    if (!this.api_base) throw new Error("mattermost_api_base_missing");
    // 연결 검증 — /api/v4/users/me
    try {
      const resp = await channel_fetch(`${this.api_base}/api/v4/users/me`, {
        headers: this.headers(),
      });
      if (!resp.ok) {
        const data = await parse_json_response(resp);
        throw new Error(`auth_failed: ${data.message || resp.status}`);
      }
      const me = await resp.json() as Record<string, unknown>;
      this.log.info("started", {
        instance_id: this.instance_id,
        bot_id: me.id,
        username: me.username,
      });
    } catch (error) {
      this.last_error = error_message(error);
      throw error;
    }
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.log.info("stopped", { instance_id: this.instance_id });
  }

  // ── Send ──

  async send(message: OutboundMessage): Promise<{ ok: boolean; message_id?: string; error?: string }> {
    const chat_id = String(message.chat_id || this.default_channel || "");
    if (!chat_id) return { ok: false, error: "chat_id_required" };
    if (!this.bot_token) return { ok: false, error: "mattermost_bot_token_missing" };

    try {
      await this.set_typing(chat_id, true);

      // Rich embed → Mattermost attachment
      if (message.rich?.embeds?.length) {
        return this.send_rich(chat_id, message);
      }

      const text = String(message.content || "");
      const chunk_size = Math.max(500, Number(this.settings.text_chunk_size || 3500));
      const file_threshold = Math.max(4_000, Number(this.settings.text_file_fallback_threshold || 16_000));
      let first_id = "";

      // 미디어 첨부
      if (Array.isArray(message.media) && message.media.length > 0) {
        const file_ids = await this.upload_files(chat_id, message.media);
        const result = await this.create_post(chat_id, text, {
          root_id: message.reply_to,
          file_ids,
        });
        return result;
      }

      // 긴 텍스트 → 파일 fallback
      if (text.length >= file_threshold) {
        const notice = await this.create_post(chat_id, `본문이 길어 첨부 파일로 전송했습니다. (${text.length} chars)`, {
          root_id: message.reply_to,
        });
        first_id = notice.message_id || "";
        const file_ids = await this.upload_text_as_file(chat_id, text, `message-${Date.now()}.md`);
        await this.create_post(chat_id, "", { root_id: message.reply_to, file_ids });
        return { ok: true, message_id: first_id };
      }

      // 일반 텍스트
      const chunks = this.split_text_chunks(text, chunk_size);
      for (let i = 0; i < chunks.length; i++) {
        const part = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n${chunks[i]}` : chunks[i];
        const result = await this.create_post(chat_id, part, {
          root_id: i === 0 ? message.reply_to : undefined,
        });
        if (!result.ok) return result;
        if (!first_id) first_id = result.message_id || "";
      }

      return { ok: true, message_id: first_id };
    } catch (error) {
      const msg = error_message(error);
      this.log.warn("send failed", { chat_id, error: msg });
      return { ok: false, error: msg };
    } finally {
      await this.set_typing(chat_id, false);
    }
  }

  /** Rich embed → Mattermost attachment 변환 후 전송. */
  private async send_rich(
    chat_id: string,
    message: OutboundMessage,
  ): Promise<{ ok: boolean; message_id?: string; error?: string }> {
    const attachments = (message.rich?.embeds || []).map((e) => this.to_mattermost_attachment(e));
    const props: Record<string, unknown> = { attachments };

    // Actions → Mattermost interactive buttons
    if (message.rich?.actions?.length) {
      const integration_url = this.settings.actions_url || "";
      if (integration_url) {
        props.attachments = attachments.map((a, i) => {
          if (i !== 0) return a;
          return {
            ...a,
            actions: message.rich!.actions!.map((act) => this.to_mattermost_action(act, integration_url)),
          };
        });
      }
    }

    const body: Record<string, unknown> = {
      channel_id: chat_id,
      message: String(message.content || ""),
      props,
    };
    if (message.reply_to) body.root_id = message.reply_to;

    const resp = await channel_fetch(`${this.api_base}/api/v4/posts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const data = await parse_json_response(resp);
    if (!resp.ok) return { ok: false, error: String(data.message || `http_${resp.status}`) };
    return { ok: true, message_id: String(data.id || "") };
  }

  private to_mattermost_attachment(embed: RichEmbed): Record<string, unknown> {
    const COLOR_MAP: Record<string, string> = {
      green: "#2fb171",
      yellow: "#d9a441",
      red: "#c56a6a",
      blue: "#4a9eff",
    };
    const out: Record<string, unknown> = {};
    if (embed.title) out.title = embed.title;
    if (embed.description) out.text = embed.description;
    if (embed.color) out.color = COLOR_MAP[embed.color] || embed.color;
    if (embed.footer) out.footer = embed.footer;
    if (embed.image_url) out.image_url = embed.image_url;
    if (embed.thumbnail_url) out.thumb_url = embed.thumbnail_url;
    if (Array.isArray(embed.fields) && embed.fields.length > 0) {
      out.fields = embed.fields.map((f) => ({
        title: f.name || "",
        value: f.value || "",
        short: f.inline === true,
      }));
    }
    return out;
  }

  private to_mattermost_action(action: RichAction, integration_url: string): Record<string, unknown> {
    const style_map: Record<string, string> = {
      primary: "good",
      danger: "danger",
      secondary: "default",
    };
    return {
      id: action.id,
      name: action.label,
      style: style_map[action.style] || "default",
      integration: {
        url: integration_url,
        context: { action_id: action.id, payload: action.payload },
      },
    };
  }

  // ── Read ──

  async read(chat_id: string, limit = 20): Promise<InboundMessage[]> {
    if (!this.bot_token) return [];
    const n = Math.max(1, Math.min(200, Number(limit || 20)));
    try {
      const resp = await channel_fetch(
        `${this.api_base}/api/v4/channels/${chat_id}/posts?per_page=${n}`,
        { headers: this.headers() },
      );
      if (!resp.ok) return [];
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      const order = Array.isArray(data.order) ? (data.order as string[]) : [];
      const posts = (data.posts && typeof data.posts === "object" ? data.posts : {}) as Record<string, Record<string, unknown>>;
      const messages = order
        .map((id) => posts[id])
        .filter((p): p is Record<string, unknown> => Boolean(p))
        .map((p) => to_inbound_message(this, p, chat_id));
      return this.filter_seen(messages);
    } catch (error) {
      this.last_error = error_message(error);
      this.log.warn("read failed", { chat_id, error: this.last_error });
      return [];
    }
  }

  // ── Edit ──

  async edit_message(
    _chat_id: string,
    message_id: string,
    content: string,
    _parse_mode?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.bot_token || !message_id) return { ok: false, error: "token_or_message_id_missing" };
    try {
      const resp = await channel_fetch(`${this.api_base}/api/v4/posts/${message_id}/patch`, {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({ message: String(content || "") }),
      });
      const data = await parse_json_response(resp);
      if (!resp.ok) return { ok: false, error: String(data.message || `http_${resp.status}`) };
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error_message(error) };
    }
  }

  // ── Reactions ──

  async add_reaction(
    _chat_id: string,
    message_id: string,
    reaction: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return this.mm_reaction("POST", message_id, reaction);
  }

  async remove_reaction(
    _chat_id: string,
    message_id: string,
    reaction: string,
  ): Promise<{ ok: boolean; error?: string }> {
    // Mattermost DELETE reaction은 user_id + post_id + emoji_name
    // bot의 user_id를 알아야 하므로 /users/me에서 가져옴
    try {
      const me_resp = await channel_fetch(`${this.api_base}/api/v4/users/me`, {
        headers: this.headers(),
      });
      const me = (await me_resp.json().catch(() => ({}))) as Record<string, unknown>;
      const user_id = String(me.id || "");
      if (!user_id) return { ok: false, error: "cannot_resolve_bot_user_id" };
      const emoji = reaction.replace(/:/g, "");
      const resp = await channel_fetch(
        `${this.api_base}/api/v4/users/${user_id}/posts/${message_id}/reactions/${emoji}`,
        { method: "DELETE", headers: this.headers() },
      );
      if (!resp.ok && resp.status !== 204) {
        const data = await parse_json_response(resp);
        return { ok: false, error: String(data.message || `http_${resp.status}`) };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error_message(error) };
    }
  }

  private async mm_reaction(
    method: string,
    post_id: string,
    reaction: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.bot_token || !post_id || !reaction) {
      return { ok: false, error: "token_post_id_reaction_required" };
    }
    try {
      const me_resp = await channel_fetch(`${this.api_base}/api/v4/users/me`, {
        headers: this.headers(),
      });
      const me = (await me_resp.json().catch(() => ({}))) as Record<string, unknown>;
      const user_id = String(me.id || "");
      if (!user_id) return { ok: false, error: "cannot_resolve_bot_user_id" };

      const emoji = reaction.replace(/:/g, "");
      const resp = await channel_fetch(`${this.api_base}/api/v4/reactions`, {
        method,
        headers: this.headers(),
        body: JSON.stringify({
          user_id,
          post_id,
          emoji_name: emoji,
        }),
      });
      if (!resp.ok && resp.status !== 200) {
        const data = await parse_json_response(resp);
        return { ok: false, error: String(data.message || `http_${resp.status}`) };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error_message(error) };
    }
  }

  // ── Typing ──

  protected async set_typing_remote(
    chat_id: string,
    typing: boolean,
    _anchor_message_id?: string,
  ): Promise<void> {
    if (!typing || !this.bot_token) return;
    // Mattermost typing indicator: POST /api/v4/users/me/typing
    await channel_fetch(`${this.api_base}/api/v4/users/me/typing`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ channel_id: chat_id }),
    }).catch(() => {/* 무시 */});
  }

  // ── File helpers ──

  private async create_post(
    channel_id: string,
    message: string,
    opts?: { root_id?: string; file_ids?: string[] },
  ): Promise<{ ok: boolean; message_id?: string; error?: string }> {
    const body: Record<string, unknown> = {
      channel_id,
      message: String(message || ""),
    };
    if (opts?.root_id) body.root_id = opts.root_id;
    if (opts?.file_ids?.length) body.file_ids = opts.file_ids;

    const resp = await channel_fetch(`${this.api_base}/api/v4/posts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const data = await parse_json_response(resp);
    if (!resp.ok) return { ok: false, error: String(data.message || `http_${resp.status}`) };
    return { ok: true, message_id: String(data.id || "") };
  }

  private async upload_files(channel_id: string, media: MediaItem[]): Promise<string[]> {
    const ids: string[] = [];
    for (const item of media) {
      if (!item?.url) continue;
      const filePath = String(item.url);
      if (!validate_file_path(filePath, [tmpdir(), process.cwd(), ...(this.workspace_dir ? [this.workspace_dir] : [])])) continue;
      const bytes = await readFile(filePath);
      const form = new FormData();
      form.set("files", new Blob([bytes]), item.name || basename(filePath));
      form.set("channel_id", channel_id);
      const resp = await channel_fetch(`${this.api_base}/api/v4/files`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.bot_token}` },
        body: form,
      });
      const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
      const infos = Array.isArray(data.file_infos) ? (data.file_infos as Array<Record<string, unknown>>) : [];
      for (const fi of infos) {
        if (fi.id) ids.push(String(fi.id));
      }
    }
    return ids;
  }

  private async upload_text_as_file(channel_id: string, text: string, filename: string): Promise<string[]> {
    const form = new FormData();
    form.set("files", new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
    form.set("channel_id", channel_id);
    const resp = await channel_fetch(`${this.api_base}/api/v4/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.bot_token}` },
      body: form,
    });
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    const infos = Array.isArray(data.file_infos) ? (data.file_infos as Array<Record<string, unknown>>) : [];
    return infos.map((fi) => String(fi.id || "")).filter(Boolean);
  }
}
