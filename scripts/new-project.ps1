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
    ".githooks\pre-commit", ".githooks\pre-push", ".githooks\post-checkout", ".githooks\commit-msg",
    "scripts\audit.sh", "scripts\dev-sync.sh", "scripts\sync-md.sh", "scripts\setup.sh",
    "scripts\dev-sync.ps1", "scripts\audit.ps1", "scripts\sync-md.ps1", "scripts\setup.ps1"
)
foreach ($rel in $executableFiles) {
    if (Test-Path (Join-Path $ProjectDir $rel)) {
        git update-index --chmod=+x $rel 2>$null
    }
}

# ── 7. Post-scaffold audit ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "Running post-scaffold audit…" -ForegroundColor Cyan
.\scripts\audit.ps1
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Project '$ProjectName' scaffolded and verified at: $ProjectDir" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Project scaffolded but audit found issues — review above before continuing." -ForegroundColor Yellow
}

# ── 8. Environment setup (env file, deps, initial commit) ─────────────────────
Write-Host ""
Write-Host "Running environment setup…" -ForegroundColor Cyan
& "$ProjectDir\scripts\setup.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  Setup encountered an error — run '.\scripts\setup.ps1' manually to retry." -ForegroundColor Yellow
}

# ── 9. Move into project directory ────────────────────────────────────────────
Write-Host ""
Write-Host ("━" * 60) -ForegroundColor DarkGray
Write-Host "📂 PROJECT DIRECTORY: $ProjectDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Your shell is still at the workspace root." -ForegroundColor Yellow
Write-Host "   Run the following command to move into your new project:"
Write-Host ""
Write-Host "   cd `"$ProjectDir`"" -ForegroundColor Green
Write-Host ""
Write-Host "   All subsequent work (git, scripts, sessions) must be run"
Write-Host "   from inside this directory, not the workspace root."
Write-Host ("━" * 60) -ForegroundColor DarkGray
Write-Host ""

# Also actually change to project directory (takes effect when dot-sourced)
Set-Location $ProjectDir

Write-Host ""
Write-Host "Extension templates (ADR, analyst agent, skill, daily log):" -ForegroundColor DarkGray
Write-Host "  → $TemplatesDir\_examples\" -ForegroundColor DarkGray

