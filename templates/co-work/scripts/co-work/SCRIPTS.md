# SCRIPTS.md — co-work Variant Scripts

> Lifecycle registry for co-work variant-specific scripts in `scripts/deck/`.
> These scripts are co-work only; they do NOT appear in the L1 common `scripts/SCRIPTS.md`.
> Executed via Bun per ADR-0036. Runtime dependencies are declared in the variant's
> root `package.json` — run `bun install` at project root before first use.

---

## Registry

| script | version | status | description | cli-usage |
|--------|---------|--------|-------------|-----------|
| `svg-check.ts` | 1.4.0 | active | Deterministic quality gate for canonical SVG deck pages: whitelist enforcement, three-severity model, content-SSOT text-run diff, and SHA-256 fingerprint reports required for PPTX export (spec 2026-11-03-co-work-native-pptx-deck-design) | `bun scripts/deck/svg-check.ts --deck <dir> --content <deck_content.md> --stage early\|final [--json] [--out <report.json>]` |
| `svg-to-pptx.ts` | 1.4.1 | active | Compiles authored canonical SVG deck pages into a natively editable DrawingML PPTX package (flat mode: one clean master + blank layout, clrScheme/fontScheme from the document-style-registry deck tokens); refuses to run without a fingerprint-matching final svg-check report; **v1.4.1**: connector cNvPr close-tag fix — malformed DrawingML (unclosed `<p:cNvPr>` + stray quote) triggered a PowerPoint repair prompt on every deck containing line shapes | `bun scripts/deck/svg-to-pptx.ts --deck <dir> --out <file.pptx> --report <final-report.json> --registry <document-style-registry.json> --deck-type <key> [--notes-dir <dir>] [--render-png --png-dir <dir>]` |

---

## Design Note

These scripts reside in `scripts/deck/` per **ADR-0033: Variant-Specific Skills & Scripts Blueprint** (Accepted).

**Governance chain:**
- `templates/co-work/variant.json` → `script_manifest.local` declares each script
- `bun scripts/validate-templates.ts` check B-03 verifies all declared paths exist (L0 workspace check)
- `bun scripts/lifecycle-sync-audit.ts` Check V verifies `@version` consistency within this registry

**Reference:** ADR-0033 · Script Lifecycle §6.5

*Last Updated: 2026-11-06 — created registry with svg-check 1.4.0 + svg-to-pptx 1.4.1 (connector cNvPr close-tag fix; regression pinned in `scripts/deck/tests/deck-golden.test.ts`).*
