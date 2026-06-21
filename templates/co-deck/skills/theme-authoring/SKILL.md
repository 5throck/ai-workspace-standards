---
name: theme-authoring
version: 1.0.1
description: >
  Entry point for creating a new co-deck theme or style. PM dispatches
  the appropriate workflow (Style Workflow or T-Stage) based on user request.
  Responds to: "create a new theme", "add a new style", "make a dark theme",
  "새 테마 만들어줘", "스타일 추가해줘".
status: active
owner: pm
last_reviewed: 2026-06-21
prerequisites: pm
---

## Context

co-deck uses a two-layer system: **Theme** (HTML structure + rendering paradigm) and **Style** (CSS variable set). Authoring either requires a dedicated pipeline separate from the 11-Stage lecture production pipeline.

- **Theme** = `docs/html-themes/themes/<name>/` → `template.html` + `theme.json` + `pdf_layout_spec.json`
- **Style** = `docs/html-themes/styles/<name>/` → `style.css` + `pdf_color_spec.json`
- **Registry**: `docs/html-themes/THEMES.md` — must be updated after every addition
- **Preview**: `docs/html-themes/preview/preview.html?theme=X&style=Y`

---

## When to Use

| User says | Route |
|-----------|-------|
| "create a new style", "add dark style", "새 스타일 추가" | Style Workflow |
| "create a new theme", "add slideshow variant", "새 테마 만들어줘" | T-Stage (Theme Workflow) |

---

## Style Workflow (lightweight, 3 steps)

**Trigger**: User requests a new visual style variant — changes color, font, or spacing only.

### Step S-1: PM — collect style spec
Ask the user:
1. Style name (kebab-case, e.g., `dark-premium`)
2. Visual characteristics: background color, accent color, font, spacing intent
3. Target audience / lecture type (used for THEMES.md "Best For" annotation)

### Step S-2: PM dispatches Design
Design agent authors two files in `docs/html-themes/styles/<name>/`:

**`style.css`**:
- CSS variable overrides only — no DOM structure changes
- Must define all required CSS variables from `docs/html-themes/base/base.css`
- No hardcoded color or font values anywhere except in the variable declarations

**`pdf_color_spec.json`**:
- 12 role-based RGB color keys matching the CSS variables (see `THEMES.md` schema)
- Keys: `background`, `card_dark` through `card_dark4`, `text_primary` through `text_meta`, `accent`, `border`, `white`
- Used by `gen-slides-pdf.ts` as Layer 2 in the 3-layer PDF merge

### Step S-3: PM — preview + approval + registration
1. Provide preview link: `docs/html-themes/preview/preview.html?theme=scroll&style=<name>`
2. Wait for user approval
3. On approval:
   - Add row to THEMES.md Styles table (include `pdf_color_spec.json` path column)
   - Update Compatibility Matrix in THEMES.md
   - Add style name to `compatible_styles` in each compatible theme's `theme.json`
   - Update `docs/lecture-profile.md` style options comment

---

## T-Stage Pipeline (Theme Workflow, 5 steps)

**Trigger**: User requests a new HTML rendering paradigm — a new theme changes the DOM skeleton, navigation, and TOC structure.

### T-0: PM — collect theme spec
Ask the user:
1. Theme name (kebab-case, e.g., `magazine`, `card-deck`)
2. Rendering paradigm: how are slides displayed? (scroll, slideshow, carousel, grid…)
3. Navigation: how does the user move between slides?
4. TOC required? (yes / no)
5. Which existing styles should be compatible?

### T-1: PM dispatches html-build
html-build authors `docs/html-themes/themes/<name>/template.html`:
- Full HTML skeleton with `<!-- INJECT:CSS -->`, `<!-- INJECT:slideData -->`, `<!-- INJECT:slides -->` placeholders
- Implements navigation JS (TOC, keyboard, buttons as appropriate)
- Implements renderSlide stub that html-build will fill during lecture production
- Must respect theme boundary: no CSS visual values — CSS variables only

Also authors `docs/html-themes/themes/<name>/pdf_layout_spec.json`:
- `page`: dimensions (default 338.7×190.5mm 16:9; `margin_mm: 0.0` for full-bleed themes)
- `calibration.viewport_px`: measure via Playwright (`bun scripts/co-deck/measure-layout.ts`) against `template.html`; set `null` if Playwright not available (px-based sizes will fall back to defaults)
- `layout`: all element position/size percentages derived from the HTML layout
- `fonts`: `title_pt`, `bullet_pt` (mandatory); theme-specific sizes (e.g., `punchline_pt` for slideshow)
- `slide_types`: which slide types this theme uses (`title`, `divider`, `punchline`, `standard`)

### T-2: PM dispatches design
design authors `docs/html-themes/themes/<name>/theme.json`:
```json
{
  "name": "<name>",
  "version": "1.0.0",
  "description": "...",
  "rendering": { "paradigm": "...", "navigation": "...", "progress_indicator": "..." },
  "content_rules": {
    "max_bullets_per_slide": N,
    "max_title_chars": N,
    "recommended_slide_count": "X-Y",
    "notes": "..."
  },
  "compatible_styles": ["classic", "minimal"],
  "incompatible_styles": [],
  "toc_required": true|false,
  "css_base": "docs/html-themes/styles/base.css"
}
```

### T-3: PM dispatches storyline
storyline reviews and authors:
1. **content_rules validation**: are `max_bullets`, `max_title_chars`, and `recommended_slide_count` realistic for actual lecture production?
2. **recommended_structure**: authors the `recommended_structure` field in `theme.json`:
```json
"recommended_structure": {
  "pattern": "Cover → [Part Divider → 8-12 Content → Summary] × N → Contact",
  "audience_fit": ["practitioner", "graduate"],
  "notes": "..."
}
```
3. **THEMES.md Best For**: provides audience fit annotation for the Styles table

### T-4: PM — preview + approval + registration
1. Provide preview link: `docs/html-themes/preview/preview.html?theme=<name>&style=classic`
2. Wait for user approval
3. On approval:
   - Add row to THEMES.md Themes table
   - Update Compatibility Matrix in THEMES.md
   - Add theme's `compatible_styles` to each style's information in THEMES.md
   - Update `docs/lecture-profile.md` theme options comment
   - Update `agents/html-build.md` → Available themes list

---

---

## Execution Steps

### Style Workflow (3 steps)

1. **S-1 (PM)**: Collect style name + visual characteristics from user (see Style Workflow section above)
2. **S-2 (design)**: Author `docs/html-themes/styles/<name>/style.css` (CSS variable overrides) + `pdf_color_spec.json` (12 role-based RGB keys)
3. **S-3 (PM)**: Provide preview link → user approval → register in THEMES.md + update compatible_styles in theme.json files

### T-Stage / Theme Workflow (5 steps)

1. **T-0 (PM)**: Collect theme name + rendering paradigm from user (see T-Stage Pipeline section above)
2. **T-1 (html-build)**: Author `template.html` (HTML skeleton + navigation JS) + `pdf_layout_spec.json` (geometry, layout percentages, slide_types)
3. **T-2 (design)**: Author `theme.json` — content_rules + compatible_styles + slide_types
4. **T-3 (storyline)**: Validate content_rules + author `recommended_structure` field in theme.json
5. **T-4 (PM)**: Provide preview link → user approval → register in THEMES.md + update all affected files

## Output Format

**Style Workflow outputs:**
- `docs/html-themes/styles/<name>/style.css` — CSS variable override file
- `docs/html-themes/styles/<name>/pdf_color_spec.json` — 12 role-based RGB color keys
- Updated `docs/html-themes/THEMES.md` — new row in Styles table + updated Compatibility Matrix

**Theme Workflow outputs:**
- `docs/html-themes/themes/<name>/template.html` — HTML skeleton
- `docs/html-themes/themes/<name>/theme.json` — metadata + content_rules + recommended_structure + slide_types
- `docs/html-themes/themes/<name>/pdf_layout_spec.json` — page geometry + layout percentages + font sizes + slide_types
- Updated `docs/html-themes/THEMES.md` — new row in Themes table + updated Compatibility Matrix

## Constraints

- **PM is sole entry point**: user says "create theme/style" → PM routes to this workflow. Never invoke Design or html-build directly.
- **Style workflow does NOT touch DOM**: style.css must contain only CSS variable declarations
- **T-Stage requires user approval (T-4)** before THEMES.md registration — do not register without approval
- **THEMES.md must be updated atomically**: theme row + compatibility matrix + lecture-profile comment in one step
- **preview.html is the validation gate**: PM must provide the preview link and confirm the user has viewed it before registering

## Related Skills

- `html-build` — T-1 agent for template.html authoring
- `design` — T-2/S-2 agent for theme.json and style.css authoring
- `storyline` — T-3 agent for content_rules validation and recommended_structure

## Related Files

- `docs/html-themes/THEMES.md` — authoritative registry
- `docs/html-themes/preview/preview.html` — preview tool
- `docs/html-themes/base/base.css` — shared CSS variable foundation
- `docs/html-themes/themes/scroll/` — reference theme (scroll)
- `docs/html-themes/themes/slideshow/` — reference theme (slideshow)
