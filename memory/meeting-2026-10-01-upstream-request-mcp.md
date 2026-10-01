# Meeting — upstream-request MCP: open decisions (Q2, Q5, Q8) and PR split

- **Date**: 2026-10-01
- **Facilitator**: PM (Claude Code session)
- **Participants**: architect, security-expert (**designated dissent seat**), auditor, lifecycle-manager
- **Rounds**: 2 (round 1 = positions per question; round 2 = synthesis and dissent check)
- **Status**: PROPOSAL (see "User decision" at the end)

## Honesty note

This meeting was run as a PM-facilitated discussion of four role perspectives (architect, security-expert [dissent seat], auditor, lifecycle-manager), grounded in a read-only repo survey. It is NOT four independent agent runs: plan mode blocked writing agents and the transcript file, so the transcript was persisted afterward from the plan's meeting record.

## Agenda and objectives

Context: L3 project agent teams patch L1/L2 problems locally; those fixes get overwritten by `upgrade-project` or recur elsewhere. A globally registered stdio MCP server (`ai-workspace-upstream`) will let projects file "upstream request" tickets to the ai_workspace PM. The design doc `docs/designs/2026-10-01-upstream-request-mcp-design.md` is written (untracked at the time of the meeting).

Objectives:

1. Q2 — resolve how projects are registered as valid requesters.
2. Q5 — resolve the daily request caps.
3. Q8 — resolve whether `gw-*` projects may file requests.
4. Decide the PR split for the design doc and implementation.

## Facts used

- 13 `co-*` projects exist, plus exactly one `gw-*` (`gw-76f6b4c9c6ff`: single scaffold commit, `variant=co-consult`, looks like a disposable smoke-test project; the meaning of `gw-` is undocumented).
- No project registry exists.
- Tickets are created at about 10-40 per day workspace-wide (peak 38 on 2026-09-30); no per-day creation cap exists anywhere today.

## Q2 — project registration

**Round 1 positions**

- architect: directory rule only (direct child of `Projects/`, `^co-...`, has `.claude/template-version.txt`). An allowlist file would be machine-local anyway (`Projects/` is gitignored) and adds a sync burden.
- auditor: agrees, but wants visibility: log every project's first-ever request.
- security-expert (dissent): the rule admits any directory containing a copied `template-version.txt`; registration is trivially forgeable by anything running as the same user. Wants an explicit allowlist.

**Round 2 synthesis (PROPOSAL)**: v1 = directory rule; the FIRST request from a never-seen project is forced to `inbox` (human sees every new requester once). Optional machine-local allowlist deferred to a later phase.

**Dissent preserved**: security-expert maintains an explicit allowlist is the safer default; same-user local trust boundary remains the residual risk.

## Q5 — daily caps

**Round 1 positions**

- auditor: 10 soft / 30 hard per project is reasonable (workspace-wide human-created volume is 10-40/day). But per-project caps alone allow 13 x 30 = 390/day; add a global cap.
- security-expert: wants lower hard cap (15).
- architect: keep 10/30, make configurable by env var at server start.

**Round 2 synthesis (PROPOSAL)**: per-project 10 soft (over -> `inbox`) / 30 hard (reject `rate_limited`); global auto-`ready` ceiling 40/day (over -> `inbox`); env overrides read at server start.

**Dissent preserved**: security-expert prefers hard cap 15; kept 30 because dedupe merges count toward it and early traffic is unknown. Revisit after two weeks of audit logs.

## Q8 — `gw-*` requesters

**Round 1 positions**

- lifecycle-manager: `gw-*` is undocumented and the only instance looks disposable -> exclude for v1 (`^co-` only).
- architect (dissent): keep `^(co|gw)-` since any scaffold with `template-version.txt` is a legitimate L3.
- security-expert: sides with exclusion (smaller surface).

**Round 2 synthesis (PROPOSAL)**: `co-*` only for v1; regex in one named constant; rejection message names the rule so enabling `gw-` later is a one-line change after `gw-*` is documented.

**Dissent preserved**: architect — excluding `gw-*` silently blocks a project that could really hit L1/L2 issues.

## PR split

**Positions**

- lifecycle-manager / auditor: CONSTITUTION §3.3 (sequential branches) and CLAUDE.md §9 (no root+templates mix in one task) decide this.

**Synthesis (PROPOSAL, no dissent)**: three sequential PRs, each merged before the next branch is cut, each on a fresh branch from `main` (the then-current branch `pr/20261001-105028-chore-update` belongs to another flow):

1. PR-A: design doc + recorded decisions (+ this meeting transcript).
2. PR-B: root implementation (server, schema, tests, PM triage docs).
3. PR-C: `templates/common` rules text only (separate session, CWD isolated).

The global installer (`scripts/install-upstream-mcp.ts`) ships in PR-B but is NEVER run by an agent; the user runs it after review (it writes user-level config).

## Action items

| # | Action | Owner |
|---|--------|-------|
| 1 | Create a new branch from `main`; update design doc §6/§8/§15 with the Q2/Q5/Q8 decisions, first-request -> inbox, global cap 40, `^co-` only; add status mapping (`inbox` = backlog, `ready` = waiting, `upstream.triage` authoritative) | architect |
| 2 | Persist this transcript (`memory/meeting-2026-10-01-upstream-request-mcp.md`), dissent verbatim | docs-writer |
| 3 | Run `/sync` to open PR-A; user merges | PM |

## User decision

The user approved the plan containing these proposals on 2026-10-01, so the synthesized proposals above are adopted. The preserved dissents remain on record as stated.
