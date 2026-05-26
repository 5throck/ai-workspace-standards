# list-template-versions.ps1 - List available template versions
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$WorkspaceRoot = Split-Path $PSScriptRoot -Parent

Write-Host "Available template versions:" -ForegroundColor Cyan
Write-Host ""

$tags = git -C $WorkspaceRoot tag -l "template-v*" 2>$null | Sort-Object

if (-not $tags) {
    Write-Host "  (no tagged versions found)" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Current (untagged) version:" -ForegroundColor DarkGray
    $versionFile = Join-Path $WorkspaceRoot "templates" "VERSION"
    if (Test-Path $versionFile) {
        $v = (Get-Content $versionFile -Raw).Trim()
        Write-Host "  → $v (latest, untagged)" -ForegroundColor Green
    }
} else {
    foreach ($tag in $tags) {
        $version = $tag -replace "^template-v", ""
        Write-Host "  → $version  ($tag)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Usage: .\scripts\new-project.ps1 my-project -Version X.Y.Z" -ForegroundColor DarkGray
Write-Host "       (omit -Version to use the latest template)" -ForegroundColor DarkGray
