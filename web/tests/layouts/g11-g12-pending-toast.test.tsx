/**
 * G-11: 팀 전환 rebind-pending 시각 상태 + G-12: denial toast — 직접 렌더 검증.
 *
 * RootLayout을 렌더하고:
 * - G-11: isPending=true일 때 topbar__team-badge--pending CSS 클래스 + aria-busy 확인
 * - G-12: switch_team onError 시 toast 함수가 에러 메시지와 함께 호출되는지 확인
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── 의존성 모킹 ───────────────────────────────────────────────────────────────

vi.mock("@/api/sse", () => ({
  create_sse: () => ({ close: vi.fn() }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: "/" }),
    Outlet: () => <div data-testid="outlet" />,
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/store", () => ({
  useDashboardStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      connection: "connected",
      set_connection: vi.fn(),
      open_sidebar: vi.fn(),
      set_web_stream: vi.fn(),
      set_mirror_event: vi.fn(),
      theme: "light",
      toggle_theme: vi.fn(),
      push_canvas: vi.fn(),
    }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    set_locale: vi.fn(),
  }),
}));

vi.mock("@/api/client", () => ({
  api: { get: vi.fn().mockResolvedValue({ needed: false }) },
}));

const mock_toast = vi.fn();
vi.mock("@/components/toast", () => ({
  useToast: () => ({ toast: mock_toast }),
}));
vi.mock("@/hooks/use-click-outside", () => ({ useClickOutside: vi.fn() }));
vi.mock("@/layouts/sidebar", () => ({ Sidebar: () => <div data-testid="sidebar" /> }));

// ── 동적 모킹: isPending 제어 ───────────────────────────────────────────────

let mock_is_pending = false;
let captured_mutate_opts: { onError?: (err: unknown) => void } | null = null;

vi.mock("@/hooks/use-auth", () => ({
  useAuthStatus: () => ({ data: { enabled: true, initialized: true } }),
  useAuthUser: () => ({
    data: { username: "tester", tid: "team-a", system_role: "user" },
    isLoading: false,
    isFetching: false,
  }),
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
  useMyTeams: () => ({
    data: [
      { id: "team-a", name: "Alpha", role: "admin" },
      { id: "team-b", name: "Beta", role: "member" },
    ],
  }),
  useSwitchTeam: () => ({
    mutate: (_id: string, opts?: { onSuccess?: () => void; onError?: (err: unknown) => void }) => {
      captured_mutate_opts = opts ?? null;
    },
    isPending: mock_is_pending,
  }),
}));

import { RootLayout } from "@/layouts/root";

// ── G-11 테스트 ──────────────────────────────────────────────────────────────

describe("G-11: 팀 전환 rebind-pending 시각 상태 — 직접 렌더", () => {
  beforeEach(() => {
    mock_is_pending = false;
    captured_mutate_opts = null;
    mock_toast.mockClear();
  });

  it("isPending=false일 때 topbar__team-badge--pending 클래스가 없다", () => {
    mock_is_pending = false;
    render(<MemoryRouter><RootLayout /></MemoryRouter>);
    const badge = document.querySelector(".topbar__team-badge");
    expect(badge).not.toBeNull();
    expect(badge!.classList.contains("topbar__team-badge--pending")).toBe(false);
  });

  it("isPending=true일 때 topbar__team-badge--pending 클래스가 적용된다", () => {
    mock_is_pending = true;
    render(<MemoryRouter><RootLayout /></MemoryRouter>);
    const badge = document.querySelector(".topbar__team-badge--pending");
    expect(badge).not.toBeNull();
    expect(badge!.getAttribute("aria-busy")).toBe("true");
    expect(badge!.hasAttribute("disabled")).toBe(true);
  });

  it("isPending=true일 때 t('team.switching') 텍스트가 표시된다", () => {
    mock_is_pending = true;
    render(<MemoryRouter><RootLayout /></MemoryRouter>);
    expect(screen.getByText("team.switching")).toBeInTheDocument();
  });
});

// ── G-12 테스트 ──────────────────────────────────────────────────────────────

describe("G-12: denial toast — 직접 렌더 + 상호작용", () => {
  beforeEach(() => {
    mock_is_pending = false;
    captured_mutate_opts = null;
    mock_toast.mockClear();
  });

  it("팀 전환 메뉴를 열고 다른 팀을 클릭하면 mutate가 호출된다", () => {
    render(<MemoryRouter><RootLayout /></MemoryRouter>);
    // 팀 배지 클릭 → 메뉴 열기
    const badge = document.querySelector(".topbar__team-badge");
    expect(badge).not.toBeNull();
    fireEvent.click(badge!);
    // Beta 팀 버튼 클릭
    const beta_btn = screen.getByText("Beta");
    fireEvent.click(beta_btn);
    // mutate가 호출되어 captured_mutate_opts가 설정됨
    expect(captured_mutate_opts).not.toBeNull();
  });

  it("onError에서 not_a_member 코드를 받으면 team.err_not_member 토스트 발행", () => {
    render(<MemoryRouter><RootLayout /></MemoryRouter>);
    const badge = document.querySelector(".topbar__team-badge")!;
    fireEvent.click(badge);
    const beta_btn = screen.getByText("Beta");
    fireEvent.click(beta_btn);

    expect(captured_mutate_opts?.onError).toBeDefined();
    act(() => {
      captured_mutate_opts!.onError!({ body: { error: "not_a_member" } });
    });
    expect(mock_toast).toHaveBeenCalledWith("team.err_not_member", "err");
  });

  it("onError에서 team_id_required 코드를 받으면 team.err_id_required 토스트 발행", () => {
    render(<MemoryRouter><RootLayout /></MemoryRouter>);
    const badge = document.querySelector(".topbar__team-badge")!;
    fireEvent.click(badge);
    fireEvent.click(screen.getByText("Beta"));

    act(() => {
      captured_mutate_opts!.onError!({ body: { error: "team_id_required" } });
    });
    expect(mock_toast).toHaveBeenCalledWith("team.err_id_required", "err");
  });

  it("onError에서 알 수 없는 코드를 받으면 team.err_switch_failed 토스트 발행", () => {
    render(<MemoryRouter><RootLayout /></MemoryRouter>);
    const badge = document.querySelector(".topbar__team-badge")!;
    fireEvent.click(badge);
    fireEvent.click(screen.getByText("Beta"));

    act(() => {
      captured_mutate_opts!.onError!({ body: { error: "unknown_code" } });
    });
    expect(mock_toast).toHaveBeenCalledWith("team.err_switch_failed", "err");
  });
});
