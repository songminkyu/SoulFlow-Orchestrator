/**
 * IC-4 / IC-7: FE-BE 계약 타입 drift guard.
 * BE api-responses.ts의 모든 export type이 FE contracts.ts에도 존재하는지 검증.
 * BE ⊆ FE 관계를 보장한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

function extract_type_names(filepath: string): string[] {
  const content = readFileSync(resolve(root, filepath), "utf-8");
  const matches = content.matchAll(/export\s+type\s+(\w+)\s*=/g);
  return [...matches].map((m) => m[1]).sort();
}

describe("FE-BE contract drift guard", () => {
  const be_types = extract_type_names("src/contracts/api-responses.ts");
  const fe_types = extract_type_names("web/src/api/contracts.ts");

  it("BE 파일에 export type이 1개 이상 존재", () => {
    expect(be_types.length).toBeGreaterThan(0);
  });

  it("FE 파일에 export type이 1개 이상 존재", () => {
    expect(fe_types.length).toBeGreaterThan(0);
  });

  it("FE가 BE의 모든 타입을 포함 (BE ⊆ FE)", () => {
    const missing = be_types.filter((t) => !fe_types.includes(t));
    expect(missing, `FE에 누락된 BE 타입: ${missing.join(", ")}`).toEqual([]);
  });

  it("FE 추가 타입은 IC-4 확장분 (BE에 없어도 OK)", () => {
    const fe_only = fe_types.filter((t) => !be_types.includes(t));
    // IC-4에서 추가된 FE-only 타입이 존재함을 확인
    expect(fe_only.length).toBeGreaterThan(0);
    // 알려진 IC-4 추가 타입
    const expected_extras = ["ApiMcpServer", "ApiMcpServerList", "ApiSecretList", "ApiProtocolList"];
    for (const t of expected_extras) {
      expect(fe_only, `IC-4 추가 타입 ${t}이 FE에 존재해야 함`).toContain(t);
    }
  });
});
