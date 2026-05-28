# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Resolution of open items from comprehensive review — audit.sh thin wrapper sequence and agents/README standardization
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Follow-up to meeting-2026-05-29-comprehensive-review.md. Two open items:
1. `audit.sh`/`audit.ps1` thin wrapper conversion feasibility — `dev-sync.ts` calls `bash scripts/audit.sh` directly (line 111)
2. `co-security/agents/README.md` standardization — all 4 variants confirmed to have both `agents/README.md` and `agents/README_ko.md`

---

## Transcript

**PM**: (Opening)

Pre-meeting fact verification results:
- `dev-sync.ts` line 111: calls `bash scripts/audit.sh` directly
- All 4 variants (co-develop, co-work, co-design, co-security) have `agents/README.md` and `agents/README_ko.md`

Round 1: agents/README standardization — confirm and formalize as policy.
Round 2: audit.sh thin wrapper — analyze impact of `dev-sync.ts` dependency and determine correct conversion sequence.

---

**Auditor**: (Round 1)

Current state has no issues — all 4 variants already have `agents/README.md` and `README_ko.md`. Item is resolved as a factual matter. However, this is "accidental consistency" not "policy-enforced consistency." If `validate-templates.ts` does not check for `agents/README.md`, a future new variant could omit it without any automated detection.

Question to architect: Should `agents/README.md` be added to VARIANT_CONTRACT.md as a required file?

---

**Architect**: (Round 1)

Yes — `agents/README.md` should be mandatory in VARIANT_CONTRACT.md. This file is the variant-level agent roster guide, equivalent to workspace-root `AGENTS.md`. Users encountering a variant for the first time rely on this file to understand what agents exist. It belongs in the required file list alongside `README.md`, `AGENTS.md`, and `variant.json`.

Additionally, `validate-templates.ts` `checkAgents()` function should be extended to verify `agents/README.md` and `agents/README_ko.md` existence.

Question to automation-engineer: Where in `validate-templates.ts` does this check belong, and how does it connect to VARIANT_CONTRACT.md parsing?

---

**Automation-Engineer**: (Round 1)

The check belongs in `checkAgents()` — agents directory README is part of agent structure validation. After confirming `agents/` directory exists, add checks for `agents/README.md` and `agents/README_ko.md`. The implementation scope depends on whether `validate-templates.ts` dynamically parses VARIANT_CONTRACT.md or uses hardcoded checks — needs verification before implementation. Action is straightforward; confirm and proceed to Round 2.

---

**PM**: (Round 1 — Close)

Item 2 resolved with policy upgrade decision: VARIANT_CONTRACT.md + `validate-templates.ts` to formalize existing consistent state. Actions assigned to automation-engineer.

Round 2: audit.sh thin wrapper. Question to automation-engineer: What does `dev-sync.ts` calling `bash scripts/audit.sh` mean for the thin wrapper conversion, and what is the correct conversion path?

---

**Automation-Engineer**: (Round 2)

Current call chain:
```
dev-sync.ts (line 111) → bash scripts/audit.sh → [full audit logic]
dev-sync.ts (line 110) → powershell audit.ps1 → [full audit logic] (Windows)
```

If `audit.sh` becomes a thin wrapper:
```
dev-sync.ts → audit.sh (3 lines) → audit.ts
```
This creates `dev-sync.ts → shell → ts` — inefficient and asymmetric.

Correct 2-step approach:
- **Step 1 (prerequisite)**: Change `dev-sync.ts` to call `bun run scripts/audit.ts` directly, removing the shell dependency. Result: `dev-sync.ts → audit.ts` (platform-independent)
- **Step 2 (after Step 1)**: Convert `audit.sh`/`audit.ps1` to thin wrappers safely, as `dev-sync.ts` no longer depends on them

Question to auditor: Does `audit.ts` currently implement all the same checks as `audit.sh`, including the recently added command parity check?

---

**Architect**: (Round 2)

Agree with 2-step approach but add a mandatory **Step 0**: run `audit.sh` and `audit.ts` side-by-side and compare results. The recently added `check_command_parity()` in `audit.sh` may not exist in `audit.ts`. Equivalence cannot be assumed without verification.

For SCRIPTS.md: after thin wrapper conversion, `audit.sh`/`audit.ps1` should retain `drift: intentional` (L1 propagation not needed) and add `status: deprecated`.

---

**Auditor**: (Round 2)

Step 0 is required QA, not optional. Verification protocol:
1. Run `bash scripts/audit.sh` → capture stdout
2. Run `bun scripts/audit.ts` → capture stdout  
3. Compare PASS/FAIL item lists
4. Identify gaps → supplement `audit.ts` before proceeding

The command parity check (`check_command_parity`) added to `audit.sh` is the primary risk — whether `audit.ts` implements this is unknown without inspection.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| B-01 | automation-engineer | Equivalence verification: run `audit.sh` vs `audit.ts` side-by-side, compare all check items including command parity check | Step 0 (immediate) |
| B-02 | automation-engineer | Update `dev-sync.ts` lines 109-111: replace `bash scripts/audit.sh` / `powershell audit.ps1` with `bun scripts/audit.ts` | Step 1 (after B-01) |
| B-03 | automation-engineer | Convert `audit.sh`/`audit.ps1` to thin wrappers + set SCRIPTS.md `deprecated`, removal-date `2026-08-29` | Step 2 (after B-02) |
| B-04 | automation-engineer | Add `agents/README.md`, `agents/README_ko.md` to VARIANT_CONTRACT.md required files list | Immediate |
| B-05 | automation-engineer | Add `agents/README.md`/`README_ko.md` existence check to `validate-templates.ts` `checkAgents()` | Immediate |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `audit.ts` and `audit.sh` produce identical PASS/FAIL results on the same workspace | Side-by-side execution output comparison |
| C-02 | `dev-sync.ts` calls `bun scripts/audit.ts` directly, no shell dependency | Code inspection of `dev-sync.ts` lines 109-111 |
| C-03 | `audit.sh`/`audit.ps1` are 3-line thin wrappers delegating to `audit.ts` | File content check (line count ≤ 5) |
| C-04 | VARIANT_CONTRACT.md lists `agents/README.md` and `agents/README_ko.md` as required | Manual doc review |
| C-05 | `validate-templates.ts` reports error when `agents/README.md` is absent | Test with a variant missing the file |
