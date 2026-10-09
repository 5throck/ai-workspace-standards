# co-safety lifecycle-fork ahead-deltas port — Design

- **Spec ID**: 2026-10-09-co-safety-ahead-deltas-port-design
- **Date**: 2026-10-09
- **Status**: implemented
- **Ticket**: T-20261008-008 (follow-up candidate documented by the registered 2026-10-08-skill-graph-reconciliation-wave-design; owner-review caveat satisfied by user direction 2026-10-09 + PR review)
- **Method**: inversion re-merge — each fork is rebuilt from the CURRENT common body, then the fork's deliberate adaptations are re-applied. Guarantees no common ahead-delta is missed.

## Ported ahead-deltas (common → co-safety forks)

**agent-lifecycle-manager (1.2.0 → 1.3.1, one patch above common 1.3.0 to keep fork/common versions distinct for the E2 version-drift arm)**: Gate-Moment Decision Records now name the ADR-0061 required frontmatter fields + `validate-decisions.ts` (hire + fire); hire flow gains the lifecycle-record creation step; publish steps regenerate derived artifacts (`generate-version-manifest`, `generate-skill-graph`); fire flow gains `removal_review` scheduling (90-day default, audit-enforced); the fired-agent reference sweep is documented as mechanical (Check 13).

**project-review (1.2.0 → 1.3.3, above common 1.3.2 for the same reason)**: meeting-facilitation dispatch form replaces the retired `/meeting` slash command; review-baseline one-shot runner paragraph ported ADAPTED to the fork's project-local commands (workspace-root gates stay a pointer, per the fork's existing adaptation). Fork keepers: `## Context` section, project-local `bun run audit`/`verify-scripts` commands, 7-domains scope row, variant ticket-routing row, no `upgrade-project` related_skill.

**skill-lifecycle-manager (1.4.0 → 1.5.1, above common 1.5.0 for the same reason)**: skill-request block gains `evidence_refs` (PM bounces incomplete requests at triage); Gate-Moment Decision Record names the ADR-0061 frontmatter + evidence_refs pointer + validation; the full **Registry Lockstep Checklist** section ports with its L0 command names preserved.

## Preserved fork contract (never overwritten)

`scope: co-safety`; the `audit_exception: safety-os-skill-structure` body annotation (ALM + SLM) — the forks keep their legal_basis-gated SSOT skill format, NOT the generic 5-section/7-frontmatter schema; all project-local command adaptations above.

## Surfaces & cascade

Canonical `templates/co-safety/skills/<3>/SKILL.md` + all 5 platform mirrors re-copied (parity by hash); `templates/co-safety/skills/SKILLS.md` rows: version bump + last_reviewed 2026-10-09; skill-graph regenerated (hash shifts). Fork skill lifecycle records: none exist (variant-maintained registry note stands) — no record updates required.

## Verification

Five-mirror hash parity 1-unique per skill; `validate-variant-claims --template co-safety` PASS; `audit.ts`/`validate-templates.ts`/`lifecycle-sync-audit` PASS; skill-graph regenerated with the fork hashes.
