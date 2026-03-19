/**
 * K4: SemanticScorerPort 통합 테스트
 *
 * 목표:
 * - SemanticScorerPort 계약 및 어댑터 검증
 * - ToolIndex.set_semantic_scorer() — scorer 없을 때 기존 동작 유지
 * - ToolIndex.set_semantic_scorer() — scorer 있을 때 ranking augmentation
 * - SkillIndex.set_semantic_scorer() / select_async() 동일 검증
 * - HybridPolicySemanticScorer TR-3 연결 계약
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NoOpSemanticScorer,
  HybridPolicySemanticScorer,
  apply_semantic_deltas,
} from "@src/orchestration/semantic-scorer-port.js";
import type { SemanticScorerPort } from "@src/orchestration/semantic-scorer-port.js";
import { ToolIndex } from "@src/orchestration/tool-index.js";
import { SkillIndex } from "@src/orchestration/skill-index.js";
import type { ToolSchema } from "@src/agent/tools/types.js";
import type { SkillMetadata } from "@src/agent/skills.types.js";
import type { HybridRetrievalPolicy } from "@src/search/hybrid-retrieval-policy.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, rmSync } from "node:fs";

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function make_tool(name: string, desc: string): ToolSchema {
  return { function: { name, description: desc, parameters: { type: "object", properties: {} } } };
}

function make_skill(name: string, overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    path: `/skills/${name}/SKILL.md`,
    source: "builtin_skills",
    type: "tool",
    always: false,
    summary: overrides.summary ?? `${name} skill`,
    aliases: overrides.aliases ?? [],
    triggers: overrides.triggers ?? [],
    tools: [],
    requirements: [],
    model: null,
    frontmatter: {},
    role: null,
    soul: null,
    heart: null,
    shared_protocols: [],
    preferred_providers: [],
    oauth: [],
    intents: overrides.intents ?? [],
    file_patterns: overrides.file_patterns ?? [],
    code_patterns: overrides.code_patterns ?? [],
    checks: [],
    project_docs: false,
    ...overrides,
    name,
  };
}

const MOCK_TOOLS: ToolSchema[] = [
  make_tool("read_file", "Read file contents from disk"),
  make_tool("write_file", "Write contents to a file"),
  make_tool("web_search", "Search the web for information"),
  make_tool("exec", "Execute shell commands"),
  make_tool("message", "Send a message to the user"),
];

const MOCK_CATS: Record<string, string> = {
  read_file: "file",
  write_file: "file",
  web_search: "web",
  exec: "shell",
  message: "messaging",
};

const MOCK_SKILLS: SkillMetadata[] = [
  make_skill("file-maker", { summary: "PDF, DOCX 문서 생성", triggers: ["PDF", "보고서"] }),
  make_skill("sandbox", { summary: "파이썬 코드 실행", triggers: ["python", "코드"] }),
  make_skill("github", { summary: "GitHub PR 관리", triggers: ["github", "commit"] }),
];

// ── NoOpSemanticScorer ────────────────────────────────────────────────────────

describe("NoOpSemanticScorer", () => {
  it("항상 빈 배열 반환", async () => {
    const scorer = new NoOpSemanticScorer();
    const result = await scorer.score("query", ["tool_a", "tool_b"]);
    expect(result).toEqual([]);
  });

  it("빈 candidates → 빈 배열", async () => {
    const scorer = new NoOpSemanticScorer();
    const result = await scorer.score("query", []);
    expect(result).toEqual([]);
  });
});

// ── apply_semantic_deltas ─────────────────────────────────────────────────────

describe("apply_semantic_deltas", () => {
  it("빈 deltas → 원본 맵 그대로 반환", () => {
    const scores = new Map([["a", 5.0], ["b", 3.0]]);
    const result = apply_semantic_deltas(scores, []);
    expect(result).toBe(scores); // 동일 참조 (no-op)
  });

  it("delta 적용 → 점수 조정됨", () => {
    const scores = new Map([["a", 5.0], ["b", 3.0], ["c", 1.0]]);
    const deltas = [
      { id: "c", delta: 10.0 }, // c를 최상위로 부스트
      { id: "a", delta: -1.0 }, // a를 약간 페널티
    ];
    const result = apply_semantic_deltas(scores, deltas);
    expect(result.get("c")).toBe(11.0);
    expect(result.get("a")).toBe(4.0);
    expect(result.get("b")).toBe(3.0); // 변화 없음
  });

  it("원본 맵은 변경하지 않음 (immutable)", () => {
    const scores = new Map([["a", 5.0]]);
    const deltas = [{ id: "a", delta: 10.0 }];
    apply_semantic_deltas(scores, deltas);
    expect(scores.get("a")).toBe(5.0); // 원본 불변
  });

  it("맵에 없는 id → delta 기준으로 삽입", () => {
    const scores = new Map([["a", 5.0]]);
    const deltas = [{ id: "new_id", delta: 2.0 }];
    const result = apply_semantic_deltas(scores, deltas);
    expect(result.get("new_id")).toBe(2.0);
  });
});

// ── ToolIndex + SemanticScorerPort ────────────────────────────────────────────

describe("ToolIndex — SemanticScorerPort 통합", () => {
  let index: ToolIndex;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = join(tmpdir(), `test-tool-k4-${Date.now()}.db`);
    index = new ToolIndex();
    index.build(MOCK_TOOLS, MOCK_CATS, testDbPath);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) rmSync(testDbPath);
  });

  it("scorer 없을 때(null) → 기존 select 동작 유지", async () => {
    // set_semantic_scorer 호출 없음 — 기본값 null
    const results = await index.select("file search");
    expect(results instanceof Set).toBe(true);
    expect(results.size).toBeGreaterThan(0);
  });

  it("set_semantic_scorer(null) → no-op, 기존 동작 보존", async () => {
    index.set_semantic_scorer(null);
    const results = await index.select("file operations");
    expect(results instanceof Set).toBe(true);
  });

  it("NoOpSemanticScorer → 기존 동작과 동일한 결과", async () => {
    const baseline = await index.select("web search");

    index.set_semantic_scorer(new NoOpSemanticScorer());
    const with_noop = await index.select("web search");

    // NoOp scorer는 delta가 없으므로 결과가 같아야 함
    expect(with_noop).toEqual(baseline);
  });

  it("custom scorer → ranking augmentation 가능", async () => {
    // exec을 최상위로 부스트하는 mock scorer
    const mockScorer: SemanticScorerPort = {
      score: vi.fn(async (_query: string, candidates: string[]) => {
        return candidates.includes("exec")
          ? [{ id: "exec", delta: 1000.0 }]
          : [];
      }),
    };

    index.set_semantic_scorer(mockScorer);
    const results = await index.select("any query", { max_tools: 30 });

    // scorer가 호출되었는지 확인
    expect(mockScorer.score).toHaveBeenCalled();
    // exec이 포함되어 있는지 확인
    expect(results.has("exec")).toBe(true);
  });

  it("scorer 오류 → 기존 FTS5 결과로 폴백", async () => {
    const failingScorer: SemanticScorerPort = {
      score: async () => { throw new Error("scorer failure"); },
    };

    index.set_semantic_scorer(failingScorer);
    // 오류가 발생해도 예외가 전파되지 않아야 함
    await expect(index.select("file search")).resolves.toBeInstanceOf(Set);
  });

  it("set_semantic_scorer → null로 재설정 시 scorer 비활성화", async () => {
    const callCount = { count: 0 };
    const scorer: SemanticScorerPort = {
      score: async (_q, candidates) => {
        callCount.count++;
        return candidates.map((id, i) => ({ id, delta: i * 0.1 }));
      },
    };

    index.set_semantic_scorer(scorer);
    await index.select("test");
    const countAfterSet = callCount.count;

    index.set_semantic_scorer(null); // 비활성화
    await index.select("test");
    // null 재설정 후에는 scorer가 호출되지 않아야 함
    expect(callCount.count).toBe(countAfterSet);
  });
});

// ── SkillIndex + SemanticScorerPort ───────────────────────────────────────────

describe("SkillIndex — SemanticScorerPort 통합", () => {
  let index: SkillIndex;

  beforeEach(() => {
    index = new SkillIndex();
    index.build(MOCK_SKILLS);
  });

  afterEach(() => {
    index.close();
  });

  it("select() — scorer 없을 때 기존 sync 동작 유지", () => {
    const results = index.select("PDF 보고서", {}, 3);
    expect(results).toContain("file-maker");
  });

  it("select_async() — scorer 없을 때 select()와 동일 결과", async () => {
    const sync_result = index.select("PDF 보고서", {}, 3);
    const async_result = await index.select_async("PDF 보고서", {}, 3);
    expect(async_result).toEqual(sync_result);
  });

  it("select_async() — NoOpScorer → select()와 동일 결과", async () => {
    index.set_semantic_scorer(new NoOpSemanticScorer());
    const sync_result = index.select("코드 실행", {}, 3);
    const async_result = await index.select_async("코드 실행", {}, 3);
    expect(async_result).toEqual(sync_result);
  });

  it("select_async() — custom scorer → ranking augmentation", async () => {
    // github을 최상위로 부스트하는 mock scorer
    const mockScorer: SemanticScorerPort = {
      score: vi.fn(async (_query: string, candidates: string[]) => {
        return candidates.includes("github")
          ? [{ id: "github", delta: 1000.0 }]
          : [];
      }),
    };

    index.set_semantic_scorer(mockScorer);
    // "commit PR github"은 여러 스킬에 매칭 → FTS5 결과 > 0 → scorer 호출됨
    const results = await index.select_async("commit PR github 코드 실행", {}, 3);

    expect(mockScorer.score).toHaveBeenCalled();
    // delta 1000으로 github이 최상위가 되어야 함
    expect(results[0]).toBe("github");
  });

  it("select_async() — scorer 오류 → FTS5 결과로 폴백", async () => {
    const failingScorer: SemanticScorerPort = {
      score: async () => { throw new Error("scorer failure"); },
    };
    index.set_semantic_scorer(failingScorer);

    const fallback = await index.select_async("PDF 보고서", {}, 3);
    expect(Array.isArray(fallback)).toBe(true);
    expect(fallback.length).toBeGreaterThanOrEqual(0);
  });

  it("set_semantic_scorer(null) → scorer 비활성화 후 select_async()는 sync와 동일", async () => {
    const scorer: SemanticScorerPort = {
      score: vi.fn(async (_q, candidates) =>
        candidates.map((id, i) => ({ id, delta: i * 0.1 }))
      ),
    };
    index.set_semantic_scorer(scorer);
    index.set_semantic_scorer(null); // 비활성화

    const sync = index.select("코드 실행", {}, 3);
    const async_ = await index.select_async("코드 실행", {}, 3);
    expect(async_).toEqual(sync);
    expect(scorer.score).not.toHaveBeenCalled();
  });

  it("rebuild 후 select_async() — 새 스킬 반영", async () => {
    const new_skill = make_skill("slack-tool", {
      summary: "Slack 메시지 전송",
      triggers: ["slack", "메시지"],
    });
    index.build([...MOCK_SKILLS, new_skill]);

    const results = await index.select_async("slack에 메시지", {}, 3);
    expect(results).toContain("slack-tool");
  });
});

// ── HybridPolicySemanticScorer TR-3 연결 ─────────────────────────────────────

describe("HybridPolicySemanticScorer — TR-3 HybridRetrievalPolicy 연결", () => {
  it("policy.retrieve() 결과를 delta로 변환", async () => {
    // HybridRetrievalPolicy mock
    const mockPolicy: HybridRetrievalPolicy = {
      has_vector: true,
      retrieve: vi.fn(async (_query: string, _candidates: unknown[], limit: number) => {
        // 역순으로 반환 (c → b → a 순위)
        return ["c", "b", "a"].slice(0, limit);
      }),
    };

    const scorer = new HybridPolicySemanticScorer(mockPolicy);
    const deltas = await scorer.score("test query", ["a", "b", "c"]);

    expect(mockPolicy.retrieve).toHaveBeenCalled();
    // c가 1위이므로 가장 큰 delta
    const delta_c = deltas.find((d) => d.id === "c")?.delta ?? 0;
    const delta_a = deltas.find((d) => d.id === "a")?.delta ?? 0;
    expect(delta_c).toBeGreaterThan(delta_a);
  });

  it("policy.retrieve() 오류 → 빈 배열 반환 (예외 미전파)", async () => {
    const failingPolicy: HybridRetrievalPolicy = {
      has_vector: false,
      retrieve: async () => { throw new Error("policy failure"); },
    };

    const scorer = new HybridPolicySemanticScorer(failingPolicy);
    await expect(scorer.score("query", ["a", "b"])).resolves.toEqual([]);
  });

  it("빈 candidates → policy 미호출 + 빈 배열 반환", async () => {
    const mockPolicy: HybridRetrievalPolicy = {
      has_vector: true,
      retrieve: vi.fn(),
    };

    const scorer = new HybridPolicySemanticScorer(mockPolicy);
    const result = await scorer.score("query", []);
    expect(result).toEqual([]);
    expect(mockPolicy.retrieve).not.toHaveBeenCalled();
  });

  it("has_vector=false (lexical-only) policy도 scorer로 동작", async () => {
    const lexicalPolicy: HybridRetrievalPolicy = {
      has_vector: false,
      retrieve: vi.fn(async (_q, candidates) => candidates.map((c) => c.id)),
    };

    const scorer = new HybridPolicySemanticScorer(lexicalPolicy);
    const deltas = await scorer.score("query", ["x", "y"]);
    expect(Array.isArray(deltas)).toBe(true);
  });
});

// ── 회귀 테스트 — 기존 동작 보존 ─────────────────────────────────────────────

describe("회귀: 기존 ToolIndex/SkillIndex 동작 보존", () => {
  it("ToolIndex — set_semantic_scorer 없이 select() 정상 동작", async () => {
    const testDbPath = join(tmpdir(), `test-tool-regr-${Date.now()}.db`);
    const index = new ToolIndex();
    try {
      index.build(MOCK_TOOLS, MOCK_CATS, testDbPath);
      const results = await index.select("파일을 읽어줘");
      expect(results instanceof Set).toBe(true);
      // read_file은 core 도구이므로 항상 포함
      expect(results.has("read_file")).toBe(true);
    } finally {
      if (existsSync(testDbPath)) rmSync(testDbPath);
    }
  });

  it("SkillIndex — set_semantic_scorer 없이 select() 정상 동작", () => {
    const index = new SkillIndex();
    try {
      index.build(MOCK_SKILLS);
      const results = index.select("PDF 보고서 만들기", {}, 3);
      expect(results[0]).toBe("file-maker");
    } finally {
      index.close();
    }
  });

  it("ToolIndex — size getter 영향 없음", () => {
    const testDbPath = join(tmpdir(), `test-tool-size-${Date.now()}.db`);
    const index = new ToolIndex();
    try {
      index.build(MOCK_TOOLS, MOCK_CATS, testDbPath);
      index.set_semantic_scorer(new NoOpSemanticScorer());
      expect(index.size).toBe(MOCK_TOOLS.length);
    } finally {
      if (existsSync(testDbPath)) rmSync(testDbPath);
    }
  });

  it("SkillIndex — is_built getter 영향 없음", () => {
    const index = new SkillIndex();
    try {
      index.build(MOCK_SKILLS);
      index.set_semantic_scorer(new NoOpSemanticScorer());
      expect(index.is_built).toBe(true);
    } finally {
      index.close();
    }
  });
});
