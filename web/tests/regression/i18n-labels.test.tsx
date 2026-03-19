/**
 * FE-6: i18n Label 회귀 — Track-15에서 추가한 모든 i18n 키가 양쪽 locale에 존재하는지 검증.
 *
 * 검증 축:
 * 1. en.json과 ko.json 키 일치 (한쪽만 있는 키 없음)
 * 2. Track-15에서 추가한 주요 네임스페이스 (chat.*, admin.*, settings.*, sidebar.*) 키 존재
 * 3. 주요 컴포넌트 파일에 하드코딩 한글 없음
 * 4. en.json에 한글 값 혼입 없음 (의도적 예외 허용)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EN_PATH = resolve(__dirname, "../../../src/i18n/locales/en.json");
const KO_PATH = resolve(__dirname, "../../../src/i18n/locales/ko.json");

function load_keys(path: string): string[] {
  return Object.keys(JSON.parse(readFileSync(path, "utf8")) as Record<string, string>);
}

function load_dict(path: string): Record<string, string> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
}

// -- en/ko 키 일치 검증 --------------------------------------------------------

describe("i18n Label — en/ko 키 일치 (FE-6)", () => {
  const en_keys = load_keys(EN_PATH);
  const ko_keys = load_keys(KO_PATH);

  it("en.json과 ko.json 키 수가 동일하다", () => {
    expect(en_keys.length).toBe(ko_keys.length);
  });

  it("en에만 있는 키가 없다", () => {
    const ko_set = new Set(ko_keys);
    const only_en = en_keys.filter((k) => !ko_set.has(k));
    expect(only_en, `en에만 존재: ${only_en.join(", ")}`).toHaveLength(0);
  });

  it("ko에만 있는 키가 없다", () => {
    const en_set = new Set(en_keys);
    const only_ko = ko_keys.filter((k) => !en_set.has(k));
    expect(only_ko, `ko에만 존재: ${only_ko.join(", ")}`).toHaveLength(0);
  });
});

// -- Track-15 네임스페이스 키 존재 확인 ----------------------------------------

describe("i18n Label — Track-15 필수 키 네임스페이스 존재 (FE-6)", () => {
  const en_keys = load_keys(EN_PATH);

  it("chat.* 키가 30개 이상 존재한다", () => {
    const chat_keys = en_keys.filter((k) => k.startsWith("chat."));
    expect(chat_keys.length).toBeGreaterThanOrEqual(30);
  });

  it("admin.* 키가 70개 이상 존재한다", () => {
    const admin_keys = en_keys.filter((k) => k.startsWith("admin."));
    expect(admin_keys.length).toBeGreaterThanOrEqual(70);
  });

  it("settings.* 키가 10개 이상 존재한다", () => {
    const settings_keys = en_keys.filter((k) => k.startsWith("settings."));
    expect(settings_keys.length).toBeGreaterThanOrEqual(10);
  });

  it("sidebar.* 키가 5개 이상 존재한다", () => {
    const sidebar_keys = en_keys.filter((k) => k.startsWith("sidebar."));
    expect(sidebar_keys.length).toBeGreaterThanOrEqual(5);
  });

  it("ChatPromptBar에서 사용하는 핵심 키가 존재한다", () => {
    const required = [
      "chat.placeholder", "chat.send_hint", "chat.newline_hint",
      "chat.attach_file", "chat.provider_select", "chat.model_select",
      "chat.model_auto", "chat.model_loading", "chat.sending",
    ];
    const en_set = new Set(en_keys);
    for (const key of required) {
      expect(en_set.has(key), `missing key: ${key}`).toBe(true);
    }
  });

  it("common.send 키가 존재한다 (전송 버튼)", () => {
    const en_set = new Set(en_keys);
    expect(en_set.has("common.send")).toBe(true);
  });
});

// -- en.json 한글 값 혼입 방지 -------------------------------------------------

describe("i18n Label — en.json 한글 혼입 방지 (FE-6)", () => {
  it("en.json에 한글 값이 없다 (의도적 예외 제외)", () => {
    const ALLOWED_KOREAN = new Set(["sidebar.locale_ko"]);
    const en = load_dict(EN_PATH);
    const korean_entries = Object.entries(en).filter(
      ([k, v]) => !ALLOWED_KOREAN.has(k) && /[가-힣]/.test(v),
    );
    expect(
      korean_entries,
      `en.json에 한글 값: ${korean_entries.map(([k]) => k).join(", ")}`,
    ).toHaveLength(0);
  });
});

// -- 하드코딩 한글 감지 --------------------------------------------------------

describe("i18n Label — 하드코딩 한글 감지 (FE-6)", () => {
  function find_korean_lines(file_path: string): Array<{ line: number; text: string }> {
    const content = readFileSync(resolve(file_path), "utf8");
    const lines = content.split("\n");
    const results: Array<{ line: number; text: string }> = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      // 전체 줄이 주석인 경우 제외
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/**") || trimmed.startsWith("/*")) continue;
      // JSX 주석만으로 구성된 줄 제외
      if (/^\{\/\*.*\*\/\}$/.test(trimmed)) continue;
      // JSDoc 태그 제외
      if (trimmed.startsWith("@")) continue;
      // 주석 부분 제거: JSX 주석 {/* ... */}, 인라인 /* ... */, 인라인 // ...
      let code_only = raw;
      code_only = code_only.replace(/\{\/\*[^]*?\*\/\}/g, "");   // JSX 주석
      code_only = code_only.replace(/\/\*[^]*?\*\//g, "");       // 블록 주석
      code_only = code_only.replace(/\/\/[^\n]*$/m, "");          // 라인 주석
      if (/[가-힣]/.test(code_only)) {
        results.push({ line: i + 1, text: trimmed });
      }
    }
    return results;
  }

  const component_files = [
    "src/components/badge.tsx",
    "src/components/chat-prompt-bar.tsx",
    "src/components/empty-state.tsx",
    "src/pages/chat/tool-call-block.tsx",
    "src/components/user-card.tsx",
  ];

  for (const file of component_files) {
    it(`${file}에 하드코딩 한글이 없다`, () => {
      const hits = find_korean_lines(file);
      expect(hits, `하드코딩 한글 발견: ${JSON.stringify(hits)}`).toHaveLength(0);
    });
  }
});
