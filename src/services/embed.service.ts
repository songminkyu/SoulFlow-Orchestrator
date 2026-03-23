/** OpenAI 호환 embedding 서비스 (OpenRouter, Ollama, vLLM 등). */

import { create_logger } from "../logger.js";
import { HTTP_FETCH_TIMEOUT_MS } from "../utils/timeouts.js";

const log = create_logger("embed-service");

const DEFAULT_MODEL = "openai/text-embedding-3-small";
const DEFAULT_TIMEOUT_MS = HTTP_FETCH_TIMEOUT_MS;
const MAX_BATCH_SIZE = 96;

// ── LRU 캐시 설정 ──────────────────────────────────────────────────────────
const MAX_CACHE_ENTRIES = 256;
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  embedding: number[];
  expires_at: number;
}

/** 삽입 순서 기반 LRU 캐시. Map의 순서 보장을 활용. */
function create_lru_cache() {
  const store = new Map<string, CacheEntry>();

  function make_key(model: string, dimensions: number | undefined, text: string): string {
    return `${model}::${dimensions ?? ""}::${text}`;
  }

  function get(key: string): number[] | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires_at) {
      store.delete(key);
      return undefined;
    }
    // LRU: 접근 시 삭제 후 재삽입 → 맨 뒤로 이동
    store.delete(key);
    store.set(key, entry);
    return entry.embedding;
  }

  function set(key: string, embedding: number[]): void {
    // 이미 존재하면 삭제 (순서 갱신)
    if (store.has(key)) store.delete(key);
    // 용량 초과 시 가장 오래된(맨 앞) 항목 제거
    while (store.size >= MAX_CACHE_ENTRIES) {
      const oldest_key = store.keys().next().value;
      if (oldest_key !== undefined) store.delete(oldest_key);
    }
    store.set(key, { embedding, expires_at: Date.now() + CACHE_TTL_MS });
  }

  return { get, set, make_key, get size() { return store.size; } };
}

export interface EmbedServiceDeps {
  get_api_key: () => Promise<string | null>;
  api_base?: string;
  /** true이면 API 키 없이 요청 (Ollama 등 로컬 서비스). */
  skip_auth?: boolean;
  /** 기본 모델. */
  default_model?: string;
}

/** OpenAI 호환 /embeddings 엔드포인트로 텍스트 → 벡터 변환. */
export function create_embed_service(deps: EmbedServiceDeps) {
  const api_base = deps.api_base || "https://openrouter.ai/api/v1";
  const default_model = deps.default_model || DEFAULT_MODEL;
  const cache = create_lru_cache();

  return async (
    texts: string[],
    opts: { model?: string; dimensions?: number },
  ): Promise<{ embeddings: number[][]; token_usage?: number }> => {
    const api_key = deps.skip_auth ? null : await deps.get_api_key();
    if (!api_key && !deps.skip_auth) throw new Error("embedding API key not configured");

    const model = opts.model || default_model;

    // ── 캐시 조회: 히트/미스 분리 ──
    const results: (number[] | null)[] = texts.map((text) => {
      const key = cache.make_key(model, opts.dimensions, text);
      return cache.get(key) ?? null;
    });

    const miss_indices: number[] = [];
    for (let i = 0; i < results.length; i++) {
      if (results[i] === null) miss_indices.push(i);
    }

    const hit_count = texts.length - miss_indices.length;
    if (hit_count > 0) {
      log.debug("embedding cache hit", { model, count: hit_count });
    }

    // ── 캐시 미스만 API 호출 ──
    let total_tokens = 0;
    if (miss_indices.length > 0) {
      const miss_texts = miss_indices.map((i) => texts[i]);

      for (let i = 0; i < miss_texts.length; i += MAX_BATCH_SIZE) {
        const batch = miss_texts.slice(i, i + MAX_BATCH_SIZE);
        const batch_miss_indices = miss_indices.slice(i, i + MAX_BATCH_SIZE);

        const body: Record<string, unknown> = { model, input: batch };
        if (opts.dimensions) body.dimensions = opts.dimensions;

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (api_key) headers.Authorization = `Bearer ${api_key}`;

        const res = await fetch(`${api_base}/embeddings`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
        });

        if (!res.ok) {
          const err = await res.text().catch(() => "");
          log.warn("embedding API error", { status: res.status, model, api_base });
          throw new Error(`Embedding API error (${res.status}): ${err.slice(0, 200)}`);
        }

        const json = await res.json() as {
          data: Array<{ embedding: number[]; index: number }>;
          usage?: { total_tokens?: number };
        };

        // index 순으로 정렬
        const sorted = json.data.sort((a, b) => a.index - b.index);
        for (let j = 0; j < sorted.length; j++) {
          const embedding = sorted[j].embedding;
          const original_idx = batch_miss_indices[j];
          results[original_idx] = embedding;

          // 캐시에 저장
          const key = cache.make_key(model, opts.dimensions, texts[original_idx]);
          cache.set(key, embedding);
        }
        total_tokens += json.usage?.total_tokens ?? 0;
      }
    }

    log.info("embed", { model, count: texts.length, hits: hit_count, misses: miss_indices.length, tokens: total_tokens, api_base });
    return { embeddings: results as number[][], token_usage: total_tokens || undefined };
  };
}

/** 등록된 프로바이더 인스턴스 정보로 embed service 생성. */
export interface EmbedFromProviderOpts {
  provider_type: string;
  model?: string;
  api_base?: string;
  get_api_key: () => Promise<string | null>;
}

const SKIP_AUTH_PROVIDERS = new Set(["ollama", "orchestrator_llm"]);

export function create_embed_service_from_provider(opts: EmbedFromProviderOpts) {
  const skip_auth = SKIP_AUTH_PROVIDERS.has(opts.provider_type);
  return create_embed_service({
    get_api_key: opts.get_api_key,
    api_base: opts.api_base,
    skip_auth,
    default_model: opts.model || DEFAULT_MODEL,
  });
}

// ── 멀티모달 임베딩 ──────────────────────────────────────────────────────────

/** 이미지 + 텍스트 혼합 임베딩 입력. */
export type ImageEmbedInput = string | { image_data_url: string };

/**
 * 멀티모달 임베딩 함수 타입.
 * jina-clip-v2, voyage-multimodal-3 등 텍스트·이미지를 같은 벡터 공간에 임베딩하는 모델에 사용.
 */
export type ImageEmbedFn = (
  inputs: ImageEmbedInput[],
  opts: { model?: string; dimensions?: number },
) => Promise<{ embeddings: number[][] }>;

/**
 * 멀티모달 /embeddings 서비스.
 * - 텍스트 입력: { "text": "..." } 포맷
 * - 이미지 입력: { "image": "<data_url>" } 포맷 (jina-clip-v2 호환)
 */
export function create_multimodal_embed_service(deps: EmbedServiceDeps): ImageEmbedFn {
  const api_base = deps.api_base || "https://openrouter.ai/api/v1";
  const default_model = deps.default_model || "jina-ai/jina-clip-v2";

  return async (
    inputs: ImageEmbedInput[],
    opts: { model?: string; dimensions?: number },
  ): Promise<{ embeddings: number[][] }> => {
    const api_key = deps.skip_auth ? null : await deps.get_api_key();
    if (!api_key && !deps.skip_auth) throw new Error("image embedding API key not configured");

    const model = opts.model || default_model;
    const all_embeddings: number[][] = [];

    for (let i = 0; i < inputs.length; i += MAX_BATCH_SIZE) {
      const batch = inputs.slice(i, i + MAX_BATCH_SIZE);

      // jina-clip-v2 형식: [{ "text": "..." } | { "image": "<url_or_base64>" }]
      const input_items = batch.map((item) =>
        typeof item === "string" ? { text: item } : { image: item.image_data_url },
      );

      const body: Record<string, unknown> = { model, input: input_items };
      if (opts.dimensions) body.dimensions = opts.dimensions;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (api_key) headers.Authorization = `Bearer ${api_key}`;

      const res = await fetch(`${api_base}/embeddings`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        log.warn("multimodal embedding API error", { status: res.status, model });
        throw new Error(`Multimodal embedding API error (${res.status}): ${err.slice(0, 200)}`);
      }

      const json = await res.json() as {
        data: Array<{ embedding: number[]; index: number }>;
      };
      const sorted = json.data.sort((a, b) => a.index - b.index);
      for (const item of sorted) all_embeddings.push(item.embedding);
    }

    log.info("image-embed", { model, count: inputs.length, api_base });
    return { embeddings: all_embeddings };
  };
}

export function create_multimodal_embed_service_from_provider(opts: EmbedFromProviderOpts): ImageEmbedFn {
  const skip_auth = SKIP_AUTH_PROVIDERS.has(opts.provider_type);
  return create_multimodal_embed_service({
    get_api_key: opts.get_api_key,
    api_base: opts.api_base,
    skip_auth,
    default_model: opts.model,
  });
}
