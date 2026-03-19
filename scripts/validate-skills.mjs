#!/usr/bin/env node
/**
 * Skill Authoring Validator (SA-4)
 *
 * Checks every SKILL.md in a target directory against the common schema rules.
 * Exits with code 1 if any violations are found.
 *
 * Usage:
 *   node scripts/validate-skills.mjs src/skills/
 *   node scripts/validate-skills.mjs .claude/skills/
 *   node scripts/validate-skills.mjs src/skills/ --json
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, resolve } from "node:path";
import { argv, exit, cwd } from "node:process";

const [, , targetArg, ...cliFlags] = argv;
const jsonMode = cliFlags.includes("--json");

if (!targetArg) {
  console.error("Usage: node scripts/validate-skills.mjs <directory> [--json]");
  exit(1);
}

const rootDir = resolve(cwd(), targetArg);
if (!existsSync(rootDir)) {
  console.error("Directory not found: " + rootDir);
  exit(1);
}

/**
 * Parses the YAML frontmatter block from a SKILL.md file.
 * Returns { frontmatter, body, hasFrontmatter, yamlBlock }
 */
function parseFrontmatter(content) {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content, hasFrontmatter: false, yamlBlock: "" };
  }
  const endIdx = content.indexOf("\n---", 3);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content, hasFrontmatter: false, yamlBlock: "" };
  }
  const yamlBlock = content.slice(4, endIdx).trim();
  const body = content.slice(endIdx + 4).trim();
  const frontmatter = {};
  for (const line of yamlBlock.split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (m) {
      const val = m[2].trim();
      frontmatter[m[1]] = (val === "" || val === "|" || val === ">-") ? null : val;
    }
  }
  return { frontmatter, body, hasFrontmatter: true, yamlBlock };
}

/** @returns {Array<{code:string,severity:string,message:string}>} */
function checkSchema(content) {
  const violations = [];
  const { frontmatter, body, hasFrontmatter, yamlBlock } = parseFrontmatter(content);

  // SA-1: name required
  if (hasFrontmatter && !frontmatter["name"]) {
    violations.push({ code: "missing-name", severity: "error", message: "Frontmatter missing required `name` field" });
  }
  // SA-1: description required
  if (hasFrontmatter && !frontmatter["description"]) {
    violations.push({ code: "missing-description", severity: "error", message: "Frontmatter missing required `description` field" });
  }
  // SA-1: description must not use >- block scalar
  if (yamlBlock && /description\s*:\s*>-/.test(yamlBlock)) {
    violations.push({ code: "multiline-description", severity: "error", message: "description must be a single line -- `>-` block scalar not supported" });
  }
  // SA-1: name must be kebab-case
  const name = frontmatter["name"];
  if (name && typeof name === "string") {
    const clean = name.replace(/^role:/, "");
    if (!/^[a-z][a-z0-9-]*$/.test(clean)) {
      violations.push({ code: "invalid-name", severity: "error", message: "name `" + name + "` must be lowercase kebab-case" });
    }
  }
  // SA-1: body max 500 lines
  const lines = body.split("\n").length;
  if (lines > 500) {
    violations.push({ code: "body-too-long", severity: "warning", message: "Body is " + lines + " lines (limit: 500) -- move content to references/" });
  }
  // SA-1: no When to Use section in body
  if (/^#+\s*when to use/im.test(body)) {
    violations.push({ code: "when-to-use-in-body", severity: "warning", message: "`## When to Use` section in body -- move to `description` frontmatter field" });
  }
  return violations;
}

/** @returns {Array<{code:string,severity:string,message:string}>} */
function checkDirectoryConventions(skillDir) {
  const violations = [];
  const relPath = relative(cwd(), skillDir).split("\\").join("/");
  const isTaskSkill = relPath.startsWith(".claude");

  // SA-3: no empty subdirectories
  for (const sub of ["references", "resources", "scripts", "assets"]) {
    const subPath = join(skillDir, sub);
    if (existsSync(subPath)) {
      const entries = readdirSync(subPath).filter((f) => !f.startsWith("."));
      if (entries.length === 0) {
        violations.push({ code: "empty-directory", severity: "error", message: sub + "/ is empty -- remove it or add content" });
      }
    }
  }

  // SA-2: assets/ and scripts/ not recommended in .claude/skills/
  if (isTaskSkill) {
    for (const dir of ["assets", "scripts"]) {
      if (existsSync(join(skillDir, dir))) {
        violations.push({ code: "task-skill-forbidden-dir", severity: "warning", message: dir + "/ not recommended in .claude/skills/ -- use inline examples instead" });
      }
    }
  }

  return violations;
}

/** Walks a skills root and finds all SKILL.md files. */
function findSkillFiles(dir) {
  const out = [];
  function walk(cur, depth) {
    if (depth > 3) return;
    for (const entry of readdirSync(cur)) {
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const full = join(cur, entry);
      if (statSync(full).isDirectory()) walk(full, depth + 1);
      else if (entry === "SKILL.md") out.push(full);
    }
  }
  walk(dir, 0);
  return out;
}

const skillFiles = findSkillFiles(rootDir);
if (skillFiles.length === 0) {
  console.warn("No SKILL.md files found in " + rootDir);
  exit(0);
}

const results = [];
let errorCount = 0;
let warningCount = 0;

for (const skillPath of skillFiles) {
  // strip trailing /SKILL.md (cross-platform)
  const skillDir = skillPath.slice(0, skillPath.length - "/SKILL.md".length);
  const skillName = basename(skillDir);
  const content = readFileSync(skillPath, "utf-8");
  const violations = [...checkSchema(content), ...checkDirectoryConventions(skillDir)];
  results.push({ skill: skillName, path: relative(cwd(), skillPath).split("\\").join("/"), violations });
  errorCount += violations.filter((v) => v.severity === "error").length;
  warningCount += violations.filter((v) => v.severity === "warning").length;
}

if (jsonMode) {
  console.log(JSON.stringify({ results, errorCount, warningCount }, null, 2));
} else {
  let hasIssues = false;
  for (const { path, violations } of results) {
    if (violations.length === 0) continue;
    hasIssues = true;
    console.log("\n" + path);
    for (const v of violations) {
      console.log("  [" + (v.severity === "error" ? "X" : "!") + "] [" + v.code + "] " + v.message);
    }
  }
  if (!hasIssues) console.log("All " + skillFiles.length + " skills passed (" + rootDir + ")");
  console.log("\nSummary: " + skillFiles.length + " skills | " + errorCount + " errors | " + warningCount + " warnings");
}

if (errorCount > 0) exit(1);
