import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import type { Pluggable } from "unified";
import "highlight.js/styles/github-dark.min.css";
import { MapBlock } from "./map-embed.js";

/** highlight.js + KaTeX가 추가하는 클래스명/인라인 스타일을 sanitize에서 허용 */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className", "style"],
    div:  [...(defaultSchema.attributes?.div  ?? []), "className", "style"],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "del", "input",
  ],
};

/** AI 모델이 생성하는 LaTeX 수식 구분자를 remark-math 호환 $$...$$ 형식으로 변환 */
const DISPLAY_MATH_RE = /\\\[([\s\S]*?)\\\]/g;          // 표준: \[...\]
const INLINE_MATH_RE = /\\\(([\s\S]*?)\\\)/g;           // 표준: \(...\)
/** AI 비표준 형식: 줄 전체가 [ ... ] 이고 \command 포함 */
const AI_DISPLAY_MATH_RE = /^\[ (.*?\\[a-zA-Z].*?) \]$/gm;

function preprocess_latex(content: string): string {
  // replace()에서 $$$$이 리터럴 $$, $1이 캡처그룹
  return content
    .replace(DISPLAY_MATH_RE, "\n$$$$\n$1\n$$$$\n")     // \[...\] → $$...$$
    .replace(INLINE_MATH_RE, "$$$1$$")                   // \(...\) → $...$
    .replace(AI_DISPLAY_MATH_RE, "\n$$$$\n$1\n$$$$\n"); // [ ... ] → $$...$$
}

const SAFE_URL_RE = /^https?:\/\//i;

/** pre > code.language-map 구조를 감지해 Leaflet 지도로 렌더링.
 *  code 컴포넌트 대신 pre를 오버라이드 — div가 pre 안에 중첩되는 HTML 구조 오류 방지. */
function MapPre({ children, ...rest }: React.HTMLAttributes<HTMLPreElement>) {
  // children 중 code.language-map 요소 탐색
  const kids = React.Children.toArray(children);
  for (const child of kids) {
    if (!React.isValidElement(child)) continue;
    const props = child.props as { className?: string; children?: React.ReactNode };
    if (typeof props.className === "string" && props.className.includes("language-map")) {
      return <MapBlock raw={String(props.children ?? "").trim()} />;
    }
  }
  return <pre {...rest}>{children}</pre>;
}

/** 안전한 링크만 렌더링, javascript:/data: 등 차단 */
function SafeLink({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) {
  if (!href || !SAFE_URL_RE.test(href)) {
    return <span>{children}</span>;
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children} ↗</a>;
}

/** 외부 이미지 로드 제한 — URL만 텍스트로 표시 */
function SafeImage({ src, alt }: React.ImgHTMLAttributes<HTMLImageElement>) {
  if (!src || !SAFE_URL_RE.test(src)) return null;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="chat-md__img-link">
      🖼 {alt || src}
    </a>
  );
}

const COMPONENTS: Components = {
  a: SafeLink as Components["a"],
  img: SafeImage as Components["img"],
  pre: MapPre as Components["pre"],
};

const REMARK_BASE: Pluggable[] = [remarkGfm];
const REHYPE_BASE: Pluggable[] = [
  rehypeHighlight,
  [rehypeSanitize, SANITIZE_SCHEMA],
];

/** 수식 패턴 감지 — $, $$, \[, \( 중 하나라도 있으면 true. */
const HAS_MATH_RE = /\$\$|\$[^$]|\\\[|\\\(/;

/** KaTeX 플러그인 지연 로딩 캐시. */
type KatexPlugins = { remark: Pluggable; rehype: Pluggable };
let _katex_plugins: KatexPlugins | null = null;
let _katex_loading: Promise<KatexPlugins> | null = null;

async function load_katex(): Promise<KatexPlugins> {
  if (_katex_plugins) return _katex_plugins;
  if (!_katex_loading) {
    _katex_loading = Promise.all([
      import("remark-math"),
      import("rehype-katex"),
      import("katex/dist/katex.min.css"),
    ]).then(([rm, rk]) => {
      _katex_plugins = {
        remark: rm.default,
        rehype: [rk.default, { output: "html" }] as Pluggable,
      };
      return _katex_plugins;
    });
  }
  return _katex_loading;
}

/** 스트리밍 중 경량 렌더 — 줄바꿈만 처리, 풀 마크다운 파이프라인 건너뜀.
 *  DOM 교체 대신 텍스트 노드만 업데이트되어 깜빡임 없이 부드럽게 확장. */
function StreamingText({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="chat-md chat-md--streaming">
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </React.Fragment>
      ))}
    </div>
  );
}

export function MarkdownContent({ content, streaming }: { content: string; streaming?: boolean }) {
  if (streaming) return <StreamingText content={content} />;

  const needs_math = HAS_MATH_RE.test(content);
  const [katex, set_katex] = useState(_katex_plugins);

  useEffect(() => {
    if (needs_math && !katex) {
      load_katex().then(set_katex);
    }
  }, [needs_math, katex]);

  const remark_plugins = katex ? [...REMARK_BASE, katex.remark] : REMARK_BASE;
  const rehype_plugins = katex
    ? [rehypeHighlight, katex.rehype, [rehypeSanitize, SANITIZE_SCHEMA]] as Pluggable[]
    : REHYPE_BASE;

  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={remark_plugins}
        rehypePlugins={rehype_plugins}
        components={COMPONENTS}
      >
        {needs_math ? preprocess_latex(content) : content}
      </ReactMarkdown>
    </div>
  );
}
