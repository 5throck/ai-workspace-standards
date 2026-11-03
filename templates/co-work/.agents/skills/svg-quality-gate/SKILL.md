---
name: svg-quality-gate
description: >
  Deterministic quality gate for canonical SVG deck pages: dual gates (early
  method sample P01-P05 + final whole-deck), three-severity model (error
  blocks / warning passes / no auto-fix), content-SSOT text-run diff, and
  SHA-256 fingerprint reports required for export. Use when: running or
  interpreting svg-check.ts on a deck, or deciding whether a deck may export.
version: 1.1.0
last_reviewed: 2026-11-03
status: active
scope: co-work
owner: pm
prerequisites: Bun runtime, templates/co-work/scripts/deck/svg-check.ts
metadata:
  type: process
  triggers:
    - svg quality gate
    - deck gate
    - svg-check
    - final gate deck
    - early gate slides
---

# 🛠️ Skill: svg-quality-gate

## Context

LLM-authored SVG is not deterministic — contract violations creep in over
long decks and surface at export or, worse, silently in PowerPoint. The gate
turns "PowerPoint shows a broken slide" into "page N violates the canonical
contract" before any conversion happens. It reads authored state only —
**it never rewrites pages** (no auto-fix by design: a mechanical patch can
silently overwrite valid design intent).

## When to Use

- After authoring P01–P05 (early gate; skipped for rosters of 6 or fewer pages)
- Before export (final gate — mandatory, whole deck)
- After any page repair, at the owning stage (early repairs re-run early; final repairs re-run final)

## Severity Model

| Severity | Classification | Pipeline behavior |
|----------|---------------|-------------------|
| `error` | Broken contract: non-whitelisted element/attribute, invalid color spelling, malformed path, missing required marker, XML malformation, **text run not present in `deck_content.md`** | Re-author the page and re-run the gate; export refuses while any blocking error remains |
| `warning` | Documented compatible form: relative path commands, lowercase hex, `scale` transforms | Record and pass; fix when the same warning repeats across pages (that is a prompt/authoring-method issue) |

There is intentionally **no auto-fix** and no gray zone: if it must be
corrected for delivery, it is an error.

## Execution Steps

1. **Early gate** (first 5 pages as a method sample; skip for rosters ≤ 6):
   ```bash
   bun templates/co-work/scripts/deck/svg-check.ts --deck <deck-dir> \
     --content <deck-dir>/deck_content.md --stage early --json
   ```
   Classify the complete issue set: method-level (fix the authoring method, not just the page), page-local, and not-yet-exercised capabilities. Fix every blocking error and selected advisory warnings in ONE consolidated pass before authoring further pages.
2. **Final gate** (whole deck):
   ```bash
   bun templates/co-work/scripts/deck/svg-check.ts --deck <deck-dir> \
     --content <deck-dir>/deck_content.md --stage final --json
   ```
   Zero errors required to proceed. The report's SHA-256 fingerprint must match the bytes at export time — any edit after the final gate invalidates it; re-run the gate.
3. **Repair loop**: fix at the page level (max 2 rounds per page; exceeding → PM escalation). Re-run the owning stage's gate after each consolidated repair pass.

## Report Shape (JSON)

```json
{
  "stage": "final",
  "deck": "<dir>",
  "pages": [ { "file": "01-title.svg", "errors": [], "warnings": [] } ],
  "summary": { "pages": 10, "errors": 0, "warnings": 1 },
  "content_diff": { "unmatched_runs": [] },
  "fingerprint": "sha256:<hex>",
  "generated_at": "<ISO-8601>"
}
```

## Output Format

- Pass verdict: `stage`, error/warning counts, fingerprint
- On failure: per-page error list with rule ids (e.g. `E-WHITELIST`, `E-COLOR`, `E-PATH-CMD`, `E-MARKER`, `E-CONTENT-DIFF`, `E-XML`)

## Related Skills

- `svg-slide-authoring` — owns the canonical contract this gate enforces
- `pptx-export` — refuses exports without this gate's fingerprint-matching final report

## Verification Policy (no Office tooling)

LibreOffice (and PowerPoint automation) is never installed or invoked by this pipeline. Visual acceptance renders the authored SVG via `@resvg/resvg-js` (`svg-to-pptx.ts --render-png`); package correctness rests on the exporter's structural postflight plus this gate's empirical contract — checker rules thicken as real PowerPoint breakage surfaces, not by rendering packages through an Office emulator.

## References

- Spec: `docs/designs/2026-11-03-co-work-native-pptx-deck-design.md` (§3, §6)
- Authoring contract: `svg-slide-authoring` skill
- Export coupling: `pptx-export` skill (fingerprint refusal rule)
