/**
 * EV-5/6: repo-profile eval executor — risk tier, validator 해석, bundle serialize.
 * context 필드로 실행 경로 분기.
 */
import type { EvalExecutorLike } from "./contracts.js";
import { classify_surfaces, DEFAULT_RISK_TIER_POLICY } from "../repo-profile/risk-tier.js";
import type { ChangeSurface } from "../repo-profile/risk-tier.js";
import type { RepoProfile } from "../repo-profile/repo-profile.js";

const EMPTY_PROFILE: RepoProfile = {
  repo_id: "eval-stub",
  capabilities: [],
  commands: {},
  protected_paths: [],
};

/** security 경로를 critical, auth를 high로 분류하는 policy. */
const EVAL_POLICY = {
  ...DEFAULT_RISK_TIER_POLICY,
  critical_patterns: ["src/security/**"],
  high_patterns: ["src/auth/**", "src/config/**"],
};

export function create_repo_profile_executor(): EvalExecutorLike {
  return {
    async execute(input: string) {
      try {
        const parsed = JSON.parse(input);
        const context = String(parsed.context || "").toLowerCase();

        // risk tier 분류
        if (context.includes("risk tier") || context.includes("classify")) {
          const files: string[] = Array.isArray(parsed.changed_files) ? parsed.changed_files : [];
          const surfaces: ChangeSurface[] = files.map((f) => ({ path: f, change_type: "modify" }));
          return { output: classify_surfaces(surfaces, EMPTY_PROFILE, EVAL_POLICY) };
        }

        // validator 결과 해석 + 다음 작업 힌트
        if (context.includes("next task") || context.includes("hint")) {
          const failed = Array.isArray(parsed.failed_validators) ? parsed.failed_validators : [];
          const eval_score = typeof parsed.eval_score === "number" ? parsed.eval_score : null;

          if (eval_score !== null && eval_score < 0.8) {
            return { output: "Improve eval score" };
          }
          if (failed.length === 0) {
            return { output: "ready to proceed" };
          }
          return { output: `Fix ${failed.length} failing` };
        }

        // bundle serialize
        if (context.includes("serialize") || context.includes("bundle")) {
          const repo_id = parsed.repo_id || "unknown";
          const files: string[] = Array.isArray(parsed.changed_files) ? parsed.changed_files : [];
          const validators = Array.isArray(parsed.validator_results) ? parsed.validator_results : [];
          return {
            output: JSON.stringify({
              repo_id,
              changed_files: files,
              validator_summary: validators.map((v: { kind?: string; passed?: boolean }) => ({
                kind: v.kind, passed: v.passed,
              })),
            }),
          };
        }

        // fallback: changed_files가 있으면 risk tier
        if (Array.isArray(parsed.changed_files)) {
          const surfaces: ChangeSurface[] = parsed.changed_files.map((f: string) => ({ path: f, change_type: "modify" as const }));
          return { output: classify_surfaces(surfaces, EMPTY_PROFILE, EVAL_POLICY) };
        }

        return { output: "unknown context" };
      } catch (e) {
        return { output: `error: ${String(e)}` };
      }
    },
  };
}
