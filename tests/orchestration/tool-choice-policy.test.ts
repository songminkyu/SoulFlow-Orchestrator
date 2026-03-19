/**
 * FE-BE: 도구 선택 정책 레이어 테스트.
 *
 * 검증 대상:
 * - tool_choice=none → tool_calls 완전 억제
 * - tool_choice=manual → 승인 요청 + 승인/거부 분기
 * - tool_choice=auto → 기존 동작 유지 (회귀 없음)
 * - pinned_tools → 허용 목록 외 도구 억제
 * - 기본값 "auto" → 기존 동작 회귀 없음
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { create_tool_call_handler } from "@src/orchestration/tool-call-handler.js";
import type { ToolCallHandlerDeps, ToolCallState } from "@src/orchestration/tool-call-handler.js";
import type { ToolExecutionContext } from "@src/agent/tools/types.js";
import type { Logger } from "@src/logger.js";

/* ── 공통 헬퍼 ── */

const mockLogger: Partial<Logger> = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockToolCtx: ToolExecutionContext = {
  task_id: "task-fe-be",
  signal: undefined as unknown as AbortSignal,
  channel: "web",
  chat_id: "chat-1",
  sender_id: "user-1",
  reply_to: "msg-1",
};

function make_deps(overrides: Partial<ToolCallHandlerDeps> = {}): ToolCallHandlerDeps {
  return {
    max_tool_result_chars: 1000,
    logger: mockLogger as Logger,
    execute_tool: vi.fn(async () => "tool_result"),
    log_event: vi.fn(),
    ...overrides,
  };
}

function make_state(): ToolCallState {
  return { suppress: false, tool_count: 0 };
}

/* ── 테스트 ── */

describe("FE-BE 도구 선택 정책 (ToolChoiceMode)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── tool_choice=none ──

  describe("tool_choice=none — tool_calls 억제", () => {
    it("단일 도구 → suppressed 메시지 반환, execute_tool 미호출", async () => {
      const deps = make_deps({ tool_choice: "none" });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "bash", arguments: { cmd: "ls" } }] });

      expect(result).toContain("suppressed: tool_choice=none");
      expect(result).toContain("[tool:bash]");
      expect(deps.execute_tool).not.toHaveBeenCalled();
      // 카운터는 증가하지 않음
      expect(state.tool_count).toBe(0);
    });

    it("복수 도구 → 모두 suppressed, execute_tool 미호출", async () => {
      const deps = make_deps({ tool_choice: "none" });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({
        tool_calls: [
          { name: "bash" },
          { name: "read_file" },
          { name: "write_file" },
        ],
      });

      expect(result).toContain("[tool:bash]");
      expect(result).toContain("[tool:read_file]");
      expect(result).toContain("[tool:write_file]");
      expect(deps.execute_tool).not.toHaveBeenCalled();
    });

    it("빈 tool_calls → 빈 문자열 반환", async () => {
      const deps = make_deps({ tool_choice: "none" });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [] });

      expect(result).toBe("");
      expect(deps.execute_tool).not.toHaveBeenCalled();
    });
  });

  // ── tool_choice=manual ──

  describe("tool_choice=manual — 승인 요청 분기", () => {
    it("승인 콜백이 true → 도구 정상 실행", async () => {
      const request_approval = vi.fn(async () => true);
      const deps = make_deps({ tool_choice: "manual", request_approval });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "bash", arguments: { cmd: "echo hi" } }] });

      expect(request_approval).toHaveBeenCalledWith("bash", { cmd: "echo hi" });
      expect(deps.execute_tool).toHaveBeenCalledWith("bash", { cmd: "echo hi" }, mockToolCtx);
      expect(result).toContain("tool_result");
    });

    it("승인 콜백이 false → 도구 억제, execute_tool 미호출", async () => {
      const request_approval = vi.fn(async () => false);
      const deps = make_deps({ tool_choice: "manual", request_approval });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "write_file", arguments: {} }] });

      expect(request_approval).toHaveBeenCalledWith("write_file", {});
      expect(deps.execute_tool).not.toHaveBeenCalled();
      expect(result).toContain("suppressed: approval denied");
    });

    it("manual + request_approval 미설정 → auto처럼 동작 (억제 없음)", async () => {
      // request_approval 없는 manual은 승인 단계 스킵하고 실행
      const deps = make_deps({ tool_choice: "manual" });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      await handler({ tool_calls: [{ name: "bash" }] });

      expect(deps.execute_tool).toHaveBeenCalledWith("bash", {}, mockToolCtx);
    });

    it("복수 도구: 첫 번째 승인, 두 번째 거부", async () => {
      const request_approval = vi.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      const deps = make_deps({ tool_choice: "manual", request_approval });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({
        tool_calls: [{ name: "bash" }, { name: "dangerous_tool" }],
      });

      expect(deps.execute_tool).toHaveBeenCalledTimes(1);
      expect(deps.execute_tool).toHaveBeenCalledWith("bash", {}, mockToolCtx);
      expect(result).toContain("[tool:dangerous_tool]");
      expect(result).toContain("approval denied");
    });
  });

  // ── tool_choice=auto ──

  describe("tool_choice=auto — 기존 동작 유지 (회귀 없음)", () => {
    it("auto 명시적 설정 → 도구 실행, 억제 없음", async () => {
      const deps = make_deps({ tool_choice: "auto" });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "bash", arguments: {} }] });

      expect(deps.execute_tool).toHaveBeenCalled();
      expect(result).not.toContain("suppressed");
    });

    it("tool_choice 미설정(기본값) → auto와 동일 동작", async () => {
      // tool_choice 없으면 default = "auto"
      const deps = make_deps(); // tool_choice 없음
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "read_file", arguments: { path: "/x" } }] });

      expect(deps.execute_tool).toHaveBeenCalledWith("read_file", { path: "/x" }, mockToolCtx);
      expect(result).not.toContain("suppressed");
      expect(state.tool_count).toBe(1);
    });

    it("auto: file_requested, done_sent 상태 변경 정상 동작", async () => {
      const deps = make_deps({ tool_choice: "auto" });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      await handler({ tool_calls: [{ name: "request_file" }, { name: "message", arguments: { phase: "done" } }] });

      expect(state.file_requested).toBe(true);
      expect(state.done_sent).toBe(true);
    });
  });

  // ── pinned_tools ──

  describe("pinned_tools — 허용 도구 allowlist", () => {
    it("도구가 pinned_tools에 있음 → 실행", async () => {
      const deps = make_deps({ pinned_tools: ["bash", "read_file"] });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "bash", arguments: {} }] });

      expect(deps.execute_tool).toHaveBeenCalledWith("bash", {}, mockToolCtx);
      expect(result).not.toContain("suppressed");
    });

    it("도구가 pinned_tools에 없음 → 억제", async () => {
      const deps = make_deps({ pinned_tools: ["read_file"] });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "bash", arguments: {} }] });

      expect(deps.execute_tool).not.toHaveBeenCalled();
      expect(result).toContain("not in pinned_tools");
    });

    it("복수 도구 중 일부만 pinned → 허용된 것만 실행", async () => {
      const deps = make_deps({ pinned_tools: ["bash"] });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({
        tool_calls: [
          { name: "bash" },
          { name: "write_file" },
          { name: "bash" },
        ],
      });

      // bash 2회 실행, write_file 억제
      expect(deps.execute_tool).toHaveBeenCalledTimes(2);
      expect(result).toContain("[tool:write_file]");
      expect(result).toContain("not in pinned_tools");
    });

    it("pinned_tools=[] → 모든 도구 억제", async () => {
      const deps = make_deps({ pinned_tools: [] });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      const result = await handler({ tool_calls: [{ name: "bash" }] });

      expect(deps.execute_tool).not.toHaveBeenCalled();
      expect(result).toContain("not in pinned_tools");
    });

    it("pinned_tools Set 형태도 지원", async () => {
      const deps = make_deps({ pinned_tools: new Set(["bash"]) });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      await handler({ tool_calls: [{ name: "bash" }] });

      expect(deps.execute_tool).toHaveBeenCalled();
    });

    it("manual + pinned_tools 조합 → pinned 통과 후 승인 요청", async () => {
      const request_approval = vi.fn(async () => true);
      const deps = make_deps({
        tool_choice: "manual",
        pinned_tools: ["bash"],
        request_approval,
      });
      const state = make_state();

      const handler = create_tool_call_handler(deps, mockToolCtx, state);
      await handler({ tool_calls: [{ name: "bash" }, { name: "write_file" }] });

      // bash는 pinned 통과 → approval 요청됨
      expect(request_approval).toHaveBeenCalledWith("bash", {});
      // write_file은 pinned에 없음 → approval 없이 억제
      expect(request_approval).toHaveBeenCalledTimes(1);
      expect(deps.execute_tool).toHaveBeenCalledWith("bash", {}, mockToolCtx);
    });
  });
});
