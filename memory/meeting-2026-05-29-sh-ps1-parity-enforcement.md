# Meeting Transcript
**Date**: 2026-05-29
**Topic**: .sh/.ps1 pair mismatch root cause and automated enforcement design
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

Pre-meeting audit findings:
- `.githooks/post-checkout` and `.githooks/pre-commit` have no `.ps1` counterpart
- `scripts/test-new-project.ps1` has no `.sh` counterpart
- `audit.ts` parity check is **Warn only** (does not block commits)
- Parity check is unidirectional: `.sh` → `.ps1` only; `.ps1` → `.sh` not checked
- `.githooks/` directory is not included in any parity check

---

## Transcript

### Round 1 — Root Cause Diagnosis

**Architect**: (Round 1)

Root cause: parity rules are scattered across three locations (SCRIPTS.md doc, audit.ts warn, validate-templates.ts error) with inconsistent enforcement levels. No single authoritative check exists.

Scope is undefined: `.githooks/` parity requirement never specified. Development/test scripts (`test-*`) never classified.

**Auditor**: (Round 1)

Warn-only was likely chosen early to avoid breaking CI when `.sh`-only scripts existed. Result: violations accumulated silently.

Two gaps: (1) only `.sh`→`.ps1` direction checked, not reverse; (2) `.githooks/` excluded from all checks.

Escalation to error is justified: missing pair = functional failure for users on the other OS. Intentional exceptions need an explicit opt-out mechanism.

**Automation-engineer**: (Round 1)

Full mismatch inventory:
- `.githooks/post-checkout` — no `.ps1`
- `.githooks/pre-commit` — no `.ps1`
- `scripts/test-new-project.ps1` — no `.sh`, not in SCRIPTS.md registry

`test-new-project.ps1`: `test-` prefix, not registered → development temporary file.

`.githooks/` policy question: Claude Code and Antigravity assume Git Bash on Windows, so missing `.ps1` hooks are not immediate failures. Policy decision needed.

---

### Round 2 — Fix Design

**Architect**: (Round 2)

Three categories:

**Category A — Pair required (Fail)**:
- `scripts/` Tier 1 `.sh`↔`.ps1` (bidirectional)

**Category B — Pair recommended (Warn)**:
- `.githooks/` hook ↔ `.ps1` — Git Bash assumed on Windows, so not immediate failure

**Category C — Pair exempt**:
- `scripts/` Tier 2 `.ts` files (platform-neutral via Bun)
- `test-*` prefix scripts
- SCRIPTS.md entries with `pair: skip`

**Auditor**: (Round 2)

audit.ts changes needed:
1. `.sh`↔`.ps1` bidirectional Fail (skip `test-*` prefix)
2. `.ps1`→`.sh` reverse direction added
3. `.githooks/` parity added as Warn

`test-new-project.ps1`: delete (unregistered, no `.sh` pair).

**Automation-engineer**: (Round 2)

Implementation order:
1. Delete `test-new-project.ps1` immediately
2. Update `audit.ts` with bidirectional Fail + githooks Warn
3. Document "Windows: Git Bash required" policy for `.githooks/` warn suppression
4. Long-term: create `.ps1` versions of complex hooks

---

## Action Items

| # | Owner | Deliverable | Tier | Model |
|---|-------|-------------|------|-------|
| S-01 | automation-engineer | Delete `scripts/test-new-project.ps1` | Low | haiku |
| S-02 | automation-engineer | `audit.ts`: upgrade `.sh`↔`.ps1` to bidirectional Fail; add `.ps1`→`.sh` reverse check; exclude `test-*` | Medium | sonnet |
| S-03 | automation-engineer | `audit.ts`: add `.githooks/` pair Warn check | Medium | sonnet |
| S-04 | docs-writer | Add "Windows: Git Bash required" policy to CLAUDE.md and GEMINI.md | Low | haiku |
| S-05 | auditor | After S-01~S-04: run `bun run audit` and confirm pass | Medium | sonnet |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `scripts/test-new-project.ps1` does not exist | `ls scripts/test-new-project.ps1` returns not found |
| AC-02 | `audit.ts` fails when `.sh` exists without `.ps1` (excluding `test-*`) | Test with dummy `.sh` file |
| AC-03 | `audit.ts` fails when `.ps1` exists without `.sh` (excluding `test-*`) | Test with dummy `.ps1` file |
| AC-04 | `audit.ts` warns (not fails) when `.githooks/hook` has no `.ps1` | Check audit output |
| AC-05 | `bun run audit` passes after all changes | Script output |

## Policy Decisions

| Decision | Rationale |
|----------|-----------|
| scripts/ Tier 1: bidirectional Fail | Missing pair = functional failure on opposite OS |
| .githooks/: Warn only | Claude Code + Antigravity assume Git Bash on Windows; not immediate failure |
| test-* exempt from parity | Development scripts, not production artifacts |
| pair: skip in SCRIPTS.md | Explicit opt-out for intentional single-platform scripts |
