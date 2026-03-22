/**
 * UserCard — 사이드바 하단에 고정되는 사용자 프로필 카드.
 * 팀 정보, 역할 badge, 팀 전환, 로그아웃 기능을 포함한다.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStatus, useAuthUser, useLogout, useMyTeams, useSwitchTeam } from "../hooks/use-auth";
import { useClickOutside } from "../hooks/use-click-outside";
import { useI18n } from "../i18n";
import { useToast } from "./toast";
import { api } from "../api/client";

export function UserCard() {
  const { t } = useI18n();
  const { toast } = useToast();

  const { data: auth_status } = useAuthStatus();
  const { data: auth_user } = useAuthUser();
  const logout = useLogout();
  const { data: my_teams = [] } = useMyTeams();
  const switch_team = useSwitchTeam();

  const [team_menu_open, set_team_menu_open] = useState(false);
  const [profile_open, set_profile_open] = useState(false);
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

      {/* 프로필 편집 + 로그아웃 */}
      <div className="user-card__actions">
        <button
          className="btn btn--xs"
          onClick={() => set_profile_open(true)}
          aria-label={t("user_card.profile")}
        >
          {t("user_card.profile")}
        </button>
        <button
          className="btn btn--xs user-card__logout-btn"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label={t("user_card.logout")}
        >
          {t("user_card.logout")}
        </button>
      </div>

      {profile_open && (
        <ProfileEditPanel
          username={auth_user.username}
          onClose={() => set_profile_open(false)}
        />
      )}
    </div>
  );
}

function ProfileEditPanel({ username, onClose }: { username: string; onClose: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [current_pw, set_current_pw] = useState("");
  const [new_pw, set_new_pw] = useState("");

  const change_pw = useMutation({
    mutationFn: () => api.patch("/api/auth/me/password", { current_password: current_pw, new_password: new_pw }),
    onSuccess: () => { toast(t("user_card.pw_changed"), "ok"); onClose(); },
    onError: (err: unknown) => {
      const code = (err as { body?: { error?: string } })?.body?.error;
      toast(code === "wrong_password" ? t("user_card.wrong_pw") : t("user_card.pw_change_failed"), "err");
    },
  });

  return (
    <div className="user-card__profile-panel">
      <div className="user-card__profile-header">
        <span className="fw-600">{username}</span>
        <button className="btn btn--xs" onClick={onClose}>{t("common.cancel")}</button>
      </div>
      <div className="user-card__profile-form">
        <input
          className="form-input"
          type="password"
          placeholder={t("user_card.current_pw")}
          value={current_pw}
          onChange={(e) => set_current_pw(e.target.value)}
        />
        <input
          className="form-input"
          type="password"
          placeholder={t("user_card.new_pw")}
          value={new_pw}
          onChange={(e) => set_new_pw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && new_pw.length >= 6) change_pw.mutate(); }}
        />
        <button
          className="btn btn--sm btn--ok"
          disabled={!current_pw || new_pw.length < 6 || change_pw.isPending}
          onClick={() => change_pw.mutate()}
        >
          {change_pw.isPending ? t("common.saving") : t("user_card.change_pw")}
        </button>
      </div>
    </div>
  );
}
