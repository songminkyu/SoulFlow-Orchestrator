/** FE-PE-1: prompting 탭/nav locale 키가 en.json + ko.json 양쪽에 존재하는지 검증. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");
const en = JSON.parse(readFileSync(resolve(root, "src/i18n/locales/en.json"), "utf-8"));
const ko = JSON.parse(readFileSync(resolve(root, "src/i18n/locales/ko.json"), "utf-8"));

const REQUIRED_KEYS = [
  "prompting.tab_text",
  "prompting.tab_image",
  "prompting.tab_video",
  "prompting.tab_agent",
  "prompting.tab_gallery",
  "prompting.tab_compare",
  "prompting.tab_eval",
  "prompting.tab_skills",
  "prompting.tab_templates",
  "prompting.tab_tools",
  "prompting.tab_rag",
  "prompting.nav_label",
] as const;

describe("prompting locale keys", () => {
  const enMap = en as Record<string, string>;
  const koMap = ko as Record<string, string>;


  for (const key of REQUIRED_KEYS) {
    it(`en.json has "${key}"`, () => {
      expect(enMap[key]).toBeDefined();
      expect(enMap[key].length).toBeGreaterThan(0);
    });

    it(`ko.json has "${key}"`, () => {
      expect(koMap[key]).toBeDefined();
      expect(koMap[key].length).toBeGreaterThan(0);
    });
  }
});
