/** /api/mcp/* 라우트 핸들러. */

import type { RouteHandler } from "../route-context.js";
import { require_team_manager } from "../route-context.js";

/**
 * GET /api/mcp/servers — MCP 서버 목록 + 서버별 도구 메타데이터.
 * FE-BE: 도구 정책 레이어에서 FE가 사용 가능한 도구를 조회하는 데 사용.
 * 인프라 정보이므로 team_manager 이상 권한 필요.
 */
export const handle_mcp: RouteHandler = async (ctx) => {
  const { req, res, url, json, options } = ctx;
  const method = req.method ?? "GET";

  if (url.pathname === "/api/mcp/servers" && method === "GET") {
    if (!require_team_manager(ctx)) return true;
    const ops = options.tool_ops;
    if (!ops) { json(res, 503, { error: "tool_ops_not_configured" }); return true; }

    // 상세 메타데이터 지원 시 full schema 반환, 아니면 기존 목록으로 폴백
    if (ops.list_mcp_servers_detailed) {
      const servers = ops.list_mcp_servers_detailed();
      json(res, 200, { servers });
    } else {
      // 폴백: 기존 list_mcp_servers()는 tools: string[] — 스키마 없이 이름만 반환
      const raw = ops.list_mcp_servers();
      const servers = raw.map((s) => ({
        name: s.name,
        connected: s.connected,
        tools: s.tools.map((name) => ({ name, description: undefined, input_schema: {} })),
        error: s.error,
      }));
      json(res, 200, { servers });
    }
    return true;
  }

  return false;
};
