/** Process Manager 도구 — 프로세스 목록 조회, 시작, 중지. argv 배열 실행으로 CWE-78 방지. */

import { Tool } from "./base.js";
import { run_command_argv } from "./shell-runtime.js";
import { has_shell_metacharacters } from "./shell-deny.js";
import { error_message } from "../../utils/common.js";
import type { JsonSchema, ToolExecutionContext } from "./types.js";

const ALLOWED_SIGNALS = new Set(["SIGTERM", "SIGKILL", "SIGINT", "SIGHUP", "SIGUSR1", "SIGUSR2"]);

export class ProcessManagerTool extends Tool {
  readonly name = "process_manager";
  readonly category = "shell" as const;
  readonly policy_flags = { write: true } as const;
  readonly description = "List, start, or stop processes.";
  readonly parameters: JsonSchema = {
    type: "object",
    properties: {
      operation: { type: "string", enum: ["list", "start", "stop", "info"], description: "Process operation" },
      command: { type: "string", description: "Command to start (for 'start' operation)" },
      pid: { type: "integer", description: "Process ID (for 'stop'/'info' operation)" },
      signal: { type: "string", description: "Signal to send (default: SIGTERM)" },
      filter: { type: "string", description: "Process name filter (for 'list' operation)" },
    },
    required: ["operation"],
    additionalProperties: false,
  };

  private readonly workspace: string;

  constructor(options: { workspace: string }) {
    super();
    this.workspace = options.workspace;
  }

  protected async run(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const op = String(params.operation || "list");
    if (context?.signal?.aborted) return "Error: cancelled";

    try {
      switch (op) {
        case "list":  return await this.list_processes(String(params.filter || ""), context);
        case "start": return await this.start_process(String(params.command || ""), context);
        case "stop":  return await this.stop_process(Number(params.pid || 0), String(params.signal || "SIGTERM"), context);
        case "info":  return await this.process_info(Number(params.pid || 0), context);
        default: return `Error: unsupported operation "${op}"`;
      }
    } catch (err) {
      return `Error: ${error_message(err)}`;
    }
  }

  private async list_processes(filter: string, context?: ToolExecutionContext): Promise<string> {
    if (filter && has_shell_metacharacters(filter)) {
      return "Error: blocked by safety policy (shell metacharacters in filter)";
    }

    if (filter) {
      // pgrep -ail <filter> — argv 배열, 셸 보간 없음
      try {
        const { stdout } = await run_command_argv("pgrep", ["-ail", filter], {
          cwd: this.workspace,
          timeout_ms: 10_000,
          max_buffer_bytes: 1024 * 1024,
          signal: context?.signal,
        });
        if (stdout?.trim()) {
          // ps 헤더 + pgrep 결과를 합쳐서 반환
          const header_result = await run_command_argv("ps", ["aux"], {
            cwd: this.workspace,
            timeout_ms: 5_000,
            max_buffer_bytes: 1024 * 64,
            signal: context?.signal,
          }).catch(() => ({ stdout: "" }));
          const header_line = (header_result.stdout || "").split(/\r?\n/)[0] || "";
          return [header_line, stdout.trim()].filter(Boolean).join("\n") || "(no processes found)";
        }
        return "(no processes found)";
      } catch {
        // pgrep 미설치 시 fallback: ps aux 전체 출력에서 필터링
        return await this.list_processes_fallback(filter, context);
      }
    }

    // 필터 없음: ps aux (상위 30줄)
    const { stdout } = await run_command_argv("ps", ["aux", "--sort=-pcpu"], {
      cwd: this.workspace,
      timeout_ms: 10_000,
      max_buffer_bytes: 1024 * 1024,
      signal: context?.signal,
    });
    const lines = (stdout || "").split(/\r?\n/).slice(0, 30);
    return lines.join("\n").trim() || "(no processes found)";
  }

  /** pgrep 미설치 시 fallback — ps aux 출력을 JS 측에서 필터링. */
  private async list_processes_fallback(filter: string, context?: ToolExecutionContext): Promise<string> {
    const { stdout } = await run_command_argv("ps", ["aux"], {
      cwd: this.workspace,
      timeout_ms: 10_000,
      max_buffer_bytes: 1024 * 1024,
      signal: context?.signal,
    });
    const lines = (stdout || "").split(/\r?\n/);
    const header = lines[0] || "";
    const lower_filter = filter.toLowerCase();
    const matched = lines.slice(1).filter((line) => line.toLowerCase().includes(lower_filter));
    if (matched.length === 0) return "(no processes found)";
    return [header, ...matched].join("\n").trim();
  }

  private async start_process(command: string, context?: ToolExecutionContext): Promise<string> {
    if (!command) return "Error: command is required for start operation";
    if (has_shell_metacharacters(command)) {
      return "Error: blocked by safety policy (shell metacharacters in command)";
    }

    // command 를 argv로 분할: 첫 토큰이 실행 파일, 나머지가 인자
    const tokens = command.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return "Error: command is required for start operation";
    const [bin, ...args] = tokens;

    const { stdout, stderr } = await run_command_argv(bin, args, {
      cwd: this.workspace,
      timeout_ms: 10_000,
      max_buffer_bytes: 1024 * 1024,
      signal: context?.signal,
    });
    return [stdout || "", stderr ? `STDERR: ${stderr}` : ""].filter(Boolean).join("\n").trim() || "Process started";
  }

  private async stop_process(pid: number, signal: string, context?: ToolExecutionContext): Promise<string> {
    if (!pid) return "Error: pid is required for stop operation";
    const sig = ALLOWED_SIGNALS.has(signal.toUpperCase()) ? signal.toUpperCase() : "SIGTERM";

    await run_command_argv("kill", ["-s", sig, String(pid)], {
      cwd: this.workspace,
      timeout_ms: 5_000,
      max_buffer_bytes: 1024 * 64,
      signal: context?.signal,
    });
    return `Signal ${sig} sent to PID ${pid}`;
  }

  private async process_info(pid: number, context?: ToolExecutionContext): Promise<string> {
    if (!pid) return "Error: pid is required for info operation";

    const { stdout } = await run_command_argv("ps", ["-p", String(pid), "-o", "pid,ppid,user,%cpu,%mem,etime,command"], {
      cwd: this.workspace,
      timeout_ms: 5_000,
      max_buffer_bytes: 1024 * 64,
      signal: context?.signal,
    });
    return stdout?.trim() || `Process ${pid} not found`;
  }
}
