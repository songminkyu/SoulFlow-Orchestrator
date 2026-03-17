# Claude 증거 제출

> 마지막 업데이트: 2026-03-17 17:40
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

## [GPT미검증] GW-Track7 — 반려 전수 폐쇄 + 보안/영속/계약 수정 + 직접 회귀 테스트

### Claim

GPT 반려 7건 전수 폐쇄 + 기존 테스트 실패 2파일 수정 + 3차 반려 3건 수정 + 4차 반려 test-gap 2건 직접 회귀 테스트 추가. 증거 명령 완전 green (97 files / 2065 tests passed).

### 4차 반려 대응

1. **test-gap: builtin web flush** → `tests/channel/channel-manager.test.ts`에 신규 테스트 추가. `on_web_stream` 콜백을 harness에 주입하여 builtin 성공 시 `flush(done=true)` 호출을 직접 검증. `tests/helpers/harness.ts`에 `on_web_stream`/`on_web_rich_event` 옵션 추가.
2. **test-gap: delivery trace 영속/복원** → `tests/dashboard/web-session-persistence.test.ts`에 신규 2 cases 추가. (1) `capture_web_outbound` routing → SessionStore에 3필드 영속 확인, (2) 재시작 후 `_restore_web_sessions`에서 3필드 복원 확인.

### 이전 반려 대응 요약

- **Batch 1**: PhaseLoopState.route_preview, ChatSessionMessage delivery trace, StreamEvent routing, build_route_preview 테스트.
- **Batch 2**: execute-dispatcher routing 발행, NDJSON execution_route, chat.tsx virtual_msg 합성, capture_web_outbound routing, OrchestrationResult.execution_route, build_meta 전파.
- **Batch 3**: workflows/detail.tsx route preview 배지 + FE 렌더 테스트 (message-list 5 + detail-badges 3).
- **기존 실패**: idor-ownership mock 보강, service-mock-preflight get_tool_definitions 추가.
- **3차**: builtin flush 보장, delivery trace SessionStore 영속/복원, direct_tool cost_tier no_token 수정 + 회귀 테스트.

### Changed Files

**코드 (11):**
- `src/channels/stream-event.ts` — StreamEvent routing variant
- `src/agent/phase-loop.types.ts` — RoutePreview import + PhaseLoopState.route_preview
- `src/dashboard/service.types.ts` — ChatSessionMessage delivery trace 3필드
- `src/orchestration/types.ts` — OrchestrationResult.execution_route
- `src/orchestration/gateway-contracts.ts` — result_cost_tier execution_route 대응 + to_result_envelope 전달
- `src/orchestration/execution/execute-dispatcher.ts` — routing 이벤트 발행 + 모든 return 경로 execution_route
- `src/channels/manager.ts` — builtin flush 보장 + build_meta() execution_route 전파
- `src/bootstrap/dashboard.ts` — outbound metadata → capture_web_outbound routing
- `src/dashboard/service.ts` — capture_web_outbound routing + SessionStore 영속/복원
- `web/src/hooks/use-ndjson-stream.ts` — NdjsonLine/RoutingInfo execution_route
- `web/src/pages/chat.tsx` — virtual_msg routing 합성

**FE (1):**
- `web/src/pages/workflows/detail.tsx` — RoutePreviewEntry + hero 배지

**테스트 (8):**
- `tests/orchestration/gateway-contracts.test.ts` — build_route_preview 4 + result_cost_tier 6 + direct_tool envelope 1
- `tests/orchestration/execute-dispatcher.test.ts` — 9개 toEqual execution_route 반영
- `tests/dashboard/idor-ownership.test.ts` — process mock get + task team_role
- `tests/orchestration/service-mock-preflight.test.ts` — get_tool_definitions mock
- `tests/channel/channel-manager.test.ts` — builtin web flush done 직접 검증 1 case
- `tests/dashboard/web-session-persistence.test.ts` — delivery trace 영속 1 + 복원 1 = 2 cases
- `tests/helpers/harness.ts` — on_web_stream/on_web_rich_event 옵션 추가
- `web/tests/pages/chat-message-list-delivery.test.tsx` — delivery trace 렌더 5 cases
- `web/tests/pages/workflows/detail-badges.test.tsx` — route_preview hero 배지 3 cases

### Test Command

```bash
npx vitest run tests/orchestration/gateway-contracts.test.ts tests/orchestration/execute-dispatcher.test.ts tests/orchestration/execution-gateway.test.ts tests/channel/ tests/dashboard/
```

### Test Result

- `97 files / 2065 tests passed` (0 failed)
- `npx tsc --noEmit`: 통과
- `npx eslint <변경 파일 20개>`: 통과
- FE 렌더 테스트: `cd web && npx vitest run tests/pages/chat-message-list-delivery.test.tsx tests/pages/workflows/detail-badges.test.tsx` — `2 files / 18 tests passed`

### Residual Risk

1. builtin flush 통합 테스트(실제 web NDJSON HTTP 스트림 e2e)는 별도 E2E 트랙으로 분리
2. `build_route_preview`의 phase loop runner 실제 호출은 별도 트랙
