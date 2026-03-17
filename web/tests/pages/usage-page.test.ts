/**
 * FE-4: Usage 페이지 계약 테스트.
 * 라우터 경로, access-policy, i18n 키, 타입 계약을 검증한다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PAGE_POLICIES, get_page_policy } from "@/pages/access-policy";
import { PATHS } from "@/router-paths";

describe("Usage 라우트 + 정책", () => {
  it("PATHS.USAGE가 정의되어 있다", () => {
    expect(PATHS.USAGE).toBe("/usage");
  });

  it("access-policy에 /usage가 team_manager 이상으로 등록되어 있다", () => {
    const p = get_page_policy("/usage");
    expect(p).toBeDefined();
    expect(p!.view).toBe("team_manager");
    expect(p!.manage).toBe("team_manager");
  });
});

describe("Usage i18n 키", () => {
  const en = JSON.parse(readFileSync(resolve("../src/i18n/locales/en.json"), "utf8")) as Record<string, string>;
  const ko = JSON.parse(readFileSync(resolve("../src/i18n/locales/ko.json"), "utf8")) as Record<string, string>;

  const REQUIRED_KEYS = [
    "nav.usage",
    "usage.title",
    "usage.total_spend",
    "usage.total_tokens",
    "usage.total_requests",
    "usage.period_7d",
    "usage.period_30d",
    "usage.daily_spend",
    "usage.daily_requests",
    "usage.daily_tokens",
    "usage.by_provider",
    "usage.today_by_model",
    "usage.no_data",
    "usage.col_provider",
    "usage.col_model",
    "usage.col_requests",
    "usage.col_cost",
  ];

  it("필수 usage.* 키가 en.json에 존재한다", () => {
    for (const key of REQUIRED_KEYS) {
      expect(en[key], `en.json에 ${key} 누락`).toBeDefined();
    }
  });

  it("필수 usage.* 키가 ko.json에 존재한다", () => {
    for (const key of REQUIRED_KEYS) {
      expect(ko[key], `ko.json에 ${key} 누락`).toBeDefined();
    }
  });

  it("usage.* 키 수가 en/ko 동일하다", () => {
    const en_usage = Object.keys(en).filter((k) => k.startsWith("usage."));
    const ko_usage = Object.keys(ko).filter((k) => k.startsWith("usage."));
    expect(en_usage.length).toBe(ko_usage.length);
  });
});

describe("Usage 타입 계약", () => {
  it("DailySummary 타입 import가 유효하다", async () => {
    const mod = await import("@/pages/usage/types");
    expect(mod).toBeDefined();
  });
});
