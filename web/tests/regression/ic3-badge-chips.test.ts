/**
 * IC-3: FE 표면 마감 — 8개 트랙의 badge/chip data-testid가 소스에 존재하는지 검증.
 * 렌더링 테스트 대신 소스-레벨 검증: 해당 컴포넌트 파일에 data-testid가 실재함을 확인.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const web = resolve(__dirname, "../..");

function src(rel: string): string {
  return readFileSync(resolve(web, rel), "utf-8");
}

describe("IC-3 badge/chip data-testid 존재 검증", () => {
  it("LF-2: channels dispatch-mode-chip", () => {
    const code = src("src/pages/channels/index.tsx");
    expect(code).toContain('data-testid="dispatch-mode-chip"');
    expect(code).toContain("chip chip--");
  });

  it("LF-4: chat-status-bar delivery-health", () => {
    const code = src("src/pages/chat/chat-status-bar.tsx");
    expect(code).toContain('data-testid="delivery-health"');
    expect(code).toContain("delivery-health--degraded");
  });

  it("LF-5: settings local-first-summary", () => {
    const code = src("src/pages/settings.tsx");
    expect(code).toContain('data-testid="local-first-summary"');
  });

  it("FC-5: providers deploy-meta", () => {
    const code = src("src/pages/providers/index.tsx");
    expect(code).toContain('data-testid="provider-deploy-meta"');
    expect(code).toContain("badge badge--info");
  });

  it("TN/LF-3: monitoring relay-status", () => {
    const code = src("src/pages/admin/monitoring-panel.tsx");
    expect(code).toContain('data-testid="relay-status"');
  });

  it("IC-3 i18n: dispatch_mode 키가 locale에 존재", () => {
    const root = resolve(web, "..");
    const en = JSON.parse(readFileSync(resolve(root, "src/i18n/locales/en.json"), "utf-8"));
    expect(en["channels.dispatch_mode_sync"]).toBeDefined();
    expect(en["channels.dispatch_mode_queue"]).toBeDefined();
  });
});
