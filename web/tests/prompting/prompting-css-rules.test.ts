/** FE-PE-1 T-2: prompt.css의 ps-tabs 분할 CSS 규칙이 존재하는지 직접 검증. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const css = readFileSync(resolve(__dirname, "../../src/styles/prompt.css"), "utf-8");

describe("prompt.css — ps-tabs 분할 규칙 (FE-PE-1)", () => {
  it(".ps-tabs__creative 셀렉터 존재", () => {
    expect(css).toMatch(/\.ps-tabs__creative\s*\{/);
  });

  it(".ps-tabs__sep 셀렉터 존재", () => {
    expect(css).toMatch(/\.ps-tabs__sep\s*\{/);
  });

  it(".ps-tabs__manage 셀렉터 존재", () => {
    expect(css).toMatch(/\.ps-tabs__manage\s*\{/);
  });

  it("ps-tabs__creative에 display: flex 규칙", () => {
    const block = css.slice(css.indexOf(".ps-tabs__creative"), css.indexOf(".ps-tabs__creative") + 200);
    expect(block).toContain("display");
    expect(block).toContain("flex");
  });
});
