/**
 * SharedPromptBar — Layer 1: UnifiedSelector를 내장한 범용 프롬프트바.
 * UnifiedSelector / EndpointSelector / ToolChips / ToolChoiceToggle / AiSuggestions 조합.
 *
 * 레이아웃:
 *   [greeting]              ← 빈 상태에서만
 *   [AI suggestions 그리드] ← 빈 상태에서만
 *   ┌──────────────────────────────────────────┐
 *   │ [textarea (auto-resize)]                 │
 *   │ [+] [ToolChoice▾] [Tools N] [@] ─── [EP▾] [⏎/■] │
 *   └──────────────────────────────────────────┘
 *   [tool chips]            ← 도구 선택 시
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { useT } from "../../i18n";
import { UnifiedSelector } from "./unified-selector";
import type { UnifiedSelectorItem } from "./unified-selector";
import { EndpointSelector } from "./endpoint-selector";
import type { Endpoint } from "./endpoint-selector";
import { ToolChips } from "./tool-chips";
import type { ToolChip } from "./tool-chips";
import { ToolChoiceToggle } from "./tool-choice-toggle";
import type { ToolChoiceMode } from "./tool-choice-toggle";
import { AiSuggestions } from "./ai-suggestions";

export type { UnifiedSelectorItem, Endpoint, ToolChip, ToolChoiceMode };

export interface SharedPromptBarProps {
  /** 입력 텍스트 */
  input: string;
  onInputChange: (v: string) => void;
  /** 전송 */
  onSend: () => void;
  sending: boolean;
  /** 스트리밍 중 여부 (중단 버튼 표시) */
  streaming?: boolean;
  onStop?: () => void;
  /** 엔드포인트 (모델/에이전트/워크플로우) */
  endpoint: Endpoint | null;
  onEndpointChange: (ep: Endpoint) => void;
  /** 선택된 도구 */
  tools: ToolChip[];
  onToolAdd: (item: UnifiedSelectorItem) => void;
  onToolRemove: (id: string) => void;
  /** 도구 정책 */
  toolChoice: ToolChoiceMode;
  onToolChoiceChange: (mode: ToolChoiceMode) => void;
  /** AI 추천 프롬프트 (빈 상태에서) */
  suggestions?: string[];
  onSuggestionSelect?: (text: string) => void;
  /** 개인화 인사 (빈 상태) */
  greeting?: string;
  /** 비활성화 */
  disabled?: boolean;
  className?: string;
}

export function SharedPromptBar({
  input,
  onInputChange,
  onSend,
  sending,
  streaming = false,
  onStop,
  endpoint,
  onEndpointChange,
  tools,
  onToolAdd,
  onToolRemove,
  toolChoice,
  onToolChoiceChange,
  suggestions = [],
  onSuggestionSelect,
  greeting,
  disabled = false,
  className,
}: SharedPromptBarProps) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const is_busy = sending || streaming;
  const is_empty = input.trim().length === 0;

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  // focus restore when not busy
  const prev_busy = useRef(false);
  useEffect(() => {
    if (prev_busy.current && !is_busy) textareaRef.current?.focus();
    prev_busy.current = is_busy;
  }, [is_busy]);

  const handle_key_down = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!is_busy && input.trim().length > 0) {
        onSend();
      }
      return;
    }
  };

  const handle_input_change = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      onInputChange(val);
      // @ 입력 감지
      if (val.endsWith("@")) {
        setSelectorOpen(true);
      }
    },
    [onInputChange],
  );

  const handle_at_click = () => {
    setSelectorOpen((v) => !v);
  };

  const handle_selector_select = (item: UnifiedSelectorItem) => {
    setSelectorOpen(false);
    onToolAdd(item);
    // @ 제거
    if (input.endsWith("@")) {
      onInputChange(input.slice(0, -1));
    }
    textareaRef.current?.focus();
  };

  const handle_send = () => {
    if (streaming && onStop) {
      onStop();
    } else if (!is_busy && input.trim().length > 0) {
      onSend();
    }
  };

  const handle_suggestion_select = (text: string) => {
    onInputChange(text);
    onSuggestionSelect?.(text);
    textareaRef.current?.focus();
  };

  const show_empty_state = is_empty && !is_busy;

  return (
    <div
      className={[
        "shared-prompt-bar",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        margin: "0 auto",
        maxWidth: "var(--prompt-max-width, 720px)",
      }}
    >
      {/* 빈 상태: greeting */}
      {show_empty_state && greeting && (
        <div className="shared-prompt-bar__greeting">{greeting}</div>
      )}

      {/* 빈 상태: AI 추천 */}
      {show_empty_state && suggestions.length > 0 && onSuggestionSelect && (
        <AiSuggestions
          suggestions={suggestions}
          onSelect={handle_suggestion_select}
          className="shared-prompt-bar__suggestions"
        />
      )}

      {/* UnifiedSelector 팝업 */}
      <UnifiedSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handle_selector_select}
        className="shared-prompt-bar__selector"
      />

      {/* 입력 필 */}
      <div
        className="shared-prompt-bar__pill"
        style={{
          background: "var(--prompt-bg, var(--surface-1))",
          borderRadius: "var(--prompt-radius, 16px)",
          boxShadow: "var(--prompt-shadow, 0 2px 12px rgba(0,0,0,.15))",
        }}
      >
        <textarea
          ref={textareaRef}
          className="shared-prompt-bar__textarea"
          value={input}
          onChange={handle_input_change}
          onKeyDown={handle_key_down}
          placeholder={t("shared_prompt_bar.placeholder")}
          disabled={disabled || is_busy}
          rows={1}
          aria-label={t("shared_prompt_bar.label")}
        />

        {/* 툴바 */}
        <div className="shared-prompt-bar__toolbar">
          {/* 왼쪽 그룹 */}
          <div className="shared-prompt-bar__toolbar-left">
            {/* ToolChoiceToggle */}
            <ToolChoiceToggle
              value={toolChoice}
              onChange={onToolChoiceChange}
              disabled={is_busy || disabled}
            />

            {/* Tools count */}
            {tools.length > 0 && (
              <span
                className="shared-prompt-bar__tool-count"
                aria-label={t("shared_prompt_bar.tools_count", { count: String(tools.length) })}
              >
                {t("shared_prompt_bar.tools_count", { count: String(tools.length) })}
              </span>
            )}

            {/* @ button → UnifiedSelector */}
            <button
              type="button"
              className={[
                "shared-prompt-bar__btn",
                "shared-prompt-bar__btn--at",
                selectorOpen ? "shared-prompt-bar__btn--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={handle_at_click}
              disabled={is_busy || disabled}
              title={t("shared_prompt_bar.at_label")}
              aria-label={t("shared_prompt_bar.at_label")}
              aria-expanded={selectorOpen}
              data-testid="at-button"
            >
              @
            </button>
          </div>

          {/* 오른쪽 그룹 */}
          <div className="shared-prompt-bar__toolbar-right">
            <EndpointSelector
              value={endpoint}
              onChange={onEndpointChange}
              className="shared-prompt-bar__endpoint"
            />

            {/* 전송 / 중단 버튼 */}
            <button
              type="button"
              className={[
                "shared-prompt-bar__btn",
                streaming
                  ? "shared-prompt-bar__btn--stop"
                  : !is_busy && input.trim().length > 0
                    ? "shared-prompt-bar__btn--send"
                    : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={handle_send}
              disabled={!streaming && (is_busy || input.trim().length === 0 || disabled)}
              aria-label={
                streaming
                  ? t("shared_prompt_bar.stop")
                  : t("shared_prompt_bar.send")
              }
              data-testid="send-button"
            >
              {streaming ? (
                <span className="shared-prompt-bar__stop-icon" aria-hidden="true">&#9632;</span>
              ) : (
                <span className="shared-prompt-bar__send-icon" aria-hidden="true">&#x2191;</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 도구 칩 목록 */}
      {tools.length > 0 && (
        <ToolChips
          tools={tools}
          onRemove={onToolRemove}
          className="shared-prompt-bar__tool-chips"
        />
      )}
    </div>
  );
}
