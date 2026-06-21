# Meeting Transcript
**Date**: 2026-06-21
**Topic**: co-deck theme package extension — pdf_layout_spec ownership and per-project theme/style override flexibility
**Participants**: html-build, design, storyline, version (synthesizer)
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Following the two-layer theme/style governance work, the user proposed:
1. Themes should own `pdf_layout_spec` so PDF rendering is consistent with HTML layout
2. Per-project theme/style flexibility — individual projects should be able to override global theme/style settings without modifying canonical files

---

## Transcript

### Round 1

**[html-build]**: (Round 1)

Strongly agree that the theme should own PDF layout spec. Currently `gen-slides-pdf.ts` has hardcoded coordinates directly in the script — `PW = 338.7mm`, `PH = 190.5mm`, and all element percentage offsets. These values are directly tied to the HTML theme's layout structure, but they're completely separated — changing the theme requires manual script edits.

Proposal: add `docs/html-themes/themes/<name>/pdf_layout_spec.json` as the third file in a theme package:
```json
{
  "page": { "width_mm": 338.7, "height_mm": 190.5, "margin_mm": 5.0 },
  "layout": {
    "content_panel": { "x_pct": 0.0438, "w_pct": 0.503 },
    "visual_panel": { "x_pct": 0.584, "y_pct": 0.390, "w_pct": 0.372, "h_pct": 0.561 },
    "header": { "y_pct": 0.091, "h_pct": 0.064 },
    "title": { "y_pct": 0.224 }
  },
  "fonts": { "title_pt": 28.0, "bullet_pt": 12.5, "section_scale": 0.48 }
}
```

`gen-slides-pdf.ts` reads this file and computes coordinates dynamically. Theme changes automatically propagate to PDF rendering.

For per-project overrides: theme package provides the global baseline (canonical); if `presentations/<project>/` has local override data, that takes precedence — a layered structure is needed.

Question to design: Does CSS style also need the same override hierarchy?

---

**[design]**: (Round 1)

html-build's proposed location (`themes/<name>/pdf_layout_spec.json`) is correct. Theme owns HTML rendering paradigm and PDF is its high-fidelity reproduction — same package should manage both.

Adding a perspective: **styles should also own PDF color specs**. Currently `gen-slides-pdf.ts` has hardcoded RGB values (`C_BG`, `C_ACCENT`, `C_TEXT` etc.), completely disconnected from the CSS variable system. Changing the `classic` style's colors means HTML and PDF render differently.

Proposal:
- Theme → `pdf_layout_spec.json` (structure, coordinates, font sizes)
- Style → `pdf_color_spec.json` (`docs/html-themes/styles/<name>/pdf_color_spec.json`)

```json
{
  "background": [17, 24, 39],
  "text_primary": [226, 232, 240],
  "text_muted": [156, 163, 175],
  "accent": [217, 119, 6],
  "border": [31, 41, 55]
}
```

For per-project overrides: rather than a separate file in `presentations/<project>/`, adding a `layout_overrides` block to `lecture-profile.md` is cleaner. Single source manages all per-project variations.

Question to storyline: What are the most realistic per-project override scenarios in practice?

---

**[storyline]**: (Round 1)

design's `pdf_color_spec.json` separation is persuasive. Three real-world override scenarios from content structure perspective:

1. **Slide density adjustment**: `scroll` theme default `max_bullets: 5`, but a specific technical deep-dive lecture needs 7 bullets per slide. This project alone needs the exception — don't touch the global theme.

2. **Custom slide ratio**: A client requires 4:3 PDF. `scroll` theme is 16:9 by default, but this project needs `254mm × 190.5mm` page size.

3. **Brand color override**: Lecture materials delivered to a specific institution must follow their CI color palette — not the `classic` style's default colors.

All three scenarios must be handled at project level without modifying global theme/style.

Support design's `lecture-profile.md` `layout_overrides` block approach, with one condition: when overrides are present, PM must explicitly confirm with the user at Stage 0. Silent overrides cause debugging difficulty later.

Question to html-build: What is the merge strategy for `gen-slides-pdf.ts` when reading `pdf_layout_spec.json` with override layers?

---

### Round 2

**[html-build]**: (Round 2)

storyline's three scenarios — especially 4:3 ratio and CI colors — confirm the override hierarchy is essential. Merge strategy:

**3-layer deep merge (later layers win)**:
```
Layer 1 (baseline): docs/html-themes/themes/<theme>/pdf_layout_spec.json
Layer 2 (style colors): docs/html-themes/styles/<style>/pdf_color_spec.json
Layer 3 (project override): presentations/<project>/lecture-profile.md → layout_overrides block
```

Merge rule: Layer 3 overrides Layer 1+2 for specific keys only; unspecified keys inherit from Layer 1+2.

Example `lecture-profile.md`:
```yaml
layout_overrides:
  page:
    width_mm: 254.0    # 4:3 ratio
    height_mm: 190.5
  content_rules:
    max_bullets_per_slide: 7  # project exception
  colors:
    accent: [180, 30, 50]     # institution CI color
```

`gen-slides-pdf.ts` startup: (1) load global theme spec → (2) merge style color spec → (3) merge lecture-profile layout_overrides → render PDF with final merged spec.

For new project deployment: rather than creating an empty `pdf_layout_spec_override.json`, include a commented `# layout_overrides:` block in `lecture-profile.md`. User uncomments when needed.

Question to design: What is the deployment strategy for `pdf_color_spec.json`? Since it already lives in the style folder, no copy should be needed — but we need to verify the path is reachable post-project-creation.

---

**[design]**: (Round 2)

`pdf_color_spec.json` does NOT need to be copied to new projects. It stays in `templates/co-deck/docs/html-themes/styles/<name>/` and is referenced via `workspaceRoot`-relative path — same pattern `gen-slides-pdf.ts` already uses for font resolution.

Exception: when a project needs CI color override, that goes in `lecture-profile.md` `layout_overrides.colors` block — no separate file needed.

Additional observation about TypeScript-first principle (adjacent to meeting topic): once `pdf_layout_spec.json` exists as the canonical input format for `gen-slides-pdf.ts`, the TypeScript script becomes the natural tool — the spec file is designed as TypeScript script input. Correct artifact structure itself guides agents toward TypeScript usage.

Final deployment artifact summary:

Files created per new project (`presentations/<project>/`):
- `lecture-profile.md` (existing + `layout_overrides` commented block added)
- `project_state.json` (existing)
- `image-manifest.json` (existing, filled by image-curator)

Global files (no copy needed):
- `docs/html-themes/themes/<theme>/pdf_layout_spec.json` (new)
- `docs/html-themes/styles/<style>/pdf_color_spec.json` (new)

Question to storyline: When Storyline receives Stage 2 dispatch, what information does PM need to pass regarding layout_overrides.content_rules?

---

**[storyline]**: (Round 2)

PM's Stage 2 dispatch must include:
1. `theme.json` path (existing) — baseline `content_rules`
2. `lecture-profile.md` path (existing) — base settings
3. **`layout_overrides.content_rules` override values** (new) — PM parses from lecture-profile and passes explicitly

Storyline needs to know unambiguously: is `max_bullets` the global theme default `5` or this project's override `7`? Ambiguity leads to incorrect slide density in `slide_deck.md`.

**PM Stage 0 warning message** (concrete form of Round 1 proposal):
```
⚠️ Layout overrides detected for this project:
  - max_bullets_per_slide: 7 (default: 5)
  - page_ratio: 4:3 (default: 16:9)
These differ from the global scroll theme. Continue?
```

Discussion has converged on both agenda items. Requesting version agent to synthesize.

---

## Synthesis

**[version]**: (Synthesis)

Both agenda items reached clear consensus.

**Points of Agreement**:

1. **Theme package = 3-file structure**: `template.html` + `theme.json` + `pdf_layout_spec.json`. PDF coordinates, dimensions, and font sizes are owned by the theme. `gen-slides-pdf.ts` removes all hardcoded values and reads this file.

2. **Style package gains `pdf_color_spec.json`**: CSS variables and PDF RGB colors are co-managed by the same style. Resolves HTML-PDF color mismatch problem.

3. **3-layer merge strategy**: Global theme spec → global style color spec → project `layout_overrides`. `gen-slides-pdf.ts` merges in this order at runtime.

4. **Per-project overrides via `lecture-profile.md` `layout_overrides` block**: Single source for project-level variations. No separate file deployment. New projects get commented example block.

5. **PM Stage 0 warning**: Explicit user confirmation required when `layout_overrides` deviates from defaults.

6. **PM Stage 2 dispatch extension**: Storyline receives `layout_overrides.content_rules` values explicitly from PM.

**Open Questions**:
- Exact key schema for `pdf_layout_spec.json` (html-build to draft based on current hardcoded values)
- `slideshow` theme PDF rendering strategy — current `gen-slides-pdf.ts` is scroll-oriented; whether a separate renderer is needed for slideshow theme is unresolved

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | html-build | Medium | `pdf_layout_spec.json` draft — scroll theme based on current `gen-slides-pdf.ts` hardcoded values; create in `docs/html-themes/themes/scroll/` and `slideshow/` | Both | Next |
| A-02 | design | Low | `pdf_color_spec.json` draft — all 4 styles (classic, minimal, visual-heavy, academic); create in `docs/html-themes/styles/<name>/` | Both | Next |
| A-03 | html-build (PM support) | Medium | Refactor `gen-slides-pdf.ts` — remove hardcoded values, implement 3-layer merge logic (global theme spec → style color spec → layout_overrides) | Both | Next |
| A-04 | pm | Low | Update `docs/lecture-profile.md` — add `layout_overrides` commented block (page, content_rules, colors examples) + add Stage 0 override warning logic to `agents/pm.md` | Both | Next |
| A-05 | pm | Low | Codify TypeScript-first principle — add to `agents/pm.md` Constraints + `docs/co-deck.context.md` domain rules: "TypeScript scripts take precedence; Python only when TypeScript is not viable" | Both | Next |
