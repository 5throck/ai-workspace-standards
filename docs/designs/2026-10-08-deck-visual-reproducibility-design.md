# Co-deck Visual-Regression Reproducibility Strategy — Design (proposed)

- **Date**: 2026-10-08
- **Status**: proposed (T-20261007-006)
- **Related**: T-20261007-019 (environment fingerprint), co-deck theme visual-regression suite

## Problem

Fresh renders differ from committed baselines at 100% on every pair when run
outside the authoring session: slides embed live YouTube players
(network-dependent frames), baselines were regenerated in the authoring
session immediately before push, and system fonts + the local Playwright
Chromium build differ per environment. Any session-owned environment can
silently redefine truth by regenerating baselines.

## Decision (proposed): deterministic render contract

1. **No live embeds in test renders.** The render harness sets an env flag
   (`VISUAL_TEST=1`) that the deck template honors by replacing every
   `<iframe>`/video element with its poster image (from `slidedata.json`
   thumbnails) — the DOM geometry is preserved, the network dependency is
   removed. This is the lowest-cost of the three candidate strategies and
   keeps baselines meaningful (layout is what the suite checks).
2. **Font pinning.** The render page injects a `@font-face` block pointing at
   the workspace's bundled font set before any measurement; system font
   fallbacks stop participating in baseline pixels.
3. **Chromium pin.** Playwright's Chromium build is pinned in the harness
   (`playwright install --with-deps <pinned-version>` documented in the
   procedure; the version lives next to the baselines).
4. **Baselines are CI-rendered.** Once 1–3 hold, the authoritative baseline
   set is rendered by CI (one env) and checked in; local runs compare against
   it and may only propose regeneration via CI.
5. **Environment fingerprint (pairs with T-20261007-019).** Each baseline
   directory carries `env.json` {chromium build, font set hash, render date,
   git SHA} — a fingerprint mismatch is a documented, visible reason to
   distrust a diff instead of a silent redefinition of truth.

## Consequences

- Template upgrades to co-deck can pass the visual gate locally again.
- Baseline regeneration becomes a CI action with a reviewable artifact.

## Alternatives rejected

- "Regenerate locally and accept diffs" — the silent-truth-redefinition the
  ticket exists to kill.
- Full font+engine dockerization — heaviest option; revisit if poster-mode
  proves insufficient for layout-sensitive themes.
