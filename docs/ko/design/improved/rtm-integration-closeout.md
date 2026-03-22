# RTM: Integration Closeout (Track U — IC-1..IC-8b)

> Generated: 2026-03-22 | Scout: Claude Opus 4.6
> Updated: 2026-03-23 | V Track test rationalization — all gaps CLOSED
> Source: integration-closeout/work-breakdown.md

---

## 1. Forward RTM

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| IC-1 | OutboundRequestGuardLike port | src/security/outbound-guard.ts | Y | Y | tests/security/outbound-guard.test.ts | FC-1 | done |
| IC-1 | create_outbound_guard factory | src/security/outbound-guard.ts | Y | Y | tests/security/outbound-guard.test.ts | -- | done |
| IC-1 | bootstrap integration | src/bootstrap/orchestration.ts | Y | Y | tests/security/outbound-guard.test.ts | AP-1 | done |
| IC-1 | FE trust-zone badge | web/src/pages/providers/index.tsx | Y | Y | web/tests/smoke/*.test.tsx | FE-4 | done |
| IC-2 | profile-editor.tsx | web/src/pages/prompting/profile-editor.tsx (352L) | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-2 | done |
| IC-2 | agent-modal profile tab | web/src/pages/prompting/agent-modal.tsx (348L) | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-2 | done |
| IC-3.1 | TN-5 agents scope badge | web/src/pages/workspace/agents.tsx | Y | Y | web/tests/smoke/*.test.tsx | FE-4 | done |
| IC-3.2 | OB-7 overview observability card | web/src/pages/overview/index.tsx | Y | Y | web/tests/pages/overview/fe5-validator-surface.test.tsx | FE-5 | done |
| IC-3.3 | QC-4 eval compiler verdict | web/src/pages/workflows/detail.tsx | Y | Y | web/tests/pages/workflows/detail-badges.test.tsx | FE-3 | done |
| IC-3.4 | LF-2 worker dispatch chip | web/src/pages/channels/index.tsx | Y | Y | web/tests/smoke/*.test.tsx | LF-2 | done |
| IC-3.5 | LF-3 relay status badge | web/src/pages/admin/monitoring-panel.tsx | Y | Y | web/tests/pages/admin/monitoring-panel.test.tsx | LF-3 | done |
| IC-3.6 | LF-4 delivery health card | web/src/pages/chat/chat-status-bar.tsx | Y | Y | web/tests/pages/chat-status-bar.test.tsx | LF-4 | done |
| IC-3.7 | LF-5 local-first defaults | web/src/pages/settings.tsx | Y | Y | web/tests/smoke/*.test.tsx | LF-5 | done |
| IC-3.8 | FC-5 provider deployment metadata | web/src/pages/providers/index.tsx | Y | Y | web/tests/smoke/*.test.tsx | FC-5 | done |
| IC-4 | FE shared contract (49 types) | web/src/api/contracts.ts | Y | Y | tests/architecture/fe-be-contract-drift.test.ts | AP-3 | done |
| IC-4 | BE shared contract (37 types) | src/contracts/api-responses.ts | Y | Y | tests/architecture/fe-be-contract-drift.test.ts | AP-3 | done |
| IC-4 | drift guard test | tests/architecture/fe-be-contract-drift.test.ts | Y | Y | self | AP-5 | done |
| IC-5 | canvas-action POST handler | src/dashboard/routes/chat.ts | Y | Y | tests/dashboard/canvas-action.test.ts | FE-BE | done |
| IC-5 | validate:skills npm script | package.json | Y | Y | npm run quality (quality gate) | SA-4 | done |
| IC-6 | Cross-track doc update | docs/ko/design/improved/ (V track) | Y | Y | N/A (docs) | -- | done |
| IC-7 | outbound-guard regression | tests/security/outbound-guard.test.ts | Y | Y | self | IC-1 | done |
| IC-7 | fe-be-contract-drift regression | tests/architecture/fe-be-contract-drift.test.ts | Y | Y | self | IC-4 | done |
| IC-7 | canvas-action regression | tests/dashboard/canvas-action.test.ts | Y | Y | self | IC-5 | done |
| IC-7 | ic8b-button-callbacks regression | tests/channels/ic8b-button-callbacks.test.ts | Y | Y | self | IC-8b | done |
| IC-8a | RichPayload type | src/bus/types.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | IC-8b | done |
| IC-8a | RichEmbed type | src/bus/types.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | IC-8b | done |
| IC-8a | rich-payload-builder | src/channels/rich-payload-builder.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | IC-8b | done |
| IC-8a | Discord embed rendering | src/channels/discord.channel.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | -- | done |
| IC-8a | Slack embed rendering | src/channels/slack.channel.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | -- | done |
| IC-8a | Telegram embed rendering | src/channels/telegram.channel.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | -- | done |
| IC-8b | RichAction type | src/bus/types.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | IC-8a | done |
| IC-8b | Discord buttons + callback | src/channels/discord.channel.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | -- | done |
| IC-8b | Slack buttons + callback | src/channels/slack.channel.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | -- | done |
| IC-8b | Telegram buttons + polling callback | src/channels/telegram.channel.ts | Y | Y | tests/channels/ic8b-button-callbacks.test.ts | -- | done |

## 2. Backward RTM

| Test File | Test Description | Source File | Req ID | Traced |
|-----------|-----------------|-------------|--------|--------|
| tests/security/outbound-guard.test.ts | Outbound request guard port + factory | src/security/outbound-guard.ts | IC-1 | Y |
| web/tests/prompting/*.test.tsx | Profile editor + agent modal | web/src/pages/prompting/ | IC-2 | Y |
| web/tests/smoke/*.test.tsx | FE badge smoke tests (VR-6) | web/src/pages/ | IC-3 | Y |
| web/tests/pages/overview/fe5-validator-surface.test.tsx | Observability card | web/src/pages/overview/ | IC-3.2 | Y |
| web/tests/pages/workflows/detail-badges.test.tsx | Compiler verdict badge | web/src/pages/workflows/ | IC-3.3 | Y |
| web/tests/pages/admin/monitoring-panel.test.tsx | Relay status badge | web/src/pages/admin/ | IC-3.5 | Y |
| web/tests/pages/chat-status-bar.test.tsx | Delivery health card | web/src/pages/chat/ | IC-3.6 | Y |
| tests/architecture/fe-be-contract-drift.test.ts | FE/BE contract drift guard | src/contracts/, web/src/api/ | IC-4 | Y |
| tests/dashboard/canvas-action.test.ts | Canvas action POST handler | src/dashboard/routes/chat.ts | IC-5 | Y |
| tests/channels/ic8b-button-callbacks.test.ts | Rich payload + buttons + callbacks | src/channels/, src/bus/types.ts | IC-8a, IC-8b | Y |

## 3. Bidirectional RTM

| Req ID | Has Code | Has Test | Gap |
|--------|----------|----------|-----|
| IC-1 | Y | Y | -- (OutboundRequestGuardLike port + factory + bootstrap + FE trust-zone badge) |
| IC-2 | Y | Y | -- (profile-editor.tsx + agent-modal profile tab) |
| IC-3 | 8/8 | 8/8 | -- (scope badge, observability card, compiler verdict, dispatch chip, relay badge, delivery health, local-first defaults, deployment metadata) |
| IC-4 | Y | Y | -- (49 FE / 37 BE shared types + drift guard test) |
| IC-5 | Y | Y | -- (canvas-action POST handler + validate:skills npm script) |
| IC-6 | Y | N/A | -- (cross-track docs updated in V track) |
| IC-7 | Y | Y | -- (4 regression test files: outbound-guard, fe-be-contract-drift, canvas-action, ic8b-button-callbacks) |
| IC-8a | Y | Y | -- (RichPayload + RichEmbed + builder + 3-channel embed rendering) |
| IC-8b | Y | Y | -- (RichAction + 3-channel buttons + callbacks: Telegram polling, Discord/Slack HTTP) |

## 4. Gap Summary

All gaps CLOSED. Zero HIGH/MEDIUM/LOW remaining.

| Gap | Req | Severity | Description |
|-----|-----|----------|-------------|
| (none) | -- | -- | All 9 requirements fully implemented and tested |

## 5. Completion: 9/9 done
