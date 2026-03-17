/**
 * EV-2: Memory/Retrieval Eval Executor.
 *
 * 메모리 검색 요청에 대해 키워드 기반 retrieval 시뮬레이션.
 */

import type { EvalExecutorLike } from "./contracts.js";

/** 메모리 검색 시뮬레이션 executor. */
export function create_memory_executor(): EvalExecutorLike {
  return {
    async execute(input: string) {
      const lower = input.toLowerCase();
      const has_time_ref = /지난|최근|이전|어제|오늘|이번|저번/.test(lower);
      const has_search_intent = /요약|알려|조회|찾|검색|목록/.test(lower);

      if (has_time_ref && has_search_intent) {
        return {
          output: JSON.stringify({
            retrieved: true,
            source: "memory_store",
            query: input.slice(0, 100),
            results_count: 3,
          }),
        };
      }
      return {
        output: JSON.stringify({
          retrieved: false,
          source: "memory_store",
          query: input.slice(0, 100),
          results_count: 0,
          reason: "no_matching_context",
        }),
      };
    },
  };
}
