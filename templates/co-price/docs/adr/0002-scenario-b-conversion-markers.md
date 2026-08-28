---
status: "Accepted"
---

# ADR-0002: Scenario B Variant Conversion via Governance Markers

**Status**: Accepted
**Date**: 2026-08-25
**Deciders**: pm, lead-architect

## Context

`co-price` originated as an independent repository (`Pricing-Mgmt-Simulation`) and
required conversion into a compliant `ai_workspace` variant. The workspace
conversion guide defines two scenarios; the applicable one is **Scenario B**
(existing project → variant-based governance).

The automated helper `scripts/upgrade-project.ts` rejects any variant name that
does not exist under `templates/` (`co-price` is not yet a registered template),
and pointing it at the nearest existing template (e.g., `co-consult`) would
overwrite this project's own AIG agent roster and skills with foreign definitions.

## Decision

1. Perform Scenario B conversion **manually via governance marker files**, without
   executing `upgrade-project.ts`:
   - `variant.json` — `variant_type: consulting`, manifests of existing and planned
     agents/skills, lifecycle state.
   - `_ORIGIN.md` — provenance (standalone origin), inheritance table,
     reconcile-survival warning, manual copy checklist.
   - `_COMMON_VERSION.md` — snapshot against `templates/common@0.5.3`
     (`ai_workspace@145adb4d`).
   - `.claude/template-version.txt` — enables future tooling.
2. Template promotion to `templates/co-price/` (Phase C, via
   `l3-to-variant-pipeline.ts`) is **deferred** until the v10.1 feature phases land.

## Alternatives Considered

- `upgrade-project.ts --variant co-consult`: rejected — destructive to the roster.
- Full scaffold-and-migrate: rejected — the application is production-shaped;
  rebuilding risks regression for zero governance gain.

## Consequences

- The project is workspace-compliant now while keeping its independent identity.
- `upgrade-project.ts` remains unusable until Phase C registers the template —
  documented in the PR and plan so future sessions do not retry blindly.
- Common-synced assets (`.githooks/`, `dev-sync|audit|sync-md` scripts) are tracked
  in `_ORIGIN.md` for future reconcile operations.
