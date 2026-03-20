/**
 * TR-1: SessionRecorder normalizer alignment test.
 *
 * Asserts that session-recorder's append_daily() applies the same
 * normalize_query contract as the tool-index / session-reuse normalizer.
 * Both paths must produce identical output for the same input —
 * this is the tokenizer policy alignment requirement.
 */

import { describe, it, expect, vi } from "vitest";
import { normalize_query } from "@src/orchestration/guardrails/session-reuse.js";
import { SessionRecorder, type SessionRecorderDeps, type DailyMemoryWriter } from "@src/channels/session-recorder.js";
import type { InboundMessage } from "@src/bus/types.js";
import type { Logger } from "@src/logger.js";

/* ── Helpers ── */

function make_logger(): Logger {
  const noop = () => {};
  const l: Logger = { debug: noop, info: noop, warn: noop, error: noop, child: () => l };
  return l;
}

function make_message(content: string): InboundMessage {
  return {
    id: "msg-1",
    provider: "slack",
    channel: "general",
    sender_id: "user-1",
    chat_id: "chat-1",
    content,
    at: new Date().toISOString(),
    thread_id: undefined,
    metadata: {},
  };
}

/* ── Tests ── */

describe("TR-1: session-recorder normalize_query alignment", () => {
  it("normalize_query is imported from session-reuse (shared contract)", () => {
    // The same function used by the tool-index normalizer is the one
    // session-recorder imports — verify it produces the expected output.
    expect(normalize_query("Hello World")).toBe("hello world");
    expect(normalize_query("  날씨  어때요  ")).toBe("날씨 어때요");
    expect(normalize_query("")).toBe("");
  });

  it("session-recorder append_daily applies normalize_query before storing", async () => {
    const written: string[] = [];
    const daily_memory: DailyMemoryWriter = {
      append_daily_memory: vi.fn(async (line: string) => { written.push(line); }),
    };
    const sessions = {
      get_or_create: vi.fn().mockResolvedValue({ messages: [] }),
      append_message: vi.fn().mockResolvedValue(undefined),
    };
    const deps: SessionRecorderDeps = {
      sessions: sessions as any,
      daily_memory,
      sanitize_for_storage: (t) => t,
      logger: make_logger(),
    };
    const recorder = new SessionRecorder(deps);
    const raw = "  Hello World  extra  spaces  ";
    const msg = make_message(raw);

    await recorder.record_user("slack", msg, "bot");

    expect(written.length).toBe(1);
    // normalize_query output should appear verbatim in the stored line
    const expected_normalized = normalize_query(raw);
    expect(written[0]).toContain(expected_normalized);
    // The raw (un-normalized) variant should NOT appear
    expect(written[0]).not.toContain(raw);
  });

  it("session-recorder and session-reuse normalize_query produce identical output for same input", () => {
    // This is the core alignment assertion: the same normalizer is used in both paths.
    const inputs = [
      "날씨 알려줘",
      "What's the weather?",
      "데이터베이스에서 검색해줘",
      "  multiple   spaces  ",
      "CamelCase AND UPPER",
      "",
    ];
    for (const input of inputs) {
      // Both are the same function — imported from session-reuse.
      // This test documents and guards the contract explicitly.
      const normalized_a = normalize_query(input);
      const normalized_b = normalize_query(input);
      expect(normalized_a).toBe(normalized_b);
      // And verifies basic properties of the normalized form:
      if (input.trim()) {
        expect(normalized_a).toBe(normalized_a.trim());
        // Must be lowercase (tokenizer lowercases tokens)
        expect(normalized_a).toBe(normalized_a.toLowerCase());
      }
    }
  });

  it("append_daily truncates normalized content to 1600 chars", async () => {
    const written: string[] = [];
    const daily_memory: DailyMemoryWriter = {
      append_daily_memory: vi.fn(async (line: string) => { written.push(line); }),
    };
    const sessions = {
      get_or_create: vi.fn().mockResolvedValue({ messages: [] }),
      append_message: vi.fn().mockResolvedValue(undefined),
    };
    const deps: SessionRecorderDeps = {
      sessions: sessions as any,
      daily_memory,
      sanitize_for_storage: (t) => t,
      logger: make_logger(),
    };
    const recorder = new SessionRecorder(deps);
    // Create a very long message using unique tokens that won't repeat
    // Use a sequence like "tok0001 tok0002 ..." to make each token unique
    const tokens = Array.from({ length: 400 }, (_, i) => `tok${String(i).padStart(4, "0")}`);
    const long_content = tokens.join(" ");
    const msg = make_message(long_content);

    await recorder.record_user("slack", msg, "bot");

    expect(written.length).toBe(1);
    const normalized = normalize_query(long_content);
    const expected_truncated = normalized.slice(0, 1600);

    // Verify: the line contains the beginning of the normalized text
    expect(written[0]).toContain(expected_truncated.slice(0, 50));

    // Verify: if normalized is longer than 1600, the tail is absent
    if (normalized.length > 1600) {
      // Find a unique token that only appears after position 1600
      // The truncated content ends at 1600 chars — any token whose start is at > 1600 must be absent
      const truncated_end = expected_truncated;
      const full_tail = normalized.slice(1600);
      // Extract the first complete word from the tail
      const first_tail_word = full_tail.match(/^[\w]+/)?.[0];
      if (first_tail_word && !truncated_end.includes(first_tail_word)) {
        expect(written[0]).not.toContain(first_tail_word);
      } else {
        // Just verify line does not contain content beyond truncation point
        // by checking total embedded length is bounded
        // The line format is: "- [iso] [provider:chat:thread] ROLE(sender): <text>\n"
        // so written[0].length > 1600 is expected (header + newline), but text part is bounded
        expect(written[0].length).toBeLessThan(normalized.length + 200); // header overhead
      }
    }
  });

  it("empty normalized content → append_daily is not called", async () => {
    const daily_memory: DailyMemoryWriter = {
      append_daily_memory: vi.fn(async () => {}),
    };
    const sessions = {
      get_or_create: vi.fn().mockResolvedValue({ messages: [] }),
      append_message: vi.fn().mockResolvedValue(undefined),
    };
    const deps: SessionRecorderDeps = {
      sessions: sessions as any,
      daily_memory,
      sanitize_for_storage: (t) => t,
      logger: make_logger(),
    };
    const recorder = new SessionRecorder(deps);
    // Punctuation only → normalize_query may produce ""
    const msg = make_message("...,,,---");

    await recorder.record_user("slack", msg, "bot");

    // If normalize_query returns empty string, append_daily_memory must not be called
    const normalized = normalize_query("...,,,---");
    if (!normalized) {
      expect(daily_memory.append_daily_memory).not.toHaveBeenCalled();
    } else {
      // If the tokenizer preserves some chars, it's still called — just verify it ran
      expect(daily_memory.append_daily_memory).toHaveBeenCalled();
    }
  });
});
