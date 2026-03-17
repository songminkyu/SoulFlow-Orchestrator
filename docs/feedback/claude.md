# Claude 증거 제출

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
- `[합의완료]` PA-Track6 Residual Batch 2 — PA-7 adapter conformance + bootstrap smoke

## [GPT미검증] Track 1~7 전수조사 3회차 — disconnected code 연결 + 보안 갭 폐쇄

### Claim

도메인 1~7 전수조사(36개 작업 단위) 갭 수정. 수정 파일 20개(신규 2, 기존 18). `npx tsc --noEmit` 0 errors. `repo-profile` 8/8.

### 반려 대응 (라운드 6)

이전 라운드에서 보안(OWASP) 이슈는 모두 해소됨. 남은 것은 test-gap 1건: `repo-profile` bundle CLI 실행을 자동 회귀 테스트로 잠그지 않은 것.

1. **`tests/evals/eval-run-cli.test.ts`** — `--bundle repo-profile --threshold 100` CLI 테스트 추가. `Running: repo-profile`, `Passed: 8`, `Failed: 0` 검증. `BUNDLE_SCORER_MAP["repo-profile"]` 경로가 자동으로 잠김.

### Changed Files

**신규 (2):**
- `tests/security/token-egress.test.ts` — SH-2 회귀 13 tests
- `src/evals/repo-profile-executor.ts` — context 분기 executor

**수정 (18):**
- `src/agent/tools/http-request.ts` — HTTPS 전용
- `src/agent/tools/http-utils.ts` — `check_allowed_hosts()` 공유 헬퍼
- `src/agent/tools/oauth-fetch.ts` — `check_allowed_hosts()` 공유 경로
- `src/bootstrap/orchestration.ts` — `check_allowed_hosts()` 공유 경로
- `src/observability/correlation.ts` — task_id 필드
- `src/orchestration/execution/run-task-loop.ts` — task_id correlation
- `src/orchestration/execution/continue-task-loop.ts` — task_id correlation
- `src/orchestration/execution/run-once.ts` — native budget pre_tool_use
- `src/orchestration/execution/run-agent-loop.ts` — native budget pre_tool_use
- `src/evals/loader.ts` — 5필드 파싱
- `scripts/eval-run.ts` — EXECUTOR_MAP + BUNDLE_SCORER_MAP
- `src/orchestration/execution/execute-dispatcher.ts` — normalize_ingress + route_preview
- `src/orchestration/execution/phase-workflow.ts` — audit_workflow_nodes
- `src/channels/stream-event.ts` — routing route_preview
- `src/dashboard/routes/references.ts` — is_inside 통일
- `src/auth/scoped-provider-resolver.ts` — open_team_store 팩토리
- `tests/evals/loader.test.ts` — 신규 필드 검증
- `tests/evals/eval-run-cli.test.ts` — repo-profile bundle CLI 회귀 추가

### Test Command

```bash
npx vitest run tests/security/ tests/observability/ tests/orchestration/guardrails/ tests/evals/ tests/orchestration/gateway-contracts.test.ts tests/orchestration/ingress-normalizer.test.ts tests/auth/scoped-provider-resolver.test.ts tests/architecture/ tests/bootstrap/
```

### Test Result

- `45 files / 693 tests passed` (0 failed)
- `npx tsc --noEmit`: 0 errors
- `npx tsx scripts/eval-run.ts --bundle repo-profile --threshold 100`: 8/8 (100%)
- `npx eslint` 수정 파일 전부 통과

### Residual Risk

1. **인프라 계층 갭 (docs/feedback/infra-layer-gaps.md)**: EventBus/SSE/Redis tenant 격리. → Track 14.
2. **OB-3 tool/LLM span 부재**: metrics만.
3. **OB-5 FE 모니터링 패널 부재**.
4. **PA-5 outbound port 4개 미추출**.

> 마지막 업데이트: 2026-03-17 22:24
