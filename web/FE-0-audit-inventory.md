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

---

## Batch 2: prompting + workflows + channels + providers + oauth + setup + secrets

### 요약 통계 (Batch 2)

| 카테고리 | 건수 |
|----------|------|
| i18n (하드코딩 문자열) | 15 |
| a11y (접근성 누락) | 10 |
| empty/loading/error/retry 상태 누락 | 5 |
| DRY/SOLID 위반 | 3 |
| inline style 남용 | 3 |
| backend binding 불일치 | 1 |
| stale copy / outdated terminology | 1 |
| missing badge/warning | 2 |
| security (dangerouslySetInnerHTML) | 1 |
| mobile viewport | 1 |
| **합계** | **42** |

### 파일별 발견 사항

#### web/src/pages/prompting/index.tsx

- [i18n] L25-31: 탭 라벨 `"Text"`, `"Image"`, `"Video"`, `"Agent"`, `"Gallery"`, `"Compare"`, `"Eval"` 모두 하드코딩 영문 문자열. `t("prompting.tab_text")` 등 locale key 필요.
- [a11y] L45: `aria-label="Prompting Studio"` — 하드코딩 영문. locale key 사용 필요.
- [a11y] L60: `role="tabpanel"`에 `aria-labelledby` 미지정. 활성 탭의 `id`를 참조해야 함. WAI-ARIA Tabs 패턴 불완전.

#### web/src/pages/prompting/gallery-panel.tsx

- [error] L31-35: `useQuery`에 `isError` 미처리. API 실패 시 빈 배열만 표시되고 에러 안내 없음.
- 양호: i18n은 `useT()` + 키 기반으로 완비. EmptyState, SkeletonGrid, DeleteConfirmModal 등 4상태 처리 양호. SearchInput에 `placeholder`가 t() 기반.

#### web/src/pages/prompting/image-panel.tsx

- [i18n] L236: `Elapsed: {elapsed_s}s` — 하드코딩 영문 "Elapsed". locale key 필요.
- [i18n] L238: `Total Cost: $...` — 하드코딩 영문 "Total Cost". locale key 필요.
- [i18n] L262: `"Open"` — 하드코딩 영문 버튼 텍스트. `t("prompting.open")` 또는 `t("common.open")` 필요.
- [i18n] L269: `"Save"` — 하드코딩 영문 버튼 텍스트. `prompting.save` 키가 이미 존재하나 미사용.
- [i18n] L283: `"이미지가 여기에 표시됩니다."` — 하드코딩 한국어 문자열. locale key 필요.
- [i18n] L196: `aria-label="Count"` — 하드코딩 영문. locale key 사용 필요.
- [a11y] L161-166: 프롬프트 textarea에 `aria-label` 없음. `placeholder`만 있으나 접근성 라벨로는 불충분.
- [inline-style] L197: count select에 inline style 6개 사용 (`border`, `borderRadius`, `height`, `padding`, `fontSize`, `fontWeight` 등). CSS 클래스로 분리 필요.
- [inline-style] L229: 에러 영역에 inline style 5개 사용. 에러 표시 패턴을 공통 컴포넌트로 추출 가능.
- [inline-style] L260: `<a>` 태그에 inline style (`color: "#fff"`, `borderColor`). CSS 클래스로 분리 필요.
- [error] L68-69: catch 블록에서 `(err as Error)?.message` — 캐스팅이 불안전. 네트워크 에러 등 비 Error 객체 시 `undefined` 가능.

#### web/src/pages/prompting/text-panel.tsx

- [a11y] L148-154: 프롬프트 textarea에 `aria-label` 없음. `placeholder="{{prompt}}"` 는 접근성 라벨로 부적합.
- [a11y] L193: 변수 입력 textarea에 개별 `aria-label` 없음. 변수명(`v`) 기반 레이블 필요.
- [i18n] L108: `placeholder="default"` — 하드코딩 영문 "default". locale key 필요.
- [inline-style] L184-203: 변수 입력 영역 전체에 inline style 다수 (padding, display, flexDirection, gap, fontSize 등). CSS 클래스 분리 필요.
- 양호: i18n은 대부분 `t()` 기반으로 완비. RunResult 컴포넌트로 결과 표시 분리.

#### web/src/pages/prompting/video-panel.tsx

- [i18n] L43-45: `time_ago()` 함수에서 `"s ago"`, `"m ago"`, `"h ago"` — 하드코딩 영문 시간 단위. locale key 필요 (한국어 "초 전", "분 전", "시간 전").
- [i18n] L279: `"생성 중 오류가 발생했습니다."` — 하드코딩 한국어 문자열. locale key 필요.
- [i18n] L287: `"Video ID: {v.id}"` — 하드코딩 영문 레이블. locale key 필요.
- [i18n] L293: `"Elapsed: ..."` — 하드코딩 영문. locale key 필요.
- [i18n] L295: `"Cost: $..."` — 하드코딩 영문. locale key 필요.
- [a11y] L236: `role="button"` 대신 `<button>` 사용이 시맨틱상 올바름. 현재 `<div>` 내 역할 부여.
- [a11y] L267: `<video>` 태그에 접근성 대안 텍스트 없음 (aria-label 또는 `<track>` 미지정).
- [error] L102-109: 에러 발생 시 catch 블록에서 에러 메시지를 무시하고 `status: "err"`만 설정. 사용자에게 구체적 에러 원인 전달 없음.

#### web/src/pages/workflows/builder.tsx

- [i18n] L41: `title="SVG 다운로드"` — 하드코딩 한국어 tooltip. locale key 필요.
- [i18n] L46: `aria-label="닫기"` — 하드코딩 한국어. `t("workflows.close")` 사용 필요.
- [i18n] L90: `title="Mermaid 소스 보기"` — 하드코딩 한국어 tooltip. locale key 필요.
- [i18n] L93: `title="원본 크기로 보기"` — 하드코딩 한국어 tooltip. locale key 필요.
- [i18n] L789: `"YAML"`, `"Flow"`, `"Seq"` (L789) — YAML 사이드 탭 라벨이 하드코딩. 기술 용어이므로 i18n 우선순위 낮음.
- [security] L50, L105: `dangerouslySetInnerHTML={{ __html: svg }}` — Mermaid SVG를 자체 서버(`/api/workflow/diagram/preview`)에서 가져와 직접 삽입. XSS 취약점: 서버가 악의적 SVG를 반환하거나 MITM 공격 시 위험. DOMPurify 등 sanitization 미적용.
- [a11y] L37: `DiagramFullscreenModal` overlay에 `role="presentation"` 사용. `role="dialog"` + `aria-modal="true"`가 적절.
- [error] L77: Mermaid 다이어그램 렌더 실패 시 에러 메시지가 `"network_error"` 등 영문 키 문자열 그대로 표시. `t()` 미사용.
- [DRY] L56-111: `YamlSideDiagramTab` 내 로딩/에러/렌더 패턴이 `flowchart`와 `sequence` 동일하게 반복. 다이어그램 타입만 다름.
- [backend-binding] L69-74: `fetch("/api/workflow/diagram/preview")` — `api.post()` 대신 raw `fetch` 사용. 인증 헤더, 에러 핸들링, 베이스 URL 일관성이 `api` 클라이언트와 불일치.
- [missing-badge] L752-759: 저장 성공/실패 배지(`saveStatusPulse`)가 2~3초 후 자동 소멸하나, 저장 중 네트워크 타임아웃 시 어떤 피드백도 없이 사라짐.
- 양호: breadcrumb에 `aria-label="Breadcrumb"`, template name input에 `aria-label`, 버튼들에 `aria-busy`/`disabled` 처리, Undo/Redo 키보드 바인딩 완비.

#### web/src/pages/workflows/builder-modals.tsx

- [a11y] L78: `PhaseEditModal` 내 phase_id input에 `autoFocus`는 있으나 모달 진입 시 focus trap 미구현. Tab 키로 모달 밖으로 포커스 이탈 가능.
- [DRY] L190, L319, L389, L484: 모든 모달의 Remove 버튼 라벨이 `t("workflows.remove_phase")`. Remove Trigger, Remove Channel 등 문맥에 맞지 않는 라벨. 각 도메인별 키 필요.
- 양호: 모든 모달이 `role="dialog"`, `aria-modal="true"`, `aria-labelledby` 완비. 닫기 버튼에 `aria-label` 존재. `useModalEffects` 훅으로 ESC 키 처리 통합.

#### web/src/pages/workflows/node-inspector.tsx

- [a11y] L152: `inspector-section-toggle`에 `aria-expanded` 존재. 양호.
- [a11y] L139: inspector 리사이즈 핸들에 접근성 라벨 없음. 키보드로 리사이즈 불가.
- 양호: 전체적으로 i18n 완비 (`t()` 기반). Output 탭의 실행 상태 배지에 시각적 + SVG 아이콘 이중 표시. 패널 열림/닫힘 `aria-expanded` 적용.

#### web/src/pages/channels/instance-modal.tsx

- 양호: `FormModal`, `FormGroup` 공통 컴포넌트 활용, `useT()` 기반 i18n 완비. `aria-required` 적용. `ToggleSwitch`에 `aria-label` 전달. `hasChanges()` 감지로 불필요한 저장 방지. 에러 핸들링 `useAsyncState`로 통합.
- [missing-badge] L127: 토큰 필드에 `required` 속성이 있으나, 편집 모드에서도 기존 토큰 변경 없이 저장 시 빈 문자열 전송됨. placeholder 안내만 있고 validation 분기가 미흡 (서버에서 걸러지겠지만 UX상 경고 없음).

#### web/src/pages/providers/connection-modal.tsx

- 양호: `FormModal`, `FormGroup` 공통 컴포넌트 활용, i18n 완비. `ToggleSwitch`에 `aria-label` 적용. `hasChanges()` 감지. 에러 핸들링 통합.

#### web/src/pages/providers/provider-modal.tsx

- [i18n] L23: `format_price()`에서 `return "Free"` — 하드코딩 영문. locale key 필요.
- [a11y] L248: `className="sr-only"` 라디오 버튼 사용은 올바르나, `chip-label` 그룹에 `role="radiogroup"` + `aria-label` 미지정.
- [error] L72-87: `useQuery` (modelList)에 `isError` 미처리. 모델 목록 로드 실패 시 사용자에게 안내 없이 일반 텍스트 input으로 폴백.
- 양호: 대부분 i18n 완비. `Combobox` 컴포넌트 활용, `hasChanges()` 감지, `registeredTypes` 필터링으로 사용 가능한 프로바이더만 표시.

#### web/src/pages/oauth/oauth-modal.tsx

- 양호: `FormModal`, `FormGroup` 활용, i18n 완비. 스코프 체크박스 + 텍스트 입력 이중 인터페이스. `is_basic_auth` 조건부 필드.
- [a11y] L117: enabled 체크박스가 `<label>` + `<input type="checkbox">` 직접 조합이나, `ToggleSwitch` 일관성 부재. 다른 모달과 UI 패턴 불일치.

#### web/src/pages/oauth/preset-modal.tsx

- 양호: `FormModal`, `FormGroup` 활용, i18n 완비. `hasChanges()` 감지. `useAsyncState` 에러 핸들링.
- [a11y] L119-122: supports_refresh 체크박스가 `<label>` + `<input type="checkbox">` 패턴. `FormGroup` 밖에서 직접 렌더. 다른 FormGroup과 시각적 일관성 미흡.

#### web/src/pages/setup.tsx

- [a11y] L76: step dot에 `aria-label={t("setup.step_n", { n: s + 1 })}` 적용. 양호.
- [a11y] L136-151: `<label>` + `<select>` 연결이 `<label>` 래핑 방식이나, `<label>` 내 `<div className="form-label">` 구조가 접근성 트리에서 불명확. `htmlFor`/`id` 명시 연결 권장.
- [error] L28-32: `useQuery` (providerTypes)에 `isError` 미처리. 프로바이더 타입 로드 실패 시 빈 체크리스트만 표시되고 에러 안내 없음.
- [mobile] L88-114: `setup__provider-list` 내 카드가 flex 기반이나, 모바일에서 카드 너비가 100%로 확장되는지 확인 필요 (CSS 미확인).
- 양호: i18n 완비 (`t()` 기반 전면 적용). 3단계 위저드, 비활성 단계 dot, 완료 후 자동 리디렉트.

#### web/src/pages/secrets.tsx

- 양호: 4상태 (빈 목록, 검색결과 없음, 모바일 카드, 데스크톱 테이블) 완비. i18n 전면 `t()` 적용. `DeleteConfirmModal` 확인 모달. `SectionHeader` 공통 컴포넌트. `useIsMobile` 반응형 대응.
- [error] L31: `useQuery` (secrets)에 `isError` 미처리. API 실패 시 빈 배열만 표시되고 에러 안내 없음.
- [a11y] L107: `DataTable` 내 `<thead>` 헤더에 `scope="col"` 미지정.

---

### Batch 2 DRY/SOLID 위반 상세

| # | 패턴 | 파일 | 추출 후보 |
|---|------|------|-----------|
| 3 | inline style 패턴 (에러 표시, 카운트 select, 변수 입력) | `image-panel.tsx`, `text-panel.tsx` | CSS 클래스 `.ps-error-banner`, `.ps-var-input-area` 분리 |
| 4 | `time_ago()` 함수 (영문 하드코딩 시간) | `video-panel.tsx` L41-46 | 공통 유틸 `format_time_ago(ts, t)` 추출 + i18n 키 |
| 5 | 모달 Remove 버튼 라벨 통일 | `builder-modals.tsx` L190,319,389,484 | 각 모달별 `t("workflows.remove_trigger")`, `t("workflows.remove_channel")` 등 분리 |

---

### Batch 2 i18n 누락 목록

#### 하드코딩 문자열 (locale key 미사용)

| 하드코딩 값 | 파일:라인 | 권장 키 |
|-------------|-----------|---------|
| `"Text"`, `"Image"`, ... (탭 라벨 7개) | prompting/index.tsx:25-31 | `prompting.tab_text`, `prompting.tab_image` 등 |
| `"Prompting Studio"` | prompting/index.tsx:45 | `nav.prompting` (이미 존재) |
| `"Elapsed: ..."` | prompting/image-panel.tsx:236 | `prompting.elapsed` (신규 필요) |
| `"Total Cost: $..."` | prompting/image-panel.tsx:238 | `prompting.total_cost` (신규 필요) |
| `"Open"` | prompting/image-panel.tsx:262 | `common.open` (신규 필요) |
| `"Save"` | prompting/image-panel.tsx:269 | `prompting.save` (이미 존재) |
| `"이미지가 여기에 표시됩니다."` | prompting/image-panel.tsx:283 | `prompting.image_empty` (신규 필요) |
| `"Count"` | prompting/image-panel.tsx:196 | `prompting.count` (신규 필요) |
| `"default"` | prompting/text-panel.tsx:108 | `common.default` (신규 필요) |
| `"s ago"`, `"m ago"`, `"h ago"` | prompting/video-panel.tsx:43-45 | `common.time_seconds_ago`, `common.time_minutes_ago`, `common.time_hours_ago` |
| `"생성 중 오류가 발생했습니다."` | prompting/video-panel.tsx:279 | `prompting.video_error` (신규 필요) |
| `"Video ID: ..."` | prompting/video-panel.tsx:287 | `prompting.video_id` (신규 필요) |
| `"Elapsed: ..."` | prompting/video-panel.tsx:293 | `prompting.elapsed` (공유 가능) |
| `"Cost: $..."` | prompting/video-panel.tsx:295 | `prompting.cost` (신규 필요) |
| `"SVG 다운로드"` | workflows/builder.tsx:41 | `workflows.download_svg` (신규 필요) |
| `"닫기"` | workflows/builder.tsx:46 | `workflows.close` (이미 존재, 미사용) |
| `"Mermaid 소스 보기"` | workflows/builder.tsx:90 | `workflows.view_mermaid_source` (신규 필요) |
| `"원본 크기로 보기"` | workflows/builder.tsx:93 | `workflows.view_fullscreen` (신규 필요) |
| `"Free"` | providers/provider-modal.tsx:23 | `providers.price_free` (신규 필요) |
