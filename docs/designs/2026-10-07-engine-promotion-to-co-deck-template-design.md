# Design: clicker keyboard navigation + abbreviation footnotes promoted to the co-deck template

- **Spec ID**: 2026-10-07-engine-promotion-to-co-deck-template
- **Date**: 2026-10-07
- **Status**: implemented
- **Scope**: `templates/co-deck/` (shared engine, vertical theme, docs, skill, tests)

## Problem

Two improvements proven out in `Projects/co-deck` (landing PRs #166-adjacent work + #167) existed only in the project copy:

1. **Clicker-grade keyboard navigation** — `ppt-engine.js` handles PageDown/PageUp/Home/End (presenter remotes send PageDown/PageUp; previously dead), and the vertical theme's scroll-based override runs in capture phase with `stopImmediatePropagation` (fixes one-keypress-two-slides double-advance; ArrowLeft/Right mapped for remotes).
2. **Abbreviation footnotes** — `slideData[i].footnotes` renders via a shared `FootnoteBuilder` (called from `initPPT`, all engine themes) with wrap-enabled bottom-left styling and `--footnote-color`/`--footnote-bg` overrides; promoted from lecture_v4's bespoke script+CSS pair.

Without promotion, every future co-deck scaffold and upgrade would re-import the old engine and lose both.

## Decision

Copy the project-side files verbatim into `templates/co-deck/` (byte-identical by construction — they were edited once, then copied):

- `docs/html-themes/themes/_shared/ppt-engine.js`, `ppt-engine.css`
- `docs/html-themes/themes/vertical/template.html`
- `docs/html-themes/THEMES.md`, `docs/co-deck.context.md` (keyboard row + footnotes feature row; template copy keeps its distinct skills-table rows)
- `skills/html-build/SKILL.md` 1.6.0 (footnotes field docs) + `skills/SKILLS.md` row
- `scripts/co-deck/tests/ppt-engine-integration.test.ts` (Part D keyboard contract + Part E footnotes contract)
- Zen/white-bubble provenance design docs (`2026-10-05-*` ×3) that the project had and the template lacked

The counterpart project-side change (engine edits, 22 patched decks, baselines, previews) landed in the co-deck repo as PR #167.

## Alternatives considered

- Waiting for the next scheduled upgrade to carry the files — rejected: the upgrade path delivers engine files from the template, so the template must be updated first; the project already carries the new engine, making the pair temporarily divergent.
- Reimplementing in the template independently — rejected: byte-identical copies are verifiable and drift-free.

## Consequences

- New co-deck scaffolds ship clicker navigation and footnotes; existing projects converge on their next upgrade (upgrade-project v1.66.0+ delivers engine files from this template).
- Template and project engine files are byte-identical; `theme-visual-regression` baselines in the template were intentionally NOT regenerated on this machine (environment-bound fonts).

## Verification

- `bun test scripts/co-deck/tests/ppt-engine-integration.test.ts` inside `templates/co-deck` — 38/38 (Parts A–E).
- Template preview rebuild — 28 decks, 0 errors; deck files carry the new key set and FootnoteBuilder.
- Chromium end-to-end (project side, same bytes): keys move exactly one slide across 7 real decks; footnotes render styled on 4 themes.
