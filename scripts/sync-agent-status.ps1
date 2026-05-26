# sync-agent-status.ps1 - Synchronize agent status between files and AGENTS.md
# Detects deprecated agents and updates AGENTS.md, handles archiving after 30 days

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

Write-Host "=== Agent Status Synchronization ===" -ForegroundColor Cyan
Write-Host ""

# Check each agent file
Get-ChildItem "agents\*.md" -ErrorAction SilentlyContinue | ForEach-Object {
    $agentFile = $_
    $agentName = $_.BaseName

    # Extract status from agent file
    $fileStatus = Select-String -Path $agentFile -Pattern "^status:" | ForEach-Object {
        $_.Line.Split(":")[1].Trim()
    }

    if (-not $fileStatus) {
        Warn "⚠️  No status field found in $agentFile"
        return
    }

    # Check if agent is deprecated
    if ($fileStatus -eq "deprecated") {
        Info "🔍 Found deprecated agent: $agentName"

        # Check AGENTS.md for current status
        $agentsMdLine = Get-Content "AGENTS.md" | Select-String -Pattern "\`${agentName}\.md\`"

        if ($agentsMdLine) {
            $lineNumber = $agentsMdLine.LineNumber
            $currentStatus = $agentsMdLine.Line | Select-String -Pattern "status: \w+" | ForEach-Object {
                $_.Matches[0].Value.Split(":")[1].Trim()
            }

            if ($currentStatus -ne "deprecated") {
                Info "  📝 Updating AGENTS.md status for $agentName`: $currentStatus → deprecated"

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

            # Check last modified date for archiving
            try {
                $lastModified = (git log -1 --format=%ct "$agentFile" 2>$null)
                if ($lastModified) {
                    $currentTime = [int](Get-Date -UFormat %s)
                    $daysSinceModified = ($currentTime - $lastModified) / 86400

                    if ($daysSinceModified -ge 30) {
                        Warn "  ⚠️  Agent $agentName has been deprecated for $daysSinceModified days (≥30 days)"
                        Write-Host "     Consider moving to agents\_archive\ (run manually)"
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
    Success "✅ Synchronized $changesMade agent status(es)"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Review changes: git diff AGENTS.md"
    Write-Host "  2. Commit: git add AGENTS.md; git commit -m 'chore: sync agent status'"
    Write-Host "  3. For agents deprecated ≥30 days: mv agents\DEPRECATED.md agents\_archive\"
} else {
    Success "✅ All agent statuses already in sync"
}

exit 0
