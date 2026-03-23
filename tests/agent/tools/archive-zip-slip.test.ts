/**
 * ArchiveTool — zip-slip (CWE-22) 방어 테스트.
 *
 * 검증 대상:
 * 1. output_dir이 workspace 밖으로 탈출하는 경우 차단
 * 2. 아카이브 엔트리에 ../../ 경로가 포함된 경우 차단
 * 3. 정상 아카이브는 추출 성공
 * 4. 아카이브 목록 조회 실패 시 안전하게 차단
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── shell-runtime mock ──────────────────────────────────────────────────────
const { mock_run_argv } = vi.hoisted(() => ({ mock_run_argv: vi.fn() }));

vi.mock("@src/agent/tools/shell-runtime.js", () => ({
  run_command_argv: mock_run_argv,
}));

import { ArchiveTool } from "@src/agent/tools/archive.js";

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "zipslip-"));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

function make_tool(ws = workspace) {
  return new ArchiveTool({ workspace: ws });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. output_dir workspace 경계 탈출 차단
// ═══════════════════════════════════════════════════════════════════════════════

describe("zip-slip — output_dir workspace 탈출 차단", () => {
  it("output_dir이 workspace 밖인 절대 경로 → 차단", async () => {
    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "test.tar.gz",
      output_dir: "/etc/evil",
    });
    expect(result).toContain("Error");
    expect(result).toContain("output_dir escapes workspace boundary");
    // run_command_argv는 호출되지 않아야 함 (추출 전에 차단)
    expect(mock_run_argv).not.toHaveBeenCalled();
  });

  it("output_dir이 ../로 workspace 탈출 → 차단", async () => {
    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "test.tar.gz",
      output_dir: "../../etc",
    });
    expect(result).toContain("Error");
    expect(result).toContain("output_dir escapes workspace boundary");
    expect(mock_run_argv).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. 아카이브 엔트리 경로 탈출 (zip-slip 핵심)
// ═══════════════════════════════════════════════════════════════════════════════

describe("zip-slip — 아카이브 엔트리 경로 탈출 차단", () => {
  it("tar.gz 엔트리에 ../../etc/passwd 포함 → 차단", async () => {
    // 첫 번째 호출: list 명령 (scan_entries_for_traversal)
    mock_run_argv.mockResolvedValueOnce({
      stdout: "safe-file.txt\n../../etc/passwd\n",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "malicious.tar.gz",
      output_dir: ".",
    });

    expect(result).toContain("Error");
    expect(result).toContain("zip-slip blocked");
    expect(result).toContain("../../etc/passwd");
    // list 한 번만 호출, extract는 호출되지 않음
    expect(mock_run_argv).toHaveBeenCalledTimes(1);
  });

  it("zip 엔트리에 경로 탈출 포함 → 차단 (unzip -l 형식)", async () => {
    // unzip -l 출력 형식 시뮬레이션
    const unzip_list_output = [
      "  Length      Date    Time    Name",
      " ---------  ---------- -----   ----",
      "       123  2024-01-01 00:00   safe.txt",
      "       456  2024-01-01 00:00   ../../../etc/shadow",
      " ---------                     -------",
      "       579                     2 files",
    ].join("\n");

    mock_run_argv.mockResolvedValueOnce({
      stdout: unzip_list_output,
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "zip",
      archive_path: "malicious.zip",
      output_dir: ".",
    });

    expect(result).toContain("Error");
    expect(result).toContain("zip-slip blocked");
    // list만 호출, extract는 차단
    expect(mock_run_argv).toHaveBeenCalledTimes(1);
  });

  it("절대 경로 엔트리 (/etc/passwd) → 차단", async () => {
    mock_run_argv.mockResolvedValueOnce({
      stdout: "normal.txt\n/etc/passwd\n",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "absolute-path.tar.gz",
      output_dir: ".",
    });

    expect(result).toContain("Error");
    expect(result).toContain("zip-slip blocked");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. 정상 아카이브 추출 성공
// ═══════════════════════════════════════════════════════════════════════════════

describe("zip-slip — 정상 아카이브 추출 성공", () => {
  it("안전한 tar.gz 엔트리 → 추출 성공", async () => {
    // list 호출: 안전한 엔트리만 포함
    mock_run_argv.mockResolvedValueOnce({
      stdout: "dir/\ndir/file1.txt\ndir/sub/file2.txt\n",
      stderr: "",
    });
    // extract 호출
    mock_run_argv.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "safe.tar.gz",
      output_dir: ".",
    });

    expect(result).not.toContain("Error");
    expect(result).toContain("extract completed");
    // list + extract = 2회 호출
    expect(mock_run_argv).toHaveBeenCalledTimes(2);
  });

  it("안전한 zip 엔트리 → 추출 성공", async () => {
    const unzip_list_output = [
      "  Length      Date    Time    Name",
      " ---------  ---------- -----   ----",
      "       123  2024-01-01 00:00   readme.txt",
      "       456  2024-01-01 00:00   src/main.ts",
      " ---------                     -------",
      "       579                     2 files",
    ].join("\n");

    mock_run_argv.mockResolvedValueOnce({
      stdout: unzip_list_output,
      stderr: "",
    });
    mock_run_argv.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "zip",
      archive_path: "safe.zip",
      output_dir: ".",
    });

    expect(result).not.toContain("Error");
    expect(result).toContain("extract completed");
    expect(mock_run_argv).toHaveBeenCalledTimes(2);
  });

  it("output_dir이 workspace 내 하위 디렉토리 → 성공", async () => {
    mock_run_argv.mockResolvedValueOnce({
      stdout: "file.txt\n",
      stderr: "",
    });
    mock_run_argv.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "test.tar.gz",
      output_dir: "subdir/nested",
    });

    expect(result).not.toContain("Error");
    expect(mock_run_argv).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. 아카이브 목록 조회 실패 시 안전 차단
// ═══════════════════════════════════════════════════════════════════════════════

describe("zip-slip — 목록 조회 실패 시 안전 차단", () => {
  it("list 명령 실행 실패 → 추출 차단", async () => {
    mock_run_argv.mockRejectedValueOnce(new Error("tar: Cannot open: No such file"));

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "nonexistent.tar.gz",
      output_dir: ".",
    });

    expect(result).toContain("Error");
    expect(result).toContain("cannot list archive entries");
    expect(result).toContain("extraction blocked");
    // list만 호출, extract는 차단
    expect(mock_run_argv).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. create/list 연산은 zip-slip 검증 미적용
// ═══════════════════════════════════════════════════════════════════════════════

describe("zip-slip — create/list에는 적용 안 됨", () => {
  it("list 연산 → 경로 검증 없이 실행", async () => {
    mock_run_argv.mockResolvedValueOnce({
      stdout: "file1.txt\nfile2.txt\n",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "list",
      format: "tar.gz",
      archive_path: "test.tar.gz",
    });

    expect(result).not.toContain("Error");
    expect(mock_run_argv).toHaveBeenCalledTimes(1);
  });

  it("create 연산 → 경로 검증 없이 실행", async () => {
    mock_run_argv.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "create",
      format: "tar.gz",
      archive_path: "out.tar.gz",
      files: ["file1.txt"],
    });

    expect(result).not.toContain("Error");
    expect(mock_run_argv).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. parse_entry_names 엣지 케이스
// ═══════════════════════════════════════════════════════════════════════════════

describe("zip-slip — 엔트리 파싱 엣지 케이스", () => {
  it("tar 엔트리가 빈 줄만 → 통과 (빈 아카이브)", async () => {
    mock_run_argv.mockResolvedValueOnce({
      stdout: "\n\n",
      stderr: "",
    });
    mock_run_argv.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "empty.tar.gz",
      output_dir: ".",
    });

    expect(result).not.toContain("Error");
    expect(mock_run_argv).toHaveBeenCalledTimes(2);
  });

  it("디렉토리 엔트리(trailing /)는 무시", async () => {
    // 디렉토리 엔트리 경로에 ../이 있어도 trailing /이면 skip
    mock_run_argv.mockResolvedValueOnce({
      stdout: "safe/\nsafe/file.txt\n",
      stderr: "",
    });
    mock_run_argv.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
    });

    const tool = make_tool();
    const result = await tool.execute({
      operation: "extract",
      format: "tar.gz",
      archive_path: "dirs.tar.gz",
      output_dir: ".",
    });

    expect(result).not.toContain("Error");
    expect(mock_run_argv).toHaveBeenCalledTimes(2);
  });
});
