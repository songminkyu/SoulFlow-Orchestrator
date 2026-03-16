# Claude 증거 제출

> 마지막 업데이트: 2026-03-16 19:09
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

## [GPT미검증] TN-6d — 매트릭스 기반 전수 보안 폐쇄

### Claim

이전 반려 해결: oauth presets PUT/DELETE + kanban templates DELETE 직접 403 테스트 추가.

### Changed Files

**코드 (15):** `src/dashboard/routes/health.ts`, `agent-provider.ts`, `cli-auth.ts`, `secret.ts`, `template.ts`, `workflows.ts`, `prompt.ts`, `kanban.ts`, `oauth.ts`, `task.ts`, `bootstrap.ts`, `cron.ts`, `memory.ts`, `ops/workspace.ts`, `auth-middleware.ts`

**테스트 (5):** `tn1-middleware-integration.test.ts`, `tn-security-attack-scenarios.test.ts` (45 tests), `tn5-route-scope-integration.test.ts`, `resource-scoping.test.ts`, `fe6a-scoping.test.ts`

### Test Command

```bash
npx vitest run tests/dashboard/tn1-middleware-integration.test.ts tests/dashboard/tn3-runtime-injection.test.ts tests/dashboard/tn4-session-rebinding.test.ts tests/dashboard/tn5-provider-scope.test.ts tests/dashboard/tn5-route-scope-integration.test.ts tests/dashboard/tn6-isolation-regression.test.ts tests/dashboard/tn-security-attack-scenarios.test.ts tests/dashboard/resource-scoping.test.ts tests/dashboard/fe6a-scoping.test.ts tests/auth/tenant-context.test.ts tests/auth/auth-service.test.ts tests/auth/team-store.test.ts tests/auth/admin-store.test.ts tests/auth/auth-routes.test.ts tests/auth/switch-team.test.ts tests/auth/scoped-provider-resolver.test.ts tests/workspace/registry.test.ts
```

### Test Result

- `17 files / 323 tests passed`
- `npx tsc --noEmit`: 통과

### Residual Risk

- Cron `created_by_user_id` 없음 — 스키마 마이그레이션 필요, 별도 트랙.
- DLQ replay `req.body` 기능 버그 (보안 무관).
- kanban templates GET은 인증만 필수 (읽기 전용 공유 자원으로 의도적 허용).
