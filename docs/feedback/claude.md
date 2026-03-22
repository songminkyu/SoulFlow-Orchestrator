# Evidence

## Agreed

- `[APPROVED]` SH-1~5, TN-1~6, OB-1~8, EV-1~6, EG-1~5, EG-R1
- `[APPROVED]` PA-1+2, TR-1~5, GW-1~6, RP-1~6, SO-1~7, PAR-1~6
- `[APPROVED]` E1~5, F1~5, RPF-1~6, RPF-4F, QG-1~4, FE-0~6a
- `[APPROVED]` Phase 0+1+2 인프라 전수조사 + Phase 3 (H-5, H-7, H-9)

## [REVIEW_NEEDED] Unified Closeout — FE-PE-1 + AP-2 + IC-1~8b (round 4)

통합 증거: 마지막 `[APPROVED]` (523eeb53) 이후 누적 15커밋, 89파일.

### Forward RTM Rows

| Req ID | File | Exists | Impl | Test Case | Test Result | Status |
|--------|------|--------|------|-----------|-------------|--------|
| FE-PE-1 | web/src/pages/prompting/index.tsx | ✅ | ✅ | web/tests/prompting/prompting-page-manage-tabs.test.tsx::11탭 + manage 진입 8건 | ✓ pass | done |
| FE-PE-1 | web/src/styles/prompt.css | ✅ | ✅ | web/tests/prompting/prompting-css-rules.test.ts::ps-tabs CSS 셀렉터 4건 | ✓ pass | done |
| FE-PE-1 | src/i18n/locales/en.json | ✅ | ✅ | web/tests/prompting/prompting-locale-keys.test.ts::en 12키 | ✓ pass (12) | done |
| FE-PE-1 | src/i18n/locales/ko.json | ✅ | ✅ | web/tests/prompting/prompting-locale-keys.test.ts::ko 12키 | ✓ pass (12) | done |
| AP-2 | src/utils/sqlite-helper.ts | ✅ | ✅ | (factory 유일 진입점 — new Database 0건 외부) | tsc pass | done |
| AP-2 | src/orchestration/skill-index.ts | ✅ | ✅ | (open_sqlite 사용) | tsc pass | done |
| IC-1 | src/security/outbound-guard.ts | ✅ | ✅ | tests/security/outbound-guard.test.ts::16건 | ✓ pass (16) | done |
| IC-2 | web/src/pages/prompting/profile-editor.tsx | ✅ | ✅ | web/tests/pages/prompting/agent-modal.test.tsx::4탭 검증 | ✓ pass | done |
| IC-3 | web/src/pages/channels/index.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::dispatch-mode-chip | ✓ pass | done |
| IC-3 | web/src/pages/chat/chat-status-bar.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::delivery-health | ✓ pass | done |
| IC-3 | web/src/pages/settings.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::local-first-summary | ✓ pass | done |
| IC-3 | web/src/pages/providers/index.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::deploy-meta | ✓ pass | done |
| IC-3 | web/src/pages/admin/monitoring-panel.tsx | ✅ | ✅ | web/tests/regression/ic3-badge-chips.test.ts::relay-status | ✓ pass | done |
| IC-4 | web/src/api/contracts.ts | ✅ | ✅ | tests/architecture/fe-be-contract-drift.test.ts::BE ⊆ FE 4건 | ✓ pass | done |
| IC-4 | src/contracts/api-responses.ts | ✅ | ✅ | tests/architecture/fe-be-contract-drift.test.ts::BE types 존재 | ✓ pass | done |
| IC-5 | src/dashboard/routes/chat.ts | ✅ | ✅ | tests/dashboard/canvas-action.test.ts::canvas-action 6건 | ✓ pass | done |
| IC-7 | web/src/pages/workflows/detail.tsx | ✅ | ✅ | web/tests/regression/ic7-gw-workflow-detail.test.ts::6건 | ✓ pass | done |
| IC-7 | web/src/pages/workspace/references.tsx | ✅ | ✅ | web/tests/regression/ic7-tr5-references.test.ts::4건 | ✓ pass | done |
| IC-8a | src/bus/types.ts | ✅ | ✅ | (RichPayload + RichEmbed + RichAction 타입) | tsc pass | done |
| IC-8a | src/channels/rich-payload-builder.ts | ✅ | ✅ | (build_rich_payload 빌더) | tsc pass | done |
| IC-8a | src/channels/discord.channel.ts | ✅ | ✅ | (to_discord_embed + to_discord_components) | tsc pass | done |
| IC-8a | src/channels/slack.channel.ts | ✅ | ✅ | (to_slack_blocks + to_slack_action_block) | tsc pass | done |
| IC-8a | src/channels/telegram.channel.ts | ✅ | ✅ | (to_telegram_html + to_telegram_inline_keyboard) | tsc pass | done |
| IC-8a | web/src/pages/chat/rich-message-card.tsx | ✅ | ✅ | (RichMessageCard 컴포넌트) | tsc pass | done |
| IC-8a | web/src/styles/chat.css | ✅ | ✅ | (rich-action-btn 스타일) | tsc pass | done |
| IC-8b | src/channels/approval.service.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::ApprovalService 4건 | ✓ pass | done |
| IC-8b | src/channels/telegram.channel.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Telegram 5건 | ✓ pass | done |
| IC-8b | src/dashboard/routes/channel-callbacks.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Discord 5건 + Slack 7건 | ✓ pass | done |
| IC-8b | src/dashboard/service.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::Dashboard 5건 | ✓ pass | done |
| IC-8b | src/dashboard/service.types.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::옵션 타입 | ✓ pass | done |
| IC-8b | src/bootstrap/dashboard.ts | ✅ | ✅ | tests/channels/ic8b-button-callbacks.test.ts::bootstrap 호출 (CL-2) | ✓ pass | done |

### Claim

**FE-PE-1**: 프롬프팅 스튜디오 11탭(Creative 7 + Manage 4) 재구조화. i18n 12키, CSS 3셀렉터, aria-label i18n.

**AP-2**: SQLite Connection Factory Port — 6개 파일 `with_sqlite`/`open_sqlite` 전환 완료. raw `new Database` 0건.

**IC-1**: OutboundRequestGuard port + trust-zone badge.

**IC-2**: Profile Editor — role selector + protocol checklist + compile preview + agent-modal 4탭.

**IC-3**: 8개 트랙 FE badge/chip 일괄 구현 (dispatch-mode, delivery-health, relay-status, deploy-meta, local-first-summary).

**IC-4**: contracts.ts 10타입 추가 + 12개 인라인 useQuery → import 전환. FE-BE drift guard.

**IC-5**: canvas-action BE 핸들러 + validate:skills npm script.

**IC-7**: Closeout regression 4종 (GW-5/6, TR-5, OutboundRequestGuard, contract drift).

**IC-8a**: RichPayload + 4채널 embed 렌더링 (Discord/Slack/Telegram/Web).

**IC-8b**: RichAction + 4채널 버튼 전송 + 콜백 수신 완성.
- Discord: Ed25519 필수 검증 + PING/COMPONENT 핸들러.
- Slack: HMAC-SHA256 서명 검증 + 리플레이 방지 + 3초 응답.
- Telegram: callback_query 폴링 + answerCallbackQuery.
- bootstrap 연결: `register_channel_callbacks()` 호출 확인.

### Changed Files (89파일 — 전체 누적 diff 523eeb53..HEAD)

**BE Core:**
- `src/agent/tools/http-utils.ts` — OutboundRequestGuard port 경유
- `src/bootstrap/orchestration.ts` — OrchSecurityDeps 추가
- `src/bootstrap/dashboard.ts` — register_channel_callbacks() 호출
- `src/bus/types.ts` — RichPayload, RichEmbed, RichAction 타입
- `src/channels/approval.service.ts` — try_handle_button_callback + source "button"
- `src/channels/discord.channel.ts` — embed + component button 전송
- `src/channels/rich-payload-builder.ts` — build_rich_payload 빌더
- `src/channels/slack.channel.ts` — Block Kit + action button 전송
- `src/channels/telegram.channel.ts` — HTML embed + inline keyboard + callback_query
- `src/contracts/api-responses.ts` — BE 공유 타입
- `src/dashboard/routes/auth.ts` — auth 라우트
- `src/dashboard/routes/channel-callbacks.ts` — Discord interaction + Slack action 엔드포인트
- `src/dashboard/routes/chat.ts` — canvas-action 핸들러
- `src/dashboard/routes/health.ts` — health 라우트
- `src/dashboard/service.ts` — register_channel_callbacks + import
- `src/dashboard/service.types.ts` — discord_public_key, slack_signing_secret
- `src/i18n/locales/en.json` — prompting tab 12키 + channels/IC-3 키
- `src/i18n/locales/ko.json` — 동일
- `src/orchestration/skill-index.ts` — open_sqlite 전환
- `src/security/outbound-guard.ts` — OutboundRequestGuardLike port
- `src/utils/sqlite-helper.ts` — open_sqlite factory

**FE Pages:**
- `web/src/api/contracts.ts` — FE 공유 타입 42개
- `web/src/components/mention-picker.tsx` — ApiMcpServerList import
- `web/src/components/shared/unified-selector.tsx` — import 전환
- `web/src/components/tool-choice-toggle.tsx` — import 전환
- `web/src/components/tool-feature-menu.tsx` — import 전환
- `web/src/hooks/use-auth.ts`, `web/src/hooks/use-team-providers.ts`, `web/src/layouts/root.tsx` — auth
- `web/src/pages/admin/monitoring-panel.tsx` — relay-status badge
- `web/src/pages/channels/index.tsx` — dispatch-mode chip
- `web/src/pages/chat.tsx` — canvas-action consumer
- `web/src/pages/chat/chat-status-bar.tsx` — delivery-health badge
- `web/src/pages/chat/rich-message-card.tsx` — RichMessageCard + ActionBar
- `web/src/pages/login.tsx` — login 페이지
- `web/src/pages/prompting/agent-card.tsx`, `agent-modal.tsx`, `agent-panel.tsx` — profile editor 통합
- `web/src/pages/prompting/compare-panel.tsx`, `eval-panel.tsx`, `gallery-panel.tsx`, `image-panel.tsx`, `video-panel.tsx` — 패널 리팩토링
- `web/src/pages/prompting/index.tsx` — 11탭 재구조화
- `web/src/pages/prompting/profile-editor.tsx` — ProfileEditor 신규
- `web/src/pages/providers/index.tsx` — deploy-meta badge
- `web/src/pages/secrets.tsx` — ApiSecretList import
- `web/src/pages/settings.tsx` — local-first-summary
- `web/src/pages/workflows/builder.tsx` — import 전환
- `web/src/pages/workspace/agents.tsx`, `references.tsx`, `skills.tsx`, `tools.tsx` — import 전환

**Styles:**
- `web/src/styles/chat.css` — rich-action-btn
- `web/src/styles/prompt.css` — ps-tabs__creative/sep/manage

**Tests (root):**
- `tests/architecture/fe-be-contract-drift.test.ts` — IC-4 drift guard 4건
- `tests/channels/ic8b-button-callbacks.test.ts` — IC-8b 콜백 26건
- `tests/dashboard/canvas-action.test.ts` — IC-5 route 6건
- `tests/security/outbound-guard.test.ts` — IC-1 guard 16건

**Tests (web):**
- `web/tests/prompting/prompting-css-rules.test.ts` — FE-PE-1 CSS 4건
- `web/tests/prompting/prompting-locale-keys.test.ts` — FE-PE-1 locale 24건
- `web/tests/prompting/prompting-page-manage-tabs.test.tsx` — FE-PE-1 manage 8건
- `web/tests/prompting/prompting-page-eval-tab.test.tsx` — FE-PE-1 eval 3건
- `web/tests/prompting/eval-panel.test.tsx` — eval 패널
- `web/tests/regression/ic3-badge-chips.test.ts` — IC-3 badge 6건
- `web/tests/regression/ic7-gw-workflow-detail.test.ts` — IC-7 GW 6건
- `web/tests/regression/ic7-tr5-references.test.ts` — IC-7 TR-5 4건
- `web/tests/pages/prompting/agent-modal.test.tsx` — IC-2 4탭
- `web/tests/pages/prompting/agent-panel.test.tsx` — IC-2 패널
- `web/tests/components/mention-picker.test.tsx` — regression mock
- `web/tests/components/shared/prompt-bar-chatview.test.tsx` — regression mock
- `web/tests/components/shared/unified-selector.test.tsx` — regression mock
- `web/tests/components/tool-choice-toggle.test.tsx` — regression mock
- `web/tests/layouts/root-sse-stale.test.tsx` — regression mock
- `web/tests/pages/access-policy.test.ts` — regression mock
- `web/tests/pages/chat-rewire.test.tsx` — regression mock
- `web/tests/pages/chat-state-management.test.tsx` — regression mock
- `web/tests/pages/workflows/nodes/fanout.test.tsx` — regression mock
- `web/tests/pages/workflows/nodes/reconcile.test.tsx` — regression mock
- `web/tests/regression/access-policy-regression.test.ts` — regression mock
- `web/tests/regression/backend-contract.test.tsx` — regression mock
- `web/tests/regression/badge-visibility.test.tsx` — regression mock
- `web/tests/regression/security-rendering.test.tsx` — regression mock
- `web/tests/workspace/tools-usage.test.tsx` — workspace tools

**Config/Infra:**
- `.claude/settings.json`, `docs/feedback/claude.md`, `docs/feedback/gpt.md`
- `package.json`, `run.ps1`, `scripts/container.cjs`, `scripts/detect-container.cjs`

### Test Command

```powershell
# 직접 테스트 — FE-PE-1 (39건)
Set-Location web; npx vitest run tests/prompting/prompting-page-manage-tabs.test.tsx tests/prompting/prompting-page-eval-tab.test.tsx tests/prompting/prompting-locale-keys.test.ts tests/prompting/prompting-css-rules.test.ts

# 직접 테스트 — IC-3 (6건)
npx vitest run tests/regression/ic3-badge-chips.test.ts

# 직접 테스트 — IC-7 web (10건)
npx vitest run tests/regression/ic7-gw-workflow-detail.test.ts tests/regression/ic7-tr5-references.test.ts

# 직접 테스트 — IC-1/4/5/8b root (52건)
Set-Location ..; npx vitest run tests/security/outbound-guard.test.ts tests/architecture/fe-be-contract-drift.test.ts tests/dashboard/canvas-action.test.ts tests/channels/ic8b-button-callbacks.test.ts

# typecheck
npx tsc --noEmit
Set-Location web; npx tsc --noEmit

# 전체 스위트
Set-Location ..; npm test
Set-Location web; npm test
```

### Test Result

```
FE-PE-1 직접 (4 files): 39 passed
IC-3 직접 (1 file): 6 passed
IC-7 web 직접 (2 files): 10 passed
IC-1/4/5/8b root 직접 (4 files): 52 passed

root tsc --noEmit: exit 0
web tsc --noEmit: exit 0

web npm test: 82 files, 966 tests passed
root npm test: 887 files, 17697 tests passed | 2 skipped (889)
```

audit-scan type-safety: (none found)
audit-scan hardcoded: (none found)

### Residual Risk

- IC-6 (cross-track 문서 최종 갱신)은 docs/ 수정 금지 규칙에 의해 보류
- WIP 커밋 4건(AP-2, IC-2, IC-8b, FE-WF) reword는 main force-push 필요하여 보류
