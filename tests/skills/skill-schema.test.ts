import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

// fileURLToPath handles Windows drive letters correctly (url.pathname gives /D:/... on Windows)
const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url)).replace(/[/]$/, "");
const VALIDATOR = join(PROJECT_ROOT, "scripts", "validate-skills.mjs");

function buildSkillContent(...lines: string[]): string {
  return lines.join("\n");
}

function runValidator(
  skillsMap: Record<string, string>,
  extraArgs: string[] = []
): { stdout: string; exitCode: number } {
  const tmpRoot = join(tmpdir(), "skill-test-" + randomUUID());
  mkdirSync(tmpRoot, { recursive: true });
  for (const [relPath, content] of Object.entries(skillsMap)) {
    const full = join(tmpRoot, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf-8");
  }
  try {
    const stdout = execFileSync("node", [VALIDATOR, tmpRoot, ...extraArgs], {
      encoding: "utf-8",
      cwd: PROJECT_ROOT,
    });
    return { stdout, exitCode: 0 };
  } catch (e: unknown) {
    const err = e as { stdout?: string; status?: number };
    return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// SA-1: common schema
describe("SA-1: common schema -- frontmatter parsing", () => {
  it("test_validator_validSkill_passes: valid SKILL.md passes", () => {
    const fm = buildSkillContent("---", "name: my-skill", "description: Does X. Use when Y.", "---", "# Body");
    const { exitCode, stdout } = runValidator({ "my-skill/SKILL.md": fm });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("passed");
  });
  it("test_validator_missingName_reportsError: missing name reports error", () => {
    const fm = buildSkillContent("---", "description: Does X.", "---", "# Body");
    const { exitCode, stdout } = runValidator({ "bad/SKILL.md": fm });
    expect(exitCode).toBe(1);
    expect(stdout).toContain("missing-name");
  });
  it("test_validator_missingDescription_reportsError: missing description reports error", () => {
    const fm = buildSkillContent("---", "name: bad-skill", "---", "# Body");
    const { exitCode, stdout } = runValidator({ "bad/SKILL.md": fm });
    expect(exitCode).toBe(1);
    expect(stdout).toContain("missing-description");
  });
  it("test_validator_blockScalarDescription_reportsError: >- block scalar reports error", () => {
    const fm = buildSkillContent("---", "name: bad-skill", "description: >-", "  Multi.", "---", "# Body");
    const { exitCode, stdout } = runValidator({ "bad/SKILL.md": fm });
    expect(exitCode).toBe(1);
    expect(stdout).toContain("multiline-description");
  });
  it("test_validator_invalidName_reportsError: UPPER_CASE name reports error", () => {
    const fm = buildSkillContent("---", "name: BadSkill", "description: Does X.", "---", "# Body");
    const { exitCode, stdout } = runValidator({ "BadSkill/SKILL.md": fm });
    expect(exitCode).toBe(1);
    expect(stdout).toContain("invalid-name");
  });
  it("test_validator_rolePrefixName_passes: role:name format passes", () => {
    const fm = buildSkillContent("---", "name: role:concierge", "description: Front desk. Use when X.", "---", "# C");
    const { exitCode } = runValidator({ "concierge/SKILL.md": fm });
    expect(exitCode).toBe(0);
  });
  it("test_validator_bodyTooLong_reportsWarning: body over 500 lines reports warning", () => {
    const longLines = Array.from({ length: 510 }, (_, i) => "line " + i);
    const longBody = longLines.join("\n");
    const fm = buildSkillContent("---", "name: long-skill", "description: Does X.", "---") + "\n" + longBody;
    const { exitCode, stdout } = runValidator({ "long/SKILL.md": fm });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("body-too-long");
  });
  it("test_validator_whenToUseInBody_reportsWarning: When to Use in body reports warning", () => {
    const fm = buildSkillContent("---", "name: misplaced", "description: Does X.", "---", "## When to Use", "Use it.");
    const { exitCode, stdout } = runValidator({ "mis/SKILL.md": fm });
    expect(exitCode).toBe(0);
    expect(stdout).toContain("when-to-use-in-body");
  });
  it("test_validator_noFrontmatter_passes: SKILL.md without frontmatter passes", () => {
    const fm = buildSkillContent("# Task Skill", "Instructions here.");
    const { exitCode, stdout } = runValidator({ "task/SKILL.md": fm });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("missing-name");
  });
});

// SA-2: dual-target rules
describe("SA-2: dual-target rules", () => {
  it("test_validator_emptyReferencesDir_reportsError: empty references/ reports error", () => {
    const tmpRoot = join(tmpdir(), "skill-dt-" + randomUUID());
    mkdirSync(join(tmpRoot, "my-skill", "references"), { recursive: true });
    writeFileSync(
      join(tmpRoot, "my-skill", "SKILL.md"),
      buildSkillContent("---", "name: my-skill", "description: X.", "---", "# B")
    );
    const { exitCode, stdout } = (() => {
      try {
        const out = execFileSync("node", [VALIDATOR, tmpRoot], { encoding: "utf-8", cwd: PROJECT_ROOT });
        return { stdout: out, exitCode: 0 };
      } catch (e: unknown) {
        const err = e as { stdout?: string; status?: number };
        return { stdout: err.stdout ?? "", exitCode: err.status ?? 1 };
      } finally {
        rmSync(tmpRoot, { recursive: true, force: true });
      }
    })();
    expect(exitCode).toBe(1);
    expect(stdout).toContain("empty-directory");
  });
  it("test_validator_jsonOutput_parseable: --json flag produces parseable output", () => {
    const fm = buildSkillContent("---", "name: ok-skill", "description: Works.", "---", "# B");
    const { exitCode, stdout } = runValidator({ "ok/SKILL.md": fm }, ["--json"]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout) as { results: unknown[]; errorCount: number };
    expect(parsed).toHaveProperty("errorCount");
    expect(parsed.errorCount).toBe(0);
  });
});

// SA-3: resource/reference conventions
describe("SA-3: resource/reference conventions", () => {
  it("test_resourceConventions_commonSchema_fileExists: common-schema.md exists", () => {
    expect(existsSync(join(PROJECT_ROOT, "src", "skills", "skill-creator", "references", "common-schema.md"))).toBe(true);
  });
  it("test_resourceConventions_dualTargetRules_fileExists: dual-target-rules.md exists", () => {
    expect(existsSync(join(PROJECT_ROOT, "src", "skills", "skill-creator", "references", "dual-target-rules.md"))).toBe(true);
  });
  it("test_resourceConventions_resourceConventions_fileExists: resource-conventions.md exists", () => {
    expect(existsSync(join(PROJECT_ROOT, "src", "skills", "skill-creator", "references", "resource-conventions.md"))).toBe(true);
  });
  it("test_resourceConventions_schemaHasRequiredSections: common-schema.md contains required sections", () => {
    const content = readFileSync(
      join(PROJECT_ROOT, "src", "skills", "skill-creator", "references", "common-schema.md"),
      "utf-8"
    );
    expect(content).toContain("## Required Sections");
    expect(content).toContain("## Directory Layout");
    expect(content).toContain("## Name Conventions");
    expect(content).toContain("## Description Rules");
  });
});

// SA-4: lint / validation script
describe("SA-4: lint / validation script", () => {
  it("test_validatorScript_fileExists: scripts/validate-skills.mjs exists", () => {
    expect(existsSync(VALIDATOR)).toBe(true);
  });
  it("test_validatorScript_runsOnSrcSkills_noErrors: src/skills/ validates with 0 errors", () => {
    const srcPath = join(PROJECT_ROOT, "src", "skills");
    let exitCode1 = 0;
    const out1 = (() => {
      try {
        return execFileSync("node", [VALIDATOR, srcPath, "--json"], { encoding: "utf-8", cwd: PROJECT_ROOT });
      } catch (e: unknown) {
        const err = e as { stdout?: string; status?: number };
        exitCode1 = err.status ?? 1;
        return err.stdout ?? "";
      }
    })();
    expect(exitCode1).toBe(0);
    expect((JSON.parse(out1) as { errorCount: number }).errorCount).toBe(0);
  });
  it("test_validatorScript_runsOnClaudeSkills_noErrors: .claude/skills/ validates with 0 errors", () => {
    const claudePath = join(PROJECT_ROOT, ".claude", "skills");
    let code2 = 0;
    const out2 = (() => {
      try {
        return execFileSync("node", [VALIDATOR, claudePath, "--json"], { encoding: "utf-8", cwd: PROJECT_ROOT });
      } catch (e: unknown) {
        const err = e as { stdout?: string; status?: number };
        code2 = err.status ?? 1;
        return err.stdout ?? "";
      }
    })();
    expect(code2).toBe(0);
    expect((JSON.parse(out2) as { errorCount: number }).errorCount).toBe(0);
  });
});
// SA-5: baseline examples
describe("SA-5: baseline examples", () => {
  it("test_baselineExample_generalSkillDoc_fileExists: example-general-skill.md exists", () => {
    expect(existsSync(join(PROJECT_ROOT, "src", "skills", "skill-creator", "references", "example-general-skill.md"))).toBe(true);
  });
  it("test_baselineExample_roleSkillDoc_fileExists: example-role-skill.md exists", () => {
    expect(existsSync(join(PROJECT_ROOT, "src", "skills", "skill-creator", "references", "example-role-skill.md"))).toBe(true);
  });
  it("test_baselineExample_taskSkillDir_fileExists: .claude/skills/example-task/SKILL.md exists", () => {
    expect(existsSync(join(PROJECT_ROOT, ".claude", "skills", "example-task", "SKILL.md"))).toBe(true);
  });
  it("test_baselineExample_githubSkill_passesValidator: actual github skill passes validator", () => {
    const { exitCode, stdout } = runValidator({
      "github-copy/SKILL.md": readFileSync(join(PROJECT_ROOT, "src", "skills", "github", "SKILL.md"), "utf-8"),
    });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain("missing-name");
    expect(stdout).not.toContain("missing-description");
  });
  it("test_baselineExample_generalExampleHasSchemaContent: baseline example contains name/description", () => {
    const content = readFileSync(
      join(PROJECT_ROOT, "src", "skills", "skill-creator", "references", "example-general-skill.md"),
      "utf-8"
    );
    expect(content).toContain("name:");
    expect(content).toContain("description:");
  });
});
