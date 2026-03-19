/**
 * FE-3: RichResultRenderer -- content-type 감지 및 렌더링 분기 테스트.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string, p?: Record<string, string>) =>
    p ? `${key}:${JSON.stringify(p)}` : key,
}));

import { RichResultRenderer, detect_content_kind } from "@/components/rich-result-renderer";

// -- detect_content_kind --

describe("detect_content_kind", () => {
  it("JSON 객체를 감지한다", () => {
    expect(detect_content_kind('{"key": "value"}')).toBe("json");
  });

  it("JSON 배열을 감지한다", () => {
    expect(detect_content_kind('[1, 2, 3]')).toBe("json");
  });

  it("이미지 URL을 감지한다", () => {
    expect(detect_content_kind("https://example.com/image.png")).toBe("image");
    expect(detect_content_kind("https://cdn.test/photo.jpg?w=200")).toBe("image");
  });

  it("코드 펜스 블록을 감지한다", () => {
    expect(detect_content_kind("```js\nconst x = 1;\n```")).toBe("code");
  });

  it("일반 텍스트를 기본으로 반환한다", () => {
    expect(detect_content_kind("Hello world")).toBe("text");
  });

  it("유효하지 않은 JSON은 text로 반환한다", () => {
    expect(detect_content_kind("{invalid json}")).toBe("text");
  });
});

// -- RichResultRenderer --

describe("RichResultRenderer", () => {
  it("JSON content를 포맷된 pre로 렌더링한다", () => {
    render(<RichResultRenderer content='{"a": 1}' />);
    expect(screen.getByText("JSON")).toBeInTheDocument();
  });

  it("이미지 URL을 img 태그로 렌더링한다", () => {
    render(<RichResultRenderer content="https://example.com/img.png" />);
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.src).toContain("example.com/img.png");
  });

  it("코드 펜스를 code 블록으로 렌더링한다", () => {
    render(<RichResultRenderer content={"```python\nprint('hi')\n```"} />);
    const codeBlock = document.querySelector(".rich-result__code");
    expect(codeBlock).toBeTruthy();
    expect(codeBlock?.textContent).toContain("print('hi')");
  });

  it("일반 텍스트를 pre로 렌더링한다", () => {
    render(<RichResultRenderer content="Hello world" />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("긴 텍스트가 truncateAt로 잘린다", () => {
    const long = "A".repeat(100);
    render(<RichResultRenderer content={long} truncateAt={50} />);
    // 잘린 텍스트 + expand 버튼
    expect(screen.getByText("tool_call.expand")).toBeInTheDocument();
  });

  it("expand 버튼 클릭 시 전체 텍스트가 표시된다", () => {
    const long = "A".repeat(100);
    render(<RichResultRenderer content={long} truncateAt={50} />);
    fireEvent.click(screen.getByText("tool_call.expand"));
    expect(screen.getByText("tool_call.collapse")).toBeInTheDocument();
  });

  it("isError 플래그로 에러 클래스를 적용한다", () => {
    const { container } = render(<RichResultRenderer content="fail" isError />);
    expect(container.querySelector(".rich-result--error")).toBeTruthy();
  });

  it("kind 힌트가 자동 감지를 오버라이드한다", () => {
    // JSON처럼 보이지만 kind="text"로 지정
    render(<RichResultRenderer content='{"a": 1}' kind="text" />);
    expect(screen.queryByText("JSON")).toBeNull();
  });
});
