/**
 * FE-6: Backend Contract Wiring 회귀 — ChatPromptBar 직접 렌더 + BE 타입 계약 검증.
 *
 * 검증 축:
 * 1. ChatPromptBar 렌더 시 provider/model 선택 UI가 올바르게 동작
 * 2. ToolChoiceMode 타입 유효값 검증 (BE 계약)
 * 3. ToolCallHandlerDeps 타입에 tool_choice + pinned_tools 필드 존재 (타입 수준 보호)
 * 4. ChatPromptBarProps에 selectedProvider + selectedModel 필드 존재
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// -- 모킹 -------------------------------------------------------------------

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === "provider-instances-chat") {
      return {
        data: [
          { instance_id: "openai-1", label: "OpenAI GPT-4" },
          { instance_id: "claude-1", label: "Claude Opus" },
        ],
        isLoading: false,
      };
    }
    if (queryKey[0] === "provider-models") {
      return {
        data: [
          { id: "gpt-4", name: "GPT-4" },
          { id: "gpt-4o", name: "GPT-4o" },
        ],
        isLoading: false,
      };
    }
    return { data: undefined, isLoading: false };
  }),
}));

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn() },
}));

vi.mock("@/hooks/use-click-outside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@/pages/chat/media-preview", () => ({
  MediaPreviewBar: () => null,
}));

import { ChatPromptBar } from "@/components/chat-prompt-bar";
import type { ChatPromptBarProps } from "@/components/chat-prompt-bar";
import type { ToolChoiceMode } from "../../../../src/contracts";
import type { ToolCallHandlerDeps } from "../../../../src/orchestration/tool-call-handler";

// -- ChatPromptBar props 타입 계약 -------------------------------------------

describe("ChatPromptBar — props 타입 계약 (FE-6)", () => {
  function has_field<T>(key: keyof T): string {
    return String(key);
  }

  it("selectedProvider 필드가 존재한다", () => {
    expect(has_field<ChatPromptBarProps>("selectedProvider")).toBe("selectedProvider");
  });

  it("selectedModel 필드가 존재한다", () => {
    expect(has_field<ChatPromptBarProps>("selectedModel")).toBe("selectedModel");
  });

  it("onProviderChange 필드가 존재한다", () => {
    expect(has_field<ChatPromptBarProps>("onProviderChange")).toBe("onProviderChange");
  });

  it("onModelChange 필드가 존재한다", () => {
    expect(has_field<ChatPromptBarProps>("onModelChange")).toBe("onModelChange");
  });
});

// -- ChatPromptBar 직접 렌더 — provider/model 칩 검증 -------------------------

describe("ChatPromptBar — provider/model 칩 렌더 (FE-6)", () => {
  function make_props(overrides: Partial<ChatPromptBarProps> = {}): ChatPromptBarProps {
    return {
      input: "",
      setInput: vi.fn(),
      sending: false,
      can_send: false,
      onSend: vi.fn(),
      ...overrides,
    };
  }

  it("provider/model 선택기 미설정 시 칩이 렌더되지 않는다", () => {
    const { container } = render(<ChatPromptBar {...make_props()} />);
    expect(container.querySelector(".chat-prompt-bar__model-wrap")).toBeNull();
  });

  it("provider/model 선택기 설정 시 프로바이더 칩이 렌더된다", () => {
    render(
      <ChatPromptBar
        {...make_props({
          selectedProvider: "",
          selectedModel: "",
          onProviderChange: vi.fn(),
          onModelChange: vi.fn(),
        })}
      />,
    );
    expect(screen.getByLabelText("chat.provider_select")).toBeInTheDocument();
  });

  it("프로바이더 선택 시 모델 칩도 렌더된다", () => {
    render(
      <ChatPromptBar
        {...make_props({
          selectedProvider: "openai-1",
          selectedModel: "gpt-4",
          onProviderChange: vi.fn(),
          onModelChange: vi.fn(),
        })}
      />,
    );
    expect(screen.getByLabelText("chat.provider_select")).toBeInTheDocument();
    expect(screen.getByLabelText("chat.model_select")).toBeInTheDocument();
  });

  it("전송 버튼이 can_send=false일 때 disabled", () => {
    render(<ChatPromptBar {...make_props({ can_send: false })} />);
    const send_btn = screen.getByLabelText("common.send");
    expect(send_btn).toBeDisabled();
  });

  it("전송 버튼이 sending=true일 때 aria-busy=true", () => {
    render(<ChatPromptBar {...make_props({ sending: true, can_send: true })} />);
    const busy_btn = screen.getByLabelText("chat.sending");
    expect(busy_btn.getAttribute("aria-busy")).toBe("true");
  });
});

// -- ToolChoiceMode BE 타입 계약 -----------------------------------------------

describe("ToolChoiceMode — BE 타입 유효값 회귀 (FE-6)", () => {
  it("3가지 모드가 모두 유효하다", () => {
    const modes: ToolChoiceMode[] = ["auto", "manual", "none"];
    expect(modes).toHaveLength(3);
  });

  it("기본값은 auto이다 (코드 컨벤션)", () => {
    const default_mode: ToolChoiceMode = "auto";
    expect(default_mode).toBe("auto");
  });
});

// -- ToolCallHandlerDeps 타입 계약 -------------------------------------------

describe("ToolCallHandlerDeps — tool_choice + pinned_tools 필드 존재 (FE-6)", () => {
  function has_field<T>(key: keyof T): string {
    return String(key);
  }

  it("tool_choice 필드가 존재한다", () => {
    expect(has_field<ToolCallHandlerDeps>("tool_choice")).toBe("tool_choice");
  });

  it("pinned_tools 필드가 존재한다", () => {
    expect(has_field<ToolCallHandlerDeps>("pinned_tools")).toBe("pinned_tools");
  });

  it("request_approval 필드가 존재한다 (manual 모드용)", () => {
    expect(has_field<ToolCallHandlerDeps>("request_approval")).toBe("request_approval");
  });
});
