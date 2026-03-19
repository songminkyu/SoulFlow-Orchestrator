/**
 * H-9: Webhook HMAC-SHA256 서명 검증 테스트.
 * verify_hmac_signature, verify_timestamp, dispatch_webhook 동작 검증.
 */

import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { dispatch_webhook } from "@src/dashboard/routes/webhook.ts";
import type { WebhookDeps } from "@src/dashboard/routes/webhook.ts";
import type { IncomingMessage, ServerResponse } from "node:http";

// --- 헬퍼 ---

/** 테스트용 최소 IncomingMessage 목 생성. */
function make_req(opts: {
  headers?: Record<string, string>;
  method?: string;
}): IncomingMessage {
  const req = {
    method: opts.method ?? "POST",
    headers: opts.headers ?? {},
    url: "/hooks/test",
  } as unknown as IncomingMessage;
  return req;
}

/** 테스트용 ServerResponse 목 생성. */
function make_res(): { res: ServerResponse; status: number; body: unknown } {
  const captured = { status: 0, body: undefined as unknown };
  const res = {} as ServerResponse;
  return { res, ...captured };
}

/** HMAC-SHA256 서명 생성 헬퍼. */
function make_sig(body: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
  return `sha256=${sig}`;
}

/** 테스트용 WebhookDeps 빌더. */
function make_deps(overrides: Partial<WebhookDeps> = {}): {
  deps: WebhookDeps;
  json_calls: Array<{ status: number; data: unknown }>;
} {
  const json_calls: Array<{ status: number; data: unknown }> = [];
  const base: WebhookDeps = {
    webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
    webhook_secret: "test-secret",
    auth_enabled: true,
    publish_inbound: vi.fn().mockResolvedValue(undefined),
    json: (_res, status, data) => { json_calls.push({ status, data }); },
    read_body: vi.fn().mockResolvedValue({}),
    read_raw_body: vi.fn().mockResolvedValue(Buffer.from("")),
    ...overrides,
  };
  return { deps: base, json_calls };
}

// --- 테스트 ---

describe("H-9: HMAC-SHA256 서명 검증", () => {
  describe("유효한 HMAC 서명 → 인증 통과", () => {
    it("X-Signature-256 헤더로 올바른 HMAC 서명 → 200 반환", async () => {
      const body_str = '{"event":"push"}';
      const secret = "webhook-secret-abc";
      const sig = make_sig(body_str, secret);

      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        // Bearer 없이 HMAC만
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from(body_str)),
        read_body: vi.fn().mockResolvedValue(null),
        webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
      });

      const req = make_req({
        headers: { "x-signature-256": sig },
        method: "POST",
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/data");

      const handled = await dispatch_webhook(deps, req, res, url);

      expect(handled).toBe(true);
      // 401이 아닌 200 응답 (passive store → ok: true)
      expect(json_calls[0]?.status).toBe(200);
    });

    it("X-Hub-Signature-256 헤더로 올바른 HMAC 서명 → 200 반환", async () => {
      const body_str = '{"ref":"main"}';
      const secret = "hub-secret-xyz";
      const sig = make_sig(body_str, secret);

      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from(body_str)),
        read_body: vi.fn().mockResolvedValue(null),
        webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
      });

      const req = make_req({
        headers: { "x-hub-signature-256": sig },
        method: "POST",
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/github");

      const handled = await dispatch_webhook(deps, req, res, url);

      expect(handled).toBe(true);
      expect(json_calls[0]?.status).toBe(200);
    });
  });

  describe("잘못된 HMAC 서명 → 401", () => {
    it("서명 값이 틀리면 401 반환", async () => {
      const body_str = '{"event":"push"}';
      const secret = "correct-secret";
      const wrong_sig = "sha256=deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from(body_str)),
        // Bearer 헤더 없음 → bearer_ok = false
      });

      const req = make_req({
        headers: { "x-signature-256": wrong_sig },
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/bad");

      await dispatch_webhook(deps, req, res, url);

      expect(json_calls[0]?.status).toBe(401);
    });
  });

  describe("Bearer 토큰 하위 호환성", () => {
    it("올바른 Bearer 토큰 → HMAC 없어도 인증 통과", async () => {
      const secret = "bearer-secret";
      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from("")),
        read_body: vi.fn().mockResolvedValue(null),
        webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
      });

      const req = make_req({
        headers: { authorization: `Bearer ${secret}` },
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/compat");

      const handled = await dispatch_webhook(deps, req, res, url);

      expect(handled).toBe(true);
      expect(json_calls[0]?.status).toBe(200);
    });
  });

  describe("Bearer도 HMAC도 없으면 → 401", () => {
    it("인증 헤더 전혀 없으면 401 반환", async () => {
      const { deps, json_calls } = make_deps({
        webhook_secret: "some-secret",
        auth_enabled: true,
      });

      const req = make_req({ headers: {} });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/private");

      await dispatch_webhook(deps, req, res, url);

      expect(json_calls[0]?.status).toBe(401);
    });
  });

  describe("타임스탬프 리플레이 방지 (H-11 partial)", () => {
    it("5분 초과된 타임스탬프 → 401 replay_detected", async () => {
      const secret = "ts-secret";
      // 6분 전 타임스탬프
      const old_ts = Math.floor(Date.now() / 1000) - 360;

      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from("")),
        read_body: vi.fn().mockResolvedValue(null),
        webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
      });

      // Bearer 인증 통과 + 타임스탬프 만료
      const req = make_req({
        headers: {
          authorization: `Bearer ${secret}`,
          "x-webhook-timestamp": String(old_ts),
        },
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/replay");

      await dispatch_webhook(deps, req, res, url);

      expect(json_calls[0]?.status).toBe(401);
      expect((json_calls[0]?.data as Record<string, unknown>)?.error).toBe("replay_detected");
    });

    it("5분 이내의 타임스탬프 → 인증 통과", async () => {
      const secret = "ts-secret";
      // 2분 전 타임스탬프
      const recent_ts = Math.floor(Date.now() / 1000) - 120;

      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from("")),
        read_body: vi.fn().mockResolvedValue(null),
        webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
      });

      const req = make_req({
        headers: {
          authorization: `Bearer ${secret}`,
          "x-webhook-timestamp": String(recent_ts),
        },
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/recent");

      await dispatch_webhook(deps, req, res, url);

      expect(json_calls[0]?.status).toBe(200);
    });

    it("타임스탬프 헤더 없으면 → 허용 (선택적)", async () => {
      const secret = "ts-secret";

      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from("")),
        read_body: vi.fn().mockResolvedValue(null),
        webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
      });

      const req = make_req({
        headers: { authorization: `Bearer ${secret}` },
        // x-webhook-timestamp 없음
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/no-ts");

      await dispatch_webhook(deps, req, res, url);

      expect(json_calls[0]?.status).toBe(200);
    });
  });

  describe("타이밍 공격 방지: 길이가 다른 서명 → 즉시 거부", () => {
    it("sha256= 접두사 없는 짧은 서명 → 401 (길이 불일치)", async () => {
      const body_str = '{"x":1}';
      const secret = "timing-secret";

      const { deps, json_calls } = make_deps({
        webhook_secret: secret,
        auth_enabled: true,
        read_raw_body: vi.fn().mockResolvedValue(Buffer.from(body_str)),
      });

      // 올바른 서명보다 짧은 문자열
      const short_sig = "sha256=tooshort";

      const req = make_req({
        headers: { "x-signature-256": short_sig },
      });
      const { res } = make_res();
      const url = new URL("http://localhost/hooks/timing");

      await dispatch_webhook(deps, req, res, url);

      expect(json_calls[0]?.status).toBe(401);
    });
  });

  describe("H-9 통합: 단일 스트림에서 HMAC 검증 + JSON 파싱", () => {
    /** 실제 Node.js Readable stream을 생성하여 스트림 1회 소비를 검증한다. */
    function make_stream_req(body_buf: Buffer, headers: Record<string, string>): IncomingMessage {
      const stream = new Readable({ read() { this.push(body_buf); this.push(null); } });
      Object.assign(stream, { method: "POST", headers, url: "/hooks/data" });
      return stream as unknown as IncomingMessage;
    }

    /** 실제 스트림에서 raw bytes를 읽는 헬퍼 (DashboardService._read_raw_body 동등). */
    function real_read_raw(req: IncomingMessage): Promise<Buffer> {
      return new Promise((resolve) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", () => resolve(Buffer.alloc(0)));
      });
    }

    it("HMAC 서명된 POST → 단일 스트림에서 검증 + body 파싱 모두 성공", async () => {
      const payload = { event: "deploy", env: "prod" };
      const body_str = JSON.stringify(payload);
      const body_buf = Buffer.from(body_str);
      const secret = "stream-test-secret";
      const sig = make_sig(body_str, secret);

      const json_calls: Array<{ status: number; data: unknown }> = [];
      const store_calls: Array<unknown> = [];

      const req = make_stream_req(body_buf, { "x-signature-256": sig });

      const deps: WebhookDeps = {
        webhook_store: { push: (...args: unknown[]) => { store_calls.push(args); } } as unknown as WebhookDeps["webhook_store"],
        webhook_secret: secret,
        auth_enabled: true,
        publish_inbound: vi.fn().mockResolvedValue(undefined),
        json: (_res, status, data) => { json_calls.push({ status, data }); },
        // read_body는 호출되면 안 됨 — 스트림이 이미 소비되었으므로
        read_body: vi.fn().mockRejectedValue(new Error("read_body는 HMAC 경로에서 호출되면 안 됨")),
        read_raw_body: real_read_raw,
      };

      const res = {} as ServerResponse;
      const url = new URL("http://localhost/hooks/data");
      const handled = await dispatch_webhook(deps, req, res, url);

      expect(handled).toBe(true);
      expect(json_calls[0]?.status).toBe(200);
      // passive store에 파싱된 body가 전달됐는지 확인
      expect(store_calls.length).toBe(1);
      const stored = store_calls[0] as [string, { body: unknown }];
      expect(stored[1].body).toEqual(payload);
      // read_body가 호출되지 않았는지 확인
      expect(deps.read_body).not.toHaveBeenCalled();
    });

    it("Bearer 인증 + HMAC 없음 → read_body로 정상 스트림 소비", async () => {
      const payload = { session_key: "test-session", message: "hello" };
      const body_str = JSON.stringify(payload);
      const body_buf = Buffer.from(body_str);
      const secret = "bearer-stream-secret";

      const json_calls: Array<{ status: number; data: unknown }> = [];

      // Bearer 인증 + 서명 헤더 없음 → read_raw_body 호출 안 함
      const req = make_stream_req(body_buf, { authorization: `Bearer ${secret}` });

      const deps: WebhookDeps = {
        webhook_store: { push: vi.fn() } as unknown as WebhookDeps["webhook_store"],
        webhook_secret: secret,
        auth_enabled: true,
        publish_inbound: vi.fn().mockResolvedValue(undefined),
        json: (_res, status, data) => { json_calls.push({ status, data }); },
        read_body: vi.fn().mockResolvedValue(payload),
        read_raw_body: vi.fn().mockRejectedValue(new Error("HMAC 없으면 read_raw_body 호출 안 됨")),
      };

      const res = {} as ServerResponse;
      const url = new URL("http://localhost/hooks/wake");
      const handled = await dispatch_webhook(deps, req, res, url);

      expect(handled).toBe(true);
      expect(json_calls[0]?.status).toBe(200);
      // Bearer 경로에서는 read_body가 호출되어야 함
      expect(deps.read_body).toHaveBeenCalledOnce();
      // read_raw_body는 호출 안 됨
      expect(deps.read_raw_body).not.toHaveBeenCalled();
    });
  });
});
