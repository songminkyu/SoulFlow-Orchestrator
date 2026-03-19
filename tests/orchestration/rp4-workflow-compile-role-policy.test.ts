/**
 * RP-4: workflow compile honors role policy.
 *
 * src/dashboard/ops/workflow.ts의 list_roles()가
 * create_prompt_profile_compiler 결과를 사용해 role 정보를 반영하는지 검증.
 *
 * 검증 포인트:
 * - role fixture -> list_roles() -> soul/heart/tools/use_when/rendered_prompt 반영
 * - rendered_prompt에 "# Role:" 헤더 포함
 * - skills_loader 없으면 빈 배열 반환
 */
import { describe, it, expect } from "vitest";
import { create_workflow_ops } from "@src/dashboard/ops/workflow.js";
import { HitlPendingStore } from "@src/orchestration/hitl-pending-store.js";
import type { SkillsLoader } from "@src/agent/skills.service.js";
import type { SkillMetadata } from "@src/agent/skills.types.js";
import type { PhaseWorkflowStoreLike } from "@src/agent/phase-workflow-store.js";
import type { SubagentRegistry } from "@src/agent/subagents.js";
import type { Logger } from "@src/logger.js";

// Fixture 헬퍼

function make_role_skill(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    name: "role:implementer",
    path: "d:/test/roles/implementer/SKILL.md",
    source: "builtin_skills",
    type: "role",
    always: false,
    summary: "코드 구현. Use when 스펙 확정된 코드 작성. Do NOT use for 설계, 리뷰.",
    aliases: [],
    triggers: [],
    tools: ["read_file", "write_file", "exec"],
    requirements: [],
    model: "remote",
    frontmatter: {},
    role: "implementer",
    soul: "항상 스펙을 먼저 읽는다.",
    heart: "반드시 빌드/테스트를 실행한 후 보고한다.",
    shared_protocols: [],
    preferred_providers: [],
    oauth: [],
    intents: [],
    file_patterns: [],
    code_patterns: [],
    checks: [],
    project_docs: false,
    ...overrides,
  };
}

function make_skills_loader(roles: SkillMetadata[]): SkillsLoader {
  return {
    list_role_skills: () => roles,
    list_skills: () => [],
    get_role_skill: (role: string) => roles.find((r) => r.role === role) ?? null,
    get_skill: () => null,
    get_protocol: () => null,
    list_protocols: () => [],
  } as unknown as SkillsLoader;
}

const NOOP_LOGGER: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as unknown as Logger;

const NOOP_STORE: PhaseWorkflowStoreLike = {
  list: async () => [],
  get: async () => null,
  upsert: async () => {},
  patch_settings: async () => {},
  insert_message: async () => {},
  get_messages: async () => [],
} as unknown as PhaseWorkflowStoreLike;

const NOOP_SUBAGENTS: SubagentRegistry = {
  spawn: async () => ({ subagent_id: "sub-1" }),
  cancel_by_parent_id: () => {},
  send_input: () => false,
  wait_for_completion: async () => null,
} as unknown as SubagentRegistry;

function make_deps(skills_loader?: SkillsLoader) {
  return {
    store: NOOP_STORE,
    subagents: NOOP_SUBAGENTS,
    workspace: "d:/test",
    logger: NOOP_LOGGER,
    skills_loader,
    hitl_pending_store: new HitlPendingStore(),
  };
}

// 테스트

describe("RP-4: list_roles — PromptProfileCompiler 통합", () => {
  it("soul/heart를 PromptProfile compile 결과에서 가져옴", () => {
    const ops = create_workflow_ops(make_deps(make_skills_loader([make_role_skill()])));
    const roles = ops.list_roles();

    expect(roles).toHaveLength(1);
    expect(roles[0].soul).toBe("항상 스펙을 먼저 읽는다.");
    expect(roles[0].heart).toBe("반드시 빌드/테스트를 실행한 후 보고한다.");
  });

  it("tools 목록이 PromptProfile에서 전달됨", () => {
    const ops = create_workflow_ops(
      make_deps(make_skills_loader([make_role_skill({ tools: ["read_file", "list_dir"] })])),
    );
    const roles = ops.list_roles();

    expect(roles[0].tools).toEqual(["read_file", "list_dir"]);
  });

  it("use_when/not_use_for가 summary에서 파싱됨", () => {
    const ops = create_workflow_ops(
      make_deps(make_skills_loader([make_role_skill({
        summary: "테스터. Use when 테스트 작성. Do NOT use for 배포, 설계.",
      })])),
    );
    const roles = ops.list_roles();

    expect(roles[0].use_when).toBe("테스트 작성");
    expect(roles[0].not_use_for).toBe("배포, 설계");
  });

  it("rendered_prompt에 # Role 헤더 + Soul/Heart 포함", () => {
    const ops = create_workflow_ops(make_deps(make_skills_loader([make_role_skill()])));
    const roles = ops.list_roles();

    expect(roles[0].rendered_prompt).not.toBeNull();
    expect(roles[0].rendered_prompt).toContain("# Role: implementer");
    expect(roles[0].rendered_prompt).toContain("Soul:");
    expect(roles[0].rendered_prompt).toContain("Heart:");
  });

  it("soul/heart null인 role → 빈 문자열 유지", () => {
    const ops = create_workflow_ops(
      make_deps(make_skills_loader([make_role_skill({ soul: null, heart: null })])),
    );
    const roles = ops.list_roles();

    expect(roles[0].soul).toBe("");
    expect(roles[0].heart).toBe("");
  });

  it("skills_loader 없으면 빈 배열 반환", () => {
    const ops = create_workflow_ops(make_deps(undefined));

    expect(ops.list_roles()).toEqual([]);
  });

  it("여러 role → 모두 compile 결과 반환", () => {
    const ops = create_workflow_ops(make_deps(make_skills_loader([
      make_role_skill({ role: "implementer", name: "role:implementer" }),
      make_role_skill({ role: "reviewer", name: "role:reviewer", soul: "꼼꼼히 검토한다." }),
    ])));
    const roles = ops.list_roles();

    expect(roles).toHaveLength(2);
    expect(roles.find((r) => r.id === "reviewer")?.soul).toBe("꼼꼼히 검토한다.");
  });

  it("preferred_model이 PromptProfile에서 전달됨", () => {
    const ops = create_workflow_ops(
      make_deps(make_skills_loader([make_role_skill({ model: "opus" })])),
    );
    const roles = ops.list_roles();

    expect(roles[0].preferred_model).toBe("opus");
  });
});
