/** Retriever 도구 — 벡터 스토어/메모리/HTTP 소스에서 관련 결과 검색. */

import { Tool } from "./base.js";
import type { JsonSchema, ToolExecutionContext } from "./types.js";
import { make_abort_signal } from "../../utils/common.js";
import { HTTP_FETCH_TIMEOUT_MS } from "../../utils/timeouts.js";
import type { ReferenceStoreLike, VectorRetrievalEnvelope } from "../../services/reference-store.js";
import { to_retrieval_item } from "../../services/reference-store.js";

export class RetrieverTool extends Tool {
  readonly name = "retriever";
  readonly category = "ai" as const;
  readonly description = "Retrieve relevant results from vector stores, memory, or HTTP APIs. Actions: vector, http, memory.";
  readonly policy_flags = { network: true };
  readonly parameters: JsonSchema = {
    type: "object",
    properties: {
      action: { type: "string", enum: ["vector", "http", "memory"], description: "Retrieval source" },
      query: { type: "string", description: "Search query text" },
      top_k: { type: "integer", description: "Max results to return (default: 5)" },
      url: { type: "string", description: "HTTP API endpoint (for http action)" },
      collection: { type: "string", description: "Vector store collection name (for vector action)" },
      data: { type: "string", description: "JSON object to search in (for memory action)" },
      min_score: { type: "number", description: "Minimum similarity score 0-1 (for vector action)" },
    },
    required: ["action", "query"],
    additionalProperties: false,
  };

  private _reference_store: ReferenceStoreLike | null = null;
  private _skill_ref_store: ReferenceStoreLike | null = null;

  /** workspace references 스토어 주입. */
  set_reference_store(store: ReferenceStoreLike): void { this._reference_store = store; }

  /** skill references 스토어 주입. */
  set_skill_ref_store(store: ReferenceStoreLike): void { this._skill_ref_store = store; }

  protected async run(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const action = String(params.action || "memory");
    const query = String(params.query || "");
    const top_k = Math.max(1, Math.min(100, Number(params.top_k) || 5));

    switch (action) {
      case "http": return this.retrieve_http(query, top_k, params, context);
      case "memory": return this.retrieve_memory(query, top_k, params);
      case "vector": return this.retrieve_vector(query, top_k, params);
      default: return `Error: unsupported action "${action}"`;
    }
  }

  private async retrieve_http(query: string, top_k: number, params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const url = String(params.url || "");
    if (!url) return "Error: url is required for http action";

    const sep = url.includes("?") ? "&" : "?";
    const resp = await fetch(`${url}${sep}q=${encodeURIComponent(query)}&top_k=${top_k}`, {
      headers: { "Accept": "application/json" },
      signal: make_abort_signal(HTTP_FETCH_TIMEOUT_MS, context?.signal),
    });
    if (!resp.ok) return `Error: HTTP ${resp.status} ${resp.statusText}`;
    const body = await resp.json() as unknown;
    const results = Array.isArray(body) ? body.slice(0, top_k) : [body];
    return JSON.stringify({ results, count: results.length, source: "http" });
  }

  private retrieve_memory(query: string, top_k: number, params: Record<string, unknown>): string {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(String(params.data || "{}"));
    } catch {
      return "Error: data must be valid JSON object";
    }

    const lower = query.toLowerCase();
    const results: Array<{ key: string; value: unknown; score: number }> = [];

    for (const [key, value] of Object.entries(data)) {
      const str = typeof value === "string" ? value : JSON.stringify(value);
      const keyStr = key.toLowerCase();
      if (str.toLowerCase().includes(lower) || keyStr.includes(lower)) {
        const score = this.simple_relevance(lower, str.toLowerCase());
        results.push({ key, value, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return JSON.stringify({ results: results.slice(0, top_k), count: Math.min(results.length, top_k), source: "memory" });
  }

  /**
   * vector action: ReferenceStoreLike 스토어에서 실제 검색 결과를 반환한다.
   * - collection이 없으면 에러.
   * - 스토어가 주입되지 않았으면 에러 (placeholder 제거됨).
   * - 두 스토어(reference + skill)를 모두 조회하여 score 순 병합 후 top_k 반환.
   */
  private async retrieve_vector(query: string, top_k: number, params: Record<string, unknown>): Promise<string> {
    const collection = String(params.collection || "");
    if (!collection) return "Error: collection is required for vector action";

    const min_score = Number(params.min_score) || 0;
    const base: Omit<VectorRetrievalEnvelope, "results" | "count"> = {
      source: "vector",
      query,
      collection,
      top_k,
      min_score,
    };

    if (!this._reference_store && !this._skill_ref_store) {
      return "Error: no reference store configured for vector action";
    }

    // 두 스토어에서 병렬 조회 후 결과 병합
    const [ref_raw, skill_raw] = await Promise.all([
      this._reference_store?.search(query, { limit: top_k * 2, doc_filter: collection }) ?? Promise.resolve([]),
      this._skill_ref_store?.search(query, { limit: top_k * 2, doc_filter: collection }) ?? Promise.resolve([]),
    ]);

    const seen = new Set<string>();
    const merged = [...ref_raw, ...skill_raw]
      .map((r) => to_retrieval_item(r))
      .filter((item) => {
        if (item.score < min_score) return false;
        if (seen.has(item.chunk_id)) return false;
        seen.add(item.chunk_id);
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, top_k);

    const envelope: VectorRetrievalEnvelope = { ...base, results: merged, count: merged.length };
    return JSON.stringify(envelope);
  }

  private simple_relevance(query: string, text: string): number {
    const words = query.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;
    let matched = 0;
    for (const word of words) {
      if (text.includes(word)) matched++;
    }
    return matched / words.length;
  }
}
