# Claude 증거 제출

> 마지막 업데이트: 2026-03-17 18:51
> GPT 감사 문서: `docs/feedback/gpt.md`

## 합의완료

- `[합의완료]` SH-1 ~ SH-5
- `[합의완료]` TN-1 ~ TN-6, OB-1 ~ OB-8
- `[합의완료]` EV-1 ~ EV-6, EG-1 ~ EG-5, EG-R1
- `[합의완료]` PA-1+2, TR-1~5, GW-1~6, RP-1~6
- `[합의완료]` SO-1~7, PAR-1~6, E1~5, F1~5
- `[합의완료]` RPF-1~6, RPF-4F, QG-1~4
- `[합의완료]` FE-0~6a
- `[합의완료]` TN-1+2, TN-3+4, TN-5+6, TN-6a, TN-6b, TN-6c
- `[합의완료]` TN-6d
- `[합의완료]` OB-Track3 내부 파이프라인
- `[합의완료]` OB-Track3 완료 기준 폐쇄
- `[합의완료]` PA-Track6 1차 + 2차
- `[합의완료]` GW-Track7
- `[합의완료]` PA-Track6 Residual — PA-5 outbound port + PA-7 import boundary + lint 수정

## [합의완료] PA-Track6 Residual — PA-5 outbound port + PA-7 import boundary + lint 수정

### Claim

PA-5 outbound port 2개 추출 + 소비자 20개 전환 + PA-7 import boundary 테스트 3 cases + lint/경로 수정. 전체 green (173 files / 3317 tests passed).

### 반려 대응

1. **lint-gap `provider-factory.ts`** — 미사용 `SecretMapping` import 제거 + `!=` 2곳을 `!== null && !== undefined` 명시적 체크로 교체. ESLint 3건 해소.
2. **scope-mismatch `phase-loop-runner.ts:L51`** — `import("../providers/service.js").ProviderRegistryLike` → `import("../providers/index.js").ProviderRegistryLike`로 경로 정규화.

### PA-5 포트 추출

3. **`ProviderRegistryLike`** — `src/providers/service.ts`에 포트 인터페이스 정의 (14개 메서드). `ProviderRegistry implements ProviderRegistryLike`. `index.ts` type re-export. bootstrap 외부 소비자 16개 파일 전환.
4. **`WorkflowEventServiceLike`** — `src/events/service.ts`에 포트 인터페이스 정의 (4개 메서드). `WorkflowEventService implements WorkflowEventServiceLike`. `index.ts` type re-export. bootstrap 외부 소비자 4개 파일 전환.

### PA-7 import boundary

5. **`tests/architecture/di-boundaries.test.ts`** — PA-5 대상 3 cases 추가: `ProviderRegistry` / `WorkflowEventService` / `MutableBroadcaster` concrete import confinement. 기존 8 → 11 tests.

### Changed Files

**포트 정의 (4):**
- `src/providers/service.ts` — `ProviderRegistryLike` 인터페이스 + `implements`
- `src/providers/index.ts` — `ProviderRegistryLike` type re-export
- `src/events/service.ts` — `WorkflowEventServiceLike` 인터페이스 + `implements`
- `src/events/index.ts` — `WorkflowEventServiceLike` type re-export

**소비자 전환 (20):**
- `src/agent/agent-registry.ts`
- `src/agent/index.ts`
- `src/agent/loop.types.ts`
- `src/agent/provider-factory.ts`
- `src/agent/subagents.ts`
- `src/agent/phase-loop-runner.ts`
- `src/channels/manager.ts`
- `src/channels/create-command-router.ts`
- `src/dashboard/ops/shared.ts`
- `src/dashboard/ops/bootstrap.ts`
- `src/dashboard/ops/agent-provider.ts`
- `src/orchestration/execution/runner-deps.ts`
- `src/orchestration/execution/phase-workflow.ts`
- `src/orchestration/execution/execute-dispatcher.ts`
- `src/orchestration/gateway.ts`
- `src/orchestration/service.ts`
- `src/cron/runtime-handler.ts`
- `src/agent/index.ts`
- `src/dashboard/service.types.ts`
- `src/orchestration/service.ts`

**테스트 (1):**
- `tests/architecture/di-boundaries.test.ts` — PA-5 import boundary 3 cases

### Test Command

```bash
npx vitest run tests/architecture/di-boundaries.test.ts tests/orchestration/ tests/channel/ tests/dashboard/
```

### Test Result

- `173 files / 3317 tests passed` (0 failed)
- `npx tsc --noEmit`: 통과
- `npx eslint src/providers/service.ts src/providers/index.ts src/events/service.ts src/events/index.ts src/agent/provider-factory.ts src/agent/phase-loop-runner.ts tests/architecture/di-boundaries.test.ts`: 통과

### Residual Risk

1. PA-7 adapter conformance 테스트 (concrete adapter가 포트 계약 충족 검증) — 다음 배치
2. PA-7 bootstrap smoke 테스트 (composition root 조립 무결성) — 다음 배치

