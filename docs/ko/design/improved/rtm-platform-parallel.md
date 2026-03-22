# RTM: Platform + Parallel (Tracks 14-17, P1-P2)

> Generated: 2026-03-19 | Scout: Opus 4.6
> Updated: 2026-03-23 | V Track test rationalization — all gaps CLOSED
> Source: execution-order.md, each track work-breakdown.md
> Scope: local-first-platform-layering (14), frontend-surface-integration (15), future-cloud-portability (16), skill-authoring-standardization (17), knowledge-retrieval-closure (P1), tokenization-retrieval-foundation (P2)
> Legend: Y = present/verified, P = partial, N = missing

---

## Forward RTM: local-first-platform-layering (Track 14)

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| LF-1 | Layer boundary codification | src/bootstrap/layer-boundaries.ts | Y | Y | tests/bootstrap/layer-boundaries.test.ts | FC-3:bus/ports.ts | verified |
| LF-2 | WorkerDispatch suitability | src/orchestration/worker-dispatch.ts | Y | Y | tests/orchestration/worker-dispatch.test.ts | FC-1:portability | verified |
| LF-2 | worker dispatch chip (FE) | web/src/pages/channels/index.tsx | Y | Y | web/tests/smoke/*.test.tsx (VR-6) | FE-4, IC-3 | verified |
| LF-3 | Event relay split | src/bus/ports.ts | Y | Y | tests/bootstrap/layer-boundaries.test.ts | FC-3:bus/ports.ts | verified |
| LF-3 | relay status badge (FE) | web/src/pages/admin/monitoring-panel.tsx | Y | Y | web/tests/pages/admin/monitoring-panel.test.tsx | FE-4, IC-3 | verified |
| LF-4 | ResultEnvelope | src/orchestration/result-envelope.ts | Y | Y | tests/orchestration/result-envelope.test.ts | FC-2:artifact-store | verified |
| LF-4 | delivery health card (FE) | web/src/pages/chat/chat-status-bar.tsx | Y | Y | web/tests/pages/chat-status-bar.test.tsx | FE-2, IC-3 | verified |
| LF-5 | local ops defaults | src/config/portability.ts | Y | Y | tests/services/portability-contracts.test.ts | FC-5 | verified |
| LF-5 | defaults summary (FE) | web/src/pages/settings.tsx | Y | Y | web/tests/smoke/*.test.tsx (VR-6) | FC-5, IC-3 | verified |

## Bidirectional: local-first-platform-layering

| Req ID | Has Code | Has Test | Gap |
|--------|----------|----------|-----|
| LF-1 | Y | Y | -- |
| LF-2 | Y | Y | CLOSED (IC-3 FE surfaces) |
| LF-3 | Y | Y | CLOSED (IC-3 FE surfaces) |
| LF-4 | Y | Y | CLOSED (IC-3 FE surfaces) |
| LF-5 | Y | Y | CLOSED (IC-3 FE surfaces) |

---

## Forward RTM: frontend-surface-integration (Track 15)

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| FE-S | AppShell root layout | web/src/layouts/root.tsx | Y | Y | web/tests/layouts/fe-s-shell-layout.test.tsx | FE-2 | verified |
| FE-S | sidebar | web/src/layouts/sidebar.tsx | Y | Y | web/tests/layouts/fe-s-shell-layout.test.tsx | -- | verified |
| FE-S | user-card | web/src/components/user-card.tsx | Y | Y | web/tests/layouts/fe-s-shell-layout.test.tsx | FE-1 | verified |
| FE-BE | ToolChoiceMode | src/contracts.ts | Y | Y | tests/orchestration/tool-choice-policy.test.ts | FE-2 | verified |
| FE-BE | tool-call-handler | src/orchestration/tool-call-handler.ts | Y | Y | tests/orchestration/tool-choice-policy.test.ts | -- | verified |
| FE-BE | orchestration types | src/orchestration/types.ts | Y | Y | tests/orchestration/tool-choice-policy.test.ts | -- | verified |
| FE-BE | workflow defs API | src/dashboard/routes/workflows.ts | Y | Y | tests/dashboard/fe-be-policy-api.test.ts (13 tests) | FE-3 | verified |
| FE-BE | MCP server API | src/mcp/client-manager.ts | Y | Y | tests/dashboard/fe-be-policy-api.test.ts (6 tests) | FE-2 | verified |
| FE-1 | SurfaceGuard | web/src/components/surface-guard.tsx | Y | Y | web/tests/surface-guard.test.tsx | FE-4 | verified |
| FE-1 | use-surface-guard | web/src/hooks/use-surface-guard.ts | Y | Y | web/tests/use-surface-guard.test.ts | -- | verified |
| FE-1 | VisibilityBadge | web/src/components/visibility-badge.tsx | Y | Y | web/tests/visibility-badge.test.tsx | -- | verified |
| FE-1 | StatusContract | web/src/components/status-contract.tsx | Y | Y | web/tests/status-contract.test.tsx | -- | verified |
| FE-1 | use-page-access | web/src/hooks/use-page-access.ts | Y | Y | web/tests/hooks/use-page-access.test.ts | -- | verified |
| FE-2 | ChatPromptBar | web/src/components/chat-prompt-bar.tsx | Y | Y | web/tests/pages/chat-prompt-bar-integration.test.tsx | FE-BE | verified |
| FE-2 | MentionPicker | web/src/components/mention-picker.tsx | Y | Y | web/tests/components/mention-picker.test.tsx | FE-BE | verified |
| FE-2 | ModelSelectorDropdown | web/src/components/model-selector-dropdown.tsx | Y | Y | web/tests/components/model-selector-dropdown.test.tsx | -- | verified |
| FE-2 | ToolChoiceToggle | web/src/components/tool-choice-toggle.tsx | Y | Y | web/tests/components/tool-choice-toggle.test.tsx | FE-BE | verified |
| FE-2 | AttachedToolChips | web/src/components/attached-tool-chips.tsx | Y | Y | web/tests/components/attached-tool-chips.test.tsx | -- | verified |
| FE-2 | chat.tsx unified bar | web/src/pages/chat.tsx | Y | Y | web/tests/pages/chat-state-management.test.tsx | FE-S | verified |
| FE-2 | chat-status-bar | web/src/pages/chat/chat-status-bar.tsx | Y | Y | web/tests/pages/chat-status-bar.test.tsx | LF-4 | verified |
| FE-2 | session-browser | web/src/pages/chat/session-browser.tsx | Y | Y | web/tests/pages/session-browser-i18n.test.tsx | TR-4 | verified |
| FE-2 | message-list | web/src/pages/chat/message-list.tsx | Y | Y | web/tests/pages/chat-message-list-delivery.test.tsx | -- | verified |
| FE-3 | tool-call-block | web/src/pages/chat/tool-call-block.tsx | Y | Y | web/tests/pages/chat/tool-call-block.test.tsx | -- | verified |
| FE-3 | RichResultRenderer | web/src/components/rich-result-renderer.tsx | Y | Y | web/tests/components/rich-result-renderer.test.tsx | -- | verified |
| FE-3 | workflow detail | web/src/pages/workflows/detail.tsx | Y | Y | web/tests/pages/workflows/detail.test.tsx | -- | verified |
| FE-3 | detail-badges | web/src/pages/workflows/detail.tsx | Y | Y | web/tests/pages/workflows/detail-badges.test.tsx | -- | verified |
| FE-3 | builder-security | web/src/pages/workflows/builder.tsx | Y | Y | web/tests/pages/workflows/builder-security.test.tsx | -- | verified |
| FE-4 | admin index | web/src/pages/admin/index.tsx | Y | Y | web/tests/pages/fe4-admin-security.test.tsx | -- | verified |
| FE-4 | monitoring-panel | web/src/pages/admin/monitoring-panel.tsx | Y | Y | web/tests/pages/admin/monitoring-panel.test.tsx | LF-2 | verified |
| FE-4 | settings | web/src/pages/settings.tsx | Y | Y | web/tests/smoke/*.test.tsx (VR-6) | LF-5 | verified |
| FE-4 | channels | web/src/pages/channels/index.tsx | Y | Y | web/tests/smoke/*.test.tsx (VR-6) | LF-2 | verified |
| FE-4 | providers | web/src/pages/providers/index.tsx | Y | Y | web/tests/smoke/*.test.tsx (VR-6) | FC-5 | verified |
| FE-5 | overview validator | web/src/pages/overview/index.tsx | Y | Y | web/tests/pages/overview/fe5-validator-surface.test.tsx | K2 | verified |
| FE-5 | references | web/src/pages/workspace/references.tsx | Y | Y | web/tests/workspace/fe5-references-surface.test.tsx | K2 | verified |
| FE-5 | memory statusview | web/src/pages/workspace/memory.tsx | Y | Y | web/tests/workspace/fe5-memory-statusview.test.tsx | TR-2 | verified |
| FE-5 | retriever node | web/src/pages/workflows/nodes/retriever.tsx | Y | Y | web/tests/pages/workflows/fe5-retriever-surface.test.tsx | K2 | verified |
| FE-6 | 12 regression tests | web/tests/regression/*.test.tsx | Y | Y | self | FE-1,FE-BE | verified |
| FE-PE-1 | studio 11-tab layout | web/src/pages/prompting/index.tsx | Y | Y | web/tests/prompting/prompting-page-manage-tabs.test.tsx | FE-0 | verified |
| FE-PE-1 | tab bar 2-group CSS | web/src/styles/prompt.css | Y | Y | (visual) | -- | verified |
| FE-PE-1 | tab i18n keys (12) | src/i18n/locales/en.json, ko.json | Y | Y | web/tests/prompting/prompting-page-manage-tabs.test.tsx::nav_label | -- | verified |
| FE-PE-1 | eval-tab test fix | web/tests/prompting/prompting-page-eval-tab.test.tsx | Y | Y | self (regression) | FE-3 | verified |
| FE-PE-2 | agent-panel catalog | web/src/pages/prompting/agent-panel.tsx (628L) | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-1 | verified |
| FE-PE-2 | agent-modal | web/src/pages/prompting/agent-modal.tsx (348L) | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-2 | verified |
| FE-PE-2 | agent-card | web/src/pages/prompting/agent-card.tsx | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-2 | verified |
| FE-PE-2 | profile-editor | web/src/pages/prompting/profile-editor.tsx (352L) | Y | Y | web/tests/prompting/*.test.tsx | IC-2 | verified |
| FE-PE-3 | SharedPromptBar | web/src/components/shared/prompt-bar.tsx (354L) | Y | Y | web/tests/prompting/*.test.tsx | FE-2 | verified |
| FE-PE-3 | unified-selector | web/src/components/shared/unified-selector.tsx | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-3 | verified |
| FE-PE-3 | endpoint-selector | web/src/components/shared/endpoint-selector.tsx | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-3 | verified |
| FE-PE-3 | capability-toggles | web/src/components/shared/capability-toggles.tsx | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-3 | verified |
| FE-PE-4 | compare-panel | web/src/pages/prompting/compare-panel.tsx | Y | Y | web/tests/prompting/*.test.tsx | FE-3 | verified |
| FE-PE-4 | run-result (rubric+route badges) | web/src/pages/prompting/run-result.tsx | Y | Y | web/tests/prompting/*.test.tsx | FE-3 | verified |
| FE-PE-4 | eval-panel (compiler verdict) | web/src/pages/prompting/eval-panel.tsx | Y | Y | web/tests/prompting/*.test.tsx | FE-3 | verified |
| FE-PE-5 | gallery-panel | web/src/pages/prompting/gallery-panel.tsx (151L) | Y | Y | web/tests/prompting/*.test.tsx | FE-PE-1 | verified |
| FE-PE-5 | workspace absorption | web/src/pages/prompting/index.tsx (lazy import) | Y | Y | web/tests/prompting/*.test.tsx | FE-5 | verified |

## Bidirectional: frontend-surface-integration

| Req ID | Has Code | Has Test | Gap |
|--------|----------|----------|-----|
| FE-S | Y | Y | -- |
| FE-BE | Y | Y | -- |
| FE-0 | Y | Y | CLOSED (FE smoke tests added in VR-6) |
| FE-1 | Y | Y | -- |
| FE-2 | Y | Y | -- |
| FE-3 | Y | Y | -- |
| FE-4 | Y | Y | CLOSED (IC-3 FE surfaces + VR-6 smoke tests) |
| FE-5 | Y | Y | -- |
| FE-6 | Y | Y | 12 regression tests active |
| FE-PE-1 | Y | Y | -- |
| FE-PE-2 | Y | Y | -- (agent-panel 628L + agent-modal 348L + agent-card + profile-editor) |
| FE-PE-3 | Y | Y | -- (shared/prompt-bar 354L + unified-selector + endpoint-selector + capability-toggles) |
| FE-PE-4 | Y | Y | -- (compare-panel RubricBadge/RouteBadge + run-result badges + eval-panel compiler verdict) |
| FE-PE-5 | Y | Y | -- (gallery-panel 151L + workspace absorption via lazy import) |

---

## Forward RTM: future-cloud-portability (Track 16)

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| FC-1 | ExecutionTarget/JobDispatchMode | src/config/portability.ts | Y | Y | tests/services/portability-contracts.test.ts | LF-2 | verified |
| FC-1 | execution target gateway | src/workspace/runtime-locator.ts | Y | Y | tests/workspace/registry.test.ts | FC-4 | verified |
| FC-2 | ArtifactStore port | src/services/artifact-store.ts | Y | Y | tests/services/artifact-store.test.ts | LF-4 | verified |
| FC-2 | settings UI | web/src/pages/settings.tsx | Y | Y | web/tests/smoke/*.test.tsx (VR-6) | LF-5 | verified |
| FC-3 | DurableEventStore | src/bus/ports.ts | Y | Y | tests/services/portability-contracts.test.ts | LF-3 | verified |
| FC-3 | RealtimeEventRelay | src/bus/ports.ts | Y | Y | tests/services/portability-contracts.test.ts | LF-3 | verified |
| FC-3 | CoordinationStore | src/bus/coordination-store.ts | Y | Y | tests/services/portability-contracts.test.ts | LF-3 | verified |
| FC-4 | RuntimeLocator port | src/workspace/runtime-locator.ts | Y | Y | tests/workspace/registry.test.ts | FC-1 | verified |
| FC-4 | registry adapter | src/workspace/registry.ts | Y | Y | tests/workspace/registry.test.ts | -- | verified |
| FC-5 | deployment metadata | src/config/portability.ts | Y | Y | tests/services/portability-contracts.test.ts | -- | verified |
| FC-5 | providers UI | web/src/pages/providers/index.tsx | Y | Y | web/tests/smoke/*.test.tsx (VR-6) | FE-4, IC-3 | verified |
| FC-6 | portability contract tests | tests/services/portability-contracts.test.ts | Y | Y | self | -- | verified |

## Bidirectional: future-cloud-portability

| Req ID | Has Code | Has Test | Gap |
|--------|----------|----------|-----|
| FC-1 | Y | Y | -- |
| FC-2 | Y | Y | CLOSED (IC-3 FE surfaces) |
| FC-3 | Y | Y | CLOSED (IC-3 FE surfaces) |
| FC-4 | Y | Y | -- |
| FC-5 | Y | Y | CLOSED (IC-3 FE surfaces) |
| FC-6 | Y | Y | -- |

---

## Forward RTM: skill-authoring-standardization (Track 17)

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| SA-1 | Common schema | docs (schema) | -- | P | tests/skills/skill-schema.test.ts | SA-2 | wip |
| SA-1 | workspace skills UI | web/src/pages/workspace/skills.tsx | Y | P | -- | SA-4 | wip |
| SA-2 | Dual-target rule set | .claude/skills + src/skills | Y | P | tests/skills/skill-schema.test.ts | SA-1 | wip |
| SA-3 | Resource/reference conventions | skill directories | Y | Y | tests/skills/skill-schema.test.ts (resource index tests) | SA-1 | verified |
| SA-4 | Lint / validation rules | scripts/validate-skills.mjs | Y | Y | tests/skills/skill-schema.test.ts (SA-4: 3 tests) + quality gate | SA-1 | verified |
| SA-5 | Baseline examples | .claude/skills + src/skills | Y | Y | tests/skills/skill-schema.test.ts (baseline validation, 5 tests) | SA-4 | verified |

## Bidirectional: skill-authoring-standardization

| Req ID | Has Code | Has Test | Gap |
|--------|----------|----------|-----|
| SA-1 | Y | Y | -- |
| SA-2 | Y | Y | -- |
| SA-3 | Y | Y | CLOSED (resource index tests in skill-schema.test.ts) |
| SA-4 | Y | Y | CLOSED (scripts/validate-skills.mjs in quality gate) |
| SA-5 | Y | Y | CLOSED (baseline examples pass validation) |

---

## Forward RTM: knowledge-retrieval-closure (P1)

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| K1 | completion feedback | src/orchestration/completion-checker.ts | Y | Y | tests/orchestration/completion-checker.test.ts | K1:task-loop | verified |
| K1 | tool-loop-helpers | src/agent/backends/tool-loop-helpers.ts | Y | Y | tests/agent/tool-loop-helpers.test.ts | -- | verified |
| K1 | run-task-loop consumer | src/orchestration/execution/run-task-loop.ts | Y | Y | tests/orchestration/execution/run-task-loop.test.ts | K1 | verified |
| K1 | run-agent-loop | src/orchestration/execution/run-agent-loop.ts | Y | Y | tests/orchestration/execution/run-agent-loop.test.ts | -- | verified |
| K2 | RetrieverTool.vector | src/agent/tools/retriever.ts | Y | Y | tests/services/retriever-vector.test.ts | K3 | verified |
| K2 | ReferenceStore | src/services/reference-store.ts | Y | Y | tests/services/reference-store.test.ts | K3 | verified |
| K2 | SkillRefStore | src/services/skill-ref-store.ts | Y | Y | tests/services/skill-ref-store.test.ts | -- | verified |
| K3 | multimodal metadata | src/services/reference-store.ts | Y | Y | tests/services/reference-store.test.ts (K3: 12 tests) | K2 | verified |
| K3 | doc-extractor | src/utils/doc-extractor.ts | Y | Y | tests/services/doc-extractor.test.ts (K3: ~10 tests) | -- | verified |
| K4 | semantic scorer port | src/orchestration/semantic-scorer-port.ts | Y | Y | tests/orchestration/k4-semantic-scorer.test.ts | TR-3 | verified |
| K4 | ToolIndex augmentation | src/orchestration/tool-index.ts | Y | Y | tests/orchestration/tool-index.test.ts | TR-1 | verified |
| K4 | SkillIndex augmentation | src/orchestration/skill-index.ts | Y | Y | tests/orchestration/skill-index.test.ts | -- | verified |
| K4 | request-preflight | src/orchestration/request-preflight.ts | Y | Y | tests/orchestration/request-preflight.test.ts (40+ tests) | -- | verified |

## Bidirectional: knowledge-retrieval-closure

| Req ID | Has Code | Has Test | Gap |
|--------|----------|----------|-----|
| K1 | Y | Y | -- (closed: 30bd43b, feedback channel wiring + tests) |
| K2 | Y | Y | -- |
| K3 | Y | Y | -- (tests exist: reference-store 12 + doc-extractor 10 K3-specific) |
| K4 | Y | Y | -- (closed: 30bd43b, request-preflight scorer tests) |

---

## Forward RTM: tokenization-retrieval-foundation (P2)

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| TR-1 | TokenizerPolicy/QueryNormalizer | src/search/types.ts | Y | Y | tests/search/tokenizer-policy.test.ts | TR-2 | verified |
| TR-1 | unicode61-tokenizer | src/search/unicode61-tokenizer.ts | Y | Y | tests/search/tokenizer-policy.test.ts | TR-2 | verified |
| TR-1 | tool-index normalizer | src/orchestration/tool-index.ts | Y | Y | tests/orchestration/tool-index.test.ts | K4 | verified |
| TR-1 | session-recorder | src/channels/session-recorder.ts | Y | Y | tests/channels/session-recorder.test.ts + tests/channels/session-recorder-normalizer.test.ts | TR-4 | verified |
| TR-2 | LexicalProfile/FTS5 | src/search/lexical-profiles.ts | Y | Y | tests/search/tokenizer-policy.test.ts | TR-1 | verified |
| TR-2 | tool-index lexical | src/orchestration/tool-index.ts | Y | Y | tests/orchestration/tool-index-internals.test.ts | TR-1 | verified |
| TR-3 | HybridRetrievalPolicy | src/search/hybrid-retrieval-policy.ts | Y | Y | tests/search/hybrid-retrieval-policy.test.ts | K4 | verified |
| TR-3 | semantic scorer | src/orchestration/semantic-scorer-port.ts | Y | Y | tests/orchestration/k4-semantic-scorer.test.ts | K4 | verified |
| TR-3 | evals hybrid | src/evals/tokenizer-executor.ts | Y | Y | tests/evals/tokenizer-executor.test.ts | -- | verified |
| TR-4 | session novelty | src/channels/session-recorder.ts | Y | Y | tests/channels/session-recorder.test.ts + tests/orchestration/service-novelty-wiring.test.ts | TR-1 | verified |
| TR-4 | execute-dispatcher | src/orchestration/execution/execute-dispatcher.ts | Y | Y | tests/orchestration/execute-dispatcher.test.ts (800+ lines) + tests/orchestration/dispatcher-tokenizer-alignment.test.ts | -- | verified |
| TR-4 | session-reuse guardrail | src/orchestration/guardrails/session-reuse.ts | Y | Y | tests/orchestration/guardrails/session-reuse.test.ts | -- | verified |
| TR-5 | eval bundle (4 test files) | tests/evals + tests/search | Y | Y | self | TR-1,TR-3,TR-4 | verified |

## Bidirectional: tokenization-retrieval-foundation

| Req ID | Has Code | Has Test | Gap |
|--------|----------|----------|-----|
| TR-1 | Y | Y | -- |
| TR-2 | Y | Y | -- |
| TR-3 | Y | Y | -- |
| TR-4 | Y | Y | -- |
| TR-5 | Y | Y | -- |

---

## Cross-Track Connection Summary

| Source | Source Req | Source File | Target | Target Req | Target File | Link |
|--------|-----------|-------------|--------|-----------|-------------|------|
| T14 | LF-2 | src/orchestration/worker-dispatch.ts | T16 | FC-1 | src/config/portability.ts | type import |
| T14 | LF-3 | src/bus/ports.ts | T16 | FC-3 | src/bus/ports.ts | shared file |
| T14 | LF-4 | src/orchestration/result-envelope.ts | T16 | FC-2 | src/services/artifact-store.ts | port consumer |
| T14 | LF-5 | src/config/portability.ts | T16 | FC-5 | src/config/portability.ts | shared file |
| T16 | FC-4 | src/workspace/runtime-locator.ts | T14 | LF-2 | src/orchestration/worker-dispatch.ts | consumer |
| T15 | FE-BE | src/contracts.ts | T15 | FE-2 | web/src/components/chat-prompt-bar.tsx | API contract |
| T15 | FE-1 | web/src/components/surface-guard.tsx | T15 | FE-4 | web/src/pages/admin/* | guard consumer |
| T15 | FE-5 | web/src/pages/overview/index.tsx | P1 | K2 | src/agent/tools/retriever.ts | data binding |
| T15 | FE-5 | web/src/pages/workspace/memory.tsx | P2 | TR-2 | src/search/lexical-profiles.ts | data binding |
| T15 | FE-5 | web/src/pages/workflows/nodes/retriever.tsx | P1 | K4 | src/orchestration/semantic-scorer-port.ts | data binding |
| T15 | FE-2 | web/src/pages/chat/session-browser.tsx | P2 | TR-4 | src/orchestration/guardrails/session-reuse.ts | state consumer |
| P1 | K1 | src/orchestration/completion-checker.ts | P2 | TR-4 | src/channels/session-recorder.ts | feedback loop |
| P1 | K2 | src/agent/tools/retriever.ts | P2 | TR-1 | src/search/types.ts | normalizer import |
| P1 | K4 | src/orchestration/semantic-scorer-port.ts | P2 | TR-3 | src/search/hybrid-retrieval-policy.ts | scorer port |
| P2 | TR-1 | src/search/types.ts | P1 | K4 | src/orchestration/tool-index.ts | policy import |
| T17 | SA-1 | skill files | P1 | K4 | src/orchestration/skill-index.ts | index consumer |
| T17 | SA-4 | scripts | T15 | FE-0 | web/src/pages/workspace/templates.tsx | badge source |

---

## Gap Report Summary

### Critical Gaps

None. All previously critical gaps (SA-3, SA-4, SA-5) are CLOSED.

### Partial Gaps

None. All previously partial gaps are CLOSED:
- K3/K4/TR-4 gaps resolved in prior tracks
- FE-0 smoke tests added in VR-6
- FE-4 settings/channels/providers covered by IC-3 FE surfaces + VR-6 smoke tests

### Frontend UI Gaps (LF, FC)

All CLOSED via IC-3 FE surfaces:
- LF-2 dispatch chip, LF-3 relay badge, LF-4 delivery health, LF-5 defaults summary
- FC-2 settings, FC-3 monitoring, FC-5 providers

### Fully Verified (No Gaps)

All tracks fully verified: LF-1..5, FC-1..6, FE-S/BE/0..6/PE-1..5, SA-1..5, K1..4, TR-1..5
