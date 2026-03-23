/**
 * sqlite-helper — with_sqlite / with_sqlite_strict / SqlitePool 통합 테스트.
 * - with_sqlite_strict: pragmas 옵션
 * - with_sqlite: 정상 경로, pragmas, 예외 → null, 비존재 경로 → null
 * - with_sqlite: NODE_ENV !== "test" → stderr 로깅
 * - PO-9: busy_timeout 자동 적용 검증
 * - PO-9: SqlitePool 연결 재사용 검증
 */
import { describe, it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { with_sqlite, with_sqlite_strict, SqlitePool, DEFAULT_BUSY_TIMEOUT_MS } from "@src/utils/sqlite-helper.js";

async function make_tmpdir(prefix = "sqlite-test-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

// ── with_sqlite_strict ──────────────────────────────────────────────

describe("with_sqlite_strict — pragmas 옵션", () => {
  it("pragmas 배열 전달 → pragma 루프 실행", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "test.db");
    try {
      const result = with_sqlite_strict(db_path, (db) => {
        db.exec("CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)");
        return 42;
      }, { pragmas: ["journal_mode=WAL", "synchronous=NORMAL"] });
      expect(result).toBe(42);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── with_sqlite — 정상 경로 ─────────────────────────────────────────

describe("with_sqlite — 정상 경로", () => {
  it("pragmas 없이 DB 열고 콜백 실행", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "test.db");
    try {
      const result = with_sqlite(db_path, (db) => {
        db.exec("CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)");
        return 99;
      });
      expect(result).toBe(99);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("pragmas 배열 전달 → for 루프 실행", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "test.db");
    try {
      const result = with_sqlite(
        db_path,
        (db) => {
          db.exec("CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)");
          return "ok";
        },
        { pragmas: ["journal_mode=WAL"] },
      );
      expect(result).toBe("ok");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── with_sqlite — 예외 → null ───────────────────────────────────────

describe("with_sqlite — 예외 → return null", () => {
  it("run() 내에서 throw → catch에서 null 반환", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "test.db");
    try {
      const result = with_sqlite(db_path, (_db) => {
        throw new Error("intentional error");
      });
      expect(result).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("존재하지 않는 디렉토리 → DB 열기 실패 → null 반환", () => {
    const bad_path = process.platform === "win32"
      ? "Z:\\__nonexistent_dir__\\deep\\test.db"
      : "/nonexistent/path/test.db";
    const result = with_sqlite(bad_path, (db) => {
      db.exec("SELECT 1");
      return "should not reach";
    });
    expect(result).toBeNull();
  });
});

// ── with_sqlite — NODE_ENV !== "test" stderr 로깅 ───────────────────

describe("with_sqlite — NODE_ENV≠test 시 stderr 로깅", () => {
  it("NODE_ENV=development + 에러 → process.stderr.write 호출", () => {
    const original_env = process.env.NODE_ENV;
    const write_spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      process.env.NODE_ENV = "development";
      const result = with_sqlite("/nonexistent-cov3/path/db.sqlite", (db) => {
        db.exec("SELECT 1");
        return "ok";
      });
      expect(result).toBeNull();
      expect(write_spy).toHaveBeenCalled();
      const written = String(write_spy.mock.calls[0]?.[0] ?? "");
      expect(written).toContain("[sqlite]");
    } finally {
      process.env.NODE_ENV = original_env;
      write_spy.mockRestore();
    }
  });
});

// ── PO-9: busy_timeout 자동 적용 ──────────────────────────────────────

describe("PO-9 — busy_timeout 자동 적용", () => {
  it("with_sqlite → busy_timeout이 DEFAULT_BUSY_TIMEOUT_MS로 설정됨", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "bt.db");
    try {
      const timeout = with_sqlite(db_path, (db) => {
        return db.pragma("busy_timeout", { simple: true }) as number;
      });
      expect(timeout).toBe(DEFAULT_BUSY_TIMEOUT_MS);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("with_sqlite_strict → busy_timeout 설정됨", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "bt2.db");
    try {
      const timeout = with_sqlite_strict(db_path, (db) => {
        return db.pragma("busy_timeout", { simple: true }) as number;
      });
      expect(timeout).toBe(DEFAULT_BUSY_TIMEOUT_MS);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── PO-9: SqlitePool ──────────────────────────────────────────────────

describe("SqlitePool", () => {
  it("동일 경로 재사용 — 연결 1개만 생성", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "pool.db");
    const pool = new SqlitePool();
    try {
      pool.run(db_path, (db) => db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)"));
      pool.run(db_path, (db) => db.exec("INSERT INTO t VALUES (1)"));
      const count = pool.run(db_path, (db) => {
        const row = db.prepare("SELECT COUNT(*) as c FROM t").get() as { c: number };
        return row.c;
      });
      expect(count).toBe(1);
      expect(pool.size).toBe(1);
    } finally {
      pool.close_all();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("readonly 경로 분리 — rw + ro = 2 연결", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "pool-ro.db");
    const pool = new SqlitePool();
    try {
      pool.run(db_path, (db) => db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)"));
      pool.run(db_path, (db) => db.exec("INSERT INTO t VALUES (42)"), { readonly: false });
      const val = pool.run(db_path, (db) => {
        const row = db.prepare("SELECT id FROM t").get() as { id: number };
        return row.id;
      }, { readonly: true });
      expect(val).toBe(42);
      expect(pool.size).toBe(2);
    } finally {
      pool.close_all();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("busy_timeout 자동 적용", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "pool-bt.db");
    const pool = new SqlitePool();
    try {
      const timeout = pool.run(db_path, (db) => {
        return db.pragma("busy_timeout", { simple: true }) as number;
      });
      expect(timeout).toBe(DEFAULT_BUSY_TIMEOUT_MS);
    } finally {
      pool.close_all();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("evict → 해당 경로 연결만 닫기", async () => {
    const dir = await make_tmpdir();
    const path_a = join(dir, "a.db");
    const path_b = join(dir, "b.db");
    const pool = new SqlitePool();
    try {
      pool.run(path_a, (db) => db.exec("CREATE TABLE t (id INTEGER)"));
      pool.run(path_b, (db) => db.exec("CREATE TABLE t (id INTEGER)"));
      expect(pool.size).toBe(2);
      pool.evict(path_a);
      expect(pool.size).toBe(1);
    } finally {
      pool.close_all();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("close_all → 모든 연결 닫기", async () => {
    const dir = await make_tmpdir();
    const pool = new SqlitePool();
    try {
      pool.run(join(dir, "x.db"), (db) => db.exec("SELECT 1"));
      pool.run(join(dir, "y.db"), (db) => db.exec("SELECT 1"));
      expect(pool.size).toBe(2);
      pool.close_all();
      expect(pool.size).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("run_async — 비동기 콜백 실행", async () => {
    const dir = await make_tmpdir();
    const db_path = join(dir, "async.db");
    const pool = new SqlitePool();
    try {
      await pool.run_async(db_path, async (db) => {
        db.exec("CREATE TABLE t (v TEXT)");
        db.exec("INSERT INTO t VALUES ('async-ok')");
      });
      const val = pool.run(db_path, (db) => {
        const row = db.prepare("SELECT v FROM t").get() as { v: string };
        return row.v;
      });
      expect(val).toBe("async-ok");
    } finally {
      pool.close_all();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
