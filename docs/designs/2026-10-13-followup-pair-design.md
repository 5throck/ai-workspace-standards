# Design: Follow-up pair — Gemini toml fleet convergence phase 2, evidence-scan dual-currency M1

- **Spec ID**: 2026-10-13-followup-pair-design
- **Date**: 2026-10-13
- **Status**: implemented
- **Tickets**: T-20261013-012, T-20261013-011 (user-directed)

## D1 — Gemini toml fleet convergence, phase 2 (T-20261013-012)

Phase 1 (2026-10-13 backlog-sweep-2) promoted the renderer and converged the ROOT.
Phase 2 converges the template and the validators:

- `templates/common/.gemini/commands/` converted to `<name>.toml` (rendered from the
  common `.claude/commands` SSOT); the legacy `.md` copies removed from BOTH
  templates/common and the workspace root (Gemini CLI never loaded them).
- `checkCommands` (validate-templates 1.56.0): the `.gemini` command surface expects
  `<name>.toml`.
- `audit.ts` 2.54.0 (L0+L1): the command-parity check expects the rendered toml, with
  the `run bun scripts/render-commands.ts` remediation hint (renderer now L0+L1, so
  lifecycle Check X accepts the reference).
- `render-commands.ts` delivered L0+L1 (mirror span 155); projects can render and
  verify their own gemini commands after their next upgrade.
- Known residual: existing projects keep dead `.gemini/commands/*.md` orphans until
  they run the delivered renderer or a sweep pass — co-abap already operates the
  toml model project-side.

## D2 — evidence-scan dual-currency M1 (T-20261013-011)

The F3 (schema-typed) plane resolved decision-record evidence_refs against
schema-file basenames only, so genuine decisions citing EV ledger ids could never
satisfy M1 — the exact gap the co-safety seeding exposed. Fix: the F3 plane's
targets now include the EV ids parsed from the project's own
`docs/evidence/ledger.md` (dual-currency resolution: a plane that keeps both
schemas and a ledger accepts both currencies). Outcome: co-safety's seeded
records (DEC-20261013-01/02/03) now satisfy M1 and the plane reads **PROMOTABLE**
(all seven maturity tests pass). The Step 2b promotion decision (backporting the
evidence-models pair to the template) stays human-judged per the standing protocol.

## Verification

- validate-templates 0 errors (checkCommands toml-aware); audit green (toml parity
  PASS at 7 sources); lifecycle-sync-audit clean (audit:render-commands registered in
  INTENTIONAL_CROSS_REFS, mirror registry projection 155 rows, span pin updated).
- `tests/unit/render-commands.test.ts` green; evidence scan re-run: co-safety
  schema-typed plane PROMOTABLE.
