/**
 * GW-6: MessageList — delivery trace 렌더 테스트.
 *
 * 대상:
 * - 채널 불일치(requested_channel ≠ delivered_channel) 표시
 * - execution_route 표시
 * - 필드 없을 때 비표시
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { MessageList } from "@/pages/chat/message-list";

const base_props = {
  sending: false,
  last_is_user: false,
  is_streaming: false,
  pending_approvals: [] as [],
  onResolveApproval: vi.fn(),
};

describe("MessageList — GW-6 delivery trace 렌더", () => {
  it("채널 불일치 시 drill-down 토글 버튼을 렌더한다", () => {
    const messages = [{
      direction: "assistant" as const,
      content: "Hello",
      at: "2026-01-01T00:00:00Z",
      requested_channel: "slack",
      delivered_channel: "web",
    }];
    render(<MessageList {...base_props} messages={messages} />);
    expect(screen.getByText(/slack.*→.*web/)).toBeInTheDocument();
  });

  it("채널 일치 시 불일치 텍스트를 렌더하지 않는다", () => {
    const messages = [{
      direction: "assistant" as const,
      content: "Hello",
      at: "2026-01-01T00:00:00Z",
      requested_channel: "web",
      delivered_channel: "web",
    }];
    const { container } = render(<MessageList {...base_props} messages={messages} />);
    expect(container.textContent).not.toContain("web → web");
  });

  it("execution_route가 있으면 drill-down 토글 버튼을 렌더한다", () => {
    const messages = [{
      direction: "assistant" as const,
      content: "Done",
      at: "2026-01-01T00:00:00Z",
      execution_route: "agent",
    }];
    render(<MessageList {...base_props} messages={messages} />);
    expect(screen.getByText(/agent/)).toBeInTheDocument();
  });

  it("user 메시지에는 execution_route를 렌더하지 않는다", () => {
    const messages = [{
      direction: "user" as const,
      content: "Hi",
      at: "2026-01-01T00:00:00Z",
      execution_route: "once",
    }];
    const { container } = render(<MessageList {...base_props} messages={messages} />);
    expect(container.textContent).not.toContain("route:");
  });

  it("delivery trace 필드가 없으면 추가 텍스트 없이 메시지만 렌더한다", () => {
    const messages = [{
      direction: "assistant" as const,
      content: "Plain message",
      at: "2026-01-01T00:00:00Z",
    }];
    const { container } = render(<MessageList {...base_props} messages={messages} />);
    expect(container.textContent).not.toContain("route:");
    expect(container.textContent).not.toContain("→");
  });
});
