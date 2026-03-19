/**
 * K4: SemanticScorerPort — ToolIndex / SkillIndex용 optional 시멘틱 보강 포트.
 *
 * 역할:
 * - FTS5/BM25 랭킹 결과에 시멘틱 재점수(delta)를 추가하는 계약 정의.
 * - scorer가 없으면 기존 FTS5 동작 완전 보존 (no-op).
 * - TR-3 HybridRetrievalPolicy와 연결할 수 있는 어댑터 제공.
 *
 * 소비자: ToolIndex, SkillIndex.
 */

// ── 계약 ─────────────────────────────────────────────────────────────────────

/**
 * 단일 후보에 대한 시멘틱 재점수 결과.
 */
export interface SemanticScore {
  /** 후보 식별자 (ToolIndex: 도구 이름, SkillIndex: 스킬 이름). */
  readonly id: string;
  /**
   * BM25 점수에 더할 delta 값.
   * 양수 = 부스트, 음수 = 페널티, 0 = 변화 없음.
   */
  readonly delta: number;
}

/**
 * 시멘틱 보강 포트 계약.
 *
 * 구현체는 local embedding, dense retrieval, cross-encoder 등 다양한 방식으로
 * 이 인터페이스를 구현할 수 있다.
 *
 * - 오류 시 빈 배열을 반환하며 예외를 던지지 않음.
 * - scorer가 없으면 FTS5-only 동작으로 폴백.
 */
export interface SemanticScorerPort {
  /**
   * 후보 목록에 대한 시멘틱 재점수를 반환.
   *
   * @param query 검색 쿼리 텍스트
   * @param candidates 재점수 대상 후보 ID 목록 (이미 FTS5 정렬된 상태)
   * @returns 재점수 배열. 목록에 없는 후보는 delta=0으로 처리.
   */
  score(query: string, candidates: string[]): Promise<SemanticScore[]>;
}

// ── 구현 ──────────────────────────────────────────────────────────────────────

/**
 * No-op 시멘틱 scorer — local-first 기본 어댑터.
 *
 * scorer 미주입 시 이 어댑터가 사용된다.
 * 항상 빈 배열을 반환하여 FTS5/BM25 순위를 그대로 보존.
 */
export class NoOpSemanticScorer implements SemanticScorerPort {
  async score(_query: string, _candidates: string[]): Promise<SemanticScore[]> {
    return [];
  }
}

/**
 * TR-3 HybridRetrievalPolicy 브리지 어댑터.
 *
 * HybridRetrievalPolicy.retrieve()의 출력 순위를 delta로 변환하여
 * ToolIndex / SkillIndex의 BM25 점수에 가산.
 *
 * RRF/MMR merge 결과를 순위 역수(1/rank)로 환산 → delta로 사용.
 * - 상위 순위 후보는 큰 delta를 받아 부스트됨.
 * - HybridRetrievalPolicy에 VectorAugmentPort가 없으면 lexical-only 폴백이
 *   자동 적용되어 delta는 FTS5 순위와 동일해짐 (사실상 no-op에 가까움).
 *
 * @example
 * ```ts
 * const policy = create_hybrid_policy(my_vector_port);
 * const scorer = new HybridPolicySemanticScorer(policy);
 * tool_index.set_semantic_scorer(scorer);
 * ```
 */
export class HybridPolicySemanticScorer implements SemanticScorerPort {
  constructor(
    private readonly policy: import("../search/hybrid-retrieval-policy.js").HybridRetrievalPolicy,
  ) {}

  async score(query: string, candidates: string[]): Promise<SemanticScore[]> {
    if (candidates.length === 0) return [];

    try {
      // candidates를 LexicalCandidate 형식으로 변환 (bm25_score = 순위 역수)
      const bm25_candidates = candidates.map((id, idx) => ({
        id,
        bm25_score: 1 / (idx + 1),
      }));

      const merged = await this.policy.retrieve(query, bm25_candidates, candidates.length);

      // 병합된 순위 → delta 변환 (1/rank * 10 스케일링)
      const SCALE = 10;
      return merged.map((id, idx) => ({
        id,
        delta: SCALE / (idx + 1),
      }));
    } catch {
      // 오류 시 빈 배열 반환 → FTS5 폴백
      return [];
    }
  }
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

/**
 * 시멘틱 delta를 기존 BM25 점수 맵에 적용.
 * scorer가 없거나 delta 배열이 비어있으면 원본 scores를 그대로 반환.
 *
 * @param scores 기존 BM25 점수 맵 (id → score)
 * @param deltas SemanticScorerPort.score() 반환값
 * @returns delta가 적용된 새 점수 맵 (원본 맵은 변경하지 않음)
 */
export function apply_semantic_deltas(
  scores: Map<string, number>,
  deltas: SemanticScore[],
): Map<string, number> {
  if (deltas.length === 0) return scores;

  const result = new Map(scores);
  for (const { id, delta } of deltas) {
    const prev = result.get(id) ?? 0;
    result.set(id, prev + delta);
  }
  return result;
}
