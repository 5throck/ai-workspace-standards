---
name: create-variant
description: >
  Guides creation of a new workspace variant (Phase A independent prototype).
  Use when: creating a new co-<name> variant, scaffolding a new domain-specific AI team.
status: active
scope: common
l2_propagate: false
version: 1.4.0
owner: pm
last_reviewed: 2026-08-23
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
- [ ] Domain type decided: `security` | `development` | `design` | `consulting` | `collaboration` | `lecture` | `game` | (custom)
- [ ] Target country decided: a specific jurisdiction (`--country <CODE>`, e.g. `KR`) or region-neutral (default - omit the flag)

### Step 1: Run scaffold script

```bash
# From workspace root C:\git\
bun scripts/create-l3-scaffold.ts <variant-name> --domain <type> [--country <CODE>]

# Example:
bun scripts/create-l3-scaffold.ts safety-os --domain ehs

# Example (domain anchored to a specific jurisdiction):
bun scripts/create-l3-scaffold.ts labor-kr --domain hr --country KR
```

> **Target country**: pass `--country <CODE>` (ISO 3166-1 alpha-2 or a well-known region code such as `EU`) when the domain is anchored to a specific jurisdiction. This deploys that country's scoped skills into the draft (e.g. `KR` deploys `k-law`/`k-dart`/`k-kosis`) and records the selection. Omit the flag for a region-neutral variant - country-scoped skills are then pruned from the scaffold. See `templates/common/docs/country-profiles.md` (shipped into the project as `docs/country-profiles.md`).

This creates `Projects/<variant-name>/` with:
- All common infrastructure (.claude/, .gemini/, scripts/, skills/) — every top-level file/dir under `templates/common/` is copied by default except a short, documented exclusion list (`COMMON_OVERLAY_EXCLUDE` in the script), so new common files show up automatically without needing a script change
- `docs/context.md` (the immutable common project-context file, placeholders substituted) + `docs/_common/*`
- `.gitattributes` with a `docs/context.md merge=ours` protection rule
- Git initialized + .githooks configured
- bun install complete
- stub files (_ORIGIN.md, variant.json, PROMOTION_CHECKLIST.md, etc.)
- A post-scaffold `bun scripts/audit.ts` run — non-fatal, but surfaces problems immediately instead of waiting for the first `/sync`

> **Fork Model**: After scaffold completes, this `Projects/<name>/` draft (L3) evolves independently from L1. L1 changes will NOT automatically propagate to it. To get L1 updates later, re-run `create-l3-scaffold.ts` or manually copy needed files. See [ADR-0031](../../docs/adr/0031-l1-l2-fork-model.md).

### Step 2: Add variant section to CLAUDE.md

Open `Projects/<variant-name>/CLAUDE.md` and add at the end:

```markdown
## <VariantName> Context

### Role Override: <Role Title>
[Describe how PM agent is overridden for this domain]

### Domain
[Describe the domain and applicable laws/standards - jurisdiction-neutral prose; country-specific statutes, regulators, and formats go in docs/countries/<CODE>.md profiles]

### <VariantName> Lifecycle Rules
| Modified file(s) | Required follow-up actions |
|-----------------|---------------------------|
| [domain files] | [domain-specific checks] |

### Legal/Domain Disclaimer
[Appropriate disclaimer for the domain]
```

> **Reconcile survival**: This section makes CLAUDE.md differ from workspace root — required for Phase B pipeline.

> **Country vs. domain**: keep base variant content jurisdiction-neutral. Country-specific statutes, regulators, and operational formats belong in country profiles (`docs/countries/<CODE>.md` - format specified in `docs/country-profiles.md`, shipped from `templates/common/docs/`). If the domain requires jurisdiction anchoring, author the profiles, declare `country_config` in `variant.json` (Step 7), and scaffold with `--country <CODE>` (Step 1). Country profiles are advisory knowledge loaded at engagement start (Phase 0 intake) - they are never auto-executed.

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

### Step 6.5: Regenerate README

`create-l3-scaffold.ts` rendered `README.md`/`README_ko.md` from the workspace README Standard template at scaffold time (Step 1), but with an empty agent roster and empty skills. Now that agents (Step 5) and skills (Step 6) exist, regenerate so the **Meet the AI Team** and **Skills** sections render real content:

```bash
bun scripts/generate-l3-readme.ts --l3-path Projects/<variant-name>
```

Re-run this command after **any** later agent, skill, or `variant.json` change — it reads the live project state via `scanL3Project()` each time. In particular, re-run after Step 7 once `variant.json → description` is filled, so the README tagline no longer reads `TODO: describe…`. This is the Phase A self-service renderer; Phase B's `templates/co-*/` README standard is enforced separately by `WS-08` in `validate-templates.ts`.

### Step 7: Complete variant.json

Edit `Projects/<variant-name>/variant.json`:
- `description`: clear description of the variant's purpose
- `variant_type`: `security` | `development` | `design` | `consulting` | `collaboration` | `lecture` | `game`
- `agent_overrides.pm.reason`: describe the PM role override
- `skill_manifest.variant_specific`: list domain skills with `used_by_agents` and `phases`
- `country_config`: declare supported country profiles if the variant ships `docs/countries/<CODE>.md` (keep `default: null` - region-neutral is the required default state)

### Step 8: Define PROMOTION_CHECKLIST.md conditions

Edit `Projects/<variant-name>/PROMOTION_CHECKLIST.md` to replace placeholder conditions with domain-specific ones:
- Condition 3: specify which domain artifacts must be complete with which fields
- Condition 4: specify the domain audit script name
- Add domain-specific agent/skill checklists
- Keep the bilingual user-guide condition: Phase B promotion requires `docs/user-guide.md` + `docs/user-guide_ko.md` (validate-templates WS-11) — author them in Phase A so promotion isn't blocked

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
- Phase A scaffold created via create-l3-scaffold.ts
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

> **Note**: `new-project.ts` auto-detects variants dynamically from `templates/` at runtime — no manual update to that script is required when adding a new variant.

- [ ] Run `bun scripts/verify-scripts.ts --verify` in the `Projects/<name>/` draft (L3) — must exit 0 with 0 errors (confirms SCRIPTS.md has no ghost entries or PAIR MISSING warnings)
- [ ] Regenerate the README via `bun scripts/generate-l3-readme.ts --l3-path Projects/<variant-name>` and confirm **zero `TODO:` markers** remain in `README.md`/`README_ko.md` (the `variant.json → description` must be filled first, in Step 7, or the tagline still reads `TODO: describe…`)

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
| README.md/README_ko.md left as scaffold stub (empty Meet-the-AI-Team / Skills sections) | Run `bun scripts/generate-l3-readme.ts` after Step 6, and again after any later agent/skill change |
