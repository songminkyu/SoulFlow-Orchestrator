/** Docker 도구 — 컨테이너 라이프사이클 관리. argv 배열 실행으로 CWE-78 방지. */

import { Tool } from "./base.js";
import { run_command_argv } from "./shell-runtime.js";
import { has_shell_metacharacters } from "./shell-deny.js";
import { error_message } from "../../utils/common.js";
import type { JsonSchema, ToolExecutionContext } from "./types.js";

/** 인자 시퀀스에서 차단할 조합 (연속 2토큰). */
function is_blocked_arg_pair(a: string, b: string): boolean {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === "--pid" && lb === "host") return true;
  if (la === "--net" && lb === "host") return true;
  return false;
}

/** `-v /:/host` 같은 root 볼륨 마운트 차단. */
function is_blocked_volume(arg: string): boolean {
  // -v /: 또는 --volume=/: 패턴
  if (/^-v$/.test(arg)) return false; // 단독 -v는 뒤 인자와 함께 검사
  if (/^--volume=\/:/.test(arg)) return true;
  return false;
}

function is_root_mount(volume_spec: string): boolean {
  return /^\/:/.test(volume_spec);
}

export class DockerTool extends Tool {
  readonly name = "docker";
  readonly category = "shell" as const;
  readonly policy_flags = { write: true } as const;
  readonly description = "Manage Docker containers: ps, run, stop, rm, logs, exec, images.";
  readonly parameters: JsonSchema = {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["ps", "run", "stop", "rm", "logs", "exec", "images", "inspect"],
        description: "Docker operation",
      },
      container: { type: "string", description: "Container name or ID" },
      image: { type: "string", description: "Image name (for 'run')" },
      command: { type: "string", description: "Command to run inside container (for 'run'/'exec')" },
      args: { type: "string", description: "Additional docker arguments" },
      tail: { type: "integer", minimum: 1, maximum: 500, description: "Number of log lines (for 'logs')" },
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
    const op = String(params.operation || "ps");
    const container = String(params.container || "").trim();
    const image = String(params.image || "").trim();
    const command = String(params.command || "").trim();
    const extra_args = String(params.args || "").trim();
    const tail = Math.max(1, Math.min(500, Number(params.tail || 50)));

    if (context?.signal?.aborted) return "Error: cancelled";

    // 셸 메타문자 검사 — argv에서도 인자 내부에 주입 벡터가 있으면 차단
    for (const field of [container, image, command]) {
      if (field && has_shell_metacharacters(field)) {
        return "Error: blocked by safety policy (shell metacharacters in input)";
      }
    }

    const argv = this.build_argv(op, container, image, command, extra_args, tail);
    if (!argv) return `Error: unsupported operation "${op}" or missing required params`;

    // 안전 정책 검사 (argv 배열 수준)
    const policy_error = this.check_safety_policy(argv);
    if (policy_error) return policy_error;

    try {
      const { stdout, stderr } = await run_command_argv("docker", argv, {
        cwd: this.workspace,
        timeout_ms: 60_000,
        max_buffer_bytes: 1024 * 1024 * 4,
        signal: context?.signal,
      });
      const output = [stdout || "", stderr ? `STDERR:\n${stderr}` : ""].filter(Boolean).join("\n").trim();
      const text = output || "(no output)";
      return text.length > 20_000 ? `${text.slice(0, 20_000)}\n... (truncated)` : text;
    } catch (err) {
      return `Error: ${error_message(err)}`;
    }
  }

  /** extra_args 문자열을 안전하게 토큰 배열로 분할한다. */
  private split_extra_args(raw: string): string[] {
    if (!raw) return [];
    // 간단한 공백 분할 — 따옴표 파싱은 의도적으로 하지 않음 (셸 보간 제거 목적)
    return raw.split(/\s+/).filter(Boolean);
  }

  private build_argv(op: string, container: string, image: string, command: string, args: string, tail: number): string[] | null {
    const extra = this.split_extra_args(args);
    switch (op) {
      case "ps":      return ["ps", "-a", ...extra];
      case "images":  return ["images", ...extra];
      case "run":     return image ? ["run", ...extra, image, ...(command ? command.split(/\s+/) : [])] : null;
      case "stop":    return container ? ["stop", container] : null;
      case "rm":      return container ? ["rm", container] : null;
      case "logs":    return container ? ["logs", "--tail", String(tail), container] : null;
      case "exec":    return (container && command) ? ["exec", ...extra, container, ...command.split(/\s+/)] : null;
      case "inspect": return container ? ["inspect", container] : null;
      default: return null;
    }
  }

  private check_safety_policy(argv: string[]): string | null {
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];

      // 단일 인자 차단
      if (/^--privileged$/i.test(arg)) {
        return "Error: blocked by safety policy (privileged/host access)";
      }
      if (is_blocked_volume(arg)) {
        return "Error: blocked by safety policy (privileged/host access)";
      }

      // 연속 2토큰 차단 (--pid host, --net host)
      if (i + 1 < argv.length && is_blocked_arg_pair(arg, argv[i + 1])) {
        return "Error: blocked by safety policy (privileged/host access)";
      }

      // -v /:/host 패턴 (단독 -v + 다음 인자)
      if (/^-v$/i.test(arg) && i + 1 < argv.length && is_root_mount(argv[i + 1])) {
        return "Error: blocked by safety policy (privileged/host access)";
      }
    }
    return null;
  }
}
