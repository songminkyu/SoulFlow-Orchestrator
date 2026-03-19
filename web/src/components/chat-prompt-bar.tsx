/**
 * ChatPromptBar — 통합 프롬프트바 (FE-2b 리디자인).
 *
 * 레이아웃:
 *   [AttachedToolChips — 입력 바 위]
 *   [텍스트 입력 영역 (auto-resize)]
 *   하단 버튼 바: [+] [ToolChoice] [Tools N] [@] ─── [모델] [전송]
 *
 * FE-2a 컴포넌트 통합:
 *   - MentionPicker: @ 입력 시 팝업
 *   - ModelSelectorDropdown: 모델 선택
 *   - ToolChoiceToggle: 도구 정책 드롭다운
 *   - AttachedToolChips: 첨부 도구 칩 표시
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { useT } from "../i18n";
import { MentionPicker, type MentionItem } from "./mention-picker";
import { ModelSelectorDropdown } from "./model-selector-dropdown";
import { ToolChoiceToggle } from "./tool-choice-toggle";
import { AttachedToolChips } from "./attached-tool-chips";
import { ToolFeatureMenu } from "./tool-feature-menu";
import { MediaPreviewBar } from "../pages/chat/media-preview";
import type { ChatMediaItem } from "../pages/chat/types";
import type { ToolChoiceMode } from "../../../src/contracts";

export interface ChatPromptBarProps {
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  /** AI 응답 스트리밍 중 여부 */
  is_streaming?: boolean;
  can_send: boolean;
  onSend: () => void;
  placeholder?: string;
  /** 이전 전송 메시지 히스토리 (오래된 순). */
  history?: string[];

  /** 파일 첨부 지원 */
  pending_media?: ChatMediaItem[];
  onAttach?: () => void;
  onRemoveMedia?: (idx: number) => void;

  /** 모델 선택 (ModelSelectorDropdown) */
  selectedModel?: string;
  onModelChange?: (model: string) => void;

  /** @mention 첨부 아이템 (에이전트/도구/워크플로우) */
  attached_items?: MentionItem[];
  onMentionSelect?: (item: MentionItem) => void;
  onMentionRemove?: (id: string) => void;

  /** 에이전트 목록 (MentionPicker 주입) */
  agent_mentions?: MentionItem[];

  /** 도구 선택 정책 */
  tool_choice?: ToolChoiceMode;
  onToolChoiceChange?: (mode: ToolChoiceMode) => void;

  className?: string;
}

export function ChatPromptBar(props: ChatPromptBarProps) {
  const t = useT();
  const is_busy = props.sending || !!props.is_streaming;
  const textarea_ref = useRef<HTMLTextAreaElement>(null);
  const pill_ref = useRef<HTMLDivElement>(null);

  const [mention_open, setMentionOpen] = useState(false);
  const [tool_choice_open, setToolChoiceOpen] = useState(false);
  const [feature_menu_open, setFeatureMenuOpen] = useState(false);

  const has_model_selector = !!props.onModelChange;
  const has_mention = !!props.onMentionSelect;
  const has_tool_choice = !!props.onToolChoiceChange;
  const attached_count = props.attached_items?.length ?? 0;

  const trigger_send_pulse = useCallback(() => {
    const el = pill_ref.current;
    if (!el) return;
    el.classList.remove("chat-prompt-bar__pill--sending");
    void el.offsetWidth;
    el.classList.add("chat-prompt-bar__pill--sending");
    el.addEventListener("animationend", () => el.classList.remove("chat-prompt-bar__pill--sending"), { once: true });
  }, []);

  // 자동 높이 조절
  useEffect(() => {
    const el = textarea_ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [props.input]);

  // is_busy 해제 시 포커스 복원
  const prev_busy = useRef(false);
  useEffect(() => {
    if (prev_busy.current && !is_busy) textarea_ref.current?.focus();
    prev_busy.current = is_busy;
  }, [is_busy]);

  /** 히스토리 탐색 상태 */
  const history_cursor = useRef(-1);
  const history_draft = useRef("");
  const history = props.history ?? [];

  const handle_key_down = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (props.can_send) {
        history_cursor.current = -1;
        props.onSend();
      }
      return;
    }

    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && history.length > 0) {
      const el = e.currentTarget;
      const at_start = el.selectionStart === 0 && el.selectionEnd === 0;
      const at_end = el.selectionStart === el.value.length;

      if (e.key === "ArrowUp" && at_start) {
        e.preventDefault();
        if (history_cursor.current === -1) history_draft.current = props.input;
        const next = Math.min(history_cursor.current + 1, history.length - 1);
        history_cursor.current = next;
        props.setInput(history[history.length - 1 - next]!);
        return;
      }

      if (e.key === "ArrowDown" && at_end && history_cursor.current >= 0) {
        e.preventDefault();
        const next = history_cursor.current - 1;
        history_cursor.current = next;
        props.setInput(next === -1 ? history_draft.current : history[history.length - 1 - next]!);
        return;
      }
    }
  };

  const handle_input_change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    history_cursor.current = -1;
    const val = e.target.value;
    props.setInput(val);

    // @ 입력 감지 — 마지막 문자가 @ 이면 MentionPicker 열기
    if (has_mention && val.endsWith("@")) {
      setMentionOpen(true);
    }
  };

  const handle_mention_select = (item: MentionItem) => {
    setMentionOpen(false);
    props.onMentionSelect?.(item);
    // @ 제거 — 입력 끝에 @ 가 있으면 삭제
    if (props.input.endsWith("@")) {
      props.setInput(props.input.slice(0, -1));
    }
    textarea_ref.current?.focus();
  };

  const handle_at_click = () => {
    if (has_mention) {
      setMentionOpen((v) => !v);
    }
  };

  return (
    <div className={`chat-prompt-bar${props.className ? ` ${props.className}` : ""}`}>
      {/* 첨부 도구 칩 — 입력 바 위 */}
      {has_mention && (
        <AttachedToolChips
          items={props.attached_items ?? []}
          onRemove={props.onMentionRemove ?? (() => {})}
        />
      )}

      {/* 미디어 미리보기 */}
      {(props.pending_media?.length ?? 0) > 0 && props.onRemoveMedia && (
        <MediaPreviewBar items={props.pending_media!} onRemove={props.onRemoveMedia} />
      )}

      <div ref={pill_ref} className="chat-prompt-bar__pill">
        {/* 텍스트 입력 영역 */}
        <textarea
          ref={textarea_ref}
          autoFocus
          className="chat-prompt-bar__textarea"
          value={props.input}
          onChange={handle_input_change}
          onKeyDown={handle_key_down}
          placeholder={props.placeholder ?? t("chat.placeholder")}
          disabled={is_busy}
          rows={1}
        />

        {/* 하단 버튼 바 */}
        <div className="chat-prompt-bar__toolbar">
          {/* 왼쪽 그룹: [+] [ToolChoice] [Tools N] [@] */}
          <div className="chat-prompt-bar__toolbar-left">
            {(props.onAttach || has_mention) && (
              <div className="chat-prompt-bar__feature-menu-wrap">
                <button
                  className={`chat-prompt-bar__btn${feature_menu_open ? " chat-prompt-bar__btn--active" : ""}`}
                  onClick={() => setFeatureMenuOpen((v) => !v)}
                  disabled={is_busy}
                  title={t("chat.attach_file")}
                  aria-label={t("chat.attach_file")}
                >
                  +
                </button>
                <ToolFeatureMenu
                  open={feature_menu_open}
                  onClose={() => setFeatureMenuOpen(false)}
                  onAttach={props.onAttach}
                  attached_items={props.attached_items}
                  onMentionSelect={props.onMentionSelect}
                  onMentionRemove={props.onMentionRemove}
                />
              </div>
            )}

            {has_tool_choice && (
              <div className="chat-prompt-bar__tool-choice-wrap">
                <button
                  className={`chat-prompt-bar__btn${tool_choice_open ? " chat-prompt-bar__btn--active" : ""}`}
                  onClick={() => setToolChoiceOpen((v) => !v)}
                  disabled={is_busy}
                  title={t("chat.attach_tools")}
                  aria-label={t("chat.attach_tools")}
                  type="button"
                >
                  {t(`tool_choice.${props.tool_choice ?? "auto"}`)} &#9662;
                </button>
                {tool_choice_open && (
                  <div className="chat-prompt-bar__tool-choice-popup">
                    <ToolChoiceToggle
                      value={props.tool_choice ?? "auto"}
                      onChange={(mode) => {
                        props.onToolChoiceChange?.(mode);
                        setToolChoiceOpen(false);
                      }}
                      disabled={is_busy}
                    />
                  </div>
                )}
              </div>
            )}

            {has_mention && attached_count > 0 && (
              <span className="chat-prompt-bar__tool-count" aria-label={t("chat.tool_count", { count: String(attached_count) })}>
                {t("chat.tool_count", { count: String(attached_count) })}
              </span>
            )}

            {has_mention && (
              <button
                className={`chat-prompt-bar__btn chat-prompt-bar__btn--mention${mention_open ? " chat-prompt-bar__btn--active" : ""}`}
                onClick={handle_at_click}
                disabled={is_busy}
                title={t("chat.mention_trigger")}
                aria-label={t("chat.mention_trigger")}
                type="button"
              >
                @
              </button>
            )}
          </div>

          {/* 오른쪽 그룹: [모델] [전송] */}
          <div className="chat-prompt-bar__toolbar-right">
            {has_model_selector && (
              <ModelSelectorDropdown
                value={props.selectedModel ?? ""}
                onSelect={props.onModelChange!}
                className="chat-prompt-bar__model-selector"
              />
            )}

            <button
              className={`chat-prompt-bar__btn${is_busy ? " chat-prompt-bar__btn--loading" : props.can_send ? " chat-prompt-bar__btn--send" : ""}`}
              onClick={is_busy ? undefined : () => { trigger_send_pulse(); props.onSend(); }}
              disabled={is_busy || !props.can_send}
              aria-label={is_busy ? t("chat.sending") : t("chat.send")}
              aria-busy={is_busy}
            >
              {is_busy ? (
                <>
                  <span className="chat-send-dot" />
                  <span className="chat-send-dot" />
                  <span className="chat-send-dot" />
                </>
              ) : "\u2191"}
            </button>
          </div>
        </div>
      </div>

      {/* MentionPicker 팝업 */}
      {has_mention && (
        <MentionPicker
          open={mention_open}
          onClose={() => setMentionOpen(false)}
          onSelect={handle_mention_select}
          agents={props.agent_mentions}
        />
      )}

      {!mention_open && !tool_choice_open && (
        <div className="chat-prompt-bar__hint text-xs text-muted">
          Enter {t("chat.send_hint")} &middot; Shift+Enter {t("chat.newline_hint")}
        </div>
      )}
    </div>
  );
}
