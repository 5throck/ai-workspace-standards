# dev-sync.ps1 — Full pipeline: memlog → sync-md → changelog → audit → commit → PR (Windows)
# Usage: .\scripts\dev-sync.ps1 "feat: description"
param([string]$Msg = "chore: update")

$Date = Get-Date -Format "yyyy-MM-dd"

# ── 1. Write daily session log ─────────────────────────────────────────────────
New-Item -ItemType Directory -Path "memory" -Force | Out-Null
Add-Content "memory\$Date.md" "## Session — $Msg"

# ── 2. Update MEMORY.md index ─────────────────────────────────────────────────
.\scripts\sync-md.ps1 $Date $Msg

# ── 3. Auto-add to CHANGELOG.md [Unreleased] if the section has no entries ────
if (Test-Path "CHANGELOG.md") {
    $cl = Get-Content "CHANGELOG.md" -Raw
    # Extract [Unreleased] section content
    if ($cl -match '## \[Unreleased\]([\s\S]*?)(?=\n## |\z)') {
        $section = $Matches[1]
        if ($section -notmatch '(?m)^\s*[-*]' -and $section -notmatch '(?m)^### ') {
            $cl = $cl -replace '(## \[Unreleased\])', "`$1`n`n- $Msg"
            Set-Content "CHANGELOG.md" $cl -Encoding UTF8
            Write-Host "📝 Auto-added changelog entry: $Msg" -ForegroundColor Cyan
        }
    }
}

# ── 4. Audit gate ──────────────────────────────────────────────────────────────
.\scripts\audit.ps1
if ($LASTEXITCODE -ne 0) { exit 1 }

# ── 5. Branch → commit → push → PR ────────────────────────────────────────────
$CurrentBranch = git rev-parse --abbrev-ref HEAD
if ($CurrentBranch -eq "main" -or $CurrentBranch -eq "master") {
    $Slug = ($Msg -replace '[^a-z0-9]', '-' -replace '-+', '-').ToLower().TrimEnd('-')
    $Slug = $Slug.Substring(0, [Math]::Min(40, $Slug.Length))
    $Branch = "pr/$(Get-Date -Format 'yyyyMMdd-HHmmss')-$Slug"
    git checkout -b $Branch
} else {
    $Branch = $CurrentBranch
    Write-Host "ℹ️  Already on branch '$Branch' — committing here without creating a new branch." -ForegroundColor Cyan
}
git add -A
git commit -m "$Msg`n`nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin $Branch
# Use PR template if present; fall back to --fill
if (Test-Path ".github\pull_request_template.md") {
    $prBody = Get-Content ".github\pull_request_template.md" -Raw
    gh pr create --title $Msg --body $prBody
} else {
    gh pr create --fill
}
