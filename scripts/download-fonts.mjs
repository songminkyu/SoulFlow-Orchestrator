#!/usr/bin/env node
/**
 * PCH-D2: Google Fonts → 로컬 다운로드 스크립트
 *
 * 사용법:
 *   node scripts/download-fonts.mjs
 *
 * 결과:
 *   web/src/assets/fonts/   — .woff2 파일들
 *   web/src/styles/fonts.css — @font-face CSS (자동 생성, git 무시)
 *
 * CI/CD:
 *   npm run build 전에 이 스크립트를 1회 실행해야 합니다.
 *   네트워크 접근이 필요한 초기화 단계에서만 실행합니다.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FONTS_DIR = resolve(ROOT, "web/src/assets/fonts");
const CSS_OUT = resolve(ROOT, "web/src/styles/fonts.css");

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  "family=Inter:wght@400;500;600;700" +
  "&family=Noto+Sans+KR:wght@400;500;600;700" +
  "&family=JetBrains+Mono:wght@400;500" +
  "&display=swap";

// woff2를 받으려면 현대 브라우저 UA 필요
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.text();
}

async function fetchBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── 디렉토리 준비 ──────────────────────────────────────────────────────────
mkdirSync(FONTS_DIR, { recursive: true });

// ── Google Fonts CSS 취득 ──────────────────────────────────────────────────
console.log("① Google Fonts CSS 취득 중...");
const css = await fetchText(GOOGLE_FONTS_URL, { "User-Agent": UA });

// woff2 URL 추출
const urls = [
  ...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g),
].map((m) => m[1]);

const unique = [...new Set(urls)];
console.log(`   ${unique.length}개 woff2 파일 발견\n`);

// ── 폰트 파일 병렬 다운로드 (동시 6개) ────────────────────────────────────
let localCss = css;
let downloaded = 0;
let skipped = 0;
const CONCURRENCY = 6;

/** URL → 로컬 상대경로 매핑 구축 + 파일 다운로드 */
async function downloadOne(url) {
  const filename = url.split("/").pop();
  const dest = resolve(FONTS_DIR, filename);
  if (existsSync(dest)) {
    console.log(`   ⊙ 건너뜀: ${filename.slice(0, 52)}`);
    skipped++;
  } else {
    const buf = await fetchBinary(url);
    writeFileSync(dest, buf);
    console.log(`   ↓ ${filename.slice(0, 50)} — ${(buf.length / 1024).toFixed(0)} KB`);
    downloaded++;
  }
  return { url, filename };
}

// 동시성 제한 병렬 실행 — 개별 실패 시에도 나머지 계속 진행
const failed = [];
for (let i = 0; i < unique.length; i += CONCURRENCY) {
  const batch = unique.slice(i, i + CONCURRENCY);
  const settled = await Promise.allSettled(batch.map(downloadOne));
  for (let j = 0; j < settled.length; j++) {
    const r = settled[j];
    if (r.status === "fulfilled") {
      localCss = localCss.replaceAll(r.value.url, `../assets/fonts/${r.value.filename}`);
    } else {
      failed.push(batch[j]);
      console.error(`   ✗ 실패: ${batch[j].split("/").pop()?.slice(0, 50)} — ${r.reason?.message}`);
    }
  }
}

// ── fonts.css 작성 ────────────────────────────────────────────────────────
const header =
  "/* PCH-D2: Google Fonts 로컬 미러 — scripts/download-fonts.mjs 자동 생성 */\n" +
  "/* 이 파일을 직접 수정하지 마세요. 스크립트 재실행 시 덮어써집니다. */\n\n";

writeFileSync(CSS_OUT, header + localCss);

// ── 완료 보고 ─────────────────────────────────────────────────────────────
console.log(`\n✓ 다운로드: ${downloaded}개, 건너뜀: ${skipped}개${failed.length ? `, 실패: ${failed.length}개` : ""}`);
console.log(`✓ CSS  → ${CSS_OUT}`);
console.log(`✓ 폰트 → ${FONTS_DIR}`);
if (failed.length) {
  console.warn(`\n⚠ ${failed.length}개 폰트 다운로드 실패 — 재실행하세요.`);
  process.exitCode = 1;
} else {
  console.log("\n다음 단계: cd web && npm run build");
}
