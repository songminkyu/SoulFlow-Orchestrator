/** 도구 실행 핸들러: providers legacy 경로에서 tool_calls 배열을 처리. */

import type { ToolExecutionContext } from "../agent/tools/types.js";
import type { AgentEvent } from "../agent/agent.types.js";
import type { Logger } from "../logger.js";
import type { AppendWorkflowEventInput } from "../events/index.js";
import { StreamBuffer } from "../channels/stream-buffer.js";
import { format_tool_label, format_tool_block } from "./prompts.js";
import { now_iso, error_message } from "../utils/common.js";
import type { BudgetTracker } from "./guardrails/enforcement.js";
import { is_over_budget } from "./guardrails/enforcement.js";
import type { ToolOutputReducer } from "./tool-output-reducer.js";
import type { ToolChoiceMode } from "../contracts.js";

export type ToolCallEntry = { name: string; arguments?: Record<string, unknown> };
export type ToolCallState = { suppress: boolean; file_requested?: boolean; done_sent?: boolean; tool_count: number };

type ToolCallStreamContext = {
  buffer: StreamBuffer;
  on_stream?: (chunk: string) => void;
  on_tool_block?: (block: string) => void;
  on_tool_event?: (event: AgentEvent) => void;
  log_ctx?: { run_id: string; agent_id: string; provider: string; chat_id: string };
};

export type ToolCallHandlerDeps = {
  max_tool_result_chars: number;
  logger: Logger;
  execute_tool: (name: string, params: Record<string, unknown>, ctx?: ToolExecutionContext) => Promise<string>;
  log_event: (input: AppendWorkflowEventInput) => void;
  /** 3-projection reducer. 미지정 시 기존 truncate_tool_result 동작으로 fallback. */
  reducer?: ToolOutputReducer;
  /** OB: 도구 실행 메트릭 싱크. 미설정 시 스킵. */
  metrics?: import("../observability/metrics.js").MetricsSinkLike | null;
  /** OB: 등록된 도구 이름 목록. 미등록 이름은 "unknown"으로 정규화하여 cardinality 폭증 방지. */
  known_tool_names?: ReadonlySet<string>;
  /** FE-BE: 도구 선택 정책. 기본값 "auto". */
  tool_choice?: ToolChoiceMode;
  /** FE-BE: 허용 도구 allowlist. 설정 시 목록 외 도구는 실행 억제. */
  pinned_tools?: ReadonlySet<string> | string[];
  /** FE-BE: manual 모드 — 도구 실행 전 승인 요청 콜백. true 반환 시 실행, false 반환 시 억제. */
  request_approval?: (tool_name: string, args: Record<string, unknown>) => Promise<boolean>;
};

export function create_tool_call_handler(
  deps: ToolCallHandlerDeps,
  tool_ctx: ToolExecutionContext,
  state: ToolCallState,
  stream_ctx?: ToolCallStreamContext,
  budget?: BudgetTracker,
): (args: { tool_calls: ToolCallEntry[] }) => Promise<string> {
  const max_chars = deps.max_tool_result_chars;
  const tool_choice = deps.tool_choice ?? "auto";
  const pinned = deps.pinned_tools
    ? new Set(Array.isArray(deps.pinned_tools) ? deps.pinned_tools : [...deps.pinned_tools])
    : null;

  const flush_stream = () => {
    if (!stream_ctx?.on_stream) return;
    const content = stream_ctx.buffer.flush();
    if (content) {
      try { stream_ctx.on_stream(content); } catch { /* stream failure 무시 */ }
    }
  };
  return async ({ tool_calls }) => {
    // FE-BE: "none" 모드 — 모든 tool_calls 억제
    if (tool_choice === "none") {
      return tool_calls.map((tc) => `[tool:${tc.name}] suppressed: tool_choice=none`).join("\n");
    }
    const outputs: string[] = [];
    for (const tc of tool_calls) {
      // EG-4: budget 초과 시 이후 tool 실행 스킵
      if (budget && is_over_budget(budget)) {
        outputs.push(`[tool:${tc.name}] skipped: budget exceeded (${budget.used}/${budget.max})`);
        continue;
      }
      // FE-BE: pinned_tools allowlist 검사 (auto/manual 모드 공통)
      if (pinned && !pinned.has(tc.name)) {
        outputs.push(`[tool:${tc.name}] suppressed: not in pinned_tools`);
        continue;
      }
      // FE-BE: "manual" 모드 — 실행 전 승인 요청
      if (tool_choice === "manual" && deps.request_approval) {
        const approved = await deps.request_approval(tc.name, tc.arguments || {});
        if (!approved) {
          outputs.push(`[tool:${tc.name}] suppressed: approval denied`);
          continue;
        }
      }
      if (tc.name === "request_file") state.file_requested = true;
      if (tc.name === "message" && is_done_phase((tc.arguments || {}) as Record<string, unknown>)) {
        state.suppress = true;
        state.done_sent = true;
      }
      const label = format_tool_label(tc.name, tc.arguments);
      if (stream_ctx?.on_tool_event) {
        stream_ctx.on_tool_event({
          type: "tool_use",
          source: { backend: "claude_cli" as const, task_id: tool_ctx.task_id },
          at: now_iso(),
          tool_name: tc.name, tool_id: "",
          params: tc.arguments || {},
        });
      }
      const emit_result = (result_text: string, is_error: boolean) => {
        // 3-projection: reducer 제공 시 prompt/display/storage 분리, 미제공 시 fallback
        let prompt: string;
        let display: string;
        let storage_preview: string;

        if (deps.reducer && !is_error) {
          const reduced = deps.reducer.reduce({
            tool_name: tc.name, params: tc.arguments || {}, result_text, is_error,
          });
          prompt = reduced.prompt_text;
          display = reduced.display_text;
          storage_preview = reduced.storage_text.slice(0, 500);
        } else {
          prompt = is_error ? result_text : truncate_tool_result(result_text, max_chars);
          display = result_text;
          storage_preview = prompt.slice(0, 500);
        }

        if (stream_ctx?.on_tool_event) {
          stream_ctx.on_tool_event({
            type: "tool_result",
            source: { backend: "claude_cli" as const, task_id: tool_ctx.task_id },
            at: now_iso(),
            tool_name: tc.name, tool_id: "",
            result: prompt, params: tc.arguments, is_error,
          });
        }
        if (stream_ctx?.log_ctx) {
          const lc = stream_ctx.log_ctx;
          deps.log_event({
            run_id: lc.run_id, task_id: tool_ctx.task_id || lc.run_id,
            agent_id: lc.agent_id, provider: lc.provider, channel: lc.provider, chat_id: lc.chat_id,
            source: "system", phase: "progress",
            summary: `tool: ${tc.name}${is_error ? " (error)" : ""}`,
            detail: storage_preview,
            payload: { tool_name: tc.name, is_error },
          });
        }
        const block = format_tool_block(label, display, is_error);
        if (stream_ctx?.on_tool_block) {
          stream_ctx.on_tool_block(block);
        } else if (stream_ctx?.on_stream) {
          stream_ctx.buffer.append(block);
          flush_stream();
        }
        return prompt;
      };

      const tool_start = Date.now();
      // OB: cardinality 제한 — 미등록 도구 이름은 "unknown"으로 정규화
      const safe_tool_name = deps.known_tool_names?.has(tc.name) ? tc.name : "unknown";
      try {
        deps.logger.debug("tool_call", { name: tc.name, args: tc.arguments });
        const result = await deps.execute_tool(tc.name, tc.arguments || {}, tool_ctx);
        state.tool_count += 1;
        if (budget) budget.used += 1;
        deps.logger.debug("tool_result", { name: tc.name, result: String(result).slice(0, 200) });
        deps.metrics?.counter("tool_execution_total", 1, { tool_name: safe_tool_name });
        deps.metrics?.histogram("tool_execution_duration_ms", Date.now() - tool_start, { tool_name: safe_tool_name });
        const truncated = emit_result(result, false);
        outputs.push(`[tool:${tc.name}] ${truncated}`);
      } catch (e) {
        state.tool_count += 1;
        if (budget) budget.used += 1;
        const err_msg = error_message(e);
        deps.logger.debug("tool_error", { name: tc.name, error: err_msg });
        deps.metrics?.counter("tool_execution_total", 1, { tool_name: safe_tool_name, status: "error" });
        deps.metrics?.histogram("tool_execution_duration_ms", Date.now() - tool_start, { tool_name: safe_tool_name });
        emit_result(err_msg, true);
        outputs.push(`[tool:${tc.name}] error: ${err_msg}`);
      }
    }
    return outputs.join("\n");
  };
}

// ── 유틸 ──

function truncate_tool_result(result: string, max_chars: number): string {
  const limit = Math.max(100, max_chars);
  if (result.length <= limit) return result;
  const half = Math.floor((limit - 40) / 2);
  return `${result.slice(0, half)}\n...[truncated ${result.length - limit} chars]...\n${result.slice(-half)}`;
}

function is_done_phase(args: Record<string, unknown>): boolean {
  return String(args.phase || "").trim().toLowerCase() === "done";
}
