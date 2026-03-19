# Common Skill Schema

All skills -- whether in `src/skills/` (builtin) or `.claude/skills/` (task) -- share this minimum schema.

## Required Sections

Every `SKILL.md` must contain:

| Section | Location | Purpose |
|---------|----------|---------|
| YAML frontmatter | Top of file, fenced by `---` | Routing metadata |
| `name` field | Inside frontmatter | Unique kebab-case identifier |
| `description` field | Inside frontmatter | Primary trigger -- one line, no `>-` block scalar |
| Body | After frontmatter | Instructions for the executing agent |

### Minimum Frontmatter

```yaml
---
name: my-skill
description: One-sentence purpose. Use when: <conditions>. Do NOT use when: <exclusions>.
---
```

### Full Frontmatter (with metadata)

```yaml
---
name: my-skill
description: One-sentence purpose. Use when: <conditions>. Do NOT use when: <exclusions>.
metadata:
  model: local | remote
  tools:
    - exec
    - Bash
  triggers:
    - keyword
  aliases:
    - alt-name
---
```

## Metadata Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | `"local"` or `"remote"` | No | Execution model requirement |
| `always` | `boolean` | No | Auto-load into every conversation when `true` |
| `tools` | `string[]` | No | Tools the skill uses -- must be exhaustive |
| `triggers` | `string[]` | No | Keyword matching hints (supplement description) |
| `aliases` | `string[]` | No | Alternative names for the skill |
| `type` | `string` | No | Skill category (e.g., `"role"`) |

## Body Constraints

| Constraint | Limit |
|------------|-------|
| Maximum body length | 500 lines |
| Detailed content | Move to `references/` with inline link |
| "When to Use" sections | Forbidden -- belongs in `description` |
| README.md files | Forbidden -- integrate into SKILL.md |
| Empty directories | Forbidden -- only create dirs with content |

## Directory Layout

```
skill-name/
SKILL.md              (required)
scripts/              (optional -- deterministic executables)
references/           (optional -- detailed docs, loaded on demand)
assets/               (optional -- templates, images)
```

`resources/` is used only in role skills (under `src/skills/roles/`) for execution protocols and soul files.

## Name Conventions

- Builtin skills: `kebab-case` (e.g., `github`, `file-maker`)
- Role skills: `role:<name>` (e.g., `role:concierge`)
- Task skills (`.claude/skills/`): `kebab-case` without prefix
- No spaces, no uppercase, no underscores in the part after `role:`

## Description Rules

1. Maximum one line (no multiline block scalars)
2. Must answer: What? When to use? When NOT to use?
3. Include action verbs ("Create", "Analyze", "Interact")
4. Exclusions prevent false positives -- be explicit

## Validation

Run the validator to check schema compliance:

```bash
node scripts/validate-skills.mjs src/skills/
node scripts/validate-skills.mjs .claude/skills/
```

Full lint rules: See [validate-skills.mjs](../../../scripts/validate-skills.mjs)
