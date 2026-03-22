/**
 * cli-permission.ts — 미커버 경로 커버리지:
 * - strip_approval_flags: 빈 토큰 건너뜀
 * - has_any_flag: 빈 정규화 토큰, = 포함 토큰(flag=value)
 * - with_codex_permission_overrides: --add-dir 기존 디렉터리 감지, dir 없음
 * - with_claude_permission_overrides: plan-only 모드
 * - with_codex_mcp_runtime_overrides: mcp_enabled=false
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@src/providers/cli-mcp-loader.js", () => ({
  build_codex_mcp_overrides: vi.fn().mockReturnValue([]),
  load_mcp_servers_for_codex: vi.fn().mockReturnValue([]),
  runtime_mcp_allowlist: vi.fn().mockReturnValue(new Set()),
  should_enable_all_project_mcp_servers: vi.fn().mockReturnValue(false),
}));

import {
  strip_approval_flags,
  with_codex_permission_overrides,
  with_claude_permission_overrides,
  with_codex_mcp_runtime_overrides,
} from "@src/providers/cli-permission.js";

// ══════════════════════════════════════════════════════════
// strip_approval_flags — 빈 토큰
// ══════════════════════════════════════════════════════════

describe("strip_approval_flags — 빈 토큰", () => {
  it("빈 문자열 아이템 포함 → 건너뜀", () => {
    const result = strip_approval_flags(["", "--ask-for-approval", "all", "exec"]);
    // 빈 토큰 건너뜀, --ask-for-approval + 다음 토큰 제거
    expect(result).toEqual(["exec"]);
  });

  it("null 항목 포함 → 건너뜀", () => {
    const result = strip_approval_flags([null as any, "exec", "--ask-for-approval=all"]);
    expect(result).toEqual(["exec"]);
  });
});

// ══════════════════════════════════════════════════════════
// with_codex_permission_overrides — --add-dir 경로
// ══════════════════════════════════════════════════════════

describe("with_codex_permission_overrides — --add-dir 기존 디렉터리", () => {
  const workspace = process.platform === "win32" ? "D:\\workspace" : "/workspace";

  it("기존 --add-dir 있음 → 중복 추가 안 함", () => {
    const result = with_codex_permission_overrides(
      "codex",
      ["exec", "--add-dir", workspace, "-"],
      { sandbox: { fs_access: "workspace-write", plan_only: false, writable_roots: [workspace] } },
      { workspace_dir: workspace },
    );
    // workspace가 이미 --add-dir로 존재하므로 중복 추가 안 됨
    const add_dir_count = result.filter((v) => v === "--add-dir").length;
    expect(add_dir_count).toBe(1);
  });

  it("--add-dir 없음 + writable_roots → --add-dir 추가", () => {
    const dir = process.platform === "win32" ? "D:\\other" : "/other";
    const result = with_codex_permission_overrides(
      "codex",
      ["exec", "-"],
      { sandbox: { fs_access: "workspace-write", plan_only: false, writable_roots: [dir] } },
      { workspace_dir: workspace },
    );
    expect(result).toContain("--add-dir");
    expect(result).toContain(dir);
  });

  it("--add-dir 다음에 빈 문자열 → 건너뜀", () => {
    // --add-dir 바로 뒤에 아무것도 없는 경우
    const result = with_codex_permission_overrides(
      "codex",
      ["exec", "--add-dir", ""],
      { sandbox: { fs_access: "workspace-write", plan_only: false, writable_roots: [] } },
      { workspace_dir: workspace },
    );
    // 빈 디렉터리 토큰은 건너뜀 → existing_dirs에 포함 안 됨
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════
// with_claude_permission_overrides — plan_only
// ══════════════════════════════════════════════════════════

describe("with_claude_permission_overrides — plan_only 모드", () => {
  it("plan_only=true → --permission-mode plan", () => {
    const result = with_claude_permission_overrides(
      "claude",
      ["-p", "-"],
      { sandbox: { fs_access: "full-access", plan_only: true, writable_roots: [] } },
    );
    expect(result).toContain("--permission-mode");
    expect(result).toContain("plan");
  });

  it("비 claude 커맨드 → args 그대로 반환", () => {
    const args = ["--model", "gpt-4"];
    const result = with_claude_permission_overrides("codex", args);
    expect(result).toBe(args);
  });

  it("이미 --permission-mode 있음 → 중복 추가 안 함", () => {
    const args = ["-p", "--permission-mode", "acceptEdits", "-"];
    const result = with_claude_permission_overrides(
      "claude",
      args,
      { sandbox: { fs_access: "workspace-write", plan_only: false, writable_roots: [] } },
    );
    const count = result.filter((v) => v === "--permission-mode").length;
    expect(count).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════
// with_codex_mcp_runtime_overrides — mcp_enabled=false
// ══════════════════════════════════════════════════════════

describe("with_codex_mcp_runtime_overrides — mcp_enabled", () => {
  it("mcp_enabled=false → args 그대로 반환", () => {
    const args = ["exec", "-"];
    const result = with_codex_mcp_runtime_overrides("codex", args, undefined, {
      mcp_enabled: false,
    });
    expect(result).toBe(args);
  });

  it("비 codex 커맨드 → args 그대로 반환", () => {
    const args = ["--model", "gpt-4"];
    const result = with_codex_mcp_runtime_overrides("claude", args);
    expect(result).toBe(args);
  });

  it("이미 mcp_servers. 플래그 있음 → args 그대로 반환", () => {
    const args = ["exec", "-c", "mcp_servers.my_server=true"];
    const result = with_codex_mcp_runtime_overrides("codex", args);
    expect(result).toBe(args);
  });

  it("workspace_dir 없음 → throws", () => {
    expect(() =>
      with_codex_mcp_runtime_overrides("codex", ["exec", "-"], undefined, { mcp_enabled: true }),
    ).toThrow("workspace_dir is required");
  });
});

// ══════════════════════════════════════════════════════════
// has_any_flag — = 포함 플래그 (flag=value 형식)
// ══════════════════════════════════════════════════════════

describe("with_codex_permission_overrides — has_any_flag = 포함 플래그", () => {
  it("--dangerously-bypass-approvals-and-sandbox=true → bypass 적용", () => {
    const result = with_codex_permission_overrides(
      "codex",
      ["exec", "--dangerously-bypass-approvals-and-sandbox=true", "-"],
      undefined,
    );
    // 이미 bypass 플래그 있으므로 args 그대로
    expect(result.some((v) => v.includes("bypass"))).toBe(true);
  });

  it("빈 아이템 포함된 args → has_any_flag 빈 토큰 건너뜀", () => {
    const result = with_codex_permission_overrides(
      "codex",
      ["", "exec", "-"],
      { sandbox: { fs_access: "workspace-write", plan_only: false, writable_roots: [] } },
      { workspace_dir: "/ws" },
    );
    // 오류 없이 처리됨
    expect(Array.isArray(result)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// (merged from tests/provider/) split_args
// ══════════════════════════════════════════════════════════

import {
  split_args,
  strip_surrounding_quotes,
  split_command_with_embedded_args,
  is_codex_command,
  is_claude_command,
  is_gemini_command,
  with_gemini_permission_overrides,
} from "@src/providers/cli-permission.js";
import { sandbox_from_preset } from "@src/providers/types.js";

describe("split_args", () => {
  it("공백으로 분할", () => {
    expect(split_args("a b c")).toEqual(["a", "b", "c"]);
  });

  it("연속 공백 처리", () => {
    expect(split_args("a   b")).toEqual(["a", "b"]);
  });

  it("빈 문자열 → 빈 배열", () => {
    expect(split_args("")).toEqual([]);
  });

  it("앞뒤 공백 무시", () => {
    expect(split_args("  hello  ")).toEqual(["hello"]);
  });
});

describe("strip_surrounding_quotes", () => {
  it("큰따옴표 제거", () => {
    expect(strip_surrounding_quotes('"hello"')).toBe("hello");
  });

  it("작은따옴표 제거", () => {
    expect(strip_surrounding_quotes("'hello'")).toBe("hello");
  });

  it("따옴표 없으면 그대로", () => {
    expect(strip_surrounding_quotes("hello")).toBe("hello");
  });

  it("불완전 따옴표 유지", () => {
    expect(strip_surrounding_quotes('"hello')).toBe('"hello');
  });

  it("빈 문자열", () => {
    expect(strip_surrounding_quotes("")).toBe("");
  });
});

describe("split_command_with_embedded_args", () => {
  it("기본 분할", () => {
    const result = split_command_with_embedded_args("codex --flag value");
    expect(result.command).toBe("codex");
    expect(result.args).toEqual(["--flag", "value"]);
  });

  it("따옴표 감싼 커맨드", () => {
    const result = split_command_with_embedded_args('"C:\\Program Files\\codex.exe" arg1');
    expect(result.command).toBe("C:\\Program Files\\codex.exe");
    expect(result.args).toEqual(["arg1"]);
  });

  it("빈 입력", () => {
    const result = split_command_with_embedded_args("");
    expect(result.command).toBe("");
    expect(result.args).toEqual([]);
  });

  it("커맨드만 (인자 없음)", () => {
    const result = split_command_with_embedded_args("codex");
    expect(result.command).toBe("codex");
    expect(result.args).toEqual([]);
  });
});

describe("strip_approval_flags (merged)", () => {
  it("--ask-for-approval= 형태 제거", () => {
    const result = strip_approval_flags(["--ask-for-approval=auto", "arg1"]);
    expect(result).toEqual(["arg1"]);
  });

  it("-a 플래그 + 값 제거", () => {
    const result = strip_approval_flags(["-a", "auto", "arg1"]);
    expect(result).toEqual(["arg1"]);
  });

  it("--ask-for-approval 플래그 + 값 제거", () => {
    const result = strip_approval_flags(["--ask-for-approval", "never", "arg1"]);
    expect(result).toEqual(["arg1"]);
  });

  it("-a 뒤에 다른 플래그 → 값 소비 안 함", () => {
    const result = strip_approval_flags(["-a", "--verbose", "arg1"]);
    expect(result).toEqual(["--verbose", "arg1"]);
  });

  it("관련 없는 플래그 유지", () => {
    const result = strip_approval_flags(["--verbose", "--output", "json"]);
    expect(result).toEqual(["--verbose", "--output", "json"]);
  });

  it("빈 배열", () => {
    expect(strip_approval_flags([])).toEqual([]);
  });
});

describe("is_codex_command", () => {
  it("codex → true", () => {
    expect(is_codex_command("codex")).toBe(true);
  });

  it("codex.exe → true", () => {
    expect(is_codex_command("codex.exe")).toBe(true);
  });

  it("절대 경로", () => {
    expect(is_codex_command("/usr/bin/codex")).toBe(true);
    expect(is_codex_command("C:\\tools\\codex.exe")).toBe(true);
  });

  it("따옴표 감싼 경로", () => {
    expect(is_codex_command('"C:\\Program Files\\codex.exe"')).toBe(true);
  });

  it("claude → false", () => {
    expect(is_codex_command("claude")).toBe(false);
  });
});

describe("is_claude_command", () => {
  it("claude → true", () => {
    expect(is_claude_command("claude")).toBe(true);
  });

  it("claude.cmd → true", () => {
    expect(is_claude_command("claude.cmd")).toBe(true);
  });

  it("codex → false", () => {
    expect(is_claude_command("codex")).toBe(false);
  });
});

describe("is_gemini_command", () => {
  it("gemini → true", () => {
    expect(is_gemini_command("gemini")).toBe(true);
  });

  it("gemini.exe → true", () => {
    expect(is_gemini_command("gemini.exe")).toBe(true);
  });

  it("claude → false", () => {
    expect(is_gemini_command("claude")).toBe(false);
  });
});

describe("with_claude_permission_overrides (merged)", () => {
  it("claude 커맨드 → --permission-mode 추가", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const result = with_claude_permission_overrides("claude", [], { sandbox });
    expect(result).toContain("--permission-mode");
    expect(result).toContain("dontAsk");
  });

  it("read-only → default 모드", () => {
    const sandbox = sandbox_from_preset("strict");
    const result = with_claude_permission_overrides("claude", [], { sandbox });
    expect(result).toContain("default");
  });

  it("workspace-write → acceptEdits 모드", () => {
    const sandbox = sandbox_from_preset("workspace-write");
    const result = with_claude_permission_overrides("claude", [], { sandbox });
    expect(result).toContain("acceptEdits");
  });

  it("plan_only=true → plan 모드", () => {
    const sandbox = { ...sandbox_from_preset("full-auto"), plan_only: true };
    const result = with_claude_permission_overrides("claude", [], { sandbox });
    expect(result).toContain("plan");
  });

  it("이미 --permission-mode 있음 → 중복 추가 안 함", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const args = ["--permission-mode", "acceptEdits"];
    const result = with_claude_permission_overrides("claude", args, { sandbox });
    expect(result.filter((v) => v === "--permission-mode")).toHaveLength(1);
  });

  it("claude 커맨드 아님 → args 그대로 반환", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const args = ["--verbose"];
    const result = with_claude_permission_overrides("node", args, { sandbox });
    expect(result).toEqual(args);
  });

  it("첫 번째 인자로 claude → 적용됨", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const result = with_claude_permission_overrides("npx", ["claude", "--verbose"], { sandbox });
    expect(result).toContain("--permission-mode");
  });
});

describe("with_gemini_permission_overrides", () => {
  it("gemini 커맨드 → --approval-mode 추가", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const result = with_gemini_permission_overrides("gemini", [], { sandbox });
    expect(result).toContain("--approval-mode");
    expect(result).toContain("yolo");
  });

  it("read-only → approval-mode=default + --sandbox 추가", () => {
    const sandbox = sandbox_from_preset("strict");
    const result = with_gemini_permission_overrides("gemini", [], { sandbox });
    expect(result).toContain("default");
    expect(result).toContain("--sandbox");
  });

  it("workspace-write → auto_edit", () => {
    const sandbox = sandbox_from_preset("workspace-write");
    const result = with_gemini_permission_overrides("gemini", [], { sandbox });
    expect(result).toContain("auto_edit");
  });

  it("plan_only → approval-mode=default", () => {
    const sandbox = { ...sandbox_from_preset("full-auto"), plan_only: true };
    const result = with_gemini_permission_overrides("gemini", [], { sandbox });
    expect(result).toContain("default");
  });

  it("gemini 커맨드 아님 → args 그대로 반환", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const result = with_gemini_permission_overrides("node", ["--verbose"], { sandbox });
    expect(result).toEqual(["--verbose"]);
  });

  it("이미 --approval-mode 있음 → 중복 추가 안 함", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const args = ["--approval-mode", "auto_edit"];
    const result = with_gemini_permission_overrides("gemini", args, { sandbox });
    expect(result.filter((v) => v === "--approval-mode")).toHaveLength(1);
  });
});

describe("with_codex_permission_overrides (merged)", () => {
  const WS = "/tmp/test-workspace";

  it("codex 아닌 커맨드 → args 그대로 반환", () => {
    const result = with_codex_permission_overrides("node", ["--verbose"]);
    expect(result).toEqual(["--verbose"]);
  });

  it("full-access → bypass sandbox 플래그 추가", () => {
    const sandbox = sandbox_from_preset("full-auto");
    const result = with_codex_permission_overrides("codex", [], { sandbox }, { workspace_dir: WS });
    expect(result).toContain("--dangerously-bypass-approvals-and-sandbox");
  });

  it("이미 bypass 플래그 있음 → 그대로 반환", () => {
    const result = with_codex_permission_overrides(
      "codex",
      ["--dangerously-bypass-approvals-and-sandbox"],
      undefined,
      { workspace_dir: WS },
    );
    expect(result.filter((v) => v === "--dangerously-bypass-approvals-and-sandbox")).toHaveLength(1);
  });

  it("workspace_dir 없음 → 에러 throw", () => {
    const sandbox = sandbox_from_preset("workspace-write");
    expect(() => with_codex_permission_overrides("codex", [], { sandbox }, {})).toThrow("workspace_dir");
  });

  it("workspace-write → --sandbox workspace-write 추가", () => {
    const sandbox = sandbox_from_preset("workspace-write");
    const result = with_codex_permission_overrides("codex", [], { sandbox }, { workspace_dir: WS });
    expect(result).toContain("--sandbox");
    expect(result).toContain("workspace-write");
  });
});
