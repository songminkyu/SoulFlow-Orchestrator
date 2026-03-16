import type { RouteContext } from "../route-context.js";
import { build_scope_filter, require_team_manager } from "../route-context.js";
import { error_message } from "../../utils/common.js";

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
      json(res, 200, result);
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
    json(res, 200, results.map((r, i) =>
      r.status === "fulfilled"
        ? { ...r.value, ...targets[i], ok: true }
        : { ...targets[i], ok: false, error: error_message(r.reason) },
    ));
    return true;
  }

  return false;
}
