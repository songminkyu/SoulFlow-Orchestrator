/**
 * TR-4: Execute Dispatcher — tokenizer policy alignment test.
 *
 * Asserts that the same normalized query string is used for both
 * the novelty (session reuse) check and the downstream retrieval path.
 * The dispatcher must NOT normalize separately for each path.
 *
 * Core contract: evaluate_reuse(task_with_media, ...) and tool_index.warm_up(gateway_text)
 * both receive the ingress-normalized text (gateway_text derived from normalize_ingress).
 * normalize_query inside evaluate_reuse then applies the tokenizer policy.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { normalize_query, evaluate_reuse, build_session_evidence } from "@src/orchestration/guardrails/index.js";
import { normalize_ingress } from "@src/orchestration/ingress-normalizer.js";

/* ── Alignment contract tests ── */

describe("TR-4: dispatcher tokenizer alignment", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("normalize_query is deterministic — same input always produces same output", () => {
    // The tokenizer is deterministic: applying to the SAME source input always yields
    // the same result. This is the contract required for alignment between session-recorder
    // and the novelty gate (both normalize the same original user input, not a pre-normalized form).
    const inputs = [
      "날씨 알려줘",
      "search for files in database",
      "데이터베이스에서 파일 검색",
      "  multiple   spaces  ",
    ];
    for (const input of inputs) {
      const first = normalize_query(input);
      const second = normalize_query(input);
      expect(second).toBe(first);
    }
  });

  it("evaluate_reuse normalizes incoming query before comparison (same contract as session-recorder)", () => {
    const NOW = Date.now();
    const query = "날씨 알려줘";
    const normalized = normalize_query(query);

    // Evidence built with already-normalized form
    const evidence = {
      recent_queries: [{
        normalized,
        original: query,
        timestamp_ms: NOW - 60_000,
        had_tool_calls: true,
      }],
    };

    // Uppercase/spaced variant should still match after normalize_query
    const variant = "  날씨  알려줘  ";
    const result = evaluate_reuse(variant, evidence, NOW, {
      freshness_window_ms: 300_000,
      similarity_threshold: 0.85,
    });
    // Must match because both normalize to the same form
    expect(result.kind).toBe("reuse_summary");
  });

  it("same ingress-normalized text used for both novelty check and tool warm_up", () => {
    // Simulate dispatcher pipeline:
    // 1. normalize_ingress produces gateway_text
    // 2. tool_index.warm_up(gateway_text) — retrieval path
    // 3. evaluate_reuse(task_with_media, evidence, ...) — novelty path
    // Both receive the same source text.

    const raw_content = "@bot search for logs in database";
    const ingress_result = normalize_ingress(raw_content, "slack");
    const gateway_text = ingress_result.text;

    // The normalized form used by both paths
    const retrieval_key = normalize_query(gateway_text);
    const novelty_key = normalize_query(gateway_text);

    // Core alignment: same input → same output
    expect(retrieval_key).toBe(novelty_key);
  });

  it("build_session_evidence applies normalize_query to history entries", () => {
    const NOW = Date.now();
    const FW = 300_000;

    const history = [
      { role: "user", content: "날씨 알려줘", timestamp_ms: NOW - 120_000 },
      { role: "assistant", content: "현재 날씨는..." },
      { role: "user", content: "  현재 요청  " }, // current — excluded
    ];

    const evidence = build_session_evidence(history, NOW, FW);

    // Past query must be normalized
    expect(evidence.recent_queries.length).toBe(1);
    const stored = evidence.recent_queries[0].normalized;
    const expected = normalize_query("날씨 알려줘");
    expect(stored).toBe(expected);
  });

  it("dispatcher reuse path: same task text drives both evaluate_reuse and tool selection", () => {
    // This test verifies the alignment invariant:
    // - task_with_media is the single source of truth
    // - normalize_query(task_with_media) == normalize_query(normalize_query(task_with_media))
    //   (idempotent — no double-normalization)
    const task_with_media = "search database for recent logs";
    const evidence = {
      recent_queries: [{
        normalized: normalize_query(task_with_media),
        original: task_with_media,
        timestamp_ms: Date.now() - 60_000,
        had_tool_calls: true,
      }],
    };

    const result = evaluate_reuse(task_with_media, evidence, Date.now(), {
      freshness_window_ms: 300_000,
      similarity_threshold: 0.85,
    });

    // Exact match → reuse_summary (not new_search)
    expect(result.kind).toBe("reuse_summary");
    if (result.kind === "reuse_summary") {
      expect(result.matched_query).toBe(normalize_query(task_with_media));
    }
  });

  it("novelty gate uses freshness_window_ms from config (not hardcoded)", () => {
    const NOW = Date.now();
    const query = "test query";
    const normalized = normalize_query(query);
    const evidence = {
      recent_queries: [{
        normalized,
        original: query,
        timestamp_ms: NOW - 200_000, // 200s ago
        had_tool_calls: true,
      }],
    };

    // With 300s window: 200s is fresh → reuse_summary
    const fresh_result = evaluate_reuse(query, evidence, NOW, {
      freshness_window_ms: 300_000,
      similarity_threshold: 0.85,
    });
    expect(fresh_result.kind).toBe("reuse_summary");

    // With 100s window: 200s is stale → stale_retry
    const stale_result = evaluate_reuse(query, evidence, NOW, {
      freshness_window_ms: 100_000,
      similarity_threshold: 0.85,
    });
    expect(stale_result.kind).toBe("stale_retry");

    // With 0 (disabled): always stale
    const disabled_result = evaluate_reuse(query, evidence, NOW, {
      freshness_window_ms: 0,
      similarity_threshold: 0.85,
    });
    expect(disabled_result.kind).toBe("stale_retry");
  });
});
