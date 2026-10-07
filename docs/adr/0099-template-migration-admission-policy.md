# ADR-0099: Template Migration Admission Policy

**Status**: Accepted
**Date**: 2026-10-05
**Deciders**: pm (user-directed remediation, 2026-10-05 scoped review T-20261005-021)
**Amends**: ADR-0051 (co-abap Stable Promotion — correction, see Context)
**Amended**: 2026-10-07 (T-20261006-005 — Decision 1 ratification extended to co-deck, whose 74-day beta window predates the 3-month criterion)

## Context

The 2026-10-05 scoped review of `co-consult`, `co-abap` and `co-develop` found all three stable variants were promoted with unfilled PROMOTION_CHECKLISTs (9/10 criteria "Pending", empty Review History) and no citable admission basis:

- **co-consult** entered `initial → stable` the day it was created (2026-06-03) with no ADR at all; its lifecycle record was created retroactively with no migration mention.
- **co-abap** migrated same-day (2026-08-15). ADR-0051 asserts "the promotion checklist criteria have been met" — the checklist shows the opposite — and cites a "variant lifecycle defined in CONSTITUTION.md" that does not exist (CONSTITUTION.md's Phase A/B/C model governs authoring, not status promotion).
- **co-develop** went `- → review → production` in 4 days (2026-06-09 → 2026-06-13); the record contains no beta phase and no promotion ADR.

The checklist criteria these promotions could not satisfy (minimum beta duration "3 months", "1 successful end-to-end engagement", "zero unresolved bugs") are generator boilerplate (`scripts/project-to-variant.ts`) that predates the engagement-tracking machinery (`beta-lifecycle` shipped 2026-07-11) and appears in seven variant checklists. The stricter beta-first admission convention arrived later (co-safety, 2026-08-26). No documented policy defines when a variant migrated from a proven project may enter directly at stable — the de-facto bar is `skills/project-to-variant`'s "tested in 2+ engagements and is stable", but no engagement attestation was ever recorded for these variants.

Leaving the records as-is is worse than either alternative: "stable v1.0.0" is the workspace's strongest contract claim (ADR-0026 Template Version Policy keys on it), and for these variants it currently rests on paperwork that asserts the opposite of its own content.

## Decision

1. **Migration fast-track admission is legitimate** and is the governing basis for the generation-1 migrated variants (co-consult, co-abap, co-develop; the same-day co-work/co-design promotions predate this ADR and may be ratified under it in a follow-up — extended 2026-10-07, T-20261006-005, to co-deck, whose 74-day beta window (2026-06-17 → 2026-08-30) fell below the 3-month criterion and is ratified in the same follow-up). A migrated variant may enter at stable when its source project was conversion-eligible per `skills/project-to-variant` (tested in 2+ engagements).

   **Extension scope (2026-10-07)**: the co-deck extension covers a second, distinct admission basis — a **beta-window shortfall waiver** (pre-ADR promotion, waiver + PM approval) — not migration fast-track: co-deck was created as a variant (docs/lifecycle/templates/co-deck.md, 2026-06-17), never migrated from a project, so §1's conversion-eligibility test does not apply to it. For such non-migrated ratifications the checklist marker may read **"N/A per ADR-0099 — ratified admission"**; the "migration fast-track" string remains reserved for true migrated cases.
2. **Attestation replaces criterion simulation.** For each ratified variant, the PROMOTION_CHECKLIST must: (a) state `Current Status: stable`, with the beta-window criteria that require engagement-tracking machinery — engagement (6), beta duration (8), user feedback (10) — marked **"N/A per ADR-0099 — migration fast-track"** rather than "Pending"; criteria that can be verified directly (e.g. bug count) are checked with evidence; (b) have the remaining criteria verified against review evidence; (c) carry a Review History row recording the ratification (date, basis = this ADR, reviewer). Checklists must not claim beta gates were "met" when they were waived.
3. **Correction to ADR-0051**: its statements that "the promotion checklist criteria have been met" and that the lifecycle is "defined in CONSTITUTION.md" are incorrect and are superseded by this ADR — co-abap's admission basis is migration fast-track under this policy, not a constitution-defined beta gate. ADR-0051 otherwise stands.
4. **Vocabulary mapping (SSOT)**: `variant.json status: "stable"` ≡ lifecycle-record phase `production` ≡ checklist `stable`. `beta` ≡ `review` (pre-production). Documented in `docs/lifecycle/README.md`.
5. **New (non-migrated) variants follow the beta-first path** (co-safety convention, ADR-0086 for per-asset promotion). This ADR does not weaken that path.
6. **Machine enforcement** is tracked as validator-hardening (T-20261005-022): `status: stable` with any unwaived "Pending" promotion criterion, or a same-day/short-window promotion without an ADR-0099 attestation row, is a finding.

## Consequences

- The three variants' stable status becomes procedurally honest: waived criteria are explicitly waived, not silently unfilled. Template Version Policy (ADR-0026) applies to them unchanged.
- Reconciliation work lands in the same remediation wave (T-20261005-021): checklist rewrites in co-consult/co-abap/co-develop and the vocabulary paragraph in `docs/lifecycle/README.md`.
- Future migrated variants inherit a documented admission path instead of repeating the silent bypass; post-promotion material changes should still bump `variant.json` version (co-develop's 120 unversioned commits are the counter-example).
