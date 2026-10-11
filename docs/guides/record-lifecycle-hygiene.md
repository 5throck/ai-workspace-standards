# Record Lifecycle Hygiene

From co-newbiz's S8 legacy-model cleanup (PR #489, migration
0133_business_case_archive.sql, ADR-0158; T-20261011-010). Two patterns for
records that decisions depend on: archive instead of delete, and enumerate
before cleanup.

## Archive, don't delete — for audit-referenced records

When adoption/gate/decision records reference a business record, deleting the
record orphans the decision's evidence. Instead:

- Add **nullable `archived_at` / `archived_by`** columns (`NULL archived_at` =
  active; every existing row is grandfathered — the migration is purely
  additive and reversible).
- Archived rows **drop from operational lists and predicates** (list views,
  comparisons, completion/RAG filters add `AND archived_at IS NULL`) but
  **still resolve by id** in decision/history views, rendered with an
  explicit "archived" label.
- Deleting remains reserved for records nothing references; the archive write
  records **who** (`archived_by`) and **when**, so the audit trail answers
  both.

## Enumerate before cleanup

A cleanup affordance keyed on an aggregate count that included rows the
filtered view never showed let a correct-looking action destroy the wrong
records. The rule:

- A cleanup affordance must **enumerate the exact set it acts on** — show the
  ids/rows, never just "N items will be removed".
- The enumerated set must come from the **same predicate** the confirmation
  UI displayed; if the count and the visible list can disagree, the count is
  the bug.
- Aggregate counts are acceptable only as a summary **of the enumerated set**,
  never as its substitute.

## Review-pass checklist items

- [ ] Records referenced by decisions are archived (nullable archived_at/by), not deleted
- [ ] Archived rows drop from lists but resolve in decision views with a label
- [ ] Cleanup affordances enumerate the exact set they act on (ids, not counts)
- [ ] The confirmation predicate and the action predicate are the same query
