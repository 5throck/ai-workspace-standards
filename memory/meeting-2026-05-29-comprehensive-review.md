# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Comprehensive review — co-security addition, lifecycle governance, 2-Tier script strategy
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**PM**: (Opening)

Called this meeting for a comprehensive review of three major changes completed in recent sessions: (1) co-security variant addition, (2) 5-domain × 3-layer lifecycle governance infrastructure, (3) shell → TypeScript 2-Tier script strategy transition.

Round 1: co-security structural completeness + lifecycle governance actual application state.
Round 2: 2-Tier script transition state — shell wrapper residuals and SCRIPTS.md integrity.

---

**Architect**: (Round 1)

**co-security structural completeness**: The structure is substantially complete — `variant.json` (status: beta, v0.2.0), `agents/` (pm + 5 specialists), `skills/` (4 including verify-authorization), `AGENTS.md`, `README.md`/`README_ko.md`, `.claude/commands/` and `.gemini/commands/` both platforms. However, `co-security/agents/` contains `README.md` and `README_ko.md` — it's unclear whether other variants (co-develop, co-work, co-design) have the same, raising a standardization question.

**Lifecycle governance actual state**: The 5-domain policy is documented in `lifecycle-governance.json`, but detection tool coverage has gaps. `audit.sh` checks 4 domains at L0. `validate-templates.ts` checks variant/agent/skill/readme at L1. L2 projects' script and readme domains are marked `"currentStatus": "gap"` — intentional design but not explicitly communicated to users.

Question to automation-engineer: How does `verify-scripts.ts` handle the co-existing `.sh`/`.ps1` and `.ts` pairs for Tier 2 scripts? Is the `pair` concept from the previous meeting implemented?

---

**Automation-Engineer**: (Round 1)

The `pair` field is NOT yet implemented in `verify-scripts.ts`. The 8 Tier 2 scripts all have both `.sh`/`.ps1` and `.ts` files simultaneously. In SCRIPTS.md, the `.sh`/`.ps1` wrappers are still registered as `active`. From the registry perspective, this looks normal — "registered and file exists."

The core problem: `dev-sync.sh` internally calls `bash scripts/sync-md.sh`, while `dev-sync.ts` calls `bun run scripts/sync-md.ts`. Two execution chains exist. There is no mechanism ensuring the two chains produce identical output.

Question to auditor: Does `audit.sh` currently detect this inconsistency? Is there any logic warning about shell wrapper residuals?

---

**Auditor**: (Round 1)

`audit.sh` passes with 0 warnings. The 49 registered scripts all have files present, so `verify-scripts.ts` reports clean. **Audit passing does not mean the state is correct.**

Specific risk: `dev-sync.sh → sync-md.sh` chain vs `dev-sync.ts → sync-md.ts` chain. There is no guarantee that `sync-md.ts` and `sync-md.sh` produce identical results — the TS version may have diverged.

Question to architect: What is the safest architectural approach — immediate deletion of shell wrappers, or transition to thin wrapper pattern?

---

**PM**: (Round 1 — Close)

Key findings: co-security structure is complete but `agents/README.md` standardization needs verification. Lifecycle governance has intentional L2 gaps. The most critical finding is the **dual execution chain** problem — `dev-sync.sh → sync-md.sh` and `dev-sync.ts → sync-md.ts` coexist with no equivalence guarantee. Audit passes but state is not correct.

Round 2: architect to answer auditor's question and propose SCRIPTS.md cleanup direction.

---

**Architect**: (Round 2)

**Thin wrapper pattern is recommended over immediate deletion**. Three reasons: (1) operators may still invoke `bash scripts/dev-sync.sh` — immediate deletion causes operational disruption; (2) thin wrappers (`exec bun "$SCRIPT_DIR/dev-sync.ts" "$@"`) converge both paths to the same TS code, structurally resolving the dual chain problem; (3) SCRIPTS.md `deprecated` status + `removal-date` provides explicit 90-day sunset notice.

`validate-templates` already demonstrated this pattern — `.sh` was a single `exec bun` line, then safely deleted.

**SCRIPTS.md cleanup**: Step 1 — convert 7 `.sh`/`.ps1` to thin wrappers, set status `deprecated`, removal-date `2026-08-28`. Step 2 — delete after 90 days.

Question to auditor: What edge cases in thin wrapper verification need attention?

---

**Automation-Engineer**: (Round 2)

Agree with thin wrapper approach. Implementation pattern for `.sh`:
```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/<script>.ts" "$@"
```
For `.ps1`:
```powershell
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& bun "$ScriptDir\<script>.ts" @args
exit $LASTEXITCODE
```

`audit.sh`/`audit.ps1` are also Tier 2 candidates but need confirmation that `dev-sync.sh` calls `audit.sh` internally before converting.

co-security `agents/README.md` standardization also needs resolution.

---

**Auditor**: (Round 2)

Three critical edge cases for thin wrapper verification:
1. **Argument passing completeness**: spaces in arguments, nested quotes, unicode — test `dev-sync.sh "feat: message with spaces"` pattern
2. **Exit code propagation**: `exec` replaces the shell process, so exit code propagates automatically in bash. PowerShell `.ps1` must have `exit $LASTEXITCODE` or bun's exit code is lost
3. **Environment variable inheritance**: `LC_ALL=C`, `LANG=C` set in shell scripts must be equivalent in TS versions

To resolve "audit pass = correct state" illusion: add a "Tier 2 deprecated wrapper" check to `verify-scripts.ts` — for entries with `status: deprecated` and `pair` field, verify the file is a thin wrapper (≤5 lines) not a full implementation.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | automation-engineer | Convert 7 Tier 2 `.sh`/`.ps1` to thin wrappers (dev-sync, sync-md, gen-pr-body, qa-gate, publish-to-template, list-template-versions, sync-skills) | Immediate |
| A-02 | automation-engineer | Set SCRIPTS.md 7 pairs status → `deprecated`, removal-date → `2026-08-29` | Immediate |
| A-03 | auditor | Verify `dev-sync.sh`/`dev-sync.ts` internal `audit.sh`/`audit.ts` call paths → determine if audit pair can be thin-wrapped | Immediate |
| A-04 | architect | Standardize `co-security/agents/README.md` — compare with other 3 variants, decide add or remove | Immediate |
| A-05 | automation-engineer | Add thin wrapper validation logic to `verify-scripts.ts` (file size check for deprecated + pair entries) | Next phase |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | All 7 Tier 2 shell wrappers delegate to TS via `exec bun` / `& bun` | Inspect each converted file (≤5 lines) |
| C-02 | SCRIPTS.md shows `deprecated` + removal-date for all 7 pairs | `bun scripts/verify-scripts.ts` shows deprecation warnings |
| C-03 | `dev-sync.sh "feat: msg with spaces"` produces same output as `bun run dev-sync "feat: msg with spaces"` | Side-by-side execution comparison |
| C-04 | `co-security/agents/README.md` presence matches all other variants | Structural comparison across 4 variants |
| C-05 | `audit.sh` execution path confirmed (shell vs TS chain) | Code inspection of `dev-sync.sh` and `dev-sync.ts` |
