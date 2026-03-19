/**
 * CompletionChecker — 갈래 A: out-of-band 체크 기록 + 갈래 K1: in-loop feedback contract.
 * 에이전트 작업 완료 후 follow-up 체크 질문을 생성하고,
 * task loop에 다시 전달할 수 있는 deterministic feedback contract를 생성.
 */

import type { SkillMetadata } from "../agent/skills.types.js";

/** 도구 사용 패턴 기반 동적 체크 규칙. */
const DYNAMIC_RULES: Array<{ tools: string[]; question: string }> = [
  {
    tools: ["write_file", "edit_file", "create_file"],
    question: "변경된 파일의 내용이 의도와 일치하나요?",
  },
  {
    tools: ["exec", "bash", "shell", "run_command"],
    question: "실행 결과에 에러가 없었나요?",
  },
  {
    tools: ["web_search", "web_fetch", "search"],
    question: "검색 결과의 출처가 신뢰할 수 있나요?",
  },
  {
    tools: ["oauth_fetch", "secret_read"],
    question: "민감한 정보가 노출되지 않았나요?",
  },
];

const HEAVY_TASK_QUESTION = "최종 결과물을 전체적으로 검토했나요?";

export interface CompletionCheckResult {
  questions: string[];
  has_checks: boolean;
}

/**
 * 체크 질문 생성.
 * - 매칭된 스킬의 `checks[]` 수집 (스킬 체크 우선)
 * - 역할 스킬이 활성화된 경우에만 도구 사용 패턴 기반 동적 체크 추가
 * - 중복 제거 + 최대 5개
 */
export function generate_completion_checks(
  tools_used: string[],
  matched_skills: SkillMetadata[],
  tool_calls_count: number,
  has_role: boolean = false,
): CompletionCheckResult {
  const questions: string[] = [];

  // A. 스킬 정의 체크 (frontmatter checks[]) — 역할 스킬 활성화 시에만 적용
  // always:true 스킬(just-bash, sandbox 등)은 항상 매칭되므로 역할 컨텍스트 없이는 제외
  if (has_role) {
    for (const skill of matched_skills) {
      if (skill.always) continue;
      for (const check of (skill.checks ?? [])) {
        if (check.trim() && !questions.includes(check)) {
          questions.push(check);
          if (questions.length >= 5) break;
        }
      }
      if (questions.length >= 5) break;
    }
  }

  // B. 동적 체크 (도구 사용 패턴) — 역할 스킬 활성화 시에만 적용
  if (has_role && questions.length < 5) {
    const used_set = new Set(tools_used.map((t) => t.toLowerCase()));
    for (const rule of DYNAMIC_RULES) {
      if (rule.tools.some((t) => used_set.has(t))) {
        if (!questions.includes(rule.question)) {
          questions.push(rule.question);
          if (questions.length >= 5) break;
        }
      }
    }
  }

  // 대량 도구 사용 시 전체 검토 체크 — 역할 스킬 활성화 시에만 적용
  if (has_role && questions.length < 5 && tool_calls_count > 10) {
    if (!questions.includes(HEAVY_TASK_QUESTION)) {
      questions.push(HEAVY_TASK_QUESTION);
    }
  }

  return { questions, has_checks: questions.length > 0 };
}

/** follow-up 메시지 포맷 (채널 전송용). */
export function format_follow_up(questions: string[]): string {
  if (questions.length === 0) return "";
  const lines = ["📋 **완료 체크리스트**", ""];
  for (const q of questions) {
    lines.push(`- [ ] ${q}`);
  }
  return lines.join("\n");
}

/**
 * In-loop feedback contract.
 * post_tool_use 이후 self-check 체크 항목을 deterministic 데이터 구조로 표현.
 * prompt injection이 아니라 task loop의 memory에 저장되어 다음 턴에 반영됨.
 */
export type CompletionFeedbackContract = {
  /** contract를 생성한 시점의 ISO 타임스탬프 (재실행 구분용). */
  generated_at: string;
  /** 체크 질문 목록. has_checks=false이면 빈 배열. */
  questions: string[];
  /** 체크 항목이 하나 이상 존재하면 true. */
  has_checks: boolean;
  /** contract 생성 시 누적된 도구 사용 목록 (불변 스냅샷). */
  tools_snapshot: string[];
};

/**
 * tools_used, matched_skills, tool_calls_count를 받아 FeedbackContract를 생성.
 * has_checks=false이면 null 반환 (피드백 없음 경로 보존).
 */
export function build_feedback_contract(
  tools_used: string[],
  matched_skills: SkillMetadata[],
  tool_calls_count: number,
  has_role: boolean = false,
  now_iso: () => string = () => new Date().toISOString(),
): CompletionFeedbackContract | null {
  const { questions, has_checks } = generate_completion_checks(
    tools_used, matched_skills, tool_calls_count, has_role,
  );
  if (!has_checks) return null;
  return {
    generated_at: now_iso(),
    questions,
    has_checks,
    tools_snapshot: [...tools_used],
  };
}

/**
 * FeedbackContract를 task loop seed_prompt에 삽입할 텍스트로 변환.
 * 기존 out-of-band format_follow_up과 달리 에이전트가 읽는 형식.
 */
export function format_feedback_for_loop(contract: CompletionFeedbackContract): string {
  const lines = ["[Self-Check]"];
  for (const q of contract.questions) {
    lines.push(`- ${q}`);
  }
  return lines.join("\n");
}
