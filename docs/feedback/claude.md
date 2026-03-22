# Evidence

## Agreed

- `[APPROVED]` SH-1~5, TN-1~6, OB-1~8, EV-1~6, EG-1~5, EG-R1
- `[APPROVED]` PA-1+2, TR-1~5, GW-1~6, RP-1~6, SO-1~7, PAR-1~6
- `[APPROVED]` E1~5, F1~5, RPF-1~6, RPF-4F, QG-1~4, FE-0~6a
- `[APPROVED]` Phase 0+1+2 인프라 전수조사 + Phase 3 (H-5, H-7, H-9)

## [REVIEW_NEEDED] FE-PE-1 — 프롬프팅 스튜디오 탭 재구조화 (round 2)

### Forward RTM Rows

| Req ID | File | Exists | Impl | Test Case | Test Result | Status |
|--------|------|--------|------|-----------|-------------|--------|
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::11개 탭 버튼 렌더링 | ✓ pass | fixed |
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::creative/manage 영역 분리 | ✓ pass | fixed |
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::Skills 탭 진입 | ✓ pass | fixed |
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::Templates 탭 진입 | ✓ pass | fixed |
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::Tools 탭 진입 | ✓ pass | fixed |
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::RAG 탭 진입 | ✓ pass | fixed |
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::manage→creative 복귀 | ✓ pass | fixed |
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::nav_label i18n | ✓ pass | fixed |
| FE-PE-1 | web/src/styles/prompt.css | ✅ | ✅ | (visual — ps-tabs__creative, ps-tabs__sep, ps-tabs__manage) | — | fixed |
| FE-PE-1 | src/i18n/locales/en.json | ✅ | ✅ | web/tests/prompting/prompting-page-eval-tab.test.tsx (regression) | ✓ pass | fixed |
| FE-PE-1 | src/i18n/locales/ko.json | ✅ | ✅ | web/tests/prompting/prompting-page-eval-tab.test.tsx (regression) | ✓ pass | fixed |

### Claim

프롬프팅 스튜디오 index.tsx를 11탭(Creative 7 + Manage 4)으로 재설계. 워크스페이스의 Skills/Templates/Tools/RAG를 lazy import로 흡수. 탭 바 2영역 분리(`.ps-tabs__creative` + `.ps-tabs__sep` + `.ps-tabs__manage`). i18n 키 12개 추가(tab 11 + nav_label 1). `aria-label` 하드코딩 제거 → `t("prompting.nav_label")`.

Round 2 수정: I-1(하드코딩 aria-label → i18n), T-2(manage-tab 전용 테스트 8건 추가), T-3(eval-tab 테스트 i18n mock 추가).

### Changed Files

**Code:** `web/src/pages/prompting/index.tsx`, `web/src/styles/prompt.css`, `src/i18n/locales/en.json`, `src/i18n/locales/ko.json`
**Tests:** `web/tests/prompting/prompting-page-manage-tabs.test.tsx` (신규), `web/tests/prompting/prompting-page-eval-tab.test.tsx` (수정)

### Test Command

```bash
cd web && npx vitest run tests/prompting/prompting-page-eval-tab.test.tsx tests/prompting/prompting-page-manage-tabs.test.tsx
npx tsc --noEmit
npx eslint src/pages/prompting/index.tsx
```

### Test Result

```
vitest (2 test files):
 ✓ tests/prompting/prompting-page-eval-tab.test.tsx (3 tests)
 ✓ tests/prompting/prompting-page-manage-tabs.test.tsx (8 tests)
 Test Files  2 passed (2)
      Tests  11 passed (11)

tsc --noEmit: exit 0
eslint src/pages/prompting/index.tsx: exit 0
```

git diff --name-only:
```
src/i18n/locales/en.json
src/i18n/locales/ko.json
web/src/pages/prompting/index.tsx
web/src/styles/prompt.css
web/tests/prompting/prompting-page-eval-tab.test.tsx
web/tests/prompting/prompting-page-manage-tabs.test.tsx
```

audit-scan type-safety: (none found)
audit-scan hardcoded: (none found)

### Residual Risk

- 워크스페이스 라우트(`/workspace`)는 아직 제거 안 됨 — FE-PE-5에서 cleanup
- manage 탭의 세부 FE-DS 토큰 적용은 FE-PE-5에서 진행
- FE-0 bidirectional gap (26 pages; most lack smoke tests)은 FE-REG에서 해소
