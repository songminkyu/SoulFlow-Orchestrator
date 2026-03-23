/** 공유 SQLite 유틸리티 — open-per-call 패턴 + SqlitePool(연결 재사용). AP-2: 유일한 DB 진입점. */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { error_message } from "./common.js";

type DatabaseSync = Database.Database;
export type { DatabaseSync };

/** 동시 접근 시 즉시 SQLITE_BUSY 대신 최대 5초 대기. */
const DEFAULT_BUSY_TIMEOUT_MS = 5000;
export { DEFAULT_BUSY_TIMEOUT_MS };

export type SqliteRunOptions = {
  /** 연결 후 실행할 PRAGMA 목록 (예: ["foreign_keys=ON"]) */
  pragmas?: string[];
  /** 읽기 전용 모드로 열기 */
  readonly?: boolean;
};

/** DB 연결 생성 + busy_timeout + WAL + 커스텀 pragma 적용. 모든 헬퍼의 단일 진입점. */
function _create_db(db_path: string, options?: SqliteRunOptions): DatabaseSync {
  const db = new Database(db_path, options?.readonly ? { readonly: true } : undefined);
  db.pragma(`busy_timeout=${DEFAULT_BUSY_TIMEOUT_MS}`);
  if (!options?.readonly && db_path !== ":memory:") db.pragma("journal_mode=WAL");
  if (options?.pragmas) {
    for (const p of options.pragmas) db.pragma(p);
  }
  return db;
}

/**
 * DB 연결을 열고 반환. 호출자가 close() 책임.
 * ":memory:" 등 연결을 유지해야 하는 특수 케이스 전용.
 * 일반 파일 DB는 with_sqlite / with_sqlite_strict 사용.
 */
export function open_sqlite(
  db_path: string,
  options?: SqliteRunOptions,
): DatabaseSync {
  return _create_db(db_path, options);
}

/** DB를 열고 콜백 실행 후 닫는다. 에러 시 stderr 로깅 후 null. */
export function with_sqlite<T>(
  db_path: string,
  run: (db: DatabaseSync) => T,
  options?: SqliteRunOptions,
): T | null {
  let db: DatabaseSync | null = null;
  try {
    db = _create_db(db_path, options);
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
    db = _create_db(db_path, options);
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
    db = _create_db(db_path, options);
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
    db = _create_db(db_path, options);
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
    db = _create_db(db_path, options);
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

/* ─── 연결 풀 ─────────────────────────────────────────────────────────── */

/**
 * 경로별 SQLite 연결 재사용 풀. 고빈도 스토어(세션, 이벤트, 태스크 등)에서
 * open-per-call 오버헤드를 제거. WAL + busy_timeout 자동 적용.
 *
 * 사용법: 스토어 생성 시 풀을 주입받아 `pool.run(path, fn, opts)` 호출.
 * 서버 종료 시 `pool.close_all()` 호출 필수.
 */
export class SqlitePool {
  private readonly conns = new Map<string, DatabaseSync>();

  /** 연결을 풀에서 가져오거나 새로 생성. WAL + busy_timeout 자동 적용. */
  acquire(db_path: string, options?: SqliteRunOptions): DatabaseSync {
    const key = options?.readonly ? `ro:${db_path}` : db_path;
    const cached = this.conns.get(key);
    if (cached?.open) {
      if (options?.pragmas) {
        for (const p of options.pragmas) cached.pragma(p);
      }
      return cached;
    }
    if (cached) this.conns.delete(key);
    const db = _create_db(db_path, options);
    this.conns.set(key, db);
    return db;
  }

  /** 풀 연결로 콜백 실행. 에러 시 stderr 로깅 후 null. 연결은 닫지 않음. */
  run<T>(db_path: string, fn: (db: DatabaseSync) => T, options?: SqliteRunOptions): T | null {
    try {
      return fn(this.acquire(db_path, options));
    } catch (err) {
      if (process.env.NODE_ENV !== "test") process.stderr.write(`[sqlite-pool] error at ${db_path}: ${error_message(err)}\n`);
      return null;
    }
  }

  /** 풀 연결로 콜백 실행. 에러 시 throw. 연결은 닫지 않음. */
  run_strict<T>(db_path: string, fn: (db: DatabaseSync) => T, options?: SqliteRunOptions): T {
    return fn(this.acquire(db_path, options));
  }

  /** 풀 연결로 async 콜백 실행. 에러 시 stderr 로깅 후 null. */
  async run_async<T>(db_path: string, fn: (db: DatabaseSync) => Promise<T>, options?: SqliteRunOptions): Promise<T | null> {
    try {
      return await fn(this.acquire(db_path, options));
    } catch (err) {
      if (process.env.NODE_ENV !== "test") process.stderr.write(`[sqlite-pool] error at ${db_path}: ${error_message(err)}\n`);
      return null;
    }
  }

  /** 특정 경로의 연결만 닫기. */
  evict(db_path: string): void {
    for (const [key, db] of this.conns) {
      if (key === db_path || key === `ro:${db_path}`) {
        try { db.close(); } catch { /* no-op */ }
        this.conns.delete(key);
      }
    }
  }

  /** 풀 내 활성 연결 수. */
  get size(): number { return this.conns.size; }

  /** 모든 연결 닫기 (graceful shutdown). */
  close_all(): void {
    for (const db of this.conns.values()) {
      try { db.close(); } catch { /* no-op */ }
    }
    this.conns.clear();
  }
}
