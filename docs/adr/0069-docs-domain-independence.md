---
status: Accepted
date: 2026-09-06
author: PM
---

# ADR-0069: L1 docs/ Remains Independent (docs Propagation Domain Ratified as Disabled)

## Context

`propagate-to-templates.ts` gates its `docs` domain behind a blocking warning:
"Disabled until docs propagation policy is decided (ADR required). L1 docs/ is
currently independently maintained, not a mirror of L0 docs/." The 2026-09-06
project-resync cycle again hand-synced L1 normative docs
(`templates/common/docs/design-foundation.md`, `context.md`), keeping the
ambiguity alive: every governance-doc change re-raises the question of whether
L0 `docs/` should mirror into L1.

## Decision

**Ratify the status quo: the L1 `docs/` layer stays independently maintained.**

1. The `docs` propagation domain remains **disabled — permanently, by decision**
   (not "pending"). `docs/` content at L0 is workspace-governance material
   (constitution, ADRs, designs, specs); L1 `docs/` is project-facing normative
   documentation. They are different audiences, not mirrors.
2. **Normative content that must reach L1** travels through the existing,
   explicit mechanisms: COMMON-CONSTITUTION marker zones
   (`templates/common/docs/context.md`), the L1 spec documents themselves
   (`design-foundation.md`), and propagated skills/scripts. When L0 changes such
   content, the L1 hand-sync is a **required step of the same change** (as done
   in the 2026-09-06 cycle).
3. Do not re-open full-mirror vs whitelist debates without a new ADR explicitly
   superseding this one.

## Consequences

- The per-change ambiguity and the propagate warning's "pending" framing are
  resolved; the warning text now cites this ADR.
- Hand-syncs remain a manual duty — drift between L0 normative text and its L1
  mirror is caught by review, not tooling (accepted trade-off; volumes are low).

## Implementation

| File | Change |
|------|--------|
| `scripts/propagate-to-templates.ts` | docs-domain disable reason cites ADR-0069 |
