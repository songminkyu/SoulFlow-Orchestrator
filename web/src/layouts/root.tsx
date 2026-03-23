import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./sidebar";
import { create_sse } from "../api/sse";
import { useDashboardStore } from "../store";
import { useI18n } from "../i18n";
import { api } from "../api/client";
import { useRef, useState } from "react";
import { useAuthStatus, useAuthUser } from "../hooks/use-auth";
import type { ApiBootstrapStatus } from "../api/contracts";
import { useToast } from "../components/toast";
import { useStatus } from "../api/hooks";
import type { DashboardState } from "../pages/overview/types";

export function RootLayout() {
  const set_connection = useDashboardStore((s) => s.set_connection);
  const connection = useDashboardStore((s) => s.connection);
  const open_sidebar = useDashboardStore((s) => s.open_sidebar);
  const set_web_stream = useDashboardStore((s) => s.set_web_stream);
  const set_mirror_event = useDashboardStore((s) => s.set_mirror_event);
  const theme = useDashboardStore((s) => s.theme);
  const toggle_theme = useDashboardStore((s) => s.toggle_theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const qc = useQueryClient();
  const { t, locale, set_locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const toggle_locale = () => set_locale(locale === "en" ? "ko" : "en");

  const { data: auth_status } = useAuthStatus();
  const { data: auth_user, isLoading: auth_loading, isFetching: auth_fetching } = useAuthUser();
  const { toast } = useToast();
  const { data: state_data } = useStatus();
  const ds = state_data as DashboardState | undefined;

  // auth 활성화 시 미인증 → /login 리다이렉트
  // isFetching도 체크: 로그인 직후 refetch 중 null 상태로 오인해 다시 /login으로 보내는 race condition 방지
  useEffect(() => {
    if (!auth_status?.enabled) return;
    if (auth_loading || auth_fetching) return;
    if (location.pathname === "/login") return;
    if (auth_user === null) navigate("/login", { replace: true });
  }, [auth_status, auth_user, auth_loading, auth_fetching, location.pathname, navigate]);

  // 로그인 페이지에서 이미 인증된 상태면 홈으로
  useEffect(() => {
    if (location.pathname !== "/login") return;
    if (!auth_status?.enabled) { navigate("/", { replace: true }); return; }
    if (auth_user) navigate("/", { replace: true });
  }, [auth_status, auth_user, location.pathname, navigate]);

  // 첫 실행 시 프로바이더 미설정이면 셋업 위저드로 리다이렉트
  // auth 상태 로드 전에는 대기 — 로그인이 반드시 먼저 수행되어야 함
  useEffect(() => {
    if (location.pathname === "/setup") return;
    if (location.pathname === "/login") return;
    if (auth_status === undefined) return;
    if (auth_status.enabled && !auth_user) return;
    api.get<ApiBootstrapStatus>("/api/bootstrap/status")
      .then((res) => { if (res.needed) navigate("/setup"); })
      .catch(() => {});
  }, [location.pathname, navigate, auth_status, auth_user]);

  // G-12: 전역 cross-team 거부 이벤트 리스너 — 임의 API 호출에서의 403 cross_team_denied 전역 감지
  useEffect(() => {
    const handler = () => {
      toast(t("team.err_cross_team_denied"), "err");
    };
    window.addEventListener("cross-team-denied", handler);
    return () => window.removeEventListener("cross-team-denied", handler);
  }, [toast, t]);

  // 일반 403 forbidden toast — viewer 등 권한 부족 시 피드백
  useEffect(() => {
    const handler = () => {
      toast(t("common.err_forbidden") || "권한이 없습니다", "err");
    };
    window.addEventListener("api-forbidden", handler);
    return () => window.removeEventListener("api-forbidden", handler);
  }, [toast, t]);


  // FE-2: SSE 신선도 감지 — 연결 중이지만 이벤트가 멈추면 "stale" 표시
  const last_event_at = useRef<number>(0);
  const [sse_stale, set_sse_stale] = useState(false);
  const SSE_STALE_MS = 30_000;

  // 인터벌에서만 setState — 동기 호출 없음. connection 변경 시 effect 재실행으로 즉시 재평가.
  useEffect(() => {
    const id = setInterval(() => {
      const is_stale = connection === "connected"
        && last_event_at.current > 0
        && Date.now() - last_event_at.current > SSE_STALE_MS;
      set_sse_stale(is_stale);
    }, 5_000);
    return () => clearInterval(id);
  }, [connection]);

  useEffect(() => {
    let msg_timer: ReturnType<typeof setTimeout> | null = null;
    const mark_event = () => { last_event_at.current = Date.now(); set_sse_stale(false); };
    const debounced_message = () => {
      mark_event();
      if (msg_timer) clearTimeout(msg_timer);
      msg_timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["state"] });
        void qc.invalidateQueries({ queryKey: ["chat-session"] });
        void qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      }, 300);
    };
    const sse = create_sse("/api/events", {
      ready: () => { mark_event(); set_connection("connected"); },
      reload: () => { mark_event(); void qc.invalidateQueries(); },
      process: () => { mark_event(); void qc.invalidateQueries({ queryKey: ["state"] }); void qc.invalidateQueries({ queryKey: ["processes"] }); },
      cron: () => { mark_event(); void qc.invalidateQueries({ queryKey: ["state"] }); void qc.invalidateQueries({ queryKey: ["cron-status"] }); void qc.invalidateQueries({ queryKey: ["cron-jobs"] }); },
      message: debounced_message,
      web_stream: (data: unknown) => {
        mark_event();
        const d = data as { chat_id?: string; content?: string; done?: boolean };
        if (d.done) {
          const prev = useDashboardStore.getState().web_stream;
          if (prev) set_web_stream({ ...prev, done: true });
          // web_message 이벤트가 메시지 저장 후 정확한 시점에 invalidate하므로 여기선 생략
          return;
        }
        if (d.chat_id) set_web_stream({ chat_id: d.chat_id, content: d.content ?? "" });
      },
      web_message: (data: unknown) => {
        mark_event();
        const d = data as { chat_id?: string };
        if (d.chat_id) void qc.invalidateQueries({ queryKey: ["chat-session", d.chat_id] });
      },
      mirror_message: (data: unknown) => {
        mark_event();
        const d = data as { session_key?: string; direction?: string; sender_id?: string; content?: string; at?: string };
        if (d.session_key) set_mirror_event({ session_key: d.session_key, direction: d.direction ?? "", sender_id: d.sender_id ?? "", content: d.content ?? "", at: d.at ?? "" });
      },
      canvas: (data: unknown) => {
        mark_event();
        const d = data as { chat_id?: string; spec?: { canvas_id: string; title?: string; components: unknown[] } };
        if (d.chat_id && d.spec) {
          const { push_canvas } = useDashboardStore.getState();
          push_canvas(d.chat_id, d.spec as import("../../../src/dashboard/canvas.types").CanvasSpec);
        }
      },
      task: () => { mark_event(); void qc.invalidateQueries({ queryKey: ["state"] }); void qc.invalidateQueries({ queryKey: ["tasks"] }); void qc.invalidateQueries({ queryKey: ["loops"] }); },
      agent: () => { mark_event(); void qc.invalidateQueries({ queryKey: ["state"] }); void qc.invalidateQueries({ queryKey: ["agents"] }); },
      progress: () => { mark_event(); void qc.invalidateQueries({ queryKey: ["state"] }); void qc.invalidateQueries({ queryKey: ["processes"] }); },
    });
    set_connection("reconnecting");
    return () => { if (msg_timer) clearTimeout(msg_timer); sse.close(); set_connection("disconnected"); };
  }, [set_connection, set_web_stream, set_mirror_event, qc]);

  return (
    <div className="app">
      <a className="skip-to-content" href="#main-content">{t("a11y.skip_to_content")}</a>
      <Sidebar />
      <div className="app__main">
        <header className="topbar">
          <div className="topbar__left">
            <button className="topbar__hamburger" onClick={open_sidebar} aria-label={t("sidebar.expand")}>
              ☰
            </button>
            <h1 className="topbar__title">{t("app.title")}</h1>
          </div>
          <div className="topbar__meta">
            {ds?.platform && (
              <span className="topbar__platform-badge" title={`${ds.platform.deployment_kind} / ${ds.platform.trust_zone}`}>
                {ds.platform.trust_zone === "private" ? "🔒" : "🌐"} {ds.platform.execution_target}
              </span>
            )}
            {ds?.observability && (
              <span
                className={`topbar__health-dot topbar__health-dot--${
                  ds.observability.error_rate.rate === 0 ? "ok"
                    : ds.observability.error_rate.rate < 0.1 ? "warn"
                    : "err"
                }`}
                title={`${t("overview.error_rate")}: ${(ds.observability.error_rate.rate * 100).toFixed(1)}%`}
              />
            )}
            <button
              className="btn btn--xs topbar__theme-btn"
              onClick={toggle_theme}
              aria-label={t("sidebar.toggle_theme")}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            <button
              className="btn btn--xs topbar__locale-btn"
              onClick={toggle_locale}
              aria-label={t("sidebar.toggle_language")}
            >
              {locale === "en" ? t("sidebar.locale_ko") : t("sidebar.locale_en")}
            </button>
            <span
              className={`topbar__conn topbar__conn--${sse_stale ? "stale" : connection}`}
              title={sse_stale ? t("conn.stale_hint") : undefined}
            >
              {sse_stale ? t("conn.stale") : t(`conn.${connection}`)}
            </span>
          </div>
        </header>
        <main className="app__content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
