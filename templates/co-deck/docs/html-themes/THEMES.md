# Theme & Style Registry

> **Authoritative registry** for all co-deck themes and styles.
> Every new theme or style MUST be registered here before use.
> Follow the SKILLS.md pattern: one row per entry, with version and status.

---

## Themes

A **theme** is a rendering paradigm package: HTML skeleton (`template.html`) + metadata/content-rules/compatibility declaration (`theme.json`).

| Name | Version | Status | Paradigm | Navigation | TOC | Compatible Styles | Folder |
|------|---------|--------|----------|-----------|-----|-------------------|--------|
| `scroll` | 1.0.0 | active | Vertical scroll — all slides in DOM | Scroll + TOC panel | Required | classic, minimal, academic | `themes/scroll/` |
| `slideshow` | 1.0.0 | active | Fullscreen single-slide, animated transitions | Prev/Next + arrow keys | None | classic, minimal | `themes/slideshow/` |

### Compatibility Matrix

| Style ↓ / Theme → | `scroll` | `slideshow` |
|-------------------|----------|-------------|
| `classic` | ✅ | ✅ |
| `minimal` | ✅ | ✅ |
| `visual-heavy` | ⚠️ partial | ❌ incompatible |
| `academic` | ✅ | ❌ incompatible |

**Legend**: ✅ Fully compatible · ⚠️ Partial (see theme.json notes) · ❌ Incompatible

---

## Styles

A **style** is a CSS variable set: `styles/base.css` (shared foundation) + `styles/<name>/style.css` (visual overrides — color, font, spacing).

| Name | Version | Status | File | Best For | Image Panel |
|------|---------|--------|------|---------|-------------|
| `classic` | 1.0.0 | active | `docs/html-themes/overrides/classic.css` | General purpose (default) | 45% right panel |
| `minimal` | 1.0.0 | active | `docs/html-themes/overrides/minimal.css` | Text-heavy lectures | None |
| `visual-heavy` | 1.0.0 | active | `docs/html-themes/overrides/visual-heavy.css` | Visual storytelling | Full-bleed background |
| `academic` | 1.0.0 | active | `docs/html-themes/overrides/academic.css` | Research / thesis | 30% illustration panel |

> **Note on file paths**: Current styles live in `overrides/` (legacy path). New styles should be created under `styles/<name>/style.css`. Migration of existing styles is deferred until all HTML file references are updated.

---

## Shared Base

| File | Purpose |
|------|---------|
| `docs/html-themes/base/base.css` | Shared CSS variables: colors, fonts, spacing, TOC, progress bar |
| `docs/html-themes/styles/base.css` | Canonical future path (same content — migration in progress) |

---

## Adding a New Theme

1. Create `docs/html-themes/themes/<name>/` folder
2. Write `theme.json` — include `name`, `version`, `content_rules`, `compatible_styles`, `incompatible_styles`
3. Write `template.html` — HTML skeleton with `<!-- INJECT:* -->` placeholder comments
4. Register in this file (THEMES.md) — add row to Themes table and update Compatibility Matrix
5. Update `agents/html-build.md` → Available themes list
6. Update `docs/co-deck.context.md` → HTML Themes section
7. Run `bun scripts/audit.ts` to verify

## Adding a New Style

1. Create `docs/html-themes/styles/<name>/style.css` — CSS variable overrides only (no structural rules)
2. Optionally create `styles/<name>/dark.css` for a dark variant (leave empty if not yet implemented)
3. Update every `theme.json` that is compatible with this style → add to `compatible_styles`
4. Register in this file (THEMES.md) — add row to Styles table and update Compatibility Matrix
5. Update `docs/lecture-profile.md` → style field options comment
6. Update `docs/co-deck.context.md` → HTML Themes section
7. Run `bun scripts/audit.ts` to verify

---

*Last updated: 2026-06-21 — initial registry (2 themes × 4 styles)*
