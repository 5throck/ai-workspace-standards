param([switch]$DryRun)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

$WorkspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
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
    $drift  = if ($cols.Count -ge 8) { $cols[7].Trim() } else { "—" }
    if ($source -ne "L0") { continue }
    if ($drift -eq "intentional") { continue }  # skip intentional divergences
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
}

# ── Skills: L0 (skills/) → L1 (templates/common/skills/) ─────────────────────
$L0Skills = Join-Path $WorkspaceRoot "skills"
$L1Skills = Join-Path $WorkspaceRoot "templates\common\skills"

Write-Host ""
Write-Host "L0 → L1 publish: skills/ → templates/common/skills/"

$skillCount = 0
foreach ($item in Get-ChildItem $L0Skills) {
    if ($DryRun) {
        $suffix = if ($item.PSIsContainer) { "/" } else { "" }
        Write-Host "  [dry-run] $($item.Name)$suffix"
    } elseif ($item.PSIsContainer) {
        $dst = Join-Path $L1Skills $item.Name
        if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
        Copy-Item $item.FullName $L1Skills -Recurse -Force
        Write-Host "  ✅ $($item.Name)/"
        $skillCount++
    } else {
        Copy-Item $item.FullName (Join-Path $L1Skills $item.Name) -Force
        Write-Host "  ✅ $($item.Name)"
        $skillCount++
    }
}

if (-not $DryRun) {
    Write-Host ""
    Write-Host "✅ Published $skillCount items  L0 (skills/) → L1 (templates/common/skills/)" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "(dry-run complete — no files written)" -ForegroundColor DarkGray
}
