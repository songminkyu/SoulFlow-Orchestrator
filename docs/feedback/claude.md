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
- `[합의완료]` Phase 0+1+2 인프라 전수조사 13건 + 감사 보정 8건

## [GPT미검증] Phase 3 — High 보안 잔여 3건 (H-5, H-7, H-9)

### Claim

인프라 전수조사 Phase 3: MUST(High) 잔여 보안 항목 3건을 병렬 워크트리로 구현 후 메인에 통합.

**H-5 (cron DoS 방어 + M-17 dispose):**
`src/agent/tools/cron-shell.ts`의 `cron_to_interval_ms()`에서 `*/0` → `0 * 60_000 = 0` → `setInterval(fn, 0)` CPU 무한루프 취약점 수정. 분/시 필드 제수 0 검사 추가, `dispose()` 메서드 추가로 M-17(타이머 미해제) 동시 해결.

**H-7 (서버 측 세션 무효화):**
비밀번호 변경 시 기존 JWT가 만료까지 유효하던 문제 수정. `admin-store.ts`에 `password_changed_at` 컬럼 마이그레이션 + `get_password_changed_at()` 메서드 추가. `auth-service.ts`에 `is_token_valid_for_user(user_id, iat)` 추가 — JWT `iat < password_changed_at`이면 거부. `service.ts` 인증 미들웨어에서 `verify_token()` 후 추가 검사.

**H-9 (Webhook HMAC-SHA256 서명 검증):**
`src/dashboard/routes/webhook.ts`에 HMAC-SHA256 본문 서명 검증 추가. 기존 Bearer 토큰과 OR 조건. `X-Signature-256` / `X-Hub-Signature-256` 헤더 지원. `timingSafeEqual`로 타이밍 공격 방지. `X-Webhook-Timestamp` 5분 리플레이 방지(선택적).

### Changed Files

**H-5:**
- `src/agent/tools/cron-shell.ts` — 제수 0 검사 + dispose() 추가
- `tests/agent/tools/h5-cron-dos.test.ts` — 8개 직접 테스트 (신규)

**H-7:**
- `src/auth/admin-store.ts` — `password_changed_at` 컬럼 마이그레이션 + UserRecord/UserRow 타입 + `get_password_changed_at()`
- `src/auth/auth-service.ts` — `update_password()`에 `password_changed_at` 기록 + `is_token_valid_for_user()` + `setup_superadmin()` 초기화
- `src/dashboard/service.ts` — 인증 미들웨어에 `is_token_valid_for_user` 검사 추가
- `tests/auth/h7-session-invalidation.test.ts` — 6개 직접 테스트 (신규)

**H-9:**
- `src/dashboard/routes/webhook.ts` — `verify_hmac_signature()` + `verify_timestamp()` + dispatch OR 로직
- `src/dashboard/service.ts` — `read_raw_body` 구현 + `_read_raw_body()` 메서드
- `tests/dashboard/h9-webhook-signature.test.ts` — 9개 직접 테스트 (신규)

### Test Command

```bash
npx eslint src/agent/tools/cron-shell.ts src/auth/admin-store.ts src/auth/auth-service.ts src/dashboard/service.ts src/dashboard/routes/webhook.ts tests/agent/tools/h5-cron-dos.test.ts tests/auth/h7-session-invalidation.test.ts tests/dashboard/h9-webhook-signature.test.ts
npx vitest run tests/agent/tools/h5-cron-dos.test.ts tests/auth/h7-session-invalidation.test.ts tests/dashboard/h9-webhook-signature.test.ts
npx tsc --noEmit
npx vitest run tests/auth/auth-service.test.ts tests/dashboard/cors.test.ts tests/bus/message-bus.test.ts
```

### Test Result

```
eslint (8 files): 0 errors, 0 warnings

vitest (3 new test files):
 ✓ tests/dashboard/h9-webhook-signature.test.ts (9 tests) 4ms
 ✓ tests/auth/h7-session-invalidation.test.ts (6 tests) 331ms
 ✓ tests/agent/tools/h5-cron-dos.test.ts (8 tests) 3ms
 Test Files  3 passed (3)
      Tests  23 passed (23)

tsc --noEmit: 0 errors

vitest (regression — 3 existing test files):
 ✓ tests/auth/auth-service.test.ts (24 tests) 960ms
 ✓ tests/bus/message-bus.test.ts (17 tests) 70ms
 ✓ tests/dashboard/cors.test.ts (7 tests) 3ms
 Test Files  3 passed (3)
      Tests  48 passed (48)
```

### Residual Risk

- **H-5**: 최소 간격 플로어 미적용 — `*/1`(1분)은 유효. `dispose()`는 Tool 베이스 클래스 라이프사이클에 자동 연결 안 됨.
- **H-7**: 레거시 계정(`password_changed_at = null`)은 하위 호환으로 토큰 허용. `verify_token()`은 DB 조회 없는 순수 암호 검증이고, `is_token_valid_for_user()`가 DB를 조회하므로 인증 미들웨어에서만 동작.
- **H-9**: `read_raw_body`와 `read_body`가 동일 스트림을 독립 소비 — 현재 HMAC 경로에서 `read_raw_body`만 호출하므로 문제 없으나, 순서 변경 시 주의. 리플레이 nonce 저장소 없음 (H-11 완전 구현 시 해결 예정).
