# 2026-10-08 Backlog Sweep — hooks, ticket tooling, validators, co-learning docs, guides, fleet tooling — Design

- **Date**: 2026-10-08
- **Status**: implemented
- **Spec id**: `2026-10-08-backlog-sweep-design`
- **Tickets**: T-20261007-025 (partial), T-20261007-026, T-20261007-027, T-20261007-028, T-20261007-018, T-20261007-011, T-20261007-009, T-20261007-020, T-20261007-021, T-20261007-013, T-20261007-014, T-20261007-012 (filing), T-20261007-010, T-20261007-023, T-20261006-008, T-20261006-006 (tests), T-20261007-004, T-20261006-001, T-20261007-022 (verified), T-20261007-029/006/017/019 (design deliverables)
- **Owner**: automation-engineer scope, user-directed full-backlog sweep (2026-10-08)
- **Related**: `.githooks/pre-rebase` (+L1), `scripts/helpers/ticket-schema.ts`, `scripts/helpers/ticket-store.ts`, `scripts/ticket.ts`, `scripts/skill-lifecycle-audit.ts` (+L1), `scripts/resync-audit.ts`, `scripts/upgrade-project.ts`, `scripts/validate-variant-claims.ts`, `templates/co-learning/docs/*` + `procedures/*`, `templates/co-consult/skills/industry-research-pack` (+5 mirrors), `templates/common/skills/evidence-ledger` (+5 mirrors), `templates/co-deck/docs/adr/`, `templates/co-deck/procedures/slidedata-derived-doc-sync/`, `docs/guides/*` (4 new), design docs (3, proposed)

## R1 — Problem

The 2026-10-08 user directive: process the entire backlog (29 tickets). The
backlog mixed mechanical defects, tooling features, guide/skill promotions,
and design asks.

## R2 — Decision (per ticket)

1. **T-20261006-008**: pre-rebase hook closes both --root scan gaps — a lone
   branch argument (whose `branch..HEAD` range is empty) and the zero-arg
   form (prefer `@{upstream}..HEAD`, whole-history scan without an upstream).
   Whole-history = empty RANGE, scanned by gitleaks repo-mode. Mirrored L1.
2. **T-20261007-004**: ticket-schema 1.7.0 validates history shape
   (chronological, creation-first, chained, created_at not postdating the
   earliest event); ticket-store 1.12.0 `repairTicketHistory` + CLI
   `ticket.ts repair-history <id> [--apply]` (dry-run default; drop
   non-chaining duplicates, re-anchor the creation edge, reconcile
   created_at). The four legacy upstream imports repaired and verified
   schema-clean.
3. **T-20261006-006**: the calibration-sensitive pure parsers of
   validate-variant-claims 1.5.0 are exported and pinned by 14 unit tests.
   The test.yml battery wiring is deliberately NOT in this change —
   CI-file edits need explicit approval (workspace §7); flagged.
4. **T-20261006-001**: co-learning docs rewritten to the real 3-agent roster
   (pm / exam-bank-steward / i18n-specialist + §3.5 generic slots):
   user-guide routing/pipeline sections, phase-definitions (full rewrite),
   and all six procedures schemas' owner_agent/agent_key references. The
   procedures battery passes with `--variant co-deck`-style explicit variant
   scoping; co-learning's remaining 26 errors are the pre-existing
   namespace/id class (out of ticket scope, noted).
5. **T-20261007-022**: verified fixed at source (co-learning ops-review.mjs
   line 121 uses `${SINCE_DAYS}-day`; PR #13 merged). Closed verified.
6. **T-20261007-027**: resync-audit 1.5.0 `--final-state` — read-only fleet
   table (project/branch/dirty/unpushed/open-PR/template-version).
7. **T-20261007-028**: upgrade-project 1.68.0 `--preflight` — clean tree,
   open PRs on the branch, template-version.txt; exit 0/1, no mutation.
8. **T-20261007-018**: the delivery-manifest write composes
   `.claude/last-upgrade-pr-body.md` at delivery time (variant, from→to,
   file count, footprint by directory) — the stale-carried-body class dies
   at the source; /sync consumes it via `--body-file`.
9. **T-20261007-026**: skill-lifecycle-audit 1.7.0 Check SVP — SKILL.md
   script version pins (non-floor) must match the registry; the two live
   drifts (promote-variant 1.13.0, project-to-variant 1.11.0 vs current
   1.21.2) fixed in the same pass.
10. **Guides** (docs/guides/): production-inspection-runbook (011),
    mass-text-rewrite-verification (009), server-spawn-test-determinism
    (020), browser-deliverable-xss-assertions (021) — each distilled from
    the ticket's engagement evidence.
11. **T-20261007-013**: co-consult skill `industry-research-pack` 1.0.0
    (source ladder, 1-source-1-doc, five-section skeleton, warning marks,
    verify-user-hypotheses, quota fallback) + 5 platform mirrors + registry
    row.
12. **T-20261007-014**: evidence-ledger gains the document-form overlay
    (industry-research-pack) beside the existing NEWS-R1 and formal-var
    forms, plus the report-pack-as-citable-substrate consumer contract
    (co-deck PR #135). SSOT + 5 mirrors.
13. **T-20261007-010**: co-deck procedure `slidedata-derived-doc-sync`
    (embedded-HTML equality, full regeneration, _versions/ snapshots,
    citation truncation check) + 3 new output types registered.
14. **T-20261007-023**: co-deck ADR-0001 (byte-copy) and ADR-0002 (reference
    paths genericized) backported to `templates/co-deck/docs/adr/`.
15. **Design deliverables**: three proposed design docs — resync mode split
    (029), deck visual-reproducibility (006, poster-mode + font pin + CI
    baselines + env fingerprint; covers 019's fingerprint ask), provenance
    pruning (017).

## R3 — Dispositions outside this PR

| Ticket | Disposition |
|---|---|
| T-20261007-025 (urgent, billing) | Billing is FIXED (workspace CI green 8/8 post-wall); co-newbiz re-runs executed but still fail at job startup with no step logs — needs human investigation in that repo's Actions logs. Ticket left open; the workspace-side work is complete. |
| T-20261003-009 (co-safety evidence) | Impossible by the ticket's own terms ("never fabricated") — requires real engagement decisions. Left open permanently-gated. |
| T-20261007-008 (injector promotion) | The ticket requires coordinating with the live co-deck session before implementing on templates/co-deck; left in queue with that gate. |
| T-20261007-016 (normalizer promotion) | ALREADY delivered by the parallel wave (committed scripts/normalize-registry-provenance.ts 1.1.0 at HEAD, v1.66.0 upgrade pass) — my duplicate adaptation was reverted; fleet dry-run re-verified 16/16 projects clean. |
| T-20261006-006 CI wiring | Deferred (see #3 above). |

## R4 — Verification

- `bash -n` + mirrored hook pair; ticket repair dry-run plans match the
  defect shapes and all four repaired tickets read schema-clean.
- `--final-state` fleet table live across 16 projects; `--preflight` green on
  co-develop; Check SVP finds 0 drifts after the two pin fixes.
- validate-variant-claims tests 14/14; skill-lifecycle-audit 42 skills / 0
  errors; co-deck procedures battery OK with `--variant co-deck` (new
  procedure included).
- Full gates at landing.
