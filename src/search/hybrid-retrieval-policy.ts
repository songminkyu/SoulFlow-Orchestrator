/**
 * TR-3: HybridRetrievalPolicy — BM25 + 벡터 KNN 하이브리드 검색 계약 및 구현.
 *
 * 역할:
 * - BM25 후보 목록을 생성하는 계약(HybridRetrievalPolicy)을 정의
 * - 벡터 augmentation(선택적 포트) 계약(VectorAugmentPort)을 정의
 * - RRF/MMR merge 계약(MergeStrategy) 래핑
 * - 벡터 미사용 시 lexical-only 폴백
 *
 * 소비자: tool-index (인메모리 역인덱스), memory-store (청크 검색) 등.
 */

import { rrf_merge, mmr_rerank } from "../agent/memory-scoring.js";
import type { ScoredChunk } from "../agent/memory-scoring.js";

// ── 계약 ─────────────────────────────────────────────────────────────────────

/**
 * BM25 기반 어휘 검색 결과. 순위 배열로 반환 (RRF 입력).
 */
export interface LexicalCandidate {
  /** 청크/문서 식별자. */
  readonly id: string;
  /** BM25 원점수. RRF에서는 순위만 사용, 직접 비교 불필요. */
  readonly bm25_score: number;
}

/**
 * 벡터 KNN augmentation 포트 계약.
 * 구현체(sqlite-vec, pgvector, in-memory HNSW 등)는 이 인터페이스를 구현.
 * 미사용 시 null을 주입하여 lexical-only 폴백.
 */
export interface VectorAugmentPort {
  /**
   * 쿼리 텍스트에 대해 가장 유사한 k개 청크 ID를 순위 순으로 반환.
   * 오류 시 빈 배열을 반환하며 예외를 던지지 않음.
   */
  knn_search(query: string, k: number): Promise<string[]>;
}

/**
 * RRF/MMR 중 하나를 선택하는 merge 전략 열거.
 * - "rrf": Reciprocal Rank Fusion — 기본값. 점수 스케일 무관 융합.
 * - "mmr": Maximal Marginal Relevance — 다양성 우선 리랭킹.
 */
export type MergeStrategy = "rrf" | "mmr";

/** HybridRetrievalPolicy 생성 옵션. */
export interface HybridRetrievalOptions {
  /**
   * 벡터 augmentation 포트. null이면 lexical-only 폴백.
   * @default null
   */
  vector_port?: VectorAugmentPort | null;
  /**
   * merge 전략.
   * @default "rrf"
   */
  merge_strategy?: MergeStrategy;
  /**
   * RRF 파라미터 k. 낮을수록 상위 순위 집중.
   * @default 60
   */
  rrf_k?: number;
  /**
   * MMR lambda. 1이면 순수 관련도, 0이면 최대 다양성.
   * @default 0.7
   */
  mmr_lambda?: number;
}

/**
 * 하이브리드 검색 계약.
 * BM25 후보 + 선택적 벡터 KNN 보강 → RRF/MMR 병합.
 */
export interface HybridRetrievalPolicy {
  /**
   * 검색을 실행하고 병합된 청크 ID 순위 배열을 반환.
   *
   * @param query 검색 쿼리 텍스트
   * @param bm25_candidates BM25 후보 목록 (호출자가 생성, 내림차순 정렬)
   * @param limit 반환할 최대 결과 수
   * @returns 병합 후 순위 정렬된 청크 ID 배열
   */
  retrieve(
    query: string,
    bm25_candidates: LexicalCandidate[],
    limit: number,
  ): Promise<string[]>;

  /**
   * 벡터 포트가 주입되어 있는지 여부. false이면 lexical-only 모드.
   */
  readonly has_vector: boolean;
}

// ── 구현 ──────────────────────────────────────────────────────────────────────

/**
 * 기본 HybridRetrievalPolicy 구현.
 *
 * 1. bm25_candidates 순위 배열 추출 (FTS_ranked)
 * 2. 벡터 포트가 있으면 knn_search 호출 (vec_ranked)
 * 3. merge_strategy에 따라 RRF 또는 MMR 적용
 * 4. 상위 limit개 반환
 *
 * 벡터 미사용(lexical-only 폴백):
 * - vector_port가 null이거나 knn_search가 빈 배열을 반환하면
 *   bm25_candidates 순위 그대로 상위 limit개 반환.
 */
export class DefaultHybridRetrievalPolicy implements HybridRetrievalPolicy {
  private readonly vector_port: VectorAugmentPort | null;
  private readonly merge_strategy: MergeStrategy;
  private readonly rrf_k: number;
  private readonly mmr_lambda: number;

  constructor(opts: HybridRetrievalOptions = {}) {
    this.vector_port = opts.vector_port ?? null;
    this.merge_strategy = opts.merge_strategy ?? "rrf";
    this.rrf_k = opts.rrf_k ?? 60;
    this.mmr_lambda = opts.mmr_lambda ?? 0.7;
  }

  get has_vector(): boolean {
    return this.vector_port !== null;
  }

  async retrieve(
    query: string,
    bm25_candidates: LexicalCandidate[],
    limit: number,
  ): Promise<string[]> {
    // BM25 순위 배열 (이미 내림차순 정렬 전제)
    const fts_ranked = bm25_candidates.map((c) => c.id);

    // 벡터 augmentation — 실패 시 빈 배열로 폴백
    let vec_ranked: string[] = [];
    if (this.vector_port !== null) {
      try {
        vec_ranked = await this.vector_port.knn_search(query, limit + 5);
      } catch {
        // 벡터 검색 실패 시 lexical-only로 폴백 — 조용히 처리
        vec_ranked = [];
      }
    }

    // lexical-only 폴백: 벡터 결과 없을 때 BM25 순위 그대로 반환
    if (vec_ranked.length === 0) {
      return fts_ranked.slice(0, limit);
    }

    // merge 전략 적용
    if (this.merge_strategy === "mmr") {
      return this._merge_mmr(fts_ranked, vec_ranked, limit);
    }
    return this._merge_rrf(fts_ranked, vec_ranked, limit);
  }

  /** RRF 융합 후 상위 limit개 반환. */
  private _merge_rrf(
    fts_ranked: string[],
    vec_ranked: string[],
    limit: number,
  ): string[] {
    const merged = rrf_merge(fts_ranked, vec_ranked, this.rrf_k);
    return merged.slice(0, limit).map((s: ScoredChunk) => s.chunk_id);
  }

  /**
   * MMR 리랭킹 후 상위 limit개 반환.
   * MMR은 콘텐츠 함수가 필요하지만 여기서는 ID만 있으므로
   * RRF 융합 결과를 MMR 입력으로 사용하고 콘텐츠는 ID로 대리.
   */
  private _merge_mmr(
    fts_ranked: string[],
    vec_ranked: string[],
    limit: number,
  ): string[] {
    // 먼저 RRF로 후보 풀 생성
    const rrf_result = rrf_merge(fts_ranked, vec_ranked, this.rrf_k);
    // MMR 리랭킹 — content_fn은 ID를 텍스트 대리로 사용 (다양성 추정)
    const reranked = mmr_rerank(
      rrf_result,
      (id) => id,
      limit,
      this.mmr_lambda,
    );
    return reranked.map((s: ScoredChunk) => s.chunk_id);
  }
}

/**
 * lexical-only HybridRetrievalPolicy 팩토리.
 * 벡터 없이 BM25 순위만 사용하는 단순 정책.
 */
export function create_lexical_only_policy(): HybridRetrievalPolicy {
  return new DefaultHybridRetrievalPolicy({ vector_port: null });
}

/**
 * 벡터 포트를 주입한 하이브리드 정책 팩토리.
 * @param port VectorAugmentPort 구현체
 * @param opts 추가 옵션 (merge_strategy, rrf_k, mmr_lambda)
 */
export function create_hybrid_policy(
  port: VectorAugmentPort,
  opts?: Omit<HybridRetrievalOptions, "vector_port">,
): HybridRetrievalPolicy {
  return new DefaultHybridRetrievalPolicy({ ...opts, vector_port: port });
}
