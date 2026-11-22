# Preserved Variant-Notes Block in Generated Skill Lifecycle Records

- **Date**: 2026-11-22
- **Status**: designed (implementation follow-up dispatch)
- **Source**: T-20261122-003 (delegation) / U-20261122-008 (upstream request, co-security)
- **Tier**: L0 (`scripts/generate-skill-lifecycle-records.ts` + `tests/unit/generate-skill-lifecycle-records.test.ts`)

## Problem

`docs/lifecycle/skills/*.md` records for delivered skills are **generated** files:
`scripts/generate-skill-lifecycle-records.ts` derives each record from a SKILL.md
frontmatter (or projects it from the L0 record) and writes the whole file on
`--write`, and the `--check` parity gate demands byte-for-byte reproduction of the
generated content. The generator's own contract is "hand edits are overwritten at
the next publish" (the `GENERATED_MARKER` line every generated file starts with).

That contract has no escape hatch for *variant delivery-status annotations*. The
co-security project carries six `k-*` records (k-dart, k-ecos, k-kosis, k-krx,
k-law, k-opendata in `Projects/co-security/docs/lifecycle/skills/`) whose skills are
country-scoped-pruned from the variant (deliberately not delivered, together with
their owner agent `public-data-analyst`). Each of the six records carries a
hand-written note, e.g. `k-dart.md:5`:

> Variant delivery note (2026-11-22): NOT DELIVERED to co-security —
> country-scoped-pruned together with its owner agent `public-data-analyst`
> (workspace-root-only, `scripts/lib/country-scoped-agents.ts`); record retained
> for L0 projection parity.

The next `--write` (whether the workspace-root records hook at dev-sync step 4.51,
a template-side regeneration, or a `--project` run) silently overwrites the note,
and the delivery-status fact — the only thing telling a future reviewer why a
"delivered skills must have records" record exists for a skill the project does not
ship — is lost.

## Evidence

- Generator write path (`scripts/generate-skill-lifecycle-records.ts`, v1.3.1):
  - `renderRecord()` (:335-350) builds a **fixed-section body** as an array of
    parts joined `"\n\n"`: `GENERATED_MARKER` → `# <skill> Skill Lifecycle` →
    `## Metadata` → `## Description` → optional `## Dependencies` →
    `## Phase History` → `## Acceptance Criteria`, then a trailing `"\n"`.
  - `--write` (`main()` :981-992): for each planned record, re-read the existing
    target, skip when byte-identical, else **overwrite the entire file** with
    `r.content`. No preserved regions exist.
  - `--check` (:969-980 + `checkPlan`): byte-for-byte comparison of regenerated
    vs on-disk; any divergence = `stale` finding ("differs from the regenerated
    record — run … --write (never hand-edit a generated record)" :783). So a
    hand-annotated generated record permanently fails `--check` AND gets clobbered
    by `--write`.
  - Records carry **no YAML front-matter** — line 1 is the HTML-comment
    `GENERATED_MARKER` (:55-56), then Markdown sections. A front-matter key has no
    slot to live in.
  - `isGeneratedRecord()` (:504-506) — first line equality decides generated vs
    hand-owned; hand-authored records (no marker) are never touched, but the six
    k-* records ARE marker-bearing generated files, hence owned by the generator.
  - The core is pure over an injected `Tree` (`mapTree` for tests, :98-119); the
    CLI is the only filesystem toucher. A preservation feature must preserve this
    purity.
- Observed hand annotation placement in `Projects/co-security/docs/lifecycle/skills/k-dart.md`:
  a blockquote line sitting **between the `# k-dart Skill Lifecycle` H1 and
  `## Metadata`** — i.e. exactly at the seam where the generator joins parts.
- The same idiom already exists elsewhere in the workspace: dev-sync's
  headed-block/memory-block preservation (marked regions re-emitted verbatim at a
  fixed position), and the generated marker convention itself. A marked block is
  the house style for "generated file with a sanctioned human region".

## Decision

**Option (a): marked-block preservation**, applied at plan-application time so
`--check` and `--write` stay symmetric. No new files, no schema, no front-matter —
smallest blast radius.

### D1 — Marker syntax and position

```
<!-- variant-notes:start -->
<any lines, verbatim — the author's>
<!-- variant-notes:end -->
```

The block is re-emitted **verbatim** (bytes between the marker lines inclusive) as
an extra part inserted **immediately after the H1 part and before `## Metadata`**
— the position the existing hand notes already occupy. Absent block ⇒ the record
renders exactly as today (zero diff for every unannotated record, all 200+).

### D2 — Extraction is a pure function applied in `main()`

New exported, pure helper (unit-testable over strings, no fs):

```
extractVariantNotes(existingContent: string): { block: string | null; warnings: string[] }
```

- Well-formed single block → `block` = the exact marker-to-marker slice.
- **No block** → `null`, no warnings.
- **Malformed** → `null` + one warning per defect; **never throws, never crashes
  the publish**. Malformed cases:
  - `start` without `end` (unclosed at EOF);
  - `end` without `start`;
  - multiple `start` markers (keep the FIRST well-formed pair, warn about the
    extras — orphaned `end`, second `start…end` pair, nesting);
  - empty block (start immediately followed by end) → treated as absent (emit
    nothing) without a warning, since there is nothing to preserve.
- `main()` applies it in **both** the `--check` and `--write` arms, right after the
  plan is built: for each planned record whose target file exists and passes
  `isGeneratedRecord`, extract from the existing on-disk/tree content and inject
  the block into `r.content` before comparison/write. Applying it at this single
  choke point keeps `--check` parity exact for annotated records (the regenerated
  expectation includes the preserved block, so an annotated record that hasn't
  drifted is NOT flagged stale) and keeps `renderRecord()` itself untouched for
  the pure-projectRecord/deriveRecord unit tests.
- Warnings print via `console.error("[WARN] <path>: variant-notes block <defect>; dropped — fix the markers and re-run")` in the CLI arm (the pure function only
  returns them). Warnings never change the exit code: a malformed block is a
  content-quality WARN, not a gate failure (the block is dropped either way, so
  `--check`/`--write` stay deterministic).
- The preserved block bypasses `finalizeClean()` (internal-ref line filter +
  Hangul wrapping): inject the block AFTER `finalizeClean` has run on the rendered
  parts. Rationale: verbatim means verbatim — filtering or transforming the
  author's lines would corrupt the note and make "preserved" a lie. Residual
  (documented in the generator header note, D4): a hand note quoting Korean
  outside code spans can trip `validate-md-language.ts` — the note author is
  responsible for the language policy inside their own block, exactly as for
  fully hand-authored records today.

### D3 — Why not the alternatives

| Option | Verdict | Why |
|---|---|---|
| (chosen) Marked-block preservation | adopted | House idiom (headed blocks/memory blocks); no new files; zero diff for unannotated records; lives in the record itself so every consumer (reader, audit, delivery) sees it |
| (b) Preserved front-matter key (`delivery_status` / `variant_notes`) from a sidecar map | rejected | Records have no front-matter (first line is the GENERATED_MARKER) — adding one changes the record schema for every consumer; a sidecar map is a NEW tracked file (`scripts/data/…`) that must itself be delivered, kept in sync, and would silently drift from the records it annotates (the exact failure mode being fixed) |
| (c) Companion file per skill (`docs/lifecycle/skills/<name>.notes.md`) | rejected | Doubles the file count for annotated records; orphan/stale bookkeeping in `checkPlan`; nothing consumes it at read time; the note is no longer visible in the record a reviewer opens |

### D4 — Header comment note (one line, in the generator's docblock)

```
 * Variant-notes preservation (U-20261122-008): a `<!-- variant-notes:start -->` …
 * `<!-- variant-notes:end -->` block in an existing generated record is re-emitted
 * verbatim after the title on regeneration; malformed blocks are WARNed and dropped.
```

## Acceptance criteria

Unit tests extend `tests/unit/generate-skill-lifecycle-records.test.ts`
(`mapTree`-based, house style):

- [ ] **Round-trip preserve**: a planned record whose existing file carries a
      well-formed variant-notes block regenerates with the block byte-identical at
      the fixed position (between H1 and `## Metadata`); `--check` on such a tree
      reports no `stale` finding for it.
- [ ] **Absent-block no-op**: a tree with no variant-notes anywhere produces
      output byte-identical to v1.3.1's output (snapshot/fixture assertion) — zero
      diff for all existing records.
- [ ] **Malformed-block WARN**: unclosed start, stray end, and double-block
      fixtures each produce exactly the specified warning(s), the block is dropped,
      the write/check still succeeds deterministically (exit code unchanged), and
      the regenerated record contains no marker residue.
- [ ] **Empty block** emits nothing and warns nothing.
- [ ] **verbatim guarantee**: a block containing lines that would otherwise be
      filtered (`finalizeClean` internal-ref patterns) or Hangul-wrapped survives
      byte-for-byte.
- [ ] **Hand-authored records untouched**: an existing file without the
      GENERATED_MARKER is still never read for notes nor written (existing test
      behavior retained).
- [ ] `extractVariantNotes` is pure (no fs access) and exported.

## Landing requirements

1. `scripts/generate-skill-lifecycle-records.ts` → `// @version 1.4.0` with the
   v1.4.0 note (this design's D4 line) and `SCRIPTS.md` row update
   (`scripts/SCRIPTS.md:124`, row is L0) citing T-20261122-003 / U-20261122-008.
2. **Generator write-path finding (explicit answer to the ticket's question):**
   records are sourced three ways — L0 records for common skills (projected via
   `projectRecord`), variant-own skills (derived via `deriveRecord`, written under
   `templates/<variant>/docs/lifecycle/skills/`), and project-local skills
   (`--project` mode). All three converge on the same `--write`/`--check`
   choke point in `main()` (:969-992), which is why the extraction belongs there:
   one change covers the workspace-root records hook (dev-sync step 4.51 runs
   `--write` after the L0→L1 publish), template regeneration, and project
   regeneration alike. There is no separate "publish" step to modify.
3. Tests: the new blocks in `tests/unit/generate-skill-lifecycle-records.test.ts`
   (no new test file needed).
4. Re-publish note for the implementer: after landing, the six co-security k-*
   records should get their existing prose note wrapped in the marker block (a
   one-time hand migration of the annotation INTO the preserved form, done in the
   project or as a follow-up — the generator will then preserve it forever).
   Alternatively the implementer may land the migration as part of the same batch
   if the tickets remain open; either way the generator change alone does not
   retroactively wrap the existing notes.
5. Spec activity: register this design before /sync:
   `bun scripts/spec-register.ts --file docs/designs/2026-11-22-skill-record-variant-notes-design.md --source manual --status implemented`
6. CHANGELOG `[Unreleased]` entry.

## Out-of-scope

- Orphan semantics for the six k-* records (their skills no longer exist in
  co-security, so `--project --check` separately flags them as orphan generated
  records today; retention-vs-deletion policy for pruned-country skills is a
  distinct decision, not this ticket).
- Any change to record section structure, `GENERATED_MARKER`, owner resolution,
  or the SLR/Check-LC gates.
- Preservation for NON-lifecycle generated files (agent mirrors, scripts-mirror,
  VERSION_MANIFEST) — different generators, different contracts; the idiom may be
  copied there later but is not designed here.
- Backfilling variant-notes for variants other than co-security.
