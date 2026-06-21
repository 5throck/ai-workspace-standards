# Meeting Transcript
**Date**: 2026-06-21
**Topic**: html-themes restructure — gap analysis and補完
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

The target structure was confirmed in a prior meeting (memory/meeting-2026-06-21-html-themes-restructure.md):
- `themes/styles/` as a shared style pool under `themes/`
- `pdf_layout_spec.json` owns geometry only (no colors/font-family)
- `pdf_color_spec.json` + `style.css` own colors and fonts
- 3-layer PDF merge retained

This meeting focuses on gaps and补完 items that must be resolved before implementation.

---

## Transcript

### Round 1

**[architect]**: (Round 1)

The first critical gap is the **nature of `base.css`**. THEMES.md describes it as "Shared CSS variables: colors, fonts, spacing, TOC, progress bar." The presence of "colors" and "fonts" means `base.css` may contain both structural concerns (spacing, layout scale) and style concerns (default color values, font families). If color variables are defined in `base.css` and each style's `style.css` overrides them, then moving `base.css` to `themes/styles/base.css` is logically correct — it becomes the shared style foundation. But if `base.css` hardcodes specific visual values, it may need to be split.

The second gap is the **`fonts` field boundary in `pdf_layout_spec.json`**. Font sizes (`title_pt: 28.0`, `bullet_pt: 12.5`) affect geometry and rightly belong in `pdf_layout_spec`. But **font families** (e.g., MaruBuri, NotoSansKR) are style concerns. The question is whether `gen-slides-pdf.ts` loads font families from the style layer or hardcodes them.

Question to automation-engineer: what does the current font loading logic in `gen-slides-pdf.ts` look like?

---

**[automation-engineer]**: (Round 1)

Both of architect's points are precise. From an implementation perspective:

Font loading in `gen-slides-pdf.ts` likely references downloaded TTF files by fixed paths (e.g., `fonts/MaruBuri.ttf`). If this is hardcoded in the script, font family selection currently belongs to no layer — it is an implicit fixed value. This is a design gap that the restructure should at least document a decision about.

The **`<!-- INJECT:CSS -->` mechanism** needs clarification. When html-build injects CSS into `template.html`, the injection order matters:
1. `base.css` — defines base CSS variables
2. `style.css` — overrides those variables for the selected style

If html-build currently hardcodes `overrides/classic.css`, the path must change to `themes/styles/classic/style.css` after migration. Whether this path string lives in `agents/html-build.md`, `gen-slides-pdf.ts`, or a helper script in `scripts/co-deck/` must be confirmed in Phase 0 investigation.

The **`preview/preview.html` relative path** also changes significantly: `../base/base.css` → `../themes/styles/base.css`. Depth increases but it's a simple text substitution. However, without automated path validation, this type of breakage will silently recur.

Question to auditor: is the absence of internal path linting a structural vulnerability that this restructure should address?

---

**[auditor]**: (Round 1)

Automation-engineer's path validation concern is valid. `audit.ts` currently does not validate CSS path references inside template.html or preview.html. This gap persists after the restructure.

A more fundamental gap: **the compatibility matrix vs. filesystem structure mismatch**. In the target structure, `themes/styles/` is a shared pool containing ALL styles — including `visual-heavy` and `academic` which are incompatible with `slideshow`. The filesystem alone cannot express incompatibility. Only reading `theme.json`'s `compatible_styles` field reveals the constraint.

This creates an intuition trap: "if the folder exists, the style is usable." A developer adding a new theme could forget to check the compatibility matrix.

Two mitigation options:
1. Add a check to `validate-templates.ts`: read `theme.json compatible_styles`, verify corresponding directories exist in `themes/styles/`, and flag any style present in `themes/styles/` but absent from all themes' `compatible_styles`.
2. Per-theme `styles/` subdirectory (Option B, already rejected due to duplication).

Option 1 is the right direction. Question to architect: should the `validate-templates.ts` check be part of this restructure's scope?

---

### Round 2

**[architect]**: (Round 2)

The `validate-templates.ts` check must be in scope — it's the governance mechanism that makes the shared pool model safe. Without it, the restructure creates an unverified assumption.

On `base.css`: the actual content must be inspected before the migration proceeds. If it contains hardcoded color values (not just CSS variable declarations with semantic names), then it behaves as a default style — which is fine as long as it is clearly positioned as "fallback" and every `style.css` fully overrides it.

On the **new style authoring guide path update**: THEMES.md "Adding a New Style" step 1 currently says `docs/html-themes/styles/<name>/style.css`. After restructure this becomes `docs/html-themes/themes/styles/<name>/style.css`. If this guide is wrong, the next person adding a style will create files in the old location, recreating the `overrides/` problem. This documentation update is non-optional.

The **CSS injection order** must also be explicitly documented in `agents/html-build.md`. Currently it appears to work implicitly. After the restructure, anyone reading the codebase needs to understand that `base.css` is always injected first, then `style.css` overrides it. This is an architectural invariant that should be stated explicitly.

---

**[automation-engineer]**: (Round 2)

Agreed on all of architect's points. Adding one more critical gap: **the `lecture-profile.md` `style` value → file path conversion logic**.

When a user writes `style: classic` in `lecture-profile.md`, something converts that to a CSS file path. This conversion logic — wherever it lives (html-build.md prompt text, gen-slides-pdf.ts code, or a co-deck helper script) — currently maps `classic` → `overrides/classic.css`. After migration it must map to `themes/styles/classic/style.css`. Identifying this exact location is the highest-priority item in the Phase 0 investigation.

Synthesizing the complete gap list found in this meeting:

1. `base.css` content audit — confirm if structural/style concerns are mixed; determine if split is needed
2. CSS injection order — document explicitly in `html-build.md`
3. `style` name → path conversion logic — locate and update
4. `validate-templates.ts` compatibility check — `theme.json compatible_styles` ↔ `themes/styles/<name>/` cross-validation
5. THEMES.md + co-deck.context.md + "Adding" guides — path string update
6. Font family layer assignment — confirm if `gen-slides-pdf.ts` hardcodes font families; decide if `pdf_color_spec.json` should add `font_family` field

Question to auditor: which of these are must-have for the migration, and which can be deferred?

---

**[auditor]**: (Synthesis)

Synthesizing both rounds.

**Points of Agreement:**

1. `base.css` content must be audited before migration — its nature (structure vs. colors) determines whether a split is needed.
2. CSS injection order (`base.css → style.css`) must be explicitly documented in `agents/html-build.md`.
3. The `style` name → path conversion logic is the highest-priority migration fix point.
4. `validate-templates.ts` compatibility check (G-03) is required — without it, the shared pool model has no governance.
5. All path strings in THEMES.md, co-deck.context.md, and authoring guides must be updated.
6. Font family layer assignment must be decided and documented even if not fully implemented now.

**Must-Have (blocking migration):**
- G-01: Phase 0 expanded investigation (base.css audit, injection mechanism, style→path logic, font hardcoding)
- G-02: Architecture decisions from G-01 results
- G-03: validate-templates.ts compatibility check
- G-04: Documentation updates (html-build.md, THEMES.md, co-deck.context.md)

**Nice-to-Have (deferred):**
- Runtime `style` ↔ `compatible_styles` validation in `gen-slides-pdf.ts` or html-build at execution time
- Automated lint for internal path references in template.html / preview.html

**Open Questions:**
- `base.css` actual content — cannot finalize `themes/styles/base.css` placement until inspected.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| G-01 | automation-engineer | Low | Expanded Phase 0 investigation: ① classify `base.css` variables (structural vs color/font), ② confirm `template.html` CSS injection mechanism, ③ locate `style` name→path conversion logic, ④ check `gen-slides-pdf.ts` for hardcoded font families | L0-only | Next (before Phase 0) |
| G-02 | architect | Medium | Architecture decisions based on G-01: ① `base.css` move vs. split decision, ② font family layer assignment (`pdf_color_spec` field addition decision), document outcomes | L0-only | After G-01 |
| G-03 | automation-engineer | Medium | Add `validate-templates.ts` compatibility check: `theme.json compatible_styles` ↔ `themes/styles/<name>/` directory cross-validation | L0-only | With M-01 |
| G-04 | docs-writer | Low | Update `agents/html-build.md` (CSS injection order), THEMES.md (all path strings + "Adding" guides), co-deck.context.md (CSS path references) | L0-only | With M-01 |
| N-1 | pm | Medium | Lifecycle Update | L0-only | After all |
| N | pm | Medium | Final QA Audit (`bun scripts/audit.ts`) + preview.html visual check | L0-only | After all |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `base.css` placement decision documented with rationale | G-02 output |
| 2 | Font family layer assignment decision documented | G-02 output |
| 3 | `validate-templates.ts` fails when `compatible_styles` entry has no matching directory | Intentional mismatch test |
| 4 | THEMES.md "Adding a New Style" guide paths match actual filesystem | Manual diff |
| 5 | `agents/html-build.md` explicitly states CSS injection order | File review |
