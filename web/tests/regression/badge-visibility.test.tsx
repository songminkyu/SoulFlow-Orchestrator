/**
 * FE-6: Badge Visibility 회귀 — Badge 컴포넌트의 variant 분류 + 렌더 검증.
 *
 * 검증 축:
 * 1. Badge classify 함수가 각 status 문자열을 올바른 variant로 분류
 * 2. Badge가 올바른 CSS 클래스와 텍스트로 렌더
 * 3. admin 경로 정책이 superadmin 전용으로 잠겨 있음
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n", () => ({
  useT: () => (key: string) => key,
}));

import { Badge } from "@/components/badge";
import { PAGE_POLICIES } from "@/pages/access-policy";
import type { VisibilityTier } from "@/pages/access-policy";

// -- Badge classify 분류 회귀 ------------------------------------------------

describe("Badge — variant 분류 회귀 (FE-6)", () => {
  it("running/working 상태는 warn variant", () => {
    const { container } = render(<Badge status="running" />);
    expect(container.querySelector(".badge--warn")).not.toBeNull();
  });

  it("completed/ok/active 상태는 ok variant", () => {
    const cases = ["completed", "ok", "active"];
    for (const status of cases) {
      const { container, unmount } = render(<Badge status={status} />);
      expect(container.querySelector(".badge--ok"), `${status} should be ok`).not.toBeNull();
      unmount();
    }
  });

  it("failed/error/cancel 상태는 err variant", () => {
    const cases = ["failed", "error", "cancelled"];
    for (const status of cases) {
      const { container, unmount } = render(<Badge status={status} />);
      expect(container.querySelector(".badge--err"), `${status} should be err`).not.toBeNull();
      unmount();
    }
  });

  it("waiting/idle 상태는 info variant", () => {
    const cases = ["waiting", "idle"];
    for (const status of cases) {
      const { container, unmount } = render(<Badge status={status} />);
      expect(container.querySelector(".badge--info"), `${status} should be info`).not.toBeNull();
      unmount();
    }
  });

  it("알 수 없는 상태는 off variant", () => {
    const { container } = render(<Badge status="unknown" />);
    expect(container.querySelector(".badge--off")).not.toBeNull();
  });

  it("variant prop 직접 지정 시 classify 무시", () => {
    const { container } = render(<Badge status="running" variant="ok" />);
    expect(container.querySelector(".badge--ok")).not.toBeNull();
    expect(container.querySelector(".badge--warn")).toBeNull();
  });

  it("status 텍스트가 그대로 렌더된다", () => {
    render(<Badge status="completed" />);
    expect(screen.getByText("completed")).toBeInTheDocument();
  });
});

// -- admin 페이지 접근 정책 VisibilityTier 보호 --------------------------------

describe("Badge Visibility — admin 정책 tier 보호 (FE-6)", () => {
  it("/admin은 view/manage 모두 superadmin", () => {
    const admin = PAGE_POLICIES.find((p) => p.path === "/admin");
    expect(admin).toBeDefined();
    expect(admin!.view).toBe("superadmin");
    expect(admin!.manage).toBe("superadmin");
  });

  it("operator(team_manager) 이상 제한 페이지가 존재한다", () => {
    const manager_pages = PAGE_POLICIES.filter(
      (p) => p.view === "team_manager" || p.manage === "team_manager",
    );
    expect(manager_pages.length).toBeGreaterThanOrEqual(3);
  });

  it("superadmin 전용 view 페이지는 /admin과 /setup 뿐이다", () => {
    const superadmin_view = PAGE_POLICIES.filter((p) => p.view === "superadmin");
    const paths = superadmin_view.map((p) => p.path).sort();
    expect(paths).toEqual(["/admin", "/setup"]);
  });

  it("모든 tier 값이 유효한 VisibilityTier이다", () => {
    const valid_tiers: VisibilityTier[] = [
      "public", "authenticated", "team_member", "team_manager", "team_owner", "superadmin",
    ];
    for (const p of PAGE_POLICIES) {
      expect(valid_tiers, `invalid view tier: ${p.view} on ${p.path}`).toContain(p.view);
      expect(valid_tiers, `invalid manage tier: ${p.manage} on ${p.path}`).toContain(p.manage);
    }
  });
});
