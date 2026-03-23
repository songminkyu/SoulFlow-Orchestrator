import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useReducer, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api/client";
import { Badge } from "../components/badge";
// DeleteConfirmModal: U3에서 soft-delete + undo toast로 대체됨
import { useToast } from "../components/toast";
import { useAsyncState } from "../hooks/use-async-state";
import { useApprovals } from "../hooks/use-approvals";
import { useNdjsonStream } from "../hooks/use-ndjson-stream";
import { useDashboardStore } from "../store";
import { useT } from "../i18n";
import { SharedPromptBar } from "../components/shared/prompt-bar";
import type { SharedPromptBarProps, UnifiedSelectorItem } from "../components/shared/prompt-bar";
import { MessageList } from "./chat/message-list";
// EmptyState 대신 chat-empty-hub__greeting으로 인라인 표시 (samples/ 레퍼런스)
import { ChatSessionTabs } from "./chat/chat-session-tabs";
import { ChatBottomBar } from "./chat/chat-status-bar";
import { SessionBrowser } from "./chat/session-browser";
import { MemoryPanel } from "../components/shared/memory-panel";
import { compose_agent_prompt } from "./chat/agent-context-bar";
import { CanvasPanel } from "./chat/canvas-panel";
import type { ChatSessionSummary, ChatSession, ChatMessage, ChatMediaItem } from "./chat/types";
import type { AgentDefinition } from "../../../src/agent/agent-definition.types";
import type { MentionItem } from "../components/mention-picker";
import type { ApiChatSessionCreated } from "../api/contracts";

type MirrorSessionEntry = { key: string; provider: string; chat_id: string; alias: string; thread?: string; updated_at: string; message_count: number };
type MirrorSession = { key: string; provider: string; chat_id: string; alias: string; messages: ChatMessage[] };

export default function ChatPage() {
  const t = useT();
  const qc = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();
  /** 에이전트 갤러리 "Use" 진입 시 location.state에서 1회 읽음 */
  const init_def = (location.state as { agent_definition?: AgentDefinition } | null)?.agent_definition ?? null;
  /** URL ?session=ID 파라미터에서 초기 세션 선택 */
  const url_session = useMemo(() => new URLSearchParams(location.search).get("session"), [location.search]);
  const [activeId, setActiveId] = useState<string | null>(url_session);
  const [mirrorKey, setMirrorKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [waiting_response, setWaitingResponse] = useState(false);
  /** U3: soft-delete — pending_delete_id + 타이머로 undo 창 구현 */
  const pending_delete_timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 내부 패널: sessions(세션 브라우저) | memory(메모리 관리) | null(닫힘) */
  const [panel, setPanel] = useState<"sessions" | "memory" | null>(null);
  const sessions_open = panel === "sessions";
  const { pending: creating, run: run_create } = useAsyncState();
  const [pending_media, setPendingMedia] = useState<ChatMediaItem[]>([]);
  const stream_inflight = useRef(false);
  /** 에이전트 정의 (갤러리 진입 시 or @mention 선택) */
  const [activeDefinition, setActiveDefinition] = useState<AgentDefinition | null>(init_def);
  const [systemPromptOverride, setSystemPromptOverride] = useState(() => init_def ? compose_agent_prompt(init_def) : "");
  const [selectedProvider, setSelectedProvider] = useState(init_def?.preferred_providers[0] ?? "");
  const [selectedModel, setSelectedModel] = useState(init_def?.model ?? "");
  /** FE-2b: @mention 첨부 아이템 (에이전트/도구/워크플로우) */
  const [attached_items, setAttachedItems] = useState<MentionItem[]>([]);
  /** FE-2b: 도구 선택 정책 */
  const [tool_choice, setToolChoice] = useState<"auto" | "manual" | "none">("auto");
  /** 기능 토글 (웹 검색, 코드 실행 등) */
  const [capabilities, setCapabilities] = useState<Set<string>>(new Set(["web_search"]));
  const messagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sent_msg_count, setSentMsgCount] = useState(0);
  const web_stream = useDashboardStore((s) => s.web_stream);
  const set_web_stream = useDashboardStore((s) => s.set_web_stream);
  const mirror_event = useDashboardStore((s) => s.mirror_event);
  const canvas_specs = useDashboardStore((s) => s.canvas_specs);
  const dismiss_canvas = useDashboardStore((s) => s.dismiss_canvas);
  const { stream: ndjson_stream, tool_calls: ndjson_tool_calls, thinking_blocks: ndjson_thinking, routing: ndjson_routing, start: start_stream, cancel: cancel_stream } = useNdjsonStream();

  /** 사이드바 세션 클릭 시 URL ?session= 변경 → activeId 동기화 */
  useEffect(() => {
    if (url_session && url_session !== activeId) setActiveId(url_session);
  }, [url_session]); // eslint-disable-line react-hooks/exhaustive-deps

  const is_mirror = !!mirrorKey;

  const { data: sessions = [] } = useQuery<ChatSessionSummary[]>({
    queryKey: ["chat-sessions"],
    queryFn: () => api.get("/api/chat/sessions"),
    staleTime: 10_000,
  });

  const { data: agentDefinitions = [] } = useQuery<AgentDefinition[]>({
    queryKey: ["agent-definitions"],
    queryFn: () => api.get("/api/agent-definitions"),
    staleTime: 60_000,
  });

  const { data: activeSession, isLoading: activeSessionLoading } = useQuery<ChatSession>({
    queryKey: ["chat-session", activeId],
    queryFn: () => api.get<ChatSession>(`/api/chat/sessions/${encodeURIComponent(activeId!)}`),
    enabled: !!activeId && !is_mirror,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });

  const { data: mirror_sessions = [] } = useQuery<MirrorSessionEntry[]>({
    queryKey: ["mirror-sessions"],
    queryFn: () => api.get("/api/chat/mirror"),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: mirrorSession, isLoading: mirrorSessionLoading } = useQuery<MirrorSession>({
    queryKey: ["mirror-session", mirrorKey],
    queryFn: () => api.get<MirrorSession>(`/api/chat/mirror/${encodeURIComponent(mirrorKey!)}`),
    enabled: is_mirror,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  type MirrorAction = { type: "append"; msg: ChatMessage } | { type: "clear" };
  const [mirrorLiveMessages, dispatchMirror] = useReducer(
    (state: ChatMessage[], action: MirrorAction) => action.type === "append" ? [...state, action.msg] : [],
    [],
  );

  useEffect(() => {
    if (!is_mirror || !mirror_event) return;
    if (mirror_event.session_key !== mirrorKey) return;
    dispatchMirror({ type: "append", msg: { direction: mirror_event.direction as "user" | "assistant", content: mirror_event.content, at: mirror_event.at } });
  }, [mirror_event, mirrorKey, is_mirror]);

  const [prevMirrorKey, setPrevMirrorKey] = useState(mirrorKey);
  if (prevMirrorKey !== mirrorKey) { setPrevMirrorKey(mirrorKey); dispatchMirror({ type: "clear" }); }

  const select_mirror = (key: string) => {
    setMirrorKey(key);
    setActiveId(null);
  };

  const select_session = (id: string | null) => {
    setActiveId(id);
    setMirrorKey(null);
  };

  const { pending: pending_approvals, resolve: resolve_approval } = useApprovals({
    related_query_keys: activeId ? [["chat-session", activeId]] : [],
  });

  const scroll_to_bottom = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }));
  };
  useEffect(scroll_to_bottom, [activeId, mirrorKey, sessions_open, activeSession?.messages?.length, mirrorLiveMessages.length]);

  const stream_content_len = (ndjson_stream?.content?.length ?? 0) + (web_stream?.content?.length ?? 0);

  const create_session = () => run_create(async () => {
    const res = await api.post<ApiChatSessionCreated>("/api/chat/sessions");
    setActiveId(res.id);
    void qc.invalidateQueries({ queryKey: ["chat-sessions"] });
  }, t("chat.session_created"), t("chat.create_failed"));

  useEffect(() => {
    if (!init_def) return;
    void (async () => {
      const res = await api.post<ApiChatSessionCreated>("/api/chat/sessions");
      await api.patch(`/api/chat/sessions/${encodeURIComponent(res.id)}`, { name: `${init_def.icon} ${init_def.name}` });
      setActiveId(res.id);
      void qc.invalidateQueries({ queryKey: ["chat-sessions"] });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** U3: soft-delete — 즉시 FE에서 세션 제거 + undo 토스트(5초). 타임아웃 후 실제 API 삭제. */
  const delete_session = (id: string) => {
    if (activeId === id) setActiveId(null);
    // 낙관적 업데이트: 캐시에서 즉시 제거
    qc.setQueryData<ChatSessionSummary[]>(["chat-sessions"], (prev) => prev?.filter((s) => s.id !== id) ?? []);
    // undo 창 동안 이전 타이머 취소
    if (pending_delete_timer.current) clearTimeout(pending_delete_timer.current);
    toast(t("chat.session_deleted"), "info", {
      label: t("common.undo"),
      onClick: () => {
        if (pending_delete_timer.current) { clearTimeout(pending_delete_timer.current); pending_delete_timer.current = null; }
        void qc.invalidateQueries({ queryKey: ["chat-sessions"] }); // 복구
      },
    });
    pending_delete_timer.current = setTimeout(() => {
      pending_delete_timer.current = null;
      api.del(`/api/chat/sessions/${encodeURIComponent(id)}`).then(
        () => void qc.invalidateQueries({ queryKey: ["chat-sessions"] }),
        () => { toast(t("chat.delete_failed"), "err"); void qc.invalidateQueries({ queryKey: ["chat-sessions"] }); },
      );
    }, 5000);
  };

  const rename_session = async (id: string, name: string) => {
    await api.patch(`/api/chat/sessions/${encodeURIComponent(id)}`, { name });
    void qc.invalidateQueries({ queryKey: ["chat-sessions"] });
  };

  const MAX_FILE_SIZE = 7 * 1024 * 1024; // 7MB (base64 인코딩 후 ~10MB)

  const handle_file = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast(t("chat.file_too_large", { name: file.name, max: "7MB" }), "err");
        continue;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        if (!url) return;
        const type = file.type.startsWith("image/") ? "image" : "file";
        setPendingMedia((prev) => [...prev, { type, url, mime: file.type, name: file.name, size: file.size }]);
      };
      reader.onerror = () => toast(t("chat.file_read_failed"), "err");
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  /** FE-2b: attached_items에서 pinned_tools 배열 추출 (tool/workflow 타입만) */
  const pinned_tools_from_items = (items: MentionItem[]): string[] =>
    items.filter((i) => i.type === "tool" || i.type === "workflow").map((i) => i.id);

  /** FE-2b: @mention 선택 시 에이전트면 activeDefinition 설정, 도구/워크플로우면 attached_items에 추가 */
  const handle_mention_select = (item: MentionItem) => {
    if (item.type === "agent") {
      const def = agentDefinitions.find((d) => d.id === item.id) ?? null;
      setActiveDefinition(def);
      if (def) {
        setSystemPromptOverride(compose_agent_prompt(def));
        setSelectedProvider(def.preferred_providers[0] ?? "");
        setSelectedModel(def.model ?? "");
      }
    } else {
      setAttachedItems((prev) => prev.some((i) => i.id === item.id) ? prev : [...prev, item]);
    }
  };

  const handle_mention_remove = (id: string) => {
    setAttachedItems((prev) => prev.filter((i) => i.id !== id));
  };

  /** UnifiedSelectorItem → MentionItem 변환 후 handle_mention_select 위임 */
  const handle_tool_add = (item: UnifiedSelectorItem) => {
    const mention_type: MentionItem["type"] =
      item.type === "mcp-tool" || item.type === "app-tool" ? "tool" :
      item.type === "workflow" ? "workflow" :
      "agent";
    handle_mention_select({
      type: mention_type,
      id: item.id,
      name: item.name,
      description: item.description,
    });
  };

  /** endpoint 변경 시 model + agent 동기화 */
  const handle_endpoint_change = (ep: { type: string; id: string; label: string }) => {
    setSelectedModel(ep.id);
    if (ep.type === "agent") {
      const def = agentDefinitions.find((d) => d.id === ep.id) ?? null;
      if (def) {
        setActiveDefinition(def);
        setSystemPromptOverride(compose_agent_prompt(def));
        setSelectedProvider(def.preferred_providers[0] ?? "");
      }
    }
  };

  const send = async () => {
    if ((!input.trim() && pending_media.length === 0) || sending || stream_inflight.current) return;

    // 세션이 없으면 자동 생성 후 전송
    let target_id = activeId;
    if (!target_id) {
      try {
        const res = await api.post<ApiChatSessionCreated>("/api/chat/sessions");
        target_id = res.id;
        setActiveId(res.id);
        void qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      } catch {
        toast(t("chat.create_failed"), "err");
        return;
      }
    }

    stream_inflight.current = true;
    const trimmed = input.trim();

    // 옵티미스틱 업데이트: 사용자 메시지를 즉시 캐시에 추가
    if (trimmed) {
      qc.setQueryData<ChatSession>(["chat-session", target_id], (prev) => {
        if (!prev) return prev;
        const optimistic_msg: ChatMessage = { direction: "user", content: trimmed, at: new Date().toISOString() };
        return { ...prev, messages: [...(prev.messages ?? []), optimistic_msg] };
      });
    }

    setSentMsgCount((raw_messages?.length ?? 0) + 1);
    setSending(true);
    setWaitingResponse(true);
    const body: Record<string, unknown> = { content: trimmed };
    if (pending_media.length > 0) body.media = pending_media;
    if (selectedProvider) body.provider_instance_id = selectedProvider;
    if (selectedModel) body.model = selectedModel;
    if (systemPromptOverride.trim()) body.system_prompt = systemPromptOverride.trim();
    // FE-2b: 도구 정책 + 고정 도구 전달
    if (tool_choice !== "auto") body.tool_choice = tool_choice;
    const pinned = pinned_tools_from_items(attached_items);
    if (pinned.length > 0) body.pinned_tools = pinned;
    if (capabilities.size > 0) body.enabled_capabilities = [...capabilities];
    setInput("");
    setPendingMedia([]);
    setSending(false);
    start_stream(target_id, body).then(
      () => {
        stream_inflight.current = false;
        // 스트림 완료 → web_message SSE 이벤트가 chat-session을 invalidate하므로
        // 여기서 즉시 invalidate하지 않음 (BE 저장 전에 가져오면 메시지 소실)
        // SSE 미수신 대비 fallback: 1초 후 1회 refetch
        setTimeout(() => void qc.invalidateQueries({ queryKey: ["chat-session", target_id] }), 1000);
      },
      () => { stream_inflight.current = false; toast(t("chat.send_failed"), "err"); setWaitingResponse(false); },
    );
  };

  const send_mirror = async () => {
    if (!mirrorKey || !input.trim() || sending) return;
    setSentMsgCount(raw_messages.length);
    setSending(true);
    setWaitingResponse(true);
    try {
      await api.post(`/api/chat/mirror/${encodeURIComponent(mirrorKey)}/messages`, { content: input.trim() });
      setInput("");
    } catch {
      toast(t("chat.send_failed"), "err");
      setWaitingResponse(false);
    } finally {
      setSending(false);
    }
  };

  const raw_messages = is_mirror
    ? [...(mirrorSession?.messages ?? []), ...mirrorLiveMessages]
    : activeSession?.messages ?? [];

  const active_stream = !is_mirror
    ? (ndjson_stream?.chat_id === activeId ? ndjson_stream : (web_stream?.chat_id === activeId ? web_stream : null))
    : null;
  const stream_active = !!active_stream;
  const is_streaming = stream_active && !active_stream!.done;

  const new_assistant_arrived =
    raw_messages.length > sent_msg_count &&
    raw_messages[raw_messages.length - 1]?.direction === "assistant";
  // 스트림 done 또는 어시스턴트 메시지 도착 시 대기 상태 해제
  // stream_active && done (= 스트림 완료): BE 저장 전이라도 FE는 입력 가능해야 함
  const stream_done = stream_active && active_stream?.done;
  if (waiting_response && (is_streaming || new_assistant_arrived || stream_done)) {
    setWaitingResponse(false);
  }

  useEffect(() => {
    const el = messagesRef.current;
    if (!el || !is_streaming) return;
    const near_bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (near_bottom) requestAnimationFrame(() => { if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight; });
  }, [stream_content_len, is_streaming]);

  useEffect(() => {
    const last = activeSession?.messages[activeSession.messages.length - 1];
    if (!last || last.direction !== "assistant") return;
    if (ndjson_stream?.done && ndjson_stream.chat_id === activeId) cancel_stream();
    if (web_stream?.done && web_stream.chat_id === activeId) set_web_stream(null);
  }, [activeSession?.messages, ndjson_stream, web_stream, activeId, cancel_stream, set_web_stream]);

  /** 스트리밍 시작 시간 — 안정적 timestamp로 불필요한 리렌더 방지 */
  const stream_start_ref = useRef<string>("");
  if (stream_active && !stream_start_ref.current) stream_start_ref.current = new Date().toISOString();
  if (!stream_active) stream_start_ref.current = "";

  const messages = useMemo(() => {
    if (!stream_active || !active_stream) return raw_messages;
    const virtual_msg: ChatMessage = {
      direction: "assistant",
      content: active_stream.content,
      at: stream_start_ref.current,
      ...(ndjson_routing?.requested_channel ? { requested_channel: ndjson_routing.requested_channel } : {}),
      ...(ndjson_routing?.delivered_channel ? { delivered_channel: ndjson_routing.delivered_channel } : {}),
      ...(ndjson_routing?.execution_route ? { execution_route: ndjson_routing.execution_route } : {}),
    };
    return [...raw_messages, virtual_msg];
  }, [raw_messages, stream_active, active_stream?.content, ndjson_routing]);

  const last_msg = messages.length > 0 ? messages[messages.length - 1] : null;
  const last_is_user = last_msg?.direction === "user";
  const has_active = !!activeId || is_mirror;
  const is_busy = sending || waiting_response || is_streaming;

  const session_label = is_mirror
    ? (mirror_sessions.find((m) => m.key === mirrorKey)?.alias || t("session_browser.mirror_group"))
    : t("session_browser.chat_group");

  const cancel_active = () => {
    cancel_stream();
    if (web_stream?.chat_id === activeId) set_web_stream(null);
  };

  const select_and_close = (id: string) => { select_session(id); setPanel(null); };
  const mirror_and_close = (key: string) => { select_mirror(key); setPanel(null); };

  /** SharedPromptBar props — mirror 모드에서는 간소화 */
  const endpoint_value = selectedModel
    ? { type: "model" as const, id: selectedModel, label: selectedModel }
    : null;

  const prompt_bar_tools = useMemo(() =>
    attached_items
      .filter((i) => i.type === "tool" || i.type === "workflow")
      .map((i) => ({ id: i.id, name: i.name, description: i.description })),
    [attached_items],
  );

  // Mirror mode: simple send (no tools, no endpoint change)
  const mirror_send_handler = () => { void send_mirror(); };
  const normal_send_handler = () => { void send(); };

  const handle_capability_change = useCallback((id: string, on: boolean) => {
    setCapabilities((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const promptBarProps: SharedPromptBarProps = is_mirror ? {
    input,
    onInputChange: setInput,
    onSend: mirror_send_handler,
    sending: is_busy,
    streaming: false,
    endpoint: null,
    onEndpointChange: () => {},
    tools: [],
    onToolAdd: () => {},
    onToolRemove: () => {},
    toolChoice: "auto",
    onToolChoiceChange: () => {},
    capabilities: new Set(),
    onCapabilityChange: () => {},
    onAttach: undefined,
    disabled: !mirrorKey,
  } : {
    input,
    onInputChange: setInput,
    onSend: normal_send_handler,
    sending: is_busy,
    streaming: is_streaming,
    onStop: cancel_active,
    endpoint: endpoint_value,
    onEndpointChange: handle_endpoint_change,
    tools: prompt_bar_tools,
    onToolAdd: handle_tool_add,
    onToolRemove: handle_mention_remove,
    toolChoice: tool_choice,
    onToolChoiceChange: setToolChoice,
    capabilities,
    onCapabilityChange: handle_capability_change,
    onAttach: () => fileInputRef.current?.click(),
    suggestions: undefined,
    onSuggestionSelect: undefined,
    greeting: undefined,
  };

  return (
    <div className="chat-page">
      {/* 세션 탭바 — 빈 상태에서 숨김 (samples/ 레퍼런스) */}
      <div className="chat-header">
          <div className="chat-header__panel-toggles">
            <button
              className={`chat-header__burger${panel === "sessions" ? " chat-header__burger--open" : ""}`}
              onClick={() => setPanel(panel === "sessions" ? null : "sessions")}
              aria-label={t("chat.session_browser_title")}
              title={t("chat.session_browser_title")}
            >
              {panel === "sessions" ? "\u2715" : "\u2261"}
            </button>
            <button
              className={`chat-header__panel-btn${panel === "memory" ? " chat-header__panel-btn--active" : ""}`}
              onClick={() => setPanel(panel === "memory" ? null : "memory")}
              aria-label={t("memory_panel.title")}
              title={t("memory_panel.title")}
            >
              {panel === "memory" ? "\u2715" : "\uD83E\uDDE0"}
            </button>
          </div>
          {!panel && (
            <ChatSessionTabs
              sessions={sessions}
              activeId={is_mirror ? null : activeId}
              creating={creating}
              onSelect={select_and_close}
              onClose={(id) => delete_session(id)}
              onNew={() => void create_session()}
              onRename={(id, name) => void rename_session(id, name)}
            />
          )}
          {panel && (
            <span className="chat-header__panel-label">
              {panel === "sessions" ? t("chat.session_browser_title") : t("memory_panel.title")}
            </span>
          )}
          {is_mirror && <Badge status={t("chat.mirror_badge")} variant="info" />}
          {activeDefinition && !is_mirror && (
            <Badge status={`${activeDefinition.icon} ${activeDefinition.name}`} variant="ok" />
          )}
          {pending_approvals.length > 0 && (
            <Badge status={`\uD83D\uDD10 ${pending_approvals.length}`} variant="warn" />
          )}
        </div>

      {panel === "sessions" ? (
        <SessionBrowser
          sessions={sessions}
          mirror_sessions={mirror_sessions}
          active_id={activeId}
          mirror_key={mirrorKey}
          creating={creating}
          onSelectSession={select_and_close}
          onSelectMirror={mirror_and_close}
          onNew={() => void create_session()}
          onRename={(id, name) => void rename_session(id, name)}
          onDelete={(id) => delete_session(id)}
        />
      ) : panel === "memory" ? (
        <MemoryPanel sessionId={activeId ?? undefined} mode="inline" className="chat-memory-panel" />
      ) : !has_active ? (
        <div className="chat-empty-hub">
          <div className="chat-empty-hub__center">
            <h2 className="chat-empty-hub__greeting">{t("chat.greeting")}</h2>
            <SharedPromptBar
              {...promptBarProps}
              className="chat-empty-hub__prompt-bar"
            />
          </div>
        </div>
      ) : (activeSessionLoading || mirrorSessionLoading) ? (
        <div className="chat-loading">
          <div className="spinner" aria-label={t("chat.loading")}></div>
          <p>{t("chat.loading")}</p>
        </div>
      ) : (
        <>
          {is_mirror && <div className="chat-mirror-hint">{t("chat.mirror_relay_hint")}</div>}
          <MessageList
            ref={messagesRef}
            messages={messages}
            sending={is_busy}
            last_is_user={last_is_user}
            is_streaming={is_streaming}
            tool_calls={is_streaming && ndjson_stream?.chat_id === activeId ? ndjson_tool_calls : []}
            thinking_blocks={is_streaming && ndjson_stream?.chat_id === activeId ? ndjson_thinking : []}
            pending_approvals={is_mirror ? [] : pending_approvals}
            onResolveApproval={(id, text) => void resolve_approval(id, text)}
          />
          {/* U1: 스트림 에러 시 부분 콘텐츠 아래 에러 배너 표시 */}
          {active_stream?.error && (
            <div className="chat-stream-error" role="alert">
              {t("chat.stream_error")}: {active_stream.error}
            </div>
          )}
          {!is_mirror && activeId && (canvas_specs.get(activeId)?.length ?? 0) > 0 && (
            <CanvasPanel
              specs={canvas_specs.get(activeId)!}
              onAction={(action_id, data) => {
                void api.post(`/api/chat/sessions/${encodeURIComponent(activeId)}/canvas-action`, { action_id, data });
              }}
              onDismiss={(canvas_id) => dismiss_canvas(activeId, canvas_id)}
            />
          )}
          {/* 하단 독 */}
          <div className="chat-bottom-dock">
            <ChatBottomBar
              session_label={session_label}
              is_busy={is_busy}
              is_streaming={is_streaming}
              active_session_id={is_mirror ? mirrorKey : activeId}
              requested_channel={ndjson_routing?.requested_channel}
              delivered_channel={ndjson_routing?.delivered_channel}
              session_reuse={ndjson_routing?.session_reuse}
              execution_route={ndjson_routing?.execution_route}
              onStop={cancel_active}
            />
            <SharedPromptBar {...promptBarProps} />
          </div>
          {!is_mirror && (
            <input
              type="file"
              ref={fileInputRef}
              onChange={handle_file}
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json"
              hidden
            />
          )}
        </>
      )}
      {/* U3: DeleteConfirmModal 제거 — soft-delete + undo toast로 대체 */}
    </div>
  );
}
