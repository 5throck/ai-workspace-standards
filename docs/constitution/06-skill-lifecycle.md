> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §6 Skill Lifecycle Management
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 6. Skills {#skills}

Reusable workflow knowledge is defined as skills.

#### Ownership Layers

Skills follow the same L0/L1/L2 model as scripts:

| Layer | Location | Owner | Update Policy |
|-------|----------|-------|---------------|
| **L0 — Workspace SSOT** | `skills/` (workspace root) | workspace maintainer | Edit directly; distribute via `bun run propagate:apply` |
| **L1 — Template snapshot** | `templates/common/skills/` | publish: `bun run propagate:apply` | Explicit publish from L0 |
| **L2 — Project** | `<project>/skills/` | project team | Independent snapshot after creation |

**Propagation rule**: Develop at L0 (`skills/`). Run `bun run propagate:apply` to distribute to `.claude/skills/` and `.gemini/skills/` and publish to the L1 template snapshot. Propagation filtering is controlled exclusively by SKILL.md frontmatter (`l2_propagate`/`scope`) — skills with `l2_propagate: false` or `scope: workspace` are excluded at the L0→L1 stage and never enter `templates/common/`. L2 projects snapshot L1 at creation time — no automatic back-propagation.

> **Workspace Root vs. Individual Projects**:
> - **Workspace Root** (`ai-workspace-standards`): Skills focus on template maintenance and scaffolding validation (e.g., `simulate-project-creation`, `security-scan`, `audit-workspace`).
> - **Individual Projects**: Skills are project-specific workflows defined by the development team.

#### 6.1 Folder Structure

Skills can exist in two locations:

```
# Project-specific skills (both AI tools)
skills/
└── <skill-name>/
    └── SKILL.md

# Claude Code-only skills (auto-registered)
.claude/skills/
└── <skill-name>/
    └── SKILL.md
```

> **Important:** Flat files like `skills/my-skill.md` are NOT recognized. Always use the directory format: `skills/my-skill/SKILL.md`.

| Location | Scope | AI Tools |
|----------|-------|----------|
| `skills/<name>/` | Project-specific, shared | Claude Code, Gemini |
| `.claude/skills/<name>/` | Claude Code-only | Claude Code only |

#### 6.1.1 Skill Discovery & Registration (.agents/skills.json)

For all AI tools (Claude Code, Gemini, and Antigravity) to automatically discover and load skills residing in the `skills/` directory, they must be registered in the workspace customizations configuration:
- **File Location**: `.agents/skills.json` (at project/workspace root)
- **Format**:
```json
{
  "entries": [
    {
      "path": "../skills"
    }
  ]
}
```
This configuration is automatically generated when scaffolding new projects and is committed to git in generated projects, ensuring out-of-the-box skill availability.

#### 6.2 Skill File Format (Standard Frontmatter)

```yaml
---
name: Skill Display Name
description: >
  Describe exactly when this skill should be loaded.
  The AI tool uses this to decide whether to auto-trigger it.
scope: common
l2_propagate: false   # optional; defaults to true — set false for workspace-management skills
version: 1.0.0
---
```

**`scope` allowed values**: `workspace` (L0-only), `common` (L0+L1, shared unmodified across all variants), `variant` (generic placeholder), or the **literal name of the variant the skill belongs to** (e.g. `scope: co-consult`) — a domain-only skill with a variant override and no `templates/common/` base. `scripts/helpers/layer-filter.ts` treats any value other than `workspace`/`common` as a variant-name marker and propagates the skill to L0+L1+L2. `scripts/skill-lifecycle-audit.ts` validates `scope` against `workspace | common | variant | <current project's own directory name>` — run the audit from inside the variant directory (e.g. `cd templates/co-consult && bun ../../scripts/skill-lifecycle-audit.ts`) so it can resolve the variant name correctly.

#### L2 Propagation Control

Skills in `skills/` are propagated to `templates/common/skills/` (L1) by `propagate-to-templates.ts`, and then snapshot-copied to generated projects (L2) at `new-project` time. Skills with `l2_propagate: false` are **excluded at the L0→L1 propagation stage** — they never enter `templates/common/` and therefore never reach L2 projects.

| `l2_propagate` value | Propagated to L1? | Copied to L2? |
|---------------------|-------------------|---------------|
| `true` (default) | ✅ Yes | ✅ Yes |
| `false` | ❌ No — stays in L0 only | ❌ No |

**When to use `l2_propagate: false`**: Workspace-management skills that should never leave the workspace root — variant creation tools, workspace audit scripts, etc. These skills exist only at L0 and are never propagated to templates or generated projects.

**Current excluded skills**: `audit-workspace`, `create-variant`, `promote-variant`

> `propagate-to-templates.ts` calls `includeSkillInL1()` from `helpers/layer-filter.ts`, which reads SKILL.md frontmatter directly — `l2_propagate: false` or `scope: workspace` returns `false` (excluded). `new-project.ts` also checks this as a safety net. SKILLS.md is not consulted for propagation decisions.

#### SKILLS.md Registry Principle

`SKILLS.md` (at both L0 and L1) is a **registry-only** file. It tracks:

| Column | Purpose |
|--------|---------|
| `skill` | Skill directory name |
| `version` | Current version |
| `status` | Lifecycle state (active/deprecated/archived) |
| `owner` | Responsible agent |
| `last_reviewed` | Date of last review |
| `removal-date` | Scheduled removal (if deprecated) |
| `notes` | Human-readable context |

**Prohibited in SKILLS.md**: Columns that control propagation behavior (e.g., `layer`) are explicitly forbidden. Propagation is exclusively controlled via SKILL.md frontmatter (`l2_propagate`/`scope`). Adding a `layer` column to SKILLS.md would create a silent dead column that misleads future developers — `layer-filter.ts` no longer reads it.

#### 6.3 Skill Body Structure

```markdown
## Overview
One paragraph - what this skill enables and when to use it.

## <workflow-name>

**Purpose**: What this workflow accomplishes.
**Trigger**: When to apply it.

**Steps**:
1. Step one
2. Step two
3. Step three

**Output**: What the agent produces at the end.
```

#### 6.4 Skill Types

| Type | Description | Load timing |
|------|-------------|-------------|
| Session skill | Always-needed workflow for this project | Listed under `## Session Start Skills` in `docs/context.md` - loaded at session start by all AI tools |
| On-demand skill | Specialized knowledge for specific tasks | Auto-triggered by `description` matching |

#### 6.5 Skill Creation Workflow

When to create a new skill vs. reuse:
- Create a new skill when the workflow is project-specific and will be reused across sessions
- Reuse an existing skill when the workflow is generic and already defined
- Use the `skill-creator` plugin to scaffold new skills with proper frontmatter

**Registration Checklist** (must complete after creation):
- [ ] Add skill to `docs/context.md ## Skills` table (for individual projects)
- [ ] Add skill to `AGENTS.md ## Skills` table (workspace root)
- [ ] Verify skill file is in correct directory (`skills/<name>/SKILL.md` or `.claude/skills/<name>/SKILL.md`)
- [ ] Run `bun scripts/skill-lifecycle-audit.ts` to verify registration

#### 6.6 Skill Lifecycle Management

Skills have a lifecycle managed by the PM agent. When agent configurations change, skills may need to be created, updated, deprecated, or archived.

##### Skill Lifecycle States

| State | Description | Action Required |
|-------|-------------|-----------------|
| **draft** | Skill under development | Move to active after review |
| **active** | Skill in production use | Regular health checks |
| **deprecated** | Superseded, pending removal | Add frontmatter warning, archive after 30 days |
| **archived** | No longer used, kept for reference | Move to `skills/_archive/`, can delete after 90 days |

##### Skill Version Bump Rules

| Change Type | Version Bump | Examples |
|-------------|--------------|----------|
| **patch** (1.0.x) | Wording/description fix, no behavioral change | Fix typo in description, clarify a step |
| **minor** (1.x.0) | New step added, trigger criteria expanded | Add validation step, expand when-to-use |
| **major** (x.0.0) | Complete rewrite or incompatible change | Restructure workflow, remove steps |

> **Shared Skill Governance**: Skills with multiple owners (`owner: [agent1, agent2]`) require both owners' approval (PM decision) before modification.

##### Skill Frontmatter Template

All skills should include lifecycle metadata:

```yaml
---
name: skill-name
description: This skill should be used when...
version: 1.2.3

# Lifecycle metadata
status: active           # draft | active | deprecated | archived
owner: agent-name        # Primary owning agent (or [agent1, agent2] for shared)
requires: []             # Skills this depends on
supersedes: old-skill    # This replaces old skill
superseded_by: []        # If another skill replaces this

# Last updated
last_reviewed: 2026-05-25
last_reviewed_by: pm-agent
---
```

##### Running Skill Health Audit

Execute the audit script to check skill health:

**Bun:**
```bash
bun scripts/skill-lifecycle-audit.ts
```

The audit checks for:
- ✅ Skills without owners
- ✅ Orphaned skills (owner agent doesn't exist)
- ✅ Deprecated skills still being modified
- ✅ Missing dependencies (requires field)
- ✅ Circular dependencies
- ✅ `scope` field validity (see §6.2)

**Run it in every location that matters, not just the workspace root**: the audit only resolves agents and scope relative to its own `cwd`. Run it once at the workspace root, and once from inside each variant directory:

```bash
bun scripts/skill-lifecycle-audit.ts                                   # workspace root (skills/, .claude/skills/)
cd templates/co-consult && bun ../../scripts/skill-lifecycle-audit.ts  # repeat per templates/co-*/ variant
cd templates/common && bun scripts/skill-lifecycle-audit.ts            # L1 common layer
```

> `docs/_examples/skills/**` is excluded from scanning — those `SKILL.md` files are illustrative documentation samples, not lifecycle-managed skills.

**Common-scope skill owner pitfall**: a `scope: common` skill is used by every variant, but `templates/common/agents/` intentionally contains only `pm.md` — L0 specialist agents (`security-expert`, `lifecycle-manager`, `docs-writer`, etc.) are **not** propagated there (ADR-0043; see `agents/_COMMON.md`), and individual variants are not guaranteed to define them either. A `scope: common` skill whose `owner` names one of those specialist roles will audit clean at the workspace root (where the specialist agents genuinely exist) while showing up as **orphaned in every variant** that inherits it. Set `owner: pm` for any `scope: common` skill unless every variant is confirmed to define the specialist agent itself — verify with the multi-location audit loop above before assigning a specialist owner to a common-scope skill.

##### Agent Configuration Change Workflow

When PM agent modifies the agent team:

**New Agent Added:**
1. Does agent need a skill? → Create using `skill-creator:skill-creator`
2. Can existing skill be shared? → Update `owner: [agent1, agent2]`

**Agent Role Changed:**
1. Find all skills with `owner: changed-agent`
2. Update skill descriptions to reflect new scope
3. Bump version if capabilities changed (follow version bump rules)

**Agent Removed:**
1. Find all skills with `owner: removed-agent`
2. Is skill shared? → Remove agent from owner list
3. Is skill needed by another agent? → Reassign owner
4. Is skill orphaned? → Change status to deprecated

**Agent Consolidation:**
1. List all skills from merged agents
2. Identify duplicates → Use `supersedes` field to mark old
3. Keep most complete version
4. Update `owner: new-consolidated-agent`

##### Pre-commit Integration

Skills are automatically validated on commit:

```bash
git add .claude/skills/new-skill/SKILL.md
git commit -m "feat: add new skill"
# → Skill Lifecycle Audit runs automatically
```

If audit fails:
- Add missing `owner: agent-name` to frontmatter
- Reassign orphaned skills to valid agents
- Archive deprecated skills to `skills/_archive/`


#### 6.7 Non-English Reference Material

`skills/*.md` is a protected path under the workspace Language Policy — the `lang: ko` frontmatter exception never applies there, regardless of `lang_reason` (see [CONSTITUTION.md — Non-English Reference Material in Skills](../../CONSTITUTION.md#non-english-reference-material-in-skills)).

When a skill needs source-language reference data (a terminology glossary, official field/status name mappings, source-language excerpts), place it in a **non-Markdown** file under `skills/<name>/references/` (e.g. `references/terms-ko.json`, `references/glossary-ko.csv`). `validate-md-language.ts` only scans `*.md`, so these reference assets are exempt from the English-only policy and may contain the source language directly. `SKILL.md` stays English-only and links to the reference file.

**Registration Checklist addition**: if a skill adds a `references/` reference asset, note it in the skill's `SKILLS.md` `notes` column (e.g. `notes: ko glossary in references/terms-ko.json`).

---

### Cross-Platform Deployment Rule

Any command file added or modified under `.claude/commands/` **MUST** have a corresponding file under `.gemini/commands/` at the same directory level. This rule applies at both the workspace root and template variant levels.

**Enforcement**: `audit.ts` runs `check_command_parity()` on every commit and warns on any `.claude/commands/` file that lacks a matching `.gemini/commands/` file.

**Intentional exceptions**: If a command is genuinely Claude Code-only (e.g., it relies on Claude-native tool dispatch with no Gemini equivalent), add the following to the file's frontmatter to suppress the parity warning:

```markdown
---
gemini-parity: skip
description: ...
---
```

**Sync rule**: When the content of a command file changes, update both platforms simultaneously. The `.claude/commands/` version is the SSOT; `.gemini/commands/` must be kept in sync.
