# Design: co-deck2 Issue Port — Template Consistency Fixes

**Date**: 2026-06-24
**Status**: Applied
**Scope**: co-deck variant template (pitch-enhanced theme, gen-slides-pdf.ts pipeline)
**Source**: co-deck2 `memory/issues/` — 9 actionable issues ported from co-deck2 project builds

## Summary

Nine fixes discovered during co-deck2 project builds (issue resolution in `co-deck2/memory/issues/`) ported back to the co-deck variant template. The fixes span the pitch-enhanced theme (CSS + HTML template) and the PDF generation pipeline (gen-slides-pdf.ts + pdf_layout_spec.json).

---

## Change 1: Cover Slide Conditional 2-Column Layout

**Problem**: pitch-enhanced cover (title) slides always rendered a single-column centered layout, even when `visualImage` was present. This wasted horizontal space for presentations with cover images.

**Solution**: `template.html` now checks `data.visualImage` on title-type slides. When present, it builds a 2-column layout (`.slide-content > .slide-left + .right-panel` with the image in the right panel and `text-align: left`). When absent, it falls back to the existing single-column centered layout.

**Files**:
- `docs/html-themes/themes/pitch-enhanced/template.html` — conditional 2-column structure in `renderSlide()` for `data-type="title"`
- `docs/html-themes/themes/pitch-enhanced/theme.css` — `.slide[data-type="title"] .slide-content { text-align: left; }` for 2-column alignment

**Impact**: pitch-enhanced cover slides with `visualImage` now display a richer 2-column layout; slides without images remain unchanged.

---

## Change 2: Profile Slide Bio Formatting

**Problem**: Multi-line speaker bios in profile slides rendered without line breaks — all text collapsed into a single paragraph.

**Solution**: Added `white-space: pre-line` to `.slide[data-type="profile"] .profile-bio` in theme.css, preserving newline characters from the `speakerBio` field.

**Files**:
- `docs/html-themes/themes/pitch-enhanced/theme.css` — `.slide[data-type="profile"] .profile-bio { white-space: pre-line; }`

**Impact**: Profile slide bios now display multi-line content correctly.

---

## Change 3: Visual Item Check Bullet Removal

**Problem**: `.slide-visual .visual-item-check::before` displayed a `▸` character prefix on visual panel items, creating visual noise.

**Solution**: Changed `content: '▸'` to `content: ''` — the bullet character is no longer rendered.

**Files**:
- `docs/html-themes/themes/pitch-enhanced/theme.css` — `.slide-visual .visual-item-check::before { content: '' }`

**Impact**: Visual panel items no longer have a redundant bullet prefix.

---

## Change 4: Contact Slide LinkedIn/Phone Fields

**Problem**: Contact slide only rendered email. LinkedIn and phone fields from `lecture-profile.md` → `instructor` section were not passed through to the slide.

**Solution**: Added `contactLinkedIn?: string` and `contactPhone?: string` to the SlideData interface in gen-slides-pdf.ts. `renderContactSlide()` now includes these in the `contactLines` array (with `.filter(Boolean)` to skip empty values). Both template.html and gen-slides-pdf.ts render them.

**Files**:
- `scripts/co-deck/gen-slides-pdf.ts` — SlideData interface + renderContactSlide()
- `docs/lecture-profile.md` — added commented `linkedin` and `phone` fields to `instructor:` section
- `docs/co-deck.context.md` — documented contact fields in Content Rules and Domain Rule 14
- `agents/html-build.md` — added `contactLinkedIn` to Theme guide note

**Impact**: Contact slide now displays up to 3 fields (email, LinkedIn, phone) when available.

---

## Change 5: parseFrontmatter Body Scanning

**Problem**: `lecture-profile.md` places its `presentation:` section outside the `---...---` YAML frontmatter delimiters (it's in the body). The original `parseFrontmatter()` only scanned the frontmatter block, so it could not read `theme`, `style`, and `background_image` settings.

**Solution**: `parseFrontmatter()` now scans both the YAML frontmatter block (for legacy indented format) and the body (below `---`) for a `presentation:` section. An `inPresentation` flag tracks whether we're inside the presentation section to correctly parse 2-space-indented fields.

**Files**:
- `scripts/co-deck/gen-slides-pdf.ts` — `parseFrontmatter()` function
- `docs/co-deck.context.md` — documented in Domain Rule 14

**Impact**: gen-slides-pdf.ts can now correctly read `lecture-profile.md` settings from the body-scanned `presentation:` section.

---

## Change 6: SVG Skip in imgPath()

**Problem**: `imgPath()` attempted to process SVG files as PDF-embeddable images. pdf-lib cannot embed SVG directly — it requires PNG/JPG raster formats.

**Solution**: `imgPath()` now returns `null` for `.svg` file extensions, skipping them entirely in the PDF pipeline. SVGs are still consumed by HTML rendering via `<img>` tags (browsers render SVG natively).

**Files**:
- `scripts/co-deck/gen-slides-pdf.ts` — `imgPath()` function
- `docs/co-deck.context.md` — documented in Domain Rule 14 and Visual Diagram Pipeline

**Impact**: PDF generation no longer fails or produces blank images when SVG paths are encountered.

---

## Change 7: visualDisplay Line-by-Line Parser

**Problem**: The `visualDisplay` text panel used a monolithic multiCall renderer that could not distinguish between headings, bullets, and plain text lines. All lines rendered identically, losing visual hierarchy.

**Solution**: Replaced the monolithic renderer with a line-by-line parser:
- `[heading]` → accent bold text
- `→bullet` (or `→ bullet`) → marker + indented text
- Plain text → standard body text
- All lines aligned to `title` region (left-aligned, `'L'` alignment)

**Files**:
- `scripts/co-deck/gen-slides-pdf.ts` — visualDisplay renderer in multiCall section
- `docs/co-deck.context.md` — documented in Domain Rule 14

**Impact**: PDF visual panel text now displays with proper visual hierarchy (headings, bullets, body).

---

## Change 8: pdf_layout_spec.json Typography Calibration

**Problem**: pitch-enhanced PDF output had text that was slightly too small (title 22pt, bullet 11pt) and visual panel text lacked dedicated font sizing keys. The visual region's top margin was asymmetric (8% top vs ~12% bottom).

**Solution**:
- `fonts.title_pt`: 22 → 24 (larger slide titles)
- `fonts.bullet_pt`: 11 → 13 (larger bullet text)
- Added `fonts.vis_title_px: 18` and `fonts.vis_body_px: 15` for visual panel text sizing
- `regions.visual.y_pct`: 0.080 → 0.150, `h_pct`: 0.850 → 0.780 (symmetric ~13.3mm top/bottom margins)
- `line_heights`: title_px 38→44, bullet_px 22→26, bullet_gap_px 12→14

**Files**:
- `docs/html-themes/themes/pitch-enhanced/pdf_layout_spec.json`
- `agents/pdf-export.md` — added `vis_title_px`/`vis_body_px` to PDF-Fitting Levers table
- `docs/html-themes/THEMES.md` — added `vis_title_px`/`vis_body_px` to optional fields list

**Impact**: pitch-enhanced PDFs render with better-proportioned text and symmetric visual panel margins.

---

## Documentation Updates

All code changes were cross-referenced against design documentation. The following files were updated to maintain consistency:

| File | Updates |
|------|---------|
| `docs/lecture-profile.md` | Added `linkedin`/`phone` optional fields to `instructor:` section |
| `docs/co-deck.context.md` | Conditional 2-col cover (Theme Architecture table), contact fields (Content Rules + Domain Rule 14), parseFrontmatter body-scan, SVG skip, visualDisplay parser, Visual Diagram Pipeline note |
| `docs/html-themes/THEMES.md` | Conditional 2-col cover (Runtime rendering contract), `vis_title_px`/`vis_body_px` (Optional fields) |
| `agents/html-build.md` | `contactLinkedIn` added to Theme guide |
| `agents/pdf-export.md` | `vis_title_px`/`vis_body_px` added to PDF-Fitting Levers table |
