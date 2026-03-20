import type { RouteContext } from "../route-context.js";
import { build_scope_filter, require_team_manager } from "../route-context.js";
import { error_message } from "../../utils/common.js";
import { apply_rubric, DEFAULT_RUBRIC, evaluate_route, DEFAULT_ROUTE_CRITERIA } from "../../quality/index.js";
import type { ExecutionMode } from "../../quality/index.js";

/** Compute optional quality metadata for a prompt result. */
function compute_quality_meta(eval_score?: unknown, expected_mode?: unknown): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  // rubric_verdict: apply acceptance rubric if eval_score is a number
  if (typeof eval_score === "number") {
    const synthetic_scorecard = {
      case_id: "prompt_run",
      entries: [{ dimension: "overall", passed: eval_score >= DEFAULT_RUBRIC.default_threshold.pass_at, score: eval_score }],
      overall_passed: eval_score >= DEFAULT_RUBRIC.default_threshold.pass_at,
      overall_score: eval_score,
    };
    const rubric_result = apply_rubric(synthetic_scorecard, DEFAULT_RUBRIC);
    meta.rubric_verdict = {
      overall: rubric_result.overall_verdict,
      dimensions: rubric_result.dimensions,
    };
  }

  // route_verdict: evaluate execution mode if expected_mode is provided
  if (typeof expected_mode === "string") {
    const mode = expected_mode as ExecutionMode;
    const route_eval = evaluate_route(mode, DEFAULT_ROUTE_CRITERIA);
    meta.route_verdict = {
      passed: route_eval.passed,
      actual_mode: mode,
      ...(route_eval.misroute ? { codes: route_eval.misroute.codes, severity: route_eval.misroute.severity } : {}),
    };
  }

  return meta;
}

export async function handle_prompt(ctx: RouteContext): Promise<boolean> {
  // TN-6d: LLM 프롬프트 실행은 team_manager 이상 (리소스 소비 제어)
  if (!require_team_manager(ctx)) return true;
  const { url, req, res, options, json, read_body } = ctx;
  if (!url.pathname.startsWith("/api/prompt")) return false;

  const prompt_ops = options.prompt_ops;

  // POST /api/prompt/run — 프롬프트 단일 실행
  if (url.pathname === "/api/prompt/run" && req.method === "POST") {
    if (!prompt_ops) { json(res, 503, { error: "prompt_ops_unavailable" }); return true; }
    const body = await read_body(req);
    if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) {
      json(res, 400, { error: "prompt_required" });
      return true;
    }
    try {
      const result = await prompt_ops.run({
        provider_id: typeof body.provider_id === "string" ? body.provider_id : undefined,
        model: typeof body.model === "string" ? body.model : undefined,
        prompt: body.prompt as string,
        system: typeof body.system === "string" ? body.system : undefined,
        temperature: typeof body.temperature === "number" ? body.temperature : undefined,
        max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
        scope_filter: build_scope_filter(ctx),
      });
      const quality = compute_quality_meta(body.eval_score, body.expected_mode);
      json(res, 200, { ...result, ...quality });
    } catch (err) {
      json(res, 500, { error: error_message(err) });
    }
    return true;
  }

  // POST /api/prompt/compare — 동일 프롬프트를 여러 프로바이더에 병렬 실행
  if (url.pathname === "/api/prompt/compare" && req.method === "POST") {
    if (!prompt_ops) { json(res, 503, { error: "prompt_ops_unavailable" }); return true; }
    const body = await read_body(req);
    if (!body || typeof body.prompt !== "string" || !Array.isArray(body.targets)) {
      json(res, 400, { error: "prompt_and_targets_required" });
      return true;
    }
    const targets = (body.targets as Array<{ provider_id?: string; model?: string }>).slice(0, 6);
    const scope = build_scope_filter(ctx);
    const results = await Promise.allSettled(
      targets.map((target) =>
        prompt_ops.run({
          provider_id: target.provider_id,
          model: target.model,
          prompt: body.prompt as string,
          system: typeof body.system === "string" ? body.system : undefined,
          temperature: typeof body.temperature === "number" ? body.temperature : undefined,
          max_tokens: typeof body.max_tokens === "number" ? body.max_tokens : undefined,
          scope_filter: scope,
        }),
      ),
    );
    json(res, 200, results.map((r, i) => {
      if (r.status === "fulfilled") {
        const quality = compute_quality_meta(body.eval_score, body.expected_mode);
        return { ...r.value, ...targets[i], ok: true, ...quality };
      }
      return { ...targets[i], ok: false, error: error_message(r.reason) };
    }));
    return true;
  }

  return false;
}
