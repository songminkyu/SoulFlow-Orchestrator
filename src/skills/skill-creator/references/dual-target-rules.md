# Dual-Target Authoring Rules

Skills live in two targets with different purposes. This document defines what is allowed and disallowed in each.

## Target Comparison

| Dimension | `src/skills/` (builtin) | `.claude/skills/` (task) |
|-----------|------------------------|--------------------------|
| Purpose | Reusable capability, all users | Session-scoped work instructions |
| Loader | SkillsLoader (runtime, code) | Claude Code (IDE, conversation) |
| Frontmatter | Full YAML with `metadata:` | Optional -- body-only is valid |
| Body length | up to 500 lines | 200 lines preferred |
| References | `references/` -- unlimited | Inline preferred; `references/` only if reused |
| Scripts | `scripts/` -- black-box executables | Avoid -- use inline Bash examples instead |
| Assets | `assets/` -- templates/images | Not used |
| Tools | Must declare in `tools:` | Optional; Claude Code has ambient access |
| Triggers | Required for routing | Not required -- used conversationally |
| Validation | `node scripts/validate-skills.mjs src/skills/` | `node scripts/validate-skills.mjs .claude/skills/` |

## What `src/skills/` Allows

- Full `metadata:` block with `model`, `tools`, `triggers`, `aliases`, `oauth`, `intents`, `code_patterns`, `checks`
- `scripts/` directory with self-contained executables
- `references/` for detailed docs loaded on demand
- `assets/` for templates reused across invocations
- Role subtypes: `metadata.type: role` + `resources/` for soul/protocol files

## What `.claude/skills/` Allows

- Minimal or no frontmatter (body-only SKILL.md is valid)
- Inline workflow steps and Bash examples
- `references/` only when the content is genuinely reusable across sessions

## Forbidden in Both Targets

- `description` using `>-` block scalar -- must be single line
- "When to Use This Skill" section in body (belongs in `description`)
- Empty directories
- `README.md` or `CHANGELOG.md` files
- `console.log` or debug artifacts committed to scripts

## Forbidden Only in `src/skills/`

- Hard-coded user IDs, team IDs, or workspace paths
- API keys or secrets (use `metadata.oauth` or `secret` tool)
- Logic that assumes a specific deployment environment

## Forbidden Only in `.claude/skills/`

- `scripts/` directories (overkill for session-scoped tasks)
- `assets/` directories
- `metadata.always: true` (auto-load is a builtin privilege)

## Decision: Which Target?

```
Is this a reusable capability for any user?
  YES -> src/skills/
  NO  -> Does it need tools/triggers routing?
          YES -> src/skills/
          NO  -> .claude/skills/
```

## Metadata Overlap Policy

The following fields are valid in both targets but have different weight:

| Field | src/skills/ | .claude/skills/ |
|-------|-------------|-----------------|
| `model` | Required when routing matters | Optional |
| `tools` | Required (permission scope) | Optional |
| `triggers` | Required for keyword routing | Ignored by Claude Code |
| `aliases` | Useful for disambiguation | Ignored |
