/**
 * FE-4: chart-primitives 타입/구조 회귀 테스트.
 * 차트 프리미티브 컴포넌트의 export가 유지되는지 검증한다.
 */
import { describe, it, expect } from "vitest";

describe("chart-primitives 모듈 export 계약", () => {
  it("모든 필수 컴포넌트가 export된다", async () => {
    const mod = await import("@/components/chart-primitives");
    expect(mod.DistributionBar).toBeDefined();
    expect(mod.DistributionLegend).toBeDefined();
    expect(mod.LatencyBars).toBeDefined();
    expect(mod.ProportionBar).toBeDefined();
    expect(mod.DeltaIndicator).toBeDefined();
    expect(mod.StackedBarChart).toBeDefined();
  });

  it("컴포넌트가 함수이다", async () => {
    const mod = await import("@/components/chart-primitives");
    expect(typeof mod.DistributionBar).toBe("function");
    expect(typeof mod.LatencyBars).toBe("function");
    expect(typeof mod.ProportionBar).toBe("function");
    expect(typeof mod.DeltaIndicator).toBe("function");
    expect(typeof mod.StackedBarChart).toBe("function");
  });
});
