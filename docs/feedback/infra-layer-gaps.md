# 전수조사 최종 매트릭스 (5회 스캔 통합)

> 작성: Claude Opus (consensus-loop 세션)
> 스캔: 5회 반복, 관점 교차 검증
> 대상: Track 1~13 exit condition × 13개 인프라 계층
> 수렴 판단: 5차에서 High 1건(문서 불일치, 기존 4차 발견의 확장) → 새 관점 소진

---

## 최종 통합 매트릭스

| Track | API | 데이터 | 인증 | EventBus | 추상화 | 런타임 | Tenant | 보안심화 | 배포 | 문서정합 |
|-------|:---:|:------:|:----:|:--------:|:------:|:------:|:------:|:-------:|:----:|:-------:|
| T1 Security | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | — | ❌ | ❌ | ❌ |
| T2 Tenant | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ⚠️ | — | — |
| T3 Observability | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | — | — | — | — |
| T4 Evaluation | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | — | — | — | — |
| T5 Guardrails | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | — | ⚠️ | — | ❌ |
| T6 Ports/DI | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ | — | — | — | — |
| T7 Gateway | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| T8 Role Protocol | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | — | — | — | — |
| T9 Schema Chain | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | — | — | — |
| T10 Parallel | ✅ | ✅ | ✅ | — | ✅ | ⚠️ | — | ⚠️ | — | — |
| T11 Reduction | ✅ | ✅ | ✅ | — | ✅ | ❌ | — | — | — | — |
| T12 Quality | ✅ | ✅ | ✅ | — | ✅ | ❌ | — | — | — | — |
| T13 Repo Profile | ✅ | ✅ | ✅ | — | ✅ | ✅ | ⚠️ | — | — | — |

---

## MUST (High) — 12건

차단 요인이거나 보안 위험. Phase 0~1에서 해결.

| # | Track | 항목 | 스캔 | 공격 벡터 |
|---|-------|------|------|-----------|
| H-1 | T1 | EventBus payload 무검증 — 크기/스키마 런타임 검증 전무 | 1차 | DoS (메모리/Redis 폭발) |
| H-2 | T2 | EventBus tenant 격리 없음 — 단일 큐, team_id 없음 | 1차 | 교차 tenant 스누핑 |
| H-3 | T3 | EventBus trace 단절 — publish/consume 간 correlation 끊어짐 | 1차 | end-to-end 디버깅 불가 |
| H-4 | T1 | 파일 시스템 path traversal — `startsWith(root)` 방어 부재 | 1차 | 경로 탈출 |
| H-5 | T5 | `cron_to_interval_ms()` — `*/0`이 0ms 반환 → CPU 무한루프 | 3차 | DoS |
| H-6 | T14 | FE/BE 타입 수동 동기화 — `ts-rs` 규칙 있으나 미사용 | 3차 | 유령 필드, 타입 불일치 |
| H-7 | T1 | 서버 측 세션 무효화 부재 — 비밀번호 변경 시 기존 JWT 미회수 | 4차 | 계정 탈취 지속 |
| H-8 | T1 | API rate limiting 부재 — login brute-force + scrypt DoS 증폭 | 4차 | 인증 돌파 + CPU 소진 |
| H-9 | T1 | Webhook 서명 검증 미구현 — 문서는 "구현됨" 명시 | 4차 | webhook inject (모드 전환 시) |
| H-10 | T1 | CORS 미설정 — `0.0.0.0` + CORS 없음 | 4차 | cross-origin 인증 API 호출 |
| H-11 | T1 | 문서-코드 괴리: Webhook Edge Guard 3종 (서명/리플레이/Rate) | 5차 | H-9 확장 |
| H-12 | T5 | 문서-코드 괴리: Budget Contract/Novelty/Short-Circuit 미구현 | 5차 | 가드레일 미작동 |

---

## SHOULD (Medium) — 22건

exit condition 위반 또는 운영 위험. 해당 트랙 재방문 시 해결.

| # | Track | 항목 | 스캔 |
|---|-------|------|------|
| M-1 | T5 | EventBus 멱등성 부재 — Message.id 기반 중복 방지 없음 | 1차 |
| M-2 | T1+T2 | Vault 내부 tenant 격리 없음 — API만 prefix, 에이전트 직접 접근 가능 | 1차 |
| M-3 | T2 | PTY 로컬 모드 격리 없음 — Docker만 강력 | 1차 |
| M-4 | T5 | AgentLoop/Orchestration 동시성 락 부재 | 1차 |
| M-5 | T3 | today_key() UTC vs kst_today_key() KST 불일치 | 3차 |
| M-6 | T6 | Zod apiBase 빈 문자열 허용 — `.min(1)` 부재 | 3차 |
| M-7 | T14 | FE 유령 필드 — `request_class_summary`, `guardrail_stats` BE 미생성 | 3차 |
| M-8 | T1 | redis-bus 통합 테스트 부재 | 3차 |
| M-9 | T1 | inbound-seal 테스트 부재 | 3차 |
| M-10 | T2 | kanban-trigger-watcher 테스트 부재 | 3차 |
| M-11 | T6 | SQLite 스키마 버전관리 부재 — 마이그레이션 순서 암묵 의존 | 3차 |
| M-12 | T6 | 마이그레이션 롤백 전략 부재 | 3차 |
| M-13 | T10 | emit_reconcile_event + extract_reconcile_read_model 호출자 없음 | 1차 |
| M-14 | T11 | ToolOutputReducer 메인 파이프라인 미주입 — PTY만 작동 | 1차 |
| M-15a | T12 | classify_misroute/evaluate_route 런타임 미연결 — 오케스트레이션에 바로 연결 가능 | 1차 |
| M-15b | T12 | apply_rubric 런타임 미연결 — Scorecard(eval judges 출력) 필요, eval runner 확장으로 분리 | 1차 |
| M-16 | T4 | eval runner execute_with_timeout clearTimeout 미호출 | 3차 |
| M-17 | T5 | CronShellTool dispose() 부재 — 타이머 해제 불가 | 3차 |
| M-18 | T1 | JWT 만료 7일 하드코딩, 설정 불가 | 4차 |
| M-19 | T1 | Refresh token 부재 | 4차 |
| M-20 | T1 | 채널별 인바운드 rate limiting 부재 | 4차 |
| M-21 | T5 | 워크플로우 노드 수 상한 부재 | 4차 |
| M-22 | T2 | 사용자 데이터 일괄 삭제 API 부재 (GDPR) | 4차 |
| M-23 | T1 | LLM 전송 프롬프트 내 개인정보 경고/차단 부재 | 4차 |
| M-24 | T1 | HTTPS 미강제 + 리버스 프록시 가이드 부재 | 4차 |
| M-25 | T1 | 보안 헤더(CSP, X-Frame-Options) 미설정 | 4차 |
| M-26 | T1 | Token Egress Guard 미구현 (문서 불일치) | 5차 |
| M-27 | T1 | Filesystem Containment `__approved` 우회 + symlink 미검사 | 5차 |
| M-28 | T1 | Tool Security Policy 4종 중 2종만 구현 | 5차 |
| M-29 | — | 진행 중 에이전트 루프 graceful shutdown 미중단 | 5차 |

---

## BACKLOG (Low) — 15건

운영/품질 개선. 장기 백로그.

| # | Track | 항목 | 스캔 |
|---|-------|------|------|
| L-1 | T6 | TaskStore concrete 직접 import (포트 우회 1건) | 2차 |
| L-2 | T6 | 미사용 export 9건 (bus 3 + security 4 + orchestration 2) | 2차 |
| L-3 | — | 에러 삼킴: heartbeat, cron _on_change, phase-loop-runner | 2차 |
| L-4 | T6 | 하드코딩: Redis URL 2곳 중복, Ollama 주소 | 2차 |
| L-5 | T10 | critic-gate.ts `new Function()` — 워크플로우 조건 JS 실행 | 1차 |
| L-6 | T13 | Repo Profile tenant 격리 없음 (전역 단일) | 1차 |
| L-7 | T6 | env BUS_BACKEND Zod 전 as 캐스팅 | 3차 |
| L-8 | T5 | codex-appserver HITL setTimeout clearTimeout 미호출 | 3차 |
| L-9 | T3 | chunker Redis subscriber 리스너 미해제 | 3차 |
| L-10 | T14 | now_seoul_iso() KST 하드코딩 | 3차 |
| L-11 | T14 | FE AgentInfo BE 추가 필드 무시 | 3차 |
| L-12 | T5 | 워크플로우 정적 사이클 감지 부재 (런타임 가드만) | 4차 |
| L-13 | T1 | 워크플로우 정의 URL SSRF 검증 부재 (도구 레벨만) | 4차 |
| L-14 | T1 | JWT secret 메모리 평문 상주 (zeroize 미수행) | 4차 |
| L-15 | T5 | Session Reuse 인터페이스만, 배선 없음 | 5차 |
| L-16 | — | cache_store sweep 부재 (무한 성장 가능) | 5차 |
| L-17 | — | 셧다운 시 채널 메시지 수신 순서 (Low risk) | 5차 |

---

## FE 갭 원본 (FE 에이전트 조사, Track 14)

### Priority 1 — 백엔드 계약 존재 + FE 미연결 (바로 작업 가능)

| # | 트랙 | 갭 | 파일 | 심각도 |
|---|------|-----|------|--------|
| G-1 | T2 | 현재 팀 역할 badge가 topbar에 미표시 (dropdown 안에만 있음) | root.tsx | Medium |
| G-2 | T2 | 팀 전환 시 agents/models 쿼리 invalidation 누락 → 최대 15초 stale 데이터 | use-auth.ts | High |
| G-3 | T2 | models.tsx가 팀 컨텍스트를 전혀 인식하지 않음 | models.tsx | High |
| G-4 | T7 | chat-status-bar에 execution_route (direct/workflow/agent) 칩 미표시 | chat-status-bar.tsx | Medium |
| G-5 | T7 | message-list의 delivery-trace가 단순 텍스트 — 인터랙티브 drill-down 없음 | message-list.tsx | Low |
| G-6 | T9 | workflow detail에 parser-failure drill-down 없음 (schema_valid=false만 뱃지) | detail.tsx | Medium |
| G-7 | T9 | workflow 전체에 대한 verdict summary 없음 (개별 agent eval_score만 존재) | detail.tsx | Medium |
| G-8 | T10 | reconcile conflict 뱃지가 카운트만 표시 — status/detail 없음 | detail.tsx | Medium |
| G-9 | T10 | inspector-output에 conflict/retry drill-down 완전 부재 | inspector-output.tsx | Medium |
| G-10 | T14 | /usage 페이지가 observability summary(실시간 span)와 연결 안 됨 | usage/index.tsx | Low |

### Priority 2 — 백엔드 계약 부분 존재 + FE 미연결

| # | 트랙 | 갭 | 파일 | 비고 |
|---|------|-----|------|------|
| G-11 | T2 | 팀 전환 중 rebind-pending 시각적 상태 없음 (disabled만) | root.tsx | 사소하지만 UX 개선 |
| G-12 | T2 | cross-team denial toast/banner 없음 | 전역 | 백엔드 403 시 토스트 필요 |
| G-13 | T8 | agent-panel에 role-skill 선택은 있지만 protocol checklist가 유저 편집 불가 (하드코딩) | agent-panel.tsx | SHARED_PROTOCOLS 하드코딩 |
| G-14 | T8 | inspector-params에 prompt-profile preview 없음 (raw prompt만) | inspector-params.tsx | 컴파일된 프로필 요약 미제공 |
| G-15 | T11 | tool-call-block에 reduction provenance 없음 (원본 길이/축약 비율 미표시) | tool-call-block.tsx | truncation 표시는 있으나 reducer 정보 없음 |
| G-16 | T11 | message-bubble에 display projection 표시 없음 | message-bubble.tsx | 표준 렌더링만 존재 |

### Priority 3 — 백엔드 계약 미완성 (Track 14 원칙: 백엔드 먼저)

| # | 트랙 | 갭 | 파일 | 선행 조건 |
|---|------|-----|------|-----------|
| G-17 | T1 | local-binding/body-size 보안 플래그 미표시 | settings.tsx | SecurityPolicy 백엔드 계약 필요 |
| G-18 | T1 | webhook secret 상태 칩 미표시 | channels/index.tsx | WebhookPolicy 계약 필요 |
| G-19 | T1 | ingress-guard/ingress-policy 미표시 | channels/global-settings.tsx | RequestGuard 계약 필요 |
| G-20 | T1 | outbound egress/trust-zone 뱃지 미표시 | providers/index.tsx | OutboundTokenPolicy 계약 필요 |
| G-21 | T1 | containment failure toast/sanitized output 미표시 | workspace/references.tsx | PathContainmentGuard 계약 필요 |
| G-22 | T1 | 보안 진단 패널 없음 | admin/index.tsx | Security diagnostics API 필요 |
| G-23 | T12 | pass/warn/fail 품질 뱃지, 품질 rubric 행 | compare-panel.tsx | Quality rubric 백엔드 계약 필요 |
| G-24 | T12 | compiler quality verdict | nodes/eval.tsx | Workflow compiler quality policy 필요 |
| G-25 | T12 | memory-audit indicator | workspace/memory.tsx | Memory quality auditor 필요 |

---

## FE 갭 → 인프라 갭 역추적 (2026-03-18 갱신)

> FE 에이전트가 Priority 1 갭 10건(G-1~G-10)을 폐쇄함. Phase 1 (백엔드 미연결)도 처리 중.
> 아래는 현재 기준으로 **아직 미해결인 항목만** 표시.

### FE Phase 1: 단독 실행 가능 (Priority 1, G-1~G-10) — ✅ 폐쇄 완료

FE 에이전트가 31파일 228테스트로 전체 폐쇄. 커밋 대기.

| FE 갭 | 상태 | 비고 |
|--------|------|------|
| G-1 (topbar 팀 역할 badge) | ✅ 폐쇄 | |
| G-2 (팀 전환 query invalidation) | ✅ 폐쇄 | cross-tenant leakage 수정 |
| G-3 (models 팀 미인식) | ✅ 폐쇄 | |
| G-4 (execution_route 칩) | ✅ 폐쇄 | chat-status-bar |
| G-5 (delivery-trace drill-down) | ✅ 폐쇄 | message-list 인터랙티브 |
| G-6 (parser-failure drill-down) | ✅ 폐쇄 | schema_error/schema_repaired 필드 |
| G-7 (verdict summary) | ✅ 폐쇄 | WorkflowVerdictSummary 컴포넌트 |
| G-8 (reconcile conflict 상세) | ✅ 폐쇄 | reconcile_status/details 추가 |
| G-9 (conflict/retry drill-down) | ✅ 폐쇄 | inspector-output |
| G-10 (usage + observability) | ✅ 폐쇄 | usage ↔ observability summary 연결 |

### FE Phase 2: 부분 완료 (Priority 2, G-11~G-16) — 미착수

백엔드 계약이 **부분적으로** 존재. 아래 BE 요구사항을 충족하면 FE 연결 가능.

| # | FE 갭 | BE 요구사항 | FE 구현 | 상태 |
|---|-------|------------|---------|------|
| G-11 | 팀 전환 중 rebind-pending 시각 상태 | BE: 팀 전환 API 응답에 `rebinding: boolean` 상태 포함 (또는 SSE로 `team_switch_progress` 이벤트) | FE: `root.tsx`에 rebinding 중 spinner/disabled 오버레이 | 바로 가능 |
| G-12 | cross-team denial toast | BE: 403 응답 body에 `{ error: { code: "cross_team_denied", team_id, resource_team_id } }` 구조화 | FE: 전역 에러 핸들러에서 `cross_team_denied` 코드 감지 → 토스트 "이 리소스는 다른 팀에 속합니다" | 바로 가능 |
| G-13 | protocol checklist 편집 | BE: `GET /api/workflow/roles` 응답에 `protocols: Array<{id, name, editable}>` 포함 (현재 하드코딩된 `SHARED_PROTOCOLS`를 BE에서 제공) | FE: `agent-panel.tsx`에서 하드코딩 제거 → BE API 사용 + 편집 UI | 바로 가능 |
| G-14 | prompt-profile preview | BE: `PromptProfileCompiler.compile(role)` 결과를 API로 노출 — `GET /api/agents/:alias/compiled-profile` → `{ system_section, role_policy, protocols }` | FE: `inspector-params.tsx`에 렌더된 프로필 요약 패널 (raw prompt 대신) | 바로 가능 |
| G-15 | reduction provenance | BE: `ToolOutputReducer` 주입 후 (`M-14`) tool_call 응답에 `reduction: { original_length, reduced_length, kind, projection_type }` 필드 포함 | FE: `tool-call-block.tsx`에 "원본 1200자 → 축약 300자 (75%)" 표시 | M-14 완료 후 |
| G-16 | display projection | BE: `ToolOutputReducer`의 3-projection (prompt/display/storage) 중 `display_text`를 메시지 응답에 포함 | FE: `message-bubble.tsx`에서 `display_text` 사용 (없으면 기존 렌더링) | M-14 완료 후 |

### FE Phase 3: 미구현 (Priority 3, G-17~G-25) — 백엔드 계약 자체 없음

백엔드 정책/계약이 아직 planned 상태. Track 14 원칙: "do not paper over a missing backend contract with placeholder UI"

| # | FE 갭 | BE가 만들어야 할 계약 | FE가 할 것 | 선행 트랙 | requires (WB 의존) |
|---|-------|---------------------|-----------|-----------|-------------------|
| G-17 | local-binding/body-size 보안 플래그 | `SecurityPolicy` 타입: `{ local_binding, body_size_limit, tls_mode }` → `GET /api/security/policy` | `settings.tsx`에 보안 상태 카드 | T1 | — (기반 계약) |
| G-18 | webhook secret 상태 칩 | `WebhookPolicy`: `{ secret_configured, last_rotated, hmac_algorithm }` → `/api/channels` 응답에 포함 | `channels/index.tsx`에 secret 칩 | T1 | H-9 (webhook 서명 검증) |
| G-19 | ingress-guard/policy | `RequestGuard`: `{ rate_limit, ip_allowlist, replay_protection }` → `GET /api/security/ingress` | `channels/global-settings.tsx`에 인그레스 패널 | T1 | H-8 (rate limiting), H-11 (replay) |
| G-20 | outbound egress/trust-zone | `OutboundTokenPolicy`: `{ egress_scan_enabled, trust_zones, blocked_domains }` → `GET /api/security/egress` | `providers/index.tsx`에 아웃바운드 뱃지 | T1 | M-26 (Token Egress Guard) |
| G-21 | containment failure toast | `PathContainmentGuard`: 도구 실행 시 `containment_violation: { path, reason }` | 전역 토스트 | T1 | H-4 (path traversal 방어) |
| G-22 | 보안 진단 패널 | `GET /api/admin/security-diagnostics` → `{ vulnerabilities[], policy_compliance }` | `admin/index.tsx`에 보안 탭 | T1 | **G-17~G-21 모두** (진단은 각 정책이 있어야 검사 가능) |
| G-23 | pass/warn/fail 품질 뱃지 | `apply_rubric()` 런타임 연결 (M-15b) → `rubric_verdict` 포함. **requires Scorecard 파이프라인** (eval runner 확장) | `compare-panel.tsx`에 뱃지 | T12 | M-15b (rubric + Scorecard) |
| G-24 | compiler quality verdict | `audit_workflow_nodes()` → `compiler_quality: { warnings[], score }` | `nodes/eval.tsx`에 표시 | T12 | — (이미 phase-workflow에 연결됨) |
| G-25 | memory-audit indicator | `audit_memory_entry()` → `quality: "good"|"low"|"rejected"` | `workspace/memory.tsx`에 인디케이터 | T12 | M-15a (quality 연결 — Scorecard 불필요, 독립 가능) |

### Phase 3 의존 체인

```
기반 계약 (먼저):
  H-4  path traversal 방어
  H-8  rate limiting
  H-9  webhook 서명 검증
  H-11 replay protection
  M-15a classify_misroute/evaluate_route 런타임 연결 (바로 가능)
  M-15b apply_rubric 런타임 연결 (Scorecard 파이프라인 필요 → eval runner 확장)
  M-26 Token Egress Guard
      ↓
개별 정책 API:
  G-17 SecurityPolicy        ← 기반 (의존 없음)
  G-18 WebhookPolicy         ← requires H-9
  G-19 RequestGuard           ← requires H-8, H-11
  G-20 OutboundTokenPolicy    ← requires M-26
  G-21 PathContainmentGuard   ← requires H-4
  G-23 apply_rubric           ← requires M-15b (Scorecard 파이프라인)
  G-24 audit_workflow_nodes   ← 이미 연결됨
  G-25 audit_memory_entry     ← requires M-15a (Scorecard 불필요, 독립 가능)
      ↓
통합 진단:
  G-22 보안 진단 패널         ← requires G-17~G-21 모두
```

> **실행 순서**: 기반 인프라(H-4,8,9,11 + M-15,26) → 개별 정책 API(G-17~21,23~25) → 통합 진단(G-22) → FE 연결

---

## 작업 Phase (2026-03-18 갱신)

```
Phase 0: 인프라 기반 (Track 14 = local-first) — 미착수
  H-1~H-4: EventBus (tenant/trace/payload) + 파일 시스템
  H-10: CORS
  H-8: rate limiting

Phase 1: 백엔드 미연결 — ✅ FE 에이전트 처리 중
  M-13: reconcile emit 연결
  M-14: reducer 주입
  M-15: quality 런타임 연결

Phase 2: FE Priority 2 (차단 없음) — 미착수
  G-11, G-12, G-13, G-14

Phase 3: FE Priority 2 (Phase 1 완료 후) — 대기
  G-15, G-16

Phase 4: Chat UX 리디자인 (better-chatbot 기반) — 미착수
  FE-S: 쉘 레이아웃 통합
  FE-BE: 백엔드 도구 정책 (tool_choice, pinned_tools)
  FE-2: 통합 입력 바 + @mention + Tool Choice + URL 감지
  FE-3: 리치 도구 렌더링 + Dry Run + 도구 메뉴

Phase 5: 보안 강화 (T1 재방문)
  H-5,H-7,H-9,H-11,H-12: 인증/webhook/문서정합
  M-18~M-28: 보안 중간 항목
  G-17~G-25: 보안/품질 FE
```

---

## 문서-코드 괴리 요약

| 문서 | 주장 | 실제 | 심각도 |
|------|------|------|--------|
| security.md §8 Webhook Edge Guard | 서명/리플레이/Rate gate 구현됨 | 미구현 | High |
| security.md §8 Token Egress Guard | 도구 결과 시크릿 재봉인 | 미구현 | Medium |
| security.md §8 Filesystem Containment | traversal/symlink/exec 차단 | 부분 (`__approved` 우회) | Medium |
| security.md §8 Tool Security Policy | 4종 정책 | 2종만 구현 | Medium |
| agents.md Budget Contract | max_turns/tokens/retries 계약 | 인터페이스만, 배선 없음 | Medium |
| agents.md Novelty Policy | 동일 실패 스킵 | 미구현 | Medium |
| agents.md Session Reuse | outcome-aware 판단 | 인터페이스만 | Low |

> 문서가 "aspirational(목표)"와 "implemented(현재)"를 구분하지 않음.
> 사용자가 구현된 것으로 오해할 위험.

---

## 수렴 판단

| 스캔 | 신규 | High | 관점 |
|------|------|------|------|
| 1차 | 12 | 4 | EventBus/인프라 |
| 2차 | 7 | 0 | 추상화/코드품질 |
| 3차 | 17 | 2 | 설정/리소스/경계값/테스트/API계약 |
| 4차 | 15 | 4 | 인증/채널/배포 보안 |
| 5차 | 8 | 1 | shutdown/문서정합/성능 |

5차에서 **8건으로 감소 + High 1건(기존 확장)**. 새 관점 소진. **수렴 도달.**

---

**총계**: ❌ High 12건 / ⚠️ Medium 29건 / Low 17건 = **58건**
