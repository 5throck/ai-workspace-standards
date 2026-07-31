---
name: upgrade-project
description: "Upgrade an existing L2/L3 project to the current template version. Use when: upgrading a variant-based project, syncing template improvements, refreshing scripts/agents/skills."
version: "1.0.0"
status: active
scope: workspace
owner: pm
triggers:
  - upgrade project
  - upgrade template
  - sync project with template
  - refresh project
  - update project infrastructure
---

# Upgrade Project

Upgrades an existing project created from a variant template to match the current template version.

## When to Use

- The workspace template has been updated with new scripts, agent improvements, or security fixes
- A project needs to receive the latest governance or automation infrastructure
- Periodic maintenance to keep projects in sync with template evolution

## Prerequisites

- The project must have been created from a `co-*` variant template
- The project must be a git repository
- `bun` must be installed

## Script

**Script**: `scripts/upgrade-project.ts`
**Usage**: `bun scripts/upgrade-project.ts <project-path> [--variant <name>] [--platform claude|antigravity|both] [--dry-run]`

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<project-path>` | Yes | Path to the target project |
| `--variant <name>` | No | Auto-detected from `.claude/template-version.txt` |
| `--platform <val>` | No | `claude`, `antigravity`, or `both` (default: both) |
| `--dry-run` | No | Analyze without making changes |

## How It Works

The upgrade tool classifies files into categories:

| Category | Behavior | Examples |
|----------|----------|---------|
| **LOCKED** | Unconditional overwrite | Git hooks, `.gitleaks.toml`, `.gitattributes` |
| **MERGE** | Section-based merge via markers | `CLAUDE.md`, `GEMINI.md`, `.gitignore`, `agents/pm.md` |
| **SYNC_IF_NEWER** | Version-based update | Scripts (`.ts`), agents (`.md`), skills (`SKILL.md`) |
| **PRESERVE** | Never touched | `README.md`, `docs/context.md`, `src/` |
| **OVERWRITE** | Governance files | `docs/_common/security.md` |

### Safety Mechanisms

1. **Pre-upgrade git stash**: Creates `pre-upgrade-snapshot-YYYYMMDD` for rollback
2. **`--dry-run` mode**: Full analysis with zero writes
3. **Security bootstrap verification**: Post-upgrade check of critical files

## Step-by-Step Procedure

1. **Check version**: `cat <project>/.claude/template-version.txt`
2. **Dry run**: `bun scripts/upgrade-project.ts <project> --dry-run`
3. **Commit local changes**: `cd <project> && git add -A && git commit -m "chore: pre-upgrade"`
4. **Run upgrade**: `bun scripts/upgrade-project.ts <project>`
5. **Verify**: `cd <project> && git status && git diff --cached`
6. **Commit**: `git commit -m "chore: upgrade template to vX.Y.Z"`

### Rollback

```bash
git stash list
git stash pop stash@{0}
```

## See Also

- [Project Upgrade Guide](docs/project-upgrade-guide.md)
- [Variant Conversion Guide](docs/variant-conversion-guide.md)
- [Fork Model (ADR-0031)](docs/adr/0031-l1-l2-fork-model.md)
