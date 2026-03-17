---
name: 세션 핸드오프
description: 진행 중인 작업 목록 — 세션 시작 시 반드시 읽고 이어할 작업 확인
type: project
---

## 다음 작업

### [ev-correction] EV-Track4 + FE-4 계류 보정
- **상태**: 미착수
- **depends_on**: —
- **blocks**: —
- **배경**: GPT 감사에서 `[계류]` 판정 — lint 오류, 탭 통합 테스트 부재, baseline diff FE 테스트 부재
- **할 것**: `eval-panel.tsx` toast 타입 오류 수정, bundle 전환 시 상태 초기화, PromptingPage eval 탭 통합 테스트 추가

## 완료 (다음 정리 시 제거)

- [handoff-deps] 핸드오프 포맷 개선 — `[task-id]`, `depends_on`, `blocks` 필드 도입
- [async-audit] 감사 비동기 전환 — spawn detached + TTL 락 + 스트리밍 + Cron 폐쇄 루프
- 프롬프트 템플릿 경로 수정 — `{{REFERENCES_DIR}}` 도입, 판정 태그 강제
- OB-Track3 — `[합의완료]` 전체 닫힘
- consensus-loop i18n — 6개 .mjs 하드코딩 → locale 키 + 타임스탬프 레이어 수정 (커밋 `185f5b9`)
- 핸드오프 저장소 동기화 — session-gate 프로토콜 실전 검증 완료
- cc-session-tools 오픈소스 — GitHub + npm 배포 완료
