/**
 * Archive 도구 — tar/zip 생성 및 해제.
 * shell 문자열 보간 대신 argv 배열로 실행하여 shell injection을 차단한다.
 * 추출 시 zip-slip(CWE-22) 방어: 엔트리 경로가 output_dir 밖이면 전체 추출 중단.
 */

import { resolve } from "node:path";
import { Tool } from "./base.js";
import { run_command_argv } from "./shell-runtime.js";
import { error_message } from "../../utils/common.js";
import { validate_file_path } from "../../utils/path-validation.js";
import type { JsonSchema, ToolExecutionContext } from "./types.js";

export class ArchiveTool extends Tool {
  readonly name = "archive";
  readonly category = "filesystem" as const;
  readonly policy_flags = { write: true } as const;
  readonly description = "Create or extract tar/zip archives.";
  readonly parameters: JsonSchema = {
    type: "object",
    properties: {
      operation: { type: "string", enum: ["create", "extract", "list"], description: "Archive operation" },
      format: { type: "string", enum: ["tar.gz", "zip"], description: "Archive format (default: tar.gz)" },
      archive_path: { type: "string", description: "Path to the archive file" },
      files: {
        type: "array",
        items: { type: "string" },
        description: "Files/dirs to include (for create). Each entry is validated individually.",
      },
      output_dir: { type: "string", description: "Output directory for extraction" },
    },
    required: ["operation", "archive_path"],
    additionalProperties: false,
  };

  private readonly workspace: string;

  constructor(options: { workspace: string }) {
    super();
    this.workspace = options.workspace;
  }

  protected async run(params: Record<string, unknown>, context?: ToolExecutionContext): Promise<string> {
    const op = String(params.operation || "list");
    const format = String(params.format || "tar.gz");
    const archive = String(params.archive_path || "");
    const files_raw = params.files;
    const files = Array.isArray(files_raw)
      ? (files_raw as unknown[]).map(String).filter(Boolean)
      : [];
    const output_dir = String(params.output_dir || ".").trim();

    if (!archive) return "Error: archive_path is required";
    if (context?.signal?.aborted) return "Error: cancelled";

    // zip-slip 방어: extract 시 output_dir이 workspace 내부인지 검증
    if (op === "extract") {
      const resolved_output = resolve(this.workspace, output_dir);
      if (!validate_file_path(resolved_output, [this.workspace])) {
        return "Error: output_dir escapes workspace boundary (path traversal blocked)";
      }
      // 추출 전 엔트리 목록 스캔 — 경로 탈출 엔트리 차단
      const scan_error = await this.scan_entries_for_traversal(format, archive, resolved_output, context?.signal);
      if (scan_error) return scan_error;
    }

    const argv = this.build_argv(op, format, archive, files, output_dir);
    if (!argv) return `Error: unsupported operation/format "${op}/${format}"`;

    try {
      const [cmd, ...args] = argv;
      const { stdout, stderr } = await run_command_argv(cmd, args, {
        cwd: this.workspace,
        timeout_ms: 120_000,
        max_buffer_bytes: 1024 * 1024 * 4,
        signal: context?.signal,
      });
      const output = [stdout || "", stderr ? `STDERR:\n${stderr}` : ""].filter(Boolean).join("\n").trim();
      return output || `${op} completed: ${archive}`;
    } catch (err) {
      return `Error: ${error_message(err)}`;
    }
  }

  /**
   * 추출 전 아카이브 엔트리를 목록 조회하여 경로 탈출(zip-slip) 여부를 검사한다.
   * 하나라도 output_dir 밖으로 탈출하는 엔트리가 있으면 에러 메시지를 반환한다.
   */
  private async scan_entries_for_traversal(
    format: string,
    archive: string,
    resolved_output: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const list_argv = this.build_argv("list", format, archive, [], ".");
    if (!list_argv) return null; // list 명령을 만들 수 없으면 스킵 (build_argv가 null)

    let stdout: string;
    try {
      const [cmd, ...args] = list_argv;
      const result = await run_command_argv(cmd, args, {
        cwd: this.workspace,
        timeout_ms: 60_000,
        max_buffer_bytes: 1024 * 1024 * 4,
        signal,
      });
      stdout = result.stdout;
    } catch {
      // 목록 조회 실패 시 안전하게 차단 — 검증 불가능한 아카이브는 추출하지 않는다
      return "Error: cannot list archive entries for path traversal check — extraction blocked";
    }

    const entries = this.parse_entry_names(format, stdout);
    for (const entry of entries) {
      if (!entry || entry.endsWith("/")) continue; // 디렉토리 엔트리는 무시
      const resolved_entry = resolve(resolved_output, entry);
      if (!validate_file_path(resolved_entry, [resolved_output])) {
        return `Error: archive entry "${entry}" escapes output directory (zip-slip blocked)`;
      }
    }
    return null;
  }

  /**
   * 아카이브 목록 출력에서 엔트리 이름을 파싱한다.
   * - tar: 각 줄이 파일 경로
   * - unzip -l: 고정 너비 테이블 형식, 4번째 컬럼이 파일명
   */
  private parse_entry_names(format: string, stdout: string): string[] {
    const lines = stdout.split(/\r?\n/).filter(Boolean);
    if (format === "tar.gz") {
      return lines.map((l) => l.trim()).filter(Boolean);
    }
    // unzip -l 형식: "  Length      Date    Time    Name\n ---------  ---------- -----   ----\n   123  2024-01-01 00:00   file.txt"
    // 헤더/푸터를 건너뛰고 Name 컬럼을 추출한다.
    const entries: string[] = [];
    let in_body = false;
    for (const line of lines) {
      if (line.trim().startsWith("---")) {
        in_body = !in_body;
        continue;
      }
      if (!in_body) continue;
      // unzip -l 라인에서 마지막 필드(파일명) 추출: "   123  2024-01-01 00:00   path/to/file"
      const match = line.match(/\d{2}:\d{2}\s+(.+)$/);
      if (match) entries.push(match[1].trim());
    }
    return entries;
  }

  /** shell 없이 실행할 argv 배열을 반환. null이면 지원하지 않는 조합. */
  private build_argv(op: string, format: string, archive: string, files: string[], output_dir: string): string[] | null {
    if (format === "tar.gz") {
      switch (op) {
        case "create":  return files.length > 0 ? ["tar", "czf", archive, ...files] : null;
        case "extract": return ["tar", "xzf", archive, "-C", output_dir];
        case "list":    return ["tar", "tzf", archive];
        default: return null;
      }
    }
    if (format === "zip") {
      switch (op) {
        case "create":  return files.length > 0 ? ["zip", "-r", archive, ...files] : null;
        case "extract": return ["unzip", "-o", archive, "-d", output_dir];
        case "list":    return ["unzip", "-l", archive];
        default: return null;
      }
    }
    return null;
  }
}
