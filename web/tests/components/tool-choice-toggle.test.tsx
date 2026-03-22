/**
 * ToolChoiceToggle 컴포넌트 테스트.
 * 3단계 토글, active 상태, onChange 콜백.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── 모킹 ──────────────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { ToolChoiceToggle } from "@/components/tool-choice-toggle";

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("ToolChoiceToggle", () => {
  it("3개 토글 버튼을 렌더한다", () => {
    render(<ToolChoiceToggle value="auto" onChange={vi.fn()} />);
    expect(screen.getByText("tool_choice.auto")).toBeInTheDocument();
    expect(screen.getByText("tool_choice.manual")).toBeInTheDocument();
    expect(screen.getByText("tool_choice.none")).toBeInTheDocument();
  });

  it("현재 값에 active 스타일을 적용한다 (auto)", () => {
    render(<ToolChoiceToggle value="auto" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    // auto=0, manual=1, none=2
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
    expect(radios[2]).toHaveAttribute("aria-checked", "false");
  });

  it("현재 값에 active 스타일을 적용한다 (manual)", () => {
    render(<ToolChoiceToggle value="manual" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
  });

  it("현재 값에 active 스타일을 적용한다 (none)", () => {
    render(<ToolChoiceToggle value="none" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
  });

  it("버튼 클릭 시 onChange 콜백을 해당 모드로 호출한다", () => {
    const onChange = vi.fn();
    render(<ToolChoiceToggle value="auto" onChange={onChange} />);

    fireEvent.click(screen.getByText("tool_choice.manual"));
    expect(onChange).toHaveBeenCalledWith("manual");

    fireEvent.click(screen.getByText("tool_choice.none"));
    expect(onChange).toHaveBeenCalledWith("none");

    fireEvent.click(screen.getByText("tool_choice.auto"));
    expect(onChange).toHaveBeenCalledWith("auto");
  });

  it("disabled=true이면 모든 버튼이 비활성화된다", () => {
    render(<ToolChoiceToggle value="auto" onChange={vi.fn()} disabled />);
    const buttons = screen.getAllByRole("radio");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("disabled=true이면 클릭해도 onChange가 호출되지 않는다", () => {
    const onChange = vi.fn();
    render(<ToolChoiceToggle value="auto" onChange={onChange} disabled />);
    fireEvent.click(screen.getByText("tool_choice.manual"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("radiogroup role을 가진다", () => {
    render(<ToolChoiceToggle value="auto" onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("각 버튼이 radio role을 가진다", () => {
    render(<ToolChoiceToggle value="auto" onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("className prop이 적용된다", () => {
    const { container } = render(
      <ToolChoiceToggle value="auto" onChange={vi.fn()} className="custom-cls" />,
    );
    expect(container.firstChild).toHaveClass("custom-cls");
  });
});
