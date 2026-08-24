# Handbook i18n Parity Gate — co-deck H-Stage Toolkit Reflection

**Design ID**: 2026-08-24-handbook-i18n-parity-gate-design
**Status**: Implemented
**Source**: field incident (intro-to-ai-harness + multi-agent-harness-handbook four-language drift audit, 2026-08-24)
**Author**: opencode session (user-directed)
**Created**: 2026-08-24

---

## Problem Statement

The two published handbook repositories accumulated severe cross-language
content drift (15 HIGH findings in one handbook: empty practice sections in 3
languages, contradictory FAQ sets, divergent procedures; metadata-level drift
in the other). Root causes were verified via git archaeology:

1. Independent pre-repo authorship of ko/en editions
2. One-shot translation snapshots never refreshed
3. Recurring partial-sync commits (one language file changed, others skipped)
4. One-side improvements never backported
5. **No cross-language parity gate in any existing checker** — link, nav,
   label, and authoring validators all validate single files only

The handbooks fixed this on-site with a new `check-i18n-parity.ts` gate wired
into `handbook-doctor` (Check 13) plus a canonical-first regeneration pass.
However, the canonical H-Stage toolkit lives in `templates/co-deck` — new
handbook projects scaffolded from it would NOT receive the parity gate,
recreating root cause #5 for every future project.

## What Was Built

Reflection into `templates/co-deck/scripts/co-deck/handbook/` (vendored
toolkit), mirroring the merged upstream state:

1. **`check-i18n-parity.ts`** (new) — vendored from
   `Handbooks/multi-agent-harness-handbook/scripts/check-i18n-parity.ts`
   (canonical source noted in header). FAIL: heading/pre-count mismatch vs
   base page, missing language variant, wrong-language internal links;
   WARN: >15% li/tr deviation, numeric-token multiset drift.
2. **`handbook-doctor.ts`** — Check 13 (`i18n-parity`) delegates to the
   checker via `configureDocsDir(docsDir)`; FAIL maps to error, WARN to warn.
   Header updated 12 -> 13 checks.
3. **`scaffold-handbook.ts`** — checker added to SCRIPT_FILES copy list;
   generated project package.json gains `"check-i18n"` script so every newly
   scaffolded handbook ships with the gate.
4. **`variant.json`** — `script_manifest.local` registers the new script;
   version 0.2.1 -> 0.2.2 (patch: toolkit addition).
5. **`skills/handbook/SKILL.md`** — H-5 Quality Verification gains step 4
   (`bun run check-i18n`) pointing at the playbook.
6. **`skills/handbook/references/I18N_PARITY_PLAYBOOK.md`** (new) — operating
   rules distilled from the incident: verified root-cause table, Korean
   canonical-first workflow, four-language same-commit rule, per-file task
   splitting for large regenerations, full-CI-suite-before-push requirement,
   update-footers/search-index post-bulk-edit rules, recovery workflow.
7. **EOL hardening carried over** — vendored `check-authoring.ts` footer
   grouping normalized CRLF/CR -> LF before comparison (identical footers must
   not fail on line-ending differences; hit during the same incident).

## Out of Scope

- The two handbook repositories themselves (already fixed and merged upstream:
  intro PR #36/#37, multi-agent PR #119/#120).
- WARN->error promotion policy for count deviations (keep as WARN until soak).

## Verification Battery

- `bun scripts/audit.ts` — all-pass
- `bun scripts/validate-templates.ts` — manifest/file consistency incl. new registration
- `bun scripts/verify-scripts.ts --check-drift` — clean
- `bun scripts/verify-adr-governance.ts --strict` — exit 0
- `bun scripts/validate-md-language.ts` — exit 0 (playbook is English-only)
- End-to-end: co-deck `handbook-doctor --project <intro repo>` runs 13 checks,
  parity green against the live merged handbook
