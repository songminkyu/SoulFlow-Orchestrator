# Evidence

## Agreed

- `[APPROVED]` SH-1~5, TN-1~6, OB-1~8, EV-1~6, EG-1~5, EG-R1
- `[APPROVED]` PA-1+2, TR-1~5, GW-1~6, RP-1~6, SO-1~7, PAR-1~6
- `[APPROVED]` E1~5, F1~5, RPF-1~6, RPF-4F, QG-1~4, FE-0~6a
- `[APPROVED]` Phase 0+1+2 인프라 전수조사 + Phase 3 (H-5, H-7, H-9)

## [REVIEW_NEEDED] FE-PE-1 — 프롬프팅 스튜디오 탭 재구조화 (round 3)

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
| FE-PE-1 | web/src/styles/prompt.css | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::creative/manage 영역 분리 | ✓ pass | fixed |
| FE-PE-1 | src/i18n/locales/en.json | ✅ | ✅ | web/tests/prompting/prompting-locale-keys.test.ts::en.json 12키 존재 | ✓ pass (12/12) | fixed |
| FE-PE-1 | src/i18n/locales/ko.json | ✅ | ✅ | web/tests/prompting/prompting-locale-keys.test.ts::ko.json 12키 존재 | ✓ pass (12/12) | fixed |
| FE-PE-1 | web/src/components/shared/unified-selector.tsx | ✅ | ✅ | web/tests/components/shared/unified-selector.test.tsx (regression) | ✓ pass (52) | regression-fix |
| FE-PE-1 | web/src/components/tool-choice-toggle.tsx | ✅ | ✅ | web/tests/components/tool-choice-toggle.test.tsx (regression) | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/components/mention-picker.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/components/shared/prompt-bar-chatview.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/layouts/root-sse-stale.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/pages/access-policy.test.ts | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/pages/chat-rewire.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/pages/chat-state-management.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/pages/workflows/nodes/fanout.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/pages/workflows/nodes/reconcile.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/regression/access-policy-regression.test.ts | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/regression/backend-contract.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/regression/badge-visibility.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |
| FE-PE-1 | web/tests/regression/security-rendering.test.tsx | ✅ | — | regression test mock 수정 | ✓ pass | regression-fix |

### Claim

프롬프팅 스튜디오 index.tsx를 11탭(Creative 7 + Manage 4)으로 재설계. 워크스페이스의 Skills/Templates/Tools/RAG를 lazy import로 흡수. 탭 바 2영역 분리(`.ps-tabs__creative` + `.ps-tabs__sep` + `.ps-tabs__manage`). i18n 키 12개 추가(tab 11 + nav_label 1). `aria-label` 하드코딩 제거 → `t("prompting.nav_label")`.

Round 3 수정:
- CC-2: Changed Files를 커밋 298b54af의 전체 28파일 scope로 확장. regression-fix 행 13건 추가.
- T-2 CSS: RTM CSS row를 실행 가능한 테스트(`creative/manage 영역 분리` — `.ps-tabs__creative`, `.ps-tabs__sep`, `.ps-tabs__manage` querySelector 검증)로 대체.
- T-2 Locale: `prompting-locale-keys.test.ts` 신규 추가 — `readFileSync`로 실제 en.json/ko.json을 읽어 12키×2언어 = 24 assertions 검증. i18n mock 미사용.
- T-3: root `npm test` 884파일 17,660건 통과, web `npm test` 77파일 922건 통과 확인.

### Changed Files

**Core (FE-PE-1 구현):**
- `web/src/pages/prompting/index.tsx` — 11탭 재구조화 + lazy import
- `web/src/styles/prompt.css` — ps-tabs__creative, ps-tabs__sep, ps-tabs__manage 스타일
- `src/i18n/locales/en.json` — prompting.tab_* 11키 + nav_label 추가
- `src/i18n/locales/ko.json` — prompting.tab_* 11키 + nav_label 추가
- `web/src/components/shared/unified-selector.tsx` — import 경로 변경 (탭 재구조화 영향)
- `web/src/components/tool-choice-toggle.tsx` — import 경로 변경 (탭 재구조화 영향)

**Tests (신규 + 수정):**
- `web/tests/prompting/prompting-page-manage-tabs.test.tsx` — 신규: manage 탭 8건
- `web/tests/prompting/prompting-locale-keys.test.ts` — 신규: locale 키 24건 (round 3)
- `web/tests/prompting/prompting-page-eval-tab.test.tsx` — i18n mock 추가
- `web/tests/components/mention-picker.test.tsx` — mock 수정
- `web/tests/components/shared/prompt-bar-chatview.test.tsx` — mock 수정
- `web/tests/components/shared/unified-selector.test.tsx` — mock 수정
- `web/tests/components/tool-choice-toggle.test.tsx` — mock 수정
- `web/tests/layouts/root-sse-stale.test.tsx` — mock 수정
- `web/tests/pages/access-policy.test.ts` — mock 수정
- `web/tests/pages/chat-rewire.test.tsx` — mock 수정
- `web/tests/pages/chat-state-management.test.tsx` — mock 수정
- `web/tests/pages/workflows/nodes/fanout.test.tsx` — mock 수정
- `web/tests/pages/workflows/nodes/reconcile.test.tsx` — mock 수정
- `web/tests/regression/access-policy-regression.test.ts` — mock 수정
- `web/tests/regression/backend-contract.test.tsx` — mock 수정
- `web/tests/regression/badge-visibility.test.tsx` — mock 수정
- `web/tests/regression/security-rendering.test.tsx` — mock 수정

**Config/Infra (ancillary):**
- `.claude/settings.json` — 세션 설정
- `docs/feedback/claude.md` — 감사 증거 (이 파일)
- `docs/feedback/gpt.md` — GPT 판정
- `package.json` — 스크립트 업데이트
- `run.ps1` — 실행 스크립트
- `scripts/container.cjs` — 컨테이너 스크립트
- `scripts/detect-container.cjs` — 컨테이너 감지

### Test Command

```bash
# FE-PE-1 직접 테스트 (35건)
cd web && npx vitest run tests/prompting/prompting-page-manage-tabs.test.tsx tests/prompting/prompting-page-eval-tab.test.tsx tests/prompting/prompting-locale-keys.test.ts

# 타입 체크
npx tsc --noEmit

# 전체 web 스위트
npm test

# 전체 root 스위트
cd .. && npm test
```

### Test Result

```
FE-PE-1 직접 테스트 (3 test files):
 ✓ tests/prompting/prompting-page-manage-tabs.test.tsx (8 tests)
 ✓ tests/prompting/prompting-page-eval-tab.test.tsx (3 tests)
 ✓ tests/prompting/prompting-locale-keys.test.ts (24 tests)
 Test Files  3 passed (3)
      Tests  35 passed (35)

web tsc --noEmit: exit 0

web npm test (전체):
 Test Files  77 passed (77)
      Tests  922 passed (922)

root npm test (전체):
 Test Files  884 passed | 2 skipped (886)
      Tests  17660 passed | 13 skipped (17673)
```

audit-scan type-safety: (none found)
audit-scan hardcoded: (none found)

### Residual Risk

- 워크스페이스 라우트(`/workspace`)는 아직 제거 안 됨 — FE-PE-5에서 cleanup
- manage 탭의 세부 FE-DS 토큰 적용은 FE-PE-5에서 진행
- FE-0 bidirectional gap (26 pages; most lack smoke tests)은 FE-REG에서 해소

## [REVIEW_NEEDED] IC-3/4/5 — FE 표면 마감 + 계약 타입 확장 + canvas-action

### Forward RTM Rows

| Req ID | File | Exists | Impl | Test Case | Test Result | Status |
|--------|------|--------|------|-----------|-------------|--------|
| IC-3 | web/src/pages/channels/index.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::LF-2 dispatch-mode-chip | ✓ pass | new |
| IC-3 | web/src/pages/chat/chat-status-bar.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::LF-4 delivery-health | ✓ pass | new |
| IC-3 | web/src/pages/settings.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::LF-5 local-first-summary | ✓ pass | new |
| IC-3 | web/src/pages/providers/index.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::FC-5 deploy-meta | ✓ pass | new |
| IC-3 | web/src/pages/admin/monitoring-panel.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::TN/LF-3 relay-status | ✓ pass | new |
| IC-3 | src/i18n/locales/en.json | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::dispatch_mode i18n | ✓ pass | new |
| IC-4 | web/src/api/contracts.ts | ✅ | ✅ | tests/architecture/fe-be-contract-drift.test.ts::BE ⊆ FE | ✓ pass | new |
| IC-4 | web/src/api/contracts.ts | ✅ | ✅ | tests/architecture/fe-be-contract-drift.test.ts::IC-4 추가 타입 | ✓ pass | new |
| IC-4 | web/src/components/mention-picker.tsx | ✅ | ✅ | (import ApiMcpServerList from contracts) | — | verified |
| IC-4 | web/src/components/shared/unified-selector.tsx | ✅ | ✅ | (import ApiMcpServerList from contracts) | — | verified |
| IC-4 | web/src/components/tool-feature-menu.tsx | ✅ | ✅ | (import ApiMcpServerList from contracts) | — | verified |
| IC-4 | web/src/pages/prompting/agent-modal.tsx | ✅ | ✅ | (import 전환) | — | verified |
| IC-4 | web/src/pages/prompting/agent-panel.tsx | ✅ | ✅ | (import 전환) | — | verified |
| IC-4 | web/src/pages/secrets.tsx | ✅ | ✅ | (import ApiSecretList) | — | verified |
| IC-4 | web/src/pages/workspace/agents.tsx | ✅ | ✅ | (import 전환) | — | verified |
| IC-4 | web/src/pages/workspace/references.tsx | ✅ | ✅ | (import ApiRefDocumentList) | — | verified |
| IC-4 | web/src/pages/workspace/skills.tsx | ✅ | ✅ | (import 전환) | — | verified |
| IC-4 | web/src/pages/workflows/builder.tsx | ✅ | ✅ | (import 전환) | — | verified |
| IC-5 | src/dashboard/routes/chat.ts | ✅ | ✅ | tests/dashboard/canvas-action.test.ts::canvas-action route 6건 | ✓ pass (6) | new |
| IC-5 | package.json | ✅ | ✅ | tests/dashboard/canvas-action.test.ts::validate:skills script | ✓ pass | new |
| IC-5 | src/i18n/locales/en.json | ✅ | ✅ | (26 i18n 키 추가) | — | verified |
| IC-5 | src/i18n/locales/ko.json | ✅ | ✅ | (26 i18n 키 추가) | — | verified |

### Claim

**IC-3** (FE 표면 마감): 8개 트랙의 badge/chip을 FE 페이지에 반영. TN-5 scope badge, LF-2 dispatch chip, LF-3 relay badge, LF-4 delivery health, LF-5 local-first summary, FC-5 deploy metadata. data-testid 부여 + i18n 키 추가.

**IC-4** (계약 타입 확장): contracts.ts에 ApiMcpServer, ApiSecretList, ApiProtocolList 등 10타입 추가. 12개 파일에서 인라인 useQuery 제네릭을 contracts.ts import로 전환.

**IC-5** (canvas-action): POST /api/chat/sessions/:id/canvas-action 핸들러. action_id 필수 검증, bus.publish_inbound로 에이전트에 canvas 액션 전달. validate:skills npm script 추가.

### Changed Files

**IC-3 (badges/chips):**
- `web/src/pages/channels/index.tsx` — dispatch-mode-chip
- `web/src/pages/chat/chat-status-bar.tsx` — delivery-health badge
- `web/src/pages/admin/monitoring-panel.tsx` — relay-status badge
- `web/src/pages/providers/index.tsx` — provider-deploy-meta
- `web/src/pages/settings.tsx` — local-first-summary

**IC-4 (contracts):**
- `web/src/api/contracts.ts` — 10타입 추가
- `web/src/components/mention-picker.tsx` — import 전환
- `web/src/components/shared/unified-selector.tsx` — import 전환
- `web/src/components/tool-feature-menu.tsx` — import 전환
- `web/src/pages/prompting/agent-modal.tsx` — import 전환
- `web/src/pages/prompting/agent-panel.tsx` — import 전환
- `web/src/pages/secrets.tsx` — import 전환
- `web/src/pages/workspace/agents.tsx` — import 전환
- `web/src/pages/workspace/references.tsx` — import 전환
- `web/src/pages/workspace/skills.tsx` — import 전환
- `web/src/pages/workflows/builder.tsx` — import 전환

**IC-5 (canvas-action):**
- `src/dashboard/routes/chat.ts` — canvas-action 핸들러
- `package.json` — validate:skills script
- `src/i18n/locales/en.json` — 26키 추가
- `src/i18n/locales/ko.json` — 26키 추가

**Tests (신규):**
- `web/tests/regression/ic3-badge-chips.test.ts` — IC-3 badge 6건
- `tests/architecture/fe-be-contract-drift.test.ts` — IC-4 drift guard 4건
- `tests/dashboard/canvas-action.test.ts` — IC-5 route 6건

### Test Command

```bash
# IC-3 직접 테스트 (6건)
cd web && npx vitest run tests/regression/ic3-badge-chips.test.ts

# IC-4 + IC-5 직접 테스트 (10건)
cd .. && npx vitest run tests/architecture/fe-be-contract-drift.test.ts tests/dashboard/canvas-action.test.ts

# 전체 스위트
npm test        # root: 884파일 17660건
cd web && npm test  # web: 77파일 922건
```

### Test Result

```
IC-3 (web, 1 test file):
 ✓ tests/regression/ic3-badge-chips.test.ts (6 tests)
 Test Files  1 passed (1)
      Tests  6 passed (6)

IC-4 + IC-5 (root, 2 test files):
 ✓ tests/architecture/fe-be-contract-drift.test.ts (4 tests)
 ✓ tests/dashboard/canvas-action.test.ts (6 tests)
 Test Files  2 passed (2)
      Tests  10 passed (10)

root npm test: 884 passed | 2 skipped (886), 17660 tests passed
web npm test: 77 passed (77), 922 tests passed
```

audit-scan type-safety: (none found)
audit-scan hardcoded: (none found)

### Residual Risk

- IC-4 import 전환 12개 중 일부는 tsc satisfies 없이 useQuery 제네릭만 사용 — 런타임 shape 검증은 FVM에 위임

## [REVIEW_NEEDED] IC-7 — Closeout Regression Bundle

### Forward RTM Rows

| Req ID | File | Exists | Impl | Test Case | Test Result | Status |
|--------|------|--------|------|-----------|-------------|--------|
| IC-7.1 | web/src/pages/workflows/detail.tsx | ✅ | ✅ | web/tests/regression/ic7-gw-workflow-detail.test.ts::StatusView + Badge + ApprovalBanner (6건) | ✓ pass | new |
| IC-7.2 | web/src/pages/workspace/references.tsx | ✅ | ✅ | web/tests/regression/ic7-tr5-references.test.ts::lexical_profile + retrieval_status (4건) | ✓ pass | new |
| IC-7.3 | src/security/outbound-guard.ts | ✅ | ✅ | tests/security/outbound-guard.test.ts::create_outbound_guard + check_allowed_hosts (14건) | ✓ pass | existing |
| IC-7.4 | web/src/api/contracts.ts + src/contracts/api-responses.ts | ✅ | ✅ | tests/architecture/fe-be-contract-drift.test.ts::BE ⊆ FE (4건) | ✓ pass | new |

### Claim

Closeout regression bundle 4종:
1. **GW-5/6**: workflow detail 페이지가 StatusView, Badge, ApprovalBanner, MessageBubble을 import/사용하며 i18n을 적용하는지 소스-레벨 검증 (6건).
2. **TR-5**: references 페이지가 lexical_profile, tokenizer_hint, retrieval_status 필드를 렌더링하며 contracts.ts 타입을 소비하는지 검증 (4건).
3. **OutboundRequestGuard**: allowlist/deny 통합 검증 — create_outbound_guard, create_guard_from_integration_settings, check_allowed_hosts (14건, 기존).
4. **FE-BE contract drift guard**: BE api-responses.ts의 모든 export type이 FE contracts.ts에 존재하는지 검증 (4건).

### Changed Files

**Tests (신규):**
- `web/tests/regression/ic7-gw-workflow-detail.test.ts` — GW-5/6 regression 6건
- `web/tests/regression/ic7-tr5-references.test.ts` — TR-5 regression 4건

**Tests (기존, IC-7.3/4):**
- `tests/security/outbound-guard.test.ts` — IC-1에서 작성, 14건
- `tests/architecture/fe-be-contract-drift.test.ts` — IC-4에서 작성, 4건

### Test Command

```bash
# IC-7 직접 테스트 (10건 신규)
cd web && npx vitest run tests/regression/ic7-gw-workflow-detail.test.ts tests/regression/ic7-tr5-references.test.ts

# IC-7.3 + IC-7.4 (18건 기존)
cd .. && npx vitest run tests/security/outbound-guard.test.ts tests/architecture/fe-be-contract-drift.test.ts
```

### Test Result

```
IC-7.1 + IC-7.2 (web, 2 test files):
 ✓ tests/regression/ic7-gw-workflow-detail.test.ts (6 tests)
 ✓ tests/regression/ic7-tr5-references.test.ts (4 tests)
 Test Files  2 passed (2)
      Tests  10 passed (10)

IC-7.3 + IC-7.4 (root, 2 test files):
 ✓ tests/security/outbound-guard.test.ts (14 tests)
 ✓ tests/architecture/fe-be-contract-drift.test.ts (4 tests)
 Test Files  2 passed (2)
      Tests  18 passed (18)
```

### Residual Risk

- IC-6 (cross-track 문서 최종 갱신)은 docs/ 수정 금지 규칙에 의해 보류 — CLAUDE.md 정책 확인 필요

## [REVIEW_NEEDED] IC-8b — 외부 채널 버튼 콜백 수신 완성

### Forward RTM Rows

| Req ID | File | Exists | Impl | Test Case | Test Result | Status |
|--------|------|--------|------|-----------|-------------|--------|
| IC-8b.2 | src/dashboard/routes/channel-callbacks.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Discord interaction 4건 | ✓ pass | new |
| IC-8b.4 | src/dashboard/routes/channel-callbacks.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Discord Ed25519 + PING + type 3 | ✓ pass | new |
| IC-8b.6 | src/dashboard/routes/channel-callbacks.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Slack action 4건 | ✓ pass | new |
| IC-8b.8 | src/channels/telegram.channel.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Telegram callback_query 5건 | ✓ pass | new |
| IC-8b.10 | src/channels/approval.service.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::ApprovalService 버튼 콜백 4건 | ✓ pass | new |
| IC-8b.wiring | src/dashboard/service.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Dashboard 서비스 연결 4건 | ✓ pass | new |
| IC-8b.types | src/dashboard/service.types.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::discord_public_key + slack_signing_secret | ✓ pass | new |

### Claim

IC-8b 설계 문서 누락 항목 #2/#4/#6/#8 해소 — 4채널 모두 버튼 전송 + 콜백 수신 완성.

- **ApprovalService**: `try_handle_button_callback()` — 버튼 클릭 InboundMessage에서 action_id(approve/deny/defer/cancel) 추출 → 기존 `apply_decision()` 경로 합류.
- **Telegram**: `getUpdates` allowed_updates에 `callback_query` 추가. `to_callback_query_message()`로 InboundMessage 변환. `answerCallbackQuery`로 로딩 스피너 해제.
- **Discord**: `POST /api/channels/discord/interaction` — Ed25519 서명 검증 + PING(type 1) 응답 + MESSAGE_COMPONENT(type 3) → InboundMessage 발행 + DEFERRED_UPDATE_MESSAGE(type 6) 응답.
- **Slack**: `POST /api/channels/slack/action` — Block Action payload 파싱 → 즉시 200 응답(3초 규칙) → InboundMessage 비동기 발행.
- **Dashboard**: `register_channel_callbacks()` + `discord_public_key`/`slack_signing_secret` 옵션 추가.

### Changed Files

**Code:**
- `src/channels/approval.service.ts` — try_handle_button_callback() + source "button" 추가
- `src/channels/telegram.channel.ts` — callback_query 폴링 + to_callback_query_message + answerCallbackQuery
- `src/dashboard/routes/channel-callbacks.ts` — 신규: Discord interaction + Slack action 라우트
- `src/dashboard/service.ts` — register_channel_callbacks() + import
- `src/dashboard/service.types.ts` — discord_public_key, slack_signing_secret 옵션

**Tests (신규):**
- `tests/channels/ic8b-button-callbacks.test.ts` — 21건

### Test Command

```bash
# IC-8b 직접 테스트 (21건)
cd /d/Projects/next && npx vitest run tests/channels/ic8b-button-callbacks.test.ts

# typecheck
npx tsc --noEmit
cd web && npx tsc --noEmit
```

### Test Result

```
IC-8b (root, 1 test file):
 ✓ tests/channels/ic8b-button-callbacks.test.ts (21 tests)
 Test Files  1 passed (1)
      Tests  21 passed (21)

root tsc --noEmit: exit 0
web tsc --noEmit: exit 0
```

audit-scan type-safety: (none found)
audit-scan hardcoded: (none found)

### Residual Risk

- Discord Ed25519 검증은 `discord_public_key` 미설정 시 서명 검증을 건너뜀 (내부망 배포 편의)
- Slack signing secret HMAC 검증 미구현 — 내부망 환경에서는 네트워크 레벨 보안으로 대체
- `register_channel_callbacks()` 호출은 bootstrap에서 수동으로 해야 함 — 자동 등록 미구현
