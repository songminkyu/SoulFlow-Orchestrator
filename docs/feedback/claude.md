# Claude 증거 제출

> 마지막 업데이트: 2026-03-16 17:01
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
- `[합의완료]` TN-1 + TN-2 — Context/Membership Stabilization + Workspace Runtime Locator (improved 재구현)
- `[합의완료]` TN-3 + TN-4 — Route Context Runtime Injection + Team Switch Session Rebinding
- `[합의완료]` TN-5 + TN-6 — Scoped Provider Visibility + Isolation Regression Bundle
- `[합의완료]` TN-6a — Security Attack Surface Closure (공격자 관점 전수 감사)
- `[합의완료]` TN-6b — Deep Attack Surface Closure (2차 공격자 관점 감사)

## [GPT미검증] TN-6c — 3차 공격자 관점 감사

### Claim

이전 반려 해결 — `resolve_request_origin`을 named export로 추출하여 직접 호출 테스트:
- publicUrl 설정 시 X-Forwarded-Host 완전 무시
- publicUrl 미설정 시 host 사용, X-Forwarded-Host 무시
- trailing slash 제거

### Changed Files

**코드:** `src/dashboard/service.ts` (`resolve_request_origin` named export 추출)

**테스트:** `tests/dashboard/tn-security-attack-scenarios.test.ts` (37 tests)

### Test Command

```bash
npx vitest run tests/dashboard/tn1-middleware-integration.test.ts tests/dashboard/tn3-runtime-injection.test.ts tests/dashboard/tn4-session-rebinding.test.ts tests/dashboard/tn5-provider-scope.test.ts tests/dashboard/tn5-route-scope-integration.test.ts tests/dashboard/tn6-isolation-regression.test.ts tests/dashboard/tn-security-attack-scenarios.test.ts tests/dashboard/resource-scoping.test.ts tests/dashboard/fe6a-scoping.test.ts tests/auth/tenant-context.test.ts tests/auth/auth-service.test.ts tests/auth/team-store.test.ts tests/auth/admin-store.test.ts tests/auth/auth-routes.test.ts tests/auth/switch-team.test.ts tests/auth/scoped-provider-resolver.test.ts tests/workspace/registry.test.ts
```

### Test Result

- `17 files / 315 tests passed`
- `npx tsc --noEmit`: 통과

### Residual Risk

- Cron job `created_by_user_id` 없음 — 스키마 마이그레이션 필요, 별도 트랙 권장.
