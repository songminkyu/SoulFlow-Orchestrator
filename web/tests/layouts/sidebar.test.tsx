/**
 * FE-S: 사이드바 NAV_GROUPS 재구성 테스트
 *
 * - 새 6그룹 렌더링 (chat/workflow/prompting/connect/system + admin 조건부)
 * - admin 그룹 가시성 (superadmin → 보임, user → 안보임)
 * - 사이드바 접기/펼치기
 * - overview 제거 확인 (/ 링크 없음)
 * - router index→/chat 리다이렉트
 * - login split layout
 * - locale key 직접 검증
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// ── 공통 모킹 ─────────────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    set_locale: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-click-outside", () => ({ useClickOutside: vi.fn() }));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/use-page-access", () => ({
  tier_satisfied: () => true,
}));

vi.mock("@/pages/access-policy", () => ({
  PAGE_POLICIES: [],
}));

// ── auth 모킹 (role 주입 가능) ────────────────────────────────────────────────

let mock_role = "user";

vi.mock("@/hooks/use-auth", () => ({
  useAuthStatus: () => ({ data: { enabled: true, initialized: true } }),
  useAuthUser: () => ({
    data: {
      username: "testuser",
      tid: "team-1",
      role: mock_role,
      team_role: "member",
      sub: "u1",
      wdir: "/",
      exp: 9999999999,
    },
    isLoading: false,
    isFetching: false,
  }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
  useMyTeams: () => ({ data: [{ id: "team-1", name: "Team 1", role: "member" }] }),
  useSwitchTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useLogin: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// ── store 모킹 ─────────────────────────────────────────────────────────────────

let mock_collapsed = false;
const mock_toggle = vi.fn();

vi.mock("@/store", () => ({
  useDashboardStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      sidebar_collapsed: mock_collapsed,
      toggle_sidebar: mock_toggle,
      sidebar_open: false,
      open_sidebar: vi.fn(),
      close_sidebar: vi.fn(),
      connection: "connected",
      set_connection: vi.fn(),
      theme: "dark",
      toggle_theme: vi.fn(),
      set_web_stream: vi.fn(),
      set_mirror_event: vi.fn(),
      push_canvas: vi.fn(),
    }),
}));

// ── tanstack/react-query 모킹 (login.tsx용) ────────────────────────────────────

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: { enabled: true, initialized: true }, isLoading: false })),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false })),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), clear: vi.fn(), prefetchQuery: vi.fn() }),
}));

vi.mock("@/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

// ── import after mocks ────────────────────────────────────────────────────────

import { Sidebar } from "@/layouts/sidebar";
import LoginPage from "@/pages/login";

// ── locale JSON 직접 import ────────────────────────────────────────────────────

import en_dict from "../../../src/i18n/locales/en.json";
import ko_dict from "../../../src/i18n/locales/ko.json";

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mock_collapsed = false;
  mock_role = "user";
  mock_toggle.mockClear();
});

// ── 1. 새 NAV_GROUPS 그룹 레이블 확인 ────────────────────────────────────────

describe("FE-S: 새 6그룹 사이드바 구조", () => {
  it("nav.group.chat 그룹이 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.group.chat")).toBeInTheDocument();
  });

  it("nav.group.workflow 그룹이 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.group.workflow")).toBeInTheDocument();
  });

  it("nav.group.prompting 그룹이 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.group.prompting")).toBeInTheDocument();
  });

  it("nav.group.connect 그룹이 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.group.connect")).toBeInTheDocument();
  });

  it("nav.group.system 그룹이 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.group.system")).toBeInTheDocument();
  });

  it("nav.chat 아이템이 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    // sidebar + bottom-nav 양쪽에 렌더되므로 getAllByText 사용
    expect(screen.getAllByText("nav.chat").length).toBeGreaterThanOrEqual(1);
  });

  it("nav.workflows 아이템이 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    // sidebar + bottom-nav 양쪽에 렌더되므로 getAllByText 사용
    expect(screen.getAllByText("nav.workflows").length).toBeGreaterThanOrEqual(1);
  });

  it("nav.oauth 아이템이 시스템 그룹에 렌더된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.oauth")).toBeInTheDocument();
  });
});

// ── 2. overview 제거 확인 ─────────────────────────────────────────────────────

describe("FE-S: overview 제거", () => {
  it("nav.overview 아이템이 사이드바에 없다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText("nav.overview")).not.toBeInTheDocument();
  });

  it("nav.group.main 그룹이 사이드바에 없다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText("nav.group.main")).not.toBeInTheDocument();
  });

  it("nav.group.build 그룹이 사이드바에 없다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText("nav.group.build")).not.toBeInTheDocument();
  });

  it("workspace 아이템이 사이드바에 없다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText("nav.workspace")).not.toBeInTheDocument();
  });
});

// ── 3. admin 그룹 가시성 ─────────────────────────────────────────────────────

describe("FE-S: admin 그룹 가시성 — user 역할 (숨김)", () => {
  it("user 역할에서 nav.group.admin 그룹이 보이지 않는다", () => {
    mock_role = "user";
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText("nav.group.admin")).not.toBeInTheDocument();
  });
});

describe("FE-S: admin 그룹 가시성 — superadmin 역할 (표시)", () => {
  it("superadmin 역할에서 nav.group.admin 그룹이 렌더된다", () => {
    mock_role = "superadmin";
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.group.admin")).toBeInTheDocument();
  });

  it("superadmin 역할에서 nav.admin 아이템이 렌더된다", () => {
    mock_role = "superadmin";
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.admin")).toBeInTheDocument();
  });
});

// ── 4. 접기/펼치기 ────────────────────────────────────────────────────────────

describe("FE-S: 사이드바 접기/펼치기", () => {
  it("기본 상태(펼침)에서 그룹 레이블이 표시된다", () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText("nav.group.chat")).toBeVisible();
  });

  it("접힘 상태에서 sidebar--collapsed 클래스가 적용된다", () => {
    mock_collapsed = true;
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    const nav = document.querySelector("nav.sidebar");
    expect(nav!.classList.contains("sidebar--collapsed")).toBe(true);
  });

  it("접힘 상태에서 그룹 레이블이 DOM에 없다", () => {
    mock_collapsed = true;
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.queryByText("nav.group.chat")).not.toBeInTheDocument();
  });
});

// ── 5. 라우터 인덱스 → /chat 리다이렉트 ──────────────────────────────────────

describe("FE-S: router index → /chat redirect", () => {
  it("router.tsx 인덱스 경로가 Navigate 컴포넌트를 사용한다", async () => {
    // router.tsx를 직접 import해서 index route가 Navigate element를 가지는지 확인
    const { router } = await import("@/router");
    const root_route = router.routes[1]; // RootLayout 래퍼
    // @ts-expect-error — router routes internal structure
    const index_route = root_route?.children?.find((r) => r.index === true);
    expect(index_route).toBeDefined();
    // element가 OverviewPage가 아닌 Navigate 컴포넌트임
    const el = index_route?.element;
    expect(el).toBeDefined();
    // Navigate 컴포넌트의 to prop이 "/chat"인지 확인
    expect(React.isValidElement(el)).toBe(true);
    const props = (el as React.ReactElement<{ to: string; replace: boolean }>).props;
    expect(props.to).toBe("/chat");
    expect(props.replace).toBe(true);
  });
});

// ── 6. 로그인 split layout ────────────────────────────────────────────────────

describe("FE-S: 로그인 split layout", () => {
  it("login-page 컨테이너가 렌더된다", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(document.querySelector(".login-page")).not.toBeNull();
  });

  it("login-page__art 아트 패널이 렌더된다", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(document.querySelector(".login-page__art")).not.toBeNull();
  });

  it("login-page__form 폼 패널이 렌더된다", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(document.querySelector(".login-page__form")).not.toBeNull();
  });

  it("login.welcome i18n 키가 렌더된다", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    // t("login.welcome") → "login.welcome" (mock returns key)
    expect(screen.getByText("login.welcome")).toBeInTheDocument();
  });

  it("login.subtitle i18n 키가 렌더된다", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByText("login.subtitle")).toBeInTheDocument();
  });
});

// ── 7. locale 키 직접 검증 ───────────────────────────────────────────────────

describe("FE-S: en.json locale 키 직접 검증", () => {
  it("nav.group.chat 키가 en.json에 있다", () => {
    expect((en_dict as Record<string, string>)["nav.group.chat"]).toBeDefined();
  });

  it("nav.group.workflow 키가 en.json에 있다", () => {
    expect((en_dict as Record<string, string>)["nav.group.workflow"]).toBeDefined();
  });

  it("nav.group.prompting 키가 en.json에 있다", () => {
    expect((en_dict as Record<string, string>)["nav.group.prompting"]).toBeDefined();
  });

  it("nav.oauth 키가 en.json에 있다", () => {
    expect((en_dict as Record<string, string>)["nav.oauth"]).toBeDefined();
  });

  it("login.welcome 키가 en.json에 있다", () => {
    expect((en_dict as Record<string, string>)["login.welcome"]).toBeDefined();
  });

  it("login.subtitle 키가 en.json에 있다", () => {
    expect((en_dict as Record<string, string>)["login.subtitle"]).toBeDefined();
  });

  it("login.setup_subtitle 키가 en.json에 있다", () => {
    expect((en_dict as Record<string, string>)["login.setup_subtitle"]).toBeDefined();
  });
});

describe("FE-S: ko.json locale 키 직접 검증", () => {
  it("nav.group.chat 키가 ko.json에 있다", () => {
    expect((ko_dict as Record<string, string>)["nav.group.chat"]).toBeDefined();
  });

  it("nav.group.workflow 키가 ko.json에 있다", () => {
    expect((ko_dict as Record<string, string>)["nav.group.workflow"]).toBeDefined();
  });

  it("nav.group.prompting 키가 ko.json에 있다", () => {
    expect((ko_dict as Record<string, string>)["nav.group.prompting"]).toBeDefined();
  });

  it("nav.oauth 키가 ko.json에 있다", () => {
    expect((ko_dict as Record<string, string>)["nav.oauth"]).toBeDefined();
  });

  it("login.welcome 키가 ko.json에 있다", () => {
    expect((ko_dict as Record<string, string>)["login.welcome"]).toBeDefined();
  });

  it("login.subtitle 키가 ko.json에 있다", () => {
    expect((ko_dict as Record<string, string>)["login.subtitle"]).toBeDefined();
  });

  it("login.setup_subtitle 키가 ko.json에 있다", () => {
    expect((ko_dict as Record<string, string>)["login.setup_subtitle"]).toBeDefined();
  });
});
