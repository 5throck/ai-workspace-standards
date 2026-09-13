---
schemaVersion: 1.0.0
spec-id: variant-context-fleet-inclusion
---

# variant-context COMMON-CONTEXT Fleet Inclusion Design

## 1. Overview

Completes co-safety's (and co-price's) equal treatment in the second
marker-inject domain, `variant-context`: their `docs/<variant>.context.md`
files were variant-authored with no COMMON-CONTEXT zone and were deliberately
unlisted (same adjudication class as the COMMON-AGENTS exclusion reversed
earlier today, T-20260913-001). Investigation additionally found the
`--docs` publish path for this domain was silently inert for ALL variants and
would have appended duplicate zones once active — both fixed.

## 2. Investigation findings

- **Inert publish path**: `publishDocs()` derived target paths from
  `basename(source_file)`, ignoring the domain's `target_file` template
  (`docs/{variant}.context.md`). The variant-context domain therefore probed
  `templates/<variant>/context.md` (nonexistent) and skipped every variant.
  The 11 seeded zones (ADR-0062 pilot, 2026-08-24) were never refreshable from
  L1 — detection existed (`--check-drift` honors `target_file`), but no fix
  path did.
- **Duplicate-append hazard**: `replaceCommonSection()` matched sections by
  their first heading. The COMMON-CONTEXT source block is headingless
  (synthetic `section-0` heading), so the heading-anchored pattern could never
  match; once the path was fixed, every run would have APPENDED a duplicate
  zone to every variant file instead of updating in place.
- **No project delivery channel**: `upgrade-project`'s DOCS_MERGE
  MANAGED_PATTERNS lacked COMMON-CONTEXT, so project copies could never
  receive zone updates (project copies were already inconsistent: co-abap /
  co-develop / co-game have the zone, co-consult does not).
- co-safety's file also carried a stale manual model-ID table
  (`claude-opus-4-7` era) — flagged for follow-up, not touched here.

## 3. Resolution

1. **`propagate-to-templates.ts` 2.14.0 → 2.15.0**: publishDocs honors
   `target_file` with `{variant}` substitution; per-domain
   `scrub_constitution_refs` now applies at publish time (same contract as
   `--check-drift`) — exercising the previously-inert `constitution-context`
   domain (CONSTITUTION.md slices → templates/common/docs/context.md) without
   leaking L0 references; `replaceCommonSection()` gains a bare-zone fallback
   (replace the file's existing zone of that marker; append only when none
   exists — idempotent, no duplicates).
2. **`upgrade-project.ts` 1.25.0 → 1.26.0**: MANAGED_PATTERNS gains
   COMMON-CONTEXT so DOCS_MERGE delivers zone updates to project
   `docs/<variant>.context.md` copies.
3. **Zone seeded + listed**: `templates/co-safety/docs/co-safety.context.md`
   and `templates/co-price/docs/co-price.context.md` gain the COMMON-CONTEXT
   coding-guidelines zone (footer 1.0 → 1.1); both listed in
   `variant-context.target_variants` — 13/13 variant coverage.
4. **Test/registry hygiene found en route**: MEMORY.md dead link
   (`2026-09-05.md` archived without tombstone conversion — pre-existing from
   commit 1167f65b), intentional-duplicate line pin shifted 403 → 411 by the
   2026-09-13 AGENTS.md section insert, and the upgrade-tree-sync fixture
   hardcoded the context footer version (now derived dynamically).

## 4. Verification

- `propagate-to-templates.ts --apply --docs` — 27 marker-inject pairs, all
  in sync on re-run (idempotent); constitution-context domain active and
  scrubbed (`templates/common/docs/context.md already in sync`, file
  byte-identical to HEAD)
- `validate-templates.ts` — 0 errors, 1 warning (pre-existing C-CM-04)
- `audit.ts` all-pass; `verify-scripts.ts --verify` 171/171; `bun test`
  489/489 (6 failures fixed: 3 fixture staleness, 1 line pin, 1 dead link,
  1 L1-leak induced)
