param([string]$Msg = "chore: update")
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;

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

# Mandatory 4-section format (CONSTITUTION.md §2 / docs/context.md § Documentation Standards)
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

# ── 2.5. Generate scripts/README.md ───────────────────────────────────────────
if (Test-Path "scripts\generate-scripts-readme.ts") {
    bun scripts\generate-scripts-readme.ts
}

# ── 3. Auto-add to CHANGELOG.md [Unreleased] if the entry is missing ────
if (Test-Path "CHANGELOG.md") {
    $cl = Get-Content "CHANGELOG.md" -Raw -Encoding UTF8
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

# ── 3.6. Warn about deprecated scripts (if SCRIPTS.md exists) ─────────────────
if (Test-Path "SCRIPTS.md") {
    $deprecatedScripts = Select-String -Path "SCRIPTS.md" -Pattern "^\|.*\|.*deprecated" -ErrorAction SilentlyContinue
    if ($deprecatedScripts) {
        Write-Host "⚠️  Deprecated scripts detected in SCRIPTS.md:" -ForegroundColor Yellow
        foreach ($match in $deprecatedScripts) {
            $parts = $match.Line -split '\|'
            if ($parts.Length -ge 3) {
                $scriptName = $parts[1].Trim()
                Write-Host "   - $scriptName"
            }
        }
        Write-Host "   Consider removing or updating these scripts."
        Write-Host ""
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
    try { git checkout -b $Branch 2>&1 | Out-Null } catch {
        Write-Host "❌ Failed to create branch '$Branch'" -ForegroundColor Red; exit 1
    }
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

try { git add -A 2>&1 | Out-Null } catch {
    Write-Host "❌ git add failed: $_" -ForegroundColor Red; exit 1
}
try { git commit -m "$Msg" 2>&1 | Out-Null } catch {
    Write-Host "❌ git commit failed: $_" -ForegroundColor Red; exit 1
}
try { git push -u origin $Branch 2>&1 | Out-Null } catch {
    Write-Host "❌ git push failed: $_" -ForegroundColor Red; exit 1
}

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


