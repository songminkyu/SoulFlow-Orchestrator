/**
 * AttachedToolChips 컴포넌트 테스트.
 * 칩 렌더링, onRemove 콜백, 빈 상태.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AttachedToolChips } from "@/components/attached-tool-chips";
import type { MentionItem } from "@/components/mention-picker";

const ITEMS: MentionItem[] = [
  { type: "tool", id: "t1", name: "exec", description: "Execute command" },
  { type: "workflow", id: "w1", name: "Deploy" },
  { type: "agent", id: "a1", name: "Helper", description: "Helper agent" },
];

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("AttachedToolChips", () => {
  it("빈 배열이면 렌더링하지 않는다", () => {
    const { container } = render(
      <AttachedToolChips items={[]} onRemove={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("항목 이름을 칩으로 렌더한다", () => {
    render(<AttachedToolChips items={ITEMS} onRemove={vi.fn()} />);
    expect(screen.getByText("exec")).toBeInTheDocument();
    expect(screen.getByText("Deploy")).toBeInTheDocument();
    expect(screen.getByText("Helper")).toBeInTheDocument();
  });

  it("설명이 있는 항목의 설명을 표시한다", () => {
    render(<AttachedToolChips items={ITEMS} onRemove={vi.fn()} />);
    expect(screen.getByText("Execute command")).toBeInTheDocument();
    expect(screen.getByText("Helper agent")).toBeInTheDocument();
  });

  it("설명이 없는 항목은 설명을 표시하지 않는다", () => {
    const items: MentionItem[] = [{ type: "tool", id: "t1", name: "NoDesc" }];
    render(<AttachedToolChips items={items} onRemove={vi.fn()} />);
    expect(screen.getByText("NoDesc")).toBeInTheDocument();
    // 설명 span이 없어야 함
    const chip = screen.getByText("NoDesc").closest(".attached-tool-chips__chip");
    expect(chip?.querySelector(".attached-tool-chips__desc")).toBeNull();
  });

  it("삭제 버튼 클릭 시 onRemove를 해당 id로 호출한다", () => {
    const onRemove = vi.fn();
    render(<AttachedToolChips items={ITEMS} onRemove={onRemove} />);

    const removeBtn = screen.getByLabelText("Remove exec");
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledWith("t1");
  });

  it("각 칩에 삭제 버튼(x)이 있다", () => {
    render(<AttachedToolChips items={ITEMS} onRemove={vi.fn()} />);
    expect(screen.getByLabelText("Remove exec")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove Deploy")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove Helper")).toBeInTheDocument();
  });

  it("className prop이 적용된다", () => {
    const { container } = render(
      <AttachedToolChips items={ITEMS} onRemove={vi.fn()} className="extra" />,
    );
    expect(container.firstChild).toHaveClass("extra");
  });

  it("여러 항목의 삭제 버튼이 각각 독립적으로 동작한다", () => {
    const onRemove = vi.fn();
    render(<AttachedToolChips items={ITEMS} onRemove={onRemove} />);

    fireEvent.click(screen.getByLabelText("Remove Deploy"));
    expect(onRemove).toHaveBeenCalledWith("w1");

    fireEvent.click(screen.getByLabelText("Remove Helper"));
    expect(onRemove).toHaveBeenCalledWith("a1");

    expect(onRemove).toHaveBeenCalledTimes(2);
  });
});
