# list-template-versions.ps1 - List available template versions (Windows Tier 1 companion)
# Tier 1 companion to list-template-versions.ts

$WorkspaceRoot = Split-Path -Parent $PSScriptRoot

$tags = git -C $WorkspaceRoot tag -l "template-v*" 2>$null | Sort-Object

Write-Host "Available template versions:" -ForegroundColor Cyan
Write-Host ""

if (-not $tags) {
    Write-Host "  (no tagged versions found)" -ForegroundColor DarkGray
    Write-Host ""
    $versionFile = Join-Path $WorkspaceRoot "templates\VERSION"
    if (Test-Path $versionFile) {
        $v = (Get-Content $versionFile -Raw).Trim()
        Write-Host "  Current (untagged) version:" -ForegroundColor DarkGray
        Write-Host "  -> $v (latest, untagged)" -ForegroundColor Green
    }
} else {
    foreach ($tag in $tags) {
        $version = $tag -replace '^template-v', ''
        Write-Host "  -> $version  ($tag)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Usage: .\scripts\new-project.ps1 my-project -Version X.Y.Z" -ForegroundColor DarkGray
Write-Host "       (omit -Version to use the latest template)" -ForegroundColor DarkGray
