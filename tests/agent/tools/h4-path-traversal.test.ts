/**
 * H-4: path traversal + symlink/junction 방어 직접 테스트.
 * `safe_realpath()` + `resolve_path_with_approval()` 경로를 production Tool 호출로 검증.
 *
 * - 심볼릭 링크가 allowed_dir 밖을 가리키면 approval_required 반환
 * - 심볼릭 링크가 allowed_dir 안을 가리키면 정상 읽기
 * - ../로 탈출 시도 시 차단
 */
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, existsSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ReadFileTool, WriteFileTool } from "@src/agent/tools/filesystem.js";

const root = mkdtempSync(join(tmpdir(), "h4-traversal-"));
const allowed = join(root, "workspace");
const outside = join(root, "secret");

let has_escape_link = false;
let has_safe_link = false;

beforeAll(() => {
  mkdirSync(allowed, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(allowed, "safe.txt"), "safe content", "utf-8");
  writeFileSync(join(outside, "secret.txt"), "secret data", "utf-8");

  // symlink inside allowed -> outside (traversal attempt)
  try {
    symlinkSync(outside, join(allowed, "escape_link"), "junction");
    has_escape_link = existsSync(join(allowed, "escape_link"));
  } catch {
    // junction may fail on non-admin Windows
  }

  // symlink inside allowed -> another file inside allowed (benign)
  try {
    symlinkSync(join(allowed, "safe.txt"), join(allowed, "safe_link.txt"), "file");
    has_safe_link = existsSync(join(allowed, "safe_link.txt"))
      && lstatSync(join(allowed, "safe_link.txt")).isSymbolicLink();
  } catch {
    // file symlink requires SeCreateSymbolicLinkPrivilege on Windows
  }
});

afterAll(() => { rmSync(root, { recursive: true, force: true }); });

function make_read() {
  return new ReadFileTool({ workspace: allowed, allowed_dir: allowed });
}

function make_write() {
  return new WriteFileTool({ workspace: allowed, allowed_dir: allowed });
}

describe("H-4: path traversal 방어", () => {
  it("../ 경로 탈출 시도 → approval_required", async () => {
    const tool = make_read();
    const r = await tool.execute({ path: "../secret/secret.txt" });
    expect(String(r)).toContain("approval_required");
    expect(String(r)).toContain("path_outside_allowed_dir");
  });

  it("allowed_dir 안 파일 → 정상 읽기", async () => {
    const tool = make_read();
    const r = await tool.execute({ path: "safe.txt" });
    expect(String(r)).toContain("safe content");
  });

  it("../ 경로 탈출 + write 시도 → approval_required", async () => {
    const tool = make_write();
    const r = await tool.execute({ path: "../secret/injected.txt", content: "pwned" });
    expect(String(r)).toContain("approval_required");
  });
});

describe("H-4: symlink/junction realpath 방어", () => {
  it("symlink가 allowed_dir 밖을 가리키면 → approval_required", async () => {
    if (!has_escape_link) return; // Windows 권한 부족 시 스킵
    const tool = make_read();
    const r = await tool.execute({ path: "escape_link/secret.txt" });
    // realpath가 outside 디렉토리를 해석하므로 allowed_dir 밖 → 차단
    expect(String(r)).toContain("approval_required");
  });

  it("symlink가 allowed_dir 안을 가리키면 → 정상 읽기", async () => {
    if (!has_safe_link) return; // Windows 권한 부족 시 스킵
    const tool = make_read();
    const r = await tool.execute({ path: "safe_link.txt" });
    expect(String(r)).toContain("safe content");
  });

  it("절대 경로로 allowed_dir 밖 접근 → approval_required", async () => {
    const tool = make_read();
    const abs_outside = resolve(outside, "secret.txt");
    const r = await tool.execute({ path: abs_outside });
    expect(String(r)).toContain("approval_required");
  });
});
