---
name: project-review
status: active
scope: common
description: >
  Performs a comprehensive review of the current project: machine validator
  baseline first, then parallel specialist agents (scope-triageable: full /
  scoped / baseline-only). Auto-detects project type and agent roster,
  produces a prioritized, class-tagged findings report persisted to
  docs/reports/, and wires outcomes to the ticket backlog (deferred items,
  validator-hardening loop).
  Use when: user requests a full project review ("/project-review" or
  "do a full project review"); PM detects structural changes (3+ agent files modified,
  phase schema changes, workspace-schema.json modified, new variant added);
  QA escalation from auditor (audit.ts ERROR >= 3 or security Critical finding).
owner: pm
version: 1.2.0
last_reviewed: 2026-09-08
prerequisites: []
metadata:
  type: process
  triggers:
    - project review
    - review project
    - audit project
    - quality review
  related_skills:
    - audit-workspace
    - project-resync
    - meeting-facilitation
---

# project-review

Comprehensive review of the current project: machine baseline → scope-triaged specialist
review → persisted report → ticketed follow-ups. **Ratchet principle**: every finding
classified `script-gap` must end as a validator-hardening ticket so the next review
catches that class mechanically, not by agent effort.

## When to Use

- User explicitly requests a full project review
- PM detects structural changes requiring cross-domain validation (T-02)
- QA escalation: `audit.ts` exits with 3+ ERRORs, or security-expert finds a Critical issue
- Post-incident localized review (use `scoped` mode — see Step 1.5)
- Weekly health pulse (use `baseline-only` mode — doubles as the §9.1 check)

## Step 0 — Machine Baseline (run BEFORE any agent dispatch)

Run the validator battery and record results — this is (a) the report's Baseline
section and (b) the reference for classifying findings as `script-gap` later.

```bash
bun scripts/audit.ts                              # workspace standards
bun scripts/validate-templates.ts                 # template/variant integrity + L1 parity
bun scripts/verify-scripts.ts --verify            # SCRIPTS.md registry sync
bun run agent-lifecycle-audit                     # agent health
bun run skill-lifecycle-audit                     # skill health
bun scripts/propagate-to-templates.ts --check-drift  # L1↔L2 drift (tolerate gemini-settings)
```

Record per script: PASS/FAIL/WARN counts. In variant projects, run the project's own
`bun scripts/audit.ts` instead of the root battery.

If the baseline already shows ≥3 ERRORs, triage those FIRST (T-03) — agents may still be
dispatched for non-machine-detectable classes, but don't let agents re-discover what the
scripts just printed.

### base-map MCP (optional enhancement)

Check whether `mcp__base-map__*` tools exist in the session. If yes, set
`BASE_MAP_AVAILABLE = true` and use them for large-file summarization,
cross-validation of findings, and `review_code` on critical scripts. If no,
skip every `mcp__base-map__*` call — the review completes without them.
base-map is an enhancer, never a dependency.

## Step 1 — Detect Project Context

1. **List available agents**: scan `agents/` for `*.md` (excluding README)
2. **Determine project type**: `docs/context.md` present → variant project; workspace
   root indicators otherwise
3. **Announce context**:
   ```
   Project type: [workspace-root | co-… ]
   Available agents: [list]
   Review domains: [mapped]
   Scope: [full | scoped:<domains> | baseline-only]
   base-map MCP: [available | not available]
   ```

## Step 1.5 — Scope Triage (choose review breadth)

| Mode | Agents | When |
|------|--------|------|
| `full` | 7 domains, parallel (paired per Step 3) | Default for T-01 user request, T-02 structural change, T-03 QA escalation |
| `scoped <domains>` | Only the named domains | Post-incident review where the blast radius is known (2026-09-07 lesson: a localized registry-tag mismatch did not need 7 agents) |
| `baseline-only` | Zero — machine battery + PM lightweight check (§7 universal behaviors spot-check) | Weekly health pulse; quick pre-release sanity; when agent budget is constrained |

Selection rule: the PM picks the *smallest* mode that covers the trigger's blast radius,
and states the choice in the Step 1 announcement.

## Step 2 — Generate Execution Plan

Map available agents to review domains (workspace root shown; variant projects map to
their own roster, PM covers gaps directly):

| # | Domain | Agent | Tier | Focus |
|---|--------|-------|------|-------|
| 1 | Architecture + Scaffolding | architect (else PM) | High | Structure, variant contracts, template sync, L0/L1/L2 inheritance |
| 2 | Standards + Lifecycle | auditor (else PM) | Medium | Registry/manifest accuracy, lifecycle records, governance doc consistency |
| 3 | Automation | automation-engineer (else PM) | Medium | Scripts, hooks, package.json, CI workflows, cross-platform |
| 4 | Documentation + Security | docs-writer + security-expert (else PM) | Medium | Links, language policy, secrets, CI permissions |

> If an agent is not available for a domain, PM covers that domain directly with a
> lightweight check. For `scoped` mode, keep only the selected rows.

## Step 3 — Dispatch Agents (resilient parallel)

**Cap: at most 4 background agents.** Domains are pre-paired to fit the cap — this is
the combination proven in the 2026-09-08 run:

| Slot | Domains |
|------|---------|
| Agent A | Architecture + Scaffolding |
| Agent B | Standards + Lifecycle |
| Agent C | Automation |
| Agent D | Documentation + Security |

Dispatch all slots in ONE message via the `Agent` tool with `run_in_background: true`
(`subagent_type: Explore` for read-only reviews). Prompt template:

```
You are the [domain(s)] reviewer for this project at [path].
Review your domain and report: Critical, High, Moderate issues and Strengths.
Every finding MUST include: file path (+line number where possible), evidence
you actually verified (diff/read output, not assumption), and a suggested fix.
Research only — do NOT modify any files.
[If BASE_MAP_AVAILABLE: use mcp__base-map__ask_local_llm to summarize large
files and cross-validate; mcp__base-map__review_code on critical scripts.]
```

**Fallbacks**:
- Background dispatch blocked by concurrency limits → run slots sequentially
  (foreground), or merge two slots into one prompt.
- On Antigravity/Gemini CLI: `/meeting "project review" --agents [list] --rounds 2 --dialogue`.
- No Agent tool at all: PM role-plays each slot sequentially using the same prompts.

## Step 4 — Collect, Classify, Persist

### 4a — Collect raw findings
Gather per-slot reports: 🔴 Critical / 🟡 High / 🟢 Moderate / ✅ Strengths.

### 4b — Cross-domain dedup
Merge duplicates (same root cause), credit all discoverers, keep the most specific
file:line and the highest severity.

### 4c — base-map cross-validation (optional, only if `BASE_MAP_AVAILABLE`)
`mcp__base-map__ask_local_llm` over the merged findings for false positives,
missing issues, and root-cause chains.

### 4d — Findings table (Class column is MANDATORY)

```markdown
## Review Results — [Project] — [Date]

**Baseline**: audit PASS · validate-templates 0/0 · verify-scripts N PASS · drift: gemini-settings only

### 🔴 Critical (fix immediately)
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|

### 🟡 High (fix within 1 week)   <!-- same columns -->
### 🟢 Moderate (fix within 2 weeks) <!-- same columns -->
### ℹ️ Low / Improvements
### ✅ Strengths
```

**Class values** (drives Step 5 wiring):
- `one-time` — instance drift; fix and forget (e.g. a stale version field)
- `systemic` — recurring by nature but needs judgment each time (e.g. boilerplate
  replication across 13 variants)
- `script-gap` — a *machine* could and should have caught this; nobody did
  (e.g. the 2026-09-08 L1 workspace-schema drift → became the WS-01 parity check)

### 4e — Persist the report

Write to `docs/reports/YYYY-MM-DD-project-review-<scope>.md` following the directory's
header convention:

```markdown
# Project Review — [Project] — [Date]
**Date**: [YYYY-MM-DD]
**Scope**: [workspace root | variant | domains list]
**Method**: [4 parallel agents | scoped | baseline-only] + machine battery
<!-- If no fixes were applied in-session: -->
> Analysis only — no files modified in this report.
```

Include: baseline, findings tables (4d), domain summary, action wiring results (Step 5),
and — after fixes — the verification results (Step 6).

## Step 5 — Wire Outcomes to Action

Route findings by Class — do not default to "fix everything now".

| Route | Condition | Action |
|-------|-----------|--------|
| Fix now | Critical/High, fix is clear, session budget allows | Dispatch through the normal PM Gateway (specialists execute) |
| Ticket | Deferred items (needs design gate, low priority, future cycle) | `bun scripts/ticket.ts create --manual "<title>" --priority <low\|normal\|high\|urgent> [--not-before YYYY-MM-DD]` — auto-enrolls in the §3.7.5 governance-backlog triage (AGENTS.md) |
| Validator-hardening ticket | Any `script-gap` finding | Same `create --manual`, title prefixed `validator-hardening:` — tracks the ratchet loop until a standing check exists |

Rules:
- Ticket titles in English, one actionable sentence.
- Record ticket IDs back into the persisted report's "Action wiring" section.
- `bun scripts/ticket.ts` is workspace-root only (L0); in variant projects, record
  deferred items in the report + memory log instead.

## Step 6 — Post-Fix Verification

If fixes were applied this session:

1. Re-run every validator whose domain was touched (minimum: `bun scripts/audit.ts`).
2. Append a `## Verification` section to the persisted report with the results.
3. Log the run in `memory/YYYY-MM-DD.md` per the daily-log convention (summary, changes,
   deferred/ticket list, validation line).

**Ratchet check (quarterly, AGENTS.md §10)**: diff persisted `docs/reports/*project-review*` files —
`script-gap` classes should move to the machine baseline over time (found-by-agent ↓,
caught-by-script ↑). If the same class reappears as an agent finding, the hardening
ticket was not landed.

## Trigger Reference

| Trigger | Invoker | Condition | Default scope |
|---------|---------|-----------|---------------|
| T-01: User request | User | `/project-review` or natural language equivalent | full (scoped on request) |
| T-02: PM autonomous | PM | 3+ agent files modified; phase schema changed; workspace-schema.json modified; new variant added | full |
| T-03: QA escalation | auditor / security | audit.ts ERROR ≥ 3; security Critical | scoped to the failing domain, then full if it spreads |

## Related Skills

- **audit-workspace**: machine battery wrapper — project-review Step 0 is its superset
- **project-resync**: fleet-level close-out after fixes land (commit/PR pipeline)
- **meeting-facilitation**: Antigravity/Gemini dispatch path for Step 3
