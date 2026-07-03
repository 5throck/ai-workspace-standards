# Variant Contract

Every variant under `templates/` MUST contain all files listed in the **Required** column.
Files listed as **Optional** are domain-specific extensions.

`scripts/validate-templates.ts` enforces this contract automatically — a variant missing any
Required file will fail validation and cannot be promoted to `beta` or `stable` status.

## Required Files

| File / Path | Notes |
|-------------|-------|
| `variant.json` | Must include: name, description, status, version. **Note**: `agents/pm.md` is implicitly excluded from `variant.json agents[]` — pm is required in every variant via Required Files but is treated as infrastructure, not a specialist agent. Only specialist agents (architect, code-writer, etc.) are listed in `agents[]`. |
| `CLAUDE.md` | Claude Code session config; context load order + slash command table — **sourced from `templates/common/`** |
| `GEMINI.md` | Antigravity / Gemini CLI config; same content adapted for Gemini tool names — **sourced from `templates/common/`** |
| `AGENTS.md` | Canonical agent roster with phases, tiers, and skill references |
| `README.md` | English project README |
| `README_ko.md` | Korean translation |
| `agents/pm.md` | PM is required in every variant |
| `agents/README.md` | Agent directory index |
| `agents/README_ko.md` | Korean translation of agent index |
<!-- NOTE: agents/lifecycle-manager.md is intentionally excluded from this list.
     Lifecycle Manager is an L0-only specialist agent per CONSTITUTION.md §L0 Agent
     Non-Propagation. In variant projects (L2), PM handles lifecycle duties directly. -->
| `docs/{variant}.context.md` | Project-specific context file (name is variant-dependent) |
| `.claude/settings.json` | Shared Claude Code settings (MCP servers, hooks) |
| `.claude/commands/changelog.md` | `/changelog` slash command |
| `.claude/commands/memlog.md` | `/memlog` slash command |
| `.claude/commands/new-task.md` | `/new-task` slash command |
| `.claude/commands/sync.md` | `/sync` slash command |
| `.claude/commands/meeting.md` | `/meeting` slash command |
| `.gemini/settings.json` | Shared Antigravity settings (mirrors `.claude/settings.json`) |
| `.gemini/commands/changelog.md` | Gemini `/changelog` command |
| `.gemini/commands/memlog.md` | Gemini `/memlog` command |
| `.gemini/commands/new-task.md` | Gemini `/new-task` command |
| `.gemini/commands/sync.md` | Gemini `/sync` command |

## Optional Files (Domain Extensions)

| File / Path | Used by |
|-------------|---------|
| `.claude/commands/security-check.md` | co-develop, co-security |
| `.gemini/commands/security-check.md` | co-develop, co-security |
| `.claude/skills/*/SKILL.md` | Claude Code-only skills |
| `skills/*/SKILL.md` | Platform-neutral skills (accessible from all AI tools) |
| `ansible/` | co-security only |
| `scripts/` (variant-local) | co-security only |
| `PATCH_LOG.md` | co-security only |

## Skill Placement Rule

| Location | Scope | When to use |
|----------|-------|-------------|
| `.claude/skills/<name>/SKILL.md` | Claude Code only | Skills that use Claude Code-specific tools (Agent tool, TaskCreate, etc.) |
| `skills/<name>/SKILL.md` | Platform-neutral | Security procedures, domain workflows — accessible from Claude, Gemini, Antigravity |

### Security-Critical Skill Rule

Any skill that acts as an **authorization gate, access control, or security enforcement mechanism** MUST be placed in `skills/` (platform-neutral), NOT in `.claude/skills/` (Claude Code-only).

**Rationale:** Security gates must be enforceable regardless of which AI tool the team uses. A gate that only works in Claude Code can be bypassed by switching to Gemini CLI or Antigravity.

**Criteria for classification as security-critical:**
- The skill blocks or permits access to offensive/destructive actions
- The skill validates authorization documents or signed permissions
- The skill enforces scope boundaries or rules of engagement
- The skill manages credential hygiene or secret exposure checks

**Frontmatter enforcement:**

Security-critical skills MUST declare `security-gate: true` in their `SKILL.md` frontmatter:

```yaml
---
name: verify-authorization
security-gate: true   # Triggers platform-neutral placement check
...
---
```

**Automated enforcement:** `scripts/validate-templates.ts` checks that any skill with `security-gate: true` in its frontmatter is located in `skills/` and NOT in `.claude/skills/`. A skill in the wrong location will fail validation.

**Current security-critical skills:**

| Skill | Location | Gate Function |
|-------|----------|---------------|
| `verify-authorization` | `co-security/skills/` | Blocks Phase 1+ without signed authorization |

## Status Lifecycle

| Status | Requirements |
|--------|--------------|
| `draft` | Files being created; Variant Contract not yet fully satisfied |
| `beta` | All Required files present + registered in `new-project.sh/ps1` + `validate-templates` passes |
| `stable` | beta conditions + used in at least one real project without critical issues |
| `deprecated` | No new project creation allowed; existing projects continue |

## Enforcement

`scripts/validate-templates.ts` reads `templates/common/variant-contract.json` and checks every variant.
Run: `bun run scripts/validate-templates.ts` (or `bun scripts/validate-templates.ts`)

## Blocklist — Files NOT Allowed in templates/common/

The following files MUST NOT exist in `templates/common/`. If present, `validate-templates.ts` Check 0 will block validation. These are workspace-level governance documents that must never be copied into L2 projects.

| File | Reason |
|------|--------|
| `CONSTITUTION.md` | Workspace governance SSOT — projects reference via URL, not file copy |

<!-- NOTE: CLAUDE.md and GEMINI.md are intentionally NOT on this blocklist.
     They are provided via the common layer (templates/common/) and inherited by all
     variants during scaffolding. Variants must NOT include their own copies.
     If templates/common/CLAUDE.md or GEMINI.md contains workspace-root content
     (C:\git\ paths, "workspace root" in doc-intent, dev-sync.sh hooks),
     validate-templates.ts should flag it as a contamination error. -->

### Enforcement

`validate-templates.ts` Check 0 runs before all other checks and errors if any blocklist file exists in `templates/common/`.
