# Meeting Transcript
**Date**: 2026-06-19
**Topic**: Phase 2 — HTML themes (4 types), commercial-free image sources, source-verifier agent design
**Participants**: html-build, design, image-curator, research, architect, auditor (synthesizer)
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[html-build]** (Round 1)

Clarified the CSS variable override structure. `base.css` declares all layout/color/font variables. Each theme CSS overrides only `:root` variables — DOM structure unchanged. Key base variables: `--image-panel-width`, `--font-family`, `--font-size-title`, `--card-padding`, `--slide-bg`, `--accent`, `--header-bg`.

`visual-heavy` theme requires special handling: image becomes full-bleed background. Proposed using `data-bg` CSS custom property injection without DOM changes.

---

**[design]** (Round 1)

Resolved the `visual-heavy` DOM-immutability problem: use `background-image: var(--slide-bg-image)` on `.slide`, injected as inline CSS variable by `renderSlide()`. `.right-panel { display: none !important }` hides the panel without removing it from DOM. `measure-layout.ts` re-run not required.

Finalized theme differentiation:
- classic: white bg, navy header, 45% image panel
- minimal: light gray bg, no header bar, 0% image panel, large font
- visual-heavy: full-bleed bg image, translucent card overlay, white text
- academic: cream bg (#f8f6f0), Noto Serif KR, dark red accent, 30% image panel

---

**[image-curator]** (Round 1)

Finalized commercial-free image sources:
- Pixabay: no API key required, CC0, commercial use unlimited
- Unsplash URL method (source.unsplash.com): no API key, random but usable
- Pexels, Unsplash API: optional with API key for higher rate limits
- All sources: commercial use unlimited, attribution not required

`source: auto` strategy: Pixabay first (keyless) → Unsplash URL method → API if keys present.

`lecture-profile.md` to add optional `image.api_keys` section.
`image-manifest.json` to add `commercial_use: true` field per image.

`visual-heavy` query modifier: append `" wide landscape no text minimal"`.

---

**[research]** (Round 1)

Confirmed: current research agent has no URL validation. Hallucinated or outdated URLs are a real risk. Proposed `source-verifier` as separate agent at Gate 1.5.

Two-level verification:
- Level 1: HTTP HEAD request via `curl --head --max-time 5` — checks URL accessibility
- Level 2: content cross-check via Web Search — title/author/date match

Output: `source-verification.md` with ✅ verified / ⚠️ accessible / ❌ failed sections + Trust Score.

---

**[architect]** (Round 1)

Ruled: source-verifier should be a separate agent (not embedded in research). Reasons: single responsibility, optional execution, re-runnable independently, extensible for future content-trust checks.

Design constraints: Bash for HTTP requests, Web Search for content cross-check, output is report-only (no auto-modification), `--skip-verify` flag for fast workflows.

New pipeline: `research → [source-verifier] → storyline → design → image-curator → html-build`

---

### Round 2

**[html-build]** (Round 2)

Confirmed `renderSlide()` modification: detect `document.documentElement.dataset.theme`, inject `--slide-bg-image` CSS variable for `visual-heavy`. `<html data-theme="...">` set by html-build agent from `lecture-profile.md`.

`validate-templates.ts` B-04 check: verify existence of 5 CSS files (base/base.css + 4 overrides).

---

**[design]** (Round 2)

`academic` theme uses Noto Serif KR via Google Fonts `@import`. Offline fallback: `Georgia, serif`. Flagged offline dependency as open issue.

Final theme spec table documented in meeting notes.

---

**[image-curator]** (Round 2)

Finalized `lecture-profile.md` `image.api_keys` optional section structure. `source: auto` priority: Pixabay (keyless) → Unsplash URL → API keys. All sources confirmed commercial-use unlimited.

---

**[research]** (Round 2)

Detailed two-level verification output format:
- `source-verification.md` with sections: Verified, Accessible, Failed
- Overall Trust Score (e.g., "87% — 13/15 sources verified")
- Gate 1.5: PM reviews ❌ sources, requests re-research or exclusion

---

**[architect]** (Round 2)

Final synthesis: all three items have actionable designs. Recommended implementation order: A-08 (source-verifier) → A-07 (image source update) → A-06 (HTML themes).

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-06 | html-build | Medium | `html-themes/` dir — `base/base.css` + `overrides/` 4 CSS files; `variant.json theme_manifest`; `validate-templates.ts` B-04; `renderSlide` data-theme detection guide in html-build.md | Both | 2 |
| A-07 | image-curator | Low | Add `image.api_keys` section to `lecture-profile.md`; add `commercial_use` field to image-manifest spec; update image-curator agent source strategy | Both | 2 |
| A-08 | architect | High | Create `agents/source-verifier.md`; update `variant.json agents` + `agent_manifest`; document 2-level verification logic | Both | 2 |

## Open Issues

| # | Issue | Impact |
|---|-------|--------|
| OI-04 | `academic` theme depends on Google Fonts online — offline lecture environments may fail | Low (fallback to Georgia exists) |
| OI-05 | `--skip-verify` flag for source-verifier needs explicit documentation in pm.md workflow | Low |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| A-06 | `html-themes/` has 5 CSS files; switching `lecture-profile.md` theme changes slide appearance | Visual test in browser |
| A-07 | `lecture-profile.md` template has `image.api_keys` section; image-curator uses Pixabay keyless as default | Agent walkthrough test |
| A-08 | `source-verifier` agent exists; produces `source-verification.md` with Trust Score; Gate 1.5 in pipeline | Test with 5 URLs (mix of valid/invalid) |
