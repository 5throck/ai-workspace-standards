> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §6 Skill Lifecycle Management
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 6. Skills {#skills}

Reusable workflow knowledge is defined as skills.

> **Workspace Root vs. Individual Projects**:
> - **Workspace Root** (`ai-workspace-standards`): Skills focus on template maintenance and scaffolding validation (e.g., `ui-ux-pro-max`, `simulate-project-creation`, `security-scan`, `audit-workspace`).
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

#### 6.2 Skill File Format (Standard Frontmatter)

```yaml
---
name: Skill Display Name
description: >
  Describe exactly when this skill should be loaded.
  The AI tool uses this to decide whether to auto-trigger it.
version: 1.0.0
---
```

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
