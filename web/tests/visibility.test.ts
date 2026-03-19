/**
 * visibility.ts 순수 함수 테스트 — PermissionTier 비교 로직.
 */

import { describe, it, expect } from "vitest";
import {
  type PermissionTier,
  TIER_ORDER,
  tierIndex,
  isTierAtLeast,
} from "../src/types/visibility";

describe("tierIndex", () => {
  it("consumer = 0, superadmin = 4", () => {
    expect(tierIndex("consumer")).toBe(0);
    expect(tierIndex("authenticated_member")).toBe(1);
    expect(tierIndex("workspace_editor")).toBe(2);
    expect(tierIndex("operator")).toBe(3);
    expect(tierIndex("superadmin")).toBe(4);
  });

  it("TIER_ORDER has 5 entries", () => {
    expect(TIER_ORDER).toHaveLength(5);
  });
});

describe("isTierAtLeast", () => {
  it("same tier returns true", () => {
    for (const tier of TIER_ORDER) {
      expect(isTierAtLeast(tier, tier)).toBe(true);
    }
  });

  it("higher tier can view lower required", () => {
    expect(isTierAtLeast("superadmin", "consumer")).toBe(true);
    expect(isTierAtLeast("operator", "authenticated_member")).toBe(true);
    expect(isTierAtLeast("workspace_editor", "consumer")).toBe(true);
  });

  it("lower tier cannot view higher required", () => {
    expect(isTierAtLeast("consumer", "superadmin")).toBe(false);
    expect(isTierAtLeast("authenticated_member", "operator")).toBe(false);
    expect(isTierAtLeast("consumer", "workspace_editor")).toBe(false);
  });
});

describe("permission matrix golden test", () => {
  /** 전체 tier 조합 x 접근 가능 여부 매트릭스. */
  const tiers: PermissionTier[] = [...TIER_ORDER];

  // expected[current][required] = true if accessible
  const expected: boolean[][] = tiers.map((current, ci) =>
    tiers.map((_required, ri) => ci >= ri),
  );

  for (let ci = 0; ci < tiers.length; ci++) {
    for (let ri = 0; ri < tiers.length; ri++) {
      const current = tiers[ci]!;
      const required = tiers[ri]!;
      const accessible = expected[ci]![ri]!;

      it(`${current} ${accessible ? "can" : "cannot"} view ${required}`, () => {
        expect(isTierAtLeast(current, required)).toBe(accessible);
      });
    }
  }
});
