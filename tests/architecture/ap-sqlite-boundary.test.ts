/**
 * AP-2 SQLite Boundary Guard — `new Database()` 직접 사용을 sqlite-helper 외부에서 금지.
 *
 * 허용:
 * - src/utils/sqlite-helper.ts (헬퍼 자체)
 * - src/orchestration/skill-index.ts (in-memory DB, class 멤버)
 *
 * 금지:
 * - 그 외 모든 src/**\/*.ts에서 `new Database(` 호출
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const ALLOWED_FILES = new Set([
  "src/utils/sqlite-helper.ts",
  "src/orchestration/skill-index.ts",
]);

describe("AP-2 SQLite Boundary — new Database() 직접 사용 금지", () => {
  // glob 대신 vitest의 import.meta.glob 사용 불가 → fs.globSync
  const files = globSync("src/**/*.ts", { cwd: process.cwd() });

  for (const file of files) {
    if (ALLOWED_FILES.has(file.replace(/\\/g, "/"))) continue;

    it(`${file}에서 new Database() 직접 사용 없음`, () => {
      const src = readFileSync(file, "utf-8");
      const matches = src.match(/new\s+Database\s*\(/g);
      expect(
        matches,
        `${file}에서 new Database() ${matches?.length ?? 0}회 발견. with_sqlite() 또는 with_vec_db()를 사용하세요.`,
      ).toBeNull();
    });
  }
});
