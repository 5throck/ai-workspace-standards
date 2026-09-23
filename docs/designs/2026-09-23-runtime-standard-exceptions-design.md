# Runtime Standard Exceptions (ADR-0087) — Tool-Owned Node Shims and Documented Variant Exceptions

**Spec ID**: 2026-09-23-runtime-standard-exceptions-design
**Related**: ADR-0036 (Script Migration — sh/ps1 → TypeScript/Bun), ADR-0087 (`docs/adr/0087-runtime-standard-exceptions.md`)
**Date**: 2026-09-23

## Background

ADR-0036 standardizes workspace automation on TypeScript files executed by
`bun`. A fleet-wide audit (2026-09-23) found residual Node.js usage in the
workspace root and templates. The audit classified all findings into four
compliant classes: graft tool-owned shims, co-deck Playwright browser
tests, browser/web assets, and one vestigial shebang. ADR-0087 records
these as explicit exceptions to ADR-0036.

## Requirements

1. Record the exception classes in an accepted ADR. Reference ADR-0036.
2. Mark ADR-0036 as amended. Point readers to the exception ADR.
3. Remove the vestigial shebang from `extract_slidedata.mjs`. The script
   is bun-invoked and never executed directly.
4. Do not migrate graft-generated files. graft regenerates them on
   upgrade.
5. Do not migrate co-deck `tests/*.browser.mjs`. Co-deck SCRIPTS.md
   documents the node runtime and the bun-Windows Playwright issue.

## Design

- New decision record: `docs/adr/0087-runtime-standard-exceptions.md`
  (Context, Decision, Consequences; house ADR format).
- ADR-0036 `## Status` line gains an amendment pointer to ADR-0087.
- `templates/co-deck/scripts/co-deck/extract_slidedata.mjs`: delete line
  1 (`#!/usr/bin/env node`). No logic change.
- Co-deck SCRIPTS.md needs no edit — bun invocation rows already match
  the actual runtime; the `.browser.mjs` rows keep "runs via Node.js".

## Accessibility

Not applicable — governance documentation and script hygiene only. No
user-facing UI is introduced or changed.

## Verification

1. `bun scripts/spec-register.ts --file docs/designs/2026-09-23-runtime-standard-exceptions-design.md --source manual --status implemented` — registry entry created.
2. `bun scripts/audit.ts` — workspace audit passes with the new files.
3. `bun scripts/validate-templates.ts` — no new errors beyond the
   pre-existing co-deck warnings.
4. `bun scripts/co-deck/extract_slidedata.mjs` on a co-deck fixture
   (or `--help`-style empty-args run) still exits with the documented
   usage error — shebang removal changed no behavior.
