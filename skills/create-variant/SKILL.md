---
name: create-variant
description: >
  Guides creation of a new workspace variant (Phase A independent prototype).
  Use when: creating a new co-<name> variant, scaffolding a new domain-specific AI team.
status: active
scope: common
l2_propagate: false
version: 1.0.1
owner: pm
last_reviewed: 2026-06-05
metadata:
  type: process
  triggers:
    - create variant
    - new variant
    - create variant
    - variant creation
    - scaffold new variant
    - new co- project
---

# Skill: create-variant

## When to Use

Use this skill when creating a new workspace variant (e.g., co-safety, co-legal, co-finance).
A variant is a domain-specific AI team configuration built on the workspace common infrastructure.

**Prerequisites**:
- Workspace root access (`C:\git\`)
- `bun` installed (`bun --version`)
- `git` installed

---

## Phase A Process

### Step 0: Pre-flight checks

- [ ] Variant name is unique: check `Projects/` and `templates/` — no existing `co-<name>`
- [ ] Variant name format: lowercase, alphanumeric + hyphens only (e.g., `safety-os`, `legal-ai`)
- [ ] Domain type decided: `ehs` | `development` | `design` | `consulting` | `collaboration` | (custom)

### Step 1: Run scaffold script

```bash
# From workspace root C:\git\
bun scripts/create-l2-scaffold.ts <variant-name> --domain <type>

# Example:
bun scripts/create-l2-scaffold.ts safety-os --domain ehs
```

This creates `Projects/<variant-name>/` with:
- All common infrastructure (.claude/, .gemini/, scripts/, skills/)
- Git initialized + .githooks configured
- bun install complete
- stub files (_ORIGIN.md, variant.json, PROMOTION_CHECKLIST.md, etc.)

> **Fork Model**: After scaffold completes, L2 evolves independently from L1. L1 changes will NOT automatically propagate to this L2 project. To get L1 updates later, re-run `create-l2-scaffold.ts` or manually copy needed files. See [ADR-0031](../../docs/adr/0031-l1-l2-fork-model.md).

### Step 2: Add variant section to CLAUDE.md

Open `Projects/<variant-name>/CLAUDE.md` and add at the end:

```markdown
## <VariantName> Context

### Role Override: <Role Title>
[Describe how PM agent is overridden for this domain]

### Domain
[Describe the domain and applicable laws/standards]

### <VariantName> Lifecycle Rules
| Modified file(s) | Required follow-up actions |
|-----------------|---------------------------|
| [domain files] | [domain-specific checks] |

### Legal/Domain Disclaimer
[Appropriate disclaimer for the domain]
```

> **Reconcile survival**: This section makes CLAUDE.md differ from workspace root — required for Phase B pipeline.

### Step 3: Add identical section to GEMINI.md (Antigravity parity)

Copy the exact same `## <VariantName> Context` section to `GEMINI.md`.

> **P-01 parity**: CLAUDE.md and GEMINI.md must have identical heading structure.

**Antigravity coverage checklist** (verify before proceeding to Step 4):
- [ ] `Projects/<variant-name>/.gemini/commands/` — all commands mirrored from `.claude/commands/`
- [ ] `Projects/<variant-name>/.gemini/skills/` — all skills mirrored from `.claude/skills/`
- [ ] `Projects/<variant-name>/.gemini/settings.json` — exists with equivalent hooks
- [ ] `Projects/<variant-name>/GEMINI.md` — has identical `## <VariantName> Context` section
- [ ] `Projects/<variant-name>/agents/*.md` — each agent has **Section C: Antigravity Integration**

> ⚠️ **Antigravity is not optional**: Variants that skip Antigravity coverage will fail the Phase B platform parity check (PROMOTION_CHECKLIST Condition 5).

### Step 4: Clean AGENTS.md

`Projects/<variant-name>/AGENTS.md` was copied from workspace root — it contains workspace agents (auditor, lifecycle-manager, architect, etc.) that don't exist in this project.

- Remove all workspace agent table entries
- Keep the header and §PM Gateway Policy
- Add `## <VariantName> Agents` section with variant agent stubs

Verify:
```bash
cd Projects/<variant-name> && bun run agent:verify
# Should show: "Total agent files: 0, Documented agents: 0" (before creating agents)
```

### Step 5: Create domain agent files

For each agent in `Projects/<variant-name>/agents/`, create `<agent-name>.md` using the **3-Section structure**:

```markdown
## Section A: Role & Responsibility
# Platform-agnostic
# Role, responsibilities, I/O contract, legal/domain basis

## Section B: Claude Code Integration
# Skill invocation, Agent tool usage, tools used

## Section C: Antigravity Integration
# activate_skill, agent_manager, tool equivalents
```

Run after each agent:
```bash
bun run agent:verify
```

### Step 6: Create domain skills

For each domain-specific skill, create `Projects/<variant-name>/skills/<skill-name>/SKILL.md`.

Common skills from `templates/common/skills/` are already present — only create domain-specific ones.

### Step 7: Complete variant.json

Edit `Projects/<variant-name>/variant.json`:
- `description`: clear description of the variant's purpose
- `type`: `security` | `development` | `design` | `consulting` | `collaboration`
- `agent_overrides.pm.reason`: describe the PM role override
- `skill_manifest.variant_specific`: list domain skills with `used_by_agents` and `phases`

### Step 8: Define PROMOTION_CHECKLIST.md conditions

Edit `Projects/<variant-name>/PROMOTION_CHECKLIST.md` to replace placeholder conditions with domain-specific ones:
- Condition 3: specify which domain artifacts must be complete with which fields
- Condition 4: specify the domain audit script name
- Add domain-specific agent/skill checklists

### Step 9: Configure git hooks

```bash
cd Projects/<variant-name>
git config core.hooksPath .githooks
# Test:
git status
```

> If setup.sh already ran (Step 1), git is already initialized. Just verify.

### Step 10: Update CHANGELOG.md

Manually add an entry to `Projects/<variant-name>/CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- Phase A scaffold created via create-l2-scaffold.ts
- [List domain-specific files created]
```

> Note: The `/sync` pipeline is not available until Phase B promotion. Update CHANGELOG manually.

---

## Verification Checklist

Before moving to Phase B (`promote-variant`):

```bash
cd Projects/<variant-name>

# 1. All agents registered and files exist
bun run agent:verify

# 2. Domain skills valid (if validate-skills.ts applies)
bun scripts/validate-skills.ts

# 3. Domain audit passes
bun scripts/audit.ts   # or domain-specific audit script

# 4. Platform parity (CLAUDE.md <-> GEMINI.md)
# Manual check: heading structure must match
grep "^## " CLAUDE.md
grep "^## " GEMINI.md
```

> **Note**: `new-project.sh` and `new-project.ps1` auto-detect variants dynamically from `templates/` at runtime — no manual update to these scripts is required when adding a new variant.

---

## Next Step

When all PROMOTION_CHECKLIST.md conditions are met:
-> Use `skills/promote-variant/SKILL.md`

---

## Common Pitfalls (from co-safety experience)

| Pitfall | Prevention |
|---|---|
| CLAUDE.md/GEMINI.md identical to workspace root -> stripped by reconcile | Always add variant-specific section |
| AGENTS.md contains workspace agents -> agent:verify fails | Clean AGENTS.md in Step 4 |
| workflows/ not in pipeline scan scope | Document in _ORIGIN.md §Manual Phase B Steps |
| bun install not run -> scripts fail | Handled by scaffold script Step 8 |
| CHANGELOG.md not updated | Update manually after each Phase A session |
| Antigravity .gemini/ files not mirrored from .claude/ | Check .gemini/ after Step 3 Antigravity checklist |
| agents/*.md missing Section C: Antigravity Integration | Add Section C to every agent during Step 5 |
