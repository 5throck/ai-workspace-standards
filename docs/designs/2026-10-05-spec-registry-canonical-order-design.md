# Spec Registry Canonical Order Design (T-20261005-002)

- **Date**: 2026-10-05
- **Status**: Implemented (2026-10-05 — delivered with the sorted insertion, the save-time canonicalization, the audit Check 5, and the regression tests in the same change set)
- **Owner**: Automation Engineer (design + implementation)
- **Spec id**: `2026-10-05-spec-registry-canonical-order-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Ticket**: T-20261005-002
- **Related ADRs**: ADR-0074 (Universal Design Gate)

---

## 1. Summary

`docs/specs/registry.json` receives a new entry for every design doc registered through the Design Gate, and `spec-register.ts` appended each one at the shared array tail. Any two PRs open at the same time therefore modify the same last lines, so concurrent registrations conflict deterministically — observed and hand-spliced five times on 2026-10-05 alone (PRs #1416–#1420), and again during PR #1423's registration (a hand-splice had already fused three entry heads into one object, silently dropping two specs from the parsed file). This change makes insertion content-derived: the registry array is kept **sorted by id**, `saveRegistry()` canonicalizes the whole array on every write, and a new audit Check 5 fails a file that was hand-spliced or tail-appended out of band. The "one-file-per-spec storage with a generated projection" option named in the ticket stays a non-goal for now (§5).

## 2. Mechanism

| Piece | Behavior |
|-------|----------|
| `insertSpecSorted(specs, entry)` (spec-register.ts, new export) | Places a new entry at its id boundary — `findIndex(s => s.id > entry.id)` then splice, push at the tail when the id is the largest. |
| `saveRegistry()` (changed) | Sorts the whole array by id before writing. Every write heals historical arrival-order; the healing is one-time for this repo (91 out-of-order pairs as of 2026-10-05) and the invariant holds afterwards. |
| `canonicalOrderViolation(specs)` (spec-register.ts, new export) | Pure predicate: returns a message naming the first out-of-order pair, or `null`. |
| audit.ts spec-check **Check 5** (new, v2.49.0) | FAILs when `canonicalOrderViolation` is non-null, with the pair named and the hint that the next `spec-register` write re-sorts. |
| spec-register.ts v1.5.0 | `registerSpec()` inserts via `insertSpecSorted`; save-time canonicalization as above. |

## 3. Merge model and residual

With the array sorted, a registration's diff touches only the entry's alphabetical neighborhood. Two concurrent registrations whose new ids fall into **different gaps** of the committed base produce disjoint line edits and merge cleanly — pinned structurally by unit test and demonstrated end-to-end with a real two-branch git merge (different ids → clean merge, final file sorted, both entries present; evidence in the delivery session log).

**Residual (documented, not eliminated):** two ids that fall into the **same gap** (typically same-day alphabetical neighbors, or both larger than every existing id — the pure tail case) still collide at line level on a simultaneous push. The loser rebases onto main and replays cleanly because the sorted position is stable; the conflict is two adjacent lines rather than a divergent tail. Fully eliminating collisions requires the one-file-per-spec projection (§5).

## 4. Canonicalization event

The first write after this change (this design's own registration) reorders the live registry: 234 entries, 91 out-of-order pairs → sorted. The diff is order-only; no entry content changes. Audit Check 5 then holds the file to the invariant.

## 5. Non-goals

- **One-file-per-spec storage** (registry as a generated projection): the only scheme that removes same-gap collisions entirely; a storage-layout migration with fan-out across every reader (`audit.ts`, `verify-adr-governance`, project-side Design Gate copy) — deferred, tracked by the ticket's optional direction.
- No backfill or re-dating of existing entries; ordering is by the existing `id` string (date-prefixed slugs sort chronologically).
- No change to `--update` semantics beyond the save-time sort.

## 6. Verification

1. `bun test tests/unit/spec-registry-canonical-order.test.ts` — 7/7 (insert positions; violation predicate; the different-gaps pin; the same-gap residual replay).
2. End-to-end git acceptance: scratch repo + two branches registering different specs → both merges clean, final registry sorted with 5 entries.
3. `bun scripts/audit.ts --spec-check` — Check 5 passes on the canonicalized registry.
4. `bun scripts/typecheck.ts` — 0 errors; `bun scripts/verify-scripts.ts --verify` — green after L1 republication (both touched scripts are L0+L1).
