import type { RouteContext } from "../route-context.js";
import { get_filter_team_id, get_filter_user_id } from "../route-context.js";

export async function handle_process(ctx: RouteContext): Promise<boolean> {
  const { req, url, res, options, json } = ctx;
  const path = url.pathname;
  const team_id = get_filter_team_id(ctx);
  const user_id = get_filter_user_id(ctx);

  // GET /api/processes — team + user 스코핑
  if (path === "/api/processes" && req.method === "GET") {
    const tracker = options.process_tracker;
    const filter_user = (p: { sender_id?: string }) => user_id === undefined || !p.sender_id || p.sender_id === user_id;
    const active = (tracker?.list_active(team_id) ?? []).filter(filter_user);
    const recent = (tracker?.list_recent(20, team_id) ?? []).filter(filter_user);
    json(res, 200, { active, recent });
    return true;
  }

  // GET /api/processes/:id — team + user ownership 검사
  const id_match = path.match(/^\/api\/processes\/([^/]+)$/);
  if (id_match && req.method === "GET") {
    const run_id = decodeURIComponent(id_match[1]);
    const entry = options.process_tracker?.get(run_id);
    if (!entry) { json(res, 404, { error: "not_found" }); return true; }
    if (team_id !== undefined && entry.team_id !== team_id) { json(res, 404, { error: "not_found" }); return true; }
    if (user_id !== undefined && entry.sender_id && entry.sender_id !== user_id) { json(res, 404, { error: "not_found" }); return true; }
    json(res, 200, entry);
    return true;
  }

  // DELETE /api/processes/:id
  if (id_match && req.method === "DELETE") {
    const tracker = options.process_tracker;
    if (!tracker) { json(res, 503, { error: "process_tracker_unavailable" }); return true; }
    const run_id = decodeURIComponent(id_match[1]);
    const result = await tracker.cancel(run_id, { team_id });
    json(res, result.cancelled ? 200 : 404, result);
    return true;
  }

  return false;
}
