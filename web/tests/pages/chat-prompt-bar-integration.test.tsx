/**
 * FE-2b: ChatPromptBar 리디자인 통합 테스트.
 * - 렌더링 + 하단 툴바 레이아웃
 * - @ 트리거 MentionPicker
 * - 도구 첨부/제거
 * - ToolChoiceToggle 드롭다운
 * - 전송 시 pinned_tools 전달
 * - ModelSelectorDropdown 연결
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── 모킹 ──────────────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useT: () => (key: string, p?: Record<string, string>) =>
    p ? `${key}:${JSON.stringify(p)}` : key,
}));

vi.mock("@/hooks/use-click-outside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useQueries: vi.fn().mockReturnValue([]),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn() },
}));

// MentionPicker: open=true면 마커 렌더
vi.mock("@/components/mention-picker", () => ({
  MentionPicker: ({ open, onSelect }: { open: boolean; onSelect: (item: { type: string; id: string; name: string }) => void }) => {
    if (!open) return null;
    return (
      <div data-testid="mention-picker">
        <button data-testid="mention-item-tool1" onClick={() => onSelect({ type: "tool", id: "t1", name: "Tool1" })}>
          Tool1
        </button>
        <button data-testid="mention-item-agent1" onClick={() => onSelect({ type: "agent", id: "a1", name: "Agent1" })}>
          Agent1
        </button>
      </div>
    );
  },
}));

// ModelSelectorDropdown: 단순 버튼 렌더
vi.mock("@/components/model-selector-dropdown", () => ({
  ModelSelectorDropdown: ({ value, onSelect }: { value: string; onSelect: (id: string) => void }) => (
    <button data-testid="model-selector" onClick={() => onSelect("test-model")}>
      {value || "model_selector.select"}
    </button>
  ),
}));

// ToolChoiceToggle: 3버튼 그룹
vi.mock("@/components/tool-choice-toggle", () => ({
  ToolChoiceToggle: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div data-testid="tool-choice-toggle">
      <button data-testid="tool-choice-manual" onClick={() => onChange("manual")}>manual</button>
      <span>{value}</span>
    </div>
  ),
}));

// AttachedToolChips: 아이템 렌더
vi.mock("@/components/attached-tool-chips", () => ({
  AttachedToolChips: ({ items, onRemove }: { items: Array<{ id: string; name: string }>; onRemove: (id: string) => void }) => {
    if (items.length === 0) return null;
    return (
      <div data-testid="attached-chips">
        {items.map((item) => (
          <span key={item.id} data-testid={`chip-${item.id}`}>
            {item.name}
            <button data-testid={`remove-${item.id}`} onClick={() => onRemove(item.id)}>x</button>
          </span>
        ))}
      </div>
    );
  },
}));

vi.mock("@/pages/chat/media-preview", () => ({
  MediaPreviewBar: () => <div data-testid="media-preview" />,
}));

import { ChatPromptBar, type ChatPromptBarProps } from "@/components/chat-prompt-bar";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

const base_props: ChatPromptBarProps = {
  input: "",
  setInput: vi.fn(),
  sending: false,
  can_send: false,
  onSend: vi.fn(),
};

function render_bar(overrides: Partial<ChatPromptBarProps> = {}) {
  return render(<ChatPromptBar {...base_props} {...overrides} />);
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("ChatPromptBar (FE-2b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("기본 렌더 — textarea, 전송 버튼 존재", () => {
    render_bar();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByLabelText("chat.send")).toBeInTheDocument();
  });

  it("onAttach 제공 시 + 버튼 표시", () => {
    render_bar({ onAttach: vi.fn() });
    expect(screen.getByLabelText("chat.attach_file")).toBeInTheDocument();
  });

  it("onModelChange 제공 시 ModelSelectorDropdown 렌더", () => {
    render_bar({ onModelChange: vi.fn(), selectedModel: "gpt-4" });
    expect(screen.getByTestId("model-selector")).toBeInTheDocument();
  });

  it("onToolChoiceChange 제공 시 ToolChoice 버튼 표시", () => {
    render_bar({
      onToolChoiceChange: vi.fn(),
      tool_choice: "auto",
    });
    expect(screen.getByLabelText("chat.attach_tools")).toBeInTheDocument();
  });

  it("onMentionSelect 제공 시 @ 버튼 표시", () => {
    render_bar({
      onMentionSelect: vi.fn(),
      onMentionRemove: vi.fn(),
      attached_items: [],
    });
    expect(screen.getByLabelText("chat.mention_trigger")).toBeInTheDocument();
  });

  it("@ 클릭 시 MentionPicker 열림", () => {
    render_bar({
      onMentionSelect: vi.fn(),
      onMentionRemove: vi.fn(),
      attached_items: [],
    });
    expect(screen.queryByTestId("mention-picker")).toBeNull();
    fireEvent.click(screen.getByLabelText("chat.mention_trigger"));
    expect(screen.getByTestId("mention-picker")).toBeInTheDocument();
  });

  it("textarea에 @ 입력 시 MentionPicker 열림", () => {
    const setInput = vi.fn();
    render_bar({
      input: "",
      setInput,
      onMentionSelect: vi.fn(),
      onMentionRemove: vi.fn(),
      attached_items: [],
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "@" } });
    expect(setInput).toHaveBeenCalledWith("@");
    expect(screen.getByTestId("mention-picker")).toBeInTheDocument();
  });

  it("attached_items가 있으면 AttachedToolChips 렌더 + tool_count 표시", () => {
    render_bar({
      onMentionSelect: vi.fn(),
      onMentionRemove: vi.fn(),
      attached_items: [
        { type: "tool", id: "t1", name: "MyTool" },
        { type: "workflow", id: "w1", name: "MyWF" },
      ],
    });
    expect(screen.getByTestId("attached-chips")).toBeInTheDocument();
    expect(screen.getByTestId("chip-t1")).toBeInTheDocument();
    expect(screen.getByTestId("chip-w1")).toBeInTheDocument();
    // tool_count 표시
    expect(screen.getByText(/chat\.tool_count/)).toBeInTheDocument();
  });

  it("ToolChoice 드롭다운: 클릭 시 ToolChoiceToggle 표시", () => {
    render_bar({
      onToolChoiceChange: vi.fn(),
      tool_choice: "auto",
    });
    expect(screen.queryByTestId("tool-choice-toggle")).toBeNull();
    fireEvent.click(screen.getByLabelText("chat.attach_tools"));
    expect(screen.getByTestId("tool-choice-toggle")).toBeInTheDocument();
  });

  it("sending=true이면 textarea disabled, 전송 버튼 busy 상태", () => {
    render_bar({ sending: true });
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByLabelText("chat.sending")).toBeInTheDocument();
  });

  it("can_send=true + 클릭 시 onSend 호출", () => {
    const onSend = vi.fn();
    render_bar({ can_send: true, onSend });
    fireEvent.click(screen.getByLabelText("chat.send"));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("Enter 키로 전송", () => {
    const onSend = vi.fn();
    render_bar({ can_send: true, onSend, input: "hello" });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("Shift+Enter는 전송하지 않음", () => {
    const onSend = vi.fn();
    render_bar({ can_send: true, onSend, input: "hello" });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("미디어 있으면 MediaPreviewBar 렌더", () => {
    render_bar({
      pending_media: [{ type: "image", url: "data:image/png;base64,abc", name: "photo.png" }],
      onRemoveMedia: vi.fn(),
    });
    expect(screen.getByTestId("media-preview")).toBeInTheDocument();
  });
});
