# Design: Design-fleet advancement handoffs (foundation §8 example, service-design promotion, delivery-gate evaluation)

- **Spec ID**: 2026-09-27-design-fleet-advancement-handoffs
- **Date**: 2026-09-27
- **Status**: implemented
- **Source**: manual (workspace-repo handoffs logged by the co-design advancement batch
  `Projects/co-design/docs/designs/2026-09-27-design-asset-advancement-p1-p7-design.md`,
  meeting `Projects/co-design/memory/meeting-2026-09-27-design-asset-advancement.md`)
- **Related**: ADR-0066, ADR-0068, ADR-0074, ADR-0080

## Problem

The co-design advancement batch left three workspace-repo handoffs:
1. publish co-design's `docs/design.md` as the foundation §8 worked example — the
   Onyx lineage (co-price 2.0 → co-newbiz 3.0) out-documents the pilot;
2. propagate `service-design` v1.1.0 to co-architect (v1.0.0) — PM ruled the
   upgrade path as the mechanism, which requires the skill to become common;
3. evaluate co-deck's `slide-layout-gate` pattern (machine-checked layout
   conformance before export) for design-system adoption.

## Decision

### 1. Foundation §8 worked example (templates/common/docs/design-foundation.md)

Add one row to the §8 asset table citing `Projects/co-design/docs/design.md` as the
worked example of the §7 validation contract — explicitly scoped
"workspace fleet repository only; not delivered to projects and not valid in
standalone checkouts", preserving §8's own standalone-checkout rationale. Also add a
row for the now-common `service-design` skill. The co-design pilot regains the
standard-setter seat without changing any normative rule.

### 2. service-design promotion to L0 (accessibility-audit precedent)

`skills/service-design/SKILL.md` (v1.1.0, body unchanged from co-design except a
trailing `",` artifact removed) with `scope: common`, `l2_propagate: true`;
`templates/co-design/skills/service-design` removed (single-location rule). Registry
lockstep per the 2026-09-21 modernization: SKILLS.md row updated, lifecycle record
created (`docs/lifecycle/skills/service-design.md`), VERSION_MANIFEST and skill-graph
regenerated, L1 + platform mirrors via propagate-to-templates in dev-sync. co-architect's
local v1.0.0 copy is superseded by common v1.1.0 at its next upgrade (upgrade-path
mechanism, as ruled — no direct sibling-repo edits).

### 3. co-deck delivery-gate evaluation (recorded conclusion: defer)

`slide-layout-gate` (co-deck v1.0.0) blocks PDF export until slide content conforms
to a merged layout spec — a delivery-time structural gate, complementing co-design's
token-time lint. Evaluation against this repository's design stack:

- **Fit**: co-design's equivalents are design-lint (token/registry conformance, every
  PR) and the playground render smoke (roles survive the build). A structural
  "does the screen compose from declared patterns" gate would add value beyond both —
  lint checks token usage, not composition.
- **Cost**: a composition checker needs a machine-readable screen-to-pattern mapping.
  The 2026-09-27 registries (`docs/design/patterns.registry.yaml` +
  `components.registry.yaml`) provide the vocabulary, but no project currently
  declares per-screen compositions to check against — the gate has nothing to
  consume yet.
- **Conclusion**: **deferred, not rejected.** Adoption becomes actionable when a
  project (co-design playground first) declares per-screen pattern compositions; the
  registry format would then gain a `screens:` section and design-lint a
  `composition` sub-check. Tracked as a follow-up, not scheduled.

## Design-phase gate conformance

Template-layer content change (foundation §8) + skill lifecycle change (promotion) —
no UI, no tokens, no patterns altered. Accessibility: not applicable (explicit
statement per ADR-0065); preview verification exempt (non-UI, ADR-0070).

## Consequences

- Every scaffolded project receives `service-design` 1.1.0 from the next template
  sync; co-architect reconciles on upgrade.
- The foundation spec now names a concrete worked example, closing the documentation
  lead the Onyx lineage had taken.
- Composition-gate adoption has a recorded decision path with its precondition named.
