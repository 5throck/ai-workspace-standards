# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Missing Scripts in New Project Templates — Detection and Deployment Policy Reform
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

A newly scaffolded project failed on `/sync` because `scripts/sync-md.ts` was not present in `templates/common/scripts/`. Investigation revealed two missing scripts and a systemic policy gap.

## Pre-Meeting Data

| Script | In scripts/ | In templates/common/scripts/ | SCRIPTS.md marker | Callers in templates/common |
|--------|:-----------:|:----------------------------:|-------------------|-----------------------------|
| `sync-md.ts` | ✅ | ❌ | `intentional` | `dev-sync.ts` line 51 |
| `verify-readme-sync.ts` | ✅ | ❌ | L1 (no marker) | `hooks/pre-commit.ts`, `translate-readme.ts`, `skills/translate/SKILL.md` |

---

## Transcript

**[Architect]**: (Round 1)

Pre-meeting data shows exactly 2 scripts present in workspace root but missing from templates/common: sync-md.ts (marked "intentional" but called by L1 dev-sync.ts) and verify-readme-sync.ts (marked L1 in SCRIPTS.md but not in templates/common). Three structural problems: (1) "intentional" marker ignores call relationships — if sync-md.ts is L0-only, dev-sync.ts must also be L0-only, but it isn't; (2) L1 registration in SCRIPTS.md does not guarantee actual deployment to templates/common; (3) audit.ts did not detect this inconsistency. Asked automation-engineer why checkScriptSync() missed these cases.

**[Automation Engineer]**: (Round 1)

checkScriptSync() missed the cases for two reasons: (1) files marked "intentional" in SCRIPTS.md are excluded from drift detection; (2) only file existence is checked, not dependency chains. sync-md.ts was skipped due to "intentional" flag. verify-readme-sync.ts was missed because checks run root→common direction only, not common→SCRIPTS.md registration direction. Root cause: no dependency graph tracking. Proposed: if A calls B, B must exist in A's deployment layer. Asked lifecycle-manager about the original design intent of the "intentional" column.

**[Lifecycle Manager]**: (Round 1)

"Intentional" was designed to skip drift checks for workspace-management-only scripts (like validate-templates.ts) that should not be in L1. However, the meaning was never documented, and sync-md.ts was incorrectly marked. Proposed 3-category classification to replace "intentional": (1) no marker = L0+L1 common (must exist in both); (2) L0-only = workspace management only, must not be called from templates/common; (3) L1-only = generated project only, must exist in templates/common. Asked auditor how audit.ts can enforce this.

**[Auditor]**: (Round 1)

Proposed Check X for audit.ts/lifecycle-sync-audit.ts: for each script in SCRIPTS.md, enforce: L0+L1 (no marker) = FAIL if missing from either location; L0-only = FAIL if called from templates/common (dependency scan via grep patterns); L1-only = FAIL if missing from templates/common. Prerequisite: SCRIPTS.md column values must be redefined as clear enum before Check X logic can be written.

**[Architect]**: (Round 2)

Prioritized solution: (1) Immediate hotfix — copy sync-md.ts and verify-readme-sync.ts to templates/common/scripts/; (2) Policy reform — replace "intentional" with 3-category enum, reclassify existing entries (audit.ts, dev-sync.ts → common; sync-md.ts → common after copy); (3) Automation — Check X in lifecycle-sync-audit.ts; (4) Documentation — add column definition header to SCRIPTS.md.

**[Automation Engineer]**: (Round 2)

Check X dependency scan patterns: grep for `bun run scripts/<name>`, `bun scripts/<name>`, `import.*<name>` across all templates/common/scripts/ files. If L0-only script matches any pattern → FAIL. Additional proposal: smoke test in test-new-project.ts — after scaffolding, run dev-sync.ts and verify exit code 0. This catches runtime failures that static analysis misses.

**[Lifecycle Manager]**: (Round 2)

Smoke test is the final defense layer — catches issues that slip through policy and audit checks. Also flagged: lifecycle-sync-audit.ts Check B (SCRIPTS.md ↔ templates/common version match) likely checks version numbers only, not file existence. This is why verify-readme-sync.ts (registered in SCRIPTS.md as L1) was not detected as missing from templates/common. Check B needs existence verification too — should be confirmed during Check X implementation.

---

## Immediate Breaking Issues

| Script | Problem | Fix |
|--------|---------|-----|
| `sync-md.ts` | Missing from templates/common, called by dev-sync.ts | Copy to templates/common/scripts/ |
| `verify-readme-sync.ts` | Missing from templates/common, called by pre-commit.ts + translate-readme.ts + SKILL.md | Copy to templates/common/scripts/ |

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | High | Copy `sync-md.ts` + `verify-readme-sync.ts` to `templates/common/scripts/`; add version entries to both SCRIPTS.md files | Immediate hotfix |
| A-02 | lifecycle-manager | Medium | Redefine SCRIPTS.md layer column: replace `intentional` with `L0-only`/`L1-only`/common(no marker); reclassify all existing entries; add column definition header | After A-01 |
| A-03 | automation-engineer | Medium | Add Check X to `lifecycle-sync-audit.ts`: L0-only reference scan + L1-only deployment check | After A-02 |
| A-04 | automation-engineer | Low | Add smoke test to `test-new-project.ts`: run `dev-sync.ts` in newly scaffolded project, verify exit 0 | After A-01 |
| A-05 | auditor | Medium | Verify `lifecycle-sync-audit.ts` Check B: confirm if it checks file existence (not just version numbers); patch if needed | After A-03 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | New project `/sync` completes without error | Create new project, run dev-sync.ts |
| C-02 | L0-only reference violation detected by lifecycle-sync-audit.ts | Intentional violation test |
| C-03 | SCRIPTS.md column definition documented | File header check |
| C-04 | `bun scripts/audit.ts` passes | Run audit |
