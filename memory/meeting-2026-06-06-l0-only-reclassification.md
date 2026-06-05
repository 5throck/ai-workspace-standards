# Meeting Transcript
**Date**: 2026-06-06
**Topic**: L0-only Misclassification — audit.ts, dev-sync.ts, dispatch, qa-gate Layer Correction
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background

PM pre-meeting investigation found:
- `audit.ts`: dual-mode script — detects L0 vs L2 via `CONSTITUTION.md` + `docs/context.md`. Line 685: `const IS_WORKSPACE_ROOT = fs.existsSync('CONSTITUTION.md') && !fs.existsSync('variant.json');`
- `dev-sync.ts`: dual-mode — `isL0Context = fs.existsSync('CONSTITUTION.md')`. L0→L1 publish step skipped in L2 context.
- `.claude/commands/sync.md` calls `bun scripts/dev-sync.ts ""` directly — L2 projects with no `dev-sync.ts` fail on `/sync`
- `dispatch-parallel.ts` / `dispatch-serial.ts`: generic dispatchers, no workspace-specific logic
- `qa-gate.ts`: calls `bun scripts/audit.ts`, generic QA gate
- `dev-sync.sh`: deprecated wrapper calling `dev-sync.ts`, removal date 2026-08-29

Logical inconsistency: L0-only scripts that are actually needed in L2 projects and were designed with dual-mode context detection.

---

## Transcript

### Round 1

**architect** (Round 1):
Confirmed all evidence: `audit.ts` line 685 proves dual-mode design intent from the start. `dev-sync.ts` `isL0Context` detection skips L0-only steps cleanly. These are classification errors, not design gaps. `dispatch-parallel/serial.ts` have no workspace-specific logic — L2 PMs need multi-agent dispatch.

**automation-engineer** (Round 1):
Confirmed `.claude/commands/sync.md` calls `dev-sync.ts` directly — L2 projects fail `/sync` without it. Confirmed `qa-gate.ts` calls `audit.ts` — L2 QA gate broken without both. Listed 5+1 reclassification targets. Asked lifecycle-manager about `dev-sync.sh` removal after `dev-sync.ts` becomes L0+L1+L2.

**lifecycle-manager** (Round 1):
Confirmed `dev-sync.sh` removal date is 2026-08-29 — cannot remove early (governance violation). Once `dev-sync.ts` is in L2, `dev-sync.sh` wrapper still functional until removal date. Flagged `fix-script-versions.ts` for review.

**auditor** (Round 1):
Confirmed `fix-script-versions.ts` is workspace-operator-only — L0 correct. Analyzed three dispatch scripts: `dispatch.ts` (single agent), `dispatch-parallel.ts` (independent parallel tasks), `dispatch-serial.ts` (sequential dependent tasks). L2 PMs need all three for orchestration. L0-only was a classification mistake, same pattern as audit.ts/dev-sync.ts.

---

### Round 2

**architect** (Round 2):
Defined true L0-only (5 scripts): `create-l2-scaffold.ts`, `l2-to-variant-pipeline.ts`, `publish-to-template.ts`, `validate-templates.ts`, `fix-script-versions.ts`. All others reclassified. After reclassification, `Projects/safety-os/` having these files becomes legitimate, not a leak.

**automation-engineer** (Round 2):
Confirmed no code changes needed — SCRIPTS.md value change automatically propagates through `parseTier3ExclusionsFromScriptsMd()` in `create-l2-scaffold.ts`. `publish-to-template.ts` rerun adds files to L1. `new-project.sh` exclusion list needs full audit (`verify-readme-sync.ts` incorrectly excluded).

**lifecycle-manager** (Round 2):
Confirmed implementation plan is correct. Flagged `Projects/safety-os/` needs drift check — files may be older versions than current L0. Flagged `new-project.sh` exclusion list needs full audit.

**auditor** (Synthesis):
See Action Items.

---

## Decisions

| Item | Decision |
|------|----------|
| `audit.ts` | L0-only → **L0+L1+L2** (dual-mode, L2 audit essential) |
| `dev-sync.ts` | L0-only → **L0+L1+L2** (dual-mode, /sync command essential) |
| `dispatch-parallel.ts` | L0-only → **L0+L1+L2** (generic dispatcher, L2 multi-agent) |
| `dispatch-serial.ts` | L0-only → **L0+L1+L2** (generic dispatcher, L2 sequential workflow) |
| `qa-gate.ts` | L0-only → **L0+L1+L2** (calls audit.ts, L2 QA gate) |
| `team-builder.ts` | L0-only → **L0+L1+L2** (previously confirmed by user) |
| True L0 (5) | `create-l2-scaffold.ts`, `l2-to-variant-pipeline.ts`, `publish-to-template.ts`, `validate-templates.ts`, `fix-script-versions.ts` |
| `dev-sync.sh` | Keep until removal-date 2026-08-29 (governance) |
| `Projects/safety-os/` files | No longer leaks — legitimate files after reclassification |

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| G-01 | automation-engineer | Low | SCRIPTS.md — reclassify `audit.ts`, `dev-sync.ts`, `dispatch-parallel.ts`, `dispatch-serial.ts`, `qa-gate.ts`, `team-builder.ts` from `L0-only` to `L0+L1+L2` | L0-only | 4 |
| G-02 | automation-engineer | Low | Run `publish-to-template.ts` — add 6 newly classified L0+L1+L2 scripts to `templates/common/scripts/` | L0-only | 4 |
| G-03 | automation-engineer | Low | Audit and fix `new-project.sh` exclusion list — remove incorrectly excluded scripts (e.g. `verify-readme-sync.ts`) | L0-only | 4 |
| G-04 | lifecycle-manager | Medium | Verify `Projects/safety-os/` drift — confirm 5 reclassified files match current L0 versions | L0-only | 4 |
