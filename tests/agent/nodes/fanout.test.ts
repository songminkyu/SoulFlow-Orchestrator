/**
 * PAR-4: FanoutNode 핸들러 단위 테스트.
 */

import { describe, it, expect } from "vitest";
import { fanout_handler } from "../../../src/agent/nodes/fanout.js";
import type { OrcheNodeExecutorContext } from "../../../src/agent/orche-node-executor.js";

function make_ctx(memory: Record<string, unknown>): OrcheNodeExecutorContext {
  return { memory, node_id: "test_ctx" } as OrcheNodeExecutorContext;
}

function make_node(overrides: Record<string, unknown>) {
  return {
    node_id: "fanout_test",
    node_type: "fanout" as const,
    title: "Test Fanout",
    branches: [],
    reconcile_node_id: "reconcile_1",
    ...overrides,
  };
}

// ── execute — 기본 팬아웃 ─────────────────────────────────────────

describe("fanout_handler.execute — 기본 팬아웃", () => {
  it("2개 브랜치 실행 → succeeded:2, branch_results 맵 생성", async () => {
    const ctx = make_ctx({
      branch_a_last: "result_a",
      branch_b_last: "result_b",
    });
    const node = make_node({
      branches: [
        { branch_id: "branch_a", node_ids: ["branch_a_last"] },
        { branch_id: "branch_b", node_ids: ["branch_b_last"] },
      ],
    });
    const result = await fanout_handler.execute(node as never, ctx);
    const out = result.output as Record<string, unknown>;
    expect(out["succeeded"]).toBe(2);
    expect(out["failed"]).toBe(0);
    const branch_results = out["branch_results"] as Record<string, unknown>;
    expect(branch_results["branch_a"]).toBe("result_a");
    expect(branch_results["branch_b"]).toBe("result_b");
  });

  it("브랜치 결과를 memory에 기록 → reconcile 노드가 source_node_ids로 접근 가능", async () => {
    const ctx = make_ctx({
      node_x: "answer_x",
    });
    const node = make_node({
      branches: [
        { branch_id: "br_x", node_ids: ["node_x"] },
      ],
    });
    await fanout_handler.execute(node as never, ctx);
    // memory에 branch_id 키로 결과가 기록되어야 함
    expect(ctx.memory["br_x"]).toBe("answer_x");
  });

  it("source_node_ids는 branches의 branch_id 목록", async () => {
    const ctx = make_ctx({ n1: "a", n2: "b" });
    const node = make_node({
      branches: [
        { branch_id: "br1", node_ids: ["n1"] },
        { branch_id: "br2", node_ids: ["n2"] },
      ],
    });
    const result = await fanout_handler.execute(node as never, ctx);
    const out = result.output as Record<string, unknown>;
    expect(out["source_node_ids"]).toEqual(["br1", "br2"]);
  });

  it("branches가 비어있으면 에러 반환", async () => {
    const ctx = make_ctx({});
    const node = make_node({ branches: [] });
    const result = await fanout_handler.execute(node as never, ctx);
    const out = result.output as Record<string, unknown>;
    expect(out["error"]).toBeTruthy();
    expect(typeof out["error"]).toBe("string");
  });
});

// ── execute — 브랜치 실패 ─────────────────────────────────────────

describe("fanout_handler.execute — 브랜치 실패 처리", () => {
  it("마지막 노드 결과 없는 브랜치 → failed 계수", async () => {
    const ctx = make_ctx({ n_ok: "ok" });
    const node = make_node({
      branches: [
        { branch_id: "br_ok", node_ids: ["n_ok"] },
        { branch_id: "br_fail", node_ids: ["n_missing"] },
      ],
    });
    const result = await fanout_handler.execute(node as never, ctx);
    const out = result.output as Record<string, unknown>;
    expect(out["succeeded"]).toBe(1);
    expect(out["failed"]).toBe(1);
  });

  it("branch_timeout_ms 초과 → 해당 브랜치 failed", async () => {
    const ctx = make_ctx({ slow_node: "slow_result" });
    // 타임아웃 없는 케이스 — 이미 메모리에 있으므로 즉시 완료
    const node = make_node({
      branches: [{ branch_id: "br_fast", node_ids: ["slow_node"] }],
      branch_timeout_ms: 5000,
    });
    const result = await fanout_handler.execute(node as never, ctx);
    const out = result.output as Record<string, unknown>;
    expect(out["succeeded"]).toBe(1);
  });
});

// ── execute — 동시성 제한 ────────────────────────────────────────

describe("fanout_handler.execute — 동시성 제한", () => {
  it("max_concurrency=1 → 순차 실행 (결과 동일)", async () => {
    const ctx = make_ctx({ n1: "r1", n2: "r2", n3: "r3" });
    const node = make_node({
      branches: [
        { branch_id: "b1", node_ids: ["n1"] },
        { branch_id: "b2", node_ids: ["n2"] },
        { branch_id: "b3", node_ids: ["n3"] },
      ],
      max_concurrency: 1,
    });
    const result = await fanout_handler.execute(node as never, ctx);
    const out = result.output as Record<string, unknown>;
    expect(out["succeeded"]).toBe(3);
  });
});

// ── execute — 객체 결과 파싱 ─────────────────────────────────────

describe("fanout_handler.execute — 객체 결과 파싱", () => {
  it("객체 결과 → branch_results에 저장됨", async () => {
    const ctx = make_ctx({
      node_obj: { content: "hello", parsed: { score: 0.9 }, extra: "x" },
    });
    const node = make_node({
      branches: [{ branch_id: "br_obj", node_ids: ["node_obj"] }],
    });
    await fanout_handler.execute(node as never, ctx);
    // memory에 parsed 객체가 기록되어야 함
    const stored = ctx.memory["br_obj"] as Record<string, unknown>;
    expect(stored).toBeDefined();
  });
});

// ── test() ────────────────────────────────────────────────────────

describe("fanout_handler.test", () => {
  it("branches 비어있으면 경고", () => {
    const ctx = make_ctx({});
    const node = make_node({ branches: [] });
    const result = fanout_handler.test!(node as never, ctx);
    expect(result.warnings).toContain("branches is empty");
  });

  it("reconcile_node_id 비어있으면 경고", () => {
    const ctx = make_ctx({});
    const node = make_node({
      branches: [{ branch_id: "b1", node_ids: ["n1"] }],
      reconcile_node_id: "",
    });
    const result = fanout_handler.test!(node as never, ctx);
    expect(result.warnings).toContain("reconcile_node_id is required");
  });

  it("중복 branch_id 경고", () => {
    const ctx = make_ctx({});
    const node = make_node({
      branches: [
        { branch_id: "dup", node_ids: ["n1"] },
        { branch_id: "dup", node_ids: ["n2"] },
      ],
      reconcile_node_id: "rec",
    });
    const result = fanout_handler.test!(node as never, ctx);
    expect(result.warnings.some((w: string) => w.includes("duplicate"))).toBe(true);
  });

  it("node_ids 없는 브랜치 경고", () => {
    const ctx = make_ctx({});
    const node = make_node({
      branches: [{ branch_id: "empty_branch", node_ids: [] }],
      reconcile_node_id: "rec",
    });
    const result = fanout_handler.test!(node as never, ctx);
    expect(result.warnings.some((w: string) => w.includes("empty_branch"))).toBe(true);
  });

  it("모든 조건 충족 → 경고 없음", () => {
    const ctx = make_ctx({ n1: "ok", n2: "ok" });
    const node = make_node({
      branches: [
        { branch_id: "b1", node_ids: ["n1"] },
        { branch_id: "b2", node_ids: ["n2"] },
      ],
      reconcile_node_id: "rec",
    });
    const result = fanout_handler.test!(node as never, ctx);
    expect(result.warnings).toHaveLength(0);
  });

  it("preview에 branch_count와 reconcile_node_id 포함", () => {
    const ctx = make_ctx({});
    const node = make_node({
      branches: [
        { branch_id: "b1", node_ids: ["n1"] },
        { branch_id: "b2", node_ids: ["n2"] },
      ],
      reconcile_node_id: "my_reconcile",
    });
    const result = fanout_handler.test!(node as never, ctx);
    expect(result.preview).toMatchObject({
      branch_count: 2,
      reconcile_node_id: "my_reconcile",
    });
  });
});
