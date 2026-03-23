import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { ApiSecuritySummary } from "../../api/contracts";
import { Badge } from "../../components/badge";
import { SectionHeader } from "../../components/section-header";
import { SurfaceGuard } from "../../components/surface-guard";
import { StatusView } from "../../components/status-contract";
import { VisibilityBadge } from "../../components/visibility-badge";
import { useToast } from "../../components/toast";
import { useConfirm } from "../../components/modal";
import {
  useAuthUser, useAdminUsers, useAdminTeams, useTeamMembers,
  useAddTeamMember, useRemoveTeamMember, useUpdateTeamMemberRole,
  useUpdateTeam, useDeleteTeam,
  type AdminUserRecord, type TeamRole,
} from "../../hooks/use-auth";
import { useResourceCRUD } from "../../hooks/use-resource-crud";
import { useToggleMutation } from "../../hooks/use-toggle-mutation";
import type { ChannelInstance } from "../channels/types";
import { MonitoringPanel } from "./monitoring-panel";
import { useT } from "../../i18n";
import { POLL_FAST_MS } from "../../utils/constants";

type AdminTab = "teams" | "users" | "providers" | "channels" | "monitoring" | "security";

const TAB_IDS: AdminTab[] = ["teams", "users", "providers", "channels", "monitoring", "security"];
const TAB_KEYS: Record<AdminTab, string> = {
  teams: "admin.tab.teams",
  users: "admin.tab.users",
  providers: "admin.tab.providers",
  channels: "admin.tab.channels",
  monitoring: "admin.tab.monitoring",
  security: "admin.tab.security",
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { data: auth_user, isLoading, isError, refetch } = useAuthUser();
  const [tab, setTab] = useState<AdminTab>("teams");
  const t = useT();

  useEffect(() => {
    if (isLoading) return;
    if (!auth_user || auth_user.role !== "superadmin") navigate("/", { replace: true });
  }, [auth_user, isLoading, navigate]);

  const viewStatus = isLoading ? "loading" as const
    : isError ? "error" as const
    : !auth_user ? "loading" as const
    : "success" as const;

  return (
    <SurfaceGuard requiredTier="operator" fallback={<div className="page"><p>{t("common.access_denied")}</p></div>}>
      <div className="page" data-testid="admin-page">
        <SectionHeader title={t("admin.title")}>
          <VisibilityBadge tier="operator" />
        </SectionHeader>

        <StatusView status={viewStatus} onRetry={() => void refetch()}>
          <div className="settings__filters" role="tablist">
            {TAB_IDS.map((id) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                className={`btn btn--sm ${tab === id ? "btn--primary" : ""}`}
                onClick={() => setTab(id)}
              >
                {t(TAB_KEYS[id])}
              </button>
            ))}
          </div>

          {tab === "teams" && <TeamsPanel />}
          {tab === "users" && <UsersPanel />}
          {tab === "providers" && <GlobalProvidersPanel />}
          {tab === "channels" && <ChannelsPanel />}
          {tab === "monitoring" && <MonitoringPanel />}
          {tab === "security" && <SecurityPanel />}
        </StatusView>
      </div>
    </SurfaceGuard>
  );
}

// ── Teams Panel ───────────────────────────────────────────────────────────────

function TeamsPanel() {
  const t = useT();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm: modal_confirm, dialog: confirm_dialog } = useConfirm();
  const { data: teams = [], isLoading } = useAdminTeams();
  const [form, setForm] = useState({ open: false, id: "", name: "" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rename_target, set_rename_target] = useState<string | null>(null);
  const [rename_draft, set_rename_draft] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/teams", { id: form.id.trim(), name: form.name.trim() }),
    onSuccess: () => {
      toast(t("admin.teams.created"), "ok");
      setForm({ open: false, id: "", name: "" });
      void qc.invalidateQueries({ queryKey: ["admin-teams"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { body?: { error?: string } })?.body?.error;
      toast(msg === "id_must_be_lowercase_alphanumeric_hyphen" ? t("admin.teams.id_invalid") : t("admin.teams.create_failed"), "err");
    },
  });

  const update_team = useUpdateTeam();
  const delete_team = useDeleteTeam();

  const start_rename = (team: { id: string; name: string }) => {
    set_rename_target(team.id);
    set_rename_draft(team.name);
  };

  const commit_rename = (id: string) => {
    if (!rename_draft.trim()) return;
    update_team.mutate({ id, name: rename_draft.trim() }, {
      onSuccess: () => { toast(t("admin.teams.renamed"), "ok"); set_rename_target(null); },
      onError: () => toast(t("admin.teams.rename_failed"), "err"),
    });
  };

  const do_delete = (team: { id: string; name: string }) => {
    // PCH-U2: window.confirm → useConfirm 모달
    modal_confirm(t("admin.teams.delete_confirm", { name: team.name }), () => {
      delete_team.mutate(team.id, {
        onSuccess: () => toast(t("admin.teams.deleted"), "ok"),
        onError: () => toast(t("admin.teams.delete_failed"), "err"),
      });
    });
  };

  return (
    <section className="panel mb-3">
      <div className="net-row mb-3">
        <h2 className="m-0">{t("admin.teams.title")}</h2>
        <button className="btn btn--sm btn--primary" onClick={() => setForm((f) => ({ ...f, open: !f.open }))}>
          {form.open ? t("common.cancel") : t("admin.teams.add")}
        </button>
      </div>

      {form.open && (
        <div className="panel panel--inset mb-2">
          <div className="li-flex li-flex--wrap">
            <input
              className="form-input" style={{ flex: "1 1 120px" }}
              placeholder={t("admin.teams.id_placeholder")} value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            />
            <input
              className="form-input" style={{ flex: "1 1 160px" }}
              placeholder={t("admin.teams.name_placeholder")} value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <button
              className="btn btn--sm btn--ok"
              disabled={!form.id || !form.name || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? t("admin.teams.creating") : t("admin.teams.create")}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="skeleton skeleton--row" />
      ) : (
        <div className="users-list">
          {teams.map((team) => (
            <div key={team.id}>
              <div className="users-list__item li-flex">
                <div className="users-list__info flex-1">
                  {rename_target === team.id ? (
                    <div className="li-flex">
                      <input
                        className="form-input flex-1"
                        value={rename_draft}
                        onChange={(e) => set_rename_draft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit_rename(team.id);
                          if (e.key === "Escape") set_rename_target(null);
                        }}
                        autoFocus
                      />
                      <button className="btn btn--xs btn--ok" disabled={!rename_draft.trim() || update_team.isPending} onClick={() => commit_rename(team.id)}>{t("common.save")}</button>
                      <button className="btn btn--xs" onClick={() => set_rename_target(null)}>{t("common.cancel")}</button>
                    </div>
                  ) : (
                    <>
                      <span className="users-list__name">{team.name}</span>
                      <span className="text-xs text-muted">ID: {team.id}</span>
                      <Badge status={t("admin.teams.members_fmt", { count: String(team.member_count ?? 0) })} variant="info" />
                    </>
                  )}
                </div>
                {rename_target !== team.id && (
                  <div className="li-flex">
                    <button className="btn btn--xs" onClick={() => setExpanded((prev) => prev === team.id ? null : team.id)}>
                      {expanded === team.id ? t("admin.teams.collapse") : t("admin.teams.expand_members")}
                    </button>
                    <button className="btn btn--xs" onClick={() => start_rename(team)}>{t("admin.teams.rename")}</button>
                    <button
                      className="btn btn--xs btn--danger"
                      disabled={delete_team.isPending}
                      onClick={() => do_delete(team)}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                )}
              </div>
              {expanded === team.id && <TeamMembersList team_id={team.id} />}
            </div>
          ))}
          {teams.length === 0 && (
            <p className="text-xs text-muted py-2">{t("admin.teams.no_teams")}</p>
          )}
        </div>
      )}
      {confirm_dialog}
    </section>
  );
}

const ROLE_OPTIONS: TeamRole[] = ["owner", "manager", "member", "viewer"];
const ROLE_KEYS: Record<TeamRole, string> = { owner: "admin.role.owner", manager: "admin.role.manager", member: "admin.role.member", viewer: "admin.role.viewer" };

function TeamMembersList({ team_id }: { team_id: string }) {
  const t = useT();
  const { toast } = useToast();
  const { data: allUsers = [] } = useAdminUsers();
  const { data: members = [], isLoading } = useTeamMembers(team_id);
  const add = useAddTeamMember(team_id);
  const remove = useRemoveTeamMember(team_id);
  const update_role = useUpdateTeamMemberRole(team_id);
  const [addForm, setAddForm] = useState({ open: false, user_id: "", role: "member" as TeamRole });

  const memberIds = new Set(members.map((m) => m.user_id));
  const available = allUsers.filter((u) => !memberIds.has(u.id));

  const submit_add = () => {
    add.mutate({ user_id: addForm.user_id, role: addForm.role }, {
      onSuccess: () => { toast(t("admin.members.added"), "ok"); setAddForm({ open: false, user_id: "", role: "member" }); },
      onError: () => toast(t("admin.members.add_failed"), "err"),
    });
  };

  if (isLoading) return <div className="skeleton skeleton--row my-1" />;

  return (
    <div className="admin-members-body">
      {members.map((m) => (
        <div key={m.user_id} className="admin-member-row li-flex">
          <span className="admin-member-name">{m.username ?? m.user_id}</span>
          <select
            className="form-input admin-member-role-select flex-none"
            value={m.role}
            disabled={update_role.isPending}
            onChange={(e) => update_role.mutate({ user_id: m.user_id, role: e.target.value as TeamRole }, {
              onSuccess: () => toast(t("admin.members.role_changed"), "ok"),
              onError: () => toast(t("admin.members.role_change_failed"), "err"),
            })}
          >
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
          </select>
          {m.system_role === "superadmin" && <Badge status="superadmin" variant="warn" />}
          <button
            className="btn btn--xs btn--danger ml-auto"
            disabled={remove.isPending}
            onClick={() => remove.mutate(m.user_id, {
              onSuccess: () => toast(t("admin.members.removed"), "ok"),
              onError: () => toast(t("admin.members.remove_failed"), "err"),
            })}
          >
            {t("admin.members.remove")}
          </button>
        </div>
      ))}
      {members.length === 0 && <p className="text-xs text-muted">{t("admin.members.no_members")}</p>}

      {addForm.open ? (
        <div className="li-flex li-flex--wrap mt-1">
          <select className="form-input" style={{ flex: "1 1 140px" }} value={addForm.user_id}
            onChange={(e) => setAddForm((f) => ({ ...f, user_id: e.target.value }))}>
            <option value="">{t("admin.members.select_user")}</option>
            {available.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
          <select className="form-input flex-none" value={addForm.role}
            onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as TeamRole }))}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{t(ROLE_KEYS[r])}</option>)}
          </select>
          <button className="btn btn--xs btn--ok" disabled={!addForm.user_id || add.isPending} onClick={submit_add}>{t("common.save")}</button>
          <button className="btn btn--xs" onClick={() => setAddForm((f) => ({ ...f, open: false }))}>{t("common.cancel")}</button>
        </div>
      ) : (
        <button className="btn btn--xs mt-1"
          onClick={() => setAddForm((f) => ({ ...f, open: true }))}>
          {t("admin.members.add_member")}
        </button>
      )}
    </div>
  );
}

// ── Users Panel ───────────────────────────────────────────────────────────────

function UsersPanel() {
  const t = useT();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm: modal_confirm, dialog: confirm_dialog } = useConfirm();
  const { data: users = [], isLoading } = useAdminUsers();
  const { data: teams = [] } = useAdminTeams();
  const [form, setForm] = useState<{ open: boolean; username: string; password: string; role: "user" | "superadmin"; team_id: string }>({
    open: false, username: "", password: "", role: "user", team_id: "",
  });
  const [pw_target, setPwTarget] = useState<AdminUserRecord | null>(null);
  const [new_pw, setNewPw] = useState("");
  const [tm_target, setTmTarget] = useState<AdminUserRecord | null>(null);
  const [new_team, setNewTeam] = useState("");

  const create = useMutation({
    mutationFn: () => api.post("/api/admin/users", {
      username: form.username.trim(), password: form.password, role: form.role,
      team_id: form.team_id || null,
    }),
    onSuccess: () => {
      toast(t("admin.users.created"), "ok");
      setForm({ open: false, username: "", password: "", role: "user", team_id: "" });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-teams"] });
    },
    onError: (e: unknown) => {
      const msg = (e as { body?: { error?: string } })?.body?.error;
      toast(msg === "username_taken" ? t("admin.users.username_taken") : t("admin.users.create_failed"), "err");
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/users/${id}`),
    onSuccess: () => {
      toast(t("admin.users.deleted"), "ok");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-teams"] });
    },
    onError: () => toast(t("admin.users.delete_failed"), "err"),
  });

  const change_pw = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/users/${id}/password`, { password: new_pw }),
    onSuccess: () => { toast(t("admin.users.pw_changed"), "ok"); setPwTarget(null); setNewPw(""); },
    onError: () => toast(t("admin.users.pw_change_failed"), "err"),
  });

  const change_team = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/users/${id}/team`, { team_id: new_team }),
    onSuccess: () => {
      toast(t("admin.users.team_changed"), "ok");
      setTmTarget(null); setNewTeam("");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-teams"] });
    },
    onError: () => toast(t("admin.users.team_change_failed"), "err"),
  });

  const team_name = (id: string | null) => teams.find((tm) => tm.id === id)?.name ?? id ?? "—";

  return (
    <section className="panel mb-3">
      <div className="net-row mb-3">
        <h2 className="m-0">{t("admin.users.title")}</h2>
        <button className="btn btn--sm btn--primary" onClick={() => setForm((f) => ({ ...f, open: !f.open }))}>
          {form.open ? t("common.cancel") : t("admin.users.add")}
        </button>
      </div>

      {form.open && (
        <div className="panel panel--inset mb-2">
          <div className="li-flex li-flex--wrap">
            <input
              className="form-input" style={{ flex: "1 1 120px" }}
              placeholder={t("admin.users.username_placeholder")} value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            />
            <input
              className="form-input" style={{ flex: "1 1 120px" }}
              type="password" placeholder={t("admin.users.password_placeholder")} value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            />
            <select
              className="form-input" style={{ flex: "0 0 110px" }}
              value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "user" | "superadmin" }))}
            >
              <option value="user">user</option>
              <option value="superadmin">superadmin</option>
            </select>
            {teams.length > 0 && (
              <select
                className="form-input" style={{ flex: "0 0 130px" }}
                value={form.team_id} onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
              >
                <option value="">{t("admin.users.no_team")}</option>
                {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
              </select>
            )}
            <button
              className="btn btn--sm btn--ok"
              disabled={!form.username || form.password.length < 6 || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? t("admin.teams.creating") : t("admin.teams.create")}
            </button>
          </div>
        </div>
      )}

      {pw_target && (
        <div className="panel panel--inset mb-2">
          <div className="li-flex li-flex--g8">
            <span className="text-xs text-muted">{t("admin.users.pw_change_label", { username: pw_target.username })}</span>
            <input
              className="form-input flex-1"
              type="password" placeholder={t("admin.users.new_pw_placeholder")} value={new_pw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button
              className="btn btn--sm btn--ok"
              disabled={new_pw.length < 6 || change_pw.isPending}
              onClick={() => change_pw.mutate(pw_target.id)}
            >{t("common.save")}</button>
            <button className="btn btn--sm" onClick={() => { setPwTarget(null); setNewPw(""); }}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {tm_target && (
        <div className="panel panel--inset mb-2">
          <div className="li-flex li-flex--g8">
            <span className="text-xs text-muted">{t("admin.users.team_change_label", { username: tm_target.username })}</span>
            <select
              className="form-input flex-1"
              value={new_team} onChange={(e) => setNewTeam(e.target.value)}
            >
              <option value="">{t("admin.users.select_team")}</option>
              {teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
            </select>
            <button
              className="btn btn--sm btn--ok"
              disabled={!new_team || change_team.isPending}
              onClick={() => change_team.mutate(tm_target.id)}
            >{t("common.save")}</button>
            <button className="btn btn--sm" onClick={() => { setTmTarget(null); setNewTeam(""); }}>{t("common.cancel")}</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="skeleton skeleton--row" />
      ) : (
        <div className="users-list">
          {users.map((u) => (
            <div key={u.id} className="users-list__item li-flex">
              <div className="users-list__info">
                <span className="users-list__name">{u.username}</span>
                <Badge status={u.system_role} variant={u.system_role === "superadmin" ? "warn" : "info"} />
                {u.default_team_id && (
                  <Badge status={team_name(u.default_team_id)} variant="info" />
                )}
                {u.session_count != null && u.session_count > 0 && (
                  <Badge status={`${u.session_count} sessions`} variant="ok" />
                )}
                {u.last_login_at && (
                  <span className="text-xs text-muted">{t("admin.users.last_login")} {new Date(u.last_login_at).toLocaleDateString()}</span>
                )}
              </div>
              <div className="li-flex">
                {teams.length > 0 && (
                  <button className="btn btn--xs" onClick={() => { setTmTarget(u); setNewTeam(u.default_team_id ?? ""); }}>
                    {t("admin.users.team_btn")}
                  </button>
                )}
                <button className="btn btn--xs" onClick={() => { setPwTarget(u); setNewPw(""); }}>
                  {t("admin.users.pw_btn")}
                </button>
                <button
                  className="btn btn--xs btn--danger"
                  disabled={del.isPending}
                  onClick={() => modal_confirm(t("admin.users.delete_confirm", { username: u.username }), () => del.mutate(u.id))}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirm_dialog}
    </section>
  );
}

// ── Global Providers Panel ────────────────────────────────────────────────────

function GlobalProvidersPanel() {
  const t = useT();
  return (
    <section className="panel mb-3">
      <div className="mb-3">
        <h2 className="m-0">{t("admin.providers.title")}</h2>
        <p className="text-xs text-muted mt-1">{t("admin.providers.description")}</p>
      </div>
      <NavLink to="/providers" className="btn btn--sm btn--primary">
        {t("admin.providers.link")}
      </NavLink>
    </section>
  );
}
// ── Channels Panel ────────────────────────────────────────────────────────────

function ChannelsPanel() {
  const t = useT();
  const { toast } = useToast();

  const { items: instances, isLoading } = useResourceCRUD<ChannelInstance>({
    queryKey: ["channel-instances"],
    queryFn: () => api.get("/api/channels/instances"),
    deleteEndpoint: (id) => `/api/channels/instances/${encodeURIComponent(id)}`,
    onDeleteSuccess: () => toast(t("admin.channels.deleted"), "ok"),
    onDeleteError: (err) => toast(t("admin.channels.delete_failed_fmt", { error: err.message }), "err"),
    refetchInterval: POLL_FAST_MS,
    staleTime: 10_000,
  });

  const toggle_enabled = useToggleMutation<ChannelInstance>({
    queryKey: ["channel-instances"],
    getEndpoint: (id) => `/api/channels/instances/${encodeURIComponent(id)}`,
    idField: "instance_id",
    toggleField: "enabled",
    getErrMsg: (err) => t("admin.channels.save_failed_fmt", { error: err.message }),
  });

  const TYPE_LABELS: Record<string, string> = {
    slack: "Slack", discord: "Discord", telegram: "Telegram",
    line: "LINE", kakaotalk: "KakaoTalk",
  };

  return (
    <section className="panel mb-3">
      <div className="mb-3">
        <h2 className="m-0">{t("admin.channels.title")}</h2>
        <p className="text-xs text-muted mt-1">{t("admin.channels.description")}</p>
      </div>

      {isLoading ? (
        <div className="skeleton skeleton--row" />
      ) : (
        <div className="users-list">
          {instances.map((ch) => (
            <div key={ch.instance_id} className="users-list__item li-flex">
              <div className="users-list__info">
                <span className="users-list__name">{ch.label || ch.instance_id}</span>
                <Badge status={TYPE_LABELS[ch.provider] ?? ch.provider} variant="info" />
                {ch.enabled ? (
                  <Badge status={t("admin.channels.active")} variant="ok" />
                ) : (
                  <Badge status={t("admin.channels.inactive")} variant="warn" />
                )}
              </div>
              <div className="li-flex">
                <button
                  className="btn btn--xs"
                  disabled={toggle_enabled.isPending}
                  onClick={() => toggle_enabled.mutate({ id: ch.instance_id, value: !ch.enabled })}
                >
                  {ch.enabled ? t("admin.channels.deactivate") : t("admin.channels.activate")}
                </button>
              </div>
            </div>
          ))}
          {instances.length === 0 && (
            <p className="text-xs text-muted py-2">{t("admin.channels.no_channels")}</p>
          )}
        </div>
      )}
    </section>
  );
}

// -- Security Panel ────────────────────────────────────────────────────────────

function SecurityPanel() {
  const t = useT();
  const { data: status, isLoading, isError, refetch } = useQuery<ApiSecuritySummary>({
    queryKey: ["admin-security-summary"],
    queryFn: () => api.get("/api/admin/security/summary"),
    staleTime: 15_000,
    refetchInterval: POLL_FAST_MS,
  });

  const viewStatus = isLoading ? "loading" as const
    : isError ? "error" as const
    : !status ? "empty" as const
    : "success" as const;

  return (
    <StatusView status={viewStatus} onRetry={() => void refetch()} emptyMessage={t("admin.security_summary")}>
      {status && (
        <div data-testid="security-panel">
          {/* Security Regression Summary */}
          <section className="panel mb-3">
            <SectionHeader title={t("admin.security_summary")} />
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-card__value">{status.security_regressions}</div>
                <div className="stat-card__label">{t("admin.security_regressions")}</div>
              </div>
            </div>
          </section>

          {/* Webhook Status + Trust Zone */}
          <section className="panel mb-3">
            <SectionHeader title={t("admin.webhook_status")} />
            <div className="grid-stack">
              <div className="kv mt-0 mb-0">
                <Badge
                  status={status.webhook_secret_set ? t("admin.webhook_secret_set") : t("admin.webhook_secret_missing")}
                  variant={status.webhook_secret_set ? "ok" : "err"}
                />
                <span className="text-xs text-muted">{t("admin.webhook_status")}</span>
              </div>
              <div className="kv mt-0 mb-0">
                <Badge status={status.trust_zone} variant={status.trust_zone === "internal" ? "ok" : "warn"} />
                <span className="text-xs text-muted">{t("admin.trust_zone")}</span>
              </div>
            </div>
          </section>

          {/* Latency + Failure Summary */}
          <section className="panel mb-3">
            <SectionHeader title={t("admin.latency_summary")} />
            <div className="stat-grid">
              {status.latency_p95_ms != null && (
                <div className="stat-card">
                  <div className="stat-card__value">{status.latency_p95_ms}<span className="text-xs text-muted"> ms</span></div>
                  <div className="stat-card__label">p95 {t("admin.latency_label")}</div>
                </div>
              )}
              {status.failure_rate != null && (
                <div className="stat-card">
                  <div className="stat-card__value">{(status.failure_rate * 100).toFixed(1)}%</div>
                  <div className="stat-card__label">{t("admin.failure_rate")}</div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </StatusView>
  );
}
