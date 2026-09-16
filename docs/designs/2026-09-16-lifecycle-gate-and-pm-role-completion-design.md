---
schemaVersion: 1.0.0
spec-id: lifecycle-gate-and-pm-role-completion
---

# Lifecycle Gate and PM Role Completion — Wave 5, 2026-09-16

## 1. Overview

Lands the FINAL wave (three tickets, one batch) of the 2026-09-15
template-fleet review remediation
(docs/reports/2026-09-15-project-review-template-fleet.md):

- **T-20260915-008 (M2)** — `skills/upgrade-project/SKILL.md` pinned
  v1.23.0 behavior while the script is v1.28.0; the behavior sections
  are rewritten and distributed to the platform mirrors via
  `sync-skills.ts`.
- **T-20260915-012 (M12/M13)** — stale L1-only agent exclusions are
  dropped and `DEFAULT_PM_ROLE_DESCRIPTIONS` is completed from 5 to
  all 13 variants, with unit tests pinning both invariants.
- **T-20260915-009 (M6)** — the three script lifecycle records get a
  Version-field convention and a new audit gate (**Check H** in
  `scripts/lifecycle-sync-audit.ts`) so script record versions cannot
  silently lapse again.

## 2. Problem

1. **M2 — skill doc lags script behavior.** SKILL.md documented the
   script at v1.23.0; v1.24.0–v1.28.0 added the graft fleet surface,
   docs/context.md project-only preservation (`--force-context-sync`),
   the root-target guard, `stash -u` rollback, pre-scan conflict
   semantics, and the honest exit-code set. An operator following the
   skill missed flags and misread rollback guarantees.
2. **M12 — dead exclusions mask drift.**
   `NEW_PROJECT_L1_ONLY_AGENTS` listed `agents/lifecycle-manager.md`
   and `agents/pm.md.backup`, neither of which exists under
   `templates/common/agents/` — the exclusion loop could never fire,
   and a future real L1-only agent added next to dead entries would
   silently ship.
3. **M13 — 8 of 13 variants render a generic PM fallback.**
   `DEFAULT_PM_ROLE_DESCRIPTIONS` covered co-develop, co-consult,
   co-security, co-design, co-work; co-abap, co-deck, co-export,
   co-game, co-hr, co-news, co-price, co-safety fell through to
   `'Workflow management, dispatch, quality gates'` in every scaffolded
   context.md.
4. **M6 — script record versions lapsed silently.** The three
   `docs/lifecycle/scripts/*.md` records carry phase-history narrative
   the SCRIPTS.md rows do not, but nothing tied their `**Version**`
   fields to reality: new-project.md still said 1.10.0 (script is
   1.18.0), and the other two records had no Version field at all.

## 3. Decisions

### 3.1 T-008: SKILL.md refresh scope

Frontmatter structure kept; `version` 1.4.1 → 1.5.0 (minor);
`last_reviewed` 2026-09-16. Behavior sections rewritten against the
v1.28.0 source: usage line and Arguments table gain `--yes`,
`--skip-context-commonization`, `--force-context-sync`; the category
table gains CONTEXT_COMMONIZATION (thresholds 0.65/0.30, managed-zone
exclusions, dry-run parity) and GOVERNANCE FILES SYNC (strictly
add-if-missing LICENSE/SECURITY.md) rows; the TEMPLATE TREE SYNC row
gains the v1.24.0 `ADD_IF_MISSING`/graft and `.mcp.json`/
`opencode.json` JSON_MERGE surfaces; the marker table gains
COMMON-CONTEXT (v1.26.0) plus a keyed-vs-positional matching note;
Safety Mechanisms rewritten for `stash -u` rollback, pre-scan conflict
semantics, honest exit codes, the root-target guard, and apply-only
bootstrap verification; the docs/context.md section now describes
CONTEXT PRESERVE / `--force-context-sync` (v1.25.0) instead of the
stale "reports a CONFLICT" wording; Rollback shows `--rollback` (exit
1 on failure) beside the manual `git stash pop`.

Distribution: `bun scripts/sync-skills.ts` refreshes the .claude/
.gemini/.agents (+ .codex) mirrors from the SSOT — mirrors are never
hand-edited. Governance ripples kept green: skills/SKILLS.md row,
docs/VERSION_MANIFEST.md row, and the skill lifecycle record
(docs/lifecycle/skills/upgrade-project.md — Version, Last Updated,
Phase History row, dependency note) move to 1.5.0 in the same batch;
Check E would otherwise fail on record-vs-frontmatter drift.

### 3.2 T-012: constant completion and derivation method

**M12 outcome — constant kept, stale entries dropped.**
`agents/_COMMON.md` (the shared-sections include that copies but must
not ship) exists, so per the ticket rule the constant stays with only
the resolving entry. The consumption logic (new-project.ts removal
loop + `deriveNewProjectDelivery` filter) handles a short list
unchanged; removing the constant entirely would churn two consumers
for no behavioral gain.

**M13 derivation method.** Each description is a one-line,
three-phrase role summary in the style of the existing five entries,
derived from the variant's actual PM role:

- Variants whose `templates/co-<x>/agents/pm.md` carries inline
  `variant_overrides` (co-export, co-hr, co-news, co-price, co-safety):
  the phrases quote the override's own governance model ("Trade
  Engagement Leader", "Editor-in-Chief newsroom model", "safety
  governance … legal_basis evidence gates", etc.).
- Variants whose pm.md is a pure extends stub (co-abap, co-deck,
  co-game): derived from the variant AGENTS.md roster plus the
  workflow/pipeline sections of `docs/<variant>.context.md` (co-abap
  module analysts + CTS transport/QA chain; co-deck stage-gated deck
  pipeline ending in pdf-export; co-game genre-based dispatch +
  test/debug loop).

Descriptions (verbatim):

| Variant | Description | Derived from |
|---------|-------------|--------------|
| co-abap | SAP ABAP delivery orchestration, module analysis dispatch, transport and QA gates | pm.md stub → AGENTS.md §1 roster (SD/MM/FI/CO analysts) + context.md Development Workflow (/post-write QA chain, /transport, Stage ownership) |
| co-deck | Deck pipeline orchestration, stage gate approvals, export readiness | pm.md stub → context.md pipeline order (version → research → … → html-build → measure → pdf-export) + manual gate-based workflow (approval gates at stages 2, 3, 5) |
| co-export | Trade engagement coordination, compliance approval gates, final sign-off | pm.md variant_overrides (Trade Engagement Leader; Phase 2 compliance approval; PM synthesis + compliance sign-off) |
| co-game | Game pipeline orchestration, genre-based dispatch, test and debug gates | pm.md stub → context.md Agent Dispatch Order + Genre-Based Dispatch + Workflow Phases |
| co-hr | HR engagement coordination, people-domain dispatch, client approval gates | pm.md variant_overrides (HR engagement governance model; dispatch by people-domain; client approval gates for people decisions) |
| co-news | Newsroom pipeline gating, editorial approval, publication readiness | pm.md variant_overrides (Editor-in-Chief model; fact-checking + style approval before shipping) |
| co-price | Pricing engagement governance, method dispatch, executive synthesis | pm.md variant_overrides (pricing-engagement governance; dispatch by pricing method; executive-ready synthesis) |
| co-safety | Safety governance, regulatory evidence gates, deliverable closeout approval | pm.md variant_overrides (safety-governance model; legal_basis evidence gates; PM closeout approval) |

The map is alphabetized; the generic fallback string never appears as
a value. A new unit test suite
(`tests/unit/variant-pm-roles.test.ts`) asserts the M13 keys ≡
`deriveCoVariantDirs(templates/)` (wave-3 derivation, the same set
PM-03 consumes) and the M12 "every entry resolves" invariant
(an explicitly-empty constant would also satisfy the drift-mask rule;
the resolution test accepts only existing paths or nothing).

### 3.3 T-009: GATE, not retire — adjudication and check design

PM adjudication (2026-09-16): the 3 records STAY — they carry
phase-history narrative (per-version reason/approver rows) that
SCRIPTS.md rows do not; SCRIPTS.md remains the script lifecycle SSOT
for registry data. The lapse class gets a gate instead.

**Version-field convention**: `- **Version**: X.Y.Z` in the record's
Metadata section, mirroring the skill-record convention Check E
validates (same `extractRecordField` extraction; Metadata moved to the
top of each script record to mirror the skill-record layout;
new-project.md's duplicate Metadata sections merged into one).

**Check H** (`scripts/lifecycle-sync-audit.ts`, next letter after
Check G; version 1.13.0 → 1.14.0; `checksRun` 9 → 10):

- For every `docs/lifecycle/scripts/<name>.md`, resolve the subject
  script: exact `scripts/<name>.ts` registry row first, then an
  unambiguous basename match for sub-path rows (`error-handling.md` →
  `lib/error-handling.ts`). Version source = the SCRIPTS.md row — the
  same source Check A validates each `@version` header against.
- Declared Version ≠ resolved version → **ERROR**. Missing Version
  field → **WARNING** (Check E's missing-field semantics: records
  predating the convention stay advisory, with a backfill fix hint).
- Records are opt-in: no record for a script reports nothing; a record
  with no resolvable version source (removed/unregistered script) is
  not this check's concern. Detection-only.
- The pure comparison helper `compareScriptRecordVersion()` is
  exported for unit tests (agreement → null incl. `v`-prefix
  tolerance; mismatch → error; missing → warning).

**Backfill (2026-09-16)**: all 3 records get the Version field plus a
Phase History catch-up row —
`| 2026-09-16 | production | production | Version sync gate landed (lifecycle-sync-audit Check H); record caught up to SCRIPTS.md SSOT v<x> | pm |`
— with `<x>` = 1.4.0 (`lib/error-handling.ts`), 1.18.0
(`new-project.ts`), 0.3.1 (`validate-pm-extends.ts`).

**Negative test**: unit tests pin the helper semantics and live parity;
a live probe (corrupt new-project.md Version to 9.9.9) produced
`Check H: … Version 9.9.9 does not match the script's SCRIPTS.md entry
1.18.0` and audit exit 1, reverted green.

## 4. Version bumps (minor — all three surfaces per batch convention)

| File | Version | Surfaces |
|------|---------|----------|
| `scripts/lifecycle-sync-audit.ts` | 1.13.0 → 1.14.0 | `@version` + header changelog + Check H in header check-list; L0 + L1 SCRIPTS.md rows |
| `scripts/helpers/template-utils.ts` | 1.1.1 → 1.2.0 | `@version` + header changelog; L0 + L1 SCRIPTS.md rows |
| `scripts/helpers/scaffold-markers.ts` | 1.0.0 → 1.1.0 | `@version` + header changelog; L0 + L1 SCRIPTS.md rows |
| `skills/upgrade-project/SKILL.md` | 1.4.1 → 1.5.0 | frontmatter `version` + `last_reviewed: 2026-09-16`; skills/SKILLS.md row; docs/VERSION_MANIFEST.md row; skill lifecycle record; platform mirrors via sync-skills only |
| `tests/unit/lifecycle-sync-checks.test.ts` | 1.0.0 → 1.1.0 | header version + changelog |
| `tests/unit/variant-pm-roles.test.ts` | 1.0.0 (new) | — |

L0→L1 propagation runs via `bun scripts/propagate-to-templates.ts
--apply` before the sync-time spec-check gate (the scripts domain
carries the L1 mirrors of all three modified scripts).

## 5. Test plan

- `tests/unit/variant-pm-roles.test.ts` (new): M13 map keys ≡
  `deriveCoVariantDirs` set; no generic-fallback values; pm.md source
  existence per key; M12 entry resolution + stale-entry absence.
- `tests/unit/lifecycle-sync-checks.test.ts` (extended, not rewritten):
  `compareScriptRecordVersion` agreement/mismatch/missing semantics
  (incl. `v`-prefix); live Check H parity; the 3 records' Version
  fields pinned to 1.4.0 / 1.18.0 / 0.3.1; upgrade-project Check E
  fixture 1.4.1 → 1.5.0.
- Negative live probe: corrupt → exit 1 with Check H ERROR → revert →
  green (executed during implementation, 2026-09-16).

## 6. Accessibility

Backend/CLI-only work (script behavior-doc refresh, scaffold
constants, an audit check, lifecycle records, and unit tests). No
user-facing UI is produced. Exempt from ADR-0065 WCAG scope; the
WCAG 2.1 AA baseline does not apply.

## 7. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed
validation battery (unit suite, validate-templates, typecheck, audit,
scripts suite, lifecycle-sync-audit, review-baseline, sync-skills).
