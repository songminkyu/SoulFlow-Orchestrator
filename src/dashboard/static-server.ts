/** 정적 파일 서빙 (dist/web/ SPA). service.ts에서 분리. */

import type { IncomingMessage, ServerResponse } from "node:http";
import { join, extname } from "node:path";
import { accessSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzip, brotliCompress } from "node:zlib";
import { promisify } from "node:util";
import { set_no_cache } from "./route-context.js";
import { get_mime_type } from "./media-store.js";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const PROJECT_ROOT = join(__dirname, "..", "..");

const gzip_async = promisify(gzip);
const brotli_async = promisify(brotliCompress);

/** 압축 대상 MIME 타입 접두사. */
const COMPRESSIBLE_PREFIXES = ["text/", "application/json", "application/javascript", "image/svg"];

/** 파일 크기가 이 값(bytes)을 초과해야 압축 적용. */
const MIN_COMPRESS_SIZE = 1024;

function is_compressible(mime: string): boolean {
  return COMPRESSIBLE_PREFIXES.some((p) => mime.startsWith(p));
}

/** Accept-Encoding 파싱 → 사용할 인코딩 반환. */
function pick_encoding(req: IncomingMessage): "br" | "gzip" | null {
  const ae = req.headers["accept-encoding"];
  if (!ae) return null;
  if (ae.includes("br")) return "br";
  if (ae.includes("gzip")) return "gzip";
  return null;
}

/** Buffer를 선택된 인코딩으로 압축. */
async function compress(buf: Buffer, encoding: "br" | "gzip"): Promise<Buffer> {
  if (encoding === "br") return brotli_async(buf) as Promise<Buffer>;
  return gzip_async(buf) as Promise<Buffer>;
}

/** 응답에 압축 적용 후 전송. 조건 미달 시 원본 전송. */
async function send_maybe_compressed(
  req: IncomingMessage,
  res: ServerResponse,
  data: Buffer,
  mime: string,
): Promise<void> {
  if (data.length < MIN_COMPRESS_SIZE || !is_compressible(mime)) {
    res.end(data);
    return;
  }
  const enc = pick_encoding(req);
  if (!enc) { res.end(data); return; }
  try {
    const compressed = await compress(data, enc);
    res.setHeader("Content-Encoding", enc);
    res.setHeader("Vary", "Accept-Encoding");
    res.end(compressed);
  } catch {
    // 압축 실패 시 원본 전송
    res.end(data);
  }
}

export function resolve_web_dir(): string {
  const candidates = [
    join(PROJECT_ROOT, "dist", "web"),
    join(__dirname, "..", "web"),
  ];
  for (const dir of candidates) {
    try { accessSync(join(dir, "index.html")); return dir; } catch { /* next */ }
  }
  return candidates[0];
}

/** dist/web/ 정적 파일 서빙. 파일 없으면 index.html (SPA fallback). */
export async function serve_static(web_dir: string, pathname: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const rel = pathname.replace(/^\/web\/?/, "") || "index.html";
  const safe = rel.replace(/\.\./g, "");
  const file_path = join(web_dir, safe);
  try {
    const data = await readFile(file_path);
    const ext = extname(file_path);
    const mime = get_mime_type(ext);
    res.statusCode = 200;
    res.setHeader("Content-Type", mime);
    if (ext === ".html") set_no_cache(res);
    else res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    await send_maybe_compressed(req, res, data, mime);
  } catch {
    try {
      const index = await readFile(join(web_dir, "index.html"));
      set_no_cache(res);
      res.statusCode = 200;
      const html_mime = "text/html; charset=utf-8";
      res.setHeader("Content-Type", html_mime);
      await send_maybe_compressed(req, res, index, html_mime);
    } catch {
      res.statusCode = 404;
      res.end("not_found");
    }
  }
}

/**
 * JSON 응답 압축 헬퍼.
 * 호출자가 req를 전달하면 Accept-Encoding 기반 gzip/brotli 압축 적용.
 * 512 bytes 이하 응답은 오버헤드 방지를 위해 압축하지 않음.
 */
export async function send_json_compressed(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  data: unknown,
): Promise<void> {
  set_no_cache(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const body = Buffer.from(JSON.stringify(data), "utf-8");
  const JSON_MIN_COMPRESS = 512;
  if (body.length < JSON_MIN_COMPRESS) {
    res.end(body);
    return;
  }
  const enc = pick_encoding(req);
  if (!enc) { res.end(body); return; }
  try {
    const compressed = await compress(body, enc);
    res.setHeader("Content-Encoding", enc);
    res.setHeader("Vary", "Accept-Encoding");
    res.end(compressed);
  } catch {
    res.end(body);
  }
}
