# Claude 증거 제출

> 마지막 업데이트: 2026-03-17 19:45
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

## [합의완료] PA-Track6 Residual Batch 2 — PA-7 adapter conformance + bootstrap smoke

### Claim

PA-7 adapter conformance 테스트 3종(ProviderRegistry, WorkflowEventService, SseBroadcasterLike 구현체 3종) + bootstrap smoke 테스트(composition root 조립 패턴 재현 + NULL_BROADCASTER 기본값 역할). 신규 테스트 2파일 / 25 tests 전부 green. 기존 테스트 영향 없음.

### 반려 대응

1. **test-gap `bootstrap-smoke.test.ts:L114`** — `WorkflowEventService` 생성자를 `runtime-data.ts:L80`과 동일한 4인자(`workspace, events_dir, null, taskLoopMaxTurns`)로 변경. `events_dir` override 반영 검증 추가 (`svc.events_dir === events_dir`).
2. **claim-drift `bootstrap-smoke.test.ts:L120`** — `read_task_detail` 호출 추가. `append`에 `detail` 필드를 전달하고 `read_task_detail`로 조회하여 포트 4개 메서드 중 `append`, `list`, `read_task_detail` 3개를 직접 검증 (나머지 `bind_task_store`는 별도 테스트).

### PA-7 Adapter Conformance

3. **`tests/architecture/pa7-adapter-conformance.test.ts`** (11 tests) — 포트 인터페이스의 모든 required 메서드가 런타임 인스턴스에 존재하고 `typeof === "function"`인지 구조적 검증.
   - `ProviderRegistry` → `ProviderRegistryLike` (15개 메서드)
   - `WorkflowEventService` → `WorkflowEventServiceLike` (4개 메서드)
   - `MutableBroadcaster` → `SseBroadcasterLike` (11 required + 1 optional)
   - `NULL_BROADCASTER` → `SseBroadcasterLike` (11 required, optional 미구현 확인)
   - `SseManager` → `SseBroadcasterLike` (11 required + 1 optional)

### PA-7 Bootstrap Smoke

4. **`tests/bootstrap/bootstrap-smoke.test.ts`** (14 tests) — composition root(main.ts) 조립 패턴을 최소 의존성으로 재현.
   - ProviderRegistry 조립: 최소 설정 생성 → 포트로 사용 → set/get 왕복 → health_scorer/vault 반환 (3 tests)
   - WorkflowEventService 조립: `runtime-data.ts:L80`과 동일 4인자 생성 → events_dir override 검증 → append/list/read_task_detail CRUD → bind_task_store (2 tests)
   - MutableBroadcaster 조립: 생성 → NULL_BROADCASTER 위임 → attach(SseManager) → 실제 위임 → detach → 복귀 → add_rich_stream_listener 생명주기 (5 tests)
   - NULL_BROADCASTER 기본값 역할: 포트 할당 → no-op void 계약 → detach 후 복귀 검증 (3 tests)
   - 포트 조합 주입: 3개 포트를 동시에 소비자 함수에 전달 (1 test)

### Changed Files

**신규 테스트 (2):**
- `tests/architecture/pa7-adapter-conformance.test.ts` — PA-7 adapter conformance 11 tests
- `tests/bootstrap/bootstrap-smoke.test.ts` — PA-7 bootstrap smoke 14 tests

### Test Command

```bash
npx vitest run tests/architecture/pa7-adapter-conformance.test.ts tests/bootstrap/bootstrap-smoke.test.ts
```

### Test Result

- `2 files / 25 tests passed` (0 failed)
- `npx eslint tests/architecture/pa7-adapter-conformance.test.ts tests/bootstrap/bootstrap-smoke.test.ts`: 통과

### Residual Risk

이전 배치의 Residual Risk 2항목(PA-7 conformance + bootstrap smoke)이 이 배치에서 해소됨. 신규 잔여 리스크 없음.

