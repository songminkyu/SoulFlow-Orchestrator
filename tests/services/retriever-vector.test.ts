/**
 * K2 — RetrieverTool vector action: ReferenceStoreLike 연결 및 RetrievalEnvelope 검증.
 * sqlite-vec 없이 mock store를 주입하여 envelope 계약과 citation/metadata 보존을 검증한다.
 */
import { describe, it, expect, vi } from "vitest";
import { RetrieverTool } from "../../src/agent/tools/retriever.js";
import type { ReferenceStoreLike, ReferenceSearchResult } from "../../src/services/reference-store.js";
import { to_retrieval_item } from "../../src/services/reference-store.js";

// ── 헬퍼 ──

/** ReferenceStoreLike mock 팩토리. */
function make_mock_store(results: ReferenceSearchResult[]): ReferenceStoreLike {
  return {
    set_embed: vi.fn(),
    sync: vi.fn().mockResolvedValue({ added: 0, updated: 0, removed: 0 }),
    search: vi.fn().mockResolvedValue(results),
    list_documents: vi.fn().mockReturnValue([]),
    get_stats: vi.fn().mockReturnValue({ total_docs: 0, total_chunks: 0, last_sync: null }),
  };
}

function make_tool(): RetrieverTool {
  return new RetrieverTool();
}

const SAMPLE_CHUNKS: ReferenceSearchResult[] = [
  { chunk_id: "c1", doc_path: "docs/guide.md", heading: "Overview", content: "Introduction to SoulFlow", score: 0.9 },
  { chunk_id: "c2", doc_path: "docs/api.md",   heading: "API Ref",  content: "API details",            score: 0.7 },
];

// ── vector action: store 없음 ──

describe("RetrieverTool vector — store 없음", () => {
  it("store 미주입 시 에러 반환", async () => {
    const r = await make_tool().execute({ action: "vector", query: "test", collection: "docs" });
    expect(r).toContain("Error");
    expect(r).toContain("reference store");
  });

  it("collection 없으면 에러", async () => {
    const r = await make_tool().execute({ action: "vector", query: "test" });
    expect(r).toContain("Error");
    expect(r).toContain("collection");
  });
});

// ── vector action: store 주입 시 실제 결과 반환 ──

describe("RetrieverTool vector — reference_store 주입", () => {
  it("store 결과를 RetrievalEnvelope로 반환", async () => {
    const tool = make_tool();
    tool.set_reference_store(make_mock_store(SAMPLE_CHUNKS));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "SoulFlow", collection: "docs" }));

    expect(r.source).toBe("vector");
    expect(r.query).toBe("SoulFlow");
    expect(r.collection).toBe("docs");
    expect(r.count).toBe(2);
    expect(r.results).toHaveLength(2);
  });

  it("citation/metadata(id, doc_path, heading, score) 보존", async () => {
    const tool = make_tool();
    tool.set_reference_store(make_mock_store(SAMPLE_CHUNKS));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "intro", collection: "docs" }));

    const first = r.results[0];
    expect(first).toHaveProperty("id", "c1");
    expect(first).toHaveProperty("doc_path", "docs/guide.md");
    expect(first).toHaveProperty("heading", "Overview");
    expect(first).toHaveProperty("content");
    expect(first).toHaveProperty("score");
    expect(typeof first.score).toBe("number");
  });

  it("top_k 제한 적용", async () => {
    const tool = make_tool();
    tool.set_reference_store(make_mock_store(SAMPLE_CHUNKS));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "test", collection: "docs", top_k: 1 }));
    expect(r.count).toBe(1);
    expect(r.results).toHaveLength(1);
  });

  it("min_score 필터링: score 미달 항목 제외", async () => {
    const tool = make_tool();
    // score 0.7 미만 항목 제외 → c2(0.7) 포함, c2가 0.7이면 포함 (< min_score 는 제외이므로 0.7 >= 0.8이 false → 제외)
    const chunks: ReferenceSearchResult[] = [
      { chunk_id: "c1", doc_path: "a.md", heading: "H1", content: "x", score: 0.9 },
      { chunk_id: "c2", doc_path: "b.md", heading: "H2", content: "y", score: 0.5 },
    ];
    tool.set_reference_store(make_mock_store(chunks));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "test", collection: "docs", min_score: 0.8 }));
    expect(r.count).toBe(1);
    expect(r.results[0].id).toBe("c1");
  });

  it("score 내림차순 정렬", async () => {
    const tool = make_tool();
    const chunks: ReferenceSearchResult[] = [
      { chunk_id: "low",  doc_path: "a.md", heading: "", content: "low",  score: 0.3 },
      { chunk_id: "high", doc_path: "b.md", heading: "", content: "high", score: 0.95 },
      { chunk_id: "mid",  doc_path: "c.md", heading: "", content: "mid",  score: 0.6 },
    ];
    tool.set_reference_store(make_mock_store(chunks));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "test", collection: "docs" }));
    expect(r.results[0].id).toBe("high");
    expect(r.results[2].id).toBe("low");
  });
});

// ── vector action: skill_ref_store 병합 ──

describe("RetrieverTool vector — 두 스토어 병합", () => {
  it("reference_store + skill_ref_store 결과 병합 후 중복 제거", async () => {
    const tool = make_tool();
    const ref_chunks: ReferenceSearchResult[] = [
      { chunk_id: "r1", doc_path: "refs/a.md", heading: "A", content: "ref content", score: 0.8 },
    ];
    const skill_chunks: ReferenceSearchResult[] = [
      { chunk_id: "s1", doc_path: "skills/b.md", heading: "B", content: "skill content", score: 0.75 },
      { chunk_id: "r1", doc_path: "refs/a.md",   heading: "A", content: "ref content",   score: 0.8 },  // 중복
    ];
    tool.set_reference_store(make_mock_store(ref_chunks));
    tool.set_skill_ref_store(make_mock_store(skill_chunks));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "test", collection: "docs" }));
    // r1이 중복이므로 실제 결과는 r1, s1 두 개
    expect(r.count).toBe(2);
    const ids = r.results.map((x: { id: string }) => x.id);
    expect(ids).toContain("r1");
    expect(ids).toContain("s1");
  });

  it("reference_store만 주입해도 동작", async () => {
    const tool = make_tool();
    tool.set_reference_store(make_mock_store(SAMPLE_CHUNKS));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "test", collection: "docs" }));
    expect(r.source).toBe("vector");
    expect(r.count).toBe(2);
  });

  it("skill_ref_store만 주입해도 동작", async () => {
    const tool = make_tool();
    tool.set_skill_ref_store(make_mock_store(SAMPLE_CHUNKS));

    const r = JSON.parse(await tool.execute({ action: "vector", query: "test", collection: "docs" }));
    expect(r.source).toBe("vector");
    expect(r.count).toBe(2);
  });
});

// ── to_retrieval_item 헬퍼 ──

describe("to_retrieval_item", () => {
  it("ReferenceSearchResult → RetrievalItem 변환 (chunk_id → id)", () => {
    const item = to_retrieval_item({ chunk_id: "abc", doc_path: "x.md", heading: "H", content: "C", score: 0.5 });
    expect(item.id).toBe("abc");
    expect(item.doc_path).toBe("x.md");
    expect(item.heading).toBe("H");
    expect(item.content).toBe("C");
    expect(item.score).toBe(0.5);
  });
});

// ── 브랜치 커버리지 보완 ──

describe("RetrieverTool — branch coverage", () => {
  it("지원하지 않는 action → 에러", async () => {
    const r = await make_tool().execute({ action: "unsupported" as never, query: "test" });
    expect(r).toContain("Error");
    expect(r).toContain("unsupported");
  });
});


// ── HTTP action 브랜치 커버리지 (fetch mock) ──

describe("RetrieverTool http — fetch mock", () => {
  it("응답 성공: array body → results 반환", async () => {
    const mock_fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, text: "result1" }, { id: 2, text: "result2" }],
    });
    vi.stubGlobal("fetch", mock_fetch);

    try {
      const r = JSON.parse(await make_tool().execute({ action: "http", query: "test", url: "http://example.com/search" }));
      expect(r.source).toBe("http");
      expect(r.count).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("url에 ? 포함 시 & 구분자 사용", async () => {
    const mock_fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", mock_fetch);

    try {
      await make_tool().execute({ action: "http", query: "test", url: "http://example.com/search?key=val" });
      const call_url = mock_fetch.mock.calls[0][0] as string;
      expect(call_url).toContain("&q=");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("응답 실패(4xx) → 에러 반환", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }));
    try {
      const r = await make_tool().execute({ action: "http", query: "test", url: "http://example.com/search" });
      expect(r).toContain("Error");
      expect(r).toContain("404");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ── 기존 text/memory 회귀 테스트 ──

describe("RetrieverTool — text/memory 회귀", () => {
  it("memory action: 키/값 매칭 검색", async () => {
    const data = JSON.stringify({ greeting: "Hello world", farewell: "Goodbye world" });
    const r = JSON.parse(await make_tool().execute({ action: "memory", query: "hello", data }));
    expect(r.source).toBe("memory");
    expect(r.count).toBeGreaterThan(0);
  });

  it("http action: url 없으면 에러", async () => {
    const r = await make_tool().execute({ action: "http", query: "test" });
    expect(r).toContain("Error");
  });
});
