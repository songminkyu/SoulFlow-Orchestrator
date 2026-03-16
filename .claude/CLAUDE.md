# SoulFlow Orchestrator

클라우드 독립, 셀프 호스팅 AI 에이전트 런타임. Slack·Telegram·Discord·Web 채널, 9개 프로바이더, 141-노드 워크플로우 엔진.

## 공통 개발 인프라

zeroquant(Rust) → SoulFlow(TypeScript)를 거치며 축적된 노하우. 모든 프로젝트에 동일하게 적용.

| 계층 | 구성 | 역할 |
|------|------|------|
| AI 에이전트 | Claude Code (Opus) | 구현·리뷰·디버깅 |
| 코드 품질 게이트 | consensus-loop 훅 | GPT 감사 → 합의 후 커밋 |
| HITL 프로토콜 | session-gate 훅 | 회고 미완료 시 커밋 차단 |
| 피드백 축적 | 메모리 시스템 | 세션 간 원칙·피드백 영속 |
| 코드 규칙 | `.claude/rules/` | 언어·패턴·테스트 컨벤션 |
| 정책 관리 | `templates/references/{ko,en}/` | 팀이 코드 변경 없이 기준 조정 |

## 관련 저장소

| 저장소 | 역할 | 언어 |
|--------|------|------|
| `SoulFlow-Orchestrator` | 메인 오케스트레이터 (이 저장소) | TypeScript |
| `consensus-loop` | GPT 감사 훅 — 코드 품질 게이트 | JavaScript |
| `zeroquant` | 알고리즘 트레이딩 시스템 | Rust |
| `MVVMToolKit` | WPF MVVM 인프라 라이브러리 | C# |
| `mcp-slack-agent-team` | Claude Code ↔ Slack MCP | TypeScript |

## 아키텍처

- **백엔드**: Codex Appserver (메인) + Claude Agent SDK (보조). 이슈 수정 시 Codex 대상.
- **프론트엔드**: SolidJS 대시보드 (`src/dashboard/`)
- **에이전트**: `src/agent/` — 워크플로우 기반 멀티 에이전트 실행
- **채널**: Slack, 웹, CLI (`src/channels/`)
- **인프라**: Redis (버스/세션), SQLite (이벤트/칸반), Vault (시크릿), Podman/Docker

## 작업 규칙

- 구현 요청 → **코드를 직접 수정**. 플랜 문서 금지 (명시적 요청 시만).
- 조언/답변 → **간결하게**. 불필요한 구현 확장 금지.
- 코드 리뷰 → **증분 결과 전달**. 5~10개 파일마다 중간 요약.
- 대규모 리뷰/감사 → **20개 초과 시 배치 분할**. "전체" 리뷰 1회 시도 금지.
- 60분 초과 세션 → **push/deploy 전 HITL 재확인**. 컨텍스트 압축 후 규칙 희석 방지.
- 커밋 전 → `git diff --cached --name-only`로 변경 목록 표시. 무관한 파일 제거. `git add .` 금지.
- `docs/` 하위 설계 문서 → **절대 수정 금지**.

## 감사 워크플로우

구현 → `[GPT미검증]` 제출 → GPT 감사 → `[합의완료]`/`[계류]` → 회고(HITL) → 커밋.

- `docs/feedback/claude.md`: 증거 제출 (Write 전체 교체)
- `docs/feedback/gpt.md`: GPT 판정 (시스템 관리)
- 정책 참조: `.claude/hooks/consensus-loop/templates/references/ko/`
