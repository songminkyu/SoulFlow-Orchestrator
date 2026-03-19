/**
 * VisibilityBadge 컴포넌트 테스트 — tier별 badge 표시.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VisibilityBadge } from "../src/components/visibility-badge";
import { I18nProvider } from "../src/i18n";
import type { PermissionTier } from "../src/types/visibility";
import { TIER_ORDER } from "../src/types/visibility";

function wrap(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("VisibilityBadge", () => {
  it("renders badge for each tier with correct data-tier attribute", () => {
    for (const tier of TIER_ORDER) {
      const { container, unmount } = wrap(<VisibilityBadge tier={tier} />);
      const badge = container.querySelector(`[data-tier="${tier}"]`);
      expect(badge).not.toBeNull();
      unmount();
    }
  });

  it("consumer badge has off variant", () => {
    const { container } = wrap(<VisibilityBadge tier="consumer" />);
    const badge = container.querySelector(".badge--off");
    expect(badge).not.toBeNull();
  });

  it("authenticated_member badge has info variant", () => {
    const { container } = wrap(<VisibilityBadge tier="authenticated_member" />);
    const badge = container.querySelector(".badge--info");
    expect(badge).not.toBeNull();
  });

  it("workspace_editor badge has ok variant", () => {
    const { container } = wrap(<VisibilityBadge tier="workspace_editor" />);
    const badge = container.querySelector(".badge--ok");
    expect(badge).not.toBeNull();
  });

  it("operator badge has warn variant", () => {
    const { container } = wrap(<VisibilityBadge tier="operator" />);
    const badge = container.querySelector(".badge--warn");
    expect(badge).not.toBeNull();
  });

  it("superadmin badge has err variant", () => {
    const { container } = wrap(<VisibilityBadge tier="superadmin" />);
    const badge = container.querySelector(".badge--err");
    expect(badge).not.toBeNull();
  });

  it("renders i18n label text", () => {
    // en locale by default
    wrap(<VisibilityBadge tier="superadmin" />);
    expect(screen.getByText("Superadmin")).toBeInTheDocument();
  });

  it("has aria-label for accessibility", () => {
    wrap(<VisibilityBadge tier="operator" />);
    const badge = screen.getByLabelText("Operator");
    expect(badge).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = wrap(<VisibilityBadge tier="consumer" className="custom-class" />);
    const badge = container.querySelector(".custom-class");
    expect(badge).not.toBeNull();
  });

  it("all tiers have different variant classes", () => {
    const variantMap: Record<PermissionTier, string> = {
      consumer: "badge--off",
      authenticated_member: "badge--info",
      workspace_editor: "badge--ok",
      operator: "badge--warn",
      superadmin: "badge--err",
    };

    for (const [tier, expectedClass] of Object.entries(variantMap)) {
      const { container, unmount } = wrap(
        <VisibilityBadge tier={tier as PermissionTier} />,
      );
      expect(container.querySelector(`.${expectedClass}`)).not.toBeNull();
      unmount();
    }
  });
});
