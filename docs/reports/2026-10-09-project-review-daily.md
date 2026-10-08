# Project Review — Workspace Root — 2026-10-09

**Date**: 2026-10-09
**Scope**: workspace root (L0) — SCOPED to the change window 2026-10-08T05:55:38 → HEAD (7 merged PRs, #1470–#1481) + Phase 1b per-variant batteries; **Projects/co-newbiz excluded by user request (mid-session)**
**Method**: 4 parallel scoped review agents (A Architecture+Scaffolding, B Standards+Lifecycle, C Automation, D Docs+Security) + machine battery; catch-up run for the missed 2026-10-09 01:30 batch (host app down at trigger time; see memory/2026-10-09.md)

> Analysis only — no files modified in this report (fixes route through tickets).

## Baseline (machine, 2026-10-09 ~06:55 KST)

`bun scripts/review-baseline.ts --quiet` → **PASS, exit 0** (all validators silent).

- audit.ts / validate-templates.ts / verify-scripts --verify / agent-lifecycle-audit / skill-lifecycle-audit / propagate --check-drift: PASS
- Orphan sweep (`skill-graph-fleet-report.ts --json --snapshot-dir memory/skill-graph-metrics`): snapshot-2026-10-09.json committed with this review. NEW vs 2026-10-08: isolatedSkills `standup-synthesizer`, isolatedAgents `architect` — **both shown by scoped review to be v2 edge-re-attribution artifacts, not real gaps** (see High-3). Gap checks (a) skills named in agents/*.md and (b) vanished-subject records: clean (2026-09-27 whitelists applied).
- CI note: nightly scaffold E2E red ×3 nights (10-06/10-07/10-08) — surfaced by this review, not by any standing battery (see High-1). Root repo Test Suite green on last PRs; project-repo CI blocked by the Actions billing wall (T-20261007-025) — co-deck PR opened today fails all checks in ~3s with no logs (jobs never start), consistent with that ticket.

## Findings

### 🔴 Critical (fix immediately)

None.

### 🟡 High (fix within 1 week)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | Nightly scaffold E2E red ×3 since 2026-10-06: scaffolded co-consult/co-deck lose Tier 2 scripts (`audit`, `dev-sync`, `sync-md`). Variant overlay (`new-project.ts:846-867`) raw-copies `templates/<variant>/package.json` over the §2.5c-generated one; co-consult ships no `scripts` key at all, co-deck only `test*`. Introduced by 2cdf0864 (co-deck, 10-05) and 7583bc9f (co-consult, 10-06) — **not** by this window. Aggravating: `upgrade-policy.ts:244-247` classifies package.json as "never template-delivered", so upgrades never heal existing scaffolds, and WS-07 derives its forbidden list from `SCAFFOLD_COMMON_OWNED_FILES` = {docs/context.md} only | A (+C) | scripts/new-project.ts:724-750, 846-867; scripts/lib/upgrade-policy.ts:296; templates/co-consult/package.json; templates/co-deck/package.json | systemic + script-gap | T-20261009-001 (mechanical unblock: add trio to both variant package.json files), T-20261009-002 (durable: validate-templates Tier-2-merge-superset arm + engine merge per skills/SKILLS.md precedent + existing-scaffold heal) |
| H2 | `.gitignore:52` `node_modules/` (dir-only) cannot match a symlink — exactly how a `node_modules` symlink got committed in-window (7b154db3, removed by cfa72c07). One `git add -A` away from recurrence | C | .gitignore:52; commits 7b154db3/cfa72c07 | script-gap | T-20261009-005 (slash-less entry + tracked-path guard) |
| H3 | Today's "NEW orphans" (standup-synthesizer, architect) are v2 scoped-identity edge re-attribution artifacts: pre-v2 the L0 nodes held 17/5 edges; v2 re-attributed them to variant copies. Both subjects are referenced (AGENTS.md:31, CLAUDE.md:284, HERMES.md:45; co-work fork wiring). Triage machinery gaps: docRef corpus omits HERMES.md; isolated agents get no cross-axis evidence | B | scripts/skill-graph-fleet-report.ts:309, 326-334; docs/skill-graph.json | script-gap | T-20261009-008 (corpus + agent axes + overrides/same-capability attribution). T-20261009-004 closed as superseded — no retirement, no doc wiring |
| H4 | `ticket.ts` gained `repair-history` subcommand (T-20261007-004) but header/registry stayed 1.9.1; `verify-scripts --verify` cannot see un-bumped L0-only content changes | C | scripts/ticket.ts:2,367,443; scripts/SCRIPTS.md:260 | systemic | T-20261009-006 (bump 1.10.0 + registry row); prevention rule folded into T-20261009-002 scope |
| H5 | U-20261009-001.yaml (untracked) carries legacy Z timestamps ~23h AFTER the KST unification landed (dab6cbc2, 10-08 06:42 KST) — current workspace code cannot produce this; multiple stale `mcp-upstream-server` processes (oldest from Thu) confirmed running with pre-fix code | B | tickets/governance/U-20261009-001.yaml:8,10; ps aux (5 stale processes) | systemic | Design doc keeps Z valid (no corruption; id itself KST-correct). Deferred: restart stale MCP servers with their host sessions; ingest-time Z-normalization WARN (report row — ticket cap reached) |

### 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | `platform-command-lifecycle-manager` fork stale in co-consult+co-design mirrors: 1.0.2 (05-31) vs root L0 1.0.3 (5ac52023, 09-25, adds `.agents/commands` lockstep §6-D8). Same-version drift arm can't catch version-skewed forks | A | templates/co-{consult,design}/.agents/skills/platform-command-lifecycle-manager/SKILL.md | systemic | Report row (ticket cap reached) — re-propagate or declare fork lineage; candidate for 2026-10-10 batch |
| M2 | skill-session-review appends duplicate zero-observation blocks: 20 identical sections in memory/skill-review/2026-10-08.md (one per chore-update run) | B | memory/skill-review/2026-10-08.md | script-gap | T-20261009-010 (upsert/skip + dedupe) |
| M3 | co-consult template lifecycle record says "All 18 skills present"; registry+test pin 19 (industry-research-pack restore missed this surface) | B | docs/lifecycle/templates/co-consult.md:21 | one-time | T-20261009-009 |

### ℹ️ Low / Improvements

| # | Issue | Agent | Class | Disposition |
|---|-------|-------|-------|-------------|
| L1 | `docs/skill-graph.md` lacks node/edge totals in header (md↔json consistency not self-evident) | D | script-gap | Report row (cap) |
| L2 | Daily snapshot + U-ticket untracked — nightly snapshot job should land them | D, B | script-gap | Resolved for today: both land with today's PRs; standing fix folded into T-20261009-002 scope |
| L3 | skill-graph.overrides scoped-key resolution has no unit pin | C | script-gap | T-20261009-007 |
| L4 | Design doc §9 wording: "E2: 0 version-drift" lacks the skills-only qualifier (agent drift rows remain by design §6) | D | one-time | Report row |
| L5 | PRs #1473/#1474 landed without co-deck runner leftovers; healed by #1475 — staged-output-split mechanism worth one look | C | systemic | Report row |
| L6 | Test 11 comment maps to nonexistent "step 5.5d" (now §2.5c) | A | one-time | Report row |
| L7 | Project-only variants (co-architect, co-newbiz) have no template/lifecycle record; U-tickets cite nonexistent co-newbiz template_version | B | systemic (docs) | Report row — policy triage |
| L8 | 3 consecutive nightly reds untriaged; window PRs merged on red default pipeline | A, C | systemic | Covered by T-20261009-002 (nightly conclusion surfacing in daily baseline) |
| L9 | Reviewer window-range derivation: mid-day merge hash makes an incomplete range; derive from first merge of the marker day | D | script-gap | Report row (runner-prompt refinement) |

### ✅ Strengths (verified)

- Five-mirror parity byte-perfect (SHA-256) for all 10 new variant skills (co-consult ×6, co-design ×4) + co-deck/co-develop surfaces.
- skill-graph v2 committed graph hash-verified 229/229 against the working tree; md 233 skill rows = json 233 skill nodes, per-scope identical.
- dev-sync 1.25.0 speccheck-heal implementation matches its design exactly (L1 guard, retry semantics, gate strength preserved); registry cascade 18/19 scripts bumped correctly.
- Design-gate hygiene: both window designs registered `implemented` with matching entries; skill-lifecycle-audit 1.7.1 agrees on all 5 surfaces; zero lifecycle vanish violations.
- Secrets-clean window; CI surface hardened (additive read-only variant-claims battery, `contents: read` unchanged, fork-PR guard); pre-rebase hook closes two vacuous-pass holes.
- New v2 tests genuinely exercise the new behavior (identity collapse/split, invariants, convergence threshold, version-bump detection); no dead code found.

## Phase 1b — per-variant batteries (user request 2026-10-05)

Machine battery per variant (validate-variant-claims + validate-variant-readiness), workspace root:

| Variant | Claims | Readiness | Window delta | Review row |
|---|---|---|---|---|
| co-abap | PASS (0 findings) | PASS | none | baseline-only |
| co-consult | PASS | READY (1 warn) | 6 new skills ×6 mirrors | covered by Slot A: parity hash-verified; lifecycle count row → M3/T-009 |
| co-deck | PASS | PASS | video gates (#1474) | Slot A clean; E2E defect is pre-window (H1) |
| co-design | PASS (6 skipped) | PASS | 4 new skills ×6 mirrors | covered by Slot A: parity hash-verified |
| co-develop | PASS | PASS | — | baseline-only |
| co-export | PASS | READY (1 warn) | — | baseline-only |
| co-game | PASS | PASS | — | baseline-only |
| co-hr | PASS | READY (1 warn) | — | baseline-only |
| co-learning | PASS | PASS | — | baseline-only |
| co-news | PASS | READY (1 warn) | — | baseline-only |
| co-price | PASS | READY (1 warn) | — | baseline-only |
| co-safety | PASS | READY (2 warn) | — | baseline-only |
| co-security | PASS | PASS | — | baseline-only |
| co-work | PASS | PASS | — | baseline-only |
| (co-newbiz) | — | — | — | **EXCLUDED by user request (project mid-session; no template exists — standalone-track)** |

Dedupe note: one systemic defect (H1 scaffold overlay) across 2 variants = ONE finding + tickets, per the daily dedupe rule. Read-only over templates/ — fixes route through tickets.

## Action wiring

| Route | Items |
|---|---|
| Tickets created (10/10 daily cap) | T-20261009-001 (H1 unblock, high) · -002 (H1 durable + nightly surfacing, high) · -003 (phantom backport-diff refs, normal) · -004 (orphan triage — **closed superseded** → -008) · -005 (gitignore symlink hole, normal) · -006 (ticket.ts 1.10.0 bump, normal) · -007 (overrides unit pin, low) · -008 (fleet-report triage, normal) · -009 (co-consult record 19, low) · -010 (skill-session-review upsert, normal) |
| Deferred (ticket cap reached — report rows) | platform-command-lifecycle-manager fork re-sync (M1) · ingest-time Z-normalization WARN (H5) · skill-graph.md header totals (L1) · design-doc §9 wording (L4) · staged-output-split mechanism (L5) · Test 11 comment (L6) · project-only-variant policy (L7) · window-range derivation (L9) |
| Landed today outside tickets | co-deck pending session work → co-deck PR #169 (checks blocked by T-20261007-025 billing wall; left OPEN with stated reason) |

## Verification

None yet — no fixes applied this session. T-20261009-001/-005/-006/-009 are mechanically actionable and queued for the 03:00 ticket-batch catch-up later today; re-run `bun scripts/review-baseline.ts` and the scaffold E2E after they land.

## References

- Machine evidence: `.pipeline-state/resync-audit-20261009.txt`, `memory/skill-graph-metrics/snapshot-2026-10-09.json`, gh runs 37432680015 / 37588035983 / 37745885002 (nightly E2E), 37724787361 (root Test Suite, green).
- Prior baseline/whitelists: docs/reports/2026-09-27-project-review-daily.md.
- Standing spec: 2026-09-25-daily-fleet-review-resync-design (ADR-0089).
