# Project Review — ai_workspace (workspace root + templates/) — 2026-09-27 (run 2, 09:35 KST late firing)

**Date**: 2026-09-27 (second cycle; the scheduler fired at 09:35 KST instead of 01:30 — late-firing pattern also documented for the ticket batch)
**Scope**: workspace root L0 + templates/; window 2026-09-26 09:37 → run time (261 root paths; marker for 01:30 was found missing — yesterday's run missed writing it; this run writes it on success)
**Method**: machine battery + FULL-mode 4-slot agent review (trigger: `docs/templates/common-contract.json` changed)
**Runner**: daily fleet-review automation (ADR-0089); specs 2026-09-25-daily-fleet-review-resync-design, 2026-09-27-auto-template-release-design

> Analysis only — no files modified beyond tickets, the fleet snapshot, and the tree-residue disposition below.

## Tree residue disposition (guard adjudication)

The 0b guard tripped on `tickets/governance/T-20260927-011.yaml` (dirty since 09-27 08:46). Inspected: the diff is **machine-written ticket state** (`ticket.ts move done` — review→done + result block citing PR #1114), written by the session that landed T-011 and closed before landing it. Disposition: landed with this cycle's Phase I (tickets-only, non-code) rather than discarded — machine-written state is never hand-edited and never dropped.

## Baseline

6/6 green (audit, validate-templates, verify-scripts, agent/skill lifecycle audits, drift-tolerated). Fleet snapshot refreshed (`memory/skill-graph-metrics/snapshot-2026-09-27.json` overwrote the same-date file — prior re-read from git HEAD for the diff; diff re-verified against the committed prior: **no new orphans, no new/vanished root skills, no new per-project delivery gaps**).

## Review Results

### 🔴 Critical

None.

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | T-002 project-side half open: B-04 `country_config` validator scopes `templates/` only; `Projects/co-{export,game,security}/variant.json` still have zero `country_config` | A | `scripts/validate-templates.ts:5382`-area, `:778-790` | systemic + script-gap | Extend check to `Projects/*/variant.json` + fill the three | T-20260927-012 |
| H2 | `templates/co-design/variant.json` still 1.0.0 vs delivered project 0.6.0 (T-005 in review covers; only the R3 declaration landed so far) | A | `templates/co-design/variant.json:6` | one-time | T-20260927-005 (in review) — no new ticket |
| H3 | tag-template recovery edge: local-tag-exists + origin-push-failed → rerun exits 0 without pushing; runner would report green with the tag missing on origin | C | `scripts/tag-template.ts:37-42,96-105` | script-gap | ls-remote check + push-if-absent | T-20260927-014 |
| H4 | CHANGELOG missing 2 of 4 window feature lands (auto-release scripts; command-mirror lockstep gate) | D | `CHANGELOG.md` | one-time (doc-drift) | Add entries | T-20260927-015 |

### 🟢 Moderate / Low

| # | Issue | Agent | Class | Wired |
|---|-------|-------|-------|-------|
| M1 | Six sibling template lifecycle records not bumped for 6551e7c7 (abap/deck/develop/game/security/work) + co-price record stale vs its 557-line backport | B | systemic (batch convention gap) | T-20260927-013 |
| M2 | Commit `6551e7c7` message is literally `--help` (accidental paste; carried T-001/T-002/T-007 substance; needed 149fa425 redo) | A+B | hygiene, process note | recorded |
| M3 | Design R17/AC-6: `docs/examples/runner-config.json` lacks the `auto_template_release` block — actual wiring lives in the external scheduler prompt, example file not repo-resident | C | doc nicety | deferred |
| M4 | `/meeting` residue down to ~26 copies (was ~40) — still deferred on T-20260926-027 | A | systemic, known | no new ticket |

### ✅ FIXED-CONFIRMED (yesterday's findings, verified with evidence)

- **H1/T-001**: common-contract `common_commands` rows now carry `agents_source`/`codex_source`/`agents-parity`; lockstep gate live in `verify-platform-lifecycle.ts` checkG (`lockstep-root` mode, exclusions typed); **all 4 mirrors of project-review.md md5-identical**.
- **H2 template-side**: all 7 variant.json templates carry the R3 declaration (project-side half → H1 above).
- **M1 (co-price)**: full 4-layer ADR-0091 backport landed template-side (region-profiles/ + .env.sample marker + docs/countries), via T-009.
- **M2**: co-design lifecycle record refreshed (2026-09-27).
- **H5**: edu-sync `GITHUB_WORKSPACE` fix landed (bf6b228f); T-003/T-004 in review.
- **Docs-sync claims (T-011)** independently reproduced: 16/16 README, 85/85 docs/index, 2/2 getting-started links resolve; README hash-sync verified across es/ja/ko; CONSTITUTION §11 English-only conformance.

### ✅ Strengths

- Both new scripts landed spec-referenced with twin registration (root + templates/common SCRIPTS.md) and a real validator gate in the same batch — registry discipline held under a 74-commit window.
- Auto-release composition verified sound: exit contract enforced, clean-tree guard on the mutating path, changelog rollback on failure, R6d self-healing, classification MINOR→0.7.0 confirmed live.
- Zero running tickets; ticket history chains coherent; no secrets/PII in new scripts, variant.json diffs, or ticket bodies.

## Action wiring

| Route | Items |
|---|---|
| Tickets created | T-20260927-012 (B-04 project-side, normal) · -013 (record refresh batch, low) · -014 (tag push recovery, normal) · -015 (CHANGELOG entries, low) |
| Covered by in-review tickets | H2 → T-005; T-003/T-004 pending merge |
| Deferred/known | M3 (example config), M4 (/meeting sweep on T-20260926-027) |

## Mode announcement

FULL mode — structural trigger (`docs/templates/common-contract.json`). Open issues carried to the nightly batch: none blocking the auto-release step.
