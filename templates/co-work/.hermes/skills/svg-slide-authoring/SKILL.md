---
name: svg-slide-authoring
description: >
  Canonical SVG slide authoring language for native PPTX decks. Closed
  element/attribute whitelist, px viewBox, #RRGGBB color spelling, per-page
  hand authoring with locked registry tokens. Use when: authoring or
  repairing slide pages for the co-work native PPTX deck capability, or
  deciding whether an SVG construct is canonical / compatible / invalid.
version: 1.1.0
last_reviewed: 2026-11-03
status: active
scope: co-work
owner: pm
prerequisites: Bun runtime, templates/co-work/scripts/deck/svg-check.ts, document-style-registry.json (decks section)
metadata:
  type: capability
  triggers:
    - author slide
    - canonical svg
    - pptx deck page
    - slide svg page
    - repair slide page
---

# 🛠️ Skill: svg-slide-authoring

## Context

The co-work deck capability compiles per-page SVG into natively editable
DrawingML PPTX (`svg-to-pptx.ts`). The SVG a page uses is NOT arbitrary
browser SVG: it is **project-canonical SVG** — a closed language whose
element/attribute whitelist has exact DrawingML mappings. Three input states:

| State | Definition | Handling |
|-------|-----------|----------|
| **Canonical** | A whitelisted spelling listed below | Compiles clean, no warnings |
| **Compatible** | A documented alternative with one deterministic normalization | Non-blocking warning; the checker normalizes; never fed back into authoring prompts |
| **Invalid** | Anything with no mapping, ambiguous meaning, or a risk of invalid DrawingML | Blocking error; re-author the page |

## When to Use

- Authoring slide pages for a PPTX deck (with `deck-builder`)
- Repairing pages that failed `svg-check.ts`
- Deciding whether a construct is allowed before writing it

## Canonical Language

### Root

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
```

- viewBox in px; canvas from the registry `decks.canvas` (default 1280×720, 16:9).
- Root must carry `data-slide-role` (one of the chosen `deck_types.slide_roles`, e.g. `title`, `content`, `closing`) and `data-page-number` (1-based).

### Element whitelist

| Family | Canonical form | Notes |
|--------|---------------|-------|
| Structure | `g` (top-level = logical content block) | every top-level `g` requires `data-block-id="bN"` (unique, 1-based per page) |
| Text | `text` with explicit `x`, `y`, `font-size`, `fill` | `y` is the baseline. `font-family` allowed (registry fonts only). `font-weight="bold"` / `font-style="italic"` allowed |
| Text runs | `tspan` with `x` + `dy` stacking | dy-stacked tspans compile to paragraphs in one text body; a tspan with explicit `x` warns (`W-TSPAN-X`) |
| Text presentation | `text-anchor="start\|middle\|end"`, `letter-spacing` (px number), `text-decoration="underline\|line-through\|none"` | anchor/spacing/decoration compile to `algn`/`spc`/`u`·`strike`; `dominant-baseline`/`alignment-baseline` are unsupported (`W-UNSUPPORTED-BASELINE`) — pre-adjust `y` instead |
| Geometry | `rect` (+`rx` ≤ half of min side), `circle`, `ellipse`, `line`, `polyline` | explicit numeric `x/y/width/height` or point lists — no percentages |
| Paths | `path` with absolute `M L H V C Q Z` commands only | lowercase (relative) commands are **compatible** (normalized) |
| Images | `image` with `x/y/width/height` + `preserveAspectRatio` | href to a local file under the deck's `assets/` directory |
| Paint | `fill`, `stroke`, `fill-opacity`, `stroke-opacity`, `opacity` | colors as uppercase `#RRGGBB`. NEVER `rgba()`, `rgb()`, `hsl()`, or lowercase hex (lowercase hex is compatible; the rest are invalid) |
| Gradients | `linearGradient` / `radialGradient` in `defs`, with `stop` children using `stop-color` (uppercase `#RRGGBB`) and `stop-opacity` | reference via `fill="url(#id)"` |
| Transforms | `transform="translate(tx[,ty])"` on `g`; `transform="translate(tx,ty) rotate(deg)"` on leaf shapes | `scale` is **compatible** (warning: pre-scale the geometry instead); skew/matrices are invalid |

### Prohibitions (invalid — blocking)

- `rgba()` / `rgb()` / `hsl()` / named colors (use `#RRGGBB`)
- CSS `<style>` blocks, `class`/`style` attributes, `!important`
- `<foreignObject>`, `<use>`, `<symbol>`, `<clipPath>`, `<mask>`, `<filter>` (blur/shadow effects), `<pattern>`
- Percent unit values (`width="50%"`), `em`/`rem` units
- Text content outside `<text>` elements (e.g. `<title>` visible text is ignored, not rendered)
- Nested `<svg>`

### Locked tokens

Colors, fonts, and canvas come from `templates/co-work/docs/document-style-registry.json → decks` for the chosen deck style. Reference tokens by role (background/primary/accent/text/muted) — do not invent hues per run. Page-local accents are allowed (a tint of a locked token, or the accent used sparingly); a second recurring visual system is not — recurring identity requires a registry/brief update.

### Authoring discipline

1. **One page per pass.** Hand-author each page; never write a script that generates page SVGs. Visual continuity is sequential judgment against the locked tokens.
2. **Content SSOT.** Slide text comes verbatim from `deck_content.md`. The gate diffs text runs mechanically; additions/rewording block. Need different words? Send it upstream (content-writer/storyteller), not into the page.
3. **Every slide needs one focal point** — an oversized number, a chart-like geometry, a single bold statement. Everything else is subordinate (contrast, size, position).
4. **Comfortable density.** One key message per page; trim or split rather than overpack; leave breathing room around text blocks.
5. **Contrast first.** `text` on `background` (dark-on-light) or inverted for divider/title pages; never mid-tone on mid-tone.

## Execution Steps

1. **Resolve tokens**: read the registry `decks` section for the chosen deck type; write the locked values into the design brief once.
2. **Author P01** fully (title page): role, canvas, one focal point, locked tokens.
3. **Early gate** (rosters > 6): run `bun templates/co-work/scripts/deck/svg-check.ts --deck <dir> --content <deck_content.md> --stage early --json` after P01–P05; fix all blocking errors and selected warnings before continuing.
4. **Author remaining pages** one at a time — carry the method (hierarchy rhythm, spacing, block naming) from the sample pages.
5. **Final gate**: same command with `--stage final`; repair failures (max 2 rounds per page, then PM escalation).

## Output Format

- `<NN>-<slug>.svg` per page (e.g. `01-title.svg`), zero-padded, in the deck working directory
- All passing `svg-check.ts` with zero errors before export

## Related Skills

- `svg-quality-gate` — validates what this skill authors; its severity model is the contract for repair rounds
- `pptx-export` — consumes the gate-passed pages this skill produces
- `svg-quality-gate` and `pptx-export` share the same canonical language defined here

## References

- Spec: `docs/designs/2026-11-03-co-work-native-pptx-deck-design.md` (§4 canonical spec, §3 pipeline)
- Registry: `templates/co-work/docs/document-style-registry.json` (`decks`)
- Gate: `svg-quality-gate` skill; export: `pptx-export` skill
