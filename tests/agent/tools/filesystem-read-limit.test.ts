/**
 * ReadFileTool — MAX_READ_BYTES (10MB) 크기 제한 테스트 (PCH-S10, CWE-400).
 *
 * - 10MB 초과 파일 → 에러 메시지 반환 (OOM 방지)
 * - 정상 크기 파일 → 기존 동작 유지
 * - stat 실패 → graceful fallback (기존 에러 경로)
 */
import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── stat mock 설정 (10MB 초과 시뮬레이션) ────────────────────────────────────

const mock_stat = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", async (orig) => {
  const actual = await orig<typeof import("node:fs/promises")>();
  return {
    ...actual,
    stat: mock_stat,
  };
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { ReadFileTool } from "@src/agent/tools/filesystem.js";

let workspace: string;

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "read-limit-"));
  await writeFile(join(workspace, "normal.txt"), "Hello, World!", "utf-8");
});

afterAll(async () => {
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

// ── 10MB 초과 파일 → 에러 메시지 반환 ─────────────────────────────────────────

describe("ReadFileTool — MAX_READ_BYTES 크기 제한", () => {
  it("10MB 초과 파일 → 'file too large' 에러 반환", async () => {
    const OVER_LIMIT = 10 * 1024 * 1024 + 1; // 10MB + 1 byte
    mock_stat.mockResolvedValueOnce({
      isFile: () => true,
      size: OVER_LIMIT,
    });

    const tool = new ReadFileTool({ workspace });
    const result = await tool.execute({ path: "normal.txt" });
    expect(String(result)).toContain("Error");
    expect(String(result)).toContain("file too large");
    expect(String(result)).toContain(`${OVER_LIMIT} bytes`);
    expect(String(result)).toContain("10MB limit");
  });

  it("정확히 10MB → 정상 읽기 (경계값)", async () => {
    const EXACT_LIMIT = 10 * 1024 * 1024;
    mock_stat.mockResolvedValueOnce({
      isFile: () => true,
      size: EXACT_LIMIT,
    });

    const tool = new ReadFileTool({ workspace });
    const result = await tool.execute({ path: "normal.txt" });
    // 10MB 이하이므로 readFile이 호출됨 → 실제 파일 내용 반환
    expect(String(result)).toContain("Hello, World!");
    expect(String(result)).not.toContain("Error");
  });

  it("정상 크기 파일 → 기존 동작 유지", async () => {
    mock_stat.mockResolvedValueOnce({
      isFile: () => true,
      size: 13, // "Hello, World!" length
    });

    const tool = new ReadFileTool({ workspace });
    const result = await tool.execute({ path: "normal.txt" });
    expect(String(result)).toContain("Hello, World!");
    expect(String(result)).not.toContain("Error");
  });

  it("stat 실패 (ENOENT) → graceful 에러 반환", async () => {
    const err = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    mock_stat.mockRejectedValueOnce(err);

    const tool = new ReadFileTool({ workspace });
    const result = await tool.execute({ path: "nonexistent.txt" });
    expect(String(result)).toContain("Error");
    expect(String(result)).toContain("file not found");
  });

  it("stat 실패 (EPERM) → graceful 에러 반환", async () => {
    const err = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
    mock_stat.mockRejectedValueOnce(err);

    const tool = new ReadFileTool({ workspace });
    const result = await tool.execute({ path: "normal.txt" });
    expect(String(result)).toContain("Error");
    expect(String(result)).toContain("operation not permitted");
  });

  it("디렉토리 경로 → 'Not a file' 에러 반환", async () => {
    mock_stat.mockResolvedValueOnce({
      isFile: () => false,
      size: 0,
    });

    const tool = new ReadFileTool({ workspace });
    const result = await tool.execute({ path: workspace });
    expect(String(result)).toContain("Error");
    expect(String(result)).toContain("Not a file");
  });
});
