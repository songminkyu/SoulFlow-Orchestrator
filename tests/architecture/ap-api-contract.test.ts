/**
 * AP-3 FE-BE API Contract Guard — 공유 계약 파일이 존재하고 핵심 타입이 정의되어 있는지 검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const BE_CONTRACT = join(ROOT, "src/contracts/api-responses.ts");
const FE_CONTRACT = join(ROOT, "web/src/api/contracts.ts");

const CORE_TYPES = [
  "ApiAuthStatus",
  "ApiLoginResult",
  "ApiAuthMe",
  "ApiSecuritySummary",
  "ApiAdminUserList",
  "ApiAdminTeamList",
  "ApiChatSessionSummary",
  "ApiProcessList",
  "ApiEvalBundle",
  "ApiHealthz",
  "ApiWorkflowDefinition",
  "ApiLocale",
  "ApiMemoryLongterm",
  "ApiReconcileList",
];

describe("AP-3 FE-BE API Contract", () => {
  it("BE 공유 계약 파일이 존재한다", () => {
    expect(existsSync(BE_CONTRACT)).toBe(true);
  });

  it("FE 공유 계약 파일이 존재한다", () => {
    expect(existsSync(FE_CONTRACT)).toBe(true);
  });

  for (const name of CORE_TYPES) {
    it(`BE 계약에 ${name}이 정의되어 있다`, () => {
      const src = readFileSync(BE_CONTRACT, "utf-8");
      expect(src).toContain(`export type ${name}`);
    });

    it(`FE 계약에 ${name}이 정의되어 있다`, () => {
      const src = readFileSync(FE_CONTRACT, "utf-8");
      expect(src).toContain(`export type ${name}`);
    });
  }
});
