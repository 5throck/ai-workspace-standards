---
schemaVersion: 1.0.0
spec-id: cosafety-zone-reconciliation
---

# co-safety COMMON-AGENTS Zone Reconciliation Design

## 1. Overview

Reverses the 2026-09-10 exclusion of co-safety from the `governance-agents`
marker-inject target list (propagation-map.json). co-safety is a full official
variant and must receive COMMON-AGENTS zone injections identically to the
other 12 variants. Supersedes the T-20260910-022 "intentional divergence"
ruling.

## 2. Investigation findings

- The ruling's stated basis — "its zone intentionally diverges (Safety OS
  governance section)" — **does not exist**: `git log -S "Safety OS"` over
  `templates/co-safety/AGENTS.md` returns nothing, and the zone diff at
  adjudication time (2026-09-11) was a single line (the Variant-Specific
  Audit Hook path bullet).
- The real difference: co-safety declares its audit hook at
  `scripts/co-safety/audit-variant.ts` (`variant.json` → `script_manifest`),
  while the L1 wording named only the conventional top-level path. co-abap
  keeps its hooks in a variant subdirectory too yet stayed listed — so the
  divergence was a documentation correction, not a governance fork.
- T-20260910-022 was skipped by its runner ("needs human judgment") and later
  closed with `result: null` — the promised human adjudication never
  happened; the exclusion merely froze a WARN in place.
- Cost of exclusion (already incurred): the Universal Design Gate section
  (2026-09-12) never reached the co-safety template; the ADR-0078 section had
  to be hand-inserted (2026-09-13); the codex rollout added a W5 post-check
  exception for the same reason.

## 3. Resolution

1. **Variant-neutral L1 wording**: the COMMON-AGENTS "Variant-Specific Audit
   Hook" bullet now points at the declaration SSOT (`variant.json` →
   `script_manifest`) with both conventional locations named as examples, so
   every variant/project shares one text.
2. **co-safety listed**: `governance-agents.target_variants` gains
   `co-safety` (13/13 variants); the note records the supersession.
3. **Zone re-sync**: `propagate-to-templates.ts --apply --docs` injected the
   L1 zone into all 13 variant templates; the hand-inserted ADR-0078 section
   and the old hook-path bullet in co-safety are replaced by the shared text.
4. **PM-02 WARN cleared**: `validate-templates.ts` drops from 2 warnings to 1
   (the remaining one is the pre-existing, unrelated C-CM-04 platform-skill
   inventory scope question).

## 4. Delivery scope

- `AGENTS.md` (L0) + `templates/common/AGENTS.md` (L1, via
  `--governance-l1`): neutral audit-hook bullet.
- `scripts/propagation-map.json`: co-safety listed + note supersession.
- All 13 `templates/co-*/AGENTS.md`: zone re-injected via `--docs`.
- `docs/designs/2026-09-12-codex-platform-support-design.md`: the
  "co-safety deliberately excluded" cell annotated as superseded.
- `Projects/co-safety`: upgraded so its project AGENTS.md zone follows its
  template; synced via its own `/sync` pipeline.
- The other 9 projects receive the one-bullet zone update through the normal
  upgrade channel at their next routine upgrade (documentation-only delta).

## 5. Verification

- `bun scripts/validate-templates.ts` — 0 errors, 1 warning (C-CM-04,
  unrelated)
- `bun scripts/audit.ts` — all checks pass
- `propagate-to-templates.ts --apply --docs` — 13 updated, 0 out of sync;
  co-safety zone byte-identical to L1 zone modulo nothing (both carry the
  identical COMMON-AGENTS section)
