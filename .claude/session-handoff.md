---
name: 세션 핸드오프
description: 진행 중인 작업 목록 — 세션 시작 시 반드시 읽고 이어할 작업 확인
type: project
---

## 다음 작업

### [infra-phase3] 인프라 전수조사 Phase 3 — High 잔여 보안 (H-5, H-7, H-9)
- **상태**: 미착수
- **depends_on**: —
- **blocks**: infra-phase4
- **배경**: infra-layer-gaps.md MUST 12건 중 6건 완료. 남은 High 중 구현 가능한 3건 선택.
- **할 것**:
  - H-5: `cron_to_interval_ms()` `*/0` → 0ms DoS 방어
  - H-7: 서버 측 세션 무효화 (비밀번호 변경 시 JWT 회수)
  - H-9: Webhook 서명 검증 (HMAC-SHA256)
- **구현자 워크트리 배분** → 감사 루프 자기완결

### [infra-phase4] 인프라 전수조사 Phase 4 — High 문서-코드 괴리 (H-6, H-11, H-12)
- **상태**: 미착수
- **depends_on**: —
- **blocks**: —
- **배경**: 문서와 코드 불일치 3건. H-6은 ts-rs 파이프라인, H-11/H-12는 가드레일.

### [worktree-isolation] 워크트리 서브에이전트 격리 문제
- **상태**: 설계 필요
- **depends_on**: —
- **blocks**: —
- **배경**: `context.mjs`의 `resolveRepoRoot()`가 `git rev-parse --show-toplevel`로 항상 메인 레포 반환. 워크트리에서 실행해도 메인 파일을 수정함. `audit.mjs`, `respond.mjs` 모두 영향.
- **할 것**: `process.cwd()` 또는 `GIT_WORK_TREE` 환경변수 기반으로 워크트리 루트 올바르게 해석하도록 수정.

## 완료

- [plugin-iteration] consensus-loop 플러그인 이터레이션 검증 — E2E 루프 완주, 스킬 동작 확인
- [ev-correction] Phase 0+1+2 인프라 전수조사 13건 `[합의완료]` (커밋 `6df333b`)
- M-14/M-15a 통합 테스트 `[합의완료]`
- G-13 FE 소비자 렌더 테스트 `[합의완료]`
