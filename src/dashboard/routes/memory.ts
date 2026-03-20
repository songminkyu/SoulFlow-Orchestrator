import type { RouteContext } from "../route-context.js";
import { require_team_manager_for_write } from "../route-context.js";
import { audit_memory_entry } from "../../quality/memory-quality-rule.js";

function memory_ops_or_503(ctx: RouteContext) {
  const ops = ctx.get_scoped_memory_ops();
  if (!ops) ctx.json(ctx.res, 503, { error: "memory_unavailable" });
  return ops;
}

export async function handle_memory(ctx: RouteContext): Promise<boolean> {
  if (!require_team_manager_for_write(ctx)) return true;
  const { req, url, res, json, read_body } = ctx;
  const path = url.pathname;

  // GET /api/memory/longterm
  if (path === "/api/memory/longterm" && req.method === "GET") {
    const mem = memory_ops_or_503(ctx);
    if (!mem) return true;
    const content = await mem.read_longterm();
    // QC-5: 메모리 품질 감사 결과를 audit_result로 첨부
    const audit_result = content ? audit_memory_entry({ content }) : null;
    json(res, 200, { content, audit_result });
    return true;
  }
  // PUT /api/memory/longterm { content }
  if (path === "/api/memory/longterm" && req.method === "PUT") {
    const mem = memory_ops_or_503(ctx);
    if (!mem) return true;
    const body = await read_body(req);
    const content = String(body?.content ?? "");
    await mem.write_longterm(content);
    json(res, 200, { ok: true });
    return true;
  }

  // GET /api/memory/daily
  if (path === "/api/memory/daily" && req.method === "GET") {
    const mem = memory_ops_or_503(ctx);
    if (!mem) return true;
    const days = await mem.list_daily();
    json(res, 200, { days });
    return true;
  }

  // GET /api/memory/daily/:day
  const day_match = path.match(/^\/api\/memory\/daily\/([^/]+)$/);
  if (day_match && req.method === "GET") {
    const mem = memory_ops_or_503(ctx);
    if (!mem) return true;
    const day = decodeURIComponent(day_match[1]);
    const content = await mem.read_daily(day);
    // QC-5: 일일 메모리 품질 감사 결과를 audit_result로 첨부
    const audit_result = content ? audit_memory_entry({ content }) : null;
    json(res, 200, { content, day, audit_result });
    return true;
  }

  // PUT /api/memory/daily/:day { content }
  if (day_match && req.method === "PUT") {
    const mem = memory_ops_or_503(ctx);
    if (!mem) return true;
    const day = decodeURIComponent(day_match[1]);
    const body = await read_body(req);
    const content = String(body?.content ?? "");
    await mem.write_daily(content, day);
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}
