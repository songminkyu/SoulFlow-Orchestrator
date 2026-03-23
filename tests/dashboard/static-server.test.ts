import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { resolve_web_dir, serve_static, send_json_compressed } from "@src/dashboard/static-server.ts";
import { make_mock_response } from "@helpers/mock-response.ts";
import type { IncomingMessage } from "node:http";

/** Accept-Encoding 헤더가 있는 mock req 생성. */
function make_mock_req(accept_encoding?: string): IncomingMessage {
  return { headers: accept_encoding ? { "accept-encoding": accept_encoding } : {} } as unknown as IncomingMessage;
}

describe("resolve_web_dir", () => {
  it("string을 반환한다", () => {
    const dir = resolve_web_dir();
    expect(dir).toBeTypeOf("string");
    expect(dir.length).toBeGreaterThan(0);
  });
});

describe("serve_static", () => {
  let web_dir: string;

  beforeAll(async () => {
    web_dir = await mkdtemp(join(tmpdir(), "static-test-"));
    await writeFile(join(web_dir, "index.html"), "<html>SPA</html>");
    await mkdir(join(web_dir, "assets"), { recursive: true });
    await writeFile(join(web_dir, "assets", "style.css"), "body { color: red; }");
    await writeFile(join(web_dir, "app.js"), "console.log('app');");
    // 압축 테스트용 큰 파일 (>1KB)
    const large_js = "/* " + "x".repeat(2048) + " */";
    await writeFile(join(web_dir, "large.js"), large_js);
  });

  afterAll(async () => {
    await rm(web_dir, { recursive: true, force: true });
  });

  describe("경로 처리", () => {
    it("/web/ 접두사를 제거하고 파일을 서빙한다", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/app.js", req, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/javascript");
    });

    it("/web으로 요청 시 index.html을 서빙한다", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/", req, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/html");
    });

    it(".. 경로 순회를 방어한다", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/../../etc/passwd", req, res as any);
      // ".." 제거 → "etcpasswd" → 파일 없음 → SPA fallback
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/html; charset=utf-8");
    });
  });

  describe("캐시 헤더", () => {
    it("HTML 파일은 no-cache 헤더를 설정한다", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/index.html", req, res as any);
      const cache_calls = res.setHeader.mock.calls.filter(
        (c: unknown[]) => c[0] === "Cache-Control",
      );
      const has_no_cache = cache_calls.some((c: unknown[]) => String(c[1]).includes("no-cache") || String(c[1]).includes("no-store"));
      expect(has_no_cache).toBe(true);
    });

    it("비-HTML 파일은 immutable 캐시를 설정한다", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/assets/style.css", req, res as any);
      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
    });
  });

  describe("SPA fallback", () => {
    it("존재하지 않는 경로는 index.html로 폴백한다", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/unknown/route", req, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/html; charset=utf-8");
    });

    it("index.html도 없으면 404를 반환한다", async () => {
      const empty_dir = await mkdtemp(join(tmpdir(), "empty-web-"));
      try {
        const req = make_mock_req();
        const res = make_mock_response();
        await serve_static(empty_dir, "/web/anything", req, res as any);
        expect(res.statusCode).toBe(404);
        expect(res.end).toHaveBeenCalledWith("not_found");
      } finally {
        await rm(empty_dir, { recursive: true, force: true });
      }
    });
  });

  describe("MIME 타입", () => {
    it("확장자에 따른 Content-Type을 설정한다", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/assets/style.css", req, res as any);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/css");
    });
  });

  describe("gzip/brotli 압축", () => {
    it("Accept-Encoding: gzip 요청 시 큰 파일에 gzip 압축 적용", async () => {
      const req = make_mock_req("gzip, deflate");
      const res = make_mock_response();
      await serve_static(web_dir, "/web/large.js", req, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Encoding", "gzip");
      expect(res.setHeader).toHaveBeenCalledWith("Vary", "Accept-Encoding");
      // end()에 전달된 데이터가 유효한 gzip인지 확인
      const compressed = res.end.mock.calls[0][0] as Buffer;
      const decompressed = gunzipSync(compressed);
      expect(decompressed.toString()).toContain("x".repeat(100));
    });

    it("Accept-Encoding: br 요청 시 brotli 우선 선택", async () => {
      const req = make_mock_req("gzip, br");
      const res = make_mock_response();
      await serve_static(web_dir, "/web/large.js", req, res as any);
      expect(res.statusCode).toBe(200);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Encoding", "br");
      expect(res.setHeader).toHaveBeenCalledWith("Vary", "Accept-Encoding");
    });

    it("Accept-Encoding 없으면 압축 미적용", async () => {
      const req = make_mock_req();
      const res = make_mock_response();
      await serve_static(web_dir, "/web/large.js", req, res as any);
      expect(res.statusCode).toBe(200);
      const enc_calls = res.setHeader.mock.calls.filter(
        (c: unknown[]) => c[0] === "Content-Encoding",
      );
      expect(enc_calls.length).toBe(0);
    });

    it("작은 파일(<1KB)은 압축하지 않음", async () => {
      const req = make_mock_req("gzip, br");
      const res = make_mock_response();
      await serve_static(web_dir, "/web/app.js", req, res as any);
      expect(res.statusCode).toBe(200);
      // app.js = "console.log('app');" < 1KB — 압축 미적용
      const enc_calls = res.setHeader.mock.calls.filter(
        (c: unknown[]) => c[0] === "Content-Encoding",
      );
      expect(enc_calls.length).toBe(0);
    });
  });
});

describe("send_json_compressed", () => {
  it("큰 JSON 응답에 gzip 압축 적용", async () => {
    const req = make_mock_req("gzip");
    const res = make_mock_response();
    const large_data = { items: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item_${i}_${"x".repeat(20)}` })) };
    await send_json_compressed(req, res as any, 200, large_data);
    expect(res.statusCode).toBe(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/json; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Encoding", "gzip");
    expect(res.setHeader).toHaveBeenCalledWith("Vary", "Accept-Encoding");
    // 압축된 데이터를 풀어서 원본과 비교
    const compressed = res.end.mock.calls[0][0] as Buffer;
    const decompressed = gunzipSync(compressed);
    const parsed = JSON.parse(decompressed.toString());
    expect(parsed.items.length).toBe(100);
  });

  it("작은 JSON 응답(<512B)은 압축 미적용", async () => {
    const req = make_mock_req("gzip, br");
    const res = make_mock_response();
    await send_json_compressed(req, res as any, 200, { ok: true });
    expect(res.statusCode).toBe(200);
    const enc_calls = res.setHeader.mock.calls.filter(
      (c: unknown[]) => c[0] === "Content-Encoding",
    );
    expect(enc_calls.length).toBe(0);
  });

  it("Accept-Encoding 없으면 압축 미적용", async () => {
    const req = make_mock_req();
    const res = make_mock_response();
    const large_data = { items: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item_${i}_${"x".repeat(20)}` })) };
    await send_json_compressed(req, res as any, 200, large_data);
    expect(res.statusCode).toBe(200);
    const enc_calls = res.setHeader.mock.calls.filter(
      (c: unknown[]) => c[0] === "Content-Encoding",
    );
    expect(enc_calls.length).toBe(0);
    // 원본 JSON이 그대로 전달
    const body = res.end.mock.calls[0][0] as Buffer;
    const parsed = JSON.parse(body.toString());
    expect(parsed.items.length).toBe(100);
  });
});
