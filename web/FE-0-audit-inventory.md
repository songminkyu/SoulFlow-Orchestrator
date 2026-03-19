# FE-0 Audit Inventory — Batch 1 (chat + workspace)

## 요약 통계

| 카테고리 | 건수 |
|----------|------|
| i18n (하드코딩 문자열) | 14 |
| a11y (접근성 누락) | 8 |
| empty/loading/error/retry 상태 누락 | 7 |
| DRY/SOLID 위반 | 2 |
| stale copy / outdated terminology | 1 |
| backend binding 불일치 | 1 |
| cross-user isolation | 0 |
| mobile viewport | 1 |
| eslint-disable 사용 | 1 |
| inline style 남용 | 1 |
| **합계** | **36** |

---

## 파일별 발견 사항

### web/src/pages/chat/agent-context-bar.tsx

- [a11y] L67-73: 프롬프트 토글 버튼과 클리어 버튼에 `aria-label` 있으나, 확장/축소 상태(`aria-expanded`)가 프롬프트 토글에 없음. `expanded` 상태를 `aria-expanded`로 반영 필요.
- [a11y] L41: 전체 bar에 `role` 미지정. toolbar이나 region 역할 고려.

### web/src/pages/chat/canvas-panel.tsx

- [empty/loading/error] L24-26: `specs.length === 0`일 때 `null` 반환 — 의도적이나, 빈 상태 안내 없음. 최소한 부모가 처리하는지 확인 필요.
- [a11y] L50: `CanvasComponentView` 렌더 키가 인덱스(`key={i}`) — 컴포넌트 추가/삭제 시 상태 혼란 가능.
- [a11y] L68: `CanvasComponentView` switch문에 default case 누락. 알 수 없는 `type`이 오면 아무것도 렌더링하지 않음.
- [error] L293: `CanvasImage`에서 이미지 로드 실패 시 처리 없음 (`onError` 핸들러 없음).

### web/src/pages/chat/chat-session-tabs.tsx

- [i18n] L83: `aria-label="Chat sessions"` — 하드코딩 영문 문자열. `t("chat.sessions_label")` 등 locale key 필요.
- [i18n] L129: `aria-label="New session"` — 하드코딩 영문 문자열. `t("chat.new_session")` 사용 필요.
- [a11y] L85-123: `role="tab"` 요소에 `tabIndex` 미지정. 키보드 방향키 탐색(`ArrowLeft`/`ArrowRight`) 핸들러 없음. WAI-ARIA Tabs 패턴 위반.
- [a11y] L115-122: 닫기 버튼이 `<span role="button">`으로 구현 — `<button>` 사용이 시맨틱상 올바름. `tabIndex` 미지정으로 키보드 접근 불가.

### web/src/pages/chat/chat-status-bar.tsx

- [i18n] L95: `t("chat.channel_mismatch_hint")` — locale 파일(ko.json, en.json) 모두에 해당 키 부재. 런타임에 키 문자열 그대로 표시됨.
- [i18n] L96: `t("chat.channel_mismatch")` — locale 파일 모두에 해당 키 부재.
- [i18n] L103-104: `t("chat.session_reuse_hint")`, `t("chat.session_reuse")` — locale 파일 모두에 해당 키 부재.

### web/src/pages/chat/map-embed.tsx

- [i18n] L88: `set_error("지도 렌더링 실패")` — 하드코딩 한국어 문자열. locale key 필요.
- [i18n] L93: `` set_error(`위치를 찾을 수 없습니다: ${data.location}`) `` — 하드코딩 한국어 문자열.
- [i18n] L94: `set_error("지도 로드 실패")` — 하드코딩 한국어 문자열.
- [eslint-disable] L101: `// eslint-disable-next-line react-hooks/exhaustive-deps` — 프로젝트 규칙에서 `eslint-disable` 금지. `raw` 대신 `data` 의존성 구조 재검토 필요.
- [a11y] L110-120: Google Maps iframe fallback에 `allow` 속성 누락. 접근성 대안 텍스트 부족.
- [loading] L52-101: 지도 로딩 중 사용자 피드백 없음 (loading spinner/skeleton 없음). 비동기 geocoding + Leaflet 로드 동안 빈 div만 보임.

### web/src/pages/chat/message-list.tsx

- [i18n] L97: `t("chat.route") || "Route"` — `||` 폴백 패턴은 locale key 부재를 숨김. `chat.route` 키가 ko.json, en.json 모두에 없음.
- [i18n] L100: `t("chat.requested_channel") || "Requested"` — 동일 문제. `chat.requested_channel` 키 부재.
- [i18n] L103: `t("chat.delivered_channel") || "Delivered"` — 동일 문제. `chat.delivered_channel` 키 부재.
- [i18n] L107: `t("chat.channel_mismatch") || "Channel mismatch detected"` — 동일 문제. `chat.channel_mismatch` 키 부재.
- [inline-style] L84-95: `DeliveryTraceDrillDown` 컴포넌트에 inline style 8개 사용. CSS 클래스로 분리 필요 (프로젝트 컨벤션: Tailwind/CSS 클래스 사용).
- [a11y] L89: `style={{ all: "unset" }}` — 버튼의 기본 접근성 스타일(focus ring 등)을 제거. keyboard focus 시각 표시가 사라짐.

### web/src/pages/chat/session-browser.tsx

- [i18n] L75: `<div className="session-browser__group-label">Chat</div>` — 하드코딩 영문 "Chat". locale key 필요.
- [i18n] L107: `>CHAT<` — 하드코딩 배지 텍스트.
- [i18n] L109, L151: `{s.message_count} msg` / `{m.message_count} msg` — 하드코딩 "msg" 단위. `t("chat.msgs_fmt", { count: ... })` 사용 필요. (en.json에 `chat.msgs_fmt` 키 존재함.)
- [i18n] L134: `<div className="session-browser__group-label">Mirror</div>` — 하드코딩 영문 "Mirror". locale key 필요 (`chat.mirror_label` 키가 en.json에 존재).
- [a11y] L55-60: 검색 input에 `aria-label` 없음. `placeholder`만으로는 스크린리더 접근성 부족.
- [DRY] 전체: `commit_rename`/`start_rename`/`renaming_id`/`rename_val` 로직이 `chat-session-tabs.tsx`와 거의 동일하게 중복. 공통 `useInlineRename` 훅으로 추출 후보.

### web/src/pages/workspace/index.tsx

- 특이사항 없음. Suspense fallback으로 skeleton 제공, 탭 바에 `role="tablist"` + `aria-selected` 적용. 양호.

### web/src/pages/workspace/memory.tsx

- [i18n] L207: `<th>Retrieval</th>` — 하드코딩 영문 "Retrieval". locale key 필요.
- [error] L49-51: `useQuery` (daily_list)에 `isError` 미처리. API 실패 시 빈 리스트만 표시되고 에러 안내 없음.
- [error] L54-58: `useQuery` (state)에 `isError` 미처리. 동일 문제.
- [error] L63-69: `useQuery` (content_data)에 `isError` 미처리. loading 처리는 있으나 에러 상태 빠짐.
- [stale] L207: events 테이블의 "Retrieval" 컬럼명이 FE-5 TR(Traceability/Retrieval) 기능의 공식 명칭인지 확인 필요. 다른 곳에서는 `retrieval_source`로 사용.

### web/src/pages/workspace/sessions.tsx

- [error] L48-53: `useQuery` (sessions)에 `isError` 미처리. API 실패 시 빈 배열만 표시되고 에러 안내 없음.
- [error] L55-59: `useQuery` (detail)에 `isError` 미처리. 상세 로드 실패 시 무한 스켈레톤.
- [mobile] L82-178: `SplitPane` 내 좌/우 패널 — 모바일에서 split 비율이나 패널 전환 처리를 `SplitPane` 컴포넌트에 위임하고 있으나, `showRight` prop을 전달하고 있어 의도적일 수 있음. `SplitPane` 구현체에서 반응형 확인 필요.

### web/src/pages/workspace/templates.tsx

- [error] L17: `useQuery` (templates)에 `isError` 미처리. 빈 배열 기본값으로 에러가 무시됨.
- [error] L23-28: `useQuery` (templateData)에 `isError` 미처리. 실패 시 빈 에디터만 표시.
- [a11y] L79-83: textarea에 `aria-label` 없음. 시각적 헤더에 `{selected}.md`가 있으나 `htmlFor`/`id` 연결 없음.

### web/src/pages/workspace/tools.tsx

- [i18n] L66: `{usage_count} calls` — 하드코딩 영문 "calls". locale key 필요.
- [error] L144: `useQuery` (tools)에 `isError` 미처리. 로딩 스켈레톤만 제공, 에러 상태 누락.

### web/src/pages/workspace/ws-shared.tsx

- 특이사항 없음. `WsListItem`에 `role="button"`, `tabIndex={0}`, Enter/Space 키보드 핸들링 완비. `WsDetailHeader`, `WsSkeletonCol` 모두 적절. 양호.

---

## DRY/SOLID 위반 상세

| # | 패턴 | 파일 | 추출 후보 |
|---|------|------|-----------|
| 1 | 인라인 rename (state + commit + input) | `chat-session-tabs.tsx`, `session-browser.tsx` | `useInlineRename(onRename)` 커스텀 훅 |
| 2 | DeliveryTraceDrillDown inline styles | `message-list.tsx` L84-112 | CSS 클래스 `.delivery-trace__*` 분리 |

---

## i18n 누락 키 목록

아래 키들이 코드에서 참조되지만 `src/i18n/locales/ko.json` 및 `en.json` 모두에 없음:

| 키 | 사용 파일 | 현재 처리 |
|----|-----------|-----------|
| `chat.channel_mismatch` | chat-status-bar.tsx:96, message-list.tsx:107 | `\|\|` 폴백 또는 키 문자열 노출 |
| `chat.channel_mismatch_hint` | chat-status-bar.tsx:95 | 키 문자열 노출 |
| `chat.session_reuse` | chat-status-bar.tsx:104 | 키 문자열 노출 |
| `chat.session_reuse_hint` | chat-status-bar.tsx:103 | 키 문자열 노출 |
| `chat.route` | message-list.tsx:97 | `\|\|` 폴백 "Route" |
| `chat.requested_channel` | message-list.tsx:100 | `\|\|` 폴백 "Requested" |
| `chat.delivered_channel` | message-list.tsx:103 | `\|\|` 폴백 "Delivered" |

아래는 locale key가 존재하지만 사용되지 않는 하드코딩 문자열:

| 하드코딩 값 | 파일:라인 | 대체 가능 키 |
|-------------|-----------|-------------|
| `"Chat sessions"` | chat-session-tabs.tsx:83 | `chat.sessions_label` (신규 필요) |
| `"New session"` | chat-session-tabs.tsx:129 | `chat.new_session` (이미 존재) |
| `"Chat"` | session-browser.tsx:75 | `chat.title` (이미 존재) |
| `"CHAT"` | session-browser.tsx:107 | `chat.title` 또는 신규 배지 키 |
| `"Mirror"` | session-browser.tsx:134 | `chat.mirror_label` (이미 존재) |
| `"msg"` | session-browser.tsx:109,151 | `chat.msgs_fmt` (이미 존재) |
| `"Retrieval"` | memory.tsx:207 | 신규 키 필요 |
| `"calls"` | tools.tsx:66 | 신규 키 필요 |
| `"지도 렌더링 실패"` | map-embed.tsx:88 | 신규 키 필요 |
| `"위치를 찾을 수 없습니다"` | map-embed.tsx:93 | 신규 키 필요 |
| `"지도 로드 실패"` | map-embed.tsx:94 | 신규 키 필요 |
