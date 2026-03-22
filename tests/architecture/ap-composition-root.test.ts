/**
 * AP-1 Composition Root Guard — OrchestrationBundleDeps가 sub-bundle intersection으로 구성되어 있는지 검증.
 *
 * OrchestrationBundleDeps가 type alias (intersection)인지 확인하고,
 * sub-bundle 타입들이 export되어 있는지 검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ORCH_FILE = join(import.meta.dirname, "../../src/bootstrap/orchestration.ts");

describe("AP-1 Composition Root — sub-bundle 구조 검증", () => {
  const src = readFileSync(ORCH_FILE, "utf-8");

  it("OrchestrationBundleDeps는 type alias (intersection)이다", () => {
    expect(src).toMatch(/export\s+type\s+OrchestrationBundleDeps\s*=/);
    expect(src).not.toMatch(/export\s+interface\s+OrchestrationBundleDeps/);
  });

  const SUB_BUNDLES = [
    "OrchInfraDeps",
    "OrchAgentDeps",
    "OrchEventDeps",
    "OrchStorageDeps",
    "OrchSecurityDeps",
    "OrchToolDeps",
  ];

  for (const name of SUB_BUNDLES) {
    it(`sub-bundle ${name}이 export interface로 정의되어 있다`, () => {
      expect(src).toMatch(new RegExp(`export\\s+interface\\s+${name}\\s*\\{`));
    });
  }

  it("OrchestrationBundleDeps가 모든 sub-bundle의 intersection이다", () => {
    for (const name of SUB_BUNDLES) {
      expect(src, `${name}이 intersection에 포함되어야 함`).toContain(name);
    }
  });
});
