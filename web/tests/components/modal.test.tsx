/** VR-6: Modal smoke test — renders when open, doesn't render when closed. */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { Modal } from "@/components/modal";

describe("Modal", () => {
  it("renders nothing when open=false", () => {
    const { container } = render(
      <Modal open={false} title="Test" onClose={vi.fn()}>Content</Modal>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title and children when open=true", () => {
    render(
      <Modal open={true} title="My Modal" onClose={vi.fn()}>
        <p>Hello World</p>
      </Modal>,
    );
    expect(screen.getByText("My Modal")).toBeInTheDocument();
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders confirm button when onConfirm provided", () => {
    render(
      <Modal open={true} title="Confirm" onClose={vi.fn()} onConfirm={vi.fn()} confirmLabel="OK">
        Body
      </Modal>,
    );
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});
