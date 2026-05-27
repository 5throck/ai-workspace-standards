param([switch]$DryRun)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

$L0Dir = $PSScriptRoot
$L1Dir = Join-Path $PSScriptRoot "..\templates\common\scripts" | Resolve-Path

if (-not (Test-Path (Join-Path $L0Dir "SCRIPTS.md"))) {
    Write-Host "❌ SCRIPTS.md not found at $L0Dir" -ForegroundColor Red
    exit 1
}

Write-Host "L0 → L1 publish: scripts/ → templates/common/scripts/"
if ($DryRun) { Write-Host "(dry-run mode)" }
Write-Host ""

$count = 0
$registryLines = Get-Content (Join-Path $L0Dir "SCRIPTS.md") | Where-Object { $_ -match '^\| `[^`]+`' }

foreach ($line in $registryLines) {
    $cols = $line -split '\|'
    if ($cols.Count -lt 4) { continue }
    $script = $cols[1].Trim().Trim('`')
    $source = $cols[2].Trim()
    if ($source -ne "L0") { continue }
    if (-not $script) { continue }
    $src = Join-Path $L0Dir $script
    $dst = Join-Path $L1Dir $script
    if (-not (Test-Path $src)) { continue }
    if ($DryRun) {
        Write-Host "  [dry-run] $script"
    } else {
        Copy-Item $src $dst -Force
        Write-Host "  ✅ $script"
        $count++
    }
}

if (-not $DryRun) {
    Copy-Item (Join-Path $L0Dir "SCRIPTS.md") (Join-Path $L1Dir "SCRIPTS.md") -Force
    Write-Host "  ✅ SCRIPTS.md"
    $count++
    Write-Host ""
    Write-Host "✅ Published $count files  L0 (scripts/) → L1 (templates/common/scripts/)" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "(dry-run complete — no files written)" -ForegroundColor DarkGray
}
