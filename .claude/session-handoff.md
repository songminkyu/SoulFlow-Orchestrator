---
name: 세션 핸드오프
description: 진행 중인 작업 목록 — 세션 시작 시 반드시 읽고 이어할 작업 확인
type: project
---

## 다음 작업

### [infra-phase2-audit] Phase 0+1+2 전수조사 재수행
- **상태**: 미착수
- **depends_on**: —
- **blocks**: infra-phase3
- **배경**: Phase 0+1+2 구현 + 테스트 완료(커밋 `6df333b`). GPT 감사에서 M-14/M-15a + G-13 FE 보정 후 부분 `[합의완료]`. 그러나 **Phase 0+1+2 전체 13건을 하나의 증거로 통합 감사**하는 것이 미완. 다음 세션에서 전수조사 재수행.
- **할 것**:
  1. `docs/feedback/claude.md`에 Phase 0+1+2 전체 증거를 단일 `[GPT미검증]` 블록으로 재작성
  2. 구현자 워크트리 배분 → 감사 루프 자기완결 → `[합의완료]`
  3. 스쿼시 머지
- **참고**: `.claude/references/feedback/iteration-phase012.md`에 CC-2 타이밍, 테스트 표현 금지어 등 이전 이터레이션 교훈 기록됨

### [infra-phase3] 인프라 전수조사 Phase 3 — High 잔여 보안 (H-5, H-7, H-9)
- **상태**: 미착수
- **depends_on**: infra-phase2-audit
- **blocks**: infra-phase4
- **배경**: infra-layer-gaps.md MUST 12건 중 6건 완료. 남은 High 중 구현 가능한 3건.
- **할 것**:
  - H-5: `cron_to_interval_ms()` `*/0` → 0ms DoS 방어
  - H-7: 서버 측 세션 무효화 (비밀번호 변경 시 JWT 회수)
  - H-9: Webhook 서명 검증 (HMAC-SHA256)

### [infra-phase4] 인프라 전수조사 Phase 4 — High 문서-코드 괴리 (H-6, H-11, H-12)
- **상태**: 미착수
- **depends_on**: —
- **blocks**: —
- **배경**: 문서와 코드 불일치 3건. H-6은 ts-rs 파이프라인, H-11/H-12는 가드레일.

### [worktree-isolation] 워크트리 서브에이전트 격리 문제
- **상태**: 설계 필요
- **depends_on**: —
- **blocks**: —
- **배경**: `context.mjs`의 `resolveRepoRoot()`가 `git rev-parse --show-toplevel`로 항상 메인 레포 반환. 워크트리에서 실행해도 메인 파일을 수정함.
- **할 것**: `process.cwd()` 또는 `GIT_WORK_TREE` 환경변수 기반으로 워크트리 루트 올바르게 해석하도록 수정.

### [smoke-test] 루프 검증용 스모크 태스크
- **상태**: 미착수
- **depends_on**: —
- **blocks**: —
- **배경**: consensus-loop E2E 루프 한 바퀴 검증. 최소 변경으로 전체 파이프라인(implementer → evidence → audit → retro → merge) 시험.
- **할 것**: `tests/_helpers.mjs` 공통 테스트 헬퍼 생성 (`test`, `describe`, `summary` 함수). 기존 `cl1-verify.test.mjs`가 이를 import하도록 수정. 테스트 통과 확인.

## 완료

- [plugin-iteration] consensus-loop 플러그인 이터레이션 검증 — E2E 루프 완주, 스킬 동작 확인
- [ev-correction] Phase 0+1+2 구현 + 부분 감사 완료 (커밋 `6df333b`)
- M-14/M-15a 통합 테스트 `[합의완료]`
- G-13 FE 소비자 렌더 테스트 `[합의완료]`
