/**
 * EV-2: Routing / Direct-vs-Agent Eval Executor.
 *
 * fast_classify를 사용해 메시지의 실행 경로를 분류하고
 * 분류 결과를 output으로 반환한다.
 */

import type { EvalExecutorLike } from "./contracts.js";
import { fast_classify } from "../orchestration/classifier.js";

/** 메시지 분류 기반 executor. 입력 텍스트의 실행 모드를 판별. */
export function create_routing_executor(): EvalExecutorLike {
  return {
    async execute(input: string) {
      const result = fast_classify(input, {});
      const mode = result.mode;
      const route = mode === "agent" || mode === "task" ? "agent" : "direct";
      return { output: route, mode: route === "agent" ? "agent" : "direct" };
    },
  };
}
