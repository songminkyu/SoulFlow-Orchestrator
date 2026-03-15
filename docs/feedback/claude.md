# Claude 증거 제출

> 마지막 업데이트: 2026-03-16 (FE-6 전체 — 6a추가 + 6b + 6c + 6d 통합)
> GPT 감사 문서: `docs/feedback/gpt.md`

## 합의완료

- `[합의완료]` SH-1 ~ SH-5
- `[합의완료]` TN-1 ~ TN-6 (트랙 범위 한정)
- `[합의완료]` OB-1 + OB-2 (Bundle O1)
- `[합의완료]` OB-3 + OB-4 (Bundle O2)
- `[합의완료]` OB-5 + OB-6 (Bundle O3a)
- `[합의완료]` OB-7 (Bundle O3b)
- `[합의완료]` 저장소 전체 멀티테넌트 closeout
- `[합의완료]` OB-8 Optional Exporter Ports
- `[합의완료]` EV-1 + EV-2 Evaluation Pipeline
- `[합의완료]` EV-3 + EV-4 Judge / Scorer Split + Run Report
- `[합의완료]` EV-5 + EV-6 Scenario Bundle Registry + CLI/CI Gate
- `[합의완료]` EG-1 + EG-2 Session Reuse Policy + Budget Contract
- `[합의완료]` EG-3 + EG-4 Reuse Integration + Hard Enforcement
- `[합의완료]` EG-5 Guardrail Observability + Eval Fixture
- `[합의완료]` PA-1 + PA-2 — Ports & Adapters Boundary Fix
- `[합의완료]` TR-1 + TR-2 — Shared Tokenizer/QueryNormalizer + LexicalProfile
- `[합의완료]` TR-3 + TR-4 — Hybrid Merge/Rerank + Session Novelty Gate Tokenizer 정렬
- `[합의완료]` TR-5 — Tokenizer/Hybrid Retrieval Eval Fixture + Regression Artifact
- `[합의완료]` GW-1 + GW-2 — RequestPlan/ResultEnvelope + Ingress Normalization/Classification
- `[합의완료]` GW-3 + GW-4 — ExecutionGateway + DirectExecutor
- `[합의완료]` GW-5 + GW-6 — Service Binding + Delivery Envelope Regression
- `[합의완료]` EG-R1 — Failed-Attempt-Aware Session Reuse
- `[합의완료]` RP-1 + RP-2 — RolePolicyResolver + ProtocolResolver
- `[합의완료]` RP-3 + RP-4 — PromptProfileCompiler + Runtime Binding
- `[합의완료]` RP-5 + RP-6 — UI Migration + Golden Tests
- `[합의완료]` SO-1 + SO-2 + SO-3 — Output Contract Inventory + Shared Result Contracts + OutputParserRegistry
- `[합의완료]` SO-4 + SO-5 — SchemaChain Validator/Normalizer + Bounded SchemaRepairLoop
- `[합의완료]` SO-6 + SO-7 — runtime/workflow/gateway binding + parser-repair regression artifact
- `[합의완료]` PAR-1 + PAR-2 — ParallelResultEnvelope + ConflictSet + DeterministicReconcilePolicy + ReconcileNode
- `[합의완료]` PAR-3 + PAR-4 — CriticGate/RetryBudget + CriticGateNode + workflow schema
- `[합의완료]` PAR-5 + PAR-6 — reconcile observability events + local read model + eval bundle
- `[합의완료]` E1 + E2 + E3 — ToolOutputReducer + PtyOutputReducer + prompt/display/storage projection split
- `[합의완료]` E4 + E5 — MemoryIngestionReducer + OutputReductionKpi
- `[합의완료]` F1 + F2 — Provider Error Taxonomy + Acceptance Rubric
- `[합의완료]` F3 + F4 + F5 — Route Calibration Policy + Workflow Compiler Policy + Memory Quality Rules
- `[합의완료]` RPF-1 + RPF-2 + RPF-3 — RepoProfile + RiskTierPolicy + ApprovalPolicy
- `[합의완료]` QG-1 ~ QG-4 — Pipeline Integration + Knip + Type Snapshot + Property Testing
- `[합의완료]` RPF-4 + RPF-5 — ValidatorPack + ArtifactBundle
- `[합의완료]` RPF-4F — Frontend Validation Surface
- `[합의완료]` RPF-6 — Feedback / Eval / Dashboard Integration
- `[합의완료]` FE-0 + FE-1 — Page Access Policy Inventory + Visibility Contract
- `[합의완료]` FE-2 + FE-3 — Chat/Session Surface + Workflow/Eval/Schema Surface
- `[합의완료]` FE-4 + FE-5 — Admin/Security/Monitoring + Repository/Retrieval/Artifact Surface
- `[합의완료]` FE-6a — Backend Scoping Closure (CRITICAL 4 + HIGH 4)

## [GPT미검증] FE-6(전체) — Backend Scoping 잔여 + i18n + Stale/Consistency + Security/Draft + Mobile/A11y

> 마지막 업데이트: 2026-03-16

---

### FE-6a 추가 — Backend Scoping 잔여

| 엔드포인트 | 파일 | 변경 |
|---|---|---|
| `GET /api/system/metrics` | `routes/state.ts` | `require_team_manager` 게이트 |
| `GET /api/config/provider-instances` | `routes/config.ts` | `build_scope_filter` 전달 |
| `GET /api/config/embed-instances` | `routes/config.ts` | 동일 |
| `POST /api/workflow/runs/:id/messages` | `routes/workflows.ts` | `check_wf_ownership` 추가 |
| `PUT /api/kanban/cards/:id` | `routes/kanban.ts` | `check_card_board_access` 적용 |
| `DELETE /api/kanban/cards/:id` | `routes/kanban.ts` | `check_card_board_access` 적용 |

### FE-6b — Admin i18n 전환

- `web/src/pages/admin/index.tsx` — 70+ 하드코딩 한글 → `t("admin.*")` 전환. **한글 0건**
- `src/i18n/locales/en.json` + `ko.json` — `admin.*` 키 74개 추가
- `web/src/pages/overview/types.ts` — `WorkflowEvent`에 `user_id?` 추가 (state consistency drift 수정)

### FE-6b — Stale/Freshness + State Consistency

- `stale-freshness.test.tsx` (3 tests) — MemoryTab 렌더 후 `useQuery` 호출 인자에서 `refetchInterval: 10_000`, `staleTime: 5_000` 직접 검증. 이벤트 타임스탬프 렌더 확인
- `state-consistency.test.ts` (5 tests) — `OverviewWorkflowEvent`에 `user_id`/`retrieval_source`/`novelty_score` 타입 수준 할당 검증. `DashboardState`에 `request_class_summary`/`guardrail_stats` 할당 검증. `RequestClass` 6값 ↔ monitoring variant 맵 키 일치 검증

### FE-6c — Security + Draft Integrity + Duplicated Surface

- `security-rendering.test.ts` (6 tests) — secrets.tsx names-only 패턴 + password type, settings.tsx 마스킹(••••••••) + sensitive 조건부 password, `dangerouslySetInnerHTML` SVG 한정 (builder.tsx ≤2회, diagram.tsx ≤1회, Mermaid 기반), login/provider-modal password type
- `draft-integrity.test.ts` (6 tests) — chat.tsx 전송 중 disable, settings.tsx isPending, modal submitDisabled, secrets.tsx run_action, admin isPending ≥5회, memory.tsx isPending
- `duplicated-surface.test.ts` (6 tests) — PAGE_POLICIES 중복 path 없음, SplitPane/WsListItem 공유 재사용, useT 단일 소스, useToast 단일 소스, useAsyncAction 공통 패턴

### FE-6d — Mobile + Accessibility

- `mobile-a11y.test.ts` (12 tests) — settings/admin role=tablist + aria-selected, settings aria-label, ws-shared role=button + tabIndex=0 + keyboard Enter/Space, modal ESC/onClose, chat-status-bar aria-label, secrets useIsMobile + secret-card 카드 레이아웃, split-pane ws-split, monitoring stat-grid, workflow detail collapse

#### 변경 파일

**백엔드:** `src/dashboard/routes/state.ts`, `src/dashboard/routes/config.ts`, `src/dashboard/routes/workflows.ts`, `src/dashboard/routes/kanban.ts`, `tests/dashboard/fe6a-scoping.test.ts`
**프론트엔드:** `web/src/pages/admin/index.tsx`, `web/src/pages/overview/types.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ko.json`
**테스트 보강:** `web/tests/pages/admin/admin-user-sessions.test.tsx`
**신규 회귀 테스트:**
- `web/tests/regression/i18n-hardcoded.test.ts` (5 tests)
- `web/tests/regression/stale-freshness.test.tsx` (3 tests)
- `web/tests/regression/state-consistency.test.tsx` (5 tests)
- `web/tests/regression/security-rendering.test.tsx` (4 tests — SecretsPage 이름 표시 + 값 미노출, LoginPage password type, SettingsPage 제목 렌더)
- `web/tests/regression/draft-integrity.test.tsx` (3 tests — SecretsPage isPending 렌더, AdminPage 팀 삭제 disabled, AdminPage 사용자 패널 렌더)
- `web/tests/regression/duplicated-surface.test.tsx` (5 tests — WsListItem/WsSkeletonCol 직접 렌더 + PAGE_POLICIES + useT/useToast 단일 소스)
- `web/tests/regression/mobile-a11y.test.tsx` (5 tests — WsListItem role/tabIndex/active 렌더 + ChatBottomBar aria-label/session_reuse 직접 렌더)
- `web/tests/regression/state-consistency.test.tsx` (6 tests — 타입 할당 4건 + MonitoringPanel request class 배지 직접 렌더 + guardrail clear 배지 렌더)

#### Test Command

```bash
# 백엔드 FE-6a 직접 호출 테스트
npx vitest run tests/dashboard/fe6a-scoping.test.ts
npx eslint src/dashboard/routes/state.ts src/dashboard/routes/config.ts src/dashboard/routes/workflows.ts src/dashboard/routes/kanban.ts tests/dashboard/fe6a-scoping.test.ts --max-warnings=0
npx tsc --noEmit

# 프론트엔드 전체 테스트
cd web && npx vitest run tests/
npx eslint src/pages/admin/index.tsx src/pages/overview/types.ts tests/pages/admin/admin-user-sessions.test.tsx tests/regression/i18n-hardcoded.test.ts tests/regression/stale-freshness.test.tsx tests/regression/state-consistency.test.tsx tests/regression/security-rendering.test.tsx tests/regression/draft-integrity.test.tsx tests/regression/duplicated-surface.test.tsx tests/regression/mobile-a11y.test.tsx --max-warnings=0
npx tsc --noEmit
```

**locale JSON lint 참고:** `src/i18n/locales/{en,ko}.json`은 eslint 설정에서 JSON 파일이 제외되어 `File ignored` 경고 출력. 품질은 `i18n-hardcoded.test.ts`의 en.json 한글 값 0건 + en↔ko 키 일치 검증으로 대체 보장.

#### Test Result

- 백엔드 `tests/dashboard/fe6a-scoping.test.ts`: **1 file / 37 tests passed**
- 프론트엔드 `web/tests/`: **24 files / 187 tests passed**
- `npx eslint ...` (backend): **0 errors, 0 warnings**
- `npx eslint ...` (frontend — JSON 제외): **0 errors, 0 warnings**
- `npx tsc --noEmit` (backend + frontend): **통과**

#### Residual Risk

- `dangerouslySetInnerHTML` 3곳은 Mermaid SVG 렌더링 전용 — 사용자 직접 입력이 아닌 `workflow_def_to_mermaid()` 변환 결과. XSS 위험은 낮으나, 향후 SVG sanitizer 적용 검토 권장
- locale JSON eslint 미검증 — `i18n-hardcoded.test.ts`로 대체 보장
- stale-freshness 테스트는 `useQuery` 인자 검증 — 실제 브라우저 refetch 동작은 E2E 범위
- mobile/a11y는 소스 패턴 검증 — 실제 뷰포트/스크린리더 검증은 Playwright E2E 범위
- shared component reuse regression은 소스 import 패턴 기반 — 향후 코드 변경 시 패턴 유지 여부는 review 의존

