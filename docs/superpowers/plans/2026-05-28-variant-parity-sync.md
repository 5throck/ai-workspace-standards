# Variant Parity Sync — Full Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring co-work, co-design, and co-security variants into full structural parity with co-develop (the reference standard), and introduce a Variant Contract + lifecycle status system to prevent future drift.

**Architecture:** co-develop defines the canonical variant structure. Every variant must implement the same platform files (`.claude/`, `.gemini/`, `CLAUDE.md`, `GEMINI.md`, `agents/README.md`). co-security additionally requires a complete rebuild of its CLAUDE.md, GEMINI.md, four missing skills, and registration in new-project scripts. A new `templates/common/VARIANT_CONTRACT.md` codifies the required file set; `scripts/validate-templates.ts` is extended to enforce it automatically.

**Tech Stack:** Bash/PowerShell (scripts), Markdown (template files), TypeScript (validate-templates.ts)

---

## File Map

### New files to create

| File | Purpose |
|------|---------|
| `templates/common/VARIANT_CONTRACT.md` | Canonical required-file spec for all variants |
| `templates/co-work/.claude/settings.json` | Claude Code shared settings |
| `templates/co-work/.claude/commands/changelog.md` | Slash command |
| `templates/co-work/.claude/commands/memlog.md` | Slash command |
| `templates/co-work/.claude/commands/new-task.md` | Slash command |
| `templates/co-work/.claude/commands/sync.md` | Slash command |
| `templates/co-work/.claude/commands/security-check.md` | ~~Slash command~~ — **NOT added** (Optional, co-work has no security-monitor agent) |
| `templates/co-work/.gemini/settings.json` | Antigravity shared settings |
| `templates/co-work/.gemini/commands/changelog.md` | Gemini slash command |
| `templates/co-work/.gemini/commands/memlog.md` | Gemini slash command |
| `templates/co-work/.gemini/commands/new-task.md` | Gemini slash command |
| `templates/co-work/.gemini/commands/sync.md` | Gemini slash command |
| `templates/co-work/.gemini/commands/security-check.md` | ~~Gemini slash command~~ — **NOT added** (Optional) |
| `templates/co-work/agents/README.md` | Agent directory index |
| `templates/co-work/agents/README_ko.md` | Korean translation |
| `templates/co-design/.claude/settings.json` | (same pattern as co-work) |
| `templates/co-design/.claude/commands/changelog.md` | Slash command |
| `templates/co-design/.claude/commands/memlog.md` | Slash command |
| `templates/co-design/.claude/commands/new-task.md` | Slash command |
| `templates/co-design/.claude/commands/sync.md` | Slash command |
| `templates/co-design/.claude/commands/security-check.md` | ~~Slash command~~ — **NOT added** (Optional, co-design has no security-monitor agent) |
| `templates/co-design/.gemini/settings.json` | Antigravity shared settings |
| `templates/co-design/.gemini/commands/changelog.md` | Gemini slash command |
| `templates/co-design/.gemini/commands/memlog.md` | Gemini slash command |
| `templates/co-design/.gemini/commands/new-task.md` | Gemini slash command |
| `templates/co-design/.gemini/commands/sync.md` | Gemini slash command |
| `templates/co-design/.gemini/commands/security-check.md` | ~~Gemini slash command~~ — **NOT added** (Optional) |
| `templates/co-design/agents/README.md` | Agent directory index |
| `templates/co-design/agents/README_ko.md` | Korean translation |
| `templates/co-security/CLAUDE.md` | Claude Code config (security-specific) |
| `templates/co-security/GEMINI.md` | Antigravity config (security-specific) |
| `templates/co-security/.claude/settings.json` | Claude Code shared settings |
| `templates/co-security/.claude/commands/changelog.md` | Slash command |
| `templates/co-security/.claude/commands/memlog.md` | Slash command |
| `templates/co-security/.claude/commands/new-task.md` | Slash command |
| `templates/co-security/.claude/commands/sync.md` | Slash command |
| `templates/co-security/.claude/commands/security-check.md` | Security-hardened slash command |
| `templates/co-security/.gemini/settings.json` | Antigravity shared settings |
| `templates/co-security/.gemini/commands/changelog.md` | Gemini slash command |
| `templates/co-security/.gemini/commands/memlog.md` | Gemini slash command |
| `templates/co-security/.gemini/commands/new-task.md` | Gemini slash command |
| `templates/co-security/.gemini/commands/sync.md` | Gemini slash command |
| `templates/co-security/.gemini/commands/security-check.md` | Gemini slash command |
| `templates/co-security/agents/README.md` | Agent directory index (security roster) |
| `templates/co-security/agents/README_ko.md` | Korean translation |
| `templates/co-security/skills/verify-authorization/SKILL.md` | Critical gate: blocks Phase 1+ without signed auth |
| `templates/co-security/skills/meeting-facilitation/SKILL.md` | Multi-agent meeting skill |
| `templates/co-security/skills/agent-lifecycle-manager/SKILL.md` | Agent lifecycle management |
| `templates/co-security/skills/skill-lifecycle-manager/SKILL.md` | Skill lifecycle management |

### Files to modify

| File | Change |
|------|--------|
| `templates/co-security/variant.json` | `"status": "stable"` → `"status": "draft"` |
| `scripts/new-project.sh` | Add co-security to valid variants list (lines 33, 50, 106) |
| `scripts/new-project.ps1` | Same — add co-security to valid variants list |
| `scripts/validate-templates.ts` | Add Variant Contract enforcement check |

---

## Task 1 — Variant Contract Document

**Files:**
- Create: `templates/common/VARIANT_CONTRACT.md`

- [ ] **Step 1: Create the Variant Contract**

Create `templates/common/VARIANT_CONTRACT.md` with the following content:

```markdown
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
| `docs/<variant>.context.md` | Project-specific context file (immutable after project creation) |
| `.claude/settings.json` | Shared Claude Code settings (MCP servers, hooks) |
| `.claude/commands/changelog.md` | `/changelog` slash command |
| `.claude/commands/memlog.md` | `/memlog` slash command |
| `.claude/commands/new-task.md` | `/new-task` slash command |
| `.claude/commands/sync.md` | `/sync` slash command |
| `.claude/commands/meeting.md` | `/meeting` slash command |
| `.gemini/settings.json` | Shared Antigravity settings (same content as `.claude/settings.json`) |
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
| `deprecated` | No new project creation; existing projects continue |

## Enforcement

`scripts/validate-templates.ts` reads this contract and checks every variant.
Run: `bun run scripts/validate-templates.ts` (or `bash scripts/validate-templates.sh`)
```

- [ ] **Step 2: Commit**

```bash
git add templates/common/VARIANT_CONTRACT.md
git commit -m "docs: add Variant Contract to templates/common"
```

---

## Task 2 — co-work Parity

**Files:**
- Create: `templates/co-work/.claude/settings.json`
- Create: `templates/co-work/.claude/commands/changelog.md` (and 4 more)
- Create: `templates/co-work/.gemini/settings.json`
- Create: `templates/co-work/.gemini/commands/` (5 files)
- Create: `templates/co-work/agents/README.md`
- Create: `templates/co-work/agents/README_ko.md`

- [ ] **Step 1: Copy `.claude/settings.json` from co-develop**

```bash
cp templates/co-develop/.claude/settings.json templates/co-work/.claude/settings.json
```

- [ ] **Step 2: Copy standard `.claude/commands/` files**

The following 5 commands have identical content across all variants (only `sync.md` differs slightly — see note below). Copy from co-develop:

```bash
cp templates/co-develop/.claude/commands/changelog.md  templates/co-work/.claude/commands/changelog.md
cp templates/co-develop/.claude/commands/memlog.md     templates/co-work/.claude/commands/memlog.md
cp templates/co-develop/.claude/commands/new-task.md   templates/co-work/.claude/commands/new-task.md
cp templates/co-develop/.claude/commands/sync.md       templates/co-work/.claude/commands/sync.md
```

> **Note on sync.md:** co-work does not have a `security-monitor` agent. The sync.md's Pre-PR Security Gate section references `agents/security-monitor.md`. After copying, open `templates/co-work/.claude/commands/sync.md` and remove the "Pre-PR Security Gate" section (the block beginning with `## Pre-PR Security Gate (public repos only)` through end of that section). co-work has no security-monitor agent so the gate is not applicable.

- [ ] **Step 3: Create `.gemini/` directory and settings**

```bash
mkdir -p templates/co-work/.gemini/commands
cp templates/co-develop/.gemini/settings.json templates/co-work/.gemini/settings.json
```

- [ ] **Step 4: Copy `.gemini/commands/` files**

```bash
cp templates/co-develop/.gemini/commands/changelog.md      templates/co-work/.gemini/commands/changelog.md
cp templates/co-develop/.gemini/commands/memlog.md         templates/co-work/.gemini/commands/memlog.md
cp templates/co-develop/.gemini/commands/new-task.md       templates/co-work/.gemini/commands/new-task.md
cp templates/co-develop/.gemini/commands/sync.md           templates/co-work/.gemini/commands/sync.md
```

Apply the same sync.md edit as Step 2 — remove the Pre-PR Security Gate section from `templates/co-work/.gemini/commands/sync.md`.

- [ ] **Step 5: Create `agents/README.md`**

Create `templates/co-work/agents/README.md` modeled on `templates/co-develop/agents/README.md` but listing co-work's actual agents (pm, analyst, content-writer, ms365-expert, project-coordinator, storyteller, technical-writer):

```markdown
# Agents Directory

This directory contains agent definition files for the co-work collaboration workflow.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Collaboration PM | `pm.md` | Owns research workflow, documentation strategy, stakeholder alignment |
| Analyst | `analyst.md` | Research synthesis, data analysis, evidence gathering |
| Content Writer | `content-writer.md` | Drafts reports, articles, and structured content |
| MS365 Expert | `ms365-expert.md` | Microsoft 365 tools, SharePoint, Teams integrations |
| Project Coordinator | `project-coordinator.md` | Task tracking, timeline management, meeting facilitation |
| Storyteller | `storyteller.md` | Narrative structure, audience-appropriate communication |
| Technical Writer | `technical-writer.md` | Technical documentation, API docs, process guides |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>
```

After creating: update `AGENTS.md` and `docs/co-work.context.md § Agents`.

See `AGENTS.md` for the full workflow and dispatch protocol.
```

- [ ] **Step 6: Create `agents/README_ko.md`**

Create `templates/co-work/agents/README_ko.md` as a Korean translation of Step 5.

```markdown
# Agents Directory

This directory contains agent definition files for the co-work collaboration workflow.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Collaboration PM | `pm.md` | Research workflow, documentation strategy, stakeholder alignment |
| Analyst | `analyst.md` | Research synthesis, data analysis, evidence gathering |
| Content Writer | `content-writer.md` | Drafts reports, articles, and structured content |
| MS365 Expert | `ms365-expert.md` | Microsoft 365 tools, SharePoint, Teams integrations |
| Project Coordinator | `project-coordinator.md` | Task tracking, timeline management, meeting facilitation |
| Storyteller | `storyteller.md` | Narrative structure, audience-appropriate communication |
| Technical Writer | `technical-writer.md` | Technical documentation, API docs, process guides |

## Creating New Agents

After creating an agent, update `AGENTS.md` and `docs/co-work.context.md § Agents`.

See `AGENTS.md` for the full workflow.
```

- [ ] **Step 7: Verify structure**

```bash
find templates/co-work -type f | sort
```

Expected additions vs co-develop baseline: `.claude/settings.json`, 5× `.claude/commands/`, `.gemini/settings.json`, 5× `.gemini/commands/`, `agents/README.md`, `agents/README_ko.md`.

- [ ] **Step 8: Commit**

```bash
git add templates/co-work/
git commit -m "feat(co-work): add missing .claude, .gemini config and agents README for variant parity"
```

---

## Task 3 — co-design Parity

**Files:** Same pattern as Task 2 but for co-design agents (pm, design-lead, prototype-engineer, service-designer, storyteller, typography-expert, ux-researcher, visual-designer).

- [ ] **Step 1: Copy shared config files**

```bash
cp templates/co-develop/.claude/settings.json templates/co-design/.claude/settings.json
cp templates/co-develop/.claude/commands/changelog.md  templates/co-design/.claude/commands/changelog.md
cp templates/co-develop/.claude/commands/memlog.md     templates/co-design/.claude/commands/memlog.md
cp templates/co-develop/.claude/commands/new-task.md   templates/co-design/.claude/commands/new-task.md
cp templates/co-develop/.claude/commands/sync.md       templates/co-design/.claude/commands/sync.md
```

Apply same sync.md edit: remove Pre-PR Security Gate section from `templates/co-design/.claude/commands/sync.md` (co-design has no security-monitor agent).

- [ ] **Step 2: Create `.gemini/` structure**

```bash
mkdir -p templates/co-design/.gemini/commands
cp templates/co-develop/.gemini/settings.json          templates/co-design/.gemini/settings.json
cp templates/co-develop/.gemini/commands/changelog.md  templates/co-design/.gemini/commands/changelog.md
cp templates/co-develop/.gemini/commands/memlog.md     templates/co-design/.gemini/commands/memlog.md
cp templates/co-develop/.gemini/commands/new-task.md   templates/co-design/.gemini/commands/new-task.md
cp templates/co-develop/.gemini/commands/sync.md       templates/co-design/.gemini/commands/sync.md
```

Apply same sync.md edit: remove Pre-PR Security Gate section from `templates/co-design/.gemini/commands/sync.md`.

- [ ] **Step 3: Create `agents/README.md`**

Create `templates/co-design/agents/README.md` listing co-design's agents:

```markdown
# Agents Directory

This directory contains agent definition files for the co-design workflow.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Design PM | `pm.md` | Owns design workflow; dispatches design specialist agents |
| Design Lead | `design-lead.md` | Design system authority, visual consistency, component standards |
| Prototype Engineer | `prototype-engineer.md` | Interactive prototypes, component implementation |
| Service Designer | `service-designer.md` | End-to-end service blueprints, journey maps |
| Storyteller | `storyteller.md` | Design narrative, presentation strategy, stakeholder alignment |
| Typography Expert | `typography-expert.md` | Type systems, font pairing, readability standards |
| UX Researcher | `ux-researcher.md` | User research, usability testing, insight synthesis |
| Visual Designer | `visual-designer.md` | Visual identity, color systems, layout composition |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>
```

After creating: update `AGENTS.md` and `docs/co-design.context.md § Agents`.

See `AGENTS.md` for the full workflow and dispatch protocol.
```

- [ ] **Step 4: Create `agents/README_ko.md`**

```markdown
# Agents Directory

This directory contains agent definition files for the co-design workflow.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Design PM | `pm.md` | Owns design workflow; dispatches design specialist agents |
| Design Lead | `design-lead.md` | Design system authority, visual consistency, component standards |
| Prototype Engineer | `prototype-engineer.md` | Interactive prototypes, component implementation |
| Service Designer | `service-designer.md` | End-to-end service blueprints, journey maps |
| Storyteller | `storyteller.md` | Design narrative, presentation strategy, stakeholder alignment |
| Typography Expert | `typography-expert.md` | Type systems, font pairing, readability standards |
| UX Researcher | `ux-researcher.md` | User research, usability testing, insight synthesis |
| Visual Designer | `visual-designer.md` | Visual identity, color systems, layout composition |

## Creating New Agents

After creating an agent, update `AGENTS.md` and `docs/co-design.context.md § Agents`.
```

- [ ] **Step 5: Verify and commit**

```bash
find templates/co-design -type f | sort
git add templates/co-design/
git commit -m "feat(co-design): add missing .claude, .gemini config and agents README for variant parity"
```

---

## Task 4 — co-security Rebuild

This is the most complex task. co-security needs everything from Tasks 2–3 PLUS platform config files (CLAUDE.md, GEMINI.md) and four missing skills.

### 4a — Platform Config Files

- [ ] **Step 1: Create `CLAUDE.md`**

Create `templates/co-security/CLAUDE.md`. Base structure from `templates/co-develop/CLAUDE.md` with these security-specific changes:
- Section 1 context load order: `docs/context.md` → `docs/co-security.context.md` → `AGENTS.md`
- Slash Commands table: replace with co-security commands (add `/verify-authorization` entry)
- Add a **Security Engagement Rules** section:

```markdown
# CLAUDE.md

> **Doc intent:** This file is Claude Code-specific behavioral configuration for **individual co-security projects**.
> Workspace-level Claude Code behaviors → [`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md)

## Session Start — Context Loading Order

At the start of every session, read these files **in order**:

1. **[`docs/context.md`](docs/context.md)** — Immutable project identity. Do NOT modify.
2. **[`docs/co-security.context.md`](docs/co-security.context.md)** — Engagement scope, agents, skills, ansible config. All project-specific changes go here.
3. **[`AGENTS.md`](AGENTS.md)** — Canonical agent index and dispatch protocols.

---

## Project-Specific Claude Code Settings

### CLI vs Desktop App

| Environment | PostToolUse hook fires? | Action if not |
|-------------|:-----------------------:|---------------|
| Claude Code CLI | ✅ Automatic | - |
| Claude Code Desktop App | ❌ Never | Run `bash scripts/audit.sh` manually before committing |

---

### Claude Code Settings

- `.claude/settings.json` - shared team config (committed to repo)
- `.claude/settings.local.json` - personal write permissions + git/gh access (gitignored)
- `.claude/commands/` - slash commands auto-registered as Skills

---

### Slash Commands (`.claude/commands/`)

| Command | Purpose |
|---------|---------|
| `/changelog "description"` | Add entry to `CHANGELOG.md [Unreleased]` |
| `/sync "feat: ..."` | Full pipeline - memlog → sync-md → changelog → audit → commit → PR |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only |
| `/new-task "task name"` | Create task tracking block in today's memory log |
| `/security-check` | Run security advisory scan (daily or `--pr` pre-PR mode) |

---

### Hooks

```json
// .claude/settings.json - enable PostToolUse audit after every Write/Edit:
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "bash scripts/audit.sh" }]
      }
    ]
  }
}
```

> **Note:** PostToolUse hooks are **disabled by default**. Audit is enforced via `.githooks/pre-commit`.

---

### Git Hooks

Install project hooks once per clone (run from the project root):

```bash
git config core.hooksPath .githooks
```

| Hook | Trigger | Action |
|------|---------|--------|
| `.githooks/pre-commit` | Every commit | Blocks .env files; runs audit + **secret scan (.gitleaks)** |
| `.githooks/pre-push` | Every push | Runs `audit.sh`; aborts on failure |

> ⚠️ `.gitleaks` secret scanning is **mandatory** on all commits. Never disable with `--no-verify`.

---

### Security Engagement Rules

These rules apply in addition to the workspace CLAUDE.md behavioral rules:

1. **Authorization first** — No Phase 1+ work (recon, exploitation, patching) may begin without the `verify-authorization` skill confirming a signed authorization document exists.
2. **Scope enforcement** — Any target not listed in `docs/scope.md` is out-of-scope. PM must update scope and re-run authorization before expanding.
3. **Secret hygiene** — Credentials, API keys, and passwords discovered during engagements must NEVER be committed. Store in `docs/findings/FIND-NNNN.md` with values redacted.
4. **Ansible dry-run first** — All patch automation must run with `--check` flag before live apply.
5. **Engagement log** — All agent actions are logged to `memory/engagement-YYYY-MM-DD.md`.

---

### Git

Follow conventions in `docs/context.md § Git Conventions`.

- **PR Language**: All PR titles, bodies, and review comments must be in English.

---

### Model Selection Override

<!-- agents/*.md use `model: inherit` -->
<!-- Default: claude-sonnet-4-6 | Heavy: claude-opus-4-7 | Fast: claude-haiku-4-5 -->
```

- [ ] **Step 2: Create `GEMINI.md`**

Create `templates/co-security/GEMINI.md`. Base on `templates/co-develop/GEMINI.md` with these changes:
- Context load order: `docs/context.md` → `docs/co-security.context.md` → `AGENTS.md`
- Add a **Security Engagement Rules** section (same 5 rules as CLAUDE.md above)
- Keep all Gemini tool mapping tables and safeguards from the co-develop version unchanged

The header and context load section:

```markdown
# GEMINI.md

> **Doc intent:** This file contains Gemini CLI / Antigravity-specific overrides only.
> Workspace-level Gemini behaviors → [`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md`](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md)

## Session Start — Context Loading Order

At the start of every session, read these files **in order**:

1. **[`docs/context.md`](docs/context.md)** — Immutable project identity. Do NOT modify.
2. **[`docs/co-security.context.md`](docs/co-security.context.md)** — Engagement scope, agents, skills, ansible config.
3. **[`AGENTS.md`](AGENTS.md)** — Canonical agent index and dispatch protocols.
```

Then copy all remaining sections (Tool Name Mapping, Safeguards, Native Antigravity 2.0 Features, Planning Mode) verbatim from `templates/co-develop/GEMINI.md`, and append the Security Engagement Rules section at the end.

- [ ] **Step 3: Commit platform config files**

```bash
git add templates/co-security/CLAUDE.md templates/co-security/GEMINI.md
git commit -m "feat(co-security): add CLAUDE.md and GEMINI.md platform config files"
```

### 4b — Claude/Gemini Commands and Settings

- [ ] **Step 4: Create `.claude/settings.json` and commands**

```bash
cp templates/co-develop/.claude/settings.json templates/co-security/.claude/settings.json
cp templates/co-develop/.claude/commands/changelog.md templates/co-security/.claude/commands/changelog.md
cp templates/co-develop/.claude/commands/memlog.md    templates/co-security/.claude/commands/memlog.md
cp templates/co-develop/.claude/commands/new-task.md  templates/co-security/.claude/commands/new-task.md
cp templates/co-develop/.claude/commands/sync.md      templates/co-security/.claude/commands/sync.md
```

For `security-check.md`, co-security gets a **hardened version** — do NOT copy from co-develop. Create `templates/co-security/.claude/commands/security-check.md`:

```markdown
---
name: security-check
description: Run engagement security gate — verify authorization status and check for exposed secrets before any offensive activity.
argument-hint: "[--pre-phase <phase-number>]"
allowed-tools: ["Bash", "Read", "Glob", "Grep"]
---

# Security Check (Engagement Gate)

Arguments: $ARGUMENTS

This command runs the engagement security gate. It is automatically called before Phase 1+ work.

- **No arguments**: Verify authorization document exists and is valid. Check `docs/scope.md` exists. Report engagement status.
- **`--pre-phase <N>`**: Full pre-phase gate for Phase N. Confirms authorization, scope boundaries, and that no credentials are staged for commit.

Load and follow `agents/pm.md` Authorization Checklist exactly.

Report gate result as PASS ✅ or BLOCKED ❌ with specific blocking reason.
```

- [ ] **Step 5: Create `.gemini/` commands**

```bash
mkdir -p templates/co-security/.gemini/commands
cp templates/co-develop/.gemini/settings.json              templates/co-security/.gemini/settings.json
cp templates/co-develop/.gemini/commands/changelog.md      templates/co-security/.gemini/commands/changelog.md
cp templates/co-develop/.gemini/commands/memlog.md         templates/co-security/.gemini/commands/memlog.md
cp templates/co-develop/.gemini/commands/new-task.md       templates/co-security/.gemini/commands/new-task.md
cp templates/co-develop/.gemini/commands/sync.md           templates/co-security/.gemini/commands/sync.md
```

Create `templates/co-security/.gemini/commands/security-check.md` — same content as the hardened `.claude/` version above (no frontmatter YAML needed for Gemini).

- [ ] **Step 6: Commit**

```bash
git add templates/co-security/.claude/ templates/co-security/.gemini/
git commit -m "feat(co-security): add .claude and .gemini settings and commands"
```

### 4c — Agents README

- [ ] **Step 7: Create `agents/README.md`**

Create `templates/co-security/agents/README.md` listing the security agent roster:

```markdown
# Agents Directory

This directory contains agent definition files for co-security engagement workflows.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Security PM | `pm.md` | Single entry point — owns authorization, scope, and engagement workflow |
| Red Team Lead | `red-team-lead.md` | Attack methodology, MITRE ATT&CK TTPs, PoC review |
| Pentester | `pentester.md` | Vulnerability discovery, PoC development, re-testing |
| Threat Modeler | `threat-modeler.md` | STRIDE analysis, ATT&CK mapping, risk scoring |
| Patch Engineer | `patch-engineer.md` | Ansible-based cross-platform patch deployment |
| Report Writer | `report-writer.md` | Pentest reports, executive summaries |

## ⚠️ Authorization Required

All agents except PM require a confirmed authorization document before dispatching.
PM runs `verify-authorization` skill automatically before any Phase 1+ activity.

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group Security
```

After creating: update `AGENTS.md` and `docs/co-security.context.md § Agents`.

See `AGENTS.md` for the full engagement workflow (Phases 0–6).
```

- [ ] **Step 8: Create `agents/README_ko.md`**

```markdown
# Agents Directory

This directory contains agent definition files for co-security engagement workflows.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Security PM | `pm.md` | Single entry point — owns authorization, scope, and engagement workflow |
| Red Team Lead | `red-team-lead.md` | Attack methodology, MITRE ATT&CK TTPs, PoC review |
| Pentester | `pentester.md` | Vulnerability discovery, PoC development, re-testing |
| Threat Modeler | `threat-modeler.md` | STRIDE analysis, ATT&CK mapping, risk scoring |
| Patch Engineer | `patch-engineer.md` | Ansible-based cross-platform patch deployment |
| Report Writer | `report-writer.md` | Pentest reports, executive summaries |

## ⚠️ Authorization Required

All agents except PM require a confirmed authorization document before dispatching.
PM runs `verify-authorization` skill automatically before any Phase 1+ activity.

See `AGENTS.md` for the full engagement workflow (Phase 0–6).
```

### 4d — Missing Skills

- [ ] **Step 9: Create `skills/verify-authorization/SKILL.md`**

This is the critical gate skill. Create with full executable content:

```markdown
---
name: verify-authorization
description: >
  Hard gate: confirms a signed authorization document exists and contains all required fields
  before allowing any Phase 1+ (recon, exploitation, patching) activity to proceed.
  BLOCKS work if authorization is missing or incomplete.
version: 1.0.0
status: active
owner: pm
prerequisites: engagement-scoping must have been run (docs/scope.md must exist)
---

# 🔒 Skill: verify-authorization

## Context

This skill is the mandatory pre-flight gate for all offensive and remediation activity.
It is invoked automatically by the PM before dispatching any Phase 1+ agent.
No PoC, recon, or patch activity may begin until this skill returns PASS.

## Execution Steps

1. **Check for authorization document**
   Look for `docs/authorization.md` or `docs/auth/authorization.md`.
   If neither exists → **BLOCKED ❌** — "No authorization document found. Run engagement-scoping first."

2. **Validate required fields**
   Read the authorization document and confirm ALL of the following fields are present and non-empty:
   - `Authorizing Party` (name, title, organization)
   - `Engagement Start Date` and `End Date`
   - `In-Scope Targets` (at least one IP/CIDR/domain/application listed)
   - `Out-of-Scope Items` (explicit list or "None — all targets in scope")
   - `Rules of Engagement` (approved and prohibited techniques)
   - `Emergency Contact` (name and contact method)
   - `Authorized Signature` or `Authorization Reference Number`
   If any field is missing → **BLOCKED ❌** — list the specific missing fields.

3. **Check scope document**
   Confirm `docs/scope.md` exists.
   If missing → **BLOCKED ❌** — "Scope document not found. Run engagement-scoping to generate docs/scope.md."

4. **Check engagement window**
   If authorization document includes start/end dates, compare against today's date.
   If today is outside the authorized window → **BLOCKED ❌** — state the authorization window and current date.

5. **Return result**
   - All checks pass → **PASS ✅** — "Authorization confirmed. Engagement window active. Phase N may proceed."
   - Any check fails → **BLOCKED ❌** — list all failures. Do NOT proceed to Phase 1+.

## Output Format

```
## Authorization Gate Result

**Status**: PASS ✅ | BLOCKED ❌

**Authorizing Party**: [name]
**Engagement Window**: [start] – [end]
**In-Scope**: [summary]
**Checks**:
- [x] Authorization document found
- [x] All required fields present
- [x] Scope document exists
- [x] Engagement window active

**Decision**: Phase [N] MAY proceed | HALT — do not dispatch any Phase 1+ agents
```

## Related Skills

- `engagement-scoping` — creates the authorization document this skill validates
- `recon-surface` — must pass verify-authorization before executing
- `finding-tracker` — must pass verify-authorization before Phase 3
- `patch-automation` — must pass verify-authorization before applying patches
```

- [ ] **Step 10: Create `skills/meeting-facilitation/SKILL.md`**

```markdown
---
name: meeting-facilitation
description: >
  Runs a structured multi-agent meeting where Claude role-plays each participant inline.
  No Agent tool spawning — the entire meeting unfolds as real-time dialogue visible to the user.
version: 1.0.0
status: active
owner: pm
prerequisites: agents/*.md files must exist for all named participants
---

# 🗣️ Skill: meeting-facilitation

## Context

Use this skill when the PM needs to facilitate a structured discussion between security agents
(e.g., red-team-lead and threat-modeler aligning on attack paths, or a post-engagement retrospective).

## Execution Steps

See workspace skill `meeting-facilitation` (`.claude/plugins/.../meeting-facilitation`) for full execution instructions.

This entry registers the skill in the co-security context and triggers it via the `/meeting` command.

## Invocation

```
/meeting "topic" --agents red-team-lead,threat-modeler --rounds 2
```

## Notes

- PM opens and closes every meeting but does not contribute opinions during dialogue
- All offensive discussions in meetings remain bound by authorization constraints
- Meeting transcripts are saved to `memory/meeting-YYYY-MM-DD-<slug>.md`
```

- [ ] **Step 11: Create `skills/agent-lifecycle-manager/SKILL.md`**

```markdown
---
name: agent-lifecycle-manager
description: >
  Guides the PM through creating, modifying, validating, and deprecating agents in the
  co-security variant. Ensures agents follow the required frontmatter schema and are
  registered in AGENTS.md and docs/co-security.context.md.
version: 1.0.0
status: active
owner: pm
prerequisites: none
---

# 🔄 Skill: agent-lifecycle-manager

## Context

Use when adding a new specialist agent (e.g., a cloud-pentester or OSINT-analyst) or
deprecating an existing one. Ensures the roster stays consistent.

## Execution Steps

### Creating an Agent

1. Create `agents/<name>.md` with required frontmatter:
   ```yaml
   ---
   name: <name>
   formal_name: <Display Name>
   tier:
     claude: high | medium | low
     gemini-cli: high | medium | low
   model: inherit
   color: <color>
   description: '<one-line description>'
   ---
   ```
2. Add `## Role`, `## Responsibilities`, `## Constraints`, `## Dispatch Protocol`, `## Meeting Participation` sections.
3. Update `AGENTS.md` — add row to Agent Roster table.
4. Update `docs/co-security.context.md § Agents` — add row to Agents table with `status: active`.
5. Update `agents/README.md` — add row to Available Agents table.

### Deprecating an Agent

1. In `docs/co-security.context.md § Agents`, change agent `status` to `deprecated`.
2. In `AGENTS.md`, move agent row to a `### Deprecated` subsection.
3. Do NOT delete the `agents/<name>.md` file — retain for reference.

### Validation

After any change, verify:
- [ ] `AGENTS.md` roster matches files in `agents/`
- [ ] `docs/co-security.context.md § Agents` matches `AGENTS.md`
- [ ] `agents/README.md` is up to date
```

- [ ] **Step 12: Create `skills/skill-lifecycle-manager/SKILL.md`**

```markdown
---
name: skill-lifecycle-manager
description: >
  Guides the PM through creating, modifying, validating, and deprecating skills in the
  co-security variant. Ensures skills follow the required frontmatter schema and are
  registered in AGENTS.md § Skills.
version: 1.0.0
status: active
owner: pm
prerequisites: none
---

# 🔄 Skill: skill-lifecycle-manager

## Context

Use when adding a new domain skill (e.g., a cloud-recon or malware-analysis skill) or
deprecating an existing one.

## Execution Steps

### Creating a Skill

1. Create `skills/<name>/SKILL.md` with required frontmatter:
   ```yaml
   ---
   name: <name>
   description: >
     <multi-line description — what this skill does and when to invoke it>
   version: 1.0.0
   status: active
   owner: <agent-name>
   prerequisites: <what must exist before this skill can run>
   ---
   ```
2. Add sections: `## Context`, `## Execution Steps`, `## Output Format`, `## Related Skills`.
3. Update `AGENTS.md § Skills` — add row to Skills table with trigger condition.
4. Update `docs/co-security.context.md § Skills` — add row.

### Deprecating a Skill

1. Change `status: active` → `status: deprecated` in the skill's frontmatter.
2. In `AGENTS.md § Skills`, add `(deprecated)` to the skill name.
3. Update any skills that reference this one in their `## Related Skills` section.

### Validation

After any change:
- [ ] All skills referenced in `AGENTS.md` have a corresponding `SKILL.md` file
- [ ] All `SKILL.md` files have valid frontmatter (name, description, version, status, owner)
```

- [ ] **Step 13: Update `variant.json` status**

Edit `templates/co-security/variant.json`:

```json
{
  "name": "co-security",
  "description": "Security engineering workflow — Red Team operations, threat modeling, and cross-platform patch automation (Windows/macOS/Linux via SSH + Ansible)",
  "status": "draft",
  "version": "0.1.0"
}
```

- [ ] **Step 14: Commit all co-security additions**

```bash
git add templates/co-security/
git commit -m "feat(co-security): complete variant rebuild — CLAUDE.md, GEMINI.md, commands, missing skills, status→draft"
```

---

## Task 5 — Script Updates

### 5a — new-project.sh

**File:** `scripts/new-project.sh`

- [ ] **Step 1: Add co-security to valid variants (line 33)**

Find:
```bash
echo "Usage: bash scripts/new-project.sh \"<project-name>\" [--variant co-develop|co-design|co-work] [--platform claude|antigravity|both] [--version X.Y.Z]"
```
Replace with:
```bash
echo "Usage: bash scripts/new-project.sh \"<project-name>\" [--variant co-develop|co-design|co-work|co-security] [--platform claude|antigravity|both] [--version X.Y.Z]"
```

- [ ] **Step 2: Update the guard check (around line 50)**

Find:
```bash
if [ "$prev_arg" = "--variant" ] && [ "$VARIANT" = "co-develop" ]; then
  echo "❌ --variant requires a value. Available: co-develop, co-design, co-work"
```
Replace with:
```bash
if [ "$prev_arg" = "--variant" ] && [ "$VARIANT" = "co-develop" ]; then
  echo "❌ --variant requires a value. Available: co-develop, co-design, co-work, co-security"
```

- [ ] **Step 3: Update the "not found" error message (around line 106)**

Find:
```bash
echo "   Available variants: co-develop (stable), co-design (stable), co-work (stable)"
```
Replace with:
```bash
echo "   Available variants: co-develop (stable), co-design (stable), co-work (stable), co-security (draft)"
```

### 5b — new-project.ps1

- [ ] **Step 4: Update `scripts/new-project.ps1`**

First, read `scripts/new-project.ps1` with the Read tool to confirm line numbers, then apply these three changes:

**Change 1 — "Available variants" error message (line 94):**

Find:
```powershell
Write-Host "   Available variants: co-develop (stable), co-design (stable), co-work (stable)" -ForegroundColor Yellow
```
Replace with:
```powershell
Write-Host "   Available variants: co-develop (stable), co-design (stable), co-work (stable), co-security (draft)" -ForegroundColor Yellow
```

> Note: `new-project.ps1` uses a `[string]$Variant = "co-develop"` parameter declaration — there is no separate usage string or guard check line like the `.sh` version. Only the one error message at line 94 needs to be updated.

### 5c — Validate-templates Contract Check

**File:** `scripts/validate-templates.ts`

- [ ] **Step 5: Read current validate-templates.ts to understand structure**

Use the Read tool to read `scripts/validate-templates.ts` in full before making any edits. Understand the existing validation loop structure (how it iterates variants, what it currently checks) so the new contract check integrates consistently.

- [ ] **Step 6: Add Variant Contract file check**

After understanding the current structure, add a function `checkVariantContract(variantDir: string): string[]` that:
1. Reads `templates/common/VARIANT_CONTRACT.md`
2. Extracts the Required Files table (between `## Required Files` and `## Optional Files`)
3. For each listed path, checks that the file exists under `variantDir`
4. Returns an array of missing file paths

Call this function for each variant and fail validation if any required file is missing.

The check should print:
```
✅ co-develop: Variant Contract satisfied (22/22 required files present)
❌ co-security: Variant Contract FAILED — missing 3 required files:
     - .claude/commands/changelog.md
     - .gemini/settings.json
     - agents/README.md
```

- [ ] **Step 7: Commit script changes**

```bash
git add scripts/new-project.sh scripts/new-project.ps1 scripts/validate-templates.ts
git commit -m "feat(scripts): register co-security variant and add Variant Contract enforcement to validate-templates"
```

---

## Task 6 — Verification

- [ ] **Step 1: Run validate-templates against all variants**

```bash
bun run scripts/validate-templates.ts
```

Expected: all 4 variants pass Variant Contract checks (co-security shows `draft` status).

- [ ] **Step 2: Test new-project with co-security**

```bash
bash scripts/new-project.sh "test-security-project" --variant co-security
```

Expected: project scaffolds successfully with full structure. Verify:
```bash
find test-security-project -type f | sort
```

- [ ] **Step 3: Clean up test project**

```bash
rm -rf test-security-project
```

- [ ] **Step 4: Run existing audit**

```bash
bash scripts/audit.sh
```

Expected: exits 0.

- [ ] **Step 5: Final commit and PR**

```bash
/sync "feat: variant parity sync — co-work, co-design, co-security aligned with co-develop; Variant Contract introduced"
```

---

## Summary of All Changes

| Variant | Files Added | Files Modified |
|---------|-------------|----------------|
| `co-work` | 12 (settings ×2, commands ×10, agents/README ×2) | 0 |
| `co-design` | 12 (same pattern) | 0 |
| `co-security` | 24 (CLAUDE.md, GEMINI.md, settings ×2, commands ×10, agents/README ×2, skills ×4) | variant.json (status: stable→draft) |
| `templates/common` | 1 (VARIANT_CONTRACT.md) | 0 |
| `scripts` | 0 | new-project.sh, new-project.ps1, validate-templates.ts |

**Total: ~49 files created or modified**
