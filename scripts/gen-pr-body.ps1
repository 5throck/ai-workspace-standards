param([Parameter(Mandatory)][string]$CommitMsg)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'


$Today = Get-Date -Format "yyyy-MM-dd"

# ?? Collect changed files ??????????????????????????????????????????????????????
$Files = (git diff --name-only HEAD~1 HEAD 2>$null)
if (-not $Files) { $Files = (git diff --cached --name-only 2>$null) }
if (-not $Files) { $Files = (git show --name-only --format="" HEAD 2>$null) }

$FileList = ($Files | Select-Object -First 30 | ForEach-Object { "- $_" }) -join "`n"
$DiffStat = (git diff --stat HEAD~1 HEAD 2>$null) -join "`n"
if (-not $DiffStat) { $DiffStat = (git diff --cached --stat 2>$null) -join "`n" }

# ?? AI mode: generate body via Claude CLI ?????????????????????????????????????
$ClaudePath = Get-Command claude -ErrorAction SilentlyContinue
if ($ClaudePath) {
    $Prompt = @"
Generate a GitHub Pull Request body for the following change.
Output ONLY the PR body in markdown - no explanation, no code fences around the whole output.

Commit message : $CommitMsg
Date           : $Today

Changed files  :
$($Files -join "`n")

Diff summary   :
$DiffStat

Use EXACTLY this structure (keep all section headers, fill placeholders):

## Why
[1-3 sentences: what problem does this solve and why now?]

## What Changed
[concise bullet list of actual changes - be specific, not generic]

## Test Plan
- [ ] ``bash scripts/audit.sh`` passes
- [ ] [add relevant manual or automated test steps]

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No ``.env`` files staged (use ``.env.sample`` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
[Breaking changes, deployment steps, or reviewer guidance. Write 'None' if not applicable.]

---
"@

    $TmpFile = [System.IO.Path]::GetTempFileName()
    $Prompt | Set-Content $TmpFile -Encoding UTF8

    try {
        $Body = claude -p (Get-Content $TmpFile -Raw -Encoding UTF8) 2>$null
        if ($Body) {
            Write-Output $Body
            exit 0
        }
    } catch {
        # Fall through to fallback
    } finally {
        Remove-Item $TmpFile -ErrorAction SilentlyContinue
    }
}

# ?? Fallback mode: structured template with auto-filled fields ?????????????????
@"
## Why
$CommitMsg

## What Changed
$FileList

## Test Plan
- [ ] ``bash scripts/audit.sh`` passes
- [ ] CHANGELOG.md updated under ``[Unreleased]``

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No ``.env`` files staged (use ``.env.sample`` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
None

---
"@

