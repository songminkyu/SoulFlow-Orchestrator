/**
 * IC-7 / TR-5: workspace references 페이지 렌더링 회귀 검증.
 * tokenizer_hint, lexical_profile, retrieval_status 필드가 FE에서 소비되는지 확인.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const web = resolve(__dirname, "../..");

function src(rel: string): string {
  return readFileSync(resolve(web, rel), "utf-8");
}

describe("IC-7 / TR-5: references 페이지 렌더링 회귀", () => {
  const refs = src("src/pages/workspace/references.tsx");

  it("lexical_profile 필드 렌더링", () => {
    expect(refs).toContain("lexical_profile");
    expect(refs).toContain('t("repo.lexical_profile")');
  });

  it("tokenizer_hint 필드 렌더링", () => {
    expect(refs).toContain("tokenizer_hint");
  });

  it("retrieval_status Badge 렌더링", () => {
    expect(refs).toContain("retrieval_status");
    // retrieval_status에 따른 variant 분기: indexed→ok, pending→warn, else→err
    expect(refs).toContain('"indexed"');
    expect(refs).toContain('"pending"');
    expect(refs).toContain('"err"');
  });

  it("ApiRefDocumentList 타입 사용 (contracts import)", () => {
    const contracts = src("src/api/contracts.ts");
    expect(contracts).toContain("ApiRefDocumentList");
    expect(contracts).toContain("lexical_profile");
    expect(contracts).toContain("tokenizer_hint");
    expect(contracts).toContain("retrieval_status");
  });
});
