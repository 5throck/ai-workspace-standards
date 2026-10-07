# Project Review — Workspace Root — 2026-10-08 (daily fleet review, run-11)

**Date**: 2026-10-08
**Scope**: workspace root (L0) SCOPED review + Phase 1b batteries (15 template variants) + first LIVE Steps 2e/2f
**Method**: 4 parallel Explore slots (SCOPED, ~9h window) + machine battery + per-variant batteries + merged-PR learning extraction
**Mode rationale**: window non-empty (16 PRs root + fleet merges incl. co-deck template backport + 2 new project scaffolds) but no structural triggers (no new variant, no schema/contract change) → SCOPED
**Window**: 2026-10-07T16:37:37 → HEAD (~9h): resync v2 landing (#1457/#1460/#1461), co-deck template backport (8ecddff6 — the session flowing lecture-v4 learnings into the template), new projects co-hr + co-news scaffolded (0.13.1, 16-project fleet), co-deck SELF-UPGRADED to 0.13.1 (PR #166 — the runner's deferred upgrade, done by the session), co-learning tech-debt batch (PR #13)

## Baseline (machine battery)

7/7 green (audit, validate-templates, verify-scripts 219, agent-lifecycle, skill-lifecycle, propagate-drift, validate-variant-claims).

## Phase 1b — per-variant batteries (15 template variants)

14/14 batteries returned PASS 0 findings + READY (co-architect has no template directory — standalone-track by design; 15 templates total, all green). Fleet is 16 projects after co-hr/co-news scaffolds.

## Step 2f — learning extraction (FIRST LIVE RUN)

| Landing (merged in window) | Extraction outcome |
|---|---|
| co-deck lecture-v4 template backport (8ecddff6) | reviewed by Slots A/B/C directly: **H-1** .hermes html-build stale (below) + **M-A1** ADR layer not backported → T-20261007-023; strengths: byte-identical backport fidelity on 4 mirrors, provenance recorded in THEMES.md |
| co-deck self-upgrade to 0.13.1 (PR #166) + #167/#168 | 4 learnings → T-20261007-016 (provenance normalizer promotion, 7 siblings have fossil stamps), -017 (upgrade-pipeline provenance pruning, deferred design candidate), -018 (upgrade PR body regeneration — #166's body described the WRONG wave), -019 (rendering-env fingerprint + HEAD-control-run codification, relates T-006) |
| co-learning tech-debt batch (PR #13) | 3 learnings → T-20261007-020 (server-spawning test determinism bundle + discovery naming), -021 (XSS source-slice + structural inertness + protocol-relative allowlist rule; pollinate co-deck), -022 (report labels derive from parameters) |
| co-hr / co-news scaffolds | no merged PRs (direct-push bootstrap); content review via Slot A: healthy scaffolds (audit PASS, 139/139 scripts each) with two hygiene findings → T-20261007-024 |
| 10× "chore: update" fleet merges | reviewed as a group: routine maintenance, nothing to extract (explicit negative) |

**Step 2c pollination (redefined from extracted assets)**: co-learning XSS source-slice pattern → pollinate to co-deck lecture HTML (T-021); co-consult/co-news cross-validation convergence (T-20261007-014, from yesterday's run) remains the standing cross-pollination item.

## Step 2e — upstream request ledger (dry-run data, first live format)

| Ticket | Requesting project | Stage | Re-delivery |
|---|---|---|---|
| U-20261006-001..004 | co-develop | fixed (PR #1446) | **v0.13.1** (ledger correction: tickets closed at "unreleased"; the 0.13.1 wave actually delivered — loop closed) |
| U-20261006-005/006/007 | co-develop | fixed (PR #1439) | v0.13.0 |
| LOCAL-PATCH U-20261006-003 markers (co-develop, co-security) | design-lint fonts guard | superseded upstream (v2.1.0) | drop markers at next upgrade |
| Open U-tickets | — | none | queue clean |

## Review Results

### 🔴 Critical — none

### 🟡 High
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | co-deck .hermes html-build mirror stale (1.5.0 vs 1.6.0 — 4-of-5 backport miss) AND no validator covers variant-owned skill mirrors (inVariant mirror copies skip version comparison) AND VA-07 flips WARN→FAIL on 2026-10-09 which would promote the blind spot into a fail-gate; promote-variant checklist still documents the 2-mirror convention | A+B+C (deduped) | templates/co-deck/.hermes/skills/html-build/SKILL.md:4; scripts/validate-templates.ts:3898,2136; .agents/skills/promote-variant/SKILL.md:155 | script-gap | **T-20261007-015 (URGENT — before the 10-09 flip)** |

### 🟢 Moderate
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | project-resync lifecycle record Changelog missing 1.5.1/1.6.0 entries (metadata updated, section rotted) | B | docs/lifecycle/skills/project-resync.md | one-time | ✅ fixed |
| M2 | CHANGELOG.md missing the project-resync 1.6.0 landing entry | B | CHANGELOG.md | one-time | ✅ fixed |
| M3 | co-deck PR #166 self-upgrade PR body described the wrong wave (carried over, never regenerated) | 2f | co-deck PR #166 | script-gap | T-20261007-018 |
| M4 | PR #164/#165 learnings backport skipped the ADR layer (templates/co-deck/docs/adr/ absent; video-QA governance not templated) | A | templates/co-deck/docs/adr/ (missing) | one-time | T-20261007-023 |
| M5 | 7 sibling projects carry fossil L0 provenance stamps that co-deck's normalizer already fixes | 2f | Projects/* registries | systemic | T-20261007-016 |
| M6 | new scaffolds co-hr/co-news shipped TODO identity placeholders on day one (new-project.ts lacks a WARN when flags omitted) | A | Projects/co-{hr,news}/docs/project.md:9-10 | script-gap | T-20261007-024 |

### ℹ️ Low / Improvements
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| L1 | resync skill step numbering skips 2d (pre-existing lettering; design doc consistent) | D | .agents/skills/project-resync/SKILL.md:163 | one-time | note "(2d retired)" at next minor (folded into T-015 scope) |
| L2 | co-news context stub banner ships from the template while body is real | A | templates/co-news/docs/co-news.context.md:3 | one-time | T-20261007-024 |
| L3 | validate-templates pass message says "four" mirrors (now five) | C | scripts/validate-templates.ts:2123 | one-time | T-015 (d) |
| L4 | recorded, no ticket: co-deck A7 image-sourcing pipeline (pre-existing mature asset); upgrade-pipeline pruning deferred design candidate → T-20261007-017 | 2f | — | — | recorded |

### ✅ Strengths
- The learning-extraction pipeline's first live run: 3 landings → 8 evidence-cited requests, explicit negatives where nothing qualified, and one self-caught citation error (co-consult origin PR #86 not #89).
- project-resync 1.6.0 governance complete across all 11 copies (root + 5 root mirrors + 5 common mirrors byte-identical; contract 1.6.0; lifecycle/registry rows) — the CI-caught mirror miss self-repaired in 15 minutes (Slot B).
- co-deck's session executed the runner-deferred upgrade itself (PR #166) — clean 1-commit upgrade + fixup, and flowed its learnings INTO the template the same evening (8ecddff6): the bidirectional loop working end to end.
- New scaffolds co-hr/co-news ship green out of the box (audit PASS, 139/139 scripts, 0.13.1 from birth) with hardened deny-lists and zero credential leakage across ~400k scaffold lines (Slot D full-tree scans).
- Docs-links zero-broken gate held through the backport; folder manifest matches; language validator green (2,128 files).

## Fixes applied this session (docs-class)

| File | Change |
|---|---|
| CHANGELOG.md | project-resync 1.6.0 entry added (M2) |
| docs/lifecycle/skills/project-resync.md | Changelog 1.6.0/1.5.1 entries (M1) |
| memory/skill-graph-metrics/snapshot-2026-10-08.json | fleet snapshot (16 projects) |
| tickets/governance/T-20261007-015..024.yaml | 10 tickets (cap exactly reached) |

## Action wiring

T-20261007-015 (URGENT hermes/VA-07 hardening), -016..019 (co-deck 2f learnings), -020..022 (co-learning 2f learnings), -023 (ADR layer backport), -024 (scaffold hygiene). Today's shared cap: 10/10 — co-deck A7 image-sourcing pipeline and the skill-session classifier gap (co-consult A5) recorded in this report only, to be filed first next cycle.

## Verification

Post-landing: audit + spec-check re-run appended after merge; Phase II continues below (bootstrap + upgrades).
