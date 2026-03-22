/**
 * XmlTool — XML 파싱/생성/쿼리/검증/포맷팅 테스트.
 */
import { describe, it, expect } from "vitest";
import { XmlTool } from "../../../src/agent/tools/xml.js";

const tool = new XmlTool();

async function exec(params: Record<string, unknown>): Promise<unknown> {
  const result = await tool.execute(params);
  try { return JSON.parse(String(result)); } catch { return result; }
}

const BASIC_XML = `<root><name>Alice</name><age>30</age><city>Seoul</city></root>`;
const ATTRS_XML = `<person id="1" active="true"><name>Bob</name></person>`;

describe("XmlTool — parse", () => {
  it("기본 XML → JSON 변환", async () => {
    const r = await exec({ action: "parse", data: BASIC_XML }) as Record<string, unknown>;
    expect(r).toBeDefined();
    const root = r.root as Record<string, unknown>;
    expect(root.name).toBe("Alice");
    expect(root.age).toBe("30");
    expect(root.city).toBe("Seoul");
  });

  it("속성 포함 XML 파싱", async () => {
    const r = await exec({ action: "parse", data: ATTRS_XML }) as Record<string, unknown>;
    const person = r.person as Record<string, unknown>;
    expect(person["@id"]).toBe("1");
    expect(person["@active"]).toBe("true");
  });

  it("자기 종료 태그 파싱", async () => {
    const r = await exec({ action: "parse", data: '<root><item id="1"/></root>' }) as Record<string, unknown>;
    const root = r.root as Record<string, unknown>;
    expect(root).toBeDefined();
  });
});

describe("XmlTool — generate", () => {
  it("JSON → XML 생성", async () => {
    const json = JSON.stringify({ greeting: { message: "hello" } });
    const r = String(await exec({ action: "generate", data: json }));
    expect(r).toContain("<greeting>");
    expect(r).toContain("hello");
    expect(r).toContain("</greeting>");
  });

  it("잘못된 JSON → Error", async () => {
    expect(String(await exec({ action: "generate", data: "not-json" }))).toContain("Error");
  });
});

describe("XmlTool — query", () => {
  it("path로 값 추출", async () => {
    const r = await exec({ action: "query", data: BASIC_XML, path: "root.name" }) as Record<string, unknown>;
    expect(r.result).toBe("Alice");
  });

  it("path 없음 → Error", async () => {
    expect(String(await exec({ action: "query", data: BASIC_XML, path: "" }))).toContain("Error");
  });
});

describe("XmlTool — validate", () => {
  it("유효한 XML → valid: true", async () => {
    const r = await exec({ action: "validate", data: BASIC_XML }) as Record<string, unknown>;
    expect(r.valid).toBe(true);
  });
});

describe("XmlTool — pretty", () => {
  it("XML 포맷팅", async () => {
    const r = String(await exec({ action: "pretty", data: BASIC_XML }));
    expect(r).toContain("Alice");
  });
});

// ══════════════════════════════════════════
// 미커버 분기 보충
// ══════════════════════════════════════════

describe("XmlTool — 미커버 분기", () => {
  it("query: current가 배열이고 part가 비정수 → map 반환 (L64)", async () => {
    // <root><item>a</item><item>b</item></root> → item은 배열, .name은 비정수 인덱스
    const xml = `<root><item><name>Alice</name></item><item><name>Bob</name></item></root>`;
    const r = await exec({ action: "query", data: xml, path: "root.item.name" });
    // map 결과: 배열로 반환되거나 undefined — 에러 없이 반환되어야 함
    expect(r).toBeDefined();
  });

  it("generate: 배열 JSON → L155 Array.isArray 분기", async () => {
    // json_to_xml([...], 0) → L155: Array.isArray fires
    const data = JSON.stringify([{ tag: "item1" }, { tag: "item2" }]);
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("item1");
  });

  it("generate: null 포함 배열 → L153 null/undefined 분기", async () => {
    // json_to_xml([null, {tag:"x"}], 0) → L155 array, item null → L153
    const data = JSON.stringify([null, { tag: "x" }]);
    const r = String(await exec({ action: "generate", data }));
    expect(r).toBeDefined();
  });

  it("generate: 문자열 포함 배열 → L154 non-object 분기", async () => {
    // json_to_xml(["hello", "world"], 0) → L155 array, item "hello" → L154
    const data = JSON.stringify(["hello", "world"]);
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("hello");
  });
});

// ══════════════════════════════════════════
// root merge: 중복 태그 배열 / 배열→반복 태그 / query 추가 분기
// ══════════════════════════════════════════

describe("XmlTool — parse 추가", () => {
  it("중복 태그 → 배열", async () => {
    const SAMPLE_XML = `<root><item id="1">Hello</item><item id="2">World</item></root>`;
    const r = await exec({ action: "parse", data: SAMPLE_XML }) as Record<string, unknown>;
    const root = r.root as Record<string, unknown>;
    expect(root.item).toBeInstanceOf(Array);
    expect(root.item as unknown[]).toHaveLength(2);
  });

  it("태그 없는 plain text → #text 필드로 반환", async () => {
    const r = await exec({ action: "parse", data: "plain text content" }) as Record<string, unknown>;
    expect(r["#text"]).toBe("plain text content");
  });
});

describe("XmlTool — generate 추가", () => {
  it("배열 → 반복 태그", async () => {
    const data = JSON.stringify({ items: { item: ["a", "b"] } });
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("<item>a</item>");
    expect(r).toContain("<item>b</item>");
  });

  it("null 값 → self-closing 태그", async () => {
    const data = JSON.stringify({ empty: null });
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("<empty");
    expect(r).toContain("/>");
  });

  it("@ 속성 포함 → 속성으로 변환", async () => {
    const data = JSON.stringify({ item: { "@id": "42", "#text": "내용" } });
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain('id="42"');
    expect(r).toContain("내용");
  });

  it("배열 of objects → 각각 태그로 감쌈", async () => {
    const data = JSON.stringify({ list: { item: [{ name: "A" }, { name: "B" }] } });
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("<item>");
    expect(r).toContain("<name>A</name>");
  });

  it("primitive 값 → <tag>value</tag>", async () => {
    const data = JSON.stringify({ count: 42, flag: true });
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("<count>42</count>");
  });

  it("@ 키와 #text 이외 내부 키가 있는 경우 → 자식 태그 포함", async () => {
    const data = JSON.stringify({ root: { "@id": "1", child: "value" } });
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("<root");
    expect(r).toContain("<child>value</child>");
  });

  it("배열 내 string → <tag>value</tag> 반복", async () => {
    const data = JSON.stringify({ tags: { tag: ["alpha", "beta"] } });
    const r = String(await exec({ action: "generate", data }));
    expect(r).toContain("<tag>alpha</tag>");
    expect(r).toContain("<tag>beta</tag>");
  });
});

describe("XmlTool — query 추가", () => {
  it("경로 쿼리 (중첩)", async () => {
    const xml = "<config><db><host>localhost</host><port>5432</port></db></config>";
    const r = await exec({ action: "query", data: xml, path: "config.db.host" }) as Record<string, unknown>;
    expect(r.result).toBe("localhost");
  });

  it("없는 경로 → undefined", async () => {
    const xml = "<root><a>1</a></root>";
    const r = await exec({ action: "query", data: xml, path: "root.b" }) as Record<string, unknown>;
    expect(r.result).toBeUndefined();
  });

  it("중복 태그 배열 인덱스로 접근", async () => {
    const xml = "<list><item>첫번째</item><item>두번째</item></list>";
    const r = await exec({ action: "query", data: xml, path: "list.item.1" }) as Record<string, unknown>;
    expect(r.result).toBe("두번째");
  });

  it("경로 도중 비객체/비배열 → null 반환", async () => {
    const xml = "<root><a>text</a></root>";
    const r = await exec({ action: "query", data: xml, path: "root.a.b" }) as Record<string, unknown>;
    expect(r.result).toBeNull();
  });
});

describe("XmlTool — validate 실패", () => {
  it("텍스트만 있는 비XML → valid 정의됨", async () => {
    const r = await exec({ action: "validate", data: "plain text no tags" });
    expect(r).toBeDefined();
  });
});

describe("XmlTool — pretty 보강", () => {
  it("들여쓰기된 XML 출력", async () => {
    const r = String(await exec({ action: "pretty", data: "<root><a>1</a><b>2</b></root>" }));
    expect(r).toContain("  <a>1</a>");
    expect(r).toContain("  <b>2</b>");
  });

  it("파싱 실패 XML → 원본 그대로 반환", async () => {
    const data = "not xml at all ><><";
    const r = String(await exec({ action: "pretty", data }));
    expect(typeof r).toBe("string");
  });
});

describe("XmlTool — unsupported action", () => {
  it("지원하지 않는 action → 에러", async () => {
    const r = String(await exec({ action: "nope", data: "" }));
    expect(r).toContain("unsupported action");
  });
});
