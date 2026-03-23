/** 컨텍스트 윈도우 토큰 예산 관리 — 우선순위 기반 섹션 선택. */

export type BudgetSection = {
  name: string;
  content: string;
  priority: number;  // 0(필수) ~ 3(선택적)
  estimated_tokens: number;
};

export type ContextBudgetOptions = {
  max_tokens: number;
};

export class ContextBudget {
  private readonly max_tokens: number;

  constructor(opts: ContextBudgetOptions) {
    this.max_tokens = opts.max_tokens;
  }

  /** 텍스트 길이 기반 토큰 추정. 4 chars ≈ 1 token (영어/한국어 혼합 휴리스틱). */
  static estimate_tokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /** 예산 내에서 우선순위 순으로 섹션 선택. priority 0은 항상 포함. 원래 선언 순서를 보존한다. */
  fit(sections: BudgetSection[]): BudgetSection[] {
    const indexed = sections.map((s, i) => ({ ...s, _order: i }));
    const sorted = [...indexed].sort((a, b) => a.priority - b.priority);
    const selected_idx: number[] = [];
    let budget_remaining = this.max_tokens;

    for (const section of sorted) {
      if (section.priority === 0) {
        selected_idx.push(section._order);
        budget_remaining -= section.estimated_tokens;
        continue;
      }
      if (budget_remaining > 0 && section.estimated_tokens <= budget_remaining) {
        selected_idx.push(section._order);
        budget_remaining -= section.estimated_tokens;
      }
    }

    if (budget_remaining < 0) {
      process.stderr.write(`[ContextBudget] priority-0 sections exceed budget by ${-budget_remaining} tokens\n`);
    }

    // 캐시 친화적 순서 유지를 위해 원래 선언 순서로 복원. _order 필드 누출 방지.
    return selected_idx.sort((a, b) => a - b).map((i) => sections[i]!);
  }
}
