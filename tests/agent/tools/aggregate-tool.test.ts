/**
 * AggregateTool — sum/avg/min/max/count/group_by/percentile/join/unique/flatten + 미커버 분기.
 */
import { describe, it, expect } from "vitest";
import { AggregateTool } from "@src/agent/tools/aggregate.js";

const tool = new AggregateTool();

describe("AggregateTool — 기본 동작", () => {
  it("sum: 숫자 배열 합계", async () => {
    const r = JSON.parse(await tool.execute({ action: "sum", data: "[1,2,3,4,5]" }));
    expect(r.result).toBe(15);
  });

  it("avg: 평균", async () => {
    const r = JSON.parse(await tool.execute({ action: "avg", data: "[10,20,30]" }));
    expect(r.result).toBe(20);
  });

  it("min/max", async () => {
    const min = JSON.parse(await tool.execute({ action: "min", data: "[3,1,4,1,5,9]" }));
    const max = JSON.parse(await tool.execute({ action: "max", data: "[3,1,4,1,5,9]" }));
    expect(min.result).toBe(1);
    expect(max.result).toBe(9);
  });

  it("count: 배열 크기", async () => {
    const r = JSON.parse(await tool.execute({ action: "count", data: "[1,2,3]" }));
    expect(r.result).toBe(3);
  });

  it("join: 구분자로 합치기", async () => {
    const r = JSON.parse(await tool.execute({ action: "join", data: '["a","b","c"]', separator: "-" }));
    expect(r.result).toBe("a-b-c");
  });

  it("unique: 중복 제거", async () => {
    const r = JSON.parse(await tool.execute({ action: "unique", data: "[1,2,2,3,3,3]" }));
    expect(r.result).toHaveLength(3);
  });

  it("flatten: 중첩 배열 평탄화", async () => {
    const r = JSON.parse(await tool.execute({ action: "flatten", data: "[[1,2],[3,[4]]]" }));
    expect(r.result).toContain(1);
    expect(r.result).toContain(3);
  });

  it("잘못된 data JSON → Error", async () => {
    const r = await tool.execute({ action: "sum", data: "not-json" });
    expect(r).toContain("Error");
  });
});

describe("AggregateTool — 미커버 분기 (L81)", () => {
  it("get_path: 중간 경로가 비객체 → L81 return undefined", async () => {
    // data=[{a:1}], field="a.nested" → a=1(number, not object) → L81 fires → undefined
    const r = JSON.parse(await tool.execute({ action: "sum", data: '[{"a":1}]', field: "a.nested" }));
    // 숫자 없음, 합계=0
    expect(r.result).toBe(0);
  });
});

// ══════════════════════════════════════════
// root merge: sum 필드 경로 / avg 빈 배열 / min·max 빈 배열 / group_by / percentile / join / unique / flatten / 에러
// ══════════════════════════════════════════

describe("AggregateTool — sum 추가", () => {
  it("필드 경로로 합계", async () => {
    const data = JSON.stringify([{ val: 10 }, { val: 20 }, { val: 30 }]);
    const r = JSON.parse(await tool.execute({ action: "sum", data, field: "val" }));
    expect(r.result).toBe(60);
  });

  it("숫자 합계 count 포함", async () => {
    const r = JSON.parse(await tool.execute({ action: "sum", data: "[1,2,3,4,5]" }));
    expect(r.result).toBe(15);
    expect(r.count).toBe(5);
  });
});

describe("AggregateTool — avg 추가", () => {
  it("빈 배열 → 0", async () => {
    const r = JSON.parse(await tool.execute({ action: "avg", data: "[]" }));
    expect(r.result).toBe(0);
  });
});

describe("AggregateTool — min/max 추가", () => {
  it("빈 배열 min → null", async () => {
    const r = JSON.parse(await tool.execute({ action: "min", data: "[]" }));
    expect(r.result).toBeNull();
  });

  it("최솟값", async () => {
    const r = JSON.parse(await tool.execute({ action: "min", data: "[5,1,3]" }));
    expect(r.result).toBe(1);
  });

  it("최댓값", async () => {
    const r = JSON.parse(await tool.execute({ action: "max", data: "[5,1,3]" }));
    expect(r.result).toBe(5);
  });
});

describe("AggregateTool — group_by 추가", () => {
  it("필드별 그룹화", async () => {
    const data = JSON.stringify([
      { category: "A", val: 1 },
      { category: "B", val: 2 },
      { category: "A", val: 3 },
    ]);
    const r = JSON.parse(await tool.execute({ action: "group_by", data, field: "category" }));
    expect(r.result.A).toHaveLength(2);
    expect(r.result.B).toHaveLength(1);
    expect(r.group_count).toBe(2);
  });

  it("field 없으면 에러", async () => {
    const r = await tool.execute({ action: "group_by", data: "[1,2]" });
    expect(r).toContain("Error");
  });
});

describe("AggregateTool — percentile 추가", () => {
  it("중앙값 (50th percentile)", async () => {
    const r = JSON.parse(await tool.execute({ action: "percentile", data: "[1,2,3,4,5]", percentile: 50 }));
    expect(r.result).toBe(3);
  });

  it("빈 배열 → null", async () => {
    const r = JSON.parse(await tool.execute({ action: "percentile", data: "[]" }));
    expect(r.result).toBeNull();
  });
});

describe("AggregateTool — join 추가", () => {
  it("기본 쉼표 구분", async () => {
    const r = JSON.parse(await tool.execute({ action: "join", data: '["a","b","c"]' }));
    expect(r.result).toBe("a,b,c");
  });

  it("커스텀 구분자", async () => {
    const r = JSON.parse(await tool.execute({ action: "join", data: '["a","b"]', separator: " | " }));
    expect(r.result).toBe("a | b");
  });
});

describe("AggregateTool — unique 추가", () => {
  it("중복 제거", async () => {
    const r = JSON.parse(await tool.execute({ action: "unique", data: '["a","b","a","c","b"]' }));
    expect(r.result).toEqual(["a", "b", "c"]);
    expect(r.count).toBe(3);
  });
});

describe("AggregateTool — flatten 추가", () => {
  it("중첩 배열 평탄화", async () => {
    const r = JSON.parse(await tool.execute({ action: "flatten", data: "[[1,2],[3,4],[5]]" }));
    expect(r.result).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("AggregateTool — 에러 추가", () => {
  it("배열이 아닌 데이터 → 에러", async () => {
    const r = await tool.execute({ action: "sum", data: '{"a":1}' });
    expect(r).toContain("Error");
  });

  it("지원하지 않는 action → 에러", async () => {
    const r = await tool.execute({ action: "nope", data: "[]" });
    expect(r).toContain("unsupported action");
  });

  it("중첩 필드 경로 (dot-notation)", async () => {
    const data = JSON.stringify([
      { user: { score: 10 } },
      { user: { score: 20 } },
    ]);
    const r = JSON.parse(await tool.execute({ action: "sum", data, field: "user.score" }));
    expect(r.result).toBe(30);
  });
});
