# Meeting Transcript
**Date**: 2026-06-07
**Topic**: macOS bash 3.2 compatibility issue and new-project.sh mapfile fix
**Participants**: architect, automation-engineer, auditor, security-expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: The root cause is a shell version assumption problem. `mapfile` (aka `readarray`) was introduced in GNU bash 4.0+, but macOS ships with bash 3.2.57 due to GPLv3 licensing. The applied fix — `IFS=$'\n' read -r -d '' -a` — is POSIX-compatible and works on bash 3.2. The shebang must also be checked: if `#!/bin/bash`, macOS always runs 3.2, making this fix mandatory.

**automation-engineer**: Beyond `mapfile`, other bash 4+ patterns to check: `declare -A` (associative arrays), `${var,,}` / `${var^^}` (case conversion). Process substitution `< <(...)` is safe in bash 3.2. Recommends integrating `shellcheck --shell=bash` into audit.ts for proactive detection.

**auditor**: The fix is correct, but the systemic gap is lack of test coverage. `new-project.sh` is a core scaffolding script and it failed silently on stock macOS. Requests: shellcheck integration in audit.ts, and a full bash 3.2 compatibility scan of the script. Asks security-expert about IFS global contamination risk.

**security-expert**: The `IFS=$'\n' read` pattern applies IFS locally to the read command only — no global IFS contamination. However, identifies a path traversal risk: `layer-filter.ts` output flows directly into `rm -f "$PROJECT_DIR/scripts/$script"` without basename validation. Low attack surface (internal script) but worth hardening.

### Round 2

**architect**: Confirms path traversal risk is low but warrants defensive coding. Proposes 2-line basename validation in the rm loop: `[[ "$script" == */* ]] && continue`. Summarizes three pillars: shebang verification, shellcheck integration, array input validation.

**automation-engineer**: Proposes shellcheck integration pattern for audit.ts using optional detection (`which shellcheck`). Falls back to warning if shellcheck not installed — avoids false failures in clean environments.

**auditor**: Approves automation-engineer's shellcheck approach. Prioritizes: (1) immediate full bash 3.2 scan, (2) short-term basename validation, (3) medium-term shellcheck integration.

**security-expert**: Supports both proposals. Adds: project name input validation — `$PROJECT_NAME` is user-supplied and used in `rm -rf "$PROJECT_DIR/..."` paths. A regex guard at script entry is needed.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Full bash 3.2 compatibility scan of new-project.sh (declare -A, ${var,,}, etc.) | Both | Immediate |
| A-02 | automation-engineer | Low | Add 2-line basename validation inside rm loop | Both | Immediate |
| A-03 | automation-engineer | Low | Verify/add project name input validation regex at script entry | Both | Immediate |
| A-04 | automation-engineer | Low | Integrate optional shellcheck check into audit.ts | Both | Short-term |
| A-05 | lifecycle-manager | Medium | Lifecycle update and bun scripts/audit.ts run after A-01~04 | Both | After A-01~04 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | new-project.sh runs without error on macOS stock bash 3.2 | Run `bash scripts/new-project.sh "test-project"` on macOS |
| AC-02 | No bash 4+ syntax remaining in new-project.sh | shellcheck --shell=bash passes |
| AC-03 | rm loop rejects path-traversal inputs | Unit test with `../` in array |
| AC-04 | audit.ts reports shellcheck warning when not installed | Run audit.ts without shellcheck |
