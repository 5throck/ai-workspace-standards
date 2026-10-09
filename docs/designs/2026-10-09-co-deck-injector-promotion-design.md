# co-deck video player injector promotion — Design

- **Spec ID**: 2026-10-09-co-deck-injector-promotion-design
- **Date**: 2026-10-09
- **Status**: implemented
- **Ticket**: T-20261007-008 (learning promotion, human-judged per user direction 2026-10-09)
- **Origin**: co-deck lecture-v4 engagement (ADR-0002, design D6, PR #164); procedure gates already promoted via #1474/#1475.

## Decision

Promote the PATTERN as a TypeScript generalization, not the engagement script:

- `Projects/co-deck/presentations/2026-10-ai-industry-research/inject_video_players.py` is engagement output (zen-theme-hardcoded CSS, Korean UI strings, a `#slide-3` selector, per-deck extras: footnotes/part-label/font tweaks) — the backport gate (ADR-0031 Safety Rule 6) forbids promoting engagement copies. It also currently carries a JS syntax-error remnant in its working tree — exactly the defect class the procedure's `node --check` gate exists for.
- ADR-0036 mandates TypeScript for template tooling and no variant template ships Python (co-consult's HWP promotion resolved to deprecation). Therefore the promoted tool is **TS**: `templates/co-deck/scripts/co-deck/inject-video-players.ts`.

## Generalized contract (what the tool keeps from the pattern)

1. **Idempotent marker-based replace** — a `<style id="cdk-video-players">` marker block is stripped before re-injection; rebuild + re-run is always safe (procedure re-run rule).
2. **Triple play-mode fallback** — local mp4 (slidedata `videoLocal`) → inline YouTube iframe over http(s) with `origin` → `window.open` watch URL over `file://` (embed error 153 dodge).
3. **Stop-on-slide-change** — a MutationObserver cleans playing iframes/videos when the active slide moves (the v4 stale-index defect class); slides are bound by `slide-<i>` id + `dataset.videoBound` guard.
4. **CLI**: `bun scripts/co-deck/inject-video-players.ts <deck.html> [--slidedata <path>] [--assets-dir <dir>]` — theme-agnostic (binds via `slide-<i>` ids and generic classes; zero engagement CSS), English-neutral output, exits non-zero with a clear message when no video slides exist.

## Surfaces

- `templates/co-deck/scripts/co-deck/inject-video-players.ts` (new, @version 1.0.0)
- `templates/co-deck/scripts/co-deck/SCRIPTS.md`: registry row + Architecture note that the injector is the one TS tool deliberately shipping a Python-era pattern from the v4 engagement (evidence chain recorded)
- `templates/co-deck/scripts/co-deck/tests/inject-video-players.test.ts`: idempotency pin (inject twice → byte-identical output) + fallback contract assertions on a synthetic deck fixture

## Verification

`bun test scripts/co-deck/tests/` green inside the template tree; five-mirror parity unaffected (scripts/ has no platform mirrors); `validate-variant-claims --template co-deck` PASS (spawn-target + registry consistency); scaffold E2E unaffected (scripts/co-deck/* overlay only).
