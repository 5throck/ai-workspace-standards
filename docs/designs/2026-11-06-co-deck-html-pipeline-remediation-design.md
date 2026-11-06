# Design: co-deck HTML pipeline remediation batch (U-20261105-004 / -006 / -007)

- **Date**: 2026-11-06
- **Source**: upstream requests U-20261105-004 (waiting), U-20261105-006 (waiting), U-20261105-007 (backlog) from project/co-deck
- **Agent**: automation-engineer (dispatched via PM Gateway)
- **Scope**: L2 template `templates/co-deck/` only — no gen-slides-pdf.ts / estimate-layout.ts changes (owned by a parallel fix branch)

## Problem statements (reproduced against template files 2026-11-06)

### U-20261105-004 — zen + white-bubble HTML rendering defects

All seven enumerated defects reproduce in the template sources:

1. `styles/base.css` `.bullet-item { display: flex; gap: var(--bullet-indent) }` — a bullet
   whose HTML contains `<strong>` splits into separate flex items (anonymous text item +
   strong item), so wrapped bullets render as 2–3 misaligned columns and the card grows
   past the slide frame.
2. `themes/zen/theme.css` `.slide-content { text-align: center }` — once bullets become
   block-level they inherit centered text, marker floating mid-line.
3. `styles/white-bubble/style.css` card selector
   `[data-theme="zen"] .slide:not([data-type="cover"]) .slide-content` leaves the cover
   card transparent; punchline/contact slides carry no opaque card either.
4. No `word-break: keep-all` anywhere — Korean titles/punchlines break mid-word.
5. No `.zen-visual-panel` styling at all — visualDisplay panels render at title size,
   hugging the card's left edge, no box.
6. No card `max-height` and no `.zen-visual` height cap — dense slides overflow the frame.
7. `strong` accent hardcoded (`#e8590c` / `#ffc078`) instead of `var(--accent-color)`.

### U-20261105-006 — diagram stage SVGs duplicate caption/source and echo bullets

- `agents/diagram-specialist.md` Input Contract documents `visual_spec.caption`
  ("rendered below diagram") and chart `source` ("renders as 9px italic caption
  bottom-right") — driving generated SVGs to embed their own caption/source lines,
  while html-build and the PDF also render slidedata `visualCaption`/`visualSource`
  → the same text appears twice on a slide. Bullet echo and the other geometry defects
  (pyramid shape, viewBox overflow, tick float noise, small canvases, comparison gaps)
  are prompt-driven with no template-side guard.
- `scripts/co-deck/gen-visual-images.ts` writes generator output verbatim — no
  sanitize/audit step exists. Project-side emergency fixes
  (`strip_caps.mjs`, `dupcheck.py` in `_fix-scripts-2026-11-05/`) prove the defect class.

### U-20261105-007 — video pipeline gap (items 1 and 2 of the ticket only)

- The engine has `inject-video-players.ts` (idempotent post-build injector) but **no
  download step**: decks reference YouTube IDs and nothing fetches them for offline
  playback. Legacy `download_all_videos.py` exists only as engagement-local Python
  (`Projects/co-deck/presentations/2026-10-ai-industry-research/`).
- `build-theme-deck.ts` does NOT run the injector after build — a rebuild silently
  drops the players, and the canonical rebuild order (build → style patch → video
  inject) is documented nowhere in the template.

## Design

### 1. Bullet layout root fix (base.css) + white-bubble parity

Root fix in `styles/base.css` (benefits every theme, not only zen+white-bubble):

```css
.bullet-item {
  display: block;
  padding-left: var(--bullet-indent);
  text-indent: calc(var(--bullet-indent) * -1);
  text-align: left;
  color: var(--text-primary);
}
.bullet-item::before {
  content: var(--bullet-marker);
  color: var(--bullet-color);
  display: inline-block;
  width: var(--bullet-indent);
  text-indent: 0;
}
```

- Block + negative text-indent + inline-block marker reproduces the hanging indent for
  plain text bullets (marker left, text inline) while keeping `<strong>`/`<em>` and
  wrapped lines inline — the project's verified fix shape (LOCAL-PATCH U-20261105-004).
- `text-align: left` on the bullet guards against card-level centering (zen) — a direct
  declaration always beats inheritance.

`styles/white-bubble/style.css` — port the co-deck project's verified LOCAL-PATCH
blocks, minus the now-redundant bullet override (covered by the base.css root fix):
card on every slide type (cover included), navy cover/punchline/contact text,
`var(--accent-color)` keyword highlight, keep-all wrapping, card `max-height` +
`.zen-visual` cap, `.zen-visual-panel` sub-box styling, bullets column aligned with the
panel. Verified visuals (Playwright 1600x900: 0 flex bullets, card inside frame with
56px margin, panel left edge == bullets left edge) come from the project side; the
template port is CSS-identical in intent.

### 2. Diagram SVG caption dedup (single source of truth = slidedata)

- `scripts/co-deck/diagram-helpers.ts` (v1.3.0): add two pure helpers:
  - `stripDiagramFooterText(svg)` — removes footer-band `<text>` lines (y ≥ viewBox
    height − 70) at the generator footer x-positions, then re-fits the viewBox height
    to remaining content (port of `strip_caps.mjs` logic, generalized).
  - `svgTextDuplicatesSlide(svg, slideEntry)` — normalized-text overlap audit between
    SVG `<text>` content and the slide's `visualCaption`/`visualSource`/`bullets`
    (port of `dupcheck.py`), returns duplicate hits for reporting.
- `scripts/co-deck/gen-visual-images.ts` (v3.3.0): run the strip before writing each
  SVG/PNG pair, and run the dup audit after generation — WARN (not fail) on echoes so
  the pipeline surfaces the defect without blocking delivery of non-caption text.
- `agents/diagram-specialist.md` (v1.3.0): contract change — SVGs carry NO
  caption/takeaway/source/footer text (slidedata `visualCaption`/`visualSource` own
  them; chart `source` stays mandatory in the spec but is written to slidedata, not
  drawn); labels must not echo slide bullets verbatim; geometry constraints
  (pyramid = single triangle cut into layers, all geometry inside viewBox, rounded
  ticks, ~960px canvas with ≥18px labels / ≥15px subs, comparison columns with gaps)
  documented as generation rules.

### 3. Video download step + inject wired into the build

- New `scripts/co-deck/download-videos.ts` (v1.0.0): TypeScript port of
  `download_all_videos.py` (ADR-0036). Reads slidedata.json `videoId` fields, downloads
  `yt-<id>.mp4` via the QuickDL CLI (`CDK_QUICKDL_DIR` env or `--quickdl-dir` flag;
  default `~/git/project/QuickDL`), skip-if-exists idempotency (size > 100KB), per-item
  failure tolerance with a summary, non-zero exit only on total failure. The QuickDL
  dependency is documented as an external optional tool — absent QuickDL = clear error,
  not a crash.
- `scripts/co-deck/build-theme-deck.ts` (v0.2.0): post-build hook —
  - `--download-videos` flag runs `download-videos.ts` first (offline pre-fetch).
  - After writing the HTML, if any slideData entry carries `videoId`, invoke
    `inject-video-players.ts` on the output (spawnSync, same bun runtime). The
    injector's exit 1 ("no video slides") is treated as info; other failures WARN
    without failing the build (injector remains manually re-runnable).
  - Ordering is now structural: build → (optional download) → inject, so a rebuild can
    no longer silently drop players.
- Docs: `agents/html-build.md` + `skills/html-build/SKILL.md` gain a "Rebuild order"
  section: build → style patch → video inject, with the note that build-theme-deck
  runs inject automatically and the injector is idempotent (re-run always safe).

## Files changed

| File | Change |
|------|--------|
| `templates/co-deck/docs/html-themes/styles/base.css` | bullet root fix (block + hanging indent + left-align) |
| `templates/co-deck/docs/html-themes/styles/white-bubble/style.css` | port LOCAL-PATCH blocks (card everywhere, keep-all, panel, overflow caps, accent var) |
| `templates/co-deck/scripts/co-deck/diagram-helpers.ts` | v1.3.0 — stripDiagramFooterText + svgTextDuplicatesSlide |
| `templates/co-deck/scripts/co-deck/gen-visual-images.ts` | v3.3.0 — wire strip + dup audit |
| `templates/co-deck/agents/diagram-specialist.md` | v1.3.0 — caption/source/bullet-echo prohibition + geometry rules |
| `templates/co-deck/scripts/co-deck/download-videos.ts` | new v1.0.0 — QuickDL-backed offline video fetch |
| `templates/co-deck/scripts/co-deck/build-theme-deck.ts` | v0.2.0 — post-build inject hook + --download-videos |
| `templates/co-deck/agents/html-build.md` | rebuild-order section |
| `templates/co-deck/skills/html-build/SKILL.md` | rebuild-order section |
| `templates/co-deck/scripts/co-deck/tests/diagram-helpers.test.ts` | new — strip/audit unit pins |
| `templates/co-deck/scripts/co-deck/tests/download-videos.test.ts` | new — skip-if-exists idempotency |
| `templates/co-deck/scripts/co-deck/tests/build-theme-deck-video.test.ts` | new — post-build inject wiring pin |
| `templates/co-deck/scripts/co-deck/SCRIPTS.md` | registry rows + version bumps |
| `templates/co-deck/variant.json` | script_manifest.local += download-videos |

## Alternatives considered

- Fixing bullets only in white-bubble/style.css (project's patch shape) — rejected: the
  defect is in base.css and affects every theme; a root fix removes the whole override
  class.
- Stripping SVG captions with a regex inside each generator — rejected: generators are
  project-owned; the deterministic post-process in the engine covers all generators
  without per-project work.
- Shelling the video download to Python — rejected by ADR-0036; the QuickDL CLI stays
  an external dependency invoked via its documented venv python, same as the legacy
  script.

## Verification

- `bun run test:unit` green (new pins + existing suites).
- `bun scripts/audit.ts` green; `spec-register.ts` registers this design.
- CSS fixes are structurally verifiable (selector/rule presence); visual-only outcomes
  (line wrapping, card framing at 1600x900) rely on the project-side Playwright
  verification and are listed as unverified-programmatically in the delivery report.
