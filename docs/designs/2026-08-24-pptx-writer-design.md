# PPTX Presentation Writer Design

**Design ID**: 2026-08-24-pptx-writer-design
**Status**: Implemented
**PR**: PR15 of the 15-PR variant-benchmark backlog series (row 4 — backlog §8 co-work)
**Author**: automation-engineer (per PM-approved plan)
**Created**: 2026-08-24

---

## Problem Statement

The `co-work` variant benchmark (`docs/variant-benchmark-backlog.md` §8) identified that `md-to-ooxml.ts` handled `.docx` and `.xlsx` only — "No `.pptx` output (POI parity requires the full Office trio)". Apache POI, the benchmark's reference interop target, reads and writes all three Office formats, so the missing presentation writer was classified as the variant's top improvement (size L, priority High).

**Key Requirements**:
- Add a `.pptx` writer without inventing a new packaging mechanism — it must follow the same single-file approach the docx/xlsx writers already use
- Emit the complete minimal OOXML presentation package part set (content types, rels, presentation, master, layout, theme, slides)
- Map markdown onto slides with a simple, documented rule set
- Keep CLI symmetry: `--type pptx`, `.pptx` output-extension inference, `--check` parity
- No new npm dependencies (Bun stdlib only)

---

## What Was Built

**File**: `scripts/md-to-ooxml.ts` (version 1.1.0 → 1.2.0), mirrored byte-identically to `templates/common/scripts/md-to-ooxml.ts`.

### Packaging

The existing docx/xlsx compilers each return a single XML document written by one `writeFileSync` call (WordML / SpreadsheetML single-file XML) — no ZIP archive is produced anywhere in the script. The pptx writer keeps that exact mechanism: `compileToPresentationML(content)` returns one XML string embedding the full multi-part OOXML package in the standard **Flat OPC** single-file form (`pkg:package` / `pkg:part` / `pkg:xmlData`, the same representation Word uses for "Flat OPC" documents), with an `<?mso-application progid="PowerPoint.Show"?>` processing instruction matching the docx/xlsx convention.

### Package parts emitted

| Part | Notes |
|------|-------|
| `[Content_Types].xml` | Defaults for `rels`/`xml` + overrides for presentation, slideMaster, slideLayout, theme, and every slide |
| `_rels/.rels` | Root relationship → `ppt/presentation.xml` (`officeDocument`) |
| `ppt/presentation.xml` | `sldMasterIdLst`, `sldIdLst` (ids 256+n), 16:9 `sldSz` |
| `ppt/_rels/presentation.xml.rels` | slideMaster + per-slide + theme relationships |
| `ppt/slideMasters/slideMaster1.xml` (+ rels) | Title/body placeholders, `clrMap`, `sldLayoutIdLst` |
| `ppt/slideLayouts/slideLayout1.xml` (+ rels) | "Title and Content" layout mirroring the master |
| `ppt/theme/theme1.xml` | Minimal Office theme (clrScheme, fontScheme, fmtScheme) |
| `ppt/slides/slideN.xml` (+ per-slide rels) | `<p:sld>` with `<p:ph type="title"/>` and `<p:ph type="body" idx="1"/>` shapes |

Namespaces: `p` (presentationml/2006/main), `a` (drawingml/2006/main), `r` (officeDocument/2006/relationships). All text passes through the existing `escapeXml()`.

---

## Slide Mapping

| Markdown construct | PresentationML result |
|--------------------|-----------------------|
| `# Heading` | Starts a new slide; heading text → title placeholder run |
| `## Heading` | Body bullet, level 0, bold run (emphasized lead-in) |
| `### Heading` | Body bullet, level 1, bold run |
| `- item` / `* item` | Body bullet paragraph at level 0 |
| Indented `- item` | Body bullet at `indent / 2` (capped at 8) via `<a:pPr lvl="N"/>` |
| Plain paragraph | Non-bulleted text line (`<a:buNone/>`) |
| Table row | Plain-text line (verbatim); `\|---\|` separator rows skipped |
| Fenced code block | Each interior line becomes a plain-text line |

**Simplification (deliberate)**: tables and code blocks are rendered as plain-text lines within the body placeholder — no DrawingML table/grid parts are generated. Non-H1 content before the first heading becomes an implicit untitled lead-in slide. Both behaviors are documented in the compiler's doc comment.

---

## Verification

- `bun test tests/md-to-ooxml-pptx.test.ts` — 4 tests / 35 assertions, all passing: package part presence, slide count == H1 count (3), titles in slide XML, content-types slide overrides, body mapping (lvl/bold/buNone, separator-row skip), `--type pptx`, `.pptx` extension inference, `--check` dry-run
- `bun test tests/unit/md-to-ooxml.test.ts` — 3/3 passing (docx/xlsx unregressed) plus a manual docx `--check` run
- `cmp scripts/md-to-ooxml.ts templates/common/scripts/md-to-ooxml.ts` — identical
- `bun scripts/verify-scripts.ts --check-drift` — 0 drift warnings for the pair
- `bun scripts/audit.ts` / `--spec-check --lifecycle-only` / `verify-adr-governance.ts --strict` / `validate-templates.ts` / `validate-md-language.ts` — all clean

---

## Follow-ups

- ZIP (OPC archive) packaging remains out of scope by design — the writer matches the existing single-file docx/xlsx convention; a true ZIP writer would require a new dependency or a Bun-native zip API and should be its own ADR
- No speaker-notes parts are generated; if `co-work` decks need notes, extend the slide rels with `notesSlide` parts
- The backlog doc (`docs/variant-benchmark-backlog.md`) row status is left for the PM's consolidated status pass
