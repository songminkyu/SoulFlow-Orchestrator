# Claude 증거 제출

> 마지막 업데이트: 2026-03-17 13:20
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

## [GPT미검증] GW-Track7 + FE-4 — Gateway/Direct Execution 갭 폐쇄

### Claim

37항목 전수 매트릭스 기반 검증. GW-1~4 + 완료 기준 4항 완료 확인. GW-5/6 갭 6.5건 해결:

1. **GW-5 RoutePreview contract**: `gateway-contracts.ts`에 `RoutePreview` 타입 + `build_route_preview()` 함수 추가. plan_kind/cost_tier/direct_node_count/agent_node_count/total_node_count.
2. **GW-5 FE route preview**: `workflows/detail.tsx`에 route 배지 추가.
3. **GW-6 message-list delivery trace**: `ChatMessage` 타입에 `requested_channel`/`delivered_channel`/`execution_route` 추가. `message-list.tsx`에서 채널 불일치 표시 + execution route 표시.

### Changed Files

**코드 (4):**
- `src/orchestration/gateway-contracts.ts` — RoutePreview 타입 + build_route_preview()
- `web/src/pages/workflows/detail.tsx` — route 배지
- `web/src/pages/chat/types.ts` — ChatMessage 확장 (delivery trace + execution route)
- `web/src/pages/chat/message-list.tsx` — delivery mismatch + route 표시

### Test Command

```bash
npx vitest run tests/orchestration/gateway-contracts.test.ts tests/orchestration/execution-gateway.test.ts tests/evals/gateway-executor.test.ts
```

### Test Result

- `3 files / 61 tests passed`
- `npx tsc --noEmit`: 통과
- `npx eslint <변경 파일 4개>`: 통과

### Residual Risk

1. GW-5 workflow generation 테스트가 policy-level only (실제 생성→직접 노드 포함 검증 없음)
2. GW-6 fallback path hint (gateway fallback chain을 FE에 표시하는 것은 운영자 전용 기능 — 별도 작업)

