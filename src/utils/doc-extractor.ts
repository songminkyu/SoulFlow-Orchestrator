/**
 * 바이너리 문서 텍스트 추출 유틸.
 * PDF / DOCX / PPTX / HWPX → 순수 텍스트 반환.
 * 외부 CLI 없이 Node.js + npm 패키지만 사용.
 */

import AdmZip from "adm-zip";

const MAX_EXTRACT_CHARS = 200_000;

/** 지원 확장자 목록 (소문자). */
export const BINARY_DOC_EXTENSIONS = new Set([".pdf", ".docx", ".pptx", ".hwpx"]);

/** 비디오 파일 확장자 목록 (소문자). K3 multimodal contract — metadata-first. */
export const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv"]);

/** 비디오 레퍼런스 메타데이터. 실제 비디오 이해(video understanding) 모델은 후속 트랙으로 남김. */
export interface VideoMetadata {
  /** 원본 파일 경로 (refs_dir 기준 상대 경로). */
  file_path: string;
  /** MIME 타입 (파일 확장자 기반 추론). */
  mime_type: string;
  /** 파일 크기 (바이트). */
  file_size: number;
  /** 사람이 읽기 쉬운 레이블 (alt_text 대체용). */
  label: string;
}

/**
 * 비디오 파일 메타데이터 추출. K3 metadata-first 원칙.
 * 실제 프레임 분석 / 트랜스크립션은 후속 트랙에서 구현.
 *
 * @param file_path - refs_dir 기준 상대 경로
 * @param file_size - 파일 크기 (바이트)
 */
export function extract_video_metadata(file_path: string, file_size: number): VideoMetadata {
  const ext = file_path.split(".").pop()?.toLowerCase() ?? "";
  const mime_type = resolve_video_mime(ext);
  return {
    file_path,
    mime_type,
    file_size,
    label: `[비디오: ${file_path}]`,
  };
}

/** 확장자 → MIME 타입 매핑. */
function resolve_video_mime(ext: string): string {
  switch (ext) {
    case "mp4":  return "video/mp4";
    case "webm": return "video/webm";
    case "mov":  return "video/quicktime";
    case "avi":  return "video/x-msvideo";
    case "mkv":  return "video/x-matroska";
    default:     return "video/octet-stream";
  }
}

/**
 * 버퍼 + 확장자로 텍스트 추출.
 * 실패 시 빈 문자열 반환 (호출자가 skip 처리).
 */
export async function extract_doc_text(buf: Buffer, ext: string): Promise<string> {
  try {
    switch (ext.toLowerCase()) {
      case ".pdf":  return extract_pdf(buf);
      case ".docx": return await extract_docx(buf);
      case ".pptx": return extract_pptx(buf);
      case ".hwpx": return extract_hwpx(buf);
      default:      return "";
    }
  } catch {
    return "";
  }
}

// ── PDF ──────────────────────────────────────────────────────────────────────

function extract_pdf(buf: Buffer): string {
  const text = buf.toString("latin1");
  const chunks: string[] = [];
  let total = 0;

  const stream_re = /stream\r?\n([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;
  while ((match = stream_re.exec(text)) !== null) {
    if (total >= MAX_EXTRACT_CHARS) break;
    const extracted = extract_pdf_stream(match[1]!);
    if (extracted) {
      chunks.push(extracted);
      total += extracted.length;
    }
  }

  return chunks.join("\n").replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACT_CHARS);
}

function extract_pdf_stream(content: string): string {
  const parts: string[] = [];
  const tj_re = /\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = tj_re.exec(content)) !== null) {
    const decoded = m[1]!
      .replace(/\\(\d{3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\").replace(/\\([()])/g, "$1");
    if (decoded.trim()) parts.push(decoded);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ── DOCX ─────────────────────────────────────────────────────────────────────

async function extract_docx(buf: Buffer): Promise<string> {
  // mammoth은 CJS, dynamic import로 로드
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACT_CHARS);
}

// ── PPTX ─────────────────────────────────────────────────────────────────────

function extract_pptx(buf: Buffer): string {
  const zip = new AdmZip(buf);
  const parts: string[] = [];

  // 슬라이드 파일 정렬 (slide1.xml, slide2.xml, ...)
  const entries = zip.getEntries()
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
    .sort((a, b) => {
      const na = parseInt(a.entryName.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.entryName.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    });

  for (const entry of entries) {
    const xml = entry.getData().toString("utf-8");
    const text = strip_xml(xml);
    if (text) parts.push(text);
  }

  return parts.join("\n").replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACT_CHARS);
}

// ── HWPX ─────────────────────────────────────────────────────────────────────

function extract_hwpx(buf: Buffer): string {
  const zip = new AdmZip(buf);
  const parts: string[] = [];

  // section 파일 정렬 (section0.xml, section1.xml, ...)
  const entries = zip.getEntries()
    .filter((e) => /^Contents\/section\d+\.xml$/i.test(e.entryName))
    .sort((a, b) => {
      const na = parseInt(a.entryName.match(/\d+/)?.[0] ?? "0");
      const nb = parseInt(b.entryName.match(/\d+/)?.[0] ?? "0");
      return na - nb;
    });

  for (const entry of entries) {
    const xml = entry.getData().toString("utf-8");
    const text = strip_xml(xml);
    if (text) parts.push(text);
  }

  return parts.join("\n").replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACT_CHARS);
}

// ── 공통 ─────────────────────────────────────────────────────────────────────

/** XML 태그 제거 후 텍스트만 추출. */
function strip_xml(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
