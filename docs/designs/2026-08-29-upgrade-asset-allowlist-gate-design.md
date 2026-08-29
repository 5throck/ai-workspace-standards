# Design: Project Asset Allowlist Gate in upgrade-project + .bat nul-lint Exemption

- **Date**: 2026-08-29
- **Status**: Implemented
- **Related**: docs/designs/2026-08-29-skill-graph-generator-upstream-design.md, ADR-0031 (L1/L2 fork model)

## Problem

During the 2026-08-29 Projects/co-* upgrade wave to template 0.6.0, two systemic
defects surfaced:

1. **Ungated add-if-missing of new common assets.** `upgrade-project.ts`'s
   SYNC_IF_NEWER passes copied brand-new common assets into every project
   regardless of the project's own asset registry. The 0.6.0 i18n wave
   (`i18n-specialist` agent, `i18n-audit` skill) landed in projects whose
   variant rosters never registered them, tripping each project's
   `audit-variant.ts` (skill allowlist violation in co-deck; agent parity
   failure in co-architect; governance-record-missing validation error in
   co-abap-plugin) on the project's very next audit.
2. **nul-redirect lint false positive on .bat.** `audit.ts`'s banned `> nul`
   check scanned `.bat`/`.cmd` files, where `>nul` is the idiomatic cmd.exe
   redirect to the NUL *device* — safe by construction. The literal-file hazard
   only exists in POSIX shells. co-architect's `setup.bat` (5 legitimate
   `>nul` redirects) was flagged, blocking its `/sync`.

## Decision

### 1. Asset allowlist gate (upgrade-project.ts 1.15.0 → 1.16.0)

Before SYNC_IF_NEWER add-if-missing copies a **brand-new** common asset, the
project's own `variant.json` is consulted:

| Asset | Registry consulted | Gate |
|-------|--------------------|------|
| Common skill (skills/) | `skill_manifest.allowlist` | NEW copies skipped when slug not allowlisted |
| Common agent (agents/) | `agents[].file` | NEW copies skipped when file not registered |

Semantics:
- **Existing project files stay ungated** — registration is only consulted for
  brand-new additions; version updates to already-present assets proceed as before.
- The **VARIANT SKILLS pass is exempt** — `templates/<variant>/skills/` is the
  authority for variant-owned skills by construction.
- Projects **without variant.json** (e.g. standalone L3 projects) keep the
  ungated behavior; invalid JSON also degrades to ungated (gate must never
  break upgrades).
- Skips are logged: `SKIP (not in variant.json skill allowlist / agent registry)`.

### 2. nul-redirect lint scope (audit.ts 2.27.0 → 2.28.0)

`.bat`/`.cmd` removed from `LINT_EXTS`. The `nul-lint-ignore` escape hatch
remains for exceptional cases in any language.

## Consequences

- Future template waves can ship new common assets without breaking
  non-adopting projects' audits; adoption becomes an explicit per-variant
  decision (add to `variant.json`, then upgrade).
- Windows batch setup scripts no longer need lint-ignore comment noise.
- Registry hygiene: `validate-procedures.ts` row added to
  `templates/common/scripts/SCRIPTS.md` (layer `L0+L1` — it ships to projects
  via the PROCEDURES SYNC pass; the missing row was tripping lifecycle Check B).

## Verification

- `bun scripts/upgrade-project.ts Projects/co-deck --dry-run`:
  `SKIP (not in variant.json skill allowlist): skills/i18n-audit/SKILL.md` while
  allowlisted `i18n-formatting` etc. still update.
- `bun scripts/upgrade-project.ts Projects/co-architect --dry-run`:
  `SKIP (not in variant.json agent registry): agents/i18n-specialist.md`.
- `bun scripts/audit.ts`: all checks pass (setup.bat no longer flagged).
- `bun scripts/lifecycle-sync-audit.ts`: all checks pass.

## Trade-offs

- Projects wanting a new common asset must add it to their `variant.json`
  allowlist before upgrading — one-line, explicit, and matches how
  `audit-variant.ts` already defines legitimacy.
- Standalone projects without variant.json remain ungated; acceptable because
  they have no allowlist audit to violate.
