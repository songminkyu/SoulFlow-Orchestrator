/**
 * AP-4 MetricsSink Wiring Guard — RouteContext에 obs_metrics가 존재하고 service.ts에서 주입되는지 검증.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dirname, "../../src");

describe("AP-4 MetricsSink → Dashboard Wiring", () => {
  it("RouteContext에 obs_metrics 필드가 존재한다", () => {
    const src = readFileSync(join(SRC, "dashboard/route-context.ts"), "utf-8");
    expect(src).toContain("obs_metrics");
    expect(src).toContain("MetricsSinkLike");
  });

  it("dashboard service.ts에서 obs_metrics를 주입한다", () => {
    const src = readFileSync(join(SRC, "dashboard/service.ts"), "utf-8");
    expect(src).toMatch(/obs_metrics.*observability/);
  });
});
