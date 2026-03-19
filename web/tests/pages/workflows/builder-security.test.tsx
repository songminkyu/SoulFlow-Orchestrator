/**
 * FE-3: builder.tsx 보안 -- dangerouslySetInnerHTML 제거 확인 + api 클라이언트 사용 확인.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BUILDER_SRC = readFileSync(
  resolve(__dirname, "../../../src/pages/workflows/builder.tsx"),
  "utf-8",
);

describe("builder.tsx 보안 (FE-3)", () => {
  it("dangerouslySetInnerHTML을 사용하지 않는다", () => {
    expect(BUILDER_SRC).not.toContain("dangerouslySetInnerHTML");
  });

  it("raw fetch() 대신 api 클라이언트를 사용한다 (diagram preview)", () => {
    // fetch("/api/...") 패턴이 없어야 함
    const raw_fetch_re = /\bfetch\s*\(\s*["'`]\/api\//;
    expect(raw_fetch_re.test(BUILDER_SRC)).toBe(false);
  });

  it("api.post로 diagram preview를 호출한다", () => {
    expect(BUILDER_SRC).toContain('api.post<{ ok: boolean; output?: string; error?: string }>');
  });
});
