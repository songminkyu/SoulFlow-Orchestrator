/**
 * FE-6: Permission Gating 회귀 — tier_satisfied 순수 함수 매트릭스 검증.
 *
 * 검증 축:
 * 1. tier_satisfied: consumer/member/editor/operator/superadmin 각 조합의 canView 매트릭스
 * 2. 설정 페이지의 view/manage 정책 검증
 * 3. auth 비활성 시 모든 tier 통과 (싱글유저 모드)
 */
import { describe, it, expect } from "vitest";

import { tier_satisfied } from "@/hooks/use-page-access";
import type { VisibilityTier } from "@/pages/access-policy";
import { PAGE_POLICIES, TEAM_ROLE_RANK } from "@/pages/access-policy";
import type { AuthUser } from "@/hooks/use-auth";

// -- 사용자 팩토리 ---------------------------------------------------------

function make_user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: "u1",
    username: "test",
    role: "user",
    tid: "team-1",
    wdir: "/tmp",
    exp: Date.now() + 60_000,
    team_role: null,
    ...overrides,
  };
}

// -- tier_satisfied 매트릭스 -------------------------------------------------

describe("tier_satisfied — 완전 매트릭스 (FE-6)", () => {
  const tiers: VisibilityTier[] = [
    "public", "authenticated", "team_member", "team_manager", "team_owner", "superadmin",
  ];

  describe("미인증 사용자 (user=null)", () => {
    it("public만 통과", () => {
      expect(tier_satisfied("public", null, true)).toBe(true);
      for (const t of tiers.filter((x) => x !== "public")) {
        expect(tier_satisfied(t, null, true), `null user should fail ${t}`).toBe(false);
      }
    });
  });

  describe("인증 사용자 (team_role=null, role=user)", () => {
    const user = make_user({ team_role: null });

    it("public + authenticated 통과", () => {
      expect(tier_satisfied("public", user, true)).toBe(true);
      expect(tier_satisfied("authenticated", user, true)).toBe(true);
    });

    it("team_* tier 실패 (팀 멤버십 없음)", () => {
      expect(tier_satisfied("team_member", user, true)).toBe(false);
      expect(tier_satisfied("team_manager", user, true)).toBe(false);
      expect(tier_satisfied("team_owner", user, true)).toBe(false);
    });

    it("superadmin 실패", () => {
      expect(tier_satisfied("superadmin", user, true)).toBe(false);
    });
  });

  describe("viewer (team_role=viewer)", () => {
    const user = make_user({ team_role: "viewer" });

    it("team_member 통과 (viewer >= viewer)", () => {
      expect(tier_satisfied("team_member", user, true)).toBe(true);
    });

    it("team_manager 실패", () => {
      expect(tier_satisfied("team_manager", user, true)).toBe(false);
    });
  });

  describe("member (team_role=member)", () => {
    const user = make_user({ team_role: "member" });

    it("team_member 통과", () => {
      expect(tier_satisfied("team_member", user, true)).toBe(true);
    });

    it("team_manager 실패 (member < manager)", () => {
      expect(tier_satisfied("team_manager", user, true)).toBe(false);
    });
  });

  describe("manager (team_role=manager)", () => {
    const user = make_user({ team_role: "manager" });

    it("team_member + team_manager 통과", () => {
      expect(tier_satisfied("team_member", user, true)).toBe(true);
      expect(tier_satisfied("team_manager", user, true)).toBe(true);
    });

    it("team_owner 실패", () => {
      expect(tier_satisfied("team_owner", user, true)).toBe(false);
    });
  });

  describe("owner (team_role=owner)", () => {
    const user = make_user({ team_role: "owner" });

    it("team_member + team_manager + team_owner 통과", () => {
      expect(tier_satisfied("team_member", user, true)).toBe(true);
      expect(tier_satisfied("team_manager", user, true)).toBe(true);
      expect(tier_satisfied("team_owner", user, true)).toBe(true);
    });

    it("superadmin 실패", () => {
      expect(tier_satisfied("superadmin", user, true)).toBe(false);
    });
  });

  describe("superadmin (role=superadmin)", () => {
    const user = make_user({ role: "superadmin" });

    it("모든 tier 통과", () => {
      for (const t of tiers) {
        expect(tier_satisfied(t, user, true), `superadmin should pass ${t}`).toBe(true);
      }
    });
  });

  describe("auth 비활성 (싱글유저 모드)", () => {
    it("public 외 모든 tier 통과 (user 무관)", () => {
      for (const t of tiers) {
        expect(tier_satisfied(t, null, false), `auth_disabled should pass ${t}`).toBe(true);
      }
    });
  });
});

// -- 설정 페이지 operator(manager) 섹션 숨김 검증 ------------------------------

describe("Permission Gating — 설정 페이지 정책 (FE-6)", () => {
  it("/settings view=authenticated, manage=team_owner", () => {
    const settings = PAGE_POLICIES.find((p) => p.path === "/settings");
    expect(settings).toBeDefined();
    expect(settings!.view).toBe("authenticated");
    expect(settings!.manage).toBe("team_owner");
  });

  it("member는 /settings 열람 가능, 관리 불가", () => {
    const member = make_user({ team_role: "member" });
    const settings = PAGE_POLICIES.find((p) => p.path === "/settings")!;
    expect(tier_satisfied(settings.view, member, true)).toBe(true);
    expect(tier_satisfied(settings.manage, member, true)).toBe(false);
  });

  it("viewer는 /channels 접근 불가 (team_manager 필요)", () => {
    const viewer = make_user({ team_role: "viewer" });
    const channels = PAGE_POLICIES.find((p) => p.path === "/channels")!;
    expect(tier_satisfied(channels.view, viewer, true)).toBe(false);
  });
});

// -- TEAM_ROLE_RANK 서열 검증 -------------------------------------------------

describe("TEAM_ROLE_RANK — 서열 무결성 (FE-6)", () => {
  it("owner > manager > member > viewer", () => {
    expect(TEAM_ROLE_RANK.owner).toBeGreaterThan(TEAM_ROLE_RANK.manager);
    expect(TEAM_ROLE_RANK.manager).toBeGreaterThan(TEAM_ROLE_RANK.member);
    expect(TEAM_ROLE_RANK.member).toBeGreaterThan(TEAM_ROLE_RANK.viewer);
  });

  it("4개 역할이 모두 정의됨", () => {
    expect(Object.keys(TEAM_ROLE_RANK).sort()).toEqual(["manager", "member", "owner", "viewer"]);
  });
});
