---
name: 세션 핸드오프
description: 진행 중인 작업 목록 — 세션 시작 시 반드시 읽고 이어할 작업 확인
type: project
---

## 다음 작업

### [plugin-iteration] consensus-loop 플러그인 이터레이션 검증
- **상태**: 진행 중
- **depends_on**: —
- **blocks**: —
- **배경**: `--plugin-dir` 방식으로 플러그인 활성화 성공. 다음 단계는 실제 이터레이션 루프 검증
- **완료된 것**:
  - plugin.json + marketplace.json 준비 완료
  - hooks/hooks.json `{ "hooks": { ... } }` 래퍼 수정
  - settings.local.json 개별 hook 제거, skill junction 제거
  - `--plugin-dir .claude/hooks/consensus-loop` 활성화 확인
- **남은 것**:
  - orchestrator → implementer(background, worktree) → verify → audit 루프 한 바퀴 검증
  - 워크트리 서브에이전트 hook 비연결 문제 해결 방안 설계
  - SA-1 worktree 결과 머지 여부 결정

### [ev-correction] EV-Track4 + FE-4 계류 보정
- **상태**: 미착수
- **depends_on**: —
- **blocks**: —
- **배경**: GPT 감사에서 `[계류]` 판정 — claim-drift, test-gap, i18n-gap
- **할 것**: H-2/H-3 claim 정정, G-11/G-12/G-14 직접 UI 테스트, root.tsx i18n

## 완료 (다음 정리 시 제거)

- [handoff-deps] 핸드오프 포맷 개선
- [async-audit] 감사 비동기 전환
- 프롬프트 템플릿 경로 수정
- OB-Track3 `[합의완료]`
- consensus-loop i18n
- 핸드오프 저장소 동기화
- cc-session-tools 오픈소스
- consensus-loop 플러그인 구조화 (skills 6개, hooks.json, plugin.json, marketplace.json)
