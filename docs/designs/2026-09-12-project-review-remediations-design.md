# Project Review 2026-09-12 Remediations — Design

**Spec ID**: `project-review-20260912-remediations`
**Date**: 2026-09-12
**Source**: full project review (`docs/reports/2026-09-12-project-review-full.md`), tickets T-20260912-003 … T-20260912-024
**Status**: implemented (registered via `spec-register.ts`)

## Goal

Remediate all 22 findings from the 2026-09-12 full project review: 2 Critical, 10 High, and the Moderate/Low tail, across seven file-disjoint batch dispatches, keeping every machine validator green at each step.

## Scope and approach

Seven batches (serial dispatch, files disjoint between batches):

1. **T-003** — Renumber duplicate Accepted ADRs (0074-graft-fleet → 0076, 0075-codex → 0077), re-point citations by meaning (design-gate 0074 and flat-skill-layout 0075 citations unchanged), add an ADR ID-uniqueness check to `scripts/verify-adr-governance.ts`.
2. **T-004 + T-006** — `new-project.ts`: treat prose-only PM extends-stubs as stubs (resolve full L1 body, preserve `variant_overrides`, drop dangling `extends`); body-content assertion in `test-new-project.ts` across all 13 variants; scaffold sanitizer blanks matched text instead of deleting lines; `audit.ts` L0-leak exemption becomes occurrence-scoped; remove the `CONSTITUTION.md §8.15` mention from the context.md version footer at its propagation source.
3. **T-005 + T-010 + T-014 + T-016 + T-019** — `propagate-to-templates.ts` scrub guard extended to `.json`/policy meta-comments; machine-readable `--check-drift` mode (stable exit codes); `lifecycle-sync-audit.ts` Check C normalizes the intentional CONSTITUTION→context substitution then fails on real drift, plus a Version/Owner record-vs-frontmatter check; 4 stale lifecycle records refreshed; `validate-templates.ts` gains exists→declared manifest reconciliation (WARN) and an `import.meta.main` guard; `spec-register.ts` import-guarded + root-resolved registry path; `l3-to-variant-pipeline.ts` rejection backstop exits 1; co-game undeclared script registered, co-safety agents declaration reconciled.
4. **T-008 + T-018 + T-024(CI)** — `test.yml` Tier 3 split into per-audit steps; drift gate keyed off exit codes (uses batch-3 JSON mode); `validate-docs-links` added to CI; stale artifact globs removed; `nightly-tickets.yml` model-var default + standard daily-log sections in the runner prompt.
5. **T-007 + T-009 + T-017 + T-021** — `dev-sync.ts` step 5 checkout exit codes checked (fail closed) and step 3.7 made a real gate; `sync-skills.ts` advisory lock + atomic copies + stale-shortcut-premise fix + `--dir` guard; `.githooks/pre-rebase` regex fallback when gitleaks is absent (both L0 and `templates/common` mirror); `qa-gate.ts` parity comparison deepened (recursive, bidirectional); periodic gitleaks coverage for `Projects/` + CHANGELOG added to the weekly workflow.
6. **T-011 + T-020 + T-022** — README country-profile links repointed to real template paths; LIFECYCLE_GOVERNANCE.md references repaired; live-doc broken paths/anchors/duplicates fixed (l0-l1-differences, platform-parity-rules, variant-lifecycle, ecc-phase1-design, AGENTS.md §6 anchor + `06-skill-lifecycle.md` heading attribute, getting-started dedupe + stale setup.sh, roadmap template-v0.5.3 → v0.6.0, CLAUDE.md duplicate §2 renumbered with GEMINI.md parity preserved); registry hygiene (SCRIPTS.md prose, VERSION_MANIFEST scope note, docs/index.md ADR range, common-contract dead skeleton sections, agents/pm.md frontmatter phases, new-project usage strings).
7. **T-015 + T-023 + T-024(docs)** — `validate-md-language.ts` coverage extended to `docs/adr/`, `docs/decisions/`, VERSION_MANIFEST generated tables (generator exception or allowlist; `memory/` deliberately excluded — session logs quote Korean user requests and are a documented policy gray zone, noted for future adjudication); `ticket.ts` requires a result on done transitions; `memory/archive/` committed or index links replaced with tombstones; explain-me BUILD_GUIDE BSD-only `sed -i ''` made portable (SSOT + mirrors).

## Constraints honored

- Core scripts (`audit.ts`, `dev-sync.ts`, `propagate-to-templates.ts`, `validate-templates.ts`, `spec-register.ts`, `sync-skills.ts`) are edited at L0 only; `templates/common` mirrors are refreshed by `propagate-to-templates` during `/sync` (established convention) and must end byte-identical.
- Validators re-run per batch: `audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`, `propagate-to-templates.ts --check-drift`, `lifecycle-sync-audit.ts`, targeted `bun test`; full battery + full `bun test` at the end.
- Immutable records (`memory/` history, CHANGELOG history, `docs/reports/`) are not rewritten; the ADR renumber adds a fresh CHANGELOG entry instead.

## Accessibility

Backend/tooling/documentation remediation only — no user-facing web/app/CLI UI is introduced or changed; WCAG 2.1 AA considerations do not apply (explicit exemption per ADR-0065).

## Preview Verification

No UI change is part of this spec (backend scripts, CI workflows, and Markdown documentation only) — explicit exemption per ADR-0070.

## Trade-offs

- ADR renumbering changes IDs cited by design docs and templates; historical memory logs and CHANGELOG entries intentionally keep the old numbers (history is immutable); the renumbered ADR files carry a renumber note.
- Manifest reconciliation ships as WARN (grace window) per the ticket; escalating to FAIL is a follow-up decision.
- `validate-md-language` scope excludes `memory/` pending a policy adjudication (recorded in the review report M16).

## Addendum — gitleaks full-scan false-positive triage (2026-09-12, user-approved follow-up to T-021)

The T-021 periodic `Projects/` scan surfaced 100 findings. Full triage verified **90 false positives** (ABAP source identifiers in `scratch/*.prog.abap`, dummy password fixtures, Next.js `.next/` build artifacts, co-price React navigation-metadata values) and **10 real local credentials** (co-newbiz `.env` ×8, co-price `.env` ×2) — all confirmed gitignored with zero commit history in their repos, so local-only exposure; no revocation needed. The 90 FPs are allowlisted in `.github/gitleaks-full.toml` as per-class `[[allowlists]]` entries with rationales; `.env` files deliberately stay un-allowlisted so real local keys keep being reported. Implementation notes: gitleaks ≥8.30 rejects mixing singular `[allowlist]` with `[[allowlists]]` (all entries converted to the plural form), allowlist `regexes` match the captured **Secret value only** (not the Match line — patterns are anchored to exact value shapes), and path/regex entries in separate blocks never cross-combine (mixing `paths` into the singular `[allowlist]` silently ANDed them with its `regexes`). Verified: Projects/ scan 100→10 findings, a `ghp_` probe key in a non-allowlisted path is still detected, workspace full-history scan stays clean.

## Addendum — ticket ID namespace fix (T-20260912-025, 2026-09-12)

`ticket-store`'s `createTicket` allocated IDs by scanning only the target directory, while `move`/`list` resolve an ID with `tickets/governance/` precedence — so a service create (root dir) on a day that already had governance tickets could mint a same-day ID that shadow-matched a governance ticket (observed live during the T-20260912-023 verification: a scratch create produced `T-20260912-001` and a subsequent move closed the real governance ticket of that ID; restored from git). Fix: `nextSeqGuess` now scans both the target directory and its governance sibling (one namespace, whichever side allocates), keeping the exclusive-create retry as the last line of defense. Regression test added (fails on the old code, passes on the new); live-verified: a service create after governance `T-20260912-025` allocates `T-20260912-026`. `helpers/ticket-store.ts` 1.2.0 → 1.2.1; both SCRIPTS.md registry rows updated.
