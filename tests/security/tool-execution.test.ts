/**
 * SH-4 Tool Execution Hardening 회귀 테스트.
 * - archive: shell string 대신 argv 배열 사용 확인
 * - ssh: StrictHostKeyChecking=accept-new 기본 적용 확인
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── archive mock: shell-runtime ────────────────────────
const { mock_run_argv } = vi.hoisted(() => ({
  mock_run_argv: vi.fn().mockResolvedValue({ stdout: "ok", stderr: "" }),
}));

vi.mock("@src/agent/tools/shell-runtime.js", () => ({
  run_command_argv: mock_run_argv,
}));

// ── ssh mock: node:child_process ───────────────────────
const { mock_exec_file } = vi.hoisted(() => ({
  mock_exec_file: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mock_exec_file,
}));

import { ArchiveTool } from "@src/agent/tools/archive.js";
import { SshTool } from "@src/agent/tools/ssh.js";

beforeEach(() => {
  mock_run_argv.mockClear();
  mock_exec_file.mockReset();
});

// ══════════════════════════════════════════
// archive: argv injection 방어
// ══════════════════════════════════════════

describe("SH-4: archive argv injection 방어", () => {
  function make_tool(): ArchiveTool {
    return new ArchiveTool({ workspace: "/workspace" });
  }

  it("create tar.gz → argv 배열로 실행 (shell string 아님)", async () => {
    await make_tool().execute({ operation: "create", archive_path: "out.tar.gz", files: ["file1.txt"] });
    expect(mock_run_argv).toHaveBeenCalledOnce();
    const [cmd, args] = mock_run_argv.mock.calls[0] as [string, string[]];
    expect(cmd).toBe("tar");
    expect(args).toEqual(["czf", "out.tar.gz", "file1.txt"]);
  });

  it("extract zip → argv 배열로 실행", async () => {
    // output_dir은 workspace-상대 경로여야 함 (PCH-S8: zip-slip 방어 경계 검증)
    await make_tool().execute({ operation: "extract", format: "zip", archive_path: "data.zip", output_dir: "out" });
    // PCH-S8: scan_entries_for_traversal(list) 1회 + 실제 extract 1회 = 총 2회 호출
    expect(mock_run_argv).toHaveBeenCalledTimes(2);
    const [cmd, args] = mock_run_argv.mock.calls[1] as [string, string[]];
    expect(cmd).toBe("unzip");
    expect(args).toContain("-d");
    expect(args).toContain("out");
  });

  it("shell injection 문자가 포함된 파일명 → argv에 그대로 전달 (해석 안 됨)", async () => {
    const malicious_file = "file; rm -rf /";
    await make_tool().execute({ operation: "create", archive_path: "out.tar.gz", files: [malicious_file] });
    const [cmd, args] = mock_run_argv.mock.calls[0] as [string, string[]];
    expect(cmd).toBe("tar");
    // shell injection 문자가 단일 argv 원소로 그대로 전달됨
    expect(args).toContain(malicious_file);
    // run_command_argv는 shell: false로 실행하므로 `;` 이후가 별도 명령으로 실행되지 않음
  });

  it("$(command) 포함 archive_path → argv에 그대로 전달", async () => {
    const malicious_path = "$(whoami).tar.gz";
    await make_tool().execute({ operation: "list", archive_path: malicious_path });
    const [cmd, args] = mock_run_argv.mock.calls[0] as [string, string[]];
    expect(cmd).toBe("tar");
    expect(args).toContain(malicious_path);
  });
});

// ══════════════════════════════════════════
// ssh: StrictHostKeyChecking=accept-new 검증
// ══════════════════════════════════════════

/** execFile 성공 응답 설정 */
function set_exec_success(stdout: string, stderr = "") {
  mock_exec_file.mockImplementationOnce((_cmd: unknown, _args: unknown, _opts: unknown, cb: (err: null, out: string, err2: string) => void) => {
    cb(null, stdout, stderr);
  });
}

describe("SH-4: SSH StrictHostKeyChecking 보안 기본값", () => {
  function make_ssh_tool(): SshTool { return new SshTool(); }

  it("exec → StrictHostKeyChecking=accept-new 포함", async () => {
    set_exec_success("ok");
    await make_ssh_tool().execute({ action: "exec", host: "server.example.com", command: "whoami" });
    expect(mock_exec_file).toHaveBeenCalledOnce();
    const [, args] = mock_exec_file.mock.calls[0] as [string, string[]];
    expect(args).toContain("StrictHostKeyChecking=accept-new");
    expect(args).toContain("ConnectTimeout=10");
  });

  it("scp_upload → StrictHostKeyChecking=accept-new 포함", async () => {
    set_exec_success("");
    await make_ssh_tool().execute({
      action: "scp_upload", host: "server.example.com",
      local_path: "/tmp/a", remote_path: "/tmp/b",
    });
    expect(mock_exec_file).toHaveBeenCalledOnce();
    const [, args] = mock_exec_file.mock.calls[0] as [string, string[]];
    expect(args).toContain("StrictHostKeyChecking=accept-new");
    expect(args).toContain("ConnectTimeout=10");
  });

  it("scp_download → StrictHostKeyChecking=accept-new 포함", async () => {
    set_exec_success("");
    await make_ssh_tool().execute({
      action: "scp_download", host: "server.example.com",
      local_path: "/tmp/a", remote_path: "/tmp/b",
    });
    expect(mock_exec_file).toHaveBeenCalledOnce();
    const [, args] = mock_exec_file.mock.calls[0] as [string, string[]];
    expect(args).toContain("StrictHostKeyChecking=accept-new");
    expect(args).toContain("ConnectTimeout=10");
  });

  it("info → StrictHostKeyChecking=accept-new 포함", async () => {
    set_exec_success("Linux server 5.15.0");
    await make_ssh_tool().execute({ action: "info", host: "server.example.com" });
    expect(mock_exec_file).toHaveBeenCalledOnce();
    const [, args] = mock_exec_file.mock.calls[0] as [string, string[]];
    expect(args).toContain("StrictHostKeyChecking=accept-new");
    expect(args).toContain("ConnectTimeout=10");
  });
});
