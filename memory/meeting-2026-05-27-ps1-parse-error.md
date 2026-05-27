# Meeting Transcript
**Date**: 2026-05-27
**Topic**: Root Cause Analysis and Remediation Plan for new-project.ps1 PowerShell Parse Error
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**PM** (Facilitator):
The agenda is the parse error thrown when running `.\scripts\new-project.ps1 "tetris"` from `C:\test`. The error states `[CmdletBinding()]` is an "unexpected attribute" and `param` is an "unexpected token." I'm handing the floor to Architect for initial diagnosis, then Automation-Engineer for implementation reality, and finally Auditor for synthesis.

**Architect**:
The root cause is structural. PowerShell's parser requires that `[CmdletBinding()]` and the `param()` block be the very first executable statements in a script (only `#requires` directives and comments may precede them). In `new-project.ps1`, line 1 reads:

```powershell
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
```

This assignment executes before `[CmdletBinding()]` on line 2, which the parser interprets as a named attribute in an illegal position. The fix is deterministic: move the `$OutputEncoding` line to after the closing `)` of the `param()` block. No architectural redesign is needed — this is a strict language ordering constraint, not a design flaw. I also propose adding `#requires -Version 5.1` before `[CmdletBinding()]` to surface version mismatches early.

**Automation-Engineer**:
Architect is correct on the ordering fix — I can confirm this from implementation experience. Moving the `$OutputEncoding` assignment to after `param()` resolves the parse error with zero behavior change. Regarding Architect's `#requires -Version 5.1` suggestion: valid but out of scope for this fix; I'd track it as a separate hardening ticket. Two files need the fix: `C:\git\scripts\new-project.ps1` (the source of truth) and `C:\test\scripts\new-project.ps1` (the copy the user was running). The `C:\test` copy must either be patched or re-synced from `C:\git`. This is not a `.sh` issue — Bash has no `param()` equivalent constraint.

### Round 2

**Architect**:
Automation-Engineer's point about two files is important for consistency governance. The canonical source is `C:\git\scripts\new-project.ps1`; `C:\test` appears to be a deployed copy. If `C:\test` is a project scaffolded from the workspace template, the template itself (`templates/*/scripts/new-project.ps1`) should also be audited — if the template carried the bug, all future scaffolds will inherit it. I recommend the audit checklist include a `param()` ordering check for all `.ps1` files. I will defer the `#requires` addition to a follow-up.

**Auditor**:
Architect's template audit point is the key cross-domain finding. If the bug originated in `C:\git\scripts\new-project.ps1` and was copied to `C:\test`, the fix in `C:\git` is sufficient for the source. However, if the template directory also contains a copy, those must be patched too. I do not see any disagreement on the technical fix itself — all parties agree on moving the `$OutputEncoding` line. The open question is whether `audit.ps1` currently validates `param()` ordering; it almost certainly does not, making this a process gap.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | automation-engineer | Move `$OutputEncoding` line in `C:\git\scripts\new-project.ps1` to after `param()` block | Immediate |
| A-02 | automation-engineer | Apply same fix to `C:\test\scripts\new-project.ps1` or re-sync from source | Immediate |
| A-03 | docs-writer | Document "UTF-8 setup must follow param() block" rule in CONSTITUTION.md or scripting conventions | Follow-up |
| A-04 | auditor | Add `param()` ordering validation check to `audit.sh` / `audit.ps1` | Follow-up |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `.\scripts\new-project.ps1 "tetris"` runs without parse errors | Run the command and observe exit 0 |
| C-02 | `[CmdletBinding()]` is the first non-comment, non-`#requires` statement | Manual diff or audit check |
| C-03 | UTF-8 encoding behavior is unchanged | Run script and verify Unicode output renders correctly |
