# Design: 2026-09-17 Governance Backlog Batch (validator hardening + template hygiene)

**Spec ID**: 2026-09-17-governance-backlog-batch
**Date**: 2026-09-17
**Source**: governance backlog tickets T-20260917-001..008, deferred from the 2026-09-17 full project review (`docs/reports/2026-09-17-project-review-full.md`, findings #3, #8, #10, #11, #12, #16, #17, #20).
**Status**: implemented

## Requirements

1. R1 (T-20260917-001, finding #3) — the managed-block parity arm (PM-04) must enforce common→variant parity over every MERGE_MANAGED file whose common copy carries keyed WORKSPACE-MANAGED blocks, not AGENTS.md only. Per-file absence policy: a variant AGENTS.md must exist (unchanged); any other MERGE_MANAGED file may be absent (the scaffold lays down the common copy and the variant overlay never fires — co-hr/co-safety ship no `.gitignore` by design); a variant `agents/pm.md` that is an extends-stub delivers the common body through stub resolution (new-project §2.3b) and is exempt from marker-wrapped parity. The file set comes from a single SSOT: `MERGE_MANAGED_FILES` exported from `scripts/lib/upgrade-policy.ts` (the same set upgrade MERGE unions), not a second hand list in the validator.
2. R2 (T-20260917-002, finding #8) — governance-corpus citations of the form "ADR-NNNN Amendment K" must resolve against the cited ADR's own recorded amendments; ranges must resolve at every number they span. Lines citing two or more distinct ADR numbers are skipped (the documented fix convention for an amendment recorded outside its own ADR cites the recording ADR on the same line). Default mode WARN-only; strict mode blocking. ADR-0060's first amendment heading gains its missing "(Amendment 1)" label so CONSTITUTION.md's "Amendments 1–9" range resolves.
3. R3 (T-20260917-003, finding #11) — `ticket.attempts` is a derived retry count: validateTicket must enforce `attempts === count(history transitions failed → waiting)` so the field cannot drift. The one legacy ticket carrying an unexplained `attempts: 1` (T-20260912-002, pre-state-machine history) is normalized to the derived value 0. Dropping the field was rejected: the retry-count semantic is real (ticket-store increments it on failed→waiting) and derivable, so validation is lossless.
4. R4 (T-20260917-004, finding #10) — Check H gains a coverage arm: versioned scripts (a `// @version` header) with no `docs/lifecycle/scripts/` record are reported as ONE aggregated WARNING naming the first dozen scripts. Records stay opt-in (SCRIPTS.md remains the lifecycle SSOT; mandatory records would impose a Check-H version-sync tax on ~55 mostly-stable scripts); the fix closes the visibility gap, not the opt-in stance.
5. R5 (T-20260917-007, finding #12) — CHANGELOG `[Unreleased]` is split per Keep-a-Changelog: scattered `### Added/Changed/Fixed` subsections (and unlabeled leading bullets) are consolidated into one subsection per category, entries classified by their leading conventional-commit type (feat→Added, fix→Fixed, others→Changed), order and multi-line entry bodies preserved. Release cut rejected for this batch: no version-number policy decision was in scope.
6. R6 (T-20260917-008, finding #20) — variant `.gitignore` copies that add nothing beyond common are deleted (drift fuel; the scaffold and upgrade MERGE both read the common copy). Verified before deletion: all ten copies carry zero content outside the managed block and their only in-block difference from common is the stale pre-dedup duplicate entries (`dist/`, `nul`, `NUL`) remediated in common on 2026-09-17. co-price keeps its copy (variant-specific entries outside the block); co-hr/co-safety already ship none; propagation does not deliver `.gitignore` into variant templates, so the deletion is durable.

## Design decisions (design-only tickets)

### T-20260917-005 — derive VARIANT_OVERLAY_SKIP from upgrade-policy classifications

Current state: `new-project.ts` carries `const VARIANT_OVERLAY_SKIP = new Set(['docs/context.md'])` — a hand list guarding common-owned files from variant overlays. The WS-07 validator arm separately forbids variants from carrying `docs/context.md`; the two lists express one contract with no shared source.

**Decision**: promote the contract to `scripts/lib/upgrade-policy.ts` as an exported classification (provisional name `SCAFFOLD_COMMON_OWNED_FILES`: files the scaffold copies from templates/common that a variant template must never overlay nor carry). `new-project.ts` derives VARIANT_OVERLAY_SKIP from it and the WS-07 arm derives its forbidden-file list from it, so adding a file to the classification updates scaffold skip + validator enforcement atomically. Acceptance for the follow-up implementation: (a) unit test asserting the set contains `docs/context.md` and is consumed by both call sites (no local literal Set remains in new-project.ts); (b) validate-templates WS-07 message cites the classification as its source. Not implemented in this batch — the ticket is design-only.

### T-20260917-006 — snapshot replaced unlabeled managed-block spans before reconcile

Current state: `scripts/lib/managed-block-merge.ts` unlabeled count-mismatch branch replaces the project's unlabeled-block span with the template sequence on a WARNING only; recovery is git-only (the T-20260916-012 incident class).

**Decision**: before the slice-replace, the merge lib writes a snapshot file containing the exact replaced span: path `<target>.pre-reconcile.bak` beside the target file (visible where the user is already looking; covered by the workspace `.gitignore` scratch rules — the file must never be committed), overwritten per merge run (latest-wins, no unbounded accumulation). Snapshot write failure aborts the reconcile fail-closed (a recovery copy that cannot be written means the destructive replace must not proceed). Dry-run mode skips snapshot writes (nothing is replaced). The merge log names the snapshot path next to the RECONCILED line. Not implemented in this batch — the ticket is design-only.

**Accessibility**: not applicable — no user-facing UI (validator/tooling + docs only).
**Preview verification**: not applicable — no UI change.

## Approach

Smallest-diff at the audited sites, following the remediation-batch precedent (`2026-09-17-project-review-remediations-design.md`): export the existing classification (R1), add one pure-function arm per validator (R2, R4), one cross-field schema check (R3), a one-shot mechanical CHANGELOG transform (R5), verified deletions (R6). New pure helpers (`isExtendsStub`, `listVersionedScripts`) are unit-tested; `checkAmendmentReferences` logic is exercised through the validator's strict gate.

## Acceptance

- `bun scripts/validate-templates.ts` exits 0 with PM-04 reporting N variant copies across 3 MERGE_MANAGED files (AGENTS.md, .gitignore, agents/pm.md; CLAUDE.md/GEMINI.md skipped — no common keyed blocks).
- `bun scripts/verify-adr-governance.ts --strict` exits 0 with the amendment-reference arm active (the ADR-0060 Amendment 1 heading label closes the only real finding).
- All ticket YAML files validate under the attempts-equality rule (`bun scripts/ticket.ts list` exits clean).
- `bun scripts/lifecycle-sync-audit.ts` reports the Check H coverage warning (single aggregated line) with no new errors.
- CHANGELOG `[Unreleased]` carries exactly one `### Added`, one `### Changed`, one `### Fixed`; bullet count and multi-line bodies preserved (104 blocks).
- Unit suites pass (`bun test tests/unit/managed-block-parity.test.ts tests/unit/ticket-schema.test.ts`), `review-baseline` stays green, typecheck delta 0.
