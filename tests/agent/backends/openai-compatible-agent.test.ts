/**
 * OpenAiCompatibleAgent — run() 전체 경로 커버리지 (fetch mock).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { OpenAiCompatibleAgent } from "@src/agent/backends/openai-compatible.agent.js";
import type { AgentRunOptions } from "@src/agent/agent.types.js";

// ── 헬퍼 ──────────────────────────────────────────────

function make_agent(config_overrides: Record<string, unknown> = {}) {
  return new OpenAiCompatibleAgent("test-agent", {
    api_base: "https://api.example.com/v1",
    api_key: "test-key",
    model: "gpt-4o",
    ...config_overrides,
  } as any);
}

function make_run_opts(overrides: Partial<AgentRunOptions> = {}): AgentRunOptions {
  return {
    task_id: "task-1",
    system_prompt: "You are helpful.",
    task: "Do something",
    messages: [{ role: "user", content: "Hello" }],
    ...overrides,
  };
}

function openai_response(content = "OK", tool_calls: unknown[] = [], finish_reason = "stop") {
  return {
    choices: [{
      message: {
        role: "assistant",
        content,
        tool_calls: tool_calls.length ? tool_calls : undefined,
      },
      finish_reason,
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

function make_fetch(ok: boolean, body: unknown, fail?: Error) {
  if (fail) return vi.fn().mockRejectedValue(fail);
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

afterEach(() => { vi.unstubAllGlobals(); });

// ══════════════════════════════════════════
// is_available
// ══════════════════════════════════════════

describe("OpenAiCompatibleAgent — is_available", () => {
  it("api_base 있음 → true", () => {
    expect(make_agent().is_available()).toBe(true);
  });

  it("api_base 빈 문자열 → false", () => {
    expect(make_agent({ api_base: "" }).is_available()).toBe(false);
  });
});

// ══════════════════════════════════════════
// run() — 기본 경로
// ══════════════════════════════════════════

describe("OpenAiCompatibleAgent — run() 기본 경로", () => {
  it("성공 응답 → content 반환", async () => {
    vi.stubGlobal("fetch", make_fetch(true, openai_response("Hello back")));
    const agent = make_agent();
    const r = await agent.run(make_run_opts());
    expect(r.content).toBe("Hello back");
    expect(r.finish_reason).toBe("stop");
    expect(r.tool_calls_count).toBe(0);
  });

  it("fetch 실패 → error finish_reason", async () => {
    vi.stubGlobal("fetch", make_fetch(false, null, new Error("Network failure")));
    const agent = make_agent();
    const r = await agent.run(make_run_opts());
    expect(r.finish_reason).toBe("error");
    expect(r.content).toContain("Network failure");
  });

  it("API 에러 상태코드 → 예외 발생 → error 반환", async () => {
    vi.stubGlobal("fetch", make_fetch(false, { error: "bad request" }));
    const agent = make_agent();
    const r = await agent.run(make_run_opts());
    expect(r.finish_reason).toBe("error");
  });

  it("hooks.on_event 이벤트 수신", async () => {
    vi.stubGlobal("fetch", make_fetch(true, openai_response()));
    const events: string[] = [];
    const agent = make_agent();
    await agent.run(make_run_opts({
      hooks: { on_event: (e) => { events.push(e.type); } },
    }));
    expect(events).toContain("init");
    expect(events).toContain("complete");
  });

  it("max_tokens / temperature 설정 → body에 포함", async () => {
    const mock_fetch = make_fetch(true, openai_response());
    vi.stubGlobal("fetch", mock_fetch);
    const agent = make_agent({ max_tokens: 100, temperature: 0.7 });
    await agent.run(make_run_opts());
    const body = JSON.parse(mock_fetch.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(100);
    expect(body.temperature).toBe(0.7);
  });

  it("abort_signal이 이미 aborted → 루프 즉시 탈출", async () => {
    vi.stubGlobal("fetch", make_fetch(true, openai_response("OK", [
      { id: "tc1", type: "function", function: { name: "my_tool", arguments: "{}" } },
    ])));
    const ctrl = new AbortController();
    ctrl.abort();
    const agent = make_agent();
    const r = await agent.run(make_run_opts({ abort_signal: ctrl.signal }));
    // 정상 반환 (abort 후 루프 탈출)
    expect(r).toBeDefined();
  });
});

// ══════════════════════════════════════════
// run() — 도구 호출
// ══════════════════════════════════════════

describe("OpenAiCompatibleAgent — run() 도구 호출", () => {
  it("tool_calls + executor → 도구 실행 후 재호출", async () => {
    const tool_call = {
      id: "tc-1",
      type: "function",
      function: { name: "my_tool", arguments: JSON.stringify({ input: "test" }) },
    };
    const mock_fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(openai_response("", [tool_call], "tool_calls")),
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(openai_response("Done after tool")),
        text: () => Promise.resolve(""),
      });
    vi.stubGlobal("fetch", mock_fetch);

    const executor = vi.fn().mockResolvedValue({ text: "tool result", is_error: false });
    const agent = make_agent();
    const r = await agent.run(make_run_opts({
      tool_executors: [{ name: "my_tool", execute: executor }] as any,
    }));

    expect(executor).toHaveBeenCalledOnce();
    expect(r.tool_calls_count).toBe(1);
    expect(mock_fetch).toHaveBeenCalledTimes(2);
  });

  it("tool_calls but no executors → 루프 탈출 (executor 없음)", async () => {
    const tool_call = {
      id: "tc-1", type: "function",
      function: { name: "unknown_tool", arguments: "{}" },
    };
    vi.stubGlobal("fetch", make_fetch(true, openai_response("", [tool_call], "tool_calls")));
    const agent = make_agent();
    const r = await agent.run(make_run_opts()); // tool_executors 없음
    // 루프 탈출 후 마지막 응답의 tool_calls 카운트됨
    expect(r.tool_calls_count).toBeGreaterThan(0);
  });

  it("extra_headers → fetch 헤더에 포함", async () => {
    const mock_fetch = make_fetch(true, openai_response());
    vi.stubGlobal("fetch", mock_fetch);
    const agent = make_agent({ extra_headers: { "X-Custom": "value" } });
    await agent.run(make_run_opts());
    const headers = mock_fetch.mock.calls[0][1].headers;
    expect(headers["X-Custom"]).toBe("value");
  });
});

// ── SSE 헬퍼 ──────────────────────────────────────────────

// SSE 청크를 ReadableStream으로 만드는 헬퍼
function make_sse_response(lines: string[]) {
  const text = lines.join("\n") + "\n\n";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  let pos = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (pos >= bytes.length) {
        controller.close();
        return;
      }
      // 청크별로 전달
      const chunk = bytes.slice(pos, pos + 100);
      pos += 100;
      controller.enqueue(chunk);
    },
  });
  return {
    ok: true,
    status: 200,
    body: stream,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(text),
  };
}

// ══════════════════════════════════════════════════════════
// abort_signal이 tool 루프 중 이미 aborted (L86)
// ══════════════════════════════════════════════════════════

describe("OpenAiCompatibleAgent — abort_signal aborted in tool loop (L86)", () => {
  it("tool_calls + executor 있고 abort_signal 이미 aborted → 루프 탈출", async () => {
    const tool_call = {
      id: "tc1", type: "function",
      function: { name: "my_tool", arguments: "{}" },
    };
    const mock_fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(openai_response("", [tool_call], "tool_calls")),
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", mock_fetch);

    // AbortController를 사전에 abort
    const ctrl = new AbortController();
    ctrl.abort();

    const executor = vi.fn().mockResolvedValue({ text: "tool result", is_error: false });
    const agent = make_agent();

    const r = await agent.run(make_run_opts({
      abort_signal: ctrl.signal,
      tool_executors: [{ name: "my_tool", execute: executor }] as any,
    }));

    // abort → 루프 즉시 탈출, executor는 호출되지 않음
    expect(r).toBeDefined();
    expect(executor).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════
// SSE 스트리밍: on_stream + _parse_sse_stream (L199-322)
// ══════════════════════════════════════════════════════════

describe("OpenAiCompatibleAgent — SSE 스트리밍 경로 (L199-322)", () => {
  it("on_stream 있음 → body.stream=true, _parse_sse_stream 호출, 텍스트 누적", async () => {
    const sse_lines = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":" world"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":2,"total_tokens":7}}',
      "data: [DONE]",
    ];

    const mock_fetch = vi.fn().mockResolvedValue(make_sse_response(sse_lines));
    vi.stubGlobal("fetch", mock_fetch);

    const chunks: string[] = [];
    const agent = make_agent();

    const r = await agent.run(make_run_opts({
      hooks: {
        on_stream: (chunk) => { chunks.push(chunk); },
      },
    }));

    // fetch body에 stream=true가 포함됨
    const body = JSON.parse(mock_fetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });

    // on_stream 콜백이 텍스트 청크 수신
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("")).toBe("Hello world");

    // 최종 결과
    expect(r.content).toBe("Hello world");
    expect(r.finish_reason).toBe("stop");
  });

  it("SSE 스트림: tools=[] 이면 body.tools/tool_choice 없음, body.stream=true", async () => {
    const sse_lines = [
      'data: {"choices":[{"delta":{"content":"result"},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ];
    const mock_fetch = vi.fn().mockResolvedValue(make_sse_response(sse_lines));
    vi.stubGlobal("fetch", mock_fetch);

    const agent = make_agent();
    await agent.run(make_run_opts({
      hooks: { on_stream: vi.fn() },
    }));

    const body = JSON.parse(mock_fetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it("SSE 스트림: tools 있음 → body.tools + tool_choice='auto' + stream=true (L199-204)", async () => {
    const sse_lines = [
      'data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ];
    const mock_fetch = vi.fn().mockResolvedValue(make_sse_response(sse_lines));
    vi.stubGlobal("fetch", mock_fetch);

    // tools는 options.tools (ToolSchema[])에서 가져옴
    const tool_schema = [{ type: "function", function: { name: "my_tool", description: "test", parameters: { type: "object", properties: {} } } }];
    const agent = make_agent();
    await agent.run(make_run_opts({
      tools: tool_schema as any,
      hooks: { on_stream: vi.fn() },
    }));

    const body = JSON.parse(mock_fetch.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tool_choice).toBe("auto");
  });

  it("SSE 스트림: 도구 호출 조각 누적 (L289-300)", async () => {
    // 도구 호출이 여러 청크로 나뉘어 전달
    const sse_lines = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc1","function":{"name":"my_","arguments":""}}]},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"tool","arguments":"{x:"}}]},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"1}"}}]},"finish_reason":"tool_calls"}]}',
      "data: [DONE]",
    ];
    const done_sse = [
      'data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ];

    // 두 번째 fetch (도구 실행 후)도 SSE 스트림으로 응답 (on_stream이 모든 호출에 적용됨)
    const mock_fetch = vi.fn()
      .mockResolvedValueOnce(make_sse_response(sse_lines))
      .mockResolvedValueOnce(make_sse_response(done_sse));
    vi.stubGlobal("fetch", mock_fetch);

    const executor = vi.fn().mockResolvedValue({ text: "tool output", is_error: false });
    const agent = make_agent();
    const r = await agent.run(make_run_opts({
      tools: [{ type: "function", function: { name: "my_tool", description: "test", parameters: {} } }] as any,
      tool_executors: [{ name: "my_tool", execute: executor }] as any,
      hooks: { on_stream: vi.fn() },
    }));

    // 도구가 실행됨
    expect(executor).toHaveBeenCalledOnce();
    expect(r.content).toBe("done");
  });

  it("SSE 스트림: 잘못된 JSON 라인 → continue (L275-276)", async () => {
    const sse_lines = [
      "data: not-valid-json",  // JSON 파싱 실패 → continue
      'data: {"choices":[{"delta":{"content":"valid"},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ];
    const mock_fetch = vi.fn().mockResolvedValue(make_sse_response(sse_lines));
    vi.stubGlobal("fetch", mock_fetch);

    const agent = make_agent();
    const r = await agent.run(make_run_opts({
      hooks: { on_stream: vi.fn() },
    }));

    // 잘못된 JSON은 건너뛰고 정상 응답 반환
    expect(r.content).toBe("valid");
  });

  it("no_tool_choice=true → tool_choice 미포함 (L200 분기)", async () => {
    const sse_lines = [
      'data: {"choices":[{"delta":{"content":"done"},"finish_reason":"stop"}]}',
      "data: [DONE]",
    ];
    const mock_fetch = vi.fn().mockResolvedValue(make_sse_response(sse_lines));
    vi.stubGlobal("fetch", mock_fetch);

    const agent = make_agent({ no_tool_choice: true });
    await agent.run(make_run_opts({
      tools: [{ type: "function", function: { name: "my_tool", description: "test", parameters: {} } }] as any,
      hooks: { on_stream: vi.fn() },
    }));

    const body = JSON.parse(mock_fetch.mock.calls[0][1].body);
    expect(body.tools).toBeDefined();
    expect(body.tool_choice).toBeUndefined();  // no_tool_choice=true → 미포함
  });
});

// ── T-2: reducer in tool loop (L66, L110-111) — tool 호출 시 reducer가 결과를 변환 ──────────

describe("OpenAiCompatibleAgent — reducer transforms tool results (L66, L110-111)", () => {
  it("tool executor 결과가 reducer를 통해 변환된 후 conversation에 주입된다", async () => {
    const tool_call = {
      id: "tc-r1",
      type: "function",
      function: { name: "my_tool", arguments: JSON.stringify({ input: "test" }) },
    };

    // 1차 응답: tool_call 요청, 2차 응답: 최종 텍스트
    const mock_fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(openai_response("", [tool_call], "tool_calls")),
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(openai_response("Final answer")),
        text: () => Promise.resolve(""),
      });
    vi.stubGlobal("fetch", mock_fetch);

    // tool executor가 긴 결과를 반환 (reducer가 truncate하게)
    const long_result = "X".repeat(10_000);
    const executor = {
      name: "my_tool",
      description: "test",
      category: "data" as const,
      parameters: { type: "object" as const, properties: {} },
      execute: vi.fn().mockResolvedValue(long_result),
      validate_params: vi.fn().mockReturnValue([]),
      to_schema: () => ({ type: "function" as const, function: { name: "my_tool", description: "test", parameters: {} } }),
    };

    const agent = make_agent();
    const r = await agent.run(make_run_opts({
      tool_executors: [executor as any],
    }));

    // 도구가 실행됨
    expect(executor.execute).toHaveBeenCalledOnce();

    // 두 번째 fetch call에서 conversation에 도구 결과가 포함됨
    const second_call_body = JSON.parse(mock_fetch.mock.calls[1][1].body);
    const tool_message = second_call_body.messages.find(
      (m: Record<string, unknown>) => m.role === "tool",
    );
    expect(tool_message).toBeDefined();

    // reducer가 적용되어 10,000자보다 짧은 결과가 conversation에 들어감
    expect(tool_message.content.length).toBeLessThan(long_result.length);

    expect(r.content).toBe("Final answer");
    expect(r.tool_calls_count).toBe(1);
  });

  it("tool executor 에러 결과에는 reducer가 적용되지 않는다", async () => {
    const tool_call = {
      id: "tc-r2",
      type: "function",
      function: { name: "err_tool", arguments: "{}" },
    };

    const mock_fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(openai_response("", [tool_call], "tool_calls")),
        text: () => Promise.resolve(""),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: () => Promise.resolve(openai_response("Handled error")),
        text: () => Promise.resolve(""),
      });
    vi.stubGlobal("fetch", mock_fetch);

    const executor = {
      name: "err_tool",
      description: "fails",
      category: "data" as const,
      parameters: { type: "object" as const, properties: {} },
      execute: vi.fn().mockRejectedValue(new Error("tool crashed")),
      validate_params: vi.fn().mockReturnValue([]),
      to_schema: () => ({ type: "function" as const, function: { name: "err_tool", description: "fails", parameters: {} } }),
    };

    const agent = make_agent();
    const r = await agent.run(make_run_opts({
      tool_executors: [executor as any],
    }));

    // 에러 결과는 reducer bypass
    const second_call_body = JSON.parse(mock_fetch.mock.calls[1][1].body);
    const tool_message = second_call_body.messages.find(
      (m: Record<string, unknown>) => m.role === "tool",
    );
    expect(tool_message.content).toContain("Error:");
    expect(tool_message.content).toContain("tool crashed");

    expect(r.content).toBe("Handled error");
  });
});
