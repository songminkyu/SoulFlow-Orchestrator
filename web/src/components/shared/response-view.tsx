/**
 * ResponseView — SharedResponseView 컨테이너.
 * user / assistant 메시지를 포함, streaming / rich-result / tool-calls / links를 조합 렌더링.
 */

import { TypingRenderer } from "./typing-renderer";
import { ResultRenderer } from "./result-renderer";
import { ToolCallBlock } from "./tool-call-block";
import { LinkPreview } from "./link-preview";
import type { ResultBlock } from "./result-renderer";
import type { ToolCallBlockProps } from "./tool-call-block";
import type { LinkPreviewProps } from "./link-preview";

export type { ResultBlock, ToolCallBlockProps, LinkPreviewProps };

export interface ResponseMessage {
  role: "user" | "assistant";
  content: string;
  blocks?: ResultBlock[];
  tool_calls?: ToolCallBlockProps[];
  links?: LinkPreviewProps[];
  streaming?: boolean;
  model?: string;
  timestamp?: string;
}

export interface ResponseViewProps {
  message: ResponseMessage;
  className?: string;
}

export function ResponseView({ message, className }: ResponseViewProps) {
  const { role, content, blocks, tool_calls, links, streaming } = message;
  const is_assistant = role === "assistant";

  return (
    <div
      className={[
        "response-view",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Message bubble */}
      <div
        className={[
          "response-view__message",
          is_assistant
            ? "response-view__message--assistant"
            : "response-view__message--user",
        ].join(" ")}
      >
        {/* Content area */}
        {is_assistant && streaming ? (
          // Streaming: typed animation
          <TypingRenderer
            text={content}
            streaming={true}
            className="response-view__typing"
          />
        ) : is_assistant && blocks && blocks.length > 0 ? (
          // Assistant complete: rich blocks
          <ResultRenderer blocks={blocks} className="response-view__result" />
        ) : (
          // User message or plain assistant text
          <div className="response-view__text">{content}</div>
        )}

        {/* Metadata row */}
        {(message.model || message.timestamp) && (
          <div className="response-view__meta">
            {message.model && (
              <span className="response-view__model">{message.model}</span>
            )}
            {message.timestamp && (
              <span className="response-view__timestamp">{message.timestamp}</span>
            )}
          </div>
        )}
      </div>

      {/* Tool calls below message */}
      {tool_calls && tool_calls.length > 0 && (
        <div className="response-view__tool-calls">
          {tool_calls.map((tc, i) => (
            <ToolCallBlock key={i} {...tc} />
          ))}
        </div>
      )}

      {/* Link previews */}
      {links && links.length > 0 && (
        <div className="response-view__links">
          {links.map((lp, i) => (
            <LinkPreview key={i} {...lp} />
          ))}
        </div>
      )}
    </div>
  );
}
