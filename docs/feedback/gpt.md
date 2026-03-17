## 감사 범위
- [계류] GW-Track7 + FE-4 — Gateway/Direct Execution 갭 폐쇄

## 독립 검증 결과
- `src/orchestration/gateway-contracts.ts`, `web/src/pages/workflows/detail.tsx`, `web/src/pages/chat/types.ts`, `web/src/pages/chat/message-list.tsx`와 관련 데이터 경로(`src/agent/phase-loop.types.ts`, `src/dashboard/routes/chat.ts`, `src/dashboard/service.ts`, `web/src/hooks/use-ndjson-stream.ts`, `web/src/pages/chat.tsx`)를 직접 확인했다.
- 변경 파일 4개에 대해 파일별 `npx eslint <file>`를 각각 실행했고 모두 통과했다.
- `npx vitest run tests/orchestration/gateway-contracts.test.ts tests/orchestration/execution-gateway.test.ts tests/evals/gateway-executor.test.ts`를 재실행해 `3 files / 61 tests passed`를 확인했다.
- `npx tsc --noEmit` 통과.
- `GW-5`는 `RoutePreview` 계약과 helper는 추가됐지만 workflow run 응답 타입과 `workflows/detail.tsx` 렌더링 경로에 route preview 소비가 없다.
- `GW-6`는 `message-list.tsx` 렌더 분기 자체는 있으나, chat session/stream 경로에서 `requested_channel`·`delivered_channel`·`execution_route`를 `MessageList`의 `messages`로 주입하지 않는다.
- SOLID/YAGNI/DRY/KISS/LoD, OWASP Top 10, 공격자 관점 검토에서는 이번 범위의 신규 고위험 취약점은 확인하지 못했다.

## 최종 판정
- [계류] GW-Track7 + FE-4 — Gateway/Direct Execution 갭 폐쇄

## 반려 코드
- `scope-mismatch [major]`
- `test-gap [major]`

## 구체 지점
- `src/agent/phase-loop.types.ts:L76` — workflow run 상태 타입에 `route_preview` 계열 필드가 없어 `GET /api/workflow/runs/:id`가 FE route preview를 실어 나를 계약이 없다.
- `web/src/pages/workflows/detail.tsx:L97` — 화면 상태 타입에도 `route_preview`가 없고, `web/src/pages/workflows/detail.tsx:L210`은 status/agents/phase/workflow 배지만 렌더해 claim의 route badge가 존재하지 않는다.
- `web/src/hooks/use-ndjson-stream.ts:L14` — NDJSON routing 이벤트는 `requested_channel`/`delivered_channel`/`session_reuse`만 전달하고 `execution_route`를 보내지 않는다.
- `web/src/pages/chat.tsx:L269` — 스트리밍 가상 메시지는 `direction`/`content`/`at`만 채우며, `web/src/pages/chat.tsx:L372` routing 정보는 `ChatBottomBar`로만 전달되어 `MessageList` 메시지에 합쳐지지 않는다.
- `src/dashboard/service.types.ts:L383` — 저장/복원용 `ChatSessionMessage`에 delivery trace / `execution_route` 필드가 없고, `src/dashboard/service.ts:L538` 및 `src/dashboard/routes/chat.ts:L234`도 세션 메시지를 `direction`/`content`/`at` 위주로만 직렬화한다.
- `tests/orchestration/gateway-contracts.test.ts:L13` — 증거 테스트 import 목록에 `build_route_preview`가 없어 GW-5 RoutePreview 계약을 직접 잠그지 못한다.
- `tests/evals/gateway-executor.test.ts:L4` — 증거 테스트 범위가 executor classify/cost_tier/normalize에 한정되어 workflow detail UI와 chat message rendering을 검증하지 않는다.

## 핵심 근거
- eslint, vitest, `tsc`는 모두 통과했다.
- 그러나 `RoutePreview`/`build_route_preview()`는 계약 파일에만 있고 workflow run payload와 `workflows/detail.tsx` UI까지 연결되지 않았다.
- `message-list.tsx`는 필드가 있을 때만 표시하지만, 현재 chat session/NDJSON 경로는 delivery trace와 `execution_route`를 `MessageList`의 메시지 객체로 공급하지 않는다.
- 증거 테스트도 `build_route_preview()`와 workflow/chat UI 경로를 직접 검증하지 않아 claim을 닫을 수준의 보호가 없다.

## 완료 기준 재고정
- `/api/workflow/runs/:id` 응답이 실제 `route_preview`를 포함하고 `web/src/pages/workflows/detail.tsx`가 이를 렌더하며, chat 세션/NDJSON 경로가 `requested_channel`·`delivered_channel`·`execution_route`를 `MessageList`의 메시지로 전달하고 해당 경로를 직접 검증하는 테스트가 추가되면 닫힘.

## 다음 작업

- `GW-Track7 + FE-4 — Gateway/Direct Execution 갭 폐쇄`
