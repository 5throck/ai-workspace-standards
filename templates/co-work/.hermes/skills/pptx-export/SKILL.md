---
name: pptx-export
description: >
  PPTX export chain for canonical SVG decks: fingerprint-verified svg-to-pptx
  compilation into natively editable DrawingML, postflight package audit,
  and per-page PNG previews for the visual acceptance gate. Use when:
  exporting a finished deck, interpreting a postflight report, or producing
  previews for visual-judge acceptance.
version: 1.3.0
last_reviewed: 2026-11-03
status: active
scope: co-work
owner: pm
prerequisites: Bun runtime, fflate, @resvg/resvg-js (previews), templates/co-work/scripts/deck/svg-to-pptx.ts, passing final svg-check report
metadata:
  type: capability
  triggers:
    - export pptx
    - export deck
    - compile pptx
    - svg to pptx
    - deck postflight
---

# 🛠️ Skill: pptx-export

## Context

The exporter compiles authored canonical SVG pages into a natively editable
PowerPoint package (DrawingML shapes — clickable, restylable; not slide
images). It is a **defensive final layer**: it independently validates its
inputs and the produced package, but it does NOT re-run the quality gate and
does NOT repair pages. Flat mode emits one clean slide master + one blank
layout with `clrScheme`/`fontScheme` derived from the registry `decks`
tokens.

## When to Use

- After the final `svg-check` gate reports zero errors
- Re-export after postflight-flagged fixes (re-gate first — any SVG edit invalidates the fingerprint)

## Execution Steps

1. **Export** (fingerprint refusal is built in):
   ```bash
   bun templates/co-work/scripts/deck/svg-to-pptx.ts \
     --deck <deck-dir> \
     --out <deck-dir>/exports/<name>_<timestamp>.pptx \
     --report <deck-dir>/validation/svg-check-final.json \
     --registry templates/co-work/docs/document-style-registry.json \
     --deck-type business-report [--native-charts-and-tables] [--structured-layouts]
   ```
   The exporter refuses to run when: the report is missing, its `stage` is not `final`, its `summary.errors` > 0, or its SHA-256 fingerprint does not match the current SVG bytes.
2. **Flags**: `--native-charts-and-tables` replaces `data-native` blocks (chart/table payloads in `<desc>`) with native objects — charts carry an embedded workbook (Edit Data; kinds: bar, line, pie); `--structured-layouts` emits one role layout per used slide role and binds slides to them. Default export keeps fallback shapes + flat blank layout.
3. **Read the postflight receipt** (printed on success): slide count, part counts, warnings (external images, generic-only font stacks), report linkage. Consume the receipt — do not re-derive it from the package.
4. **Previews for visual acceptance**:
   ```bash
   bun templates/co-work/scripts/deck/svg-to-pptx.ts --deck <deck-dir> --render-png --png-dir <deck-dir>/previews
   ```
   Renders each authored page to PNG (`@resvg/resvg-js`) for the existing visual-judge gate (per the delivery protocol's visual acceptance pass). Note the stated limit: the resvg preview is close to, but not pixel-identical with, PowerPoint's own renderer; visual-judge verdicts are the acceptance gate on these previews.
5. **Deliver**: the `.pptx` path + postflight receipt + preview PNGs. Any follow-up PowerPoint advisory goes to `ms365-expert`.

## Output Format

- `exports/<name>_<timestamp>.pptx` — natively editable DrawingML
- postflight receipt: `{ slides, parts, mode: "flat", fingerprint_linked: true, warnings: [...] }`
- `previews/NN-<slug>.png` — per-page renders (visual acceptance input)

## Related Skills

- `svg-quality-gate` — its final report is this skill's mandatory input
- `svg-slide-authoring` — owns the canonical language this exporter compiles

## Hard Boundaries

- No LibreOffice / Office-tooling rendering dependency — visual acceptance runs on resvg-rendered SVG previews; the package is verified by structural postflight (deliberate policy, design §11.6)


- No export without a fingerprint-matching final report — a report's existence alone is not delivery proof; linkage is verified by hash
- No page repair inside the exporter; pages are fixed upstream by deck-builder
- No font embedding in P1 — PPTX references font names; rendering depends on the viewer machine
- Whole-slide screenshots / SVG-as-picture embedding are not a fallback — editability is the product

## References

- Spec: `docs/designs/2026-11-03-co-work-native-pptx-deck-design.md` (§3, §5, §11)
- Registry tokens: `templates/co-work/docs/document-style-registry.json` (`decks`)
- Gates: `svg-quality-gate` skill; authoring: `svg-slide-authoring` skill
