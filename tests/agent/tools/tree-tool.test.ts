/**
 * TreeTool — traverse/flatten/find/depth/to_ascii/from_parent_list/lca 테스트.
 * L126: in-order 순회에서 자식이 없는 리프 노드 분기 커버.
 */
import { describe, it, expect } from "vitest";
import { TreeTool } from "../../../src/agent/tools/tree.js";

const tool = new TreeTool();

async function exec(params: Record<string, unknown>): Promise<unknown> {
  const result = await tool.execute(params);
  try { return JSON.parse(String(result)); } catch { return result; }
}

// 단순 트리: root → [child1, child2]
const TREE = JSON.stringify({
  id: "root",
  children: [
    { id: "child1", children: [{ id: "leaf1" }] },
    { id: "child2" },
  ],
});

// ══════════════════════════════════════════
// traverse — pre/in/post/level 순서
// ══════════════════════════════════════════

describe("TreeTool — traverse pre-order", () => {
  it("pre-order 순회 결과 확인", async () => {
    const r = await exec({ action: "traverse", tree: TREE, order: "pre" }) as Record<string, unknown>;
    const ids = r.nodes as string[];
    expect(ids[0]).toBe("root");
    expect(ids).toContain("child1");
    expect(ids).toContain("child2");
  });
});

describe("TreeTool — traverse in-order (L126: 리프 노드)", () => {
  it("in-order: child2(리프) → L126 else 분기 실행", async () => {
    // child2는 children 없음 → dfs에서 order==="in" && no children → L126 result.push(node.id)
    const r = await exec({ action: "traverse", tree: TREE, order: "in" }) as Record<string, unknown>;
    const ids = r.nodes as string[];
    expect(ids).toContain("child2");
    expect(ids).toContain("root");
  });

  it("in-order: 단일 리프 트리", async () => {
    // 자식 없는 노드만 있는 트리 → 모두 L126 분기
    const single = JSON.stringify({ id: "lone" });
    const r = await exec({ action: "traverse", tree: single, order: "in" }) as Record<string, unknown>;
    expect((r.nodes as string[])[0]).toBe("lone");
  });
});

describe("TreeTool — traverse post-order", () => {
  it("post-order: root가 마지막", async () => {
    const r = await exec({ action: "traverse", tree: TREE, order: "post" }) as Record<string, unknown>;
    const ids = r.nodes as string[];
    expect(ids[ids.length - 1]).toBe("root");
  });
});

describe("TreeTool — traverse level-order", () => {
  it("level-order: root가 첫 번째", async () => {
    const r = await exec({ action: "traverse", tree: TREE, order: "level" }) as Record<string, unknown>;
    const ids = r.nodes as string[];
    expect(ids[0]).toBe("root");
  });
});

// ══════════════════════════════════════════
// flatten
// ══════════════════════════════════════════

describe("TreeTool — flatten", () => {
  it("모든 노드 {id, depth} 객체 반환", async () => {
    const r = await exec({ action: "flatten", tree: TREE }) as Record<string, unknown>;
    const nodes = r.nodes as Array<{ id: string; depth: number }>;
    const ids = nodes.map((n) => n.id);
    expect(ids).toContain("root");
    expect(ids).toContain("child1");
    expect(ids).toContain("child2");
    expect(ids).toContain("leaf1");
    expect(nodes.find((n) => n.id === "root")?.depth).toBe(0);
  });
});

// ══════════════════════════════════════════
// find
// ══════════════════════════════════════════

describe("TreeTool — find", () => {
  it("leaf1 찾기 → 경로 반환", async () => {
    const r = await exec({ action: "find", tree: TREE, target: "leaf1" }) as Record<string, unknown>;
    expect(r.found).toBe(true);
    expect(Array.isArray(r.path)).toBe(true);
  });

  it("존재하지 않는 노드 → found: false", async () => {
    const r = await exec({ action: "find", tree: TREE, target: "nonexistent" }) as Record<string, unknown>;
    expect(r.found).toBe(false);
  });
});

// ══════════════════════════════════════════
// depth
// ══════════════════════════════════════════

describe("TreeTool — depth", () => {
  it("트리 최대 깊이 반환", async () => {
    const r = await exec({ action: "depth", tree: TREE }) as Record<string, unknown>;
    expect(Number(r.max_depth)).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════
// to_ascii
// ══════════════════════════════════════════

describe("TreeTool — to_ascii", () => {
  it("ASCII 트리 문자열 반환", async () => {
    const r = await exec({ action: "to_ascii", tree: TREE }) as Record<string, unknown>;
    expect(String(r.ascii)).toContain("root");
    expect(String(r.ascii)).toContain("child1");
  });
});

// ══════════════════════════════════════════
// from_parent_list
// ══════════════════════════════════════════

describe("TreeTool — from_parent_list", () => {
  it("parent 목록으로 트리 구성", async () => {
    const parents = JSON.stringify([
      { id: "r", parent: null },
      { id: "c1", parent: "r" },
      { id: "c2", parent: "r" },
    ]);
    const r = await exec({ action: "from_parent_list", parents }) as Record<string, unknown>;
    expect((r.tree as { id: string }).id).toBe("r");
  });

  it("root 없으면 error", async () => {
    const parents = JSON.stringify([{ id: "c1", parent: "r" }]);
    const r = await exec({ action: "from_parent_list", parents }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });

  it("잘못된 JSON → error", async () => {
    const r = await exec({ action: "from_parent_list", parents: "bad{json" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

// ══════════════════════════════════════════
// lca (최소 공통 조상)
// ══════════════════════════════════════════

describe("TreeTool — lca", () => {
  it("leaf1과 child2의 LCA → root", async () => {
    const r = await exec({ action: "lca", tree: TREE, node_a: "leaf1", node_b: "child2" }) as Record<string, unknown>;
    expect(r.lca).toBe("root");
  });

  it("존재하지 않는 노드 → error 반환", async () => {
    const r = await exec({ action: "lca", tree: TREE, node_a: "leaf1", node_b: "ghost" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

// ══════════════════════════════════════════
// 에러 케이스
// ══════════════════════════════════════════

describe("TreeTool — 에러 케이스", () => {
  it("잘못된 tree JSON → error", async () => {
    const r = await exec({ action: "traverse", tree: "bad{json" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

// ══════════════════════════════════════════
// 미커버 분기 보충
// ══════════════════════════════════════════

describe("TreeTool — 미커버 분기", () => {
  it("parse_tree: id 없는 JSON → L113 return null → error", async () => {
    // parse_tree({}) → !t.id → return null → action finds null tree
    const r = await exec({ action: "traverse", tree: '{"noId": true}' }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
  });
});

describe("TreeTool — lca: node_a 없음 → L96 error", () => {
  it("node_a가 존재하지 않음 → L96 path_a null → error", async () => {
    const r = await exec({ action: "lca", tree: TREE, node_a: "ghost", node_b: "leaf1" }) as Record<string, unknown>;
    expect(r.error).toBeDefined();
    expect(String(r.error)).toContain("ghost");
  });
});

// ══════════════════════════════════════════
// root merge: traverse 순서 검증 / flatten depth·parent / find path / depth 통계 / to_ascii / from_parent_list / lca
// ══════════════════════════════════════════

const SAMPLE_TREE = JSON.stringify({
  id: "A",
  children: [
    { id: "B", children: [{ id: "D" }, { id: "E" }] },
    { id: "C", children: [{ id: "F" }] },
  ],
});

describe("TreeTool — traverse 순서 (root merge)", () => {
  it("pre-order 순서 검증", async () => {
    const r = await exec({ action: "traverse", tree: SAMPLE_TREE, order: "pre" }) as Record<string, unknown>;
    expect(r.nodes).toEqual(["A", "B", "D", "E", "C", "F"]);
  });

  it("post-order 순서 검증", async () => {
    const r = await exec({ action: "traverse", tree: SAMPLE_TREE, order: "post" }) as Record<string, unknown>;
    expect(r.nodes).toEqual(["D", "E", "B", "F", "C", "A"]);
  });

  it("level-order (BFS) 순서 검증", async () => {
    const r = await exec({ action: "traverse", tree: SAMPLE_TREE, order: "level" }) as Record<string, unknown>;
    expect(r.nodes).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("기본 순서는 pre", async () => {
    const r = await exec({ action: "traverse", tree: SAMPLE_TREE }) as Record<string, unknown>;
    expect(r.order).toBe("pre");
  });
});

describe("TreeTool — flatten 세부 (root merge)", () => {
  it("트리를 평탄화 + depth/parent 포함", async () => {
    const r = await exec({ action: "flatten", tree: SAMPLE_TREE }) as Record<string, unknown>;
    expect(r.count).toBe(6);
    const nodes = r.nodes as Array<{ id: string; depth: number; parent?: string }>;
    const a = nodes.find((n) => n.id === "A");
    expect(a!.depth).toBe(0);
    const d = nodes.find((n) => n.id === "D");
    expect(d!.depth).toBe(2);
    expect(d!.parent).toBe("B");
  });
});

describe("TreeTool — find 세부 (root merge)", () => {
  it("노드 찾기 + 경로", async () => {
    const r = await exec({ action: "find", tree: SAMPLE_TREE, target: "E" }) as Record<string, unknown>;
    expect(r.found).toBe(true);
    expect(r.path).toEqual(["A", "B", "E"]);
    expect(r.depth).toBe(2);
  });

  it("없는 노드 → found=false", async () => {
    const r = await exec({ action: "find", tree: SAMPLE_TREE, target: "Z" }) as Record<string, unknown>;
    expect(r.found).toBe(false);
  });
});

describe("TreeTool — depth 통계 (root merge)", () => {
  it("트리 깊이/노드/리프 통계", async () => {
    const r = await exec({ action: "depth", tree: SAMPLE_TREE }) as Record<string, unknown>;
    expect(r.max_depth).toBe(2);
    expect(r.node_count).toBe(6);
    expect(r.leaf_count).toBe(3);
  });
});

describe("TreeTool — to_ascii 세부 (root merge)", () => {
  it("ASCII 트리 생성 + line_count", async () => {
    const r = await exec({ action: "to_ascii", tree: SAMPLE_TREE }) as Record<string, unknown>;
    expect(String(r.ascii)).toContain("A");
    expect(r.line_count).toBe(6);
  });
});

describe("TreeTool — from_parent_list 세부 (root merge)", () => {
  it("부모 목록에서 트리 구성 (grandchild 포함)", async () => {
    const parents = JSON.stringify([
      { id: "root", parent: null },
      { id: "child1", parent: "root" },
      { id: "child2", parent: "root" },
      { id: "grandchild", parent: "child1" },
    ]);
    const r = await exec({ action: "from_parent_list", parents }) as Record<string, unknown>;
    expect((r.tree as { id: string }).id).toBe("root");
    expect((r.tree as { children: unknown[] }).children).toHaveLength(2);
  });
});

describe("TreeTool — lca 세부 (root merge)", () => {
  it("최소 공통 조상 (같은 서브트리)", async () => {
    const r = await exec({ action: "lca", tree: SAMPLE_TREE, node_a: "D", node_b: "E" }) as Record<string, unknown>;
    expect(r.lca).toBe("B");
  });

  it("서로 다른 서브트리 → 루트가 LCA", async () => {
    const r = await exec({ action: "lca", tree: SAMPLE_TREE, node_a: "D", node_b: "F" }) as Record<string, unknown>;
    expect(r.lca).toBe("A");
  });

  it("없는 노드 → 에러", async () => {
    const r = await exec({ action: "lca", tree: SAMPLE_TREE, node_a: "D", node_b: "Z" }) as Record<string, unknown>;
    expect(String(r.error)).toContain("not found");
  });
});
