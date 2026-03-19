/** PAR-4: Fanout (병렬 팬아웃) 노드 핸들러. */

import type { NodeHandler } from "../node-registry.js";
import type { FanoutNodeDefinition, OrcheNodeDefinition } from "../workflow-node.types.js";
import type { OrcheNodeExecutorContext, OrcheNodeExecuteResult, OrcheNodeTestResult } from "../orche-node-executor.js";
import {
  build_parallel_envelope,
  type ParallelAgentResult,
} from "../../orchestration/parallel-contracts.js";

export const fanout_handler: NodeHandler = {
  node_type: "fanout",
  icon: "⑂",
  color: "#1976d2",
  shape: "diamond",
  output_schema: [
    { name: "branch_results",    type: "object",  description: "브랜치별 실행 결과 맵 (branch_id → 마지막 노드 결과)" },
    { name: "source_node_ids",   type: "array",   description: "reconcile 노드에 전달할 브랜치 ID 목록" },
    { name: "succeeded",         type: "number",  description: "성공한 브랜치 수" },
    { name: "failed",            type: "number",  description: "실패한 브랜치 수" },
  ],
  input_schema: [
    { name: "branches",          type: "array",  description: "동시 실행할 브랜치 정의 목록" },
    { name: "reconcile_node_id", type: "string", description: "수렴 노드 ID (ReconcileNode)" },
  ],
  create_default: () => ({
    branches: [],
    reconcile_node_id: "",
  }),

  async execute(node: OrcheNodeDefinition, ctx: OrcheNodeExecutorContext): Promise<OrcheNodeExecuteResult> {
    const n = node as FanoutNodeDefinition;

    if (!n.branches?.length) {
      return {
        output: {
          branch_results: {},
          source_node_ids: [],
          succeeded: 0,
          failed: 0,
          error: "fanout: branches is empty",
        },
      };
    }

    const max_concurrency = n.max_concurrency ?? n.branches.length;
    const timeout_ms = n.branch_timeout_ms;

    // 브랜치를 max_concurrency 단위로 배치 실행
    const results: ParallelAgentResult[] = [];
    const branch_results: Record<string, unknown> = {};

    for (let i = 0; i < n.branches.length; i += max_concurrency) {
      const batch = n.branches.slice(i, i + max_concurrency);
      const batch_promises = batch.map((branch) =>
        run_branch(branch.branch_id, branch.node_ids, ctx, timeout_ms),
      );
      const batch_results = await Promise.all(batch_promises);
      for (const r of batch_results) {
        results.push(r);
        branch_results[r.agent_id] = r.error
          ? { error: r.error }
          : (r.parsed ?? r.content);
      }
    }

    const envelope = build_parallel_envelope(
      n.branches.map((b) => b.branch_id),
      results,
    );

    // branch_results를 memory에 기록: reconcile 노드가 source_node_ids로 읽을 수 있도록
    for (const [branch_id, result] of Object.entries(branch_results)) {
      ctx.memory[branch_id] = result;
    }

    return {
      output: {
        branch_results,
        source_node_ids: n.branches.map((b) => b.branch_id),
        succeeded: envelope.succeeded,
        failed: envelope.failed,
      },
    };
  },

  test(node: OrcheNodeDefinition, _ctx: OrcheNodeExecutorContext): OrcheNodeTestResult {
    const n = node as FanoutNodeDefinition;
    const warnings: string[] = [];

    if (!n.branches?.length) {
      warnings.push("branches is empty");
    }
    if (!n.reconcile_node_id?.trim()) {
      warnings.push("reconcile_node_id is required");
    }

    // 브랜치 ID 중복 검사
    const ids = (n.branches ?? []).map((b) => b.branch_id);
    const unique = new Set(ids);
    if (unique.size < ids.length) {
      warnings.push("duplicate branch_id detected");
    }

    // node_ids가 비어있는 브랜치 경고
    for (const branch of n.branches ?? []) {
      if (!branch.node_ids?.length) {
        warnings.push(`branch "${branch.branch_id}" has no node_ids`);
      }
    }

    return {
      preview: {
        branch_count: n.branches?.length ?? 0,
        reconcile_node_id: n.reconcile_node_id,
        max_concurrency: n.max_concurrency ?? n.branches?.length ?? 0,
      },
      warnings,
    };
  },
};

// ── Internal ─────────────────────────────────────────────────────────

/**
 * 단일 브랜치 실행.
 * node_ids 목록의 마지막 노드 결과를 ParallelAgentResult로 반환.
 * 브랜치 내부 노드들은 memory를 통해 순차 연결 — 각 노드 결과가 memory에 기록되어 있다고 가정.
 */
async function run_branch(
  branch_id: string,
  node_ids: string[],
  ctx: OrcheNodeExecutorContext,
  timeout_ms?: number,
): Promise<ParallelAgentResult> {
  if (!node_ids.length) {
    return { agent_id: branch_id, content: null, error: `branch "${branch_id}" has no node_ids` };
  }

  const last_id = node_ids[node_ids.length - 1];

  try {
    if (timeout_ms !== undefined && timeout_ms > 0) {
      const result = await Promise.race([
        resolve_branch_result(branch_id, last_id, ctx),
        new Promise<ParallelAgentResult>((_, reject) =>
          setTimeout(() => reject(new Error(`branch timeout: ${branch_id}`)), timeout_ms),
        ),
      ]);
      return result;
    }
    return await resolve_branch_result(branch_id, last_id, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { agent_id: branch_id, content: null, error: message };
  }
}

/**
 * memory에서 last_node_id의 결과를 읽어 ParallelAgentResult로 변환.
 * 브랜치 노드들이 이미 실행된 상태여야 한다 (phase-workflow가 위상 정렬 실행 보장).
 */
async function resolve_branch_result(
  branch_id: string,
  last_node_id: string,
  ctx: OrcheNodeExecutorContext,
): Promise<ParallelAgentResult> {
  const value = ctx.memory[last_node_id];
  if (value === undefined || value === null) {
    return {
      agent_id: branch_id,
      content: null,
      error: `branch "${branch_id}" last node "${last_node_id}" has no result in memory`,
    };
  }
  if (typeof value === "string") {
    return { agent_id: branch_id, content: value };
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const content = typeof obj["content"] === "string" ? obj["content"] : null;
    const parsed = obj["parsed"] ?? obj;
    const error = typeof obj["error"] === "string" ? obj["error"] : undefined;
    return { agent_id: branch_id, content, parsed, ...(error ? { error } : {}) };
  }
  return { agent_id: branch_id, content: String(value) };
}
