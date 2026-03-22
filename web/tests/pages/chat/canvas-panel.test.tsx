/** VR-6: CanvasPanel smoke test — renders canvas container. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { CanvasPanel } from "@/pages/chat/canvas-panel";

describe("CanvasPanel", () => {
  it("renders nothing when specs is empty", () => {
    const { container } = render(
      <CanvasPanel specs={[]} onAction={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders canvas card with title", () => {
    const spec = {
      canvas_id: "c1",
      title: "My Canvas",
      components: [{ type: "text" as const, content: "Hello" }],
    };
    render(
      <CanvasPanel specs={[spec]} onAction={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText("My Canvas")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
