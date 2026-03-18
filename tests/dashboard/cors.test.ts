/**
 * H-10 회귀 테스트: production apply_cors() 직접 검증.
 * - Origin allowlist
 * - OPTIONS preflight → 204
 * - 보안 헤더 (X-Content-Type-Options, X-Frame-Options)
 */
import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { apply_cors } from "@src/dashboard/service.js";

function make_req(method: string, headers: Record<string, string> = {}): IncomingMessage {
  return { method, headers, url: "/api/health" } as unknown as IncomingMessage;
}

function make_res() {
  const state = { headers: new Map<string, string>(), status: 0, ended: false };
  const res = {
    statusCode: 0,
    headersSent: false,
    setHeader: vi.fn((k: string, v: string) => state.headers.set(k, String(v))),
    writeHead: vi.fn((s: number) => { state.status = s; }),
    end: vi.fn(() => { state.ended = true; }),
  } as unknown as ServerResponse;
  return { res, state };
}

describe("H-10: CORS apply_cors (production)", () => {
  it("Origin 없으면 CORS 헤더 미설정 + false 반환", () => {
    const req = make_req("GET");
    const { res, state: { headers } } = make_res();
    const result = apply_cors(req, res, ["http://localhost:3000"]);
    expect(result).toBe(false);
    expect(headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("허용된 Origin → CORS 헤더 설정", () => {
    const req = make_req("GET", { origin: "http://localhost:3000" });
    const { res, state: { headers } } = make_res();
    apply_cors(req, res, ["http://localhost:3000"]);
    expect(headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
    expect(headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(headers.get("Vary")).toBe("Origin");
  });

  it("비허용 Origin → CORS 헤더 미설정 + false 반환", () => {
    const req = make_req("GET", { origin: "http://evil.com" });
    const { res, state: { headers } } = make_res();
    const result = apply_cors(req, res, ["http://localhost:3000"]);
    expect(result).toBe(false);
    expect(headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("wildcard '*' → 모든 Origin 허용", () => {
    const req = make_req("GET", { origin: "http://any-site.com" });
    const { res, state: { headers } } = make_res();
    apply_cors(req, res, ["*"]);
    expect(headers.get("Access-Control-Allow-Origin")).toBe("http://any-site.com");
  });

  it("빈 배열 → same-origin만 (모든 Origin 거부)", () => {
    const req = make_req("GET", { origin: "http://localhost:3000" });
    const { res, state: { headers } } = make_res();
    const result = apply_cors(req, res, []);
    expect(result).toBe(false);
    expect(headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("OPTIONS preflight → 204 + true 반환", () => {
    const req = make_req("OPTIONS", { origin: "http://localhost:3000" });
    const { res, state } = make_res();
    const result = apply_cors(req, res, ["http://localhost:3000"]);
    expect(result).toBe(true);
    expect(state.status).toBe(204);
    expect(state.ended).toBe(true);
  });

  it("보안 헤더: X-Content-Type-Options + X-Frame-Options 항상 설정", () => {
    const req = make_req("GET");
    const { res, state: { headers } } = make_res();
    apply_cors(req, res, []);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });
});
