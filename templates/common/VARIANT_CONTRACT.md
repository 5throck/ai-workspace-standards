# Variant Contract

Every variant under `templates/` MUST contain all files listed in the **Required** column.
Files listed as **Optional** are domain-specific extensions.

`scripts/validate-templates.ts` enforces this contract automatically — a variant missing any
Required file will fail validation and cannot be promoted to `beta` or `stable` status.

## Required Files

| File / Path | Notes |
|-------------|-------|
| `variant.json` | Must include: name, description, status, version |
| `CLAUDE.md` | Claude Code session config; context load order + slash command table |
| `GEMINI.md` | Antigravity / Gemini CLI config; same content adapted for Gemini tool names |
| `AGENTS.md` | Canonical agent roster with phases, tiers, and skill references |
| `README.md` | English project README |
| `README_ko.md` | Korean translation |
| `agents/pm.md` | PM is required in every variant |
| `agents/README.md` | Agent directory index |
| `agents/README_ko.md` | Korean translation of agent index |
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

## Status Lifecycle

| Status | Requirements |
|--------|--------------|
| `draft` | Files being created; Variant Contract not yet fully satisfied |
| `beta` | All Required files present + registered in `new-project.sh/ps1` + `validate-templates` passes |
| `stable` | beta conditions + used in at least one real project without critical issues |
| `deprecated` | No new project creation allowed; existing projects continue |

## Enforcement

`scripts/validate-templates.ts` reads `templates/common/variant-contract.json` and checks every variant.
Run: `bun run scripts/validate-templates.ts` (or `bash scripts/validate-templates.sh`)
