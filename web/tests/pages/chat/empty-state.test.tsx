/** VR-6: Chat EmptyState smoke test — renders empty state message. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { EmptyState } from "@/pages/chat/empty-state";

describe("Chat EmptyState", () => {
  it("renders without crashing", () => {
    const { container } = render(<EmptyState onNewSession={vi.fn()} />);
    expect(container.querySelector(".chat-empty")).toBeInTheDocument();
  });

  it("renders greeting text", () => {
    render(<EmptyState onNewSession={vi.fn()} />);
    expect(screen.getByText("chat.greeting")).toBeInTheDocument();
  });
});
