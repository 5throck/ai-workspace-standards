# SCRIPTS.md — Script Lifecycle Registry

> This file is the Single Source of Truth (Tier 1 SSOT) for all scripts in `scripts/` (workspace root).
> Template `templates/common/scripts/` (Tier 2) is a snapshot published from here via `bun run publish-to-template`.
> Project `scripts/` (Tier 3) is a snapshot created from Tier 2 at `new-project` time.
>
> **Machine parsing**: `verify-scripts.ts --verify` reads the `## Registry` section only.
> **Human reading**: see `## Guide` section below for purpose, usage, and deprecation notes.

---

## Architecture: Tier 1 vs Tier 2 Scripts

All scripts in this workspace follow a Hybrid Scripting Architecture divided into two tiers. When creating a new script, you must determine its tier based on the following criteria:

### Tier 1: Bootstrap & Native Scripts (Native Shell)
*   **Purpose**: Initial project setup, bootstrapping, or scenarios where no external runtime (like Node.js or Bun) is guaranteed to exist.
*   **Implementation**: Must be written as pure shell scripts (providing both `.sh` and `.ps1` pairs).
*   **Execution**: Run directly via native shell (`bash scripts/name.sh` or `.\scripts\name.ps1`).
*   **Examples**: `new-project.sh/.ps1`, `install-bun.sh/.ps1`, `upgrade-project.sh/.ps1`.

### Tier 2: Ops & Automation Scripts (Bun/TS + package.json)
*   **Purpose**: Everyday pipeline tasks, code generation, linting, syncing, and lifecycle audits.
*   **Implementation**: Written in TypeScript (`.ts`) and executed via the Bun runtime. Wrapper shell scripts (`.sh`/`.ps1`) are **deprecated** for Tier 2.
*   **Execution**: Must be registered in and run via `package.json` scripts (e.g., `bun run audit`, `bun run dev-sync`).
*   **Examples**: `audit.ts`, `dev-sync.ts`, `gen-pr-body.ts`, `publish-to-template.ts`.

---

## Registry

<!-- verify-scripts.ts parses rows between the Registry header and the next ## header. -->
<!-- Required columns: script | source | version | status | removal-date | security-advisory | layer | pair -->
<!-- status: active | deprecated | experimental -->
<!-- removal-date: YYYY-MM-DD (required when status=deprecated) or — -->
<!-- security-advisory: CVE-XXXX or — -->
<!-- Layer column values:
  common   = script exists in both scripts/ and templates/common/scripts/
  L0-only  = workspace root only, must NOT be referenced from templates/common/
  L1-only  = generated project only, must exist in templates/common/scripts/
-->
<!-- pair: <script-name> (.sh declares its .ps1 pair; enables horizontal sync check) or — -->
<!-- Check A (lifecycle-sync-audit.ts): verifies @version header == registry version (formal consistency only). Semantic content alignment — whether file content actually reflects version history — is NOT verified by tooling. Use git log to confirm content for Type-2 fixes. -->

| script | source | version | status | removal-date | security-advisory | layer | pair |
|--------|--------|---------|--------|--------------|-------------------|-------|------|
| `new-project.sh` | L0 | 1.4.0 | active | — | — | L0-only | pair: new-project.ps1 |
| `new-project.ps1` | L0 | 1.6.2 | active | — | — | L0-only | — |
| `install-bun.sh` | L0 | 1.0.0 | active | — | — | common | pair: install-bun.ps1 |
| `install-bun.ps1` | L0 | 1.0.0 | active | — | — | common | — |
| `upgrade-project.sh` | L0 | 1.1.0 | active | — | — | L0-only | pair: upgrade-project.ps1 |
| `upgrade-project.ps1` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `cleanup-completed-md.sh` | L0 | 1.0.0 | active | — | — | common | pair: cleanup-completed-md.ps1 |
| `cleanup-completed-md.ps1` | L0 | 1.0.0 | active | — | — | common | — |
| `audit.ts` | L0 | 2.5.3 | active | — | — | common | — |
| `dev-sync.ts` | L0 | 1.2.1 | active | — | — | common | — |
| `sync-md.ts` | L0 | 1.2.0 | active | — | — | common | — |
| `gen-pr-body.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `sync-skills.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `publish-to-template.ts` | L0 | 1.4.0 | active | — | — | common | — |
| `fix-script-versions.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `list-template-versions.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `tag-template.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `qa-gate.ts` | L0 | 1.0.2 | active | — | — | common | — |
| `create-l2-scaffold.ts` | L0 | 1.2.0 | active | — | — | common | — |
| `agent-create.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `team-builder.ts` | L0 | 1.2.0 | active | — | — | common | — |
| `agent-delete.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `agent-list.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `agent-verify.ts` | L0 | 1.0.1 | active | — | — | common | — |
| `agent-lifecycle-audit.ts` | L0 | 1.1.1 | active | — | — | common | — |
| `skill-lifecycle-audit.ts` | L0 | 1.1.3 | active | — | — | common | — |
| `lifecycle-sync-audit.ts` | L0 | 1.3.2 | active | — | — | common | — |
| `readme-lifecycle-audit.ts` | L0 | 1.0.1 | active | — | — | common | — |
| `verify-skills.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `verify-memory.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `archive-memory.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `generate-scripts-readme.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `dispatch.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `dispatch-parallel.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `dispatch-serial.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `retry-handler.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `sync-agent-status.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `sync-skill-status.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `validate-templates.ts` | L0 | 1.4.5 | active | — | — | L0-only | workspace-only: references docs/workspace-schema.json |
| `helpers/lifecycle-governance.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/template-validation.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/inject-global-plugins.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/inject-skills.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/merge-frontmatter.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/merge-package-scripts.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/substitute-placeholders.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/update-variant-lifecycle.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/validate-output.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/write-scripts-snapshot.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `helpers/beta-lifecycle.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `helpers/generate-variant.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `helpers/validate-platform-parity.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `helpers/integration-helpers.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `verify-readme-sync.ts` | L0 | 1.1.1 | active | — | — | common | — |
| `translate-readme.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `verify-agent-deliverables.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `verify-scripts.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `test-new-project.ts` | L0 | 1.0.3 | active | — | — | common | — |
| `check-pm-approval.ts` | L0 | 1.0.0 | deprecated | 2026-11-30 | — | common | — |
| `verify-new-project-tests.ts` | L0 | 1.0.2 | active | — | — | common | — |
| `clear-pm-approval.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `l2-to-variant-pipeline.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `helpers/scan-l2-project.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `helpers/reconcile-with-l0-l1.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `helpers/variant-governance-rules.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `lib/platform-context.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `lib/platform-dispatcher.ts` | L0 | 1.0.0 | active | — | — | common | workspace-only: cross-platform dispatch abstraction for PM auto-mode (Claude Code + Antigravity) |
| `lib/encoding-utils.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `lib/error-handling.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `lib/pipeline-state.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `lib/plan-parser.ts` | L0 | 1.0.0 | active | — | — | common | workspace-only: parses ExitPlanMode Markdown plans for auto-mode execution |
| `lib/checkpoint-manager.ts` | L0 | 1.0.0 | active | — | — | common | workspace-only: session-only checkpoint management for PM auto-mode |
| `lib/auto-executor.ts` | L0 | 1.0.0 | active | — | — | common | workspace-only: phase group execution orchestration for PM auto-mode |
| `validate-agents.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `validate-doc-folder.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `verify-template-integrity.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `validate-skills.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `skill-dependency-analysis.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `test-runner.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `validate-md-language.ts` | L0 | 1.3.0 | active | — | — | common | — |
| `hooks/pre-commit.ts` | L0 | 1.5.4 | active | — | — | L0-only | workspace-only: SYNC_ACTIVE protection; exempt memory/ from Korean check; all variants inherit from common (no independent L1 versions) |
| `hooks/pre-push.ts` | L0 | 1.2.0 | active | — | — | L0-only | workspace-only: full audit+tests; L1 has independent v2.0.0 branch-protection-only version |
| `hooks/post-write-lifecycle-check.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `validate-model-registry.ts` | L0 | 1.0.1 | active | — | — | L0-only | workspace-only: references docs/workspace-schema.json |
| `verify-platform-lifecycle.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `analyze-git-history.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `generate-version-manifest.ts` | L0 | 1.0.1 | active | — | — | common | — |
| `propagation-map.json` | L0 | 1.0.0 | active | — | — | common | — |
| `fix-parse-agent.sed` | L0 | 1.0.0 | active | — | — | L0-only | — |

---

## Ownership Layers

| Layer | Location | Owner | Update Policy |
|-------|----------|-------|---------------|
| **L0 — Workspace SSOT** | `scripts/` (workspace root) | workspace maintainer | Versioned via this file |
| **L1 — Template snapshot** | `templates/common/scripts/` | publish: `bun run publish-to-template` | Explicit publish from L0 via consolidated tool |
| **L2 — Project** | `<project>/scripts/` | project team | Independent snapshot after creation, plus L1->L2 propagation via `publish-to-template.ts` |

**Propagation rule**: L0 is the development SSOT. Publish L0→L1 explicitly with `bun run publish-to-template`, which is now a consolidated tool that also handles L1->L2 propagation. L2 projects snapshot L1 at creation time and receive subsequent updates via propagation. No automatic back-propagation from L2.

---

## Lifecycle States

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `active` | In production use | Changes require version bump in Registry |
| `deprecated` | Scheduled for removal | `removal-date` field required; L1/L2 warned on `dev-sync` |
| `experimental` | Not guaranteed stable | Not synced to L1/L2 automatically |

**Deprecation flow:**
1. Set `status: deprecated` and `removal-date: YYYY-MM-DD` (minimum 90 days notice)
2. `bun run dev-sync` warns L1/L2 consumers on every run
3. On `removal-date`, `verify-scripts.ts --verify` **hard blocks** pre-commit

**Security advisory flow:**
1. Set `security-advisory: CVE-XXXX` (status can remain `active` or become `deprecated`)
2. `bun run dev-sync` **hard blocks** in L1/L2 until the script is updated or removed
3. Unlike deprecation, security advisories take immediate effect with no grace period

---

## Guide

### Everyday Development Scripts (Tier 2 — `bun run <script>`)

#### `audit.ts`
**Purpose**: Documentation audit gate. Checks CHANGELOG.md, CONSTITUTION.md, AGENTS.md,
agent frontmatter, skill health, and template lifecycle validation.
**Usage**: `bun run audit`
**Runs automatically**: pre-commit hook, pre-push hook, `bun run dev-sync`

#### `dev-sync.ts`
**Purpose**: Full sync pipeline — session log → MEMORY.md index → CHANGELOG auto-add →
audit gate → sensitive file check → branch creation → commit → push → PR.
**Usage**: `bun run dev-sync "feat: description"`
**Claude Code / Gemini**: `/sync "feat: description"`

#### `sync-md.ts`
**Purpose**: Updates `memory/MEMORY.md` index with today's session entry.
**Usage**: Called automatically by `bun run dev-sync`. Rarely invoked directly.

#### `gen-pr-body.ts`
**Purpose**: Generates PR body from commit log and memory log. Called by `dev-sync.ts`.
**Usage**: Invoked automatically. Can be called standalone: `bun run gen-pr-body "msg"`

#### `generate-scripts-readme.ts`
**Purpose**: Auto-generates scripts/README.md from SCRIPTS.md registry.
**Usage**: `bun scripts/generate-scripts-readme.ts`
**Runs automatically**: `bun run dev-sync`

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
**Note**: L1-only script (not in templates); changes must be versioned in SCRIPTS.md manually.

#### `sync-skills.ts`
**Purpose**: Distributes skills from the L1 SSOT (`skills/`) to runtime locations
(`.claude/skills/` and `.gemini/skills/`). Run after any change to `skills/` or
`templates/common/skills/` to ensure Claude Code and Gemini CLI pick up the update.
**Usage**: `bun run sync-skills`

#### `publish-to-template.ts`
**Purpose**: A consolidated tool handling both L0->L1 publishing and L1->L2 propagation. Publishes L0 scripts (workspace `scripts/`) to the L1 template snapshot (`templates/common/scripts/`) and propagates updates to L2 project directories. Copies all scripts labeled `L0` in the Registry plus `SCRIPTS.md` itself. Also copies compiled command files from `.claude/commands/` and `.gemini/commands/` to `templates/common/`.
**Usage**: `bun run publish-to-template`
**Dry-run**: `bun run publish-to-template -- --dry-run`
**Note**: L1-only script (not propagated to template).

#### `verify-memory.ts`
**Purpose**: Validates `memory/*.md` session logs for mandatory 4-section format compliance
(`## Session Summary`, `## Changes`, `## Decisions`, `## Open Issues`) and detects
orphaned files not registered in `MEMORY.md` index.
**Usage**: `bun scripts/verify-memory.ts [--verify | --report]`
**Runs automatically**: pre-commit hook when `memory/*.md` files are staged.

#### `archive-memory.ts`
**Purpose**: Archives memory markdown files older than 7 days to keep the root memory directory clean and within context limits.
**Usage**: `bun scripts/archive-memory.ts`

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
*Last updated: 2026-06-04 — added Check A formal-consistency-only clarification comment*
