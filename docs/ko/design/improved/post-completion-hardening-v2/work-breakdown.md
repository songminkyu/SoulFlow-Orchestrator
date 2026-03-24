# 작업 분해: Post-Completion Hardening v2

## 작업 원칙

- PCH v1 잔여 항목만 포함 (신규 발견 시 별도 이슈)
- 코드 외 작업(법적 검토, 문서화)도 WB로 추적
- 독립 항목은 순서 무관 병렬 실행 가능

## 진행 현황

| WB | 항목 | 상태 | 분류 | 심각도 | 원본 ID |
|----|------|------|------|--------|---------|
| **컴플라이언스** | | | | | |
| V2-C1 | Claude Agent SDK 라이선스 법적 검토 (AGPL vs 상용) | 미착수 | 컴플라이언스 | HIGH | PCH-C1 |
| V2-C2 | 사용자 삭제 → `session_messages` 캐스케이드 | ✅ 완료 | GDPR | HIGH | PCH-C3 |
| V2-C3 | 채팅 메시지 앱 레벨 암호화 정책 문서화 | 미착수 | GDPR | MEDIUM | PCH-C4 |
| V2-C4 | Per-user/team LLM 비용 제어 (예산/쿼터) | 미착수 | 설계 | MEDIUM | PCH-C5 |
| **보안** | | | | | |
| V2-S1 | Secret-read node 환경 변수 마스킹 강제 | 미착수 | 보안 | MEDIUM | PCH-S16 |
| **UX** | | | | | |
| V2-U1 | 채팅 빈 상태 AiSuggestions 연결 (starter prompts) | 미착수 | UX | MEDIUM | PCH-U5 |
| V2-U2 | StatusView 통합 로딩 패턴 전 페이지 적용 | 미착수 | UX | MEDIUM | PCH-U6 |
| V2-U3 | ErrorBoundary i18n + CSS 클래스 전환 | 미착수 | UX/i18n | LOW | PCH-U7 |
| **접근성** | | | | | |
| V2-A1 | 인라인 폼 검증 + `aria-invalid` (setup, kanban, workflow) | 미착수 | a11y | MEDIUM | PCH-A6 |
| **배포** | | | | | |
| V2-D1 | 폰트 로컬 호스팅 — 실제 폰트 다운로드 + @font-face 적용 | 부분 완료 | 배포 | MEDIUM | PCH-D2 |
| **코드 품질** | | | | | |
| V2-Q1 | Orphan 파일 정리 (5개 확인: feedback-analyzer, output-reduction-kpi, worker-dispatch, prompt-version, orchestrator-llm-health) | 미착수 | 코드품질 | LOW | PCH-Q9 |
| **라이프사이클** | | | | | |
| V2-L1 | Cron 파일 락 → `CoordinationStore` 분산 락 전환 | 미착수 | 정합성 | MEDIUM | PCH-L10 |
| V2-L2 | Redis bus 폴백 시 명시적 실패 또는 시작 배너 경고 | 미착수 | 운영 | MEDIUM | PCH-L12 |
| V2-L3 | Config API 변경 런타임 전파 또는 UI 재시작 안내 | 미착수 | 설정 | LOW | PCH-L19 |
| V2-L4 | `maxToolCallsPerRun=1` 동작 문서화 또는 `min(2)` 제약 | 미착수 | 설정 | LOW | PCH-L21 |
| V2-L5 | `systemPromptMaxTokens` 최소값 경고 (2000 미만) | 미착수 | 설정 | LOW | PCH-L22 |
| V2-P1 | AdminStore 이중 부트 제거 (resolve_boot_identity 임시 인스턴스) | 미착수 | 성능 | LOW | PCH-P7 |
| **아키텍처** | | | | | |
| V2-R1 | PA 트랙 잔여 포트 추출 (RequestPlanner, ChannelDelivery, ProviderExecution) | 미착수 | 아키텍처 | LOW | PCH-R1 |
| **코드 위생 (신규 발견)** | | | | | |
| V2-H1 | 빈 catch 블록 525건 (245파일) — 최소 `error_message` 로깅 추가 | 진행 중 (배치1 완료: 핵심 8파일) | 코드품질 | HIGH | — |
| V2-H2 | `Record<string, unknown>` 1,451건 → 구체적 타입 정의 | 미착수 | 타입안전 | MEDIUM | — |
| V2-H3 | SSRF 방지 미완성 — 사설 IP/포트/리다이렉트 체인 처리 | ✅ 완료 | 보안 | HIGH | CWE-918 |
| V2-H4 | 스텁 테스트 ~18건 → 실제 assertion 커버리지 확대 | 미착수 | 테스트 | MEDIUM | — |
| V2-H5 | `flatted` 취약점 → `npm audit fix` 또는 대체 | 미착수 | 보안 | MEDIUM | CVE |
| **PR #13 Copilot 리포트 발견 (신규)** | | | | | |
| V2-PR1 | EXPLAIN QUERY PLAN SQL 인젝션 — 세미콜론/서브쿼리 차단 | ✅ 완료 | 보안 | HIGH | P1 |
| V2-PR2 | JWT 시크릿 환경변수 우선 로딩 (env → DB fallback) | 미착수 | 보안 | MEDIUM | P2 |
| V2-PR3 | CSRF 토큰 미들웨어 (POST/PATCH/DELETE) | 미착수 | 보안 | MEDIUM | P3 |
| V2-PR4 | 버스 옵저버 에러 → 구조화된 로깅 | ✅ 완료 | 에러핸들링 | HIGH | P6 |
| V2-PR5 | ACK 실패 → 로깅 + 메트릭 카운터 | ✅ 완료 | 에러핸들링 | HIGH | P8 |
| V2-PR6 | 레거시 계정 첫 로그인 비밀번호 재설정 | 미착수 | 인증 | LOW | P5 |
| V2-PR7 | 비동기 훅 에러 로깅 (hooks/runner.ts:181) | 미착수 | 에러핸들링 | MEDIUM | P10 |
| V2-PR8 | 감사 이벤트 append 실패 메트릭 | 미착수 | 에러핸들링 | MEDIUM | P9 |
| V2-PR9 | 통합 테스트 추가 (10건+) + 피라미드 개선 | 미착수 | 테스트 | MEDIUM | P15 |
| V2-PR10 | i18n 키 완전성 테스트 (양쪽 로케일 일치) | 미착수 | 테스트 | MEDIUM | P16 |
| V2-PR11 | 멀티테넌트 격리 테스트 (교차 team_id 차단) | 미착수 | 테스트 | MEDIUM | P19 |
| V2-PR12 | ChannelManager 분해 (1,339줄 → 6모듈) | 미착수 | 리팩토링 | MEDIUM | R-1 |
| V2-PR13 | PhaseLoopRunner 분해 (1,395줄 → 6모듈) | 미착수 | 리팩토링 | MEDIUM | R-2 |
| V2-PR14 | workflow-node.types.ts 분할 (2,300줄 → 6파일) | 미착수 | 리팩토링 | LOW | R-4 |
| V2-PR15 | Recursive CTE DoS 방지 | 미착수 | 보안 | LOW | I-6 |
| V2-PR16 | .toBe(true) → 구체적 어설션 (375건) | 미착수 | 테스트 | LOW | P17 |
| V2-PR17 | 채널 렌더러 에러 핸들러 내 에러 로깅 | 미착수 | 에러핸들링 | MEDIUM | P7 |
| **해결 완료** | | | | | |
| ~~V2-F1~~ | ~~번들 분석기~~ | ✅ 완료 | DX | LOW | PCH-F8 |
| ~~V2-R2~~ | ~~AP-1 Composition root sub-bundle 분할~~ | ✅ 완료 | 아키텍처 | MEDIUM | PCH-R2 |
| ~~V2-R3~~ | ~~TR-4 Novelty gate → 공유 tokenizer 정렬~~ | ✅ 완료 | 정합성 | MEDIUM | PCH-R3 |
| ~~V2-C2~~ | ~~GDPR 삭제 캐스케이드~~ | ✅ 완료 | GDPR | HIGH | PCH-C3 |
| ~~V2-H3~~ | ~~SSRF 방지 (포트/리다이렉트/RSS/healthcheck)~~ | ✅ 완료 | 보안 | HIGH | CWE-918 |
| ~~V2-PR1~~ | ~~SQL 인젝션 차단~~ | ✅ 완료 | 보안 | HIGH | P1 |
| ~~V2-PR4~~ | ~~버스 옵저버 에러 로깅 + 메트릭~~ | ✅ 완료 | 에러핸들링 | HIGH | P6 |
| ~~V2-PR5~~ | ~~ACK 실패 로깅 + 메트릭~~ | ✅ 완료 | 에러핸들링 | HIGH | P8 |

## 심각도별 요약 (미해결만)

| 심각도 | 건수 | 항목 |
|--------|------|------|
| HIGH | 2 | V2-C1, H1(진행중) |
| MEDIUM | 21 | V2-C3, C4, S1, U1, U2, A1, D1, L1, L2, H2, H4, H5, PR2, PR3, PR7, PR8, PR9, PR10, PR11, PR12, PR13, PR17 |
| LOW | 12 | V2-U3, Q1, L3, L4, L5, P1, R1, PR6, PR14, PR15, PR16 |
| **미해결 합계** | **33** | |
| ~~해결~~ | ~~8~~ | ~~F1, R2, R3, C2, H3, PR1, PR4, PR5~~ |
