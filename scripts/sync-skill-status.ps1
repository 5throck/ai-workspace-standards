# sync-skill-status.ps1 - Synchronize skill status between SKILL.md and registry tables
# Detects deprecated skills and updates AGENTS.md, docs/context.md tables

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

# Color output functions
function Success { Write-Host $args -ForegroundColor Green }
function Warn { Write-Host $args -ForegroundColor Yellow }
function Info { Write-Host $args -ForegroundColor Cyan }

# Track changes
$changesMade = 0

Write-Host "=== Skill Status Synchronization ===" -ForegroundColor Cyan
Write-Host ""

# Check both skills directories
$skillsDirs = @("skills", ".claude\skills")

foreach ($skillsDir in $skillsDirs) {
    if (-not (Test-Path $skillsDir)) { continue }

    Get-ChildItem "$skillsDir\*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $skillDir = $_
        $skillName = $_.BaseName
        $skillFile = Join-Path $skillDir "SKILL.md"

        if (-not (Test-Path $skillFile)) { return }

        # Extract status from skill file
        $fileStatus = Select-String -Path $skillFile -Pattern "^status:" | ForEach-Object {
            $_.Line.Split(":")[1].Trim()
        }

        if (-not $fileStatus) {
            Warn "⚠️  No status field found in $skillFile"
            return
        }

        # Check if skill is deprecated
        if ($fileStatus -eq "deprecated") {
            Info "🔍 Found deprecated skill: $skillName"

            # Update AGENTS.md Skills table (if exists)
            if (Test-Path "AGENTS.md") {
                $currentLine = Get-Content "AGENTS.md" | Select-String -Pattern "\`${skillName}\`" | Select-Object -First 1

                if ($currentLine) {
                    $lineNumber = $currentLine.LineNumber
                    $currentStatus = $currentLine.Line | Select-String -Pattern "status: \w+" | ForEach-Object {
                        $_.Matches[0].Value.Split(":")[1].Trim()
                    }

                    if ($currentStatus -ne "deprecated") {
                        Info "  📝 Updating AGENTS.md Skills table for $skillName"

                        # Read all lines
                        $lines = Get-Content "AGENTS.md"
                        # Update the specific line
                        $lines[$lineNumber - 1] = $lines[$lineNumber - 1] -replace "status: $currentStatus", "status: deprecated"
                        # Write back
                        $lines | Set-Content "AGENTS.md" -Encoding UTF8

                        $changesMade++
                        Success "  ✅ Updated AGENTS.md"
                    } else {
                        Write-Host "  ✓ AGENTS.md already up-to-date"
                    }
                }
            }

            # Update docs/context.md Skills table (if exists in project)
            if (Test-Path "docs\context.md") {
                $currentLine = Get-Content "docs\context.md" | Select-String -Pattern "\`${skillName}\`" | Select-Object -First 1

                if ($currentLine) {
                    $lineNumber = $currentLine.LineNumber
                    $currentStatus = $currentLine.Line | Select-String -Pattern "status: \w+" | ForEach-Object {
                        $_.Matches[0].Value.Split(":")[1].Trim()
                    }

                    if ($currentStatus -ne "deprecated") {
                        Info "  📝 Updating docs\context.md Skills table for $skillName"

                        # Read all lines
                        $lines = Get-Content "docs\context.md"
                        # Update the specific line
                        $lines[$lineNumber - 1] = $lines[$lineNumber - 1] -replace "status: $currentStatus", "status: deprecated"
                        # Write back
                        $lines | Set-Content "docs\context.md" -Encoding UTF8

                        $changesMade++
                        Success "  ✅ Updated docs\context.md"
                    } else {
                        Write-Host "  ✓ docs\context.md already up-to-date"
                    }
                }
            }

            # Check last modified date for archiving
            try {
                $lastModified = git log -1 --format=%ct "$skillFile" 2>$null
                if ($lastModified) {
                    $currentTime = [int](Get-Date -UFormat %s)
                    $daysSinceModified = ($currentTime - $lastModified) / 86400

                    if ($daysSinceModified -ge 30) {
                        Warn "  ⚠️  Skill $skillName has been deprecated for $daysSinceModified days (≥30 days)"
                        Write-Host "     Consider moving to ${skillsDir}\_archive\ (run manually)"
                    }
                }
            } catch {
                # Not a git repo or git not available
            }
        }
    }
}

Write-Host ""
if ($changesMade -gt 0) {
    Success "✅ Synchronized $changesMade skill status(es)"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Review changes: git diff AGENTS.md docs\context.md"
    Write-Host "  2. Commit: git add AGENTS.md docs\context.md; git commit -m 'chore: sync skill status'"
    Write-Host "  3. For skills deprecated ≥30 days: mv skills\DEPRECATED skills\_archive\"
} else {
    Success "✅ All skill statuses already in sync"
}

exit 0
