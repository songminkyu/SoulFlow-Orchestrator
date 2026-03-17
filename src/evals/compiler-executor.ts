/**
 * EV-2: Compiler Eval Executor.
 *
 * 워크플로우 컴파일 요청에 대해 템플릿 매칭을 시뮬레이션하는 deterministic executor.
 * 키워드 기반으로 적합한 워크플로우 유형을 판별.
 */

import type { EvalExecutorLike } from "./contracts.js";

const WORKFLOW_PATTERNS: Array<{ keywords: string[]; workflow_type: string }> = [
  { keywords: ["매일", "아침", "저녁", "주기", "스케줄", "cron"], workflow_type: "scheduled" },
  { keywords: ["pr", "리뷰", "merge", "push", "commit"], workflow_type: "git_trigger" },
  { keywords: ["에러", "오류", "알림", "alert", "감지", "모니터"], workflow_type: "event_trigger" },
  { keywords: ["요약", "리포트", "보고", "분석"], workflow_type: "report" },
];

/** 워크플로우 컴파일 시뮬레이션 executor. */
export function create_compiler_executor(): EvalExecutorLike {
  return {
    async execute(input: string) {
      const lower = input.toLowerCase();
      const matched = WORKFLOW_PATTERNS.find(p =>
        p.keywords.some(kw => lower.includes(kw)),
      );
      const workflow_type = matched?.workflow_type ?? "generic";
      return {
        output: JSON.stringify({
          compiled: true,
          workflow_type,
          phases: 1,
          input_summary: input.slice(0, 100),
        }),
      };
    },
  };
}
