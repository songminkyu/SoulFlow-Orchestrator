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
- `[합의완료]` Track 1~7 전수조사 3회차 — disconnected code 연결 + 보안 갭 폐쇄
- `[합의완료]` M-14 reducer + M-15a evaluate_route 통합 테스트

## [GPT미검증] Phase 0+1+2 인프라 전수조사 13건 + 감사 보정 8건

### Claim

커밋 `04207b4`에 포함된 인프라 전수조사 Phase 0+1+2 총 13건 + 감사 보정 8건.

**Phase 0 — 보안 인프라 6건:**

- **H-1 (EventBus payload Zod 검증):** `src/bus/validation.ts`에 `validate_message()`. 14개 테스트.
- **H-2 (team_id 경고 단계):** 경고만. 필수화는 Phase 5.
- **H-3 (correlation_id 경고 단계):** 경고만. 필수화는 Phase 5.
- **H-4 (path traversal 방어):** `src/agent/tools/filesystem.ts:45-58` `safe_realpath()`. 6개 직접 테스트.
- **H-8 (API rate limiting):** `src/auth/login-rate-limiter.ts` IP 슬라이딩 윈도우. 11개 테스트.
- **H-10 (CORS + 보안 헤더):** `src/dashboard/service.ts:73-95` `apply_cors()`. 설정: `corsOrigins` → `cors_origins`. 7개 테스트.

**Phase 1 — 백엔드 미연결 3건:**

- **M-13:** `src/agent/phase-loop-runner.ts:574-586` emit + `phase-workflow.ts:189-192` 소비. 4개 테스트.
- **M-14:** `src/orchestration/service.ts:238-245`. 5개 테스트.
- **M-15a:** `src/orchestration/execution/execute-dispatcher.ts:202-211`. 5개 테스트.

**Phase 2 — FE Priority 2 4건:**

- **G-11 (pending 상태):** `web/src/layouts/root.tsx:174` `topbar__team-badge--pending` + `badge-pulse`. 직접 렌더 테스트 3개 (`web/tests/layouts/g11-g12-pending-toast.test.tsx`): isPending false→클래스 없음, isPending true→클래스+aria-busy+disabled, switching 텍스트.
- **G-12 (denial toast):** `web/src/layouts/root.tsx:202-209` onError 코드 분기 → toast. 직접 렌더+상호작용 테스트 4개: 메뉴→클릭→mutate, not_a_member/team_id_required/unknown 코드별 toast 검증.
- **G-13 (protocol API):** FE: `agent-panel.tsx:93-100`/`agent-modal.tsx:66-73` `GET /api/protocols`. BE: `src/dashboard/routes/skill.ts:26-31` 라우트. 테스트 3계층: (1) BE 라우트 직접 호출 2개 (`tests/dashboard/fe-phase2-gaps.test.ts:58-74`), (2) FE 소비자 직접 렌더 6개 (`web/tests/prompting/g13-protocols-consumer.test.tsx`) — `AgentPanel`과 `AgentModal`을 실제 import+렌더하여 `useQuery({queryKey:["protocols"]})` 등록, `queryFn`이 `api.get("/api/protocols")`를 호출, 프로토콜 체크박스 렌더 확인.
- **G-14 (PromptProfilePreview):** `inspector-params.tsx:738-757` rendered_prompt 접이식 표시. 직접 렌더 테스트 6개 (`web/tests/pages/workflows/g14-profile-preview.test.tsx`): rendered_prompt 유무별, 토글 열기/닫기, aria-expanded.

i18n: 5개 키 (`team.err_id_required`, `team.err_not_member`, `team.err_switch_failed`, `team.switch_title`, `workflows.profile_preview`).

**감사 보정 8건:**

1. **[CQ-2] t-shadowing:** `web/src/layouts/root.tsx` — `t` → `tm`.
2. **[T-3] i18n 허용목록:** `web/tests/regression/i18n-hardcoded.test.ts` — `sidebar.locale_ko` 허용.
3. **[T-2] H-4 직접 테스트:** `tests/agent/tools/h4-path-traversal.test.ts` 6개.
4. **[I-1] 하드코딩 제거:** `inspector-params.tsx:751` fallback 제거.
5. **[T-2] G-11/G-12/G-14 렌더 테스트:** `web/tests/layouts/g11-g12-pending-toast.test.tsx` 7개 + `web/tests/pages/workflows/g14-profile-preview.test.tsx` 6개. `PromptProfilePreview` export 추가.
6. **[CQ-4] `as any` 제거:** `tests/orchestration/m13-consumer-wiring.test.ts` — 11개 `as any` → `as unknown` 변환. mock 객체가 production 타입의 부분 구현이므로 `unknown` 단언으로 타입 안전성 유지.
7. **[T-2] G-13 FE 소비자 렌더 테스트:** `web/tests/prompting/g13-protocols-consumer.test.tsx` 6개 — `AgentPanel`/`AgentModal`을 실제 import하여 렌더. `useQuery({queryKey:["protocols"]})` 등록 검증, `queryFn` → `api.get("/api/protocols")` 호출 경로 검증, 프로토콜 체크박스 렌더 검증. (커밋 `8f3d5ad`에 포함.)
8. **[CC-2] Changed Files 보정:** 커밋 `04207b4`에 포함되었으나 이전 증거에서 누락된 `.claude/session-handoff.md`, `docs/feedback/infra-layer-gaps.md`를 기타 목록에 명시. 현재 diff 목록을 실제 `git diff --name-only` + `git ls-files --others`와 정합하도록 갱신.

### Changed Files

코드 변경은 커밋 `04207b4` + `8f3d5ad`에 포함됨. 감사 보정은 현재 diff + 신규 파일.

**현재 `git diff --name-only`:**
- `docs/feedback/claude.md` — 이 증거 문서 (Write 직후 modified)
- `docs/feedback/gpt.md` — GPT 판정
- `tests/orchestration/m13-consumer-wiring.test.ts` — `as any` → `as unknown`
- `web/src/layouts/root.tsx` — t-shadowing 수정
- `web/src/pages/workflows/inspector-params.tsx` — fallback 제거 + export
- `web/tests/regression/i18n-hardcoded.test.ts` — locale_ko 허용목록

**현재 untracked (신규):**
- `tests/agent/tools/h4-path-traversal.test.ts` — H-4 직접 테스트 (신규)
- `web/tests/layouts/g11-g12-pending-toast.test.tsx` — G-11/G-12 렌더 (신규)
- `web/tests/pages/workflows/g14-profile-preview.test.tsx` — G-14 렌더 (신규)

**이미 커밋됨 (`8f3d5ad`):**
- `web/tests/prompting/g13-protocols-consumer.test.tsx` — G-13 FE 소비자 렌더 (커밋 완료)

**Phase 0 코드 (커밋 `04207b4`):**
- `src/bus/validation.ts` — H-1 (신규)
- `src/bus/service.ts` — H-1 호출
- `src/bus/redis-bus.ts` — H-1 호출
- `src/bus/types.ts` — H-2/H-3 필드
- `src/bus/index.ts` — re-export
- `src/agent/tools/filesystem.ts` — H-4
- `src/agent/tools/registry.ts` — H-4 전파
- `src/auth/login-rate-limiter.ts` — H-8 (신규)
- `src/auth/auth-service.ts` — H-8 scrypt 비동기 전환
- `src/dashboard/routes/auth.ts` — H-8 미들웨어
- `src/dashboard/service.ts` — H-10 apply_cors()
- `src/dashboard/service.types.ts` — H-10 cors_origins 타입
- `src/config/schema.ts` — H-10 corsOrigins 스키마
- `src/bootstrap/dashboard.ts` — H-10 주입
- `src/security/content-sanitizer.ts` — 미사용 타입 정리
- `src/security/sensitive.ts` — 미사용 타입 정리

**Phase 1 코드 (커밋 `04207b4`):**
- `src/agent/phase-loop-runner.ts` — M-13
- `src/agent/phase-loop.types.ts` — M-13 타입
- `src/orchestration/execution/phase-workflow.ts` — M-13 소비
- `src/orchestration/service.ts` — M-14
- `src/orchestration/execution/execute-dispatcher.ts` — M-15a
- `src/orchestration/confirmation-guard.ts` — M-15a 타입

**Phase 2 코드 (커밋 `04207b4`):**
- `web/src/layouts/root.tsx` — G-11 + G-12
- `web/src/pages/prompting/agent-panel.tsx` — G-13
- `web/src/pages/prompting/agent-modal.tsx` — G-13
- `web/src/pages/workflows/inspector-params.tsx` — G-14
- `web/src/styles/layout.css` — G-11 스타일
- `web/src/styles/workflow.css` — G-14 스타일
- `src/dashboard/routes/skill.ts` — G-13 라우트
- `src/dashboard/ops/skill.ts` — G-13 타입

**i18n:** `src/i18n/locales/ko.json` + `en.json` 5개 키
**기타 (커밋 `04207b4`):** `.claude/session-handoff.md`, `docs/feedback/infra-layer-gaps.md`, `package.json`, `package-lock.json`, `src/dashboard/routes/admin.ts`

**테스트 (커밋 `04207b4` + 보정):**
- `tests/bus/validation.test.ts` — 14 tests
- `tests/auth/login-rate-limiter.test.ts` — 6 tests
- `tests/auth/rate-limit-route.test.ts` — 5 tests
- `tests/dashboard/cors.test.ts` — 7 tests
- `tests/agent/tools/h4-path-traversal.test.ts` — 6 tests (신규)
- `tests/orchestration/m13-consumer-wiring.test.ts` — 4 tests
- `tests/orchestration/m14-m15a-wiring.test.ts` — 10 tests
- `tests/dashboard/fe-phase2-gaps.test.ts` — 16 tests (G-13 BE + 소스 계약)
- `web/tests/layouts/g11-g12-pending-toast.test.tsx` — 7 tests (신규)
- `web/tests/pages/workflows/g14-profile-preview.test.tsx` — 6 tests (신규)
- `web/tests/prompting/g13-protocols-consumer.test.tsx` — 6 tests (커밋 완료, G-13 FE 소비자 렌더)

**기존 테스트 수정 (커밋 `04207b4`):**
- `tests/auth/auth-service.test.ts`, `tests/auth/switch-team.test.ts`, `tests/bus/bounded-queue.test.ts`, `tests/bus/message-bus.test.ts`, `tests/dashboard/tn-security-attack-scenarios.test.ts`, `tests/dashboard/tn1-middleware-integration.test.ts`, `tests/dashboard/tn3-runtime-injection.test.ts`, `tests/dashboard/tn4-session-rebinding.test.ts`

### Test Command

```bash
npx eslint src/bus/validation.ts src/auth/login-rate-limiter.ts src/agent/tools/filesystem.ts src/dashboard/routes/auth.ts src/dashboard/service.ts src/orchestration/service.ts src/orchestration/execution/execute-dispatcher.ts tests/bus/validation.test.ts tests/auth/login-rate-limiter.test.ts tests/auth/rate-limit-route.test.ts tests/dashboard/cors.test.ts tests/dashboard/fe-phase2-gaps.test.ts tests/orchestration/m13-consumer-wiring.test.ts tests/orchestration/m14-m15a-wiring.test.ts tests/agent/tools/h4-path-traversal.test.ts web/src/layouts/root.tsx web/src/pages/workflows/inspector-params.tsx
npx vitest run tests/bus/validation.test.ts tests/auth/login-rate-limiter.test.ts tests/auth/rate-limit-route.test.ts tests/dashboard/cors.test.ts tests/orchestration/m13-consumer-wiring.test.ts tests/orchestration/m14-m15a-wiring.test.ts tests/dashboard/fe-phase2-gaps.test.ts tests/agent/tools/h4-path-traversal.test.ts
npx tsc --noEmit
cd web && npx tsc --noEmit && npx vitest run tests/prompting/g13-protocols-consumer.test.tsx tests/layouts/g11-g12-pending-toast.test.tsx tests/pages/workflows/g14-profile-preview.test.tsx && npm test
```

### Test Result

```
npx eslint (17 files): 0 errors, 0 warnings

root vitest (8 files): 68 tests passed
root tsc: 0 errors

web tsc: 0 errors
web G-13/G-11/G-12/G-14 렌더: 3 files / 19 tests passed
web npm test: 34 files / 247 tests passed
```

### Residual Risk

- **H-2/H-3**: 경고만. Phase 5.
- **M-15b**: Scorecard 필요. Phase 5.
- **M-25 (CSP)**: Phase 5.
- **H-5/H-7/H-9/H-11/H-12**: Phase 5.
- **G-15/G-16**: Phase 3.
- **H-4 symlink**: Windows 2개 조건부 스킵.

> 마지막 업데이트: 2026-03-18 16:20
