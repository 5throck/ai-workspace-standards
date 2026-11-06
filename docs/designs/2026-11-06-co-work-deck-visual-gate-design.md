# Design: co-work deck visual gate (`svg-check --stage visual` + page-level visual review)

- **Spec ID**: 2026-11-06-co-work-deck-visual-gate-design
- **Date**: 2026-11-06
- **Status**: Proposed (draft)
- **Owner**: architect (PM Gateway dispatch)
- **Tier**: L2 (`templates/co-work` only)
- **Relation to prior specs**: extends `2026-11-03-co-work-native-pptx-deck-design` (gates, exporter) and `2026-11-06-deck-pipeline-hardening-design` (D3 white-underlay preview procedure, which this spec turns from a procedure into tooling)
- **Origin**: comparison with hugohe3/ppt-master v6.8.0 (MIT), item P1 — its `references/visual-review.md` rubric and per-page `.review/<page>.json` records. Ideas only; no code is copied.

## 1. Context

The deck pipeline has two deterministic gates (`svg-check --stage early|final`: whitelist, tokens, content-SSOT diff, fingerprint) and then a **procedural** visual step: the `pptx-export` skill tells the agent to sanitize a temp copy, inject a white underlay, render PNGs with resvg, and hand them to a visual judge. Failures on 2026-11-05/06:

- The underlay was a manual, undocumented workaround; the 11-06 judge round failed 12/13 pages on it before D3 codified it as prose.
- Overflow / overlap / off-canvas defects are found only by eye, late, and inconsistently between judge rounds.
- Judge verdicts are free text in chat; nothing ties a verdict to the exact page bytes, so a page edited after its review still looks "reviewed".

ppt-master solves the same problem in two layers: geometric hard rules checkable from the SVG (out-of-bounds, text overflow, text overlap, contrast), then a per-page LLM rubric over the rendered PNG, written to one JSON file per page. Both layers are cheap to adopt here because our SVG language is a small whitelist with explicit coordinates.

## 2. Goals / non-goals

**Goals**
- Every geometric defect that can be computed from the canonical SVG fails a gate, not a judge.
- The preview render is a tool, not a procedure (D3 underlay + entity sanitize built in).
- Visual-judge verdicts are structured, per page, and bound to the page fingerprint; export refuses on stale or failing verdicts.

**Non-goals**
- Pixel-diff regression against a golden image.
- Replacing the human/LLM judgement on aesthetics (soft rules stay advisory).
- Rendering through PowerPoint/LibreOffice (existing policy, design §11.6).

## 3. Decisions

### D1 — New stage `--stage visual` in `svg-check.ts`

Runs after `final` passes on the same deck. Computes a bbox per text run and per shape from the whitelisted attributes, with text width estimated from a per-font advance table (registry fonts only; CJK = 1.0 em, Latin from metrics shipped with the tool). Rules:

| Rule | Severity | Trigger |
|---|---|---|
| `E-VIS-BOUNDS` | error | any element bbox outside the root viewBox (tolerance 0 px; full-bleed rects exempt) |
| `E-VIS-TEXT-OVERFLOW` | error | a text bbox exceeds the bbox of the `rect` it sits on inside the same top-level block, beyond a 4 px tolerance |
| `E-VIS-TEXT-OVERLAP` | error | two `text` bboxes from different `text` elements intersect (tspans of one text excluded) |
| `E-VIS-CONTRAST` | error | WCAG contrast ratio < 4.5 (font-size < 24 px) or < 3.0 (≥ 24 px) between text fill and the topmost solid paint beneath it; gradients use the worst stop |
| `W-VIS-COLLISION` | warning | two shape bboxes from different blocks overlap where neither is a background/full-bleed element |
| `W-VIS-MARGIN` | warning | content (non-background) within 40 px of the canvas edge |
| `W-VIS-DENSITY` | warning | more than N text runs or more than M characters on a page (N, M from the registry deck type) |

Contrast on a brand-token pair that fails on every page is reported once, deck-wide (`E-VIS-CONTRAST-TOKEN`), and routed to the registry, not the page — the ppt-master §1.1 lesson: never patch a token problem page by page.

Width estimation is an approximation; the rule set is tuned to have **no false errors** on the shipped fixture and the 22-page v2.0 deck before it ships (§5).

### D2 — `svg-to-pptx.ts --render-png` absorbs the D3 underlay procedure

`renderPngs` sanitizes in memory (bare `&` → `&amp;`) and injects the white underlay when the page has no full-bleed background rect, then renders. No temp files. The `pptx-export` skill's step 4 shrinks to one command. Behaviour behind a flag for one minor version (`--no-underlay` to reproduce old output), then default.

### D3 — Per-page review records bound to fingerprints

The visual judge (deck-builder or a spawned reviewer) writes `<deck>/.review/<NN-slug>.json`:

```json
{
  "page": "03-market.svg",
  "page_sha256": "sha256:…",
  "png": "previews/03-market.png",
  "verdict": "pass" | "fix" | "accept-with-concern",
  "hard_hits": [{ "rule": "H2", "note": "…" }],
  "soft_hits": [{ "rule": "S1", "note": "…" }],
  "untouched_concerns": ["deck-wide: accent on muted fails contrast at 18px"],
  "reviewed_at": "2026-11-…"
}
```

The rubric lives in the `svg-quality-gate` skill as two tables: **hard** (H1 missing focal point, H2 image broken/distorted, H3 required content block missing vs `deck_content.md`, H4 legibility defect the computed rules missed) — every hit must be fixed; **soft** (alignment rhythm, whitespace balance, visual weight, cross-page consistency) — act only when clearly bad, record deck-wide patterns under `untouched_concerns` instead of oscillating.

### D4 — Export precondition

`svg-to-pptx.ts` gains `--require-review`: refuses when any page lacks a record, a record's `page_sha256` differs from the current page bytes, or a verdict is `fix`. Off by default for one minor version, then default-on for deck types marked `client_deliverable` in the registry.

### D5 — Batch size and cadence

Review runs in batches of up to 6 pages per reviewer pass (ppt-master's batching keeps the rubric in context without drifting). Re-review only pages whose fingerprint changed. Maximum 2 fix cycles per page before escalating to PM, matching the existing re-execution rule.

## 4. Implementation map

| Item | File | Change |
|---|---|---|
| D1 | `scripts/deck/svg-check.ts` | `--stage visual`; bbox model; font advance table; 7 rules; JSON `visual` section |
| D1 | `scripts/deck/font-metrics.json` (new) | advance widths for registry fonts |
| D2 | `scripts/deck/svg-to-pptx.ts` | in-memory sanitize + underlay in `renderPngs` |
| D3 | `skills/svg-quality-gate/SKILL.md` | rubric tables, record schema |
| D3 | `scripts/deck/review-schema.json` (new) | JSON schema for `.review/*.json` |
| D4 | `scripts/deck/svg-to-pptx.ts` | `--require-review` |
| skills | `skills/pptx-export/SKILL.md`, `agents/deck-builder.md` | step 4 → one command; review loop step |
| registry | `docs/document-style-registry.json` | density limits, `client_deliverable` flag per deck type |
| mirrors / registries | platform skill mirrors, `SCRIPTS.md`, `SKILLS.md` | re-pin versions |

## 5. Test plan

- **Golden negatives** (in-test fixtures): one page per error rule (off-canvas rect, text wider than its card, two overlapping titles, `#999999` on `#FFFFFF` at 16 px) → each fails with its rule id.
- **No false errors**: `fixtures/sample-business-report` and the shipped v2.0 22-page deck pass `--stage visual` with 0 errors. Any warning they raise is listed and judged in the PR.
- **Underlay**: a page without background rect renders with white corners; a bare-`&` page renders instead of aborting.
- **Review binding**: edit a page after its record is written → `--require-review` refuses with the page name; restore → passes.
- **Backward compatibility**: `--stage early|final` output byte-identical to v1.5.1 on the fixture.

## 6. Open questions

- **Q1** — Font metrics source: ship a small hand-built advance table (no new dependency) or read glyph advances from the TTFs at runtime with an existing font parser? Recommendation: table first.
- **Q2** — Who reviews: deck-builder self-review, or a separate reviewer subagent per batch (ppt-master's choice, avoids grading its own work)? Recommendation: separate reviewer for `client_deliverable` decks, self-review otherwise.
