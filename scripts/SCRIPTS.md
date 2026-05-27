# SCRIPTS.md — Script Lifecycle Registry

> This file is the Single Source of Truth (L0) for all scripts in `scripts/` (workspace root).
> Template `templates/common/scripts/` (L1) is a snapshot published from here via `bash scripts/publish-to-template.sh`.
> Project `scripts/` (L2) is a snapshot created from L1 at `new-project` time.
>
> **Machine parsing**: `verify-scripts.ts --verify` reads the `## Registry` section only.
> **Human reading**: see `## Guide` section below for purpose, usage, and deprecation notes.

---

## Registry

<!-- verify-scripts.ts parses rows between the Registry header and the next ## header. -->
<!-- Required columns: script | source | version | status | removal-date | security-advisory | drift -->
<!-- status: active | deprecated | experimental -->
<!-- removal-date: YYYY-MM-DD (required when status=deprecated) or — -->
<!-- security-advisory: CVE-XXXX or — -->
<!-- drift: — (checked) | intentional (L0/L1 divergence is expected, skip drift check) -->

| script | source | version | status | removal-date | security-advisory | drift |
|--------|--------|---------|--------|--------------|-------------------|-------|
| `audit.sh` | L0 | 1.2.0 | active | — | — | intentional |
| `audit.ps1` | L0 | 1.2.0 | active | — | — | intentional |
| `dev-sync.sh` | L0 | 1.3.0 | active | — | — | — |
| `dev-sync.ps1` | L0 | 1.4.0 | active | — | — | — |
| `new-project.sh` | L1 | 1.2.0 | active | — | — | — |
| `new-project.ps1` | L1 | 1.3.0 | active | — | — | — |
| `sync-md.sh` | L0 | 1.1.0 | active | — | — | intentional |
| `sync-md.ps1` | L0 | 1.2.0 | active | — | — | — |
| `gen-pr-body.sh` | L0 | 1.0.0 | active | — | — | — |
| `gen-pr-body.ps1` | L0 | 1.0.0 | active | — | — | — |
| `install-bun.sh` | L0 | 1.0.0 | active | — | — | — |
| `install-bun.ps1` | L0 | 1.0.0 | active | — | — | — |
| `agent-create.ts` | L0 | 1.0.0 | active | — | — | — |
| `agent-delete.ts` | L0 | 1.0.0 | active | — | — | — |
| `agent-list.ts` | L0 | 1.0.0 | active | — | — | — |
| `agent-verify.ts` | L0 | 1.0.0 | active | — | — | — |
| `agent-lifecycle-audit.ts` | L0 | 1.0.0 | active | — | — | — |
| `skill-lifecycle-audit.ts` | L0 | 1.0.0 | active | — | — | — |
| `readme-lifecycle-audit.ts` | L0 | 1.0.0 | active | — | — | — |
| `verify-skills.ts` | L0 | 1.0.0 | active | — | — | — |
| `verify-memory.ts` | L0 | 1.0.0 | active | — | — | — |
| `dispatch.ts` | L0 | 1.0.0 | active | — | — | — |
| `dispatch-parallel.ts` | L0 | 1.0.0 | active | — | — | — |
| `dispatch-serial.ts` | L0 | 1.0.0 | active | — | — | — |
| `retry-handler.ts` | L0 | 1.0.0 | active | — | — | — |
| `sync-agent-status.ts` | L0 | 1.0.0 | active | — | — | — |
| `sync-skill-status.ts` | L0 | 1.0.0 | active | — | — | — |
| `generate-scripts-readme.ts` | L0 | 1.0.0 | active | — | — | — |
| `sync-skills.sh` | L1 | 1.1.0 | active | — | — | — |
| `sync-skills.ps1` | L1 | 1.1.0 | active | — | — | — |
| `publish-to-template.sh` | L1 | 1.0.0 | active | — | — | — |
| `publish-to-template.ps1` | L1 | 1.0.0 | active | — | — | — |
| `list-template-versions.sh` | L1 | 1.0.0 | active | — | — | — |
| `list-template-versions.ps1` | L1 | 1.0.0 | active | — | — | — |
| `qa-gate.sh` | L1 | 1.0.0 | active | — | — | — |
| `qa-gate.ps1` | L1 | 1.0.0 | active | — | — | — |
| `validate-templates.sh` | L1 | 1.0.0 | active | — | — | — |
| `validate-templates.ps1` | L1 | 1.0.0 | active | — | — | — |
| `validate-templates.ts` | L1 | 1.0.0 | active | — | — | — |
| `verify-readme-sync.ts` | L1 | 1.0.0 | active | — | — | — |
| `verify-scripts.ts` | L1 | 1.0.0 | active | — | — | — |

---

## Ownership Layers

| Layer | Location | Owner | Update Policy |
|-------|----------|-------|---------------|
| **L0 — Workspace SSOT** | `scripts/` (workspace root) | workspace maintainer | Versioned via this file |
| **L1 — Template snapshot** | `templates/common/scripts/` | publish: `bash scripts/publish-to-template.sh` | Explicit publish from L0 |
| **L2 — Project** | `<project>/scripts/` | project team | Independent snapshot after creation |

**Propagation rule**: L0 is the development SSOT. Publish L0→L1 explicitly with `bash scripts/publish-to-template.sh`. L2 projects snapshot L1 at creation time only. No automatic back-propagation from L2.

---

## Lifecycle States

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `active` | In production use | Changes require version bump in Registry |
| `deprecated` | Scheduled for removal | `removal-date` field required; L1/L2 warned on `dev-sync` |
| `experimental` | Not guaranteed stable | Not synced to L1/L2 automatically |

**Deprecation flow:**
1. Set `status: deprecated` and `removal-date: YYYY-MM-DD` (minimum 90 days notice)
2. `dev-sync.sh` warns L1/L2 consumers on every run
3. On `removal-date`, `verify-scripts.ts --verify` **hard blocks** pre-commit

**Security advisory flow:**
1. Set `security-advisory: CVE-XXXX` (status can remain `active` or become `deprecated`)
2. `dev-sync.sh` **hard blocks** in L1/L2 until the script is updated or removed
3. Unlike deprecation, security advisories take immediate effect with no grace period

---

## Guide

### Everyday Development Scripts

#### `audit.sh` / `audit.ps1`
**Purpose**: Documentation audit gate. Checks CHANGELOG.md, CONSTITUTION.md, AGENTS.md,
agent frontmatter, skill health, and template lifecycle validation.
**Usage**: `bash scripts/audit.sh` / `.\scripts\audit.ps1`
**Runs automatically**: pre-commit hook, pre-push hook, `dev-sync.sh`
**Pair rule**: `.sh` and `.ps1` must always be kept in sync.

#### `dev-sync.sh` / `dev-sync.ps1`
**Purpose**: Full sync pipeline — session log → MEMORY.md index → CHANGELOG auto-add →
audit gate → sensitive file check → branch creation → commit → push → PR.
**Usage**: `bash scripts/dev-sync.sh "feat: description"` / `.\scripts\dev-sync.ps1 "feat: ..."`
**Claude Code**: `/sync "feat: description"`
**Pair rule**: `.sh` and `.ps1` must always be kept in sync.

#### `sync-md.sh` / `sync-md.ps1`
**Purpose**: Updates `memory/MEMORY.md` index with today's session entry.
**Usage**: Called automatically by `dev-sync.sh`. Rarely invoked directly.
**Pair rule**: `.sh` and `.ps1` must always be kept in sync.

#### `setup.sh` / `setup.ps1`
**Purpose**: Project environment initialization — env file creation, dependency install,
git hooks installation, initial commit.
**Usage**: `bash scripts/setup.sh` (run once after `new-project`)

#### `gen-pr-body.sh` / `gen-pr-body.ps1`
**Purpose**: Generates PR body from commit log and memory log. Called by `dev-sync.sh`.
**Usage**: Invoked automatically. Can be called standalone: `bash scripts/gen-pr-body.sh "msg"`

#### `generate-scripts-readme.ts`
**Purpose**: Auto-generates scripts/README.md from SCRIPTS.md registry.
**Usage**: `bun scripts/generate-scripts-readme.ts`
**Runs automatically**: `dev-sync.sh`

---

### Installation Scripts

#### `install-bun.sh` / `install-bun.ps1`
**Purpose**: Installs Bun runtime required for TypeScript scripts (`.ts`).
**Usage**: `bash scripts/install-bun.sh` / `.\scripts\install-bun.ps1`
**When needed**: Before running any `.ts` script for the first time.

---

### Agent Lifecycle Scripts (Bun / TypeScript)

#### `agent-create.ts`
**Purpose**: Creates a new agent file with proper frontmatter and required sections.
**Usage**: `bun scripts/agent-create.ts <name> --role "Display Name" --group <group>`

#### `agent-delete.ts`
**Purpose**: Removes an agent file and updates AGENTS.md.
**Usage**: `bun scripts/agent-delete.ts <name> [--force]`

#### `agent-list.ts`
**Purpose**: Lists all agents with their status, group, and tier.
**Usage**: `bun scripts/agent-list.ts [--group <group>] [--verbose]`

#### `agent-verify.ts`
**Purpose**: Verifies agent/AGENTS.md synchronization (files vs. registry).
**Usage**: `bun scripts/agent-verify.ts`

#### `agent-lifecycle-audit.ts`
**Purpose**: Full agent lifecycle audit — frontmatter validation, AGENTS.md consistency,
deprecated agent references, missing fields.
**Usage**: `bun scripts/agent-lifecycle-audit.ts`
**Runs automatically**: pre-commit hook when `agents/*.md` files are staged.

#### `sync-agent-status.ts`
**Purpose**: Synchronizes agent status between agent files and AGENTS.md.
**Usage**: `bun scripts/sync-agent-status.ts`

---

### Skill Lifecycle Scripts (Bun / TypeScript)

#### `skill-lifecycle-audit.ts`
**Purpose**: Full skill lifecycle audit — owner validation, orphaned skills, deprecated
skills still being modified, dependency graph, circular dependencies.
**Usage**: `bun scripts/skill-lifecycle-audit.ts`
**Runs automatically**: pre-commit hook when `skills/**` files are staged.

#### `readme-lifecycle-audit.ts`
**Purpose**: Validates README.md / README_ko.md pairing in `templates/` directories.
**Usage**: `bun scripts/readme-lifecycle-audit.ts`

#### `verify-skills.ts`
**Purpose**: Cross-validates skills referenced in `docs/context.md` against actual
skill files on disk. Detects missing or orphaned skill references.
**Usage**: `bun scripts/verify-skills.ts`

#### `sync-skill-status.ts`
**Purpose**: Synchronizes skill status between SKILL.md and registry tables.
**Usage**: `bun scripts/sync-skill-status.ts`

#### `new-project.sh` / `new-project.ps1`
**Purpose**: Scaffolds a new project under the workspace root. Copies `templates/common/`
and an optional variant, substitutes `[Project Name]` placeholders, initializes git with
hooks, sets executable bits, and runs the post-scaffold audit.
**Usage**: `bash scripts/new-project.sh "Project Name"` / `.\scripts\new-project.ps1 "Project Name"`
**Claude Code**: `/new-project "Project Name"`
**Note**: L1-only script (not in templates); changes must be versioned in SCRIPTS.md manually.

#### `sync-skills.sh` / `sync-skills.ps1`
**Purpose**: Distributes skills from the L1 SSOT (`skills/`) to runtime locations
(`.claude/skills/` and `.gemini/skills/`). Run after any change to `skills/` or
`templates/common/skills/` to ensure Claude Code and Gemini CLI pick up the update.
**Usage**: `bash scripts/sync-skills.sh` / `.\scripts\sync-skills.ps1`

#### `publish-to-template.sh` / `publish-to-template.ps1`
**Purpose**: Publishes L0 scripts (workspace `scripts/`) to the L1 template snapshot
(`templates/common/scripts/`). Copies all scripts labeled `L0` in the Registry plus
`SCRIPTS.md` itself.
**Usage**: `bash scripts/publish-to-template.sh` / `.\scripts\publish-to-template.ps1`
**Dry-run**: `bash scripts/publish-to-template.sh --dry-run`
**Note**: L1-only script (not propagated to template).

#### `verify-memory.ts`
**Purpose**: Validates `memory/*.md` session logs for mandatory 4-section format compliance
(`## Session Summary`, `## Changes`, `## Decisions`, `## Open Issues`) and detects
orphaned files not registered in `MEMORY.md` index.
**Usage**: `bun scripts/verify-memory.ts [--verify | --report]`
**Runs automatically**: pre-commit hook when `memory/*.md` files are staged.

---

### Multi-Agent Orchestration Scripts (Bun / TypeScript)

#### `dispatch.ts`
**Purpose**: Single-agent dispatch wrapper. Spawns one agent with a given prompt and
waits for completion.
**Usage**: `bun scripts/dispatch.ts --agent <name> --prompt "task"`

#### `dispatch-parallel.ts`
**Purpose**: Parallel multi-agent dispatch. Spawns multiple agents simultaneously and
collects results when all complete.
**Usage**: `bun scripts/dispatch-parallel.ts --agents agent1,agent2 --prompt "task"`

#### `dispatch-serial.ts`
**Purpose**: Serial multi-agent dispatch. Chains agents sequentially, passing each
agent's output as input to the next.
**Usage**: `bun scripts/dispatch-serial.ts --agents agent1,agent2 --prompt "task"`

#### `retry-handler.ts`
**Purpose**: Wraps any dispatch call with retry logic (configurable attempts, backoff).
**Usage**: `import { withRetry } from './retry-handler.ts'` (library module)

---

## Version Bump Policy

When modifying a script:
1. Increment `version` in the Registry row (semver: patch for bugfix, minor for feature)
2. Update the Guide section if the interface or behavior changes
3. If the change is breaking, set `status: deprecated` on the old version entry and
   add a new row for the replacement

---

*SCRIPTS.md maintained by: workspace maintainer (L0 SSOT)*
*Last updated: 2026-05-27*
