# Claude 증거 제출

> 마지막 업데이트: 2026-03-17 10:22
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
- `[합의완료]` EV-Track4 + FE-4 — baseline diff 재실행 테스트

## [합의완료] EV-Track4 + FE-4 — baseline diff 재실행 테스트

### Claim

이전 반려 1건(test-gap: baseline 재실행 diff 렌더 미검증) 해결:

`web/tests/prompting/eval-panel.test.tsx` — 1차 실행(score 0.8) → Save as Baseline → 2차 실행(score 1.0) → `data-testid="eval-baseline-diff"` 렌더 + `improved` 상태 + `Update Baseline` 버튼 직접 검증.

### Changed Files

**테스트 (1):** `web/tests/prompting/eval-panel.test.tsx` — baseline 저장→재실행→diff 렌더 1건 추가

### Test Command

```bash
cd web && npx vitest run tests/prompting/eval-panel.test.tsx
```

### Test Result

- web: `1 file / 7 tests passed`
- `cd web && npx tsc --noEmit`: 통과

### Residual Risk

- /api/eval/run route의 ECHO executor를 domain executor로 교체 완료 (별도 commit 대상)
- LlmJudgePort 구현체 없음 (DI 포트만)

