/**
 * SurfaceGuard 컴포넌트 테스트 — 권한별 렌더링/숨김.
 *
 * useAuthUser를 모킹하여 다양한 사용자 상태에서 SurfaceGuard가
 * children을 올바르게 표시/숨김하는지 검증.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SurfaceGuard } from "../src/components/surface-guard";
import { I18nProvider } from "../src/i18n";
import type { AuthUser } from "../src/hooks/use-auth";

// useAuthUser를 모킹
vi.mock("../src/hooks/use-auth", () => {
  let mockUser: AuthUser | null = null;
  return {
    useAuthUser: () => ({ data: mockUser }),
    useAuthStatus: () => ({ data: { enabled: true, initialized: true } }),
    __setMockUser: (user: AuthUser | null) => { mockUser = user; },
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock import
const authMock = await import("../src/hooks/use-auth") as any;

function setUser(user: AuthUser | null) {
  authMock.__setMockUser(user);
}

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

function wrap(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("SurfaceGuard", () => {
  beforeEach(() => {
    setUser(null);
  });

  it("unauthenticated user cannot see operator content", () => {
    setUser(null);
    wrap(
      <SurfaceGuard requiredTier="operator">
        <div data-testid="secret">Secret</div>
      </SurfaceGuard>,
    );
    expect(screen.queryByTestId("secret")).toBeNull();
  });

  it("superadmin can see consumer content", () => {
    setUser(makeUser({ role: "superadmin" }));
    wrap(
      <SurfaceGuard requiredTier="consumer">
        <div data-testid="content">Visible</div>
      </SurfaceGuard>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("operator can see workspace_editor content", () => {
    setUser(makeUser({ team_role: "owner" }));
    wrap(
      <SurfaceGuard requiredTier="workspace_editor">
        <div data-testid="editor">Editor view</div>
      </SurfaceGuard>,
    );
    expect(screen.getByTestId("editor")).toBeInTheDocument();
  });

  it("authenticated_member cannot see operator content", () => {
    setUser(makeUser({ team_role: "member" }));
    wrap(
      <SurfaceGuard requiredTier="operator">
        <div data-testid="admin">Admin panel</div>
      </SurfaceGuard>,
    );
    expect(screen.queryByTestId("admin")).toBeNull();
  });

  it("renders fallback when permission denied", () => {
    setUser(null);
    wrap(
      <SurfaceGuard requiredTier="superadmin" fallback={<div data-testid="denied">Access Denied</div>}>
        <div data-testid="admin">Admin</div>
      </SurfaceGuard>,
    );
    expect(screen.queryByTestId("admin")).toBeNull();
    expect(screen.getByTestId("denied")).toBeInTheDocument();
  });

  it("consumer tier can see consumer content", () => {
    setUser(null); // consumer
    wrap(
      <SurfaceGuard requiredTier="consumer">
        <div data-testid="public">Public</div>
      </SurfaceGuard>,
    );
    expect(screen.getByTestId("public")).toBeInTheDocument();
  });
});
