import { describe, it, expect } from "vitest";
import {
  audit_workflow_nodes,
  DEFAULT_COMPILER_POLICY,
  type WorkflowCompilerPolicy,
} from "@src/quality/workflow-compiler-policy.ts";
import type { WorkflowNodeDefinition } from "@src/agent/workflow-node.types.ts";

function make_phase(id: string, context_template?: string): WorkflowNodeDefinition {
  return {
    node_id: id,
    title: id,
    node_type: "phase",
    agents: [],
    ...(context_template !== undefined ? { context_template } : {}),
  };
}

function make_http(id: string): WorkflowNodeDefinition {
  return { node_id: id, title: id, node_type: "http", url: "https://example.com", method: "GET" };
}

function make_trigger(id: string): WorkflowNodeDefinition {
  return { node_id: id, title: id, node_type: "trigger", trigger_type: "manual" };
}

function make_code(id: string): WorkflowNodeDefinition {
  return { node_id: id, title: id, node_type: "code", language: "javascript", code: "return 1;" };
}

// ── 빈 입력 ──────────────────────────────────────────────────────────────────

describe("audit_workflow_nodes — 빈 노드 목록", () => {
  it("빈 배열 → passed: true, violations 없음", () => {
    const r = audit_workflow_nodes([]);
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
    expect(r.agent_node_ratio).toBe(0);
  });
});

// ── agent_heavy ───────────────────────────────────────────────────────────────

describe("audit_workflow_nodes — agent_heavy 위반", () => {
  it("phase 100% (trigger + phase만) → agent_heavy [major]", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_phase("p1"), make_phase("p2")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "agent_heavy")).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("phase 50% (한도 정확히) → agent_heavy 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_http("h"), make_phase("p")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "agent_heavy")).toBe(false);
  });

  it("agent_node_ratio 값 정확히 계산", () => {
    const nodes: WorkflowNodeDefinition[] = [make_phase("p"), make_http("h"), make_http("h2"), make_http("h3")];
    const r = audit_workflow_nodes(nodes);
    expect(r.agent_node_ratio).toBeCloseTo(0.25);
  });
});

// ── no_direct_nodes ───────────────────────────────────────────────────────────

describe("audit_workflow_nodes — no_direct_nodes 위반", () => {
  it("phase만 있고 http/code 없음 → no_direct_nodes [minor]", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_phase("p")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "no_direct_nodes")).toBe(true);
  });

  it("http 노드 있으면 no_direct_nodes 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_phase("p"), make_http("h")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "no_direct_nodes")).toBe(false);
  });

  it("code 노드 있으면 no_direct_nodes 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_phase("p"), make_code("c")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "no_direct_nodes")).toBe(false);
  });
});

// ── missing_entry_point ───────────────────────────────────────────────────────

describe("audit_workflow_nodes — missing_entry_point 위반", () => {
  it("trigger 없음 → missing_entry_point [minor]", () => {
    const nodes: WorkflowNodeDefinition[] = [make_http("h"), make_phase("p")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "missing_entry_point")).toBe(true);
  });

  it("trigger 있으면 missing_entry_point 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_http("h")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "missing_entry_point")).toBe(false);
  });

  it("require_entry_point=false 이면 검사 안 함", () => {
    const policy: WorkflowCompilerPolicy = { ...DEFAULT_COMPILER_POLICY, require_entry_point: false };
    const nodes: WorkflowNodeDefinition[] = [make_http("h"), make_phase("p")];
    const r = audit_workflow_nodes(nodes, policy);
    expect(r.violations.some((v) => v.code === "missing_entry_point")).toBe(false);
  });
});

// ── inline_role_prompt ────────────────────────────────────────────────────────

describe("audit_workflow_nodes — inline_role_prompt 위반", () => {
  it("context_template 300자 초과 → inline_role_prompt [minor]", () => {
    const long_prompt = "A".repeat(301);
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_phase("p", long_prompt), make_http("h")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "inline_role_prompt")).toBe(true);
  });

  it("context_template 정확히 300자 → 위반 없음", () => {
    const ok_prompt = "A".repeat(300);
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_phase("p", ok_prompt), make_http("h")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "inline_role_prompt")).toBe(false);
  });

  it("context_template 없는 phase → 위반 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_phase("p"), make_http("h")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "inline_role_prompt")).toBe(false);
  });
});

// ── 통과 케이스 ───────────────────────────────────────────────────────────────

describe("audit_workflow_nodes — 정상 워크플로우 통과", () => {
  it("trigger + http + phase(≤50%) → passed: true, violations 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_http("h1"), make_http("h2"), make_phase("p")];
    const r = audit_workflow_nodes(nodes);
    expect(r.passed).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
});

// ── fanout helpers ────────────────────────────────────────────────────────────

function make_fanout(id: string, reconcile_node_id: string): WorkflowNodeDefinition {
  return {
    node_id: id,
    title: id,
    node_type: "fanout",
    branches: [{ branch_id: "b1", node_ids: ["n1"] }],
    reconcile_node_id,
  } as WorkflowNodeDefinition;
}

function make_reconcile(id: string): WorkflowNodeDefinition {
  return {
    node_id: id,
    title: id,
    node_type: "reconcile",
    source_node_ids: ["b1"],
    policy: "majority_vote",
  } as WorkflowNodeDefinition;
}

// ── fanout_without_reconcile ───────────────────────────────────────────────────

describe("audit_workflow_nodes — fanout_without_reconcile 위반", () => {
  it("fanout만 있고 대응 reconcile 없음 → fanout_without_reconcile [major]", () => {
    const nodes: WorkflowNodeDefinition[] = [
      make_trigger("t"),
      make_fanout("f1", "missing_reconcile"),
    ];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "fanout_without_reconcile")).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("fanout + 대응 reconcile 존재 → 위반 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [
      make_trigger("t"),
      make_fanout("f1", "rec1"),
      make_reconcile("rec1"),
    ];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "fanout_without_reconcile")).toBe(false);
  });

  it("require_fanout_reconcile=false 이면 검사 안 함", () => {
    const policy: WorkflowCompilerPolicy = { ...DEFAULT_COMPILER_POLICY, require_fanout_reconcile: false };
    const nodes: WorkflowNodeDefinition[] = [
      make_trigger("t"),
      make_fanout("f1", "not_existing"),
    ];
    const r = audit_workflow_nodes(nodes, policy);
    expect(r.violations.some((v) => v.code === "fanout_without_reconcile")).toBe(false);
  });

  it("여러 fanout 중 일부만 reconcile 없음 → 해당 fanout만 위반", () => {
    const nodes: WorkflowNodeDefinition[] = [
      make_trigger("t"),
      make_fanout("f1", "rec1"),   // OK
      make_fanout("f2", "missing"), // 위반
      make_reconcile("rec1"),
    ];
    const r = audit_workflow_nodes(nodes);
    const violations = r.violations.filter((v) => v.code === "fanout_without_reconcile");
    expect(violations).toHaveLength(1);
    expect(violations[0].detail).toContain("f2");
  });

  it("fanout 없으면 fanout_without_reconcile 없음", () => {
    const nodes: WorkflowNodeDefinition[] = [make_trigger("t"), make_http("h"), make_phase("p")];
    const r = audit_workflow_nodes(nodes);
    expect(r.violations.some((v) => v.code === "fanout_without_reconcile")).toBe(false);
  });
});

// ── fanout + reconcile 정상 워크플로우 통과 ───────────────────────────────────

describe("audit_workflow_nodes — fanout+reconcile 정상 워크플로우", () => {
  it("trigger + fanout + reconcile + phase(≤50%) → passed: true", () => {
    const nodes: WorkflowNodeDefinition[] = [
      make_trigger("t"),
      make_fanout("f1", "rec1"),
      make_reconcile("rec1"),
      make_http("h1"),
    ];
    const r = audit_workflow_nodes(nodes);
    expect(r.passed).toBe(true);
    expect(r.violations.some((v) => v.code === "fanout_without_reconcile")).toBe(false);
  });
});
