/**
 * HTTP body 읽기 유틸리티.
 * DashboardService._read_json_body 로직을 추출하여 테스트 가능한 독립 함수로 분리.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

/** 기본 body size 상한 (1MB). */
export const DEFAULT_MAX_BODY_BYTES = 1_048_576;

/**
 * HTTP 요청 body를 JSON으로 파싱. size 초과 시 413 응답 + null 반환.
 * production 코드(DashboardService)와 테스트에서 동일한 함수를 사용.
 */
export function read_json_body(
  req: IncomingMessage,
  res: ServerResponse,
  max_bytes = DEFAULT_MAX_BODY_BYTES,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > max_bytes) {
        req.destroy();
        if (!res.headersSent) {
          res.statusCode = 413;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "payload_too_large" }));
        }
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Record<string, unknown>);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}
