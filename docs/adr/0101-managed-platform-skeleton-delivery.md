---
status: Accepted
date: 2026-10-25
author: PM
---

# ADR-0101: Platform-Doc Out-of-Zone Skeleton Becomes a Managed Delivery Surface (CLAUDE.md / GEMINI.md)

## Context

The numbered skeleton sections of `CLAUDE.md` and `GEMINI.md` (content outside the
`COMMON-CLAUDE`/`COMMON-GEMINI` marker zones) freeze at scaffold vintage: the upgrade MERGE pass
(`upgrade-policy.ts` `MERGE_MANAGED_FILES` → `lib/managed-block-merge.ts`) re-injects only marker-delimited
zones, so template-side skeleton edits never reach existing projects. The 2026-09-12 upgrade wave removed
`### 5. Agent Dispatch Rules` / `### 6. Native Sub-agents` heading lines from all then-existing projects'
CLAUDE.md (and `### 5.` from 10 of their GEMINI.md) while the template kept them; a fleet census shows 11
projects still lack those sections (plus `### 3.` / `### 4.5` at older vintages), breaking §1–§11 numbering
and killing in-project anchors — T-20261025-anchor-repair (PR #1604) re-pointed delivered governance-doc
links at `#execution-plan-boilerplate` as a stopgap. ADR-0031 forbids direct project edits (fleet changes
flow template release → upgrade wave), and the co-price c8c6eb7 incident proves project-local content
(e.g. co-abap's `## SAP Safety` hardening, its `LOCAL-PATCH` GEMINI §5) must survive every upgrade.
Design: `docs/designs/2026-10-25-managed-platform-skeleton-design.md`.

## Decision

1. **Canonical-section registry delivery (insert + guarded replace), not wrappers, not regeneration.**
   A new pure lib `scripts/lib/platform-skeleton-merge.ts` carries an ordered registry of canonical skeleton
   sections per file (CLAUDE.md: §2, §3, §4.5, §5, §6; GEMINI.md: §5). The MERGE pass runs it after the
   managed-block merge: a missing section is inserted at a template-relative anchor
   (`before/afterZoneContaining`); an existing divergent section body is replaced only when the project span
   contains no heading or HTML comment absent from the template section (guard G1 — this is what keeps
   co-abap's `LOCAL-PATCH` §5 and every project-local hardening intact) and within a size cap (G2), with a
   `<file>.pre-skeleton.bak` snapshot written fail-closed before any write.
2. **Rejected: keyed `WORKSPACE-MANAGED` wrappers around skeleton segments.** Marker families do nest
   legally (per-pattern non-greedy scans never consume each other's markers), but the keyed phase
   wholesale-replaces whole spans (unguarded project-local loss), and `findInsertionPosition` inserts
   missing wrappers after the last same-label block or at EOF — wrong positions that break §-numbering —
   while wrapping 16 project files by hand violates ADR-0031.
3. **Rejected: full-file regenerate-with-preserve.** The heuristic "preserve the project's own content"
   extractor institutionalizes the c8c6eb7 loss class.
4. **Normalization rides the ordinary nightly wave.** The engine is L0-only (ADR-0073); the registry reads
   section content from `templates/common/` at merge time, so after release the daily `project-resync`
   batches restore the 11 projects with no one-off migration script and no direct project edits.
   New scaffolds inherit immediately.
5. **CODEX.md and HERMES.md are deferred.** Both carry `### 5.` in all 16 project copies (verified census)
   — their files were delivered after the 09-12 wave and have zero drift. Adopting them later is a registry
   extension, not a redesign.
6. **Validator hardening.** `validate-templates.ts` gains a `skeleton-registry` arm (every registered
   heading exists out-of-zone in `templates/common/{CLAUDE,GEMINI}.md`, in order); a recommended separable
   `validate-docs-links.ts` arm requires links from delivered `docs/governance/**` into the platform docs to
   resolve against `templates/common/` heading slugs (the project delivery source).

## Consequences

- **Positive**: skeleton edits propagate to all existing projects through the standing upgrade channel;
  §1–§11 numbering and `#5-agent-dispatch-rules` / `#6-native-sub-agents-agent-tool` anchors are restored
  fleet-wide; project-local content loss on the skeleton layer becomes structurally impossible (guards +
  snapshots + inserts that delete nothing); the 09-12 defect class (upgrade eats a heading the template
  has) is closed — the merge now reconciles skeleton sections in both directions.
- **Cost**: one more merge stage to test (fixtures for insert, collision-skip, LOCAL-PATCH skip,
  idempotency, zone-untouched property); unnumbered skeleton prose (bootstrap note, hook tables,
  GOVERNANCE-POINTER-TABLE) remains frozen at scaffold vintage until those sections are registered —
  a deliberate v1 scope line, extendable by registry entry only.
- **Neutral**: marker zones, PM-04 managed-block parity, and the L0→L1 publish transforms are untouched;
  ADR-0031's fork model is preserved (L0 → `--governance-l1` → templates/common → MERGE pass → projects);
  relationship to ADR-0073 unchanged (engine and registry stay L0-only).

## References

- Design: `docs/designs/2026-10-25-managed-platform-skeleton-design.md` (fleet census, merge semantics,
  guards G1/G2, per-project first-wave operations, validation battery)
- ADR-0031 (L1/L2 fork model — no direct project edits), ADR-0073 (upgrade engine L0-only)
- T-20261025-anchor-repair design (PR #1604 — the stopgap this ADR supersedes as the fix channel)
- Code: `scripts/lib/upgrade-policy.ts` (`MERGE_MANAGED_FILES`), `scripts/lib/managed-block-merge.ts`
  (pattern families, insertion semantics analyzed), `scripts/upgrade-project.ts` (MERGE pass),
  `scripts/propagate-to-templates.ts` (`GOVERNANCE_L1_FILES`, `applyGovernanceTransforms`)
