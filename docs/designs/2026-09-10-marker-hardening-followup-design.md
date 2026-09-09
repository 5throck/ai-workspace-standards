# Design: Marker Hardening Follow-up — Multi-Marker Stale-Index Splice Fix, co-game/co-work Doc Hygiene

**Date**: 2026-09-10
**Status**: Draft (Row 0 Design Gate document; facts verified 2026-09-09/10 by direct code and file reading, re-confirmed 2026-09-10)
**Source**: PM-dispatched architect task; follow-up to [2026-09-10-marker-engine-remediation-design.md](2026-09-10-marker-engine-remediation-design.md)
**Spec ID**: 2026-09-10-marker-hardening-followup-design
**Related**: PR #852 (merged; main=`8532ceab`) — landed §8 marker retirement + scrub A-5/A-6 fix per the predecessor design; [ADR-0062](../adr/0062-marker-based-doc-propagation-domains.md), [ADR-0065](../adr/0065-accessibility-standard.md), `scripts/propagate-to-templates.ts`, `scripts/helpers/markers.ts`

---

## Background

PR #852 retired the 7 mislabeled §8 intentional-duplicate markers and fixed the target-aware scrub defect. The predecessor design explicitly deferred three items (its NG2 and NG5); this design closes all three.

**1. Engine stale-index splice bug (predecessor NG2 / Known Limitations).** In `runMarkerRewrite` (`scripts/propagate-to-templates.ts:1394-1481`), the intentional-duplicate loop iterates the flat list from `scanIntentionalDuplicateMarkers()`; each stale marker re-reads `marker.file` (`:1441`) but splices using the **scan-time** `marker.line` index (`:1443`, section bounds `:1446-1455`, splice `:1459`, hash update in place at `:1462-1464`). If an earlier rewrite in the same file changes line counts, every later marker in that file splices at a stale index — misplaced or corrupted edits. Currently unreachable: post-#852 exactly two §3 markers remain, in two different files (`templates/common/docs/context.md:387`, `templates/common/docs/variant.context.template.md:152`). **It re-arms the moment a file with 2+ intentional-duplicate markers returns.**

**2. co-game duplicate provenance sections.** `templates/co-game/docs/co-game.context.md` has two stacked `## Template Provenance` sections near the end (post-#852 lines ~220-229): the first documents the 0.5.3 co-develop→co-game fork, the second the 0.6.0 co-game variant (with `Target-Jurisdiction: region-neutral`). Defect: duplicate headings; both carry real provenance facts. (Its `version: 2.0` footer at :218 is separate and untouched.)

**3. co-work stacked version footers.** `templates/co-work/docs/co-work.context.md` ends with two stacked footer lines (:187-188, read 2026-09-10):

```
*co-work.context.md version: 1.3 — connector-schemas referenced (Domain Rule 5)*
*co-work.context.md version: 1.4 — Automation Runbook section added + Domain Rule 6 [WORK-R3] (when to script vs when to hand off; backlog §8 Open row 14, closed 2026-08-26)*
```

The 1.3 line carries one fact absent from 1.4 ("connector-schemas referenced (Domain Rule 5)").

---

## Goals / Non-Goals

### Goals

- G1 — Make `--marker-rewrite` correct for files with 2+ intentional-duplicate markers (bottom-up splicing; indices of unprocessed markers can never shift).
- G2 — Extract the splice/hash-update mechanics into a pure, unit-testable helper; add the first real test coverage of the splice path (existing marker-rewrite tests are smoke tests whose fixtures the engine never reads).
- G3 — co-game: collapse the duplicate `## Template Provenance` sections into one chronological section; no other content changes.
- G4 — co-work: collapse the stacked version footers into a single 1.4 footer, folding the unique 1.3 fact; no other content changes.
- G5 — Version bookkeeping: propagate-to-templates v2.8.0 → v2.9.0 across registries; all gates green.

### Non-Goals

- NG1 — No change to intentional-duplicate semantics (source resolution, `computeSectionHash`, `extractSectionContent`, section-bound rule "next marker or EOF", dry-run behavior, console log content).
- NG2 — No new engine features (no suppress/ignore flags, no per-section slicing).
- NG3 — No rewrite of variant content in either doc fix beyond the exact merges specified (D3/D4).
- NG4 — No broader SCRIPTS.md reconciliation: the L1 registry's other stale rows (if any) are out of scope; only the propagate-to-templates row is touched.

---

## Decision

### D1 — Group markers per file; splice bottom-up via a pure helper

Restructure the intentional-duplicate loop in `runMarkerRewrite` (`scripts/propagate-to-templates.ts:1394-1481`):

1. Group markers by `marker.file` (preserving scan order within a file).
2. Per file, run the existing per-marker logic unchanged (source resolution, `computeSectionHash`, in-sync check, `extractSectionContent`) — this stays in the engine loop. Stale markers accumulate as rewrites `{ lineIndex: marker.line - 1, newSectionLines, newHash }`. Dry-run keeps logging per marker and writes nothing.
3. If rewrites exist and not dry-run: read the file **once**, apply all rewrites via the new helper, then write back with the existing `detectLineEnding`/LF-normalize logic (:1469-1472).

New pure helper in `scripts/helpers/markers.ts` (plain module — safe to import; `tests/unit/propagate-to-templates.test.ts` already imports the far heavier script):

```ts
export function applyIntentionalDuplicateRewrites(
  lines: string[],
  rewrites: Array<{ lineIndex: number; newSectionLines: string[]; newHash: string }>
): string[]
```

Contract: does not mutate `lines`; internally sorts rewrites by `lineIndex` **descending** and applies bottom-up; per rewrite, re-derives the section bounds exactly as the engine does today (sectionStart = `lineIndex + 1`; sectionEnd = next line matching `/<!--\s*intentional-duplicate:/` or EOF, `:1446-1455`), splices in `newSectionLines`, and updates the marker line's hash in place via the existing `hash:\s*[0-9a-f]{8}` replacement (`:1463`). Out-of-range `lineIndex` → rewrite skipped (defensive; engine never produces one).

**Why descending bottom-up works:** marker regions `[markerLine+1 .. nextMarkerLine-1]` are disjoint and ordered by construction. Processing in descending `lineIndex` means every splice happens strictly below the indices of not-yet-processed markers — their scan-time indices (and the marker lines themselves, whose hashes are edited in place) remain valid throughout. This is why the current ascending interleaving of re-read + scan-time index breaks: an earlier splice shifts everything below it.

**Why bottom-up + pure helper rather than re-scan-per-rewrite:** re-scanning markers after each rewrite would re-glob the whole templates tree per rewrite, invalidate marker identity mid-loop (dedup/logging/summary all get harder), and still need the same splice logic — for a pathology that is today unreachable and cheap to prevent structurally. The helper isolates exactly the mechanics that were wrong (splice/index arithmetic), is unit-testable without touching the real tree (D2), and the per-file single read also removes the per-marker re-read/write interleaving (a small perf win, and one I/O pattern instead of N).

### D2 — New unit test `tests/unit/markers-splice.test.ts`

Imports `applyIntentionalDuplicateRewrites` from `scripts/helpers/markers.ts`. Cases:

1. **Two rewrites, differing line counts (the bug scenario).** Synthetic 30-line array; marker lines at indices 4 and 19 (lines 5 and 20) with distinct fake hashes. Region below marker 1 (indices 5-18, 14 lines) replaced with 6 lines; region below marker 2 (indices 20-29, 10 lines) replaced with 15 lines. Pass rewrites in **ascending** order to prove the internal descending sort. Assert: exact final length (27); prefix indices 0-3 byte-identical; marker 1 still at index 4 with updated hash; marker 2 shifted to index 11 (19 − 14 + 6) with updated hash; both replacement blocks at exactly indices 5-10 and 12-26; input array not mutated.
2. **Empty rewrites** → returns content equal to input (and input unmutated).

This is the first direct coverage of the splice path — the pre-existing `tests/marker-rewrite.test.ts` fixtures are never read by the engine.

### D3 — co-game: merge the two provenance sections

In `templates/co-game/docs/co-game.context.md` (~:220-229), replace the two `## Template Provenance` sections with ONE section, entries chronological, every original fact preserved verbatim, version-led sub-list form:

```markdown
## Template Provenance

- **0.5.3**
  - **Template-Variant**: co-develop → co-game (forked and specialized for game development)
- **0.6.0**
  - **Template-Variant**: co-game
  - **Target-Jurisdiction**: region-neutral
```

No other content changes (the `version: 2.0` footer at :218 stays).

### D4 — co-work: single version footer

In `templates/co-work/docs/co-work.context.md` (:187-188), delete the 1.3 line and replace the 1.4 line with the 1.4 text plus the one unique fact from 1.3 folded in (it is present, so it folds — UTF-8 em dashes preserved):

```markdown
*co-work.context.md version: 1.4 — Automation Runbook section added + Domain Rule 6 [WORK-R3] (when to script vs when to hand off; backlog §8 Open row 14, closed 2026-08-26); connector-schemas referenced (Domain Rule 5)*
```

No other content changes.

### D5 — Version bump v2.8.0 → v2.9.0 + registry rows

- `scripts/propagate-to-templates.ts` header `@version 2.8.0` → `@version 2.9.0` (minor: behavioral fix in `--marker-rewrite` mode).
- `scripts/SCRIPTS.md` row (:179, currently 2.8.0) → 2.9.0, plus the established one-phrase prepend to the `*Last updated: …*` chain (:599).
- **Finding deviating from the task premise**: `templates/common/scripts/SCRIPTS.md` **does** carry the row (:193) — present but stale at 2.5.1 (pre-existing drift; the L1 registry has not tracked the last three L0 bumps). Since the row exists, leaving it would keep misstating the version: update it 2.5.1 → 2.9.0 as a one-line drift correction. If implementation reveals the L1 registry is deliberately excluded from parity (lifecycle-sync-audit flags the edit), fall back to L0-only and record the drift in the PR body.
- `bun scripts/lifecycle-sync-audit.ts` run in D6 catches any remaining parity gap.

### D6 — Verification gates (in order)

1. `bun scripts/test-runner.ts unit` — includes new `tests/unit/markers-splice.test.ts`.
2. `bun test tests/marker-rewrite.test.ts tests/propagate-to-templates.test.ts`.
3. `bun scripts/propagate-to-templates.ts --marker-rewrite --domain constitution-context --dry-run` — expect in-sync, `Would overwrite: 0`.
4. `bun scripts/verify-adr-governance.ts --strict` — pass; still exactly the two §3 markers, unchanged.
5. `bun scripts/validate-templates.ts`.
6. `bun scripts/audit.ts`.
7. `bun scripts/lifecycle-sync-audit.ts` — 0 errors.

---

## Proposed Changes

| # | File | Action | Change |
|---|------|--------|--------|
| 1 | `scripts/propagate-to-templates.ts` | Modify | D1: group markers per file; per-file single read; call helper; drop per-marker re-read/splice block (:1440-1476 mechanics). D5: header @2.8.0 → @2.9.0 |
| 2 | `scripts/helpers/markers.ts` | Modify | D1: add exported pure `applyIntentionalDuplicateRewrites` |
| 3 | `tests/unit/markers-splice.test.ts` | Create | D2: two-case unit test |
| 4 | `templates/co-game/docs/co-game.context.md` | Modify | D3: merge duplicate `## Template Provenance` sections (~:220-229) into one chronological section |
| 5 | `templates/co-work/docs/co-work.context.md` | Modify | D4: collapse footer :187-188 into single merged 1.4 line |
| 6 | `scripts/SCRIPTS.md` | Modify | D5: row :179 → 2.9.0; Last-updated chain entry |
| 7 | `templates/common/scripts/SCRIPTS.md` | Modify | D5: stale row :193 (2.5.1) → 2.9.0 (see D5 fallback) |

Execution order: **Sequential**, single PR per CONSTITUTION §3.3. Rows 1-3 (engine) are independent of rows 4-5 (doc hygiene); rows 6-7 (bookkeeping) last. Rows 4-5 touch 3 template-tree files total (≤3, not high-risk per architect constraints).

Verification checklist:
- [ ] Unit suite green; new splice test green
- [ ] `tests/marker-rewrite.test.ts` + `tests/propagate-to-templates.test.ts` green
- [ ] `--marker-rewrite --dry-run` → `Would overwrite: 0`
- [ ] `verify-adr-governance.ts --strict` exits 0 (two §3 markers, unchanged)
- [ ] `validate-templates.ts`, `audit.ts` pass
- [ ] `lifecycle-sync-audit.ts` → 0 errors
- [ ] Diff inspection: rows 4-5 change only the specified lines; row 1 behavior identical for single-marker files

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None | No `.claude/` files touched; scripts are platform-neutral |
| Antigravity (GEMINI.md) | None | Justification: no `.gemini/` or `.agents/` files affected; engine and doc changes are platform-neutral |
| templates/common | changes required | `templates/common/scripts/SCRIPTS.md` row update (row 7) |

---

## Trade-offs

- **Bottom-up splice vs re-scan-per-rewrite**: re-scanning after each rewrite would be conceptually simpler but re-globs the templates tree per rewrite, breaks marker identity mid-loop (logging/dedup/summary), and still contains the same splice arithmetic — untested either way. The descending splice is the minimal-diff fix, preserves today's logs and dry-run behavior exactly, and the pure helper makes the previously-untested mechanics directly testable. Descending order is provably safe because marker regions are disjoint and ordered.
- **Per-file single read** replaces the per-marker re-read; behavior-identical for single-marker files (the only case that exists today) and required for correctness in the multi-marker case.
- **Defensive skip on out-of-range index** in the helper (rather than throwing): a rewrite landing on a shifted file would silently no-op instead of corrupting; the D2 test pins the happy path, and the index-stability argument makes the path unreachable.
- **D3 restructures bullets into version-led sub-lists** rather than concatenating the two key-value blocks verbatim: repeated `**Template-Version**:` keys in one list would be ambiguous; all facts are preserved verbatim, only the grouping changes.
- **L1 SCRIPTS.md drift correction rides along** (row 7): alternative was leaving the stale 2.5.1 row and recording it; rejected because the row exists and a version-bump PR that knowingly leaves it staler is self-inflicted drift. Fallback documented in D5.
- **Governance surface unchanged**: both §3 markers keep their strict-gate friction by design; the engine fix changes no scanning or hash semantics.

## Accessibility

**Explicit exemption per ADR-0065** (backend/non-UI exemption, stated as required): this change is engine internals plus template documentation hygiene — no user-facing UI, CLI interaction surface, or generated-document layout. No keyboard, screen-reader, contrast, motion, or target-size impact. No accessibility verification method applies beyond standard Markdown review.

## Open Questions

- None blocking implementation. For the record: the only judgment call is the row-7 fallback (D5) — if `lifecycle-sync-audit.ts` signals the L1 registry is intentionally non-paritous, drop row 7 and note the drift; everything else is mechanically specified.
