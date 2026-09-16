# Design: 2026-09-17 Project Review Remediations (validator robustness + template hygiene)

**Spec ID**: 2026-09-17-project-review-remediations
**Date**: 2026-09-17
**Source**: full project review (`docs/reports/2026-09-17-project-review-full.md`), 4 parallel agent slots + 6/6 machine baseline.
**Status**: implemented

## Requirements

1. R1 — `generate-version-manifest.ts` agent frontmatter parsing must be CRLF-tolerant; tier must not silently parse `N/A` on Windows working trees (fleet-verified failure mode).
2. R2 — `managed-block-merge.ts` heading anchoring must not interpolate an unescaped block key into a RegExp (crash / mis-anchor class).
3. R3 — `pre-commit.ts` secret-scan invocation must not pass empty-string argv args when `.gitleaks.toml` is absent; the conflict-marker gate must not carry a dead branch; the CHANGELOG auto-date rewrite must not write when content is unchanged.
4. R4 — `pre-push.ts` SHA allowlists must accept SHA-256 OIDs (`{40,64}`), consistent with `ZERO_OID_RE`.
5. R5 — `platform-mirror-freshness.ts` version extraction must be BOM-proof.
6. R6 — `dev-sync.ts` must fail closed when a merge is already in progress (`.git/MERGE_HEAD` present) and say so explicitly.
7. R7 — `templates/co-price/.gitignore` must carry the common keyed managed block (correct close marker, no BOM, `!.env.sample`, fleet entries) with variant-specific entries outside the block.
8. R8 — `templates/common/.gitignore` SSOT block must not carry duplicate `dist/` / `nul` / `NUL` entries.
9. R9 — Documentation: `README_ko.md` KR-profile link must mirror the English README path; AGENTS.md §10 step 1.5 must cite the session-evidence loop by its real heading; CONSTITUTION.md must point ADR-0073 Amendment 2 readers at its recording location (ADR-0074); the VERSION_MANIFEST gate must document its `fetch-depth: 0` requirement at the gate.

**Accessibility**: not applicable — no user-facing UI (backend/tooling only).
**Preview verification**: not applicable — no UI change.

## Non-goals

- Extending the parity arm to all MERGE_MANAGED files, ADR-reference validation, ticket-schema validation, lifecycle-record coverage warnings (validator-hardening tickets T-20260917-001..004).
- `VARIANT_OVERLAY_SKIP` contract derivation and unlabeled-reconcile snapshots (design tickets T-20260917-005/006).
- CHANGELOG release cut, redundant variant `.gitignore` deletion (T-20260917-007/008).

## Approach

Smallest-diff local fixes at the verified sites (all findings carry file:line evidence in the review report). C1 additionally gains a CRLF fixture unit test in `tests/unit/generate-version-manifest.test.ts` so the class cannot silently regress; the standing machine gate for the wider managed-block parity class is tracked by T-20260917-001 (ratchet loop).

## Acceptance

- `bun scripts/review-baseline.ts` remains 6/6 green.
- New CRLF test passes; targeted unit tests pass (`bun test tests/unit/generate-version-manifest.test.ts tests/unit/managed-block-merge.test.ts tests/unit/pre-push-deletion-detection.test.ts`).
- `validate-templates.ts` accepts the rewritten co-price `.gitignore` (keyed managed block present, close marker lib-compatible).
