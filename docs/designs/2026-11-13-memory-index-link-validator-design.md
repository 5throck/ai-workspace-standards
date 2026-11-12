---
schemaVersion: 1.0.0
spec-id: 2026-11-13-memory-index-link-validator
---

# Memory Index Link Validator Design (U-20261112-007)

## 1. Problem

Upstream request U-20261112-007 (from co-safety, template_version 0.30.0): daily
memory logs get archived to `memory/archive/` (git-ignored) or deleted outright, but
`memory/MEMORY.md` is not rewritten — 56 of 63 index rows dangled on a fresh clone,
surviving multiple audit-passing cycles because no gate in the battery checked index
link integrity.

Investigation at triage closeout found the battery was *partially* fixed already:
`scripts/verify-memory.ts` v1.2.0 added the reverse dead-link check (Check 3b,
T-20260909-002), which raises ERRORS for `## Sessions` rows whose target file is
gone, and `scripts/archive-memory.ts` tombstones rows at archive time. The residual
gap is scope: Check 3b extracts links from the `## Sessions` section only, so dead
links in `## Meetings` and `## ADRs` (and any other index section) are never
detected. The workspace root itself demonstrated the defect class at the time of
this design: two dead Meetings-row targets on `origin/main`.

## 2. Decision

Extend `scripts/verify-memory.ts` to v1.3.0 with a **whole-index link integrity
check (Check 3c)** rather than adding a new script:

- **House pattern**: `verify-memory.ts` is already the memory validator, already
  wired into `audit.ts` (which runs it in every context that has a memory target)
  and the pre-commit hook. A new script would duplicate resolution logic and need
  new wiring; extending keeps one validator per concern.
- **Whole-index scan**: every flat `.md` link target referenced anywhere in
  `MEMORY.md` (all sections) must resolve to a file in the `memory/` directory.
- **WARN severity with count**: missing targets emit per-row warnings plus a
  summary line `N MEMORY.md index link target(s) missing from memory/ (Check 3c,
  WARN stage)`. Rationale: the co-safety defect arrived with *repairable* drift on
  a base whose audit was green; a hard FAIL would block unrelated `/sync` runs on
  legacy drift. Sessions dead rows stay ERROR (Check 3b, unchanged) — the tombstone
  convention makes a dead linked Sessions row a genuine defect, while Check 3c
  covers the weaker invariant for Meetings/ADRs prose links.
- **Scope exclusions**: links escaping the flat memory dir (`archive/…`,
  `../docs/…`) and fragment anchors (`file.md#anchor`) are out of scope —
  `memory/archive/` is deliberately git-ignored, so archive-target existence is
  machine-local and would false-positive on fresh clones (the exact co-safety
  scenario).
- **Dedup**: Check 3c findings are deduped against Check 3b's Sessions ERROR set so
  a dead Sessions row is never double-reported.

## 3. Interfaces

- New exported pure helper `findMissingIndexLinks(content: string, memDir: string):
  string[]` — deduped, order-stable list of missing flat hrefs; import-guarded CLI
  unchanged, so unit tests import the module without triggering verification.
- No CLI, output-format, or wiring changes; `audit.ts` consumes the same exit-code
  contract (warnings do not fail).

## 4. Mirror and Lifecycle Surface

- `scripts/verify-memory.ts` → verbatim copy to `templates/common/scripts/` (the
  script is declared `L0+L1` in both `SCRIPTS.md` registries).
- Both `scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md`: row version
  1.2.0 → 1.3.0 with changelog; `#### verify-memory.ts` Purpose updated to state
  the two-direction link-integrity contract.
- Best-effort lifecycle record seeded at `docs/lifecycle/scripts/verify-memory.md`
  (per-script records are optional; SCRIPTS.md remains the SSOT per
  docs/constitution/06.5-script-lifecycle.md).
- Tests: `tests/unit/verify-memory-dead-links.test.ts` v1.1.0 — new
  `findMissingIndexLinks` describe block (Meetings/ADRs detection, all-resolved,
  escape exclusions, fragment stripping, dedupe, live root shape guard) alongside
  the retained v1.0.0 Sessions regression block.

## 5. Non-Goals

- No automatic repair (repointing/tombstoning) — the tombstone writer is
  `archive-memory.ts`; manual drift repair stays a human/project-review action.
- No severity promotion of Check 3c to FAIL — subject to the ADR-0055 soak pattern
  if a later ticket wants the hard gate.
- No changes to `audit.ts` wiring, `dev-sync.ts`, or the tombstone convention
  documented at the top of `memory/MEMORY.md`.
