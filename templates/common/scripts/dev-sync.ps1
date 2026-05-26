param([string]$Msg = "chore: update")

# Force English culture for consistent error messages
[System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::GetCultureInfo("en-US")

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'


$Date = Get-Date -Format "yyyy-MM-dd"

# ── 1. Write daily session log ─────────────────────────────────────────────────
New-Item -ItemType Directory -Path "memory" -Force | Out-Null
$GitStatus = git status --short 2>$null
$FileLines = "- N/A"
if ($GitStatus) {
    $FileLines = ($GitStatus | ForEach-Object {
        $f = ($_ -replace '^.{2}\s+', '').Trim()
        "- ``$f`` — modified"
    }) -join "`n"
}

# Determine appropriate separator
$separator = ""
if (Test-Path "memory\$Date.md") { $separator = "`n---`n`n" }

# Mandatory 4-section format (docs/context.md § Documentation Standards)
$template = @"
$separator## Session Summary
$Msg

## Changes
$FileLines

## Decisions
- None

## Open Issues
- None
"@

Add-Content "memory\$Date.md" $template -Encoding UTF8


# ── 2. Update MEMORY.md index ─────────────────────────────────────────────────
.\scripts\sync-md.ps1 $Date $Msg

# ── 3. Auto-add to CHANGELOG.md [Unreleased] if the entry is missing ────
if (Test-Path "CHANGELOG.md") {
    $cl = Get-Content "CHANGELOG.md" -Raw -Encoding UTF8
    # Extract [Unreleased] section content
    if ($cl -match '## \[Unreleased\]([\s\S]*?)(?=\n## |\z)') {
        $section = $Matches[1]
        $EscapedMsg = [regex]::Escape($Msg)
        if ($section -notmatch $EscapedMsg) {
            $Category = "### Changed"
            if ($Msg -match "^feat") { $Category = "### Added" }
            elseif ($Msg -match "^fix") { $Category = "### Fixed" }
            elseif ($Msg -match "^revert") { $Category = "### Removed" }
            
            $cl = $cl -replace '(## \[Unreleased\])', "`$1`n`n$Category`n- **[$Date]**: $Msg"
            Set-Content "CHANGELOG.md" $cl -Encoding UTF8
            Write-Host "📝 Auto-added changelog entry: $Msg" -ForegroundColor Cyan
        }
    }
}

# ── 3.5. Warn if [Unreleased] section has no bullet items ────────────────────
if (Test-Path "CHANGELOG.md") {
    $clCheck = Get-Content "CHANGELOG.md" -Raw -Encoding UTF8
    if ($clCheck -match '## \[Unreleased\]([\s\S]*?)(?=\n## |\z)') {
        $unreleasedSection = $Matches[1]
        if ($unreleasedSection -notmatch '(?m)^\s*-\s+') {
            Write-Host ""
            Write-Host "⚠️  CHANGELOG.md [Unreleased] section has no entries." -ForegroundColor Yellow
            Write-Host "   Consider running: /changelog 'type: description' before syncing." -ForegroundColor Yellow
            Write-Host "   (continuing anyway - use this warning to keep your changelog current)" -ForegroundColor DarkGray
            Write-Host ""
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
    Write-Host "ℹ️  Already on branch '$Branch' - committing here without creating a new branch." -ForegroundColor Cyan
}
# ── 6. Guard against committing sensitive files ───────────────────────────────
$Sensitive = git ls-files --others --exclude-standard 2>$null |
    Where-Object { $_ -match '\.(pem|key|p12|pfx|jks|keystore)$|^\.env(\.[^sa]|$)|credentials\.json|service.?account\.json|secrets\.ya?ml' }
if ($Sensitive) {
    Write-Host "❌ Potentially sensitive untracked files detected - refusing git add -A:" -ForegroundColor Red
    $Sensitive | ForEach-Object { Write-Host "   $_" }
    Write-Host "   Stage files explicitly with 'git add <file>' or add them to .gitignore." -ForegroundColor Yellow
    exit 1
}

git add -A
git commit -m "$Msg"
git push -u origin $Branch

# ── 7. Generate PR body and open PR ───────────────────────────────────────────
$PrBody = ""
if (Test-Path "scripts\gen-pr-body.ps1") {
    try { $PrBody = & .\scripts\gen-pr-body.ps1 $Msg 2>$null } catch {}
}

if ($PrBody) {
    gh pr create --title $Msg --body $PrBody
} elseif (Test-Path ".github\pull_request_template.md") {
    $prBody = Get-Content ".github\pull_request_template.md" -Raw -Encoding UTF8
    gh pr create --title $Msg --body $prBody
} else {
    gh pr create --fill
}


