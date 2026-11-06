---
name: pptx-export
description: >
  PPTX export chain for canonical SVG decks: fingerprint-verified svg-to-pptx
  compilation into natively editable DrawingML, postflight package audit,
  and per-page PNG previews for the visual acceptance gate. Use when:
  exporting a finished deck, interpreting a postflight report, or producing
  previews for visual-judge acceptance.
version: 1.4.0
last_reviewed: 2026-11-06
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

## Pre-Export Checklist (required — run before every export)

1. **Fresh final gate**: `svg-check --stage final` ran on the current bytes (any SVG edit invalidates the fingerprint; the exporter refuses on mismatch).
2. **Notes-stem parity** (v1.4.0): every `notes/*.md` stem must match a page SVG stem 1:1 (`01-title.svg` ↔ `01-title.md`). The exporter matches notes to slides by stem and **silently skips** mismatches — a renamed or renumbered page leaves its speaker notes behind without any error. Diff `ls notes/` against the page list; rename the stragglers before exporting.
3. **Surface unrendered SSOT runs** (pairs with svg-check v1.5.0): read `content_diff.unrendered_runs` in the final report JSON. These are advisory warnings (the gate passes), but they are exactly the stale-page signal — contract text updated upstream that no page renders. Review each one against the deck's intent before delivery.

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
4. **Previews for visual acceptance** — REQUIRED procedure (white-underlay render, v1.4.0):
   `renderPngs` feeds raw SVG bytes straight to resvg. Two failure modes are known:
   (a) a bare `&` in text (`P&L`, `Q&A`) is not well-formed XML and **aborts the render**;
   (b) a page without a full-bleed background rect renders a **transparent backdrop**
   (black in most viewers) — this silently failed 12/13 judge pages on 2026-11-06 before
   the method below was codified. Always render via a **temp sanitized copy**:
   ```bash
   # 1. build the sanitized temp copy (per page):
   #    - escape bare & -> &amp; (an & not already opening one of the five XML entities
   #      or a numeric reference), so resvg can parse the page
   #    - if the page has no full-bleed background rect covering (0,0,1280,720),
   #      inject <rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/> as the
   #      first child of the root <svg> (z-order: bottom)
   # 2. render from the temp copy (PNG stems match page stems):
   bun templates/co-work/scripts/deck/svg-to-pptx.ts \
     --deck <temp-dir> --render-png --png-dir <deck-dir>/previews
   # 3. discard the temp copy — it is a render input only, never an artifact:
   #    the fingerprint continues to cover the authored bytes, and the gate is
   #    never re-run against the sanitized pages
   ```
   The resulting PNGs feed the visual-judge gate (per the delivery protocol's visual
   acceptance pass). Prefer fixing the page itself — new pages SHOULD carry a full-bleed
   background rect per the `svg-slide-authoring` composition guidance; the underlay
   procedure exists for legacy pages (the exported master carries white, so the PPTX
   itself is never transparent). Note the stated limit: the resvg preview is close to,
   but not pixel-identical with, PowerPoint's own renderer; visual-judge verdicts are
   the acceptance gate on these previews.
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
- Hardening spec: `docs/designs/2026-11-06-deck-pipeline-hardening-design.md` (preview underlay D3, notes-stem parity D4, unrendered-run surfacing D2)
- Registry tokens: `templates/co-work/docs/document-style-registry.json` (`decks`)
- Gates: `svg-quality-gate` skill; authoring: `svg-slide-authoring` skill
