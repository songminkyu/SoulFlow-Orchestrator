import type { RouteContext } from "../route-context.js";
import { get_filter_team_id, get_filter_user_id, require_team_manager } from "../route-context.js";
import { extract_reconcile_read_model } from "../../orchestration/reconcile-read-model.js";

export async function handle_state(ctx: RouteContext): Promise<boolean> {
  const { url, res, json, add_sse_client, build_state, metrics } = ctx;

  // FE-6a: 시스템 메트릭은 team_manager 이상만 접근
  if (url.pathname === "/api/system/metrics") {
    if (!require_team_manager(ctx)) return true;
    json(res, 200, metrics.get_latest() ?? {});
    return true;
  }
  if (url.pathname === "/api/state") {
    json(res, 200, await build_state(get_filter_team_id(ctx), get_filter_user_id(ctx)));
    return true;
  }
  if (url.pathname === "/api/events") {
    add_sse_client(res, get_filter_team_id(ctx), get_filter_user_id(ctx));
    return true;
  }

  // PAR-6: reconcile read model 엔드포인트
  if (url.pathname === "/api/reconcile") {
    const team_id = get_filter_team_id(ctx);
    const tasks = ctx.options.agent.list_runtime_tasks(team_id);
    const models = tasks
      .filter((t) => t.memory && typeof t.memory === "object")
      .map((t) => ({
        task_id: t.taskId,
        ...extract_reconcile_read_model(t.memory as Record<string, unknown>),
      }))
      .filter((m) => m.reconcile_summaries.length > 0 || m.critic_summaries.length > 0);
    json(res, 200, { data: models });
    return true;
  }

  return false;
}
