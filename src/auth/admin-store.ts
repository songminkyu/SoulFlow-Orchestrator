/**
 * AdminStore — 전역 admin.db 관리.
 * users 테이블, shared_providers 테이블, settings 테이블(jwt_secret 등)을 담당.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { with_sqlite, with_sqlite_strict, type SqlitePool, type SqliteRunOptions } from "../utils/sqlite-helper.js";

const PRAGMAS = ["journal_mode=WAL"];

const INIT_SQL = `
  PRAGMA journal_mode=WAL;

  CREATE TABLE IF NOT EXISTS teams (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    username            TEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    system_role         TEXT NOT NULL DEFAULT 'user',
    default_team_id     TEXT REFERENCES teams(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at       TEXT,
    disabled_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS shared_providers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    model       TEXT NOT NULL DEFAULT '',
    config_json TEXT NOT NULL DEFAULT '{}',
    api_key_ref TEXT NOT NULL,
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    at          TEXT NOT NULL DEFAULT (datetime('now')),
    actor_id    TEXT,
    action      TEXT NOT NULL,
    target_id   TEXT,
    detail_json TEXT
  );
`;

export interface UserRecord {
  id: string;
  username: string;
  password_hash: string;
  system_role: "superadmin" | "user";
  default_team_id: string | null;
  created_at: string;
  last_login_at: string | null;
  disabled_at: string | null;
  /** H-7: 마지막 비밀번호 변경 시각 (ISO 8601). null이면 레거시 계정(토큰 허용). */
  password_changed_at: string | null;
}

export interface TeamRecord {
  id: string;
  name: string;
  created_at: string;
}

export interface SharedProviderRecord {
  id: string;
  name: string;
  type: string;
  model: string;
  config: Record<string, unknown>;
  api_key_ref: string;
  enabled: boolean;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  at: string;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  detail_json: string | null;
}

interface TeamRow { id: string; name: string; created_at: string; }

interface UserRow {
  id: string; username: string; password_hash: string; system_role: string;
  default_team_id: string | null; created_at: string;
  last_login_at: string | null; disabled_at: string | null;
  /** H-7: 비밀번호 변경 시각 — 마이그레이션 전 행에는 undefined가 될 수 있음. */
  password_changed_at?: string | null;
}

interface SharedProviderRow {
  id: string; name: string; type: string; model: string;
  config_json: string; api_key_ref: string; enabled: number; created_at: string;
}

function row_to_team(r: TeamRow): TeamRecord {
  return { id: r.id, name: r.name, created_at: r.created_at };
}

function row_to_user(r: UserRow): UserRecord {
  return {
    ...r,
    system_role: r.system_role as "superadmin" | "user",
    // H-7: undefined(마이그레이션 전 행)를 null로 정규화
    password_changed_at: r.password_changed_at ?? null,
  };
}

function row_to_shared_provider(r: SharedProviderRow): SharedProviderRecord {
  return {
    id: r.id, name: r.name, type: r.type, model: r.model,
    config: JSON.parse(r.config_json) as Record<string, unknown>,
    api_key_ref: r.api_key_ref, enabled: r.enabled === 1, created_at: r.created_at,
  };
}

export class AdminStore {
  private readonly db_path: string;
  private readonly pool: SqlitePool | null;

  constructor(db_path: string, pool?: SqlitePool) {
    this.db_path = db_path;
    this.pool = pool ?? null;
    mkdirSync(dirname(db_path), { recursive: true });
    this._db_strict((db) => { db.exec(INIT_SQL); return true; }, { pragmas: PRAGMAS });
    // H-7: 기존 DB에 password_changed_at 컬럼 추가 (SQLite는 ADD COLUMN IF NOT EXISTS 미지원 → try/catch)
    try {
      this._db_strict((db) => {
        db.exec("ALTER TABLE users ADD COLUMN password_changed_at TEXT");
        return true;
      }, { pragmas: PRAGMAS });
    } catch {
      // 이미 컬럼이 존재하면 무시 (정상)
    }
  }

  /** pool이 있으면 풀 연결, 없으면 기존 open-per-call. */
  private _db<T>(run: (db: import("../utils/sqlite-helper.js").DatabaseSync) => T, options?: SqliteRunOptions): T | null {
    return this.pool ? this.pool.run(this.db_path, run, options) : with_sqlite(this.db_path, run, options);
  }
  private _db_strict<T>(run: (db: import("../utils/sqlite-helper.js").DatabaseSync) => T, options?: SqliteRunOptions): T {
    return this.pool ? this.pool.run_strict(this.db_path, run, options) : with_sqlite_strict(this.db_path, run, options);
  }

  // ── 초기화 여부 ──

  is_initialized(): boolean {
    return this._db((db) => {
      const row = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE system_role = 'superadmin'").get() as { cnt: number };
      return row.cnt > 0;
    }, { pragmas: PRAGMAS }) ?? false;
  }

  // ── 설정 (jwt_secret 등) ──

  get_setting(key: string): string | null {
    return this._db((db) => {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
      return row?.value ?? null;
    }, { pragmas: PRAGMAS }) ?? null;
  }

  set_setting(key: string, value: string): void {
    this._db_strict((db) => {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .run(key, value);
      return true;
    }, { pragmas: PRAGMAS });
  }

  // ── 사용자 ──

  list_users(): UserRecord[] {
    return this._db((db) => {
      return (db.prepare("SELECT * FROM users ORDER BY created_at").all() as UserRow[]).map(row_to_user);
    }, { pragmas: PRAGMAS }) ?? [];
  }

  get_user_by_id(id: string): UserRecord | null {
    return this._db((db) => {
      const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
      return row ? row_to_user(row) : null;
    }, { pragmas: PRAGMAS }) ?? null;
  }

  get_user_by_username(username: string): UserRecord | null {
    return this._db((db) => {
      const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
      return row ? row_to_user(row) : null;
    }, { pragmas: PRAGMAS }) ?? null;
  }

  /**
   * H-7: 사용자의 마지막 비밀번호 변경 시각을 조회한다.
   * 레거시 계정(컬럼 값 없음)은 null 반환 — 하위 호환성을 위해 토큰 허용.
   */
  get_password_changed_at(user_id: string): string | null {
    return this._db((db) => {
      const row = db.prepare("SELECT password_changed_at FROM users WHERE id = ?").get(user_id) as { password_changed_at: string | null } | undefined;
      return row?.password_changed_at ?? null;
    }, { pragmas: PRAGMAS }) ?? null;
  }

  create_user(input: {
    username: string;
    password_hash: string;
    system_role: "superadmin" | "user";
    default_team_id?: string | null;
  }): UserRecord {
    const id = randomUUID();
    this._db_strict((db) => {
      db.prepare(
        "INSERT INTO users (id, username, password_hash, system_role, default_team_id) VALUES (?, ?, ?, ?, ?)"
      ).run(id, input.username, input.password_hash, input.system_role, input.default_team_id ?? null);
      return true;
    }, { pragmas: PRAGMAS });
    return this.get_user_by_id(id)!;
  }

  update_user(id: string, patch: Partial<Pick<UserRecord, "password_hash" | "system_role" | "last_login_at" | "default_team_id" | "disabled_at" | "password_changed_at">>): boolean {
    const user = this.get_user_by_id(id);
    if (!user) return false;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.password_hash !== undefined) { fields.push("password_hash = ?"); values.push(patch.password_hash); }
    if (patch.system_role !== undefined) { fields.push("system_role = ?"); values.push(patch.system_role); }
    if (patch.last_login_at !== undefined) { fields.push("last_login_at = ?"); values.push(patch.last_login_at); }
    if (patch.default_team_id !== undefined) { fields.push("default_team_id = ?"); values.push(patch.default_team_id); }
    if (patch.disabled_at !== undefined) { fields.push("disabled_at = ?"); values.push(patch.disabled_at); }
    if (patch.password_changed_at !== undefined) { fields.push("password_changed_at = ?"); values.push(patch.password_changed_at); }
    if (fields.length === 0) return true;
    values.push(id);
    this._db_strict((db) => {
      db.prepare(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`).run(...values);
      return true;
    }, { pragmas: PRAGMAS });
    return true;
  }

  delete_user(id: string, actor_id?: string): boolean {
    const deleted = this._db_strict((db) => {
      const r = db.prepare("DELETE FROM users WHERE id = ?").run(id);
      return r.changes > 0;
    }, { pragmas: PRAGMAS });
    if (deleted) {
      this.log_audit({ actor_id: actor_id ?? null, action: "user.delete", target_id: id });
    }
    return deleted;
  }

  // ── 감사 로그 ──

  /** SOC2 CC6.2: 감사 이벤트를 audit_log 테이블에 기록한다. */
  log_audit(entry: { actor_id: string | null; action: string; target_id?: string | null; detail?: Record<string, unknown> | null }): void {
    this._db_strict((db) => {
      db.prepare(
        "INSERT INTO audit_log (actor_id, action, target_id, detail_json) VALUES (?, ?, ?, ?)"
      ).run(
        entry.actor_id ?? null,
        entry.action,
        entry.target_id ?? null,
        entry.detail ? JSON.stringify(entry.detail) : null,
      );
      return true;
    }, { pragmas: PRAGMAS });
  }

  /** 감사 로그 최신 항목 조회 (기본 50개). */
  get_audit_log(limit = 50): AuditLogEntry[] {
    return this._db((db) => {
      return db.prepare(
        "SELECT id, at, actor_id, action, target_id, detail_json FROM audit_log ORDER BY id DESC LIMIT ?"
      ).all(limit) as AuditLogEntry[];
    }, { pragmas: PRAGMAS }) ?? [];
  }

  // ── 팀 ──

  list_teams(): TeamRecord[] {
    return this._db((db) => {
      return (db.prepare("SELECT * FROM teams ORDER BY created_at").all() as TeamRow[]).map(row_to_team);
    }, { pragmas: PRAGMAS }) ?? [];
  }

  get_team(id: string): TeamRecord | null {
    return this._db((db) => {
      const row = db.prepare("SELECT * FROM teams WHERE id = ?").get(id) as TeamRow | undefined;
      return row ? row_to_team(row) : null;
    }, { pragmas: PRAGMAS }) ?? null;
  }

  ensure_team(id: string, name: string): TeamRecord {
    this._db_strict((db) => {
      db.prepare("INSERT INTO teams (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING").run(id, name);
      return true;
    }, { pragmas: PRAGMAS });
    return this.get_team(id)!;
  }

  update_team(id: string, patch: { name: string }): TeamRecord | null {
    this._db_strict((db) => {
      db.prepare("UPDATE teams SET name = ? WHERE id = ?").run(patch.name, id);
      return true;
    }, { pragmas: PRAGMAS });
    return this.get_team(id);
  }

  delete_team(id: string): boolean {
    return this._db_strict((db) => {
      const info = db.prepare("DELETE FROM teams WHERE id = ?").run(id);
      return (info.changes ?? 0) > 0;
    }, { pragmas: PRAGMAS }) ?? false;
  }

  // ── 공유 프로바이더 ──

  list_shared_providers(enabled_only = false): SharedProviderRecord[] {
    return this._db((db) => {
      const sql = enabled_only
        ? "SELECT * FROM shared_providers WHERE enabled = 1 ORDER BY created_at"
        : "SELECT * FROM shared_providers ORDER BY created_at";
      return (db.prepare(sql).all() as SharedProviderRow[]).map(row_to_shared_provider);
    }, { pragmas: PRAGMAS }) ?? [];
  }

  get_shared_provider(id: string): SharedProviderRecord | null {
    return this._db((db) => {
      const row = db.prepare("SELECT * FROM shared_providers WHERE id = ?").get(id) as SharedProviderRow | undefined;
      return row ? row_to_shared_provider(row) : null;
    }, { pragmas: PRAGMAS }) ?? null;
  }

  create_shared_provider(input: Omit<SharedProviderRecord, "id" | "created_at">): SharedProviderRecord {
    const id = randomUUID();
    this._db_strict((db) => {
      db.prepare(
        "INSERT INTO shared_providers (id, name, type, model, config_json, api_key_ref, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(id, input.name, input.type, input.model, JSON.stringify(input.config), input.api_key_ref, input.enabled ? 1 : 0);
      return true;
    }, { pragmas: PRAGMAS });
    return this.get_shared_provider(id)!;
  }

  update_shared_provider(id: string, patch: Partial<Pick<SharedProviderRecord, "name" | "model" | "config" | "enabled">>): boolean {
    if (!this.get_shared_provider(id)) return false;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name !== undefined) { fields.push("name = ?"); values.push(patch.name); }
    if (patch.model !== undefined) { fields.push("model = ?"); values.push(patch.model); }
    if (patch.config !== undefined) { fields.push("config_json = ?"); values.push(JSON.stringify(patch.config)); }
    if (patch.enabled !== undefined) { fields.push("enabled = ?"); values.push(patch.enabled ? 1 : 0); }
    if (fields.length === 0) return true;
    values.push(id);
    this._db_strict((db) => {
      db.prepare(`UPDATE shared_providers SET ${fields.join(", ")} WHERE id = ?`).run(...values);
      return true;
    }, { pragmas: PRAGMAS });
    return true;
  }

  delete_shared_provider(id: string): boolean {
    return this._db_strict((db) => {
      const r = db.prepare("DELETE FROM shared_providers WHERE id = ?").run(id);
      return r.changes > 0;
    }, { pragmas: PRAGMAS });
  }
}
