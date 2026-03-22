/** VR-6: Badge smoke test — renders with different variants. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/badge";

describe("Badge", () => {
  it("renders status text", () => {
    render(<Badge status="active" />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("auto-classifies status to variant", () => {
    const { container } = render(<Badge status="running" />);
    expect(container.querySelector(".badge--warn")).toBeInTheDocument();
  });

  it("uses explicit variant when provided", () => {
    const { container } = render(<Badge status="test" variant="err" />);
    expect(container.querySelector(".badge--err")).toBeInTheDocument();
  });
});
