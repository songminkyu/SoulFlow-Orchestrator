/**
 * IC-7 / GW-5/6: 워크플로우 detail + chat-status 렌더링 회귀 검증.
 * 소스-레벨: 워크플로우 상세 페이지가 StatusView, Badge, ApprovalBanner를
 * 올바르게 import하고 사용하는지 확인.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const web = resolve(__dirname, "../..");

function src(rel: string): string {
  return readFileSync(resolve(web, rel), "utf-8");
}

describe("IC-7 / GW-5/6: workflow detail 렌더링 회귀", () => {
  const detail = src("src/pages/workflows/detail.tsx");

  it("StatusView 임포트 + 사용", () => {
    expect(detail).toContain('import { StatusView }');
    expect(detail).toContain("<StatusView");
  });

  it("Badge 임포트 + 사용", () => {
    expect(detail).toContain('import { Badge }');
    expect(detail).toContain("<Badge");
  });

  it("ApprovalBanner 임포트 + 사용", () => {
    expect(detail).toContain('import { ApprovalBanner }');
    expect(detail).toContain("<ApprovalBanner");
  });

  it("MessageBubble 채팅 렌더링", () => {
    expect(detail).toContain('import { MessageBubble }');
    expect(detail).toContain("<MessageBubble");
  });

  it("i18n useT 사용", () => {
    expect(detail).toContain("useT");
    expect(detail).toContain('t("workflows.');
  });

  it("워크플로우 index 페이지가 존재", () => {
    const index = src("src/pages/workflows/index.tsx");
    expect(index).toContain("workflow");
  });
});
