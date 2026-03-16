/**
 * TN-1: TenantContext 도메인 모델 단위 테스트.
 * resolve_tenant_context()가 올바른 MembershipSource와 TeamRole을 반환하는지 검증.
 */
import { describe, it, expect } from "vitest";
import { resolve_tenant_context, type TenantContext, type MembershipSource } from "@src/auth/tenant-context.js";
import type { MembershipRecord } from "@src/auth/team-store.js";

function make_membership(user_id: string, team_id: string, role: MembershipRecord["role"] = "member"): MembershipRecord {
  return { team_id, user_id, role, joined_at: new Date().toISOString() };
}

describe("resolve_tenant_context — superadmin bypass", () => {
  it("superadmin은 get_membership 호출 없이 owner로 결정", () => {
    let called = false;
    const ctx = resolve_tenant_context({
      user_id: "u1",
      system_role: "superadmin",
      team_id: "team_alpha",
      get_membership: () => { called = true; return null; },
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.team_role).toBe("owner");
    expect(ctx!.membership_source).toBe("superadmin_bypass");
    expect(ctx!.user_id).toBe("u1");
    expect(called).toBe(false);
  });

  it("superadmin은 존재하지 않는 팀에도 접근 가능", () => {
    const ctx = resolve_tenant_context({
      user_id: "admin1",
      system_role: "superadmin",
      team_id: "nonexistent_team",
      get_membership: () => null,
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.membership_source).toBe("superadmin_bypass");
  });
});

describe("resolve_tenant_context — explicit membership", () => {
  it("멤버십 있는 일반 사용자 → explicit_membership + 올바른 role", () => {
    const membership = make_membership("u2", "team_beta", "manager");
    const ctx = resolve_tenant_context({
      user_id: "u2",
      system_role: "user",
      team_id: "team_beta",
      get_membership: () => membership,
    });

    expect(ctx).not.toBeNull();
    expect(ctx!.team_role).toBe("manager");
    expect(ctx!.membership_source).toBe("explicit_membership");
    expect(ctx!.user_id).toBe("u2");
    expect(ctx!.team_id).toBe("team_beta");
  });

  it("role이 viewer인 경우도 정상 반환", () => {
    const ctx = resolve_tenant_context({
      user_id: "u3",
      system_role: "user",
      team_id: "t1",
      get_membership: () => make_membership("u3", "t1", "viewer"),
    });

    expect(ctx!.team_role).toBe("viewer");
    expect(ctx!.membership_source).toBe("explicit_membership");
  });

  it("role이 owner인 경우도 정상 반환", () => {
    const ctx = resolve_tenant_context({
      user_id: "u4",
      system_role: "user",
      team_id: "t2",
      get_membership: () => make_membership("u4", "t2", "owner"),
    });

    expect(ctx!.team_role).toBe("owner");
    expect(ctx!.membership_source).toBe("explicit_membership");
  });
});

describe("resolve_tenant_context — 멤버십 없음 (null 반환)", () => {
  it("비멤버 일반 사용자 → null (접근 거부)", () => {
    const ctx = resolve_tenant_context({
      user_id: "u5",
      system_role: "user",
      team_id: "team_gamma",
      get_membership: () => null,
    });

    expect(ctx).toBeNull();
  });

  it("멤버십 없으면 team_id와 무관하게 null", () => {
    ["team_a", "team_b", "default"].forEach((team_id) => {
      const ctx = resolve_tenant_context({
        user_id: "outsider",
        system_role: "user",
        team_id,
        get_membership: () => null,
      });
      expect(ctx).toBeNull();
    });
  });
});

describe("TenantContext 타입 형태", () => {
  it("반환값이 TenantContext 구조를 만족", () => {
    const membership = make_membership("u6", "team_delta", "member");
    const ctx = resolve_tenant_context({
      user_id: "u6",
      system_role: "user",
      team_id: "team_delta",
      get_membership: () => membership,
    }) as TenantContext;

    // 필수 필드 검증
    expect(typeof ctx.user_id).toBe("string");
    expect(typeof ctx.team_id).toBe("string");
    expect(typeof ctx.team_role).toBe("string");
    const valid_sources: MembershipSource[] = [
      "explicit_membership", "superadmin_bypass", "default_team_fallback", "no_auth",
    ];
    expect(valid_sources).toContain(ctx.membership_source);
  });
});

describe("MembershipSource — 열거 값 완전성", () => {
  it("모든 MembershipSource 값이 문자열", () => {
    const all: MembershipSource[] = [
      "explicit_membership", "superadmin_bypass", "default_team_fallback", "no_auth",
    ];
    all.forEach((s) => expect(typeof s).toBe("string"));
  });
});
