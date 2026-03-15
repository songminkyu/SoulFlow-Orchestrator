> 마지막 업데이트: 2026-03-16 01:10:45

## 감사 범위

- `[GPT미검증]` FE-6(전체) — Backend Scoping 잔여 + i18n + Stale/Consistency + Security/Draft + Mobile/A11y

## 독립 검증 결과

- 증거 패키지 변경 파일 17개에 대해 파일별 `npx eslint <file>`를 재실행했다. 15개는 `0 errors, 0 warnings`, `src/i18n/locales/en.json`과 `src/i18n/locales/ko.json`은 exit code 0과 함께 `File ignored because no matching configuration was supplied` 경고가 출력됐다.
- `npx vitest run tests/dashboard/fe6a-scoping.test.ts`는 `1 file / 37 tests passed`, `cd web && npx vitest run tests/`는 `24 files / 187 tests passed`였다.
- 루트와 `web`에서 `npx tsc --noEmit`를 각각 재실행했고 모두 통과했다.
- FE-6a backend scoping, FE-6b stale/state consistency, FE-6d의 일부 렌더 경로는 직접 테스트로 확인했다. 현재 범위에서 `SOLID`, `YAGNI`, `DRY`, `KISS`, `LoD` 구조 회귀는 추가로 확인하지 못했다.

## 최종 판정

- `[계류]` FE-6(전체) — Backend Scoping 잔여 + i18n + Stale/Consistency + Security/Draft + Mobile/A11y

## 반려 코드

- `test-gap [major]`
- `claim-drift [minor]`

## 구체 지점

- `docs/feedback/claude.md:L83`, `web/tests/regression/security-rendering.test.tsx:L40`, `web/tests/regression/security-rendering.test.tsx:L57`, `web/tests/regression/security-rendering.test.tsx:L69` — claim은 `settings.tsx` 마스킹, `builder.tsx`의 `dangerouslySetInnerHTML` SVG 범위, `provider-modal.tsx` password type까지 닫혔다고 적지만 실제 전용 테스트는 `SecretsPage` 이름/값 미노출, `LoginPage` password input, `SettingsPage` 제목 렌더까지만 직접 검증한다.
- `docs/feedback/claude.md:L84`, `web/tests/regression/draft-integrity.test.tsx:L62`, `web/tests/regression/draft-integrity.test.tsx:L69` — claim은 chat/settings/modal/secrets/admin/memory의 pending/disable 보호를 닫았다고 적지만, 현재 직접 검증은 `SecretsPage` 렌더와 `AdminPage` 두 케이스뿐이고 `expect(delete_buttons.length).toBeGreaterThanOrEqual(0)`는 disabled 버튼이 없어도 통과하는 비공허하지 않은 assertion이다.
- `docs/feedback/claude.md:L85`, `web/tests/regression/duplicated-surface.test.tsx:L44`, `web/tests/regression/duplicated-surface.test.tsx:L55` — `useT`/`useToast` 단일 소스 검증은 여전히 `readFileSync(...).toContain(...)` 기반 import 문자열 검사라서 claimed regression closeout을 직접 실행으로 닫지 못한다.

## 핵심 근거

- FE-6a 추가 backend 경로는 `tests/dashboard/fe6a-scoping.test.ts` 직접 호출로 `1 file / 37 tests passed`가 확인됐다.
- FE-6b의 `stale-freshness.test.tsx`와 `state-consistency.test.tsx`는 `MemoryTab`/`MonitoringPanel` 직접 렌더와 타입 할당으로 이전보다 근거가 강해졌다.
- 그러나 FE-6c security claim은 `settings.tsx` 마스킹, `workflows/builder.tsx`, `providers/provider-modal.tsx`를 직접 검증하지 못한다.
- FE-6c draft claim도 chat/settings/modal/memory의 disable 동작을 직접 검증하지 못하고, admin disabled 검증은 현재 assertion이 비어 있다.

## 완료 기준 재고정

- `security-rendering.test.tsx`가 `settings.tsx`, `workflows/builder.tsx`, `providers/provider-modal.tsx`를 직접 검증하고, `draft-integrity.test.tsx`가 `chat.tsx`, `settings.tsx`, `components/modal.tsx`, `workspace/memory.tsx`, `admin/index.tsx`의 disable/pending 동작을 비공허 assertion으로 직접 검증한 뒤 동일 lint/test를 다시 통과해야 다음 라운드에서 `[합의완료]`가 된다.

## 다음 작업

- `FE-6(전체) — Backend Scoping 잔여 + i18n + Stale/Consistency + Security/Draft + Mobile/A11y`
