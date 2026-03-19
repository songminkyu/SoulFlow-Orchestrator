/**
 * UserCard — 사이드바 하단에 고정되는 사용자 프로필 카드.
 * 팀 정보, 역할 badge, 팀 전환, 로그아웃 기능을 포함한다.
 */
import { useRef, useState } from "react";
import { useAuthStatus, useAuthUser, useLogout, useMyTeams, useSwitchTeam } from "../hooks/use-auth";
import { useClickOutside } from "../hooks/use-click-outside";
import { useI18n } from "../i18n";
import { useToast } from "./toast";

export function UserCard() {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: auth_status } = useAuthStatus();
  const { data: auth_user } = useAuthUser();
  const logout = useLogout();
  const { data: my_teams = [] } = useMyTeams();
  const switch_team = useSwitchTeam();

  const [team_menu_open, set_team_menu_open] = useState(false);
  const team_menu_ref = useRef<HTMLDivElement>(null);
  useClickOutside(team_menu_ref, () => set_team_menu_open(false), team_menu_open);

  // auth 비활성 또는 미인증 — 표시 안 함
  if (!auth_status?.enabled || !auth_user) return null;

  const current_team = my_teams.find((tm) => tm.id === auth_user.tid);

  const handle_switch = (team_id: string) => {
    if (team_id === auth_user.tid) { set_team_menu_open(false); return; }
    switch_team.mutate(team_id, {
      onSuccess: () => set_team_menu_open(false),
      onError: (err) => {
        set_team_menu_open(false);
        const code = (err as { body?: { error?: string } })?.body?.error ?? "";
        const msg = code === "not_a_member" ? t("team.err_not_member")
          : code === "team_id_required" ? t("team.err_id_required")
          : t("team.err_switch_failed");
        toast(msg, "err");
      },
    });
  };

  return (
    <div className="user-card">
      {/* 사용자명 + 역할 badge */}
      <div className="user-card__identity">
        <span className="user-card__username" title={auth_user.role}>
          {auth_user.username}
        </span>
        {auth_user.team_role && (
          <span
            className="user-card__role-badge"
            data-role={auth_user.team_role}
            aria-label={`${t("user_card.role")}: ${auth_user.team_role}`}
          >
            {auth_user.team_role}
          </span>
        )}
      </div>

      {/* 팀 전환 드롭다운 */}
      {auth_user.tid && (
        <div ref={team_menu_ref} className="user-card__team-switcher">
          <button
            className={`user-card__team-badge${switch_team.isPending ? " user-card__team-badge--pending" : ""}`}
            onClick={() => set_team_menu_open((o) => !o)}
            disabled={switch_team.isPending}
            aria-haspopup="listbox"
            aria-expanded={team_menu_open}
            aria-busy={switch_team.isPending}
            aria-label={t("user_card.switch_team")}
          >
            {switch_team.isPending
              ? t("team.switching")
              : <><span className="user-card__team-name">{current_team?.name ?? auth_user.tid}</span>{" \u25be"}</>
            }
          </button>
          {team_menu_open && (
            <div className="user-card__team-menu" role="listbox" aria-label={t("user_card.switch_team")}>
              {my_teams.map((tm) => (
                <button
                  key={tm.id}
                  className={`user-card__team-menu-item${tm.id === auth_user.tid ? " user-card__team-menu-item--active" : ""}`}
                  role="option"
                  aria-selected={tm.id === auth_user.tid}
                  disabled={switch_team.isPending}
                  onClick={() => handle_switch(tm.id)}
                >
                  <span>{tm.name || tm.id}</span>
                  <span className="user-card__team-role">{tm.role}</span>
                </button>
              ))}
              {my_teams.length === 0 && (
                <span className="user-card__team-menu-empty">{t("user_card.no_teams")}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 로그아웃 */}
      <button
        className="btn btn--xs user-card__logout-btn"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
        aria-label={t("user_card.logout")}
      >
        {t("user_card.logout")}
      </button>
    </div>
  );
}
