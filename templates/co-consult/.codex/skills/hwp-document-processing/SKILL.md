---
name: hwp-document-processing
status: active
scope: co-consult
description: >
  Handles two distinct Korean office formats with different capability profiles: HWP 5.0
  (binary, read/validate only) and HWPX (open XML/ZIP, full read/write/generate/validate
  via python-hwpx). Use when: a government/institutional deliverable references a .hwp
  template but must be delivered as .hwpx, or when validating chapter structure, guideline-slot
  completeness, or page count of a drafted deliverable.
owner: technology-specialist
version: 2.0.1
last_reviewed: 2026-08-24
prerequisites:
metadata:
  type: implementation
  triggers:
    - hwp
    - hwpx
    - hwp document
    - hwpx document
    - hwp validation
    - hwpx generation
    - government report template
---

## Context

Korean government and public-institution consulting deliverables (e.g. the KOSME (`중진공`) Structural Innovation Consulting (`구조혁신 컨설팅`) final result report) are often distributed as `.hwp` (legacy binary) templates but must be delivered back as `.hwpx` (the open XML/ZIP format, KS X 6101 / OWPML, Hancom's default save format since 2021). These two formats have fundamentally different automation profiles — do not conflate them.

### HWP (.hwp, binary) — read/validate ONLY

1. **Environment constraint** (verified 2026-08-08 on this workspace's machine): `pywin32` is installed but the `HwpFrame.HwpObject` COM automation class is NOT registered — only Hancom Office Viewer (view-only) is present, not the full `한글` (Hangul) editor. Programmatic `.hwp` *writing* via COM automation is unavailable here. Re-verify with `reg query "HKEY_CLASSES_ROOT\HwpFrame.HwpObject"` before assuming this has changed.
2. **Policy judgment** (holds independently of environment): even where COM automation is available, writing directly into a `.hwp` binary risks corrupting formatting. Reading is safe and well-supported by this workspace's own parser.
3. **Tooling**: `python/extract_hwp.py` (OLE-compound-file + zlib BodyText stream parser), wrapped by `bun scripts/co-consult/hwp-extract.ts <path.hwp>`. Extracts the table of contents and body text — this is how the source template's chapter structure and `[작성 가이드라인]` slots were catalogued for `structural-innovation-report-writing`.
4. **No `.hwp`→`.hwpx` direct conversion**: `python-hwpx` (see below) cannot open `.hwp` v5 binaries. Do NOT attempt to convert the template file itself — instead extract its structure and generate a fresh `.hwpx` (see below).

### HWPX (.hwpx, open XML/ZIP) — full read, write, generate, validate

1. **Verified capability** (tested 2026-08-08 in this workspace): the `python-hwpx` library (pure Python, Apache 2.0, no Hancom Office required, PyPI package `python-hwpx`, source https://github.com/airmang/python-hwpx) creates, edits, and validates real `.hwpx` files. Confirmed working: `HwpxDocument.new()`, `add_heading()`, `add_paragraph()`, `add_table()` + `set_cell_text()`, `save_to_path()`, `open()`, and round-trip text extraction. Output passed the official `hwpx-validate` CLI schema validator with "All schema validations passed."
2. **Tooling**: `python/generate_hwpx.py` (Markdown → HWPX converter — headings, paragraphs, pipe-tables), wrapped by `bun scripts/co-consult/hwpx-generate.ts <input.md> <output.hwpx>`.
3. **This is now the actual deliverable production path**: draft chapters in Markdown per `structural-innovation-report-writing`, then generate the final `.hwpx` directly — no human manual transcription step required for this format.
4. **Always run schema validation** (`hwpx-validate <file>.hwpx`) after generation, plus the structural/placeholder/page-count checks below, before handoff.

## When to Use

- Extracting a `.hwp` government template's table of contents / chapter structure for planning (→ `hwp-extract.ts`)
- Generating the final `.hwpx` deliverable from an approved Markdown draft (→ `hwpx-generate.ts`)
- Validating a generated `.hwpx` against the official OWPML schema (`hwpx-validate`)
- Cross-checking a drafted deliverable's chapter order/completeness against the original `.hwp` template's TOC
- Scanning a near-final draft for leftover `[작성 가이드라인]` / `예시)` placeholder text
- Verifying final page count against a target (e.g. 150p+)

## Execution Steps

1. **Extract template structure** (once per engagement / template version): `bun scripts/co-consult/hwp-extract.ts <path-to.hwp>` → chapter/section checklist.
2. **Draft in Markdown** per `structural-innovation-report-writing`'s chapter ownership model, replacing every guideline slot with real content.
3. **Cross-check the draft**: confirm every checklist item from step 1 appears in the Markdown draft, in the same order.
4. **Scan for leftover placeholders**: grep the draft for `[작성 가이드라인]`, `예시1)`, `예시2)` — zero matches required.
5. **Generate the final `.hwpx`**: `bun scripts/co-consult/hwpx-generate.ts <draft.md> <output.hwpx>`.
6. **Validate the generated file**: run `hwpx-validate <output.hwpx>` (installed as a CLI entry point by `python-hwpx`) — must report "All schema validations passed."
7. **Verify page count**: confirm the generated `.hwpx` (or an exported PDF/DOCX rendering of it) meets the target page count.
8. **Report findings** to Communications Lead: pass/fail per check. Max 2 re-generation cycles before escalating to PM (per `docs/engagement-orchestration.md` re-execution trigger rules).

## Output Format

- Structural compliance checklist (chapter/section, present/missing, order-correct)
- Placeholder-leftover scan report (0 findings required to pass)
- Generated `.hwpx` file + `hwpx-validate` schema validation report (must pass)
- Page-count verification report (actual vs. target)

## Related Skills

- `structural-innovation-report-writing` — defines the chapter structure, page targets, and Markdown draft this skill converts into the final `.hwpx`
- `consulting-report-writing` — general consulting report writing standards
- `i18n-layout` (common skill, constitution §4.4 i18n asset suite) — owns general text encoding, RTL/bidi, and script-font layout rules; this skill owns the HWP/HWPX document procedures themselves
