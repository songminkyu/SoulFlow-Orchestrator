/**
 * ResultRenderer — 리치 결과 블록 렌더링.
 * text / image / code / table / markdown / html / error 타입별 렌더러 지원.
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ResultType = "text" | "image" | "code" | "table" | "markdown" | "html" | "error";

export interface ResultBlock {
  type: ResultType;
  content: string;
  /** code 블록 언어 힌트 */
  language?: string;
  /** image alt 텍스트 */
  alt?: string;
  /** 캡션 */
  caption?: string;
}

export interface ResultRendererProps {
  blocks: ResultBlock[];
  className?: string;
}

// ── Individual block renderers ──────────────────────────────────────────────

function TextBlock({ block }: { block: ResultBlock }) {
  return (
    <div className="result-renderer__block result-renderer__block--text">
      {block.caption && (
        <span className="result-renderer__caption">{block.caption}</span>
      )}
      <pre className="result-renderer__pre">{block.content}</pre>
    </div>
  );
}

function ImageBlock({ block }: { block: ResultBlock }) {
  const [zoomed, set_zoomed] = useState(false);

  return (
    <div className="result-renderer__block result-renderer__block--image">
      {block.caption && (
        <span className="result-renderer__caption">{block.caption}</span>
      )}
      <div
        className={`result-renderer__image${zoomed ? " result-renderer__image--zoomed" : ""}`}
        onClick={() => set_zoomed((v) => !v)}
        role="button"
        tabIndex={0}
        aria-label={block.alt ?? "image"}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") set_zoomed((v) => !v); }}
      >
        <img src={block.content} alt={block.alt ?? ""} loading="lazy" />
      </div>
    </div>
  );
}

function CodeBlock({ block }: { block: ResultBlock }) {
  return (
    <div className="result-renderer__block result-renderer__block--code">
      {block.language && (
        <span className="result-renderer__code-lang">{block.language}</span>
      )}
      {block.caption && (
        <span className="result-renderer__caption">{block.caption}</span>
      )}
      <div className="result-renderer__code">
        <pre>
          <code className={block.language ? `language-${block.language}` : ""}>
            {block.content}
          </code>
        </pre>
      </div>
    </div>
  );
}

function TableBlock({ block }: { block: ResultBlock }) {
  // Render markdown table via react-markdown with GFM
  return (
    <div className="result-renderer__block result-renderer__block--table">
      {block.caption && (
        <span className="result-renderer__caption">{block.caption}</span>
      )}
      <div className="result-renderer__table">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function MarkdownBlock({ block }: { block: ResultBlock }) {
  return (
    <div className="result-renderer__block result-renderer__block--markdown">
      {block.caption && (
        <span className="result-renderer__caption">{block.caption}</span>
      )}
      <div className="result-renderer__markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {block.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function HtmlBlock({ block }: { block: ResultBlock }) {
  return (
    <div className="result-renderer__block result-renderer__block--html">
      {block.caption && (
        <span className="result-renderer__caption">{block.caption}</span>
      )}
      <div
        className="result-renderer__html"
        // biome-ignore lint: dangerouslySetInnerHTML is intentional for html type blocks
        dangerouslySetInnerHTML={{ __html: block.content }}
      />
    </div>
  );
}

function ErrorBlock({ block }: { block: ResultBlock }) {
  return (
    <div className="result-renderer__block result-renderer__block--error">
      {block.caption && (
        <span className="result-renderer__caption">{block.caption}</span>
      )}
      <pre className="result-renderer__pre result-renderer__pre--error">{block.content}</pre>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

function render_block(block: ResultBlock, idx: number) {
  switch (block.type) {
    case "text":     return <TextBlock key={idx} block={block} />;
    case "image":    return <ImageBlock key={idx} block={block} />;
    case "code":     return <CodeBlock key={idx} block={block} />;
    case "table":    return <TableBlock key={idx} block={block} />;
    case "markdown": return <MarkdownBlock key={idx} block={block} />;
    case "html":     return <HtmlBlock key={idx} block={block} />;
    case "error":    return <ErrorBlock key={idx} block={block} />;
    default:         return <TextBlock key={idx} block={block} />;
  }
}

export function ResultRenderer({ blocks, className }: ResultRendererProps) {
  return (
    <div className={`result-renderer${className ? ` ${className}` : ""}`}>
      {blocks.map((block, idx) => render_block(block, idx))}
    </div>
  );
}
