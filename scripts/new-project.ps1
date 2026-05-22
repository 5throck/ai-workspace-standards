# new-project.ps1 — Scaffold a new project under the workspace root (Windows)
# Usage: .\scripts\new-project.ps1 "<project-name>"
param([Parameter(Mandatory)][string]$ProjectName)

$WorkspaceRoot = Split-Path $PSScriptRoot -Parent
$ProjectDir    = Join-Path $WorkspaceRoot $ProjectName
$TemplatesDir  = Join-Path $WorkspaceRoot "templates"

if (Test-Path $ProjectDir) {
    Write-Host "❌ Directory already exists: $ProjectDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $TemplatesDir)) {
    Write-Host "❌ Templates directory not found: $TemplatesDir" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Scaffolding new project: $ProjectName" -ForegroundColor Cyan

# ── 1. Copy templates (robocopy handles hidden files and subdirs) ──────────────
New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
robocopy $TemplatesDir $ProjectDir /E /NFL /NDL /NJH /NJS | Out-Null

# ── 2. Remove _examples (reference-only — not part of a real project) ──────────
$examplesDir = Join-Path $ProjectDir "_examples"
if (Test-Path $examplesDir) { Remove-Item $examplesDir -Recurse -Force }

# ── 3. Remove .gitkeep placeholders ────────────────────────────────────────────
Get-ChildItem -Path $ProjectDir -Recurse -Filter ".gitkeep" | Remove-Item -Force

# ── 4. Substitute [Project Name] placeholder in all text files ─────────────────
$extensions = @('.md', '.json', '.sh', '.ps1', '.yaml', '.yml', '.sample')
Get-ChildItem -Path $ProjectDir -Recurse -File |
  Where-Object { $_.Extension -in $extensions } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($content -and $content -match '\[Project Name\]') {
        ($content -replace '\[Project Name\]', $ProjectName) |
          Set-Content $_.FullName -Encoding UTF8 -NoNewline
    }
  }

# ── 5. Initialize git ──────────────────────────────────────────────────────────
Set-Location $ProjectDir
git init
git config core.hooksPath .githooks

# ── 6. Set executable bit on hooks and scripts (for WSL / Git Bash users) ──────
# Must run AFTER git init so the git index exists
$executableFiles = @(
    ".githooks\pre-commit", ".githooks\pre-push",
    "scripts\audit.sh", "scripts\dev-sync.sh", "scripts\sync-md.sh"
)
foreach ($rel in $executableFiles) {
    if (Test-Path (Join-Path $ProjectDir $rel)) {
        git update-index --chmod=+x $rel 2>$null
    }
}

Write-Host ""
Write-Host "✅ Project '$ProjectName' scaffolded at: $ProjectDir" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Fill in docs\context.md placeholders (## Tech Stack, ## Architecture, [KEY_NAME])"
Write-Host "  2. Set your test command in agents\test-runner.md (replace [project test command])"
Write-Host "  3. .\scripts\audit.ps1                    (verify scaffold passes — must exit 0)"
Write-Host "  4. git config core.hooksPath .githooks    (already set, verify it stuck)"
Write-Host ""
Write-Host "Extension templates (ADR, analyst agent, skill, daily log):" -ForegroundColor DarkGray
Write-Host "  → $TemplatesDir\_examples\" -ForegroundColor DarkGray
