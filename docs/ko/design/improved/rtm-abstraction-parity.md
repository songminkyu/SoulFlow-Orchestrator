# RTM: Abstraction Parity (Track T — AP-1..AP-5)

> Generated: 2026-03-22 | Scout: Claude Opus 4.6
> Updated: 2026-03-23 | V Track test rationalization — all gaps CLOSED
> Source: abstraction-parity/work-breakdown.md
> Commits: 9cd8d3a (AP-1..4 impl), b30ead9 (AP-5 tests)

---

## 1. Forward RTM

| Req ID | Description | File | Exists | Impl | Test Case | Connected | Status |
|--------|-------------|------|--------|------|-----------|-----------|--------|
| AP-1 | Sub-bundle type definitions (6 interfaces) | src/bootstrap/orchestration.ts | Y | Y | tests/architecture/ap-composition-root.test.ts | PA-2, PA-6 | done |
| AP-1 | OrchestrationBundleDeps as intersection | src/bootstrap/orchestration.ts | Y | Y | tests/architecture/ap-composition-root.test.ts | PA-2 | done |
| AP-2 | with_vec_db / with_vec_db_async | src/utils/sqlite-helper.ts | Y | Y | tests/utils/sqlite-helper.test.ts | FC-2 | done |
| AP-2 | memory.service.ts → with_sqlite | src/agent/memory.service.ts | Y | Y | (regression) | — | done |
| AP-2 | memory-rechunk-worker.ts → with_vec_db | src/agent/memory-rechunk-worker.ts | Y | Y | (regression) | — | done |
| AP-2 | tool-index.ts → with_vec_db | src/orchestration/tool-index.ts | Y | Y | (regression) | K4 | done |
| AP-2 | vector-store.service.ts → with_vec_db | src/services/vector-store.service.ts | Y | Y | (regression) | — | done |
| AP-2 | skill-index.ts exception (in-memory) | src/orchestration/skill-index.ts | Y | Y (allowed) | (regression) | — | done |
| AP-3 | BE shared contract | src/contracts/api-responses.ts | Y | Y (37 types) | tests/architecture/ap-api-contract.test.ts | FE-BE | done |
| AP-3 | FE shared contract mirror | web/src/api/contracts.ts | Y | Y (49 types) | tests/architecture/ap-api-contract.test.ts | FE | done |
| AP-3 | BE route satisfies | src/dashboard/routes/admin.ts | Y | Y | (typecheck) | — | done |
| AP-3 | FE import from contracts | web/src/pages/admin/index.tsx + many | Y | Y | tests/architecture/fe-be-contract-drift.test.ts | IC-4 | done |
| AP-4 | obs_metrics in RouteContext | src/dashboard/route-context.ts | Y | Y | tests/architecture/ap-metrics-wiring.test.ts | OB-4 | done |
| AP-4 | service.ts wiring | src/dashboard/service.ts | Y | Y | tests/architecture/ap-metrics-wiring.test.ts | — | done |
| AP-5 | SQLite boundary guard | tests/architecture/ap-sqlite-boundary.test.ts | Y | self | self | AP-2 | done |
| AP-5 | Composition root guard | tests/architecture/ap-composition-root.test.ts | Y | self | self | AP-1 | done |
| AP-5 | Metrics wiring guard | tests/architecture/ap-metrics-wiring.test.ts | Y | self | self | AP-4 | done |
| AP-5 | API contract guard | tests/architecture/ap-api-contract.test.ts | Y | self | self | AP-3 | done |
| AP-5 | validate:skills in quality gate | package.json | Y | Y | npm run quality | IC-5 | done |

## 2. Backward RTM

| Test File | Test Description | Source File | Req ID | Traced |
|-----------|-----------------|-------------|--------|--------|
| tests/architecture/ap-composition-root.test.ts | Sub-bundle interface + intersection | src/bootstrap/orchestration.ts | AP-1 | Y |
| tests/architecture/ap-sqlite-boundary.test.ts | new Database() prohibition | src/**/*.ts | AP-2 | Y |
| tests/architecture/ap-api-contract.test.ts | BE+FE contract existence + core types | src/contracts/, web/src/api/ | AP-3 | Y |
| tests/architecture/ap-metrics-wiring.test.ts | obs_metrics field + injection | src/dashboard/ | AP-4 | Y |
| tests/architecture/fe-be-contract-drift.test.ts | FE/BE contract type drift guard | src/contracts/, web/src/api/ | AP-3, IC-4 | Y |
| tests/bootstrap/bootstrap-smoke.test.ts | Composition root smoke | src/bootstrap/orchestration.ts | AP-1 | Y |
| tests/utils/sqlite-helper.test.ts | sqlite-helper unit | src/utils/sqlite-helper.ts | AP-2 | Y |

## 3. Bidirectional RTM

| Req ID | Has Code | Has Test | Test→Req | Req→Test | Gap |
|--------|----------|----------|----------|----------|-----|
| AP-1 | Y | Y | Y | Y | — |
| AP-2 | Y | Y | Y | Y | skill-index allowed exception |
| AP-3 | Y | Y | Y | Y | CLOSED: 49 FE types in contracts.ts (IC-4 expanded) |
| AP-4 | Y | Y | Y | Y | — |
| AP-5 | Y (test) | self | self | self | CLOSED: validate:skills in package.json quality gate |

## 4. Gap Summary

| Gap | Req | Severity | Description |
|-----|-----|----------|-------------|
| ~~G-AP-1~~ | ~~AP-3~~ | ~~LOW~~ | CLOSED: now 49 FE / 37 BE shared types + fe-be-contract-drift.test.ts guard (IC-4 expanded) |
| ~~G-AP-2~~ | ~~AP-5~~ | ~~LOW~~ | CLOSED: validate:skills in package.json quality gate (npm run quality includes it) |

All gaps CLOSED. Zero HIGH/MEDIUM/LOW remaining.
