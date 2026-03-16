# Claude 증거 제출

> 마지막 업데이트: 2026-03-16 18:26
> GPT 감사 문서: `docs/feedback/gpt.md`

## 합의완료

- `[합의완료]` SH-1 ~ SH-5
- `[합의완료]` TN-1 ~ TN-6 (트랙 범위 한정)
- `[합의완료]` OB-1 ~ OB-8, 저장소 전체 멀티테넌트 closeout
- `[합의완료]` EV-1 ~ EV-6, EG-1 ~ EG-5, EG-R1
- `[합의완료]` PA-1 + PA-2, TR-1 ~ TR-5
- `[합의완료]` GW-1 ~ GW-6, RP-1 ~ RP-6
- `[합의완료]` SO-1 ~ SO-7, PAR-1 ~ PAR-6
- `[합의완료]` E1 ~ E5, F1 ~ F5
- `[합의완료]` RPF-1 ~ RPF-6, RPF-4F
- `[합의완료]` QG-1 ~ QG-4
- `[합의완료]` FE-0 ~ FE-6a
- `[합의완료]` TN-1 + TN-2, TN-3 + TN-4, TN-5 + TN-6
- `[합의완료]` TN-6a, TN-6b, TN-6c

## [GPT미검증] TN-6d — 매트릭스 기반 전수 보안 폐쇄

### Claim

이전 반려 해결: claim-code 불일치 정정 + 매트릭스 엔드포인트 직접 테스트 추가.
- oauth presets: 읽기는 `require_team_manager`, 쓰기(POST/PUT/DELETE)만 `require_superadmin`. claim에서 "presets → require_superadmin"이 아닌 "presets write → require_superadmin"으로 정정.
- kanban templates: GET은 guard 없음(읽기 허용), POST/DELETE만 `require_superadmin`. claim 정정.
- SSRF: `api_base` 사용자 입력 차단.

### Changed Files

**코드 (15):** `src/dashboard/routes/health.ts`, `src/dashboard/routes/agent-provider.ts`, `src/dashboard/routes/cli-auth.ts`, `src/dashboard/routes/secret.ts`, `src/dashboard/routes/template.ts`, `src/dashboard/routes/workflows.ts`, `src/dashboard/routes/prompt.ts`, `src/dashboard/routes/kanban.ts`, `src/dashboard/routes/oauth.ts`, `src/dashboard/routes/task.ts`, `src/dashboard/routes/bootstrap.ts`, `src/dashboard/routes/cron.ts`, `src/dashboard/routes/memory.ts`, `src/dashboard/ops/workspace.ts`, `src/auth/auth-middleware.ts`

**테스트 (5):** `tests/dashboard/tn1-middleware-integration.test.ts`, `tests/dashboard/tn-security-attack-scenarios.test.ts`, `tests/dashboard/tn5-route-scope-integration.test.ts`, `tests/dashboard/resource-scoping.test.ts`, `tests/dashboard/fe6a-scoping.test.ts`

### Test Command

```bash
npx vitest run tests/dashboard/tn1-middleware-integration.test.ts tests/dashboard/tn3-runtime-injection.test.ts tests/dashboard/tn4-session-rebinding.test.ts tests/dashboard/tn5-provider-scope.test.ts tests/dashboard/tn5-route-scope-integration.test.ts tests/dashboard/tn6-isolation-regression.test.ts tests/dashboard/tn-security-attack-scenarios.test.ts tests/dashboard/resource-scoping.test.ts tests/dashboard/fe6a-scoping.test.ts tests/auth/tenant-context.test.ts tests/auth/auth-service.test.ts tests/auth/team-store.test.ts tests/auth/admin-store.test.ts tests/auth/auth-routes.test.ts tests/auth/switch-team.test.ts tests/auth/scoped-provider-resolver.test.ts tests/workspace/registry.test.ts
```

### Test Result

- `17 files / 315 tests passed`
- `npx tsc --noEmit`: 통과

### Residual Risk

- Cron job `created_by_user_id` 없음 — 스키마 마이그레이션 필요, 별도 트랙 권장.
- DLQ replay `req.body` → `ctx.read_body(req)` 기능 버그 (보안 무관).
- kanban templates GET은 인증만 필수, role 제한 없음 (읽기 전용 공유 자원으로 의도적 허용).
- oauth presets GET은 `require_team_manager` (인프라 정보이므로 member/viewer 차단).
