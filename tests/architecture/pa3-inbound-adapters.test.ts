/**
 * PA-3 Inbound Adapter Conformance Tests
 *
 * Verifies that all inbound adapters (channel adapters, dashboard route handlers)
 * implement the expected port contracts at runtime.
 *
 * - Channel adapters (Slack, Discord, Telegram) extend BaseChannel -> implement ChatChannel
 * - ChannelRegistry implements ChannelRegistryLike
 * - Channel factory produces correctly typed ChatChannel instances
 * - Dashboard ops interfaces define the inbound adapter boundary for route handlers
 */
import { describe, it, expect, vi } from "vitest";

// -- Slack WebAPI mock (constructor side-effects prevention) --
vi.mock("@slack/web-api", () => ({
  WebClient: class {
    chat = { postMessage: vi.fn(), update: vi.fn() };
    conversations = {
      history: vi.fn().mockResolvedValue({ messages: [] }),
      replies: vi.fn().mockResolvedValue({ messages: [] }),
    };
    reactions = { add: vi.fn(), remove: vi.fn() };
    files = { uploadV2: vi.fn() };
  },
}));

import type { ChatChannel, ChannelRegistryLike } from "@src/channels/types.js";
import { BaseChannel } from "@src/channels/base.js";
import { SlackChannel } from "@src/channels/slack.channel.js";
import { DiscordChannel } from "@src/channels/discord.channel.js";
import { TelegramChannel } from "@src/channels/telegram.channel.js";
import { ChannelRegistry } from "@src/channels/index.js";
import {
  register_channel_factory,
  create_channel_instance,
  list_registered_providers,
} from "@src/channels/channel-factory.js";

const CHAT_CHANNEL_METHODS: (keyof ChatChannel)[] = [
  "start", "stop", "is_running", "send", "edit_message", "read",
  "send_command", "request_file", "send_agent_mention",
  "add_reaction", "remove_reaction", "send_poll",
  "set_typing", "get_typing_state", "parse_command",
  "parse_agent_mentions", "sync_commands", "get_health",
];

const CHAT_CHANNEL_PROPERTIES: (keyof ChatChannel)[] = ["provider", "instance_id"];

const CHANNEL_REGISTRY_METHODS: (keyof ChannelRegistryLike)[] = [
  "start_all", "stop_all", "register", "unregister",
  "get_channel", "get_channels_by_provider", "list_channels",
  "send", "edit_message", "add_reaction", "remove_reaction",
  "read", "find_latest_agent_mention", "set_typing",
  "get_typing_state", "send_poll", "get_health",
];

function assert_port_methods(instance: unknown, methods: string[], label: string): void {
  for (const method of methods) {
    const val = (instance as Record<string, unknown>)[method];
    expect(typeof val, label + "." + method + " -- expected function, got " + typeof val).toBe("function");
  }
}

function assert_port_properties(instance: unknown, props: string[], label: string): void {
  for (const prop of props) {
    const val = (instance as Record<string, unknown>)[prop];
    expect(val, label + "." + prop + " -- expected defined, got " + String(val)).toBeDefined();
  }
}

describe("PA-3 Conformance -- SlackChannel implements ChatChannel", () => {
  const instance = new SlackChannel({
    instance_id: "test-slack",
    bot_token: "xoxb-test",
    default_channel: "C123",
  });

  it("all ChatChannel methods are implemented as functions", () => {
    assert_port_methods(instance, CHAT_CHANNEL_METHODS, "SlackChannel");
  });

  it("readonly properties provider and instance_id are set", () => {
    assert_port_properties(instance, CHAT_CHANNEL_PROPERTIES, "SlackChannel");
    expect(instance.provider).toBe("slack");
    expect(instance.instance_id).toBe("test-slack");
  });

  it("extends BaseChannel (inheritance chain)", () => {
    expect(instance).toBeInstanceOf(BaseChannel);
  });
});

describe("PA-3 Conformance -- DiscordChannel implements ChatChannel", () => {
  const instance = new DiscordChannel({
    instance_id: "test-discord",
    bot_token: "discord-test-token",
    default_channel: "123456",
    api_base: "https://discord.com/api/v10",
  });

  it("all ChatChannel methods are implemented as functions", () => {
    assert_port_methods(instance, CHAT_CHANNEL_METHODS, "DiscordChannel");
  });

  it("readonly properties provider and instance_id are set", () => {
    assert_port_properties(instance, CHAT_CHANNEL_PROPERTIES, "DiscordChannel");
    expect(instance.provider).toBe("discord");
    expect(instance.instance_id).toBe("test-discord");
  });

  it("extends BaseChannel (inheritance chain)", () => {
    expect(instance).toBeInstanceOf(BaseChannel);
  });
});

describe("PA-3 Conformance -- TelegramChannel implements ChatChannel", () => {
  const instance = new TelegramChannel({
    instance_id: "test-telegram",
    bot_token: "tg-test-token",
    default_chat_id: "789",
    api_base: "https://api.telegram.org",
  });

  it("all ChatChannel methods are implemented as functions", () => {
    assert_port_methods(instance, CHAT_CHANNEL_METHODS, "TelegramChannel");
  });

  it("readonly properties provider and instance_id are set", () => {
    assert_port_properties(instance, CHAT_CHANNEL_PROPERTIES, "TelegramChannel");
    expect(instance.provider).toBe("telegram");
    expect(instance.instance_id).toBe("test-telegram");
  });

  it("extends BaseChannel (inheritance chain)", () => {
    expect(instance).toBeInstanceOf(BaseChannel);
  });
});

describe("PA-3 Conformance -- ChannelRegistry implements ChannelRegistryLike", () => {
  it("all ChannelRegistryLike methods are implemented", () => {
    const registry = new ChannelRegistry();
    assert_port_methods(registry, CHANNEL_REGISTRY_METHODS, "ChannelRegistry");
  });

  it("port method count matches interface definition (17)", () => {
    expect(CHANNEL_REGISTRY_METHODS).toHaveLength(17);
  });

  it("register/get_channel round-trip works", () => {
    const registry = new ChannelRegistry();
    const channel = new DiscordChannel({
      instance_id: "rt-discord",
      bot_token: "t",
      default_channel: "c",
      api_base: "https://discord.com/api/v10",
    });
    registry.register(channel);
    expect(registry.get_channel("rt-discord")).toBe(channel);
  });

  it("unregister returns true for known, false for unknown", () => {
    const registry = new ChannelRegistry();
    const channel = new TelegramChannel({
      instance_id: "rt-tg",
      bot_token: "t",
      default_chat_id: "c",
      api_base: "https://api.telegram.org",
    });
    registry.register(channel);
    expect(registry.unregister("rt-tg")).toBe(true);
    expect(registry.unregister("rt-tg")).toBe(false);
  });

  it("list_channels returns registered entries", () => {
    const registry = new ChannelRegistry();
    const channel = new SlackChannel({
      instance_id: "list-slack",
      bot_token: "t",
      default_channel: "c",
    });
    registry.register(channel);
    const list = registry.list_channels();
    expect(list).toEqual([{ provider: "slack", instance_id: "list-slack" }]);
  });
});

describe("PA-3 Conformance -- Channel Factory produces ChatChannel", () => {
  it("builtin providers (slack, discord, telegram) are registered", () => {
    const providers = list_registered_providers();
    expect(providers).toContain("slack");
    expect(providers).toContain("discord");
    expect(providers).toContain("telegram");
  });

  it("create_channel_instance returns ChatChannel for slack", () => {
    const config = { instance_id: "f-slack", provider: "slack", label: "Test", enabled: true, settings: { default_channel: "C1" }, created_at: "", updated_at: "" };
    const ch = create_channel_instance(config, "xoxb-test");
    expect(ch).not.toBeNull();
    assert_port_methods(ch!, CHAT_CHANNEL_METHODS, "factory:slack");
    expect(ch!.provider).toBe("slack");
  });

  it("create_channel_instance returns ChatChannel for discord", () => {
    const config = { instance_id: "f-discord", provider: "discord", label: "Test", enabled: true, settings: { default_channel: "C1", api_base: "https://discord.com/api/v10" }, created_at: "", updated_at: "" };
    const ch = create_channel_instance(config, "discord-tok");
    expect(ch).not.toBeNull();
    assert_port_methods(ch!, CHAT_CHANNEL_METHODS, "factory:discord");
    expect(ch!.provider).toBe("discord");
  });

  it("create_channel_instance returns ChatChannel for telegram", () => {
    const config = { instance_id: "f-tg", provider: "telegram", label: "Test", enabled: true, settings: { default_chat_id: "1", api_base: "https://api.telegram.org" }, created_at: "", updated_at: "" };
    const ch = create_channel_instance(config, "tg-tok");
    expect(ch).not.toBeNull();
    assert_port_methods(ch!, CHAT_CHANNEL_METHODS, "factory:telegram");
    expect(ch!.provider).toBe("telegram");
  });

  it("create_channel_instance returns null for unknown provider", () => {
    const config = { instance_id: "f-unknown", provider: "unknown_xyz", label: "Test", enabled: true, settings: {}, created_at: "", updated_at: "" };
    const ch = create_channel_instance(config, "tok");
    expect(ch).toBeNull();
  });

  it("register_channel_factory allows custom provider", () => {
    const custom_factory = vi.fn().mockReturnValue({
      provider: "custom", instance_id: "custom-1",
      start: vi.fn(), stop: vi.fn(), is_running: vi.fn().mockReturnValue(false),
      send: vi.fn(), edit_message: vi.fn(), read: vi.fn(),
      send_command: vi.fn(), request_file: vi.fn(), send_agent_mention: vi.fn(),
      add_reaction: vi.fn(), remove_reaction: vi.fn(), send_poll: vi.fn(),
      set_typing: vi.fn(), get_typing_state: vi.fn(), parse_command: vi.fn(),
      parse_agent_mentions: vi.fn(), sync_commands: vi.fn(), get_health: vi.fn(),
    });
    register_channel_factory("custom_test", custom_factory);
    expect(list_registered_providers()).toContain("custom_test");
    const config = { instance_id: "c-1", provider: "custom_test", label: "C", enabled: true, settings: {}, created_at: "", updated_at: "" };
    const ch = create_channel_instance(config, "tok");
    expect(ch).not.toBeNull();
    expect(custom_factory).toHaveBeenCalledOnce();
  });
});

describe("PA-3 Conformance -- Dashboard Ops Port Shapes", () => {
  it("DashboardChannelOps factory exists", async () => {
    const { create_channel_ops } = await import("@src/dashboard/ops-factory.js");
    expect(typeof create_channel_ops).toBe("function");
  });

  it("DashboardAgentProviderOps factory exists", async () => {
    const { create_agent_provider_ops } = await import("@src/dashboard/ops-factory.js");
    expect(typeof create_agent_provider_ops).toBe("function");
  });

  it("ChatChannel method count matches expected (18 methods + 2 properties)", () => {
    expect(CHAT_CHANNEL_METHODS).toHaveLength(18);
    expect(CHAT_CHANNEL_PROPERTIES).toHaveLength(2);
  });
});
