/**
 * useSurfaceGuard 훅 테스트 — resolveTier 순수 함수 + canView 로직.
 *
 * React hook 자체는 useAuthUser에 의존하므로 resolveTier를 직접 테스트.
 */

import { describe, it, expect } from "vitest";
import { resolveTier } from "../src/hooks/use-surface-guard";
import type { AuthUser } from "../src/hooks/use-auth";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: "u1",
    username: "test",
    role: "user",
    tid: "t1",
    wdir: "/tmp",
    exp: Date.now() / 1000 + 3600,
    team_role: null,
    ...overrides,
  };
}

describe("resolveTier", () => {
  it("null user -> consumer", () => {
    expect(resolveTier(null)).toBe("consumer");
  });

  it("undefined user -> consumer", () => {
    expect(resolveTier(undefined)).toBe("consumer");
  });

  it("superadmin system role -> superadmin (regardless of team_role)", () => {
    expect(resolveTier(makeUser({ role: "superadmin", team_role: "viewer" }))).toBe("superadmin");
    expect(resolveTier(makeUser({ role: "superadmin", team_role: "owner" }))).toBe("superadmin");
    expect(resolveTier(makeUser({ role: "superadmin", team_role: null }))).toBe("superadmin");
  });

  it("team_role=owner -> operator", () => {
    expect(resolveTier(makeUser({ team_role: "owner" }))).toBe("operator");
  });

  it("team_role=manager -> workspace_editor", () => {
    expect(resolveTier(makeUser({ team_role: "manager" }))).toBe("workspace_editor");
  });

  it("team_role=member -> authenticated_member", () => {
    expect(resolveTier(makeUser({ team_role: "member" }))).toBe("authenticated_member");
  });

  it("team_role=viewer -> authenticated_member", () => {
    expect(resolveTier(makeUser({ team_role: "viewer" }))).toBe("authenticated_member");
  });

  it("no team_role (null) -> authenticated_member", () => {
    expect(resolveTier(makeUser({ team_role: null }))).toBe("authenticated_member");
  });

  it("no team_role (undefined) -> authenticated_member", () => {
    expect(resolveTier(makeUser({ team_role: undefined }))).toBe("authenticated_member");
  });
});
