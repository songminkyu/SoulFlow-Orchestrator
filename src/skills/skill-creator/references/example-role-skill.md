# Example: Role Skill

A baseline role skill example. Use as a template for creating new role skills in `src/skills/roles/`.

## SKILL.md Template

```yaml
---
name: role:my-role
description: One-line role summary. Use when: <task categories>. Do NOT use when: <non-role tasks>.
metadata:
  type: role
  role: my-role
  model: remote
  tools:
    - read_file
    - exec
    - spawn
    - memory
  soul: Brief persona summary from SOUL.md.
  heart: Tone and reporting style.
  shared_protocols:
    - clarification-protocol
    - session-metrics
---

# My Role

One-line role purpose.

## Responsibilities

| Domain | Action |
|--------|--------|
| Primary task type | What the role does |
| Secondary task type | Delegation or reporting |

## Delegation Decision

When to handle directly vs delegate:

1. Condition A -> Handle directly
2. Condition B -> Delegate to role:X
3. Condition C -> Escalate

## Execution Protocol

[resources/execution-protocol.md](resources/execution-protocol.md)
```

## Directory Layout

```
roles/my-role/
├── SKILL.md              (role definition, soul/heart inline)
├── resources/
    └── execution-protocol.md   (step-by-step workflow)
```

## Key Differences from General Skills

| Aspect | General Skill | Role Skill |
|--------|--------------|------------|
| name prefix | none | `role:` |
| metadata.type | absent | `"role"` |
| Directory for docs | `references/` | `resources/` |
| Soul/heart | not used | declared in `metadata` |
| Shared protocols | optional | use `shared_protocols` |
| spawn tool | rare | common (spawns sub-roles) |
