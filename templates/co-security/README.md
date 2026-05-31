---
content_hash: PLACEHOLDER
sync_version: 1
---

# {{PROJECT_NAME}}

AI-assisted security engagement workspace template. Optimized for Red Team operations, threat modeling, and cross-platform patch automation with a structured multi-agent architecture.

## Overview

The co-security template provides a ready-to-use workspace for security engagements that leverage AI assistants throughout the full offensive/defensive cycle. It pairs Claude Code (via `CLAUDE.md`) with a structured multi-agent system covering scoping through verification, giving every engagement consistent commands, agent roles, authorization gates, and quality controls from day one.

Key characteristics:

- **Authorization-gated workflow** — A `verify-authorization` skill MUST pass before any Phase 1+ activity begins. No recon, exploitation, or patching proceeds without a signed authorization document.
- **Multi-agent architecture** — Specialized agents (Security PM, Red Team Lead, Pentester, Threat Modeler, Patch Engineer, Report Writer) handle distinct engagement phases, preventing context bleed between offensive and remediation work.
- **End-to-end phase coverage** — Six phases from Scoping through Verification/re-test, with explicit handoff criteria at each gate.
- **Cross-platform patch automation** — Remediation phase supports Windows, macOS, and Linux targets via SSH and Ansible playbooks managed under `ansible/`.
- **Slash-command driven** — Common operations are exposed as slash commands so daily engagement work stays fast, auditable, and consistent.

> **Status:** Beta (v0.2.0) — core workflow is stable; some agent roles and Ansible modules are under active refinement.

## Quick Start

> **Note:** The command below must be run from the **workspace root**, not from within a generated co-security project. Generated projects do not contain a `scripts/` directory.

```bash
bash scripts/new-project.sh "engagement-name" --variant co-security
```

This scaffolds a new engagement directory under the workspace root, copies all co-security template files, and performs initial variable substitution (engagement name, dates, client placeholder).

After scaffolding:

1. Open the new engagement directory in your editor.
2. Complete `docs/scope.md` with target systems, rules of engagement, and out-of-scope boundaries.
3. Obtain and store the signed authorization document at `docs/authorization.md`.
4. Run `/sync "chore: initial scaffold"` to create the first commit and PR.
5. Run `verify-authorization` skill before beginning Phase 1.

## Authorization Gate

> **This gate is non-negotiable.** The `verify-authorization` skill checks that `docs/authorization.md` exists, is non-empty, and contains required fields (scope hash, authorized-by, expiry date). Any agent or command that initiates Phase 1 or later activity MUST invoke this skill first and halt if it returns a failure status.

```
verify-authorization          # run before any recon, exploitation, or patching
```

If authorization is missing or expired, all offensive activity must stop until the document is updated and the skill passes.

## Phase Workflow

| Phase | Name | Description | Gate |
|-------|------|-------------|------|
| **0** | Scoping | Define targets, rules of engagement, success criteria | Signed scope doc |
| **1** | Recon | Passive and active reconnaissance of attack surface | `verify-authorization` passes |
| **2** | Threat Modeling | STRIDE / PASTA analysis; attack tree construction | Phase 1 findings committed |
| **3** | Exploitation | Controlled exploitation of in-scope vulnerabilities | PM sign-off on threat model |
| **4** | Remediation | Patch development and cross-platform deployment | Exploitation report committed |
| **5** | Reporting | Full engagement report with CVSS scores and remediation steps | All findings in `docs/findings/` |
| **6** | Verification | Re-test patched systems; confirm closure of all findings | Patch log complete in `PATCH_LOG.md` |

## Project Structure

```
<engagement-name>/
├── CLAUDE.md                   # Claude Code behavioral config
├── CONSTITUTION.md             # Shared workspace standards (symlinked from root)
├── AGENTS.md                   # Agent roster and dispatch rules
├── CHANGELOG.md                # Unreleased + versioned history
├── PATCH_LOG.md                # Chronological log of all patches applied
├── agents/                     # Per-agent role definition files
│   ├── pm.md                   # Security PM — orchestration and gate enforcement
│   ├── red-team-lead.md        # Red Team Lead — offensive strategy and Phase 3 oversight
│   ├── pentester.md            # Pentester — hands-on exploitation and PoC development
│   ├── threat-modeler.md       # Threat Modeler — STRIDE/PASTA, attack trees
│   ├── patch-engineer.md       # Patch Engineer — remediation scripts and Ansible playbooks
│   └── report-writer.md        # Report Writer — findings documentation and executive summary
├── ansible/                    # Ansible playbooks for cross-platform patch deployment
│   ├── inventory/              # Host inventories (Windows, macOS, Linux)
│   ├── playbooks/              # Remediation playbooks per finding
│   └── roles/                  # Reusable Ansible roles
├── docs/                       # Engagement documentation
│   ├── authorization.md        # Signed authorization document (REQUIRED before Phase 1)
│   ├── scope.md                # Target systems, rules of engagement, out-of-scope items
│   └── findings/               # Individual finding files (one per vulnerability)
├── memory/                     # Daily session logs (YYYY-MM-DD.md)
└── scripts/                    # Utility scripts (audit.sh, dev-sync.sh, …)
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR |
| `/changelog "..."` | Add an entry to `CHANGELOG.md` under `[Unreleased]` |
| `/memlog "summary"` | Append a session summary to today's memory log only |
| `/new-task "name"` | Create a task tracking block in today's memory log |
| `/security-check` | Run security advisory scan (daily or `--pr` pre-PR mode) |

All commands are defined in `.claude/commands/` and are auto-registered as Skills by Claude Code.

## Skills

| Skill | Phase | Description |
|-------|-------|-------------|
| `verify-authorization` | Gate | Validates `docs/authorization.md` before any offensive activity |
| `engagement-scoping` | 0 | Assists with completing `docs/scope.md` and setting phase criteria |
| `recon-surface` | 1 | Guides attack surface enumeration and passive/active recon |
| `threat-modeling` | 2 | Runs STRIDE/PASTA analysis and generates attack trees |
| `finding-tracker` | 3–4 | Creates and updates finding files in `docs/findings/` with CVSS scores |
| `patch-automation` | 4 | Generates and validates Ansible playbooks for cross-platform remediation |
| `pentest-report` | 5 | Assembles the full engagement report from findings and PATCH_LOG.md |

## Agents

The co-security template ships with six specialized agents. Each agent's role definition lives in `agents/<name>.md`.

| Agent | Responsibility |
|-------|---------------|
| **PM (Security PM)** | Orchestrates engagement phases, enforces authorization gate, manages task sequencing and stakeholder reporting |
| **Red Team Lead** | Defines offensive strategy, oversees Phase 3 exploitation, ensures rules-of-engagement compliance |
| **Pentester** | Hands-on exploitation, PoC development, raw findings documentation |
| **Threat Modeler** | STRIDE/PASTA analysis, attack tree construction, risk prioritization |
| **Patch Engineer** | Remediation script development, Ansible playbook authoring, cross-platform patch deployment (Windows/macOS/Linux via SSH) |
| **Report Writer** | Technical and executive report authoring, CVSS scoring, remediation-step documentation |

Dispatch agents via the native `Agent` tool. Embed the relevant `agents/<name>.md` content in the prompt rather than referencing the file path — sub-agents do not share filesystem context with the parent session.

## Configuration

### CLAUDE.md

Controls Claude Code behavior: automated hooks, slash command definitions, plan-mode rules, task tracking conventions, and Git/PR standards. The co-security `CLAUDE.md` additionally enforces the authorization gate check at session start and before any offensive skill invocation.

### docs/authorization.md

Stores the signed authorization document for the engagement. This file is checked by the `verify-authorization` skill. Required fields: scope hash, authorized-by (name and role), engagement window (start/expiry dates), and in-scope target list. The file must be present and valid before any Phase 1+ activity.

### docs/scope.md

Defines target systems, IP ranges, application endpoints, rules of engagement, and explicit out-of-scope boundaries. Completed during Phase 0 with the `engagement-scoping` skill. This file is the authoritative reference for all agents — any activity outside its boundaries is prohibited.

### PATCH_LOG.md

Chronological log of every patch applied during Phase 4. Each entry records the finding ID, affected system(s), patch method (manual / Ansible playbook), timestamp, and verification status. The `pentest-report` skill reads this file when assembling the final report.

### ansible/

Contains all Ansible inventory files, playbooks, and roles used for cross-platform patch deployment. Playbooks are named by finding ID (e.g., `playbooks/CVE-2025-1234.yml`). Always test playbooks in a staging inventory before running against production targets.
