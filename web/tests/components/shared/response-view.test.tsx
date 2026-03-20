/**
 * SharedResponseView 컴포넌트 테스트 스위트.
 * TypingRenderer / ResultRenderer / ToolCallBlock / LinkPreview / StatusBadge / ResponseView
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// i18n mock — 키를 그대로 반환
vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { TypingRenderer } from "@/components/shared/typing-renderer";
import { ResultRenderer } from "@/components/shared/result-renderer";
import type { ResultBlock } from "@/components/shared/result-renderer";
import { ToolCallBlock } from "@/components/shared/tool-call-block";
import { LinkPreview } from "@/components/shared/link-preview";
import { StatusBadge } from "@/components/shared/status-badges";
import { ResponseView } from "@/components/shared/response-view";
import type { ResponseMessage } from "@/components/shared/response-view";

// ── TypingRenderer ───────────────────────────────────────────────────────────

describe("TypingRenderer", () => {
  it("streaming=true 일 때 커서 클래스가 활성화된다", () => {
    const { container } = render(<TypingRenderer text="hello" streaming={true} />);
    expect(container.querySelector(".typing-renderer__cursor--active")).toBeTruthy();
  });

  it("streaming=false 일 때 커서 클래스가 비활성화된다", () => {
    const { container } = render(<TypingRenderer text="hello" streaming={false} />);
    expect(container.querySelector(".typing-renderer__cursor--active")).toBeNull();
    expect(container.querySelector(".typing-renderer__cursor")).toBeTruthy();
  });

  it("text 내용을 렌더링한다", () => {
    const { container } = render(<TypingRenderer text="hello world" streaming={false} />);
    const text_span = container.querySelector(".typing-renderer__text");
    expect(text_span?.textContent).toBe("hello world");
  });

  it("className prop이 루트에 추가된다", () => {
    const { container } = render(
      <TypingRenderer text="hi" streaming={false} className="custom-cls" />
    );
    expect(container.querySelector(".typing-renderer.custom-cls")).toBeTruthy();
  });
});

// ── ResultRenderer ───────────────────────────────────────────────────────────

describe("ResultRenderer", () => {
  it("text 블록을 pre로 렌더링한다", () => {
    const blocks: ResultBlock[] = [{ type: "text", content: "plain text" }];
    render(<ResultRenderer blocks={blocks} />);
    expect(screen.getByText("plain text")).toBeInTheDocument();
  });

  it("image 블록을 img로 렌더링한다", () => {
    const blocks: ResultBlock[] = [
      { type: "image", content: "https://example.com/pic.png", alt: "test img" },
    ];
    const { container } = render(<ResultRenderer blocks={blocks} />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain("example.com/pic.png");
  });

  it("image 클릭 시 zoomed 클래스가 토글된다", () => {
    const blocks: ResultBlock[] = [
      { type: "image", content: "https://example.com/img.png", alt: "zoom test" },
    ];
    const { container } = render(<ResultRenderer blocks={blocks} />);
    const img_wrapper = container.querySelector(".result-renderer__image");
    expect(img_wrapper).toBeTruthy();
    fireEvent.click(img_wrapper!);
    expect(container.querySelector(".result-renderer__image--zoomed")).toBeTruthy();
    // 다시 클릭하면 해제
    fireEvent.click(img_wrapper!);
    expect(container.querySelector(".result-renderer__image--zoomed")).toBeNull();
  });

  it("code 블록을 pre/code로 렌더링한다", () => {
    const blocks: ResultBlock[] = [
      { type: "code", content: "const x = 1;", language: "typescript" },
    ];
    const { container } = render(<ResultRenderer blocks={blocks} />);
    expect(container.querySelector(".result-renderer__code")).toBeTruthy();
    expect(container.querySelector("code")?.textContent).toContain("const x = 1;");
  });

  it("code 블록에 language 힌트 클래스가 설정된다", () => {
    const blocks: ResultBlock[] = [
      { type: "code", content: "print('hi')", language: "python" },
    ];
    const { container } = render(<ResultRenderer blocks={blocks} />);
    expect(container.querySelector("code.language-python")).toBeTruthy();
  });

  it("markdown 블록을 렌더링한다", () => {
    const blocks: ResultBlock[] = [
      { type: "markdown", content: "# Hello\n\nWorld paragraph." },
    ];
    const { container } = render(<ResultRenderer blocks={blocks} />);
    expect(container.querySelector(".result-renderer__markdown")).toBeTruthy();
  });

  it("error 블록에 error 클래스가 적용된다", () => {
    const blocks: ResultBlock[] = [{ type: "error", content: "something failed" }];
    const { container } = render(<ResultRenderer blocks={blocks} />);
    expect(container.querySelector(".result-renderer__pre--error")).toBeTruthy();
  });

  it("caption이 있을 때 표시된다", () => {
    const blocks: ResultBlock[] = [
      { type: "text", content: "data", caption: "Source: API" },
    ];
    render(<ResultRenderer blocks={blocks} />);
    expect(screen.getByText("Source: API")).toBeInTheDocument();
  });

  it("여러 블록을 순서대로 렌더링한다", () => {
    const blocks: ResultBlock[] = [
      { type: "text", content: "first" },
      { type: "text", content: "second" },
    ];
    render(<ResultRenderer blocks={blocks} />);
    expect(screen.getByText("first")).toBeInTheDocument();
    expect(screen.getByText("second")).toBeInTheDocument();
  });
});

// ── ToolCallBlock ────────────────────────────────────────────────────────────

describe("ToolCallBlock", () => {
  it("tool_name과 action을 렌더링한다", () => {
    render(
      <ToolCallBlock
        tool_name="web_search"
        action="query"
        status="success"
      />
    );
    expect(screen.getByText("web_search")).toBeInTheDocument();
    expect(screen.getByText(/query/)).toBeInTheDocument();
  });

  it("running 상태에서 스피너를 렌더링한다", () => {
    const { container } = render(
      <ToolCallBlock tool_name="web_fetch" status="running" />
    );
    expect(container.querySelector(".tool-call__spinner")).toBeTruthy();
  });

  it("success 상태에서 체크 마크를 렌더링한다", () => {
    const { container } = render(
      <ToolCallBlock tool_name="read_file" status="success" />
    );
    expect(container.querySelector(".tool-call-block__check")).toBeTruthy();
  });

  it("error 상태에서 X 마크를 렌더링한다", () => {
    const { container } = render(
      <ToolCallBlock tool_name="read_file" status="error" />
    );
    expect(container.querySelector(".tool-call-block__x")).toBeTruthy();
  });

  it("완료 후 헤더 클릭 시 body가 토글된다", () => {
    const req = JSON.stringify({ query: "test" });
    const res = JSON.stringify({ results: [] });
    const { container } = render(
      <ToolCallBlock
        tool_name="web_search"
        status="success"
        request={req}
        response={res}
      />
    );
    const header = container.querySelector(".tool-call-block__header") as HTMLElement;
    // 초기: body 없음
    expect(container.querySelector(".tool-call-block__body")).toBeNull();
    // 클릭 → 열림
    fireEvent.click(header);
    expect(container.querySelector(".tool-call-block__body")).toBeTruthy();
    // 다시 클릭 → 닫힘
    fireEvent.click(header);
    expect(container.querySelector(".tool-call-block__body")).toBeNull();
  });

  it("body 내부에 Request / Response 패널이 있다", () => {
    const { container } = render(
      <ToolCallBlock
        tool_name="exec"
        status="success"
        request='{"cmd": "ls"}'
        response='{"output": "file.txt"}'
      />
    );
    const header = container.querySelector(".tool-call-block__header") as HTMLElement;
    fireEvent.click(header);
    // Two section toggles for request + response
    const toggles = container.querySelectorAll(".tool-call-block__section-toggle");
    expect(toggles.length).toBe(2);
  });

  it("Request 패널을 열고 닫을 수 있다", () => {
    const { container } = render(
      <ToolCallBlock
        tool_name="exec"
        status="success"
        request='{"cmd": "ls"}'
        response='{"output": "file.txt"}'
      />
    );
    // Expand the main block
    fireEvent.click(container.querySelector(".tool-call-block__header") as HTMLElement);
    // First toggle = Request
    const request_toggle = container.querySelectorAll(".tool-call-block__section-toggle")[0] as HTMLElement;
    // Default closed — no json pre visible initially
    expect(container.querySelectorAll(".tool-call-block__json").length).toBe(1); // response is open by default
    fireEvent.click(request_toggle);
    expect(container.querySelectorAll(".tool-call-block__json").length).toBe(2);
  });

  it("duration_ms가 있을 때 포맷된 시간을 표시한다", () => {
    render(
      <ToolCallBlock tool_name="exec" status="success" duration_ms={1500} />
    );
    expect(screen.getByText("1.5s")).toBeInTheDocument();
  });

  it("duration < 1000ms 일 때 ms 단위로 표시한다", () => {
    render(
      <ToolCallBlock tool_name="exec" status="success" duration_ms={200} />
    );
    expect(screen.getByText("200ms")).toBeInTheDocument();
  });

  it("--success / --error 클래스가 status에 따라 적용된다", () => {
    const { container: c1 } = render(
      <ToolCallBlock tool_name="t" status="success" />
    );
    expect(c1.querySelector(".tool-call-block--success")).toBeTruthy();

    const { container: c2 } = render(
      <ToolCallBlock tool_name="t" status="error" />
    );
    expect(c2.querySelector(".tool-call-block--error")).toBeTruthy();
  });
});

// ── LinkPreview ──────────────────────────────────────────────────────────────

describe("LinkPreview", () => {
  it("URL과 타이틀을 렌더링한다", () => {
    render(
      <LinkPreview url="https://example.com" title="Example Site" />
    );
    expect(screen.getByText("Example Site")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("description이 있을 때 표시한다", () => {
    render(
      <LinkPreview
        url="https://example.com"
        title="Title"
        description="A short description"
      />
    );
    expect(screen.getByText("A short description")).toBeInTheDocument();
  });

  it("image가 있을 때 img 태그를 렌더링한다", () => {
    const { container } = render(
      <LinkPreview
        url="https://example.com"
        image="https://example.com/thumb.jpg"
      />
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toContain("thumb.jpg");
  });

  it("image 없을 때 fallback 아이콘을 렌더링한다", () => {
    const { container } = render(
      <LinkPreview url="https://example.com" title="No image" />
    );
    expect(container.querySelector(".link-preview__icon-fallback")).toBeTruthy();
  });

  it("링크가 새 탭으로 열린다", () => {
    const { container } = render(
      <LinkPreview url="https://example.com" />
    );
    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("target")).toBe("_blank");
    expect(anchor?.getAttribute("rel")).toContain("noopener");
  });

  it("www. 없이 도메인만 표시한다", () => {
    render(<LinkPreview url="https://www.google.com" />);
    expect(screen.getByText("google.com")).toBeInTheDocument();
  });
});

// ── StatusBadge ──────────────────────────────────────────────────────────────

describe("StatusBadge", () => {
  it("label을 렌더링한다", () => {
    render(<StatusBadge variant="ok" label="Active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it.each([
    ["ok"],
    ["warn"],
    ["err"],
    ["off"],
    ["accent"],
    ["info"],
  ] as const)("variant=%s 클래스가 적용된다", (variant) => {
    const { container } = render(
      <StatusBadge variant={variant} label="test" />
    );
    expect(container.querySelector(`.status-badge--${variant}`)).toBeTruthy();
  });

  it("size=sm 클래스가 적용된다", () => {
    const { container } = render(
      <StatusBadge variant="ok" label="small" size="sm" />
    );
    expect(container.querySelector(".status-badge--sm")).toBeTruthy();
  });

  it("size=md 클래스가 적용된다", () => {
    const { container } = render(
      <StatusBadge variant="ok" label="medium" size="md" />
    );
    expect(container.querySelector(".status-badge--md")).toBeTruthy();
  });

  it("icon prop이 렌더링된다", () => {
    const { container } = render(
      <StatusBadge variant="ok" label="pass" icon={<span>✓</span>} />
    );
    expect(container.querySelector(".status-badge__icon")).toBeTruthy();
  });

  it("className prop이 루트에 추가된다", () => {
    const { container } = render(
      <StatusBadge variant="warn" label="warn" className="extra" />
    );
    expect(container.querySelector(".status-badge.extra")).toBeTruthy();
  });
});

// ── ResponseView ─────────────────────────────────────────────────────────────

describe("ResponseView", () => {
  it("user 메시지에 --user 클래스가 적용된다", () => {
    const msg: ResponseMessage = { role: "user", content: "Hello" };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelector(".response-view__message--user")).toBeTruthy();
  });

  it("assistant 메시지에 --assistant 클래스가 적용된다", () => {
    const msg: ResponseMessage = { role: "assistant", content: "Hi there" };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelector(".response-view__message--assistant")).toBeTruthy();
  });

  it("user 메시지 content를 렌더링한다", () => {
    const msg: ResponseMessage = { role: "user", content: "test message" };
    render(<ResponseView message={msg} />);
    expect(screen.getByText("test message")).toBeInTheDocument();
  });

  it("assistant + streaming=true 일 때 TypingRenderer가 렌더링된다", () => {
    const msg: ResponseMessage = {
      role: "assistant",
      content: "streaming...",
      streaming: true,
    };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelector(".typing-renderer")).toBeTruthy();
    expect(container.querySelector(".typing-renderer__cursor--active")).toBeTruthy();
  });

  it("assistant + streaming=false + blocks 가 있을 때 ResultRenderer가 렌더링된다", () => {
    const msg: ResponseMessage = {
      role: "assistant",
      content: "",
      streaming: false,
      blocks: [{ type: "text", content: "result text" }],
    };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelector(".result-renderer")).toBeTruthy();
    expect(screen.getByText("result text")).toBeInTheDocument();
  });

  it("tool_calls가 있을 때 ToolCallBlock 목록이 렌더링된다", () => {
    const msg: ResponseMessage = {
      role: "assistant",
      content: "checking...",
      streaming: false,
      tool_calls: [
        { tool_name: "web_search", status: "success" },
        { tool_name: "read_file", status: "running" },
      ],
    };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelectorAll(".tool-call-block").length).toBe(2);
  });

  it("links가 있을 때 LinkPreview 목록이 렌더링된다", () => {
    const msg: ResponseMessage = {
      role: "assistant",
      content: "see links",
      streaming: false,
      links: [
        { url: "https://a.com", title: "Site A" },
        { url: "https://b.com", title: "Site B" },
      ],
    };
    render(<ResponseView message={msg} />);
    expect(screen.getByText("Site A")).toBeInTheDocument();
    expect(screen.getByText("Site B")).toBeInTheDocument();
  });

  it("model + timestamp가 있을 때 meta 영역이 표시된다", () => {
    const msg: ResponseMessage = {
      role: "assistant",
      content: "done",
      model: "claude-3",
      timestamp: "12:00",
    };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelector(".response-view__meta")).toBeTruthy();
    expect(screen.getByText("claude-3")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
  });

  it("tool_calls 없으면 tool-calls 컨테이너가 없다", () => {
    const msg: ResponseMessage = { role: "user", content: "no tools" };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelector(".response-view__tool-calls")).toBeNull();
  });

  it("links 없으면 links 컨테이너가 없다", () => {
    const msg: ResponseMessage = { role: "user", content: "no links" };
    const { container } = render(<ResponseView message={msg} />);
    expect(container.querySelector(".response-view__links")).toBeNull();
  });

  it("className prop이 루트에 추가된다", () => {
    const msg: ResponseMessage = { role: "user", content: "hi" };
    const { container } = render(
      <ResponseView message={msg} className="extra-cls" />
    );
    expect(container.querySelector(".response-view.extra-cls")).toBeTruthy();
  });
});
