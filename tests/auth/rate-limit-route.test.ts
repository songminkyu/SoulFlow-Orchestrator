/**
 * H-8 회귀 테스트: /api/auth/login + /api/auth/setup의 rate limiting 직접 검증.
 * - 429 응답 + Retry-After 헤더
 * - req.socket.remoteAddress 기반 (X-Forwarded-For 무시)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AdminStore } from "@src/auth/admin-store.js";
import { AuthService } from "@src/auth/auth-service.js";
import { handle_auth } from "@src/dashboard/routes/auth.js";
import type { RouteContext } from "@src/dashboard/route-context.js";

function make_auth_svc(): AuthService {
  const path = join(tmpdir(), `rate-limit-test-${randomUUID()}.db`);
  return new AuthService(new AdminStore(path));
}

function make_ctx(
  method: string,
  pathname: string,
  body: Record<string, unknown> | null = null,
  opts: { remote_ip?: string; forwarded_for?: string; auth_svc?: AuthService | null } = {},
): { ctx: RouteContext; sent: { status: number; data: unknown }; res_headers: Map<string, string> } {
  const sent = { status: 0, data: null as unknown };
  const res_headers = new Map<string, string>();
  const headers: Record<string, string> = {};
  if (opts.forwarded_for) headers["x-forwarded-for"] = opts.forwarded_for;

  const req = {
    method,
    headers,
    url: pathname,
    socket: { remoteAddress: opts.remote_ip ?? "127.0.0.1" },
  } as unknown as IncomingMessage;

  const res = {
    statusCode: 0,
    headersSent: false,
    setHeader: vi.fn((k: string, v: string) => res_headers.set(k, v)),
    end: vi.fn(),
  } as unknown as ServerResponse;

  const ctx: RouteContext = {
    req,
    res,
    url: new URL(pathname, "http://localhost"),
    options: { auth_svc: opts.auth_svc ?? null } as unknown as RouteContext["options"],
    auth_user: null,
    team_context: null,
    workspace_runtime: null,
    json: (r, status, data) => { sent.status = status; sent.data = data; },
    read_body: vi.fn().mockResolvedValue(body),
    add_sse_client: vi.fn(),
    build_state: vi.fn(),
    build_merged_tasks: vi.fn(),
    recent_messages: [],
    metrics: {} as RouteContext["metrics"],
    chat_sessions: new Map(),
    session_store: null,
    session_store_key: (id) => id,
    register_media_token: vi.fn(),
    oauth_callback_html: vi.fn(),
    resolve_request_origin: vi.fn(),
    bus: null as unknown as RouteContext["bus"],
    add_rich_stream_listener: vi.fn(),
  };

  return { ctx, sent, res_headers };
}

describe("H-8: /api/auth/login rate limiting", () => {
  let auth_svc: AuthService;

  beforeEach(async () => {
    auth_svc = make_auth_svc();
    await auth_svc.setup_superadmin("admin", "password123");
  });

  it("동일 IP 6회 시도 → 6번째에 429 + Retry-After 헤더", async () => {
    // rate limiter는 모듈 싱글턴이므로 고유 IP 사용
    const ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`;
    const results: number[] = [];

    for (let i = 0; i < 6; i++) {
      const { ctx, sent } = make_ctx("POST", "/api/auth/login", { username: "wrong", password: "wrong" }, { remote_ip: ip, auth_svc });
      await handle_auth(ctx);
      results.push(sent.status);
    }

    // 5회까지 허용 (401 — 잘못된 자격증명), 6회째 429
    expect(results.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(results[5]).toBe(429);
  });

  it("429 응답에 Retry-After 헤더 포함", async () => {
    const ip = `10.1.0.${Math.floor(Math.random() * 250) + 1}`;

    for (let i = 0; i < 5; i++) {
      const { ctx } = make_ctx("POST", "/api/auth/login", { username: "x", password: "x" }, { remote_ip: ip, auth_svc });
      await handle_auth(ctx);
    }

    const { ctx, sent, res_headers } = make_ctx("POST", "/api/auth/login", { username: "x", password: "x" }, { remote_ip: ip, auth_svc });
    await handle_auth(ctx);
    expect(sent.status).toBe(429);
    expect(res_headers.has("Retry-After")).toBe(true);
    expect(Number(res_headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("X-Forwarded-For를 변경해도 같은 socket IP면 차단", async () => {
    const ip = `10.2.0.${Math.floor(Math.random() * 250) + 1}`;

    for (let i = 0; i < 5; i++) {
      const { ctx } = make_ctx("POST", "/api/auth/login", { username: "x", password: "x" }, {
        remote_ip: ip,
        forwarded_for: `192.168.${i}.1`,
        auth_svc,
      });
      await handle_auth(ctx);
    }

    // 6회째 — X-Forwarded-For가 다르지만 socket IP가 같으므로 차단
    const { ctx, sent } = make_ctx("POST", "/api/auth/login", { username: "x", password: "x" }, {
      remote_ip: ip,
      forwarded_for: "192.168.99.1",
      auth_svc,
    });
    await handle_auth(ctx);
    expect(sent.status).toBe(429);
  });

  it("다른 socket IP는 독립적으로 허용", async () => {
    const ip_a = `10.3.0.${Math.floor(Math.random() * 250) + 1}`;
    const ip_b = `10.4.0.${Math.floor(Math.random() * 250) + 1}`;

    // IP A를 5회 소진
    for (let i = 0; i < 5; i++) {
      const { ctx } = make_ctx("POST", "/api/auth/login", { username: "x", password: "x" }, { remote_ip: ip_a, auth_svc });
      await handle_auth(ctx);
    }

    // IP B는 여전히 허용
    const { ctx, sent } = make_ctx("POST", "/api/auth/login", { username: "x", password: "x" }, { remote_ip: ip_b, auth_svc });
    await handle_auth(ctx);
    expect(sent.status).toBe(401); // 잘못된 자격증명이지만 rate limit은 아님
  });
});

describe("H-8: /api/auth/setup rate limiting", () => {
  it("동일 IP setup 6회 시도 → 6번째에 429", async () => {
    const ip = `10.5.0.${Math.floor(Math.random() * 250) + 1}`;
    const results: number[] = [];

    for (let i = 0; i < 6; i++) {
      const auth_svc = make_auth_svc();
      const { ctx, sent } = make_ctx("POST", "/api/auth/setup", { username: "u", password: "short" }, { remote_ip: ip, auth_svc });
      await handle_auth(ctx);
      results.push(sent.status);
    }

    // 5회까지 허용 (400 — password too short), 6회째 429
    expect(results.slice(0, 5).every((s) => s === 400)).toBe(true);
    expect(results[5]).toBe(429);
  });
});
