# Example: General Skill

A baseline general skill example. Use as a template for creating new builtin skills in `src/skills/`.

## SKILL.md Template

```yaml
---
name: my-skill
description: One-sentence summary. Use when: <trigger conditions>. Do NOT use when: <exclusions>.
metadata:
  model: remote
  tools:
    - exec
    - Bash
  triggers:
    - keyword-one
    - keyword-two
  aliases:
    - alt-name
---

# My Skill

## Quick Reference

| Task | Approach |
|------|----------|
| Core use case | Brief command or instruction |
| Secondary use case | Brief command or instruction |

## Workflow

1. Gather context
2. Execute core logic
3. Return result

For edge cases: [references/edge-cases.md](references/edge-cases.md)

## Guardrails

- NEVER do dangerous thing A
- ALWAYS validate input before writing
```

## What Makes This Good

| Property | How |
|----------|-----|
| Focused description | Answers What + When + When NOT |
| Progressive disclosure | Details in `references/`, Quick Reference in body |
| Explicit tools | All tools declared in `metadata.tools` |
| Guardrails | Safety rules stated explicitly |
| Body length | Under 100 lines for this level of detail |

## Common Mistakes

- Putting "When to Use" section in body instead of `description`
- Declaring too many tools (declare only what is actually called)
- Writing a 1000-line body instead of splitting to `references/`
