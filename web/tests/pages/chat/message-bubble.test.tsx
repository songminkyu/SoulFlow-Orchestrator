/** VR-6: ChatMessageBubble smoke test — renders message text, handles user vs assistant. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@/pages/chat/markdown-content", () => ({
  MarkdownContent: ({ content }: { content: string }) => <span>{content}</span>,
}));

vi.mock("@/pages/chat/media-preview", () => ({
  MediaDisplay: () => null,
}));

vi.mock("@/pages/chat/tool-call-block", () => ({
  ThinkingBlockList: () => null,
}));

import { ChatMessageBubble } from "@/pages/chat/message-bubble";

const base_msg = {
  id: "m1",
  content: "Hello there",
  direction: "user" as const,
  at: new Date().toISOString(),
};

describe("ChatMessageBubble", () => {
  it("renders user message text", () => {
    render(<ChatMessageBubble message={base_msg} />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    const msg = { ...base_msg, direction: "assistant" as const, content: "I can help" };
    render(<ChatMessageBubble message={msg} />);
    expect(screen.getByText("I can help")).toBeInTheDocument();
  });
});
