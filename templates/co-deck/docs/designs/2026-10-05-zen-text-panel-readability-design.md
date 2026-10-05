# Design: zen text panels — semi-opaque box behind slide text

- **Spec ID**: 2026-10-05-zen-text-panel-readability
- **Date**: 2026-10-05
- **Status**: implemented
- **Scope**: `docs/html-themes/styles/`

## Problem

Under zen, classic/minimal/premium-dark/academic rendered slide text directly on the overlay+photo (`.slide-card { background: transparent }`): the text box was fully transparent, so bright photo regions (sky, waterfall spray) sat directly behind glyphs and hurt contrast. white-bubble's card was readable but could go a touch more solid.

## Decision

Give every non-cover zen slide a semi-opaque text panel via `.slide:not([data-type="cover"]) .slide-content`, tuned per style (same structural pattern white-bubble already used):

| Style | Panel | Rationale |
|---|---|---|
| classic | `rgba(248,246,241,.72)` warm paper | keeps Ink & Paper tone; glyphs never touch photo |
| minimal | `rgba(255,255,255,.85)` | whitespace dominant, text gains a floor |
| premium-dark | `rgba(4,7,14,.72)` noir | cream text no longer fights bright photo areas |
| academic | `rgba(62,48,32,.78)` sepia | panel matches the manuscript tone inside the frame |
| white-bubble | card opacity `.93 → .97` | marginal solidify; pattern already present |

Covers stay card-less by design (white serif + shadow, matching the 2008 reference).

## Decision (addendum: hug the text box, not the region)

User review of the first cut: the panel wrapped the whole content region, not the text box. Root cause: base.css `.slide-content { flex: 1 1 auto }` — as a row flex item it grows to the full card width regardless of `width`. Panel rules now add `flex: 0 0 auto; width: fit-content; margin-inline: auto;` so the box hugs the text and stays centered. white-bubble gets the same hug treatment (it had the identical stretch problem all along). Verifying screenshots confirmed compact centered boxes on all five pairs.

## Consequences

- Rendering changes for all zen pairs → zen baselines regenerated; non-zen baselines untouched.
- White-bubble design doc's card spec updated in place (0.97).

## Verification

- Playwright screenshots of all 5 zen × style standard slides: text sits on an opaque panel; contrast restored on bright photo areas.
- `bun test scripts/co-deck/tests/theme-browser-smoke.test.ts`, `validate-theme-styles.ts`, `audit.ts`.
