/** 공유 SQLite 유틸리티 — open-per-call 패턴 + SqlitePool(연결 재사용). AP-2: 유일한 DB 진입점. */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { error_message } from "./common.js";

type DatabaseSync = Database.Database;
export type { DatabaseSync };

export type SqliteRunOptions = {
  /** 연결 후 실행할 PRAGMA 목록 (예: ["foreign_keys=ON"]) */
  pragmas?: string[];
  /** 읽기 전용 모드로 열기 */
  readonly?: boolean;
};

/**
 * DB 연결을 열고 반환. 호출자가 close() 책임.
 * ":memory:" 등 연결을 유지해야 하는 특수 케이스 전용.
 * 일반 파일 DB는 with_sqlite / with_sqlite_strict 사용.
 */
export function open_sqlite(
  db_path: string,
  options?: SqliteRunOptions,
): DatabaseSync {
  const db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
  if (options?.pragmas) {
    for (const p of options.pragmas) db.pragma(p);
  }
  return db;
}

/** DB를 열고 콜백 실행 후 닫는다. 에러 시 stderr 로깅 후 null. */
export function with_sqlite<T>(
  db_path: string,
  run: (db: DatabaseSync) => T,
  options?: SqliteRunOptions,
): T | null {
  let db: DatabaseSync | null = null;
  try {
    db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
    if (options?.pragmas) {
      for (const p of options.pragmas) db.pragma(p);
    }
    return run(db);
  } catch (err) {
    const msg = error_message(err);
    if (process.env.NODE_ENV !== "test") {
      process.stderr.write(`[sqlite] error at ${db_path}: ${msg}\n`);
    }
    return null;
  } finally {
    try { db?.close(); } catch { /* no-op */ }
  }
}

/** DB를 열고 콜백 실행 후 닫는다. 에러 시 throw (secret-vault 등 strict 용도). */
export function with_sqlite_strict<T>(
  db_path: string,
  run: (db: DatabaseSync) => T,
  options?: SqliteRunOptions,
): T {
  let db: DatabaseSync | null = null;
  try {
    db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
    if (options?.pragmas) {
      for (const p of options.pragmas) db.pragma(p);
    }
    return run(db);
  } finally {
    try { db?.close(); } catch { /* no-op */ }
  }
}

/** DB를 열고 async 콜백 실행 후 닫는다. await 경계를 넘는 비동기 처리(임베딩 등)에 사용. 에러 시 stderr 로깅 후 null. */
export async function with_sqlite_async<T>(
  db_path: string,
  run: (db: DatabaseSync) => Promise<T>,
  options?: SqliteRunOptions,
): Promise<T | null> {
  let db: DatabaseSync | null = null;
  try {
    db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
    if (options?.pragmas) {
      for (const p of options.pragmas) db.pragma(p);
    }
    return await run(db);
  } catch (err) {
    const msg = error_message(err);
    if (process.env.NODE_ENV !== "test") {
      process.stderr.write(`[sqlite] error at ${db_path}: ${msg}\n`);
    }
    return null;
  } finally {
    try { db?.close(); } catch { /* no-op */ }
  }
}

/* ─── AP-2: sqlite-vec 확장 포함 헬퍼 ───────────────────────────────────── */

/** DB를 열고 sqlite-vec 확장 로드 후 콜백 실행, 닫는다. WAL 기본 적용. 에러 시 stderr 로깅 후 null. */
export function with_vec_db<T>(
  db_path: string,
  run: (db: DatabaseSync) => T,
  options?: SqliteRunOptions,
): T | null {
  let db: DatabaseSync | null = null;
  try {
    db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
    if (!options?.readonly) db.pragma("journal_mode=WAL");
    if (options?.pragmas) {
      for (const p of options.pragmas) db.pragma(p);
    }
    sqliteVec.load(db);
    return run(db);
  } catch (err) {
    const msg = error_message(err);
    if (process.env.NODE_ENV !== "test") {
      process.stderr.write(`[sqlite-vec] error at ${db_path}: ${msg}\n`);
    }
    return null;
  } finally {
    try { db?.close(); } catch { /* no-op */ }
  }
}

/** DB를 열고 sqlite-vec 확장 로드 후 async 콜백 실행, 닫는다. WAL 기본 적용. 에러 시 stderr 로깅 후 null. */
export async function with_vec_db_async<T>(
  db_path: string,
  run: (db: DatabaseSync) => Promise<T>,
  options?: SqliteRunOptions,
): Promise<T | null> {
  let db: DatabaseSync | null = null;
  try {
    db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
    if (!options?.readonly) db.pragma("journal_mode=WAL");
    if (options?.pragmas) {
      for (const p of options.pragmas) db.pragma(p);
    }
    sqliteVec.load(db);
    return await run(db);
  } catch (err) {
    const msg = error_message(err);
    if (process.env.NODE_ENV !== "test") {
      process.stderr.write(`[sqlite-vec] error at ${db_path}: ${msg}\n`);
    }
    return null;
  } finally {
    try { db?.close(); } catch { /* no-op */ }
  }
}

/* ─── PCH-P2: SqlitePool — DB 연결 재사용 풀 ──────────────────────────── */

/**
 * 핫패스 스토어용 SQLite 연결 풀.
 * db_path별로 연결을 캐시하여 매 호출마다 open/close하는 오버헤드를 제거.
 * WAL + journal_mode 설정은 첫 연결 시 1회만 적용.
 */
export class SqlitePool {
  private readonly connections = new Map<string, DatabaseSync>();

  /** 풀에서 연결을 가져오거나, 없으면 새로 열어 캐시한 뒤 반환. */
  acquire(db_path: string, options?: SqliteRunOptions): DatabaseSync {
    const key = `${db_path}:${options?.readonly ? "ro" : "rw"}`;
    let db = this.connections.get(key);
    if (db) return db;
    db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
    if (options?.pragmas) {
      for (const p of options.pragmas) db.pragma(p);
    }
    this.connections.set(key, db);
    return db;
  }

  /** with_sqlite 대체: 풀 연결로 콜백 실행. 에러 시 stderr 로깅 후 null. 연결은 닫지 않음. */
  run<T>(db_path: string, run: (db: DatabaseSync) => T, options?: SqliteRunOptions): T | null {
    try {
      const db = this.acquire(db_path, options);
      return run(db);
    } catch (err) {
      const msg = error_message(err);
      if (process.env.NODE_ENV !== "test") {
        process.stderr.write(`[sqlite-pool] error at ${db_path}: ${msg}\n`);
      }
      return null;
    }
  }

  /** with_sqlite_strict 대체: 풀 연결로 콜백 실행. 에러 시 throw. 연결은 닫지 않음. */
  run_strict<T>(db_path: string, run: (db: DatabaseSync) => T, options?: SqliteRunOptions): T {
    const db = this.acquire(db_path, options);
    return run(db);
  }

  /** with_sqlite_async 대체: 풀 연결로 async 콜백 실행. 에러 시 stderr 로깅 후 null. */
  async run_async<T>(db_path: string, run: (db: DatabaseSync) => Promise<T>, options?: SqliteRunOptions): Promise<T | null> {
    try {
      const db = this.acquire(db_path, options);
      return await run(db);
    } catch (err) {
      const msg = error_message(err);
      if (process.env.NODE_ENV !== "test") {
        process.stderr.write(`[sqlite-pool] error at ${db_path}: ${msg}\n`);
      }
      return null;
    }
  }

  /** 모든 풀 연결을 닫는다. 프로세스 종료 시 호출. */
  close_all(): void {
    for (const [, db] of this.connections) {
      try { db.close(); } catch { /* no-op */ }
    }
    this.connections.clear();
  }
}
