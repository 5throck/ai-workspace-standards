# 2026-09-26 Review Remediation — 4-Domain Project Review Findings

- **Status**: implemented
- **Date**: 2026-09-26
- **Source**: /project-review 4-domain quality review (agents A architecture/scaffolding, B standards/lifecycle, C automation/scripts, D docs/security), user directive to remediate all findings and process the backlog
- **Tickets**: T-20260926-011..020

## 1. Problem

The 2026-09-26 project review confirmed the machine baseline green (verify-scripts, typecheck, review-baseline, 866+ tests) but found 11 critical and ~10 should-fix quality gaps the gates do not catch, concentrated in four classes: script self-verification defects, a deployment-path allowlist gap, retroactive-record omissions, and documentation drift. Two findings (A2 .agents simulate-pipeline mirror, A3 variant-mirror-parity) were already healed by parallel sessions before remediation started; one (D3 ADR-0083 silent change) was adjudicated a false positive against git history (PR #975 landed with CHANGELOG + memory records).

## 2. Requirements

- R1: resync-audit must parse porcelain rename rows correctly (ASCII `->`), must not let an emptied file corroborate STALE-RESIDUE, and must not flood on untracked vendor dirs.
- R2: review-baseline `--quiet` must keep failure diagnostics (the 01:30 fleet runner runs exactly this form).
- R3: the header-`@version` vs `const VERSION` drift class must be gated, and both live instances aligned.
- R4: the typecheck baseline file must be gated against silent loosening (policy: count 0).
- R5: agent extends-stub detection must recognize the live frontmatter form in both helpers; the analyzer must not execute on import.
- R6: the edu-sync publisher path allowlist must reject non-regular-file blobs, parse numstat with tab separators, and verify branch-tip integrity (commits == audited patches).
- R7: retroactive records: the 2026-09-22 backport-hardening batch gets its CHANGELOG entry; ADR-0086 precedent 3 corrected and its diff dimension renamed to avoid the 5-surface term collision.
- R8: stale schedule comments in three workflows updated to the ADR-0082 local-runner reality; ticket doctor covers governance/ manual tickets.
- R9: the mirror-span test pin must match the delivered tree (T-20260926-011: pin 133 lagged the ADR-0091 delivery of regenerate-agents-md.ts to L1 — diagnosis, not flake).

## 3. Decision

D1: Fix each finding in place under its ticket; no new abstractions. Porcelain parsing extracted as the exported `porcelainPath` for testability; everything else is a local edit.

D2: New verify-scripts checks ship at FAIL severity directly (Check 8, Check 9) — both verified zero-findings on the full tree at introduction; no ADR-0055 soak window is required for zero-finding introductions of this size.

D3: Analyzer unpinned frontmatter stubs report version `(unpinned)` and are checked for pointer existence only — version drift does not apply to the ADR-0033 resolve-at-read stub form.

D4: The edu-sync hardening is defense-in-depth at three layers (per-patch parse+type, post-apply path+blob sweep, tip integrity) because path-only checks cannot see blob types.

## 4. Verification

- `bun test` 1159/1159 (28 new: resync-audit hardening 7 + extends-stub 13 + mirror pin correction), `bun scripts/typecheck.ts` 0 delta, `verify-scripts --verify` green (new checks 0 findings), `validate-templates` 0 errors (72 adjudicated WARNs), `audit.ts` green, `review-baseline` 6/6.
- Workflow YAMLs validated (ruby YAML parser).

## 5. Addendum — batch 2 (post-merge remainder, same program)

Batch 1 (§1–§4) landed in PR #1087. The remaining review items landed as batch 2 in the same program:

- R10 (was deferred finding "W2 HARVEST zero test coverage"): the harvest line computation is extracted from upgrade-project v1.42.0's inline block into the pure helper `harvestVariantOnlyLines` (helpers/context-sections v1.8.0) and unit-tested (6 cases); the report now discloses the best-match-section-only comparison scope. upgrade-project 1.52.0. No behavioral change to the removal pass.
- R11 (was deferred finding "dev-sync audit/regeneration order"): audit.ts auto-activates the VERSION_MANIFEST reconciliation gate on EVERY invocation including Step 3.9's `--spec-check --lifecycle-only` call, which failed blocking before Step 4.7 could regenerate whenever a sync bumped script versions. New Step 3.85 pre-converges the manifest before 3.9; 4.7 stays as final convergence. dev-sync 1.20.0.
- R12 (was deferred finding "retry/lock rules prompt-only"): designed, not implemented — `docs/designs/2026-09-26-runner-lock-retry-enforcement-design.md` (registered separately, status designed); implementation ticketed T-20260926-021.
- R13 (A-domain leftovers adjudicated): co-newbiz `docs/security/` is committed project-owned content — no action (T-20260926-023 done); `platform_settings` claude/gemini scope extension is a design-level decision ticketed T-20260926-022.

Verification (batch 2): context-harvest tests 6/6, full `bun test` green, typecheck 0 delta, verify-scripts/validate-templates/audit green, dev-sync pipeline green end-to-end including the new Step 3.85.
