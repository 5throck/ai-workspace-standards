---
name: slide-layout-gate
scope: co-deck
version: 1.0.0
description: >
  Slide content conformance gate. Runs estimate-layout.ts --lint to check every
  slide in slidedata.json against the merged 4-layer spec's content_constraints
  (per slide type: title/subtitle/desc chars, bullet count, body chars).
  Exit 1 blocks PDF export. Responds to "layout gate", "lint slides",
  "check slide bounds", "slide content conformance".
status: active
owner: pdf-export
last_reviewed: 2026-08-26
prerequisites: html-build
---

## Context

The deck pipeline had two content-discipline points with nothing between them and
the renderer: `theme.json content_rules` disciplines storyline at creation time
(Stage 2), and the PDF renderer lays out whatever it receives. A deck edited after
storyline — or a storyline miss — produced overflowing titles and bullet walls
that only surfaced as clipped PDF output. This gate closes that gap: it checks
the **built** deck (slidedata.json) against the **render-time bounds** the merged
layout spec actually declares, using the exact 4-layer merge
(`layout_base.json` → theme `pdf_layout_spec.json` → style `pdf_color_spec.json`
→ `lecture-profile.md` `layout_overrides`) that `gen-slides-pdf.ts` renders with.

## When to Use

- After html-build (Stage 8) completes and before pdf-export (Stage 9) — the 8→9 handoff gate **[DECK-R2]**
- User says "layout gate", "lint slides", "check slide bounds"
- After any content edit to an existing deck, before regenerating the PDF

## Execution Steps

1. Run the gate:
   ```bash
   bun scripts/co-deck/estimate-layout.ts --project presentations/<project> --lint
   ```
   (composes with `--sample`: lint runs first; a FAIL blocks the sample too)
2. Read the verdict table — one row per slide: `# | Type | Check | Actual | Limit | Verdict`
3. Exit 0 → gate passed; proceed to pdf-export
4. Exit 1 → blocked; apply the remediation ladder below, then re-run until pass

## Output Format

| Output | Destination | Format |
|--------|-------------|--------|
| Verdict table | console (stdout) | per-slide check rows: `# \| Type \| Check \| Actual \| Limit \| Verdict` |
| Violation summary + remediation ladder | console (stderr on FAIL) | `N check(s) passed, M failed, K slide(s) unconstrained (WARN)` |
| Layout summary | `presentations/<project>/layout_summary.md` | unchanged prep-pdf artifact (written on every run) |

## Verdict Semantics

| Verdict | Meaning | Action |
|---------|---------|--------|
| PASS | within a declared constraint | none |
| FAIL | exceeds a declared constraint, **or** the slide's type is not in the merged `slide_types` (no CSS layout exists — it would break rendering) | blocked — remediate |
| WARN | slide type is valid but declares no `content_constraints` in the spec (e.g. `title`, `profile`, `contact`) | allowed through; if these slides overflow in practice, declare bounds in the theme's `pdf_layout_spec.json` |

## Checks

| Check | Slidedata field(s) | Constraint key |
|-------|--------------------|----------------|
| title chars | `title` | `max_title_chars` |
| subtitle chars | `subtitle` (fallback `sub`) | `max_subtitle_chars` |
| desc chars | `sub` (fallback `text`) | `max_desc_chars` |
| bullet count | `bullets.length` | `max_bullets` |
| body chars | joined bullet text, or `text` when no bullets | `max_body_chars` |

A constraint key absent for a slide type means that check is skipped for that type
(the gate enforces only what the spec declares). Example — `pitch-enhanced`:
`standard` max_bullets=4 / max_title_chars=28 / max_body_chars=100;
`divider` max_title_chars=28 / max_desc_chars=80; `punchline` max_title_chars=40.

## Remediation Ladder (in order)

1. **Cut content** — trim title/subtitle, tighten or merge bullets (preferred)
2. **Split the slide** into two standard slides
3. **Reclassify the slide type** (Uniform Layout Principle, `context.md` Content Rules — content slides stay `standard`)
4. **Record a justified `layout_overrides` entry** in `lecture-profile.md` (last resort — requires a design note stating why the declared bound is wrong for this deck)

## Relationship to content_rules

`theme.json content_rules` (Stage 2, storyline) is the stricter creation-time
discipline applied while composing `slide_deck.md`. This gate is the render-time
bound from the merged spec's `content_constraints`, checked against the built
deck. A compliant storyline that is edited afterwards can still fail the gate;
a deck failing both was non-compliant at creation.

## Related Skills

- `html-build` — produces the slideData this gate reads
- `prep-pdf` — same 4-layer merge, produces layout_summary.md
- `pdf-export` — the gated consumer; never dispatch Stage 9 on a failing gate
