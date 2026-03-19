/**
 * FE-3: ToolCallBlock -- 접이식 렌더링, content-type별 렌더, Request/Response 패널 테스트.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string, p?: Record<string, string>) =>
    p ? `${key}:${JSON.stringify(p)}` : key,
}));

import { ToolCallList, ThinkingBlockList } from "@/pages/chat/tool-call-block";
import type { ToolCallEntry, ThinkingEntry } from "@/hooks/use-ndjson-stream";

function make_call(overrides: Partial<ToolCallEntry> = {}): ToolCallEntry {
  return {
    id: "tc-1",
    name: "web_search",
    done: true,
    result: "search results here",
    ...overrides,
  };
}

describe("ToolCallBlock -- 접이식 렌더링", () => {
  it("tool_name > action 포맷으로 헤더를 표시한다", () => {
    render(<ToolCallList calls={[make_call({ name: "web_search" })]} />);
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText(/> search/)).toBeInTheDocument();
  });

  it("완료된 호출을 클릭하면 접이식 패널이 펼쳐진다", () => {
    render(<ToolCallList calls={[make_call({ params: { q: "test" } })]} />);
    // 초기에는 결과가 보이지 않음 (접힌 상태)
    expect(screen.queryByText("tool_call.request")).toBeNull();
    // 헤더 클릭하여 펼치기
    fireEvent.click(screen.getByLabelText("web_search succeeded"));
    // Request/Response 패널이 표시됨
    expect(screen.getByText("tool_call.request")).toBeInTheDocument();
    expect(screen.getByText("tool_call.response")).toBeInTheDocument();
  });

  it("에러 결과에 tool_error 레이블을 사용한다", () => {
    render(<ToolCallList calls={[make_call({ is_error: true, result: "timeout" })]} />);
    fireEvent.click(screen.getByLabelText("web_search failed"));
    expect(screen.getByText("chat.tool_error")).toBeInTheDocument();
  });

  it("pending 상태에서는 스피너를 표시한다", () => {
    render(<ToolCallList calls={[make_call({ done: false })]} />);
    expect(document.querySelector(".tool-call__spinner")).toBeTruthy();
  });

  it("빈 호출 배열이면 아무것도 렌더하지 않는다", () => {
    const { container } = render(<ToolCallList calls={[]} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("ToolCallBlock -- content-type 기반 렌더링", () => {
  it("JSON 결과를 RichResultRenderer로 렌더링한다", () => {
    render(<ToolCallList calls={[make_call({ result: '{"key": "value"}' })]} />);
    fireEvent.click(screen.getByLabelText("web_search succeeded"));
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("일반 텍스트 결과를 렌더링한다", () => {
    render(<ToolCallList calls={[make_call({ result: "plain text output" })]} />);
    fireEvent.click(screen.getByLabelText("web_search succeeded"));
    expect(screen.getByText("plain text output")).toBeInTheDocument();
  });
});

describe("ThinkingBlockList", () => {
  it("빈 배열이면 아무것도 렌더하지 않는다", () => {
    const { container } = render(<ThinkingBlockList blocks={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("블록이 있으면 토큰 수와 함께 표시한다", () => {
    const blocks: ThinkingEntry[] = [{ tokens: 100, preview: "thinking..." }];
    render(<ThinkingBlockList blocks={blocks} />);
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it("클릭하면 내용이 펼쳐진다", () => {
    const blocks: ThinkingEntry[] = [{ tokens: 50, preview: "deep thought" }];
    render(<ThinkingBlockList blocks={blocks} />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("deep thought")).toBeInTheDocument();
  });
});
