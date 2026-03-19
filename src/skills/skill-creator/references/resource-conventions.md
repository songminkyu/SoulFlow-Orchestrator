# Resource / Reference Conventions

Rules for naming and using `references/` and `resources/` directories in skills.

## Directory Semantics

| Directory | Used in | Purpose | Loaded |
|-----------|---------|---------|--------|
| `references/` | Any skill | Detailed docs, protocols, checklists | On demand (agent reads when needed) |
| `resources/` | Role skills only (`src/skills/roles/`) | Execution protocols, soul/heart files | On demand |
| `scripts/` | Builtin skills | Deterministic executables | Executed as black-box |
| `assets/` | Builtin skills | Templates, images used in output | Not read -- used in output |

## `references/` Naming

| Pattern | Example | Use |
|---------|---------|-----|
| `{topic}.md` | `oauth.md` | Domain reference for a specific topic |
| `{topic}-spec.md` | `frontmatter-spec.md` | Formal specification |
| `{topic}-patterns.md` | `body-patterns.md` | Verified patterns / anti-patterns |
| `{topic}-protocol.md` | `report-format-protocol.md` | Step-by-step procedure |
| `{topic}-checklist.md` | `phase-gates.md` | Gate criteria / checklists |
| `{topic}-guide.md` | `difficulty-guide.md` | Decision guide |

## Progressive Disclosure

Skill content follows three disclosure levels:

```
Level 1: description (frontmatter)   ~100 words -- trigger decision
Level 2: SKILL.md body              <500 lines  -- task execution
Level 3: references/                unlimited   -- deep detail on demand
```

Move content to `references/` when:
- It is not needed for every invocation
- It is longer than ~30 lines
- It is cited from multiple skills (shared reference)

Link from SKILL.md body:

```markdown
For full field specification: [references/frontmatter-spec.md](references/frontmatter-spec.md)
```

## `resources/` in Role Skills

Role skills use `resources/` instead of `references/` for:
- `execution-protocol.md` -- step-by-step role execution
- `SOUL.md` -- persona and tone definition

```
src/skills/roles/concierge/
SKILL.md
resources/
    execution-protocol.md
```

Never mix `resources/` into non-role skills. Use `references/` instead.

## File Limits

| Concern | Rule |
|---------|------|
| File count per skill | No hard limit; keep scannable |
| File size | No hard limit; split at natural topic boundaries |
| Nesting | Max 1 level deep (no `references/subdir/`) |
| Binary files | Place in `assets/`; never in `references/` |

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| `references/README.md` | Redundant wrapper | Rename to the topic it describes |
| `references/FULL_SPEC.md` with 2000 lines | Cannot be scanned | Split by topic |
| Inline 300-line protocol in SKILL.md body | Bloats context on every load | Move to `references/protocol.md` |
| `resources/` in a builtin (non-role) skill | Convention mismatch | Rename to `references/` |
| Empty `references/` directory | Violation -- no empty dirs | Remove the directory |
