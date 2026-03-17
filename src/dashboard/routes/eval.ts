/** EV-4/5/6: Eval Pipeline API 라우트. */

import type { RouteContext } from "../route-context.js";
import { require_team_manager } from "../route-context.js";
import {
  list_bundles, get_bundle, get_smoke_bundles,
  load_bundle_datasets,
} from "../../evals/bundles.js";
import { EvalRunner } from "../../evals/runner.js";
import { CONTAINS_SCORER, EXACT_MATCH_SCORER, REGEX_SCORER } from "../../evals/scorers.js";
import { CompositeJudge, RouteMatchJudge, SchemaMatchJudge, KeywordRuleJudge, StructuredDiffJudge } from "../../evals/judges.js";
import { create_report } from "../../evals/report.js";
import type { Scorecard } from "../../evals/judges.js";
import type { EvalExecutorLike } from "../../evals/contracts.js";
import { create_routing_executor } from "../../evals/routing-executor.js";
import { create_safety_executor } from "../../evals/safety-executor.js";
import { create_compiler_executor } from "../../evals/compiler-executor.js";
import { create_memory_executor } from "../../evals/memory-executor.js";
import { create_guardrail_executor } from "../../evals/guardrail-executor.js";
import { create_tokenizer_executor } from "../../evals/tokenizer-executor.js";
import { create_gateway_executor } from "../../evals/gateway-executor.js";

export async function handle_eval(ctx: RouteContext): Promise<boolean> {
  const { url, req, res, json } = ctx;

  if (!url.pathname.startsWith("/api/eval")) return false;

  // eval 데이터는 team_manager 이상만 접근
  if (!require_team_manager(ctx)) return true;

  const method = req.method ?? "GET";

  // GET /api/eval/bundles — 등록된 번들 목록
  if (url.pathname === "/api/eval/bundles" && method === "GET") {
    const smoke_only = url.searchParams.get("smoke") === "true";
    const bundles = smoke_only ? get_smoke_bundles() : list_bundles();
    json(res, 200, bundles.map(b => ({
      name: b.name, description: b.description,
      smoke: b.smoke, dataset_files: b.dataset_files, tags: b.tags,
    })));
    return true;
  }

  // GET /api/eval/bundles/:name — 단일 번들 상세
  if (url.pathname.startsWith("/api/eval/bundles/") && method === "GET") {
    const name = decodeURIComponent(url.pathname.slice("/api/eval/bundles/".length));
    const bundle = get_bundle(name);
    if (!bundle) { json(res, 404, { error: "bundle_not_found" }); return true; }
    json(res, 200, bundle);
    return true;
  }

  // POST /api/eval/run — 번들 실행 + scorecard 반환
  if (url.pathname === "/api/eval/run" && method === "POST") {
    const body = await ctx.read_body(req);
    if (!body) { json(res, 400, { error: "body_required" }); return true; }

    const bundle_name = String(body.bundle || "");
    const bundle = get_bundle(bundle_name);
    if (!bundle) { json(res, 404, { error: "bundle_not_found" }); return true; }

    const scorer_name = String(body.scorer || "contains");
    const scorer = scorer_name === "exact" ? EXACT_MATCH_SCORER
      : scorer_name === "regex" ? REGEX_SCORER
      : CONTAINS_SCORER;

    // 다차원 judge — 모든 deterministic judge 합성
    const judge = new CompositeJudge([
      new RouteMatchJudge(),
      new SchemaMatchJudge(),
      new KeywordRuleJudge({ required: [], forbidden: [] }),
      new StructuredDiffJudge(),
    ]);

    const EXECUTOR_MAP: Record<string, () => EvalExecutorLike> = {
      routing: create_routing_executor,
      "direct-vs-agent": create_routing_executor,
      safety: create_safety_executor,
      compiler: create_compiler_executor,
      memory: create_memory_executor,
      guardrails: create_guardrail_executor,
      tokenizer: create_tokenizer_executor,
      gateway: create_gateway_executor,
    };
    const executor = EXECUTOR_MAP[bundle_name]?.() ?? { execute: async (input: string) => ({ output: input }) };

    try {
      const datasets = load_bundle_datasets(bundle);
      const runner = new EvalRunner(executor, scorer, {
        judge,
        timeout_ms: Number(body.timeout_ms || 30_000),
        filter_tags: body.tags ? String(body.tags).split(",") : undefined,
        fail_fast: body.fail_fast === true,
      });

      const scorecards: Scorecard[] = [];
      const summaries = [];

      for (const ds of datasets) {
        const summary = await runner.run_dataset(ds);
        summaries.push(summary);
        for (const r of summary.results) {
          scorecards.push({
            case_id: r.case_id,
            entries: [{ dimension: "overall", passed: r.passed, score: r.score }],
            overall_passed: r.passed,
            overall_score: r.score,
          });
        }
      }

      const total_duration = summaries.reduce((sum, s) => sum + s.duration_ms, 0);
      const report = create_report(bundle_name, scorecards, total_duration);

      json(res, 200, { report, summaries });
    } catch (e) {
      json(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    return true;
  }

  return false;
}
