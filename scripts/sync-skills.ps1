$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;

# sync-skills.ps1
# Distributes skills from the SSOT (skills/) to .claude/skills/ and .gemini/skills/

$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceRoot = Split-Path -Parent $workspaceRoot

$ssotSkills = Join-Path $workspaceRoot "skills"
$claudeSkills = Join-Path $workspaceRoot ".claude\skills"
$geminiSkills = Join-Path $workspaceRoot ".gemini\skills"

# Create target directories if they don't exist
if (-not (Test-Path $claudeSkills)) { New-Item -ItemType Directory -Path $claudeSkills | Out-Null }
if (-not (Test-Path $geminiSkills)) { New-Item -ItemType Directory -Path $geminiSkills | Out-Null }

Write-Host "Syncing skills from SSOT ($ssotSkills)..."

# Find all skill directories in SSOT
$skillDirs = Get-ChildItem -Path $ssotSkills -Directory

foreach ($skillDir in $skillDirs) {
    $skillName = $skillDir.Name
    $claudeTarget = Join-Path $claudeSkills $skillName
    $geminiTarget = Join-Path $geminiSkills $skillName

    # Copy to .claude
    if (Test-Path $claudeTarget) { Remove-Item -Path $claudeTarget -Recurse -Force }
    Copy-Item -Path $skillDir.FullName -Destination $claudeTarget -Recurse -Force
    Write-Host "  -> Synced $skillName to .claude/skills/"

    # Copy to .gemini
    if (Test-Path $geminiTarget) { Remove-Item -Path $geminiTarget -Recurse -Force }
    Copy-Item -Path $skillDir.FullName -Destination $geminiTarget -Recurse -Force
    Write-Host "  -> Synced $skillName to .gemini/skills/"
}

Write-Host "Skill synchronization complete!"
