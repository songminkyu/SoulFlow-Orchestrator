import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDashboardStore } from "../store";
import { useI18n } from "../i18n";
import { useAuthUser, useAuthStatus } from "../hooks/use-auth";
import { UserCard } from "../components/user-card";
import { PAGE_POLICIES } from "../pages/access-policy";
import { tier_satisfied } from "../hooks/use-page-access";
import { api } from "../api/client";

type NavItem = { to: string; key: string; icon: string };
type NavGroup = { label_key: string; items: NavItem[] };

/**
 * 사이트맵 (docs/ko/design/improved/frontend-surface-integration):
 *  💬 채팅             ← 허브 (세션/메모리 흡수) + 대화 목록
 *  🔧 워크플로우       ← 빌더 + 칸반 + WBS + 크론
 *  🧪 프롬프팅 스튜디오 ← 에이전트/스킬/템플릿/도구/RAG
 *  🔌 연동             ← 채널, 프로바이더
 *  ⚙️ 시스템           ← 사용량, OAuth, 시크릿, 설정
 *  🛡️ 관리 (admin)    ← 팀/사용자/모니터링/보안
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label_key: "nav.group.chat",
    items: [
      { to: "/chat", key: "nav.chat", icon: "\ud83d\udcac" },
    ],
  },
  {
    label_key: "nav.group.workflow",
    items: [
      { to: "/workflows", key: "nav.workflows", icon: "\ud83d\udd27" },
      { to: "/kanban", key: "nav.kanban", icon: "\u25a3" },
      { to: "/wbs", key: "nav.wbs", icon: "\u2630" },
    ],
  },
  {
    label_key: "nav.group.prompting",
    items: [
      { to: "/prompting", key: "nav.prompting", icon: "\ud83e\uddea" },
    ],
  },
  {
    label_key: "nav.group.connect",
    items: [
      { to: "/channels", key: "nav.channels", icon: "\u21cc" },
      { to: "/providers", key: "nav.providers", icon: "\u2b21" },
    ],
  },
  {
    label_key: "nav.group.system",
    items: [
      { to: "/usage", key: "nav.usage", icon: "\u2261" },
      { to: "/oauth", key: "nav.oauth", icon: "\ud83d\udd11" },
      { to: "/secrets", key: "nav.secrets", icon: "\u26bf" },
      { to: "/settings", key: "nav.settings", icon: "\u229e" },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
const BOTTOM_NAV_KEYS = new Set(["/chat", "/workflows", "/prompting", "/settings"]);

type ChatSessionSummary = { id: string; name: string; updated_at: string };

export function Sidebar() {
  const collapsed = useDashboardStore((s) => s.sidebar_collapsed);
  const toggle = useDashboardStore((s) => s.toggle_sidebar);
  const open = useDashboardStore((s) => s.sidebar_open);
  const close = useDashboardStore((s) => s.close_sidebar);
  const { t } = useI18n();
  const { data: auth_user } = useAuthUser();
  const { data: auth_status } = useAuthStatus();
  const auth_enabled = auth_status?.enabled ?? false;
  const is_superadmin = auth_user?.role === "superadmin";
  const is_admin = is_superadmin;

  const can_view_route = (path: string) => {
    const policy = PAGE_POLICIES.find((p) => p.path === path);
    if (!policy) return true;
    return tier_satisfied(policy.view, auth_user, auth_enabled);
  };

  /** 대화 목록 — 채팅 그룹 하위에 표시 */
  const { data: recent_sessions = [] } = useQuery<ChatSessionSummary[]>({
    queryKey: ["sidebar-recent-chats"],
    queryFn: () => api.get("/api/chat/sessions"),
    staleTime: 15_000,
  });

  const cls = [
    "sidebar",
    collapsed ? "sidebar--collapsed" : "",
    open ? "sidebar--open" : "",
  ].filter(Boolean).join(" ");

  const handle_nav = () => {
    if (window.innerWidth <= 768) close();
  };

  return (
    <>
      <div
        className={`sidebar-backdrop ${open ? "sidebar-backdrop--visible" : ""}`}
        role="presentation"
        onClick={close}
      />
      <nav className={cls}>
        <div className="sidebar__header">
          {!collapsed && <span className="sidebar__title">{t("app.brand")}</span>}
          <button className="sidebar__toggle" onClick={toggle} aria-label={t(collapsed ? "sidebar.expand" : "sidebar.collapse")}>
            {collapsed ? "\u25b8" : "\u25c2"}
          </button>
        </div>

        <ul className="sidebar__nav">
          {NAV_GROUPS.map((group) => {
            const visible_items = group.items.filter((item) => can_view_route(item.to));
            if (visible_items.length === 0) return null;
            const is_chat_group = group.label_key === "nav.group.chat";
            return (
              <li key={group.label_key} className="sidebar__group">
                {!collapsed && <span className="sidebar__group-label">{t(group.label_key)}</span>}
                <ul className="sidebar__group-items">
                  {visible_items.map((item) => {
                    const label = t(item.key);
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === "/"}
                          className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}
                          onClick={handle_nav}
                        >
                          <span className="sidebar__icon" data-tooltip={label}>{item.icon}</span>
                          {!collapsed && <span className="sidebar__label">{label}</span>}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>

                {/* 대화 목록 — 채팅 그룹 하위 (사이트맵: 💬 채팅 └── 대화 목록) */}
                {is_chat_group && !collapsed && (
                  <div className="sidebar__chat-list-wrap">
                    {recent_sessions.length === 0 ? (
                      <span className="sidebar__empty-hint">{t("nav.no_chats_yet")}</span>
                    ) : (
                      <ul className="sidebar__chat-list">
                        {recent_sessions.slice(0, 8).map((s) => (
                          <li key={s.id}>
                            <NavLink
                              to={`/chat?session=${s.id}`}
                              className="sidebar__chat-item"
                              onClick={handle_nav}
                            >
                              {s.name || s.id.slice(0, 8)}
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}

          {/* 관리 (admin only) */}
          {is_admin && (
            <li className="sidebar__group">
              {!collapsed && <span className="sidebar__group-label">{t("nav.group.admin")}</span>}
              <ul className="sidebar__group-items">
                <li>
                  <NavLink
                    to="/admin"
                    className={({ isActive }) => `sidebar__link ${isActive ? "sidebar__link--active" : ""}`}
                    onClick={handle_nav}
                  >
                    <span className="sidebar__icon" data-tooltip={t("nav.admin")}>&#9872;</span>
                    {!collapsed && <span className="sidebar__label">{t("nav.admin")}</span>}
                  </NavLink>
                </li>
              </ul>
            </li>
          )}
        </ul>

        {/* 사이드바 하단: 사용자 프로필 + 팀 + 역할 badge + 팀 전환 */}
        <div className="sidebar__user-card">
          <UserCard />
        </div>
      </nav>
      <BottomNav />
    </>
  );
}

function BottomNav() {
  const { t } = useI18n();
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {ALL_NAV_ITEMS.filter((item) => BOTTOM_NAV_KEYS.has(item.to)).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) => `bottom-nav__item ${isActive ? "bottom-nav__item--active" : ""}`}
        >
          <span className="bottom-nav__icon">{item.icon}</span>
          <span className="bottom-nav__label">{t(item.key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
