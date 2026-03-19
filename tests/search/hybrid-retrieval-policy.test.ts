/**
 * TR-3: HybridRetrievalPolicy 계약 테스트.
 *
 * 검증 항목:
 * 1. lexical-only 폴백 — vector_port=null 시 BM25 순위 그대로 반환
 * 2. 하이브리드 RRF merge — 벡터 포트 주입 시 RRF 융합 적용
 * 3. 벡터 unavailable 폴백 — knn_search 빈 배열 반환 시 lexical-only
 * 4. 벡터 오류 폴백 — knn_search throw 시 lexical-only로 안전 폴백
 * 5. MMR merge — merge_strategy="mmr" 시 MMR 리랭킹 적용
 * 6. has_vector 플래그 — 포트 주입 여부 반영
 * 7. limit 준수 — 반환 개수가 limit를 초과하지 않음
 * 8. 팩토리 함수 — create_lexical_only_policy, create_hybrid_policy
 */
import { describe, it, expect, vi } from "vitest";
import {
  DefaultHybridRetrievalPolicy,
  create_lexical_only_policy,
  create_hybrid_policy,
} from "../../src/search/hybrid-retrieval-policy.js";
import type {
  HybridRetrievalPolicy,
  LexicalCandidate,
  VectorAugmentPort,
} from "../../src/search/hybrid-retrieval-policy.js";

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

/** 가중치 없는 순위 기반 LexicalCandidate 목록 생성. */
function make_candidates(ids: string[]): LexicalCandidate[] {
  return ids.map((id, i) => ({ id, bm25_score: ids.length - i }));
}

/** 고정 결과를 반환하는 stub VectorAugmentPort 생성. */
function make_vec_port(results: string[]): VectorAugmentPort {
  return {
    knn_search: vi.fn().mockResolvedValue(results),
  };
}

/** 항상 throw하는 오류 VectorAugmentPort 생성. */
function make_error_port(): VectorAugmentPort {
  return {
    knn_search: vi.fn().mockRejectedValue(new Error("vector store unavailable")),
  };
}

// ── lexical-only 폴백 ─────────────────────────────────────────────────────────

describe("HybridRetrievalPolicy — lexical-only 폴백", () => {
  it("vector_port=null이면 BM25 순위 그대로 상위 limit개 반환", async () => {
    const policy: HybridRetrievalPolicy = new DefaultHybridRetrievalPolicy({ vector_port: null });
    const candidates = make_candidates(["a", "b", "c", "d", "e"]);
    const result = await policy.retrieve("query", candidates, 3);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("has_vector가 false", () => {
    const policy = new DefaultHybridRetrievalPolicy({ vector_port: null });
    expect(policy.has_vector).toBe(false);
  });

  it("빈 BM25 후보 목록이면 빈 배열 반환", async () => {
    const policy = new DefaultHybridRetrievalPolicy();
    const result = await policy.retrieve("query", [], 5);
    expect(result).toEqual([]);
  });

  it("limit이 후보 수보다 크면 후보 전체 반환", async () => {
    const policy = new DefaultHybridRetrievalPolicy({ vector_port: null });
    const candidates = make_candidates(["x", "y"]);
    const result = await policy.retrieve("query", candidates, 10);
    expect(result).toEqual(["x", "y"]);
  });
});

// ── 하이브리드 RRF merge ──────────────────────────────────────────────────────

describe("HybridRetrievalPolicy — 하이브리드 RRF merge", () => {
  it("벡터 포트가 결과를 반환하면 RRF 융합 적용", async () => {
    const vec_port = make_vec_port(["c", "b", "a"]);
    const policy = create_hybrid_policy(vec_port);
    // BM25: a > b > c, 벡터: c > b > a → RRF로 b, c, a 순서 예상
    const candidates = make_candidates(["a", "b", "c"]);
    const result = await policy.retrieve("query", candidates, 3);
    // 결과가 3개여야 함 (정확한 순서는 RRF 알고리즘 의존)
    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set(["a", "b", "c"]));
  });

  it("has_vector가 true", () => {
    const policy = create_hybrid_policy(make_vec_port([]));
    expect(policy.has_vector).toBe(true);
  });

  it("limit 준수 — 결과 수가 limit를 초과하지 않음", async () => {
    const vec_port = make_vec_port(["d", "e", "a", "b", "c"]);
    const policy = create_hybrid_policy(vec_port);
    const candidates = make_candidates(["a", "b", "c", "d", "e"]);
    const result = await policy.retrieve("query", candidates, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("BM25 전용 ID + 벡터 전용 ID가 모두 결과에 포함 가능", async () => {
    // BM25: a, b / 벡터: b, c (b는 공통, c는 벡터 전용)
    const vec_port = make_vec_port(["b", "c"]);
    const policy = create_hybrid_policy(vec_port);
    const candidates = make_candidates(["a", "b"]);
    const result = await policy.retrieve("query", candidates, 3);
    // RRF는 c도 결과에 포함 (vec_ranked에만 있어도 점수 부여)
    expect(result).toContain("b");
    // c는 벡터에만 있음 — 포함되어야 함
    expect(result).toContain("c");
  });
});

// ── 벡터 unavailable 폴백 ────────────────────────────────────────────────────

describe("HybridRetrievalPolicy — 벡터 unavailable 폴백", () => {
  it("knn_search가 빈 배열 반환하면 lexical-only 폴백", async () => {
    const vec_port = make_vec_port([]);
    const policy = create_hybrid_policy(vec_port);
    const candidates = make_candidates(["a", "b", "c"]);
    const result = await policy.retrieve("query", candidates, 3);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("knn_search throw 시 lexical-only로 안전 폴백 (예외 전파 없음)", async () => {
    const policy = create_hybrid_policy(make_error_port());
    const candidates = make_candidates(["x", "y", "z"]);
    // 예외 전파 없어야 함
    await expect(policy.retrieve("query", candidates, 3)).resolves.toEqual(["x", "y", "z"]);
  });

  it("벡터 오류 후에도 BM25 순위 유지", async () => {
    const policy = create_hybrid_policy(make_error_port());
    const candidates = make_candidates(["p", "q", "r", "s"]);
    const result = await policy.retrieve("query", candidates, 2);
    expect(result).toEqual(["p", "q"]);
  });
});

// ── MMR merge ─────────────────────────────────────────────────────────────────

describe("HybridRetrievalPolicy — MMR merge", () => {
  it("merge_strategy=mmr 시 MMR 리랭킹 적용", async () => {
    const vec_port = make_vec_port(["c", "b", "a"]);
    const policy = new DefaultHybridRetrievalPolicy({
      vector_port: vec_port,
      merge_strategy: "mmr",
      mmr_lambda: 0.7,
    });
    const candidates = make_candidates(["a", "b", "c"]);
    const result = await policy.retrieve("query", candidates, 3);
    // MMR 결과도 limit 준수 + 모든 후보 포함
    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set(["a", "b", "c"]));
  });

  it("MMR lambda=1.0이면 RRF와 동일한 관련도 정렬", async () => {
    const vec_port = make_vec_port(["a", "b", "c"]);
    const policy_mmr = new DefaultHybridRetrievalPolicy({
      vector_port: vec_port,
      merge_strategy: "mmr",
      mmr_lambda: 1.0,
    });
    const policy_rrf = create_hybrid_policy(make_vec_port(["a", "b", "c"]));
    const candidates = make_candidates(["a", "b", "c"]);
    const mmr_result = await policy_mmr.retrieve("query", candidates, 3);
    const rrf_result = await policy_rrf.retrieve("query", candidates, 3);
    // lambda=1이면 순수 관련도 → RRF와 동일 순서
    expect(mmr_result).toEqual(rrf_result);
  });
});

// ── 팩토리 함수 ───────────────────────────────────────────────────────────────

describe("팩토리 함수", () => {
  it("create_lexical_only_policy — has_vector=false, lexical 순위 반환", async () => {
    const policy = create_lexical_only_policy();
    expect(policy.has_vector).toBe(false);
    const candidates = make_candidates(["m", "n", "o"]);
    const result = await policy.retrieve("query", candidates, 2);
    expect(result).toEqual(["m", "n"]);
  });

  it("create_hybrid_policy — has_vector=true", () => {
    const policy = create_hybrid_policy(make_vec_port(["a"]));
    expect(policy.has_vector).toBe(true);
  });

  it("create_hybrid_policy — merge_strategy 옵션 전달", async () => {
    const port = make_vec_port(["b", "a"]);
    const policy = create_hybrid_policy(port, { merge_strategy: "mmr" });
    const candidates = make_candidates(["a", "b"]);
    const result = await policy.retrieve("query", candidates, 2);
    expect(result).toHaveLength(2);
  });
});
