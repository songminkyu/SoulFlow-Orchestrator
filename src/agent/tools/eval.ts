/** Eval 도구 — vm.runInNewContext 기반 격리 JS 평가. */

import { Tool } from "./base.js";
import type { JsonSchema } from "./types.js";
import { sandbox_run_as_function } from "./sandbox-runner.js";

const MAX_CODE_LENGTH = 10_000;

export class EvalTool extends Tool {
  readonly name = "eval";
  readonly category = "memory" as const;
  readonly description =
    "Safely evaluate JavaScript expressions in a sandboxed context. Supports JSON context injection, multi-line code, and structured output.";
  readonly parameters: JsonSchema = {
    type: "object",
    properties: {
      code: { type: "string", description: "JavaScript code to evaluate" },
      context: { type: "string", description: "JSON object to inject as variables (e.g. {\"x\": 1, \"y\": 2})" },
      timeout_ms: { type: "integer", minimum: 100, maximum: 30000, description: "Execution timeout in ms (default: 5000)" },
    },
    required: ["code"],
    additionalProperties: false,
  };

  protected async run(params: Record<string, unknown>): Promise<string> {
    const code = String(params.code || "");
    if (!code.trim()) return "Error: empty code";
    if (code.length > MAX_CODE_LENGTH) return `Error: code exceeds ${MAX_CODE_LENGTH} chars`;

    let context: Record<string, unknown> = {};
    if (params.context) {
      try {
        const parsed = typeof params.context === "string" ? JSON.parse(params.context) : params.context;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          context = parsed as Record<string, unknown>;
        }
      } catch {
        return "Error: invalid context JSON";
      }
    }

    const timeout_ms = typeof params.timeout_ms === "number" ? params.timeout_ms : 5_000;
    const keys = Object.keys(context);
    const values = Object.values(context);
    const out = sandbox_run_as_function(keys, code, values, timeout_ms);
    if ("error" in out) return `Error: ${out.error}`;
    return this.format_result(out.result);
  }

  private format_result(result: unknown): string {
    if (result === undefined) return "undefined";
    if (result === null) return "null";
    if (typeof result === "object") {
      try { return JSON.stringify(result, null, 2); } catch { return String(result); }
    }
    return String(result);
  }
}
