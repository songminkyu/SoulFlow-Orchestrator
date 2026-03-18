/**
 * G-14: PromptProfilePreview — 직접 렌더 검증.
 *
 * role preset의 rendered_prompt가 있을 때 접이식 미리보기를 표시하고,
 * 없을 때 null을 반환하는지 확인.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// react-query mock (PromptProfilePreview 자체는 query 미사용이지만 모듈 로드 시 필요)
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: undefined })),
}));
vi.mock("@/api/client", () => ({ api: { get: vi.fn() } }));

import { PromptProfilePreview } from "@/pages/workflows/inspector-params";
import type { RolePreset } from "@/pages/workflows/workflow-types";

const t = (key: string) => key;

const ROLES: RolePreset[] = [
  {
    id: "coder", name: "Coder", description: "", soul: null, heart: null,
    tools: [], use_when: "", not_use_for: "", preferred_model: null,
    shared_protocols: [], rendered_prompt: "You are a coding assistant.",
  },
  {
    id: "empty", name: "Empty", description: "", soul: null, heart: null,
    tools: [], use_when: "", not_use_for: "", preferred_model: null,
    shared_protocols: [], rendered_prompt: null,
  },
];

describe("G-14: PromptProfilePreview 직접 렌더", () => {
  it("rendered_prompt가 있는 role → 토글 버튼이 렌더된다", () => {
    render(<PromptProfilePreview role_id="coder" roles={ROLES} t={t} />);
    expect(screen.getByText(/workflows\.profile_preview/)).toBeInTheDocument();
  });

  it("rendered_prompt가 없는 role → 아무것도 렌더하지 않는다", () => {
    const { container } = render(<PromptProfilePreview role_id="empty" roles={ROLES} t={t} />);
    expect(container.innerHTML).toBe("");
  });

  it("존재하지 않는 role_id → 아무것도 렌더하지 않는다", () => {
    const { container } = render(<PromptProfilePreview role_id="nonexistent" roles={ROLES} t={t} />);
    expect(container.innerHTML).toBe("");
  });

  it("토글 버튼 클릭 → rendered_prompt 내용이 표시된다", () => {
    render(<PromptProfilePreview role_id="coder" roles={ROLES} t={t} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle);
    expect(screen.getByText("You are a coding assistant.")).toBeInTheDocument();
  });

  it("토글 버튼을 두 번 클릭 → rendered_prompt가 숨겨진다", () => {
    render(<PromptProfilePreview role_id="coder" roles={ROLES} t={t} />);
    const toggle = screen.getByRole("button");
    fireEvent.click(toggle); // open
    expect(screen.getByText("You are a coding assistant.")).toBeInTheDocument();
    fireEvent.click(toggle); // close
    expect(screen.queryByText("You are a coding assistant.")).toBeNull();
  });

  it("aria-expanded 속성이 토글 상태를 반영한다", () => {
    render(<PromptProfilePreview role_id="coder" roles={ROLES} t={t} />);
    const toggle = screen.getByRole("button");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
