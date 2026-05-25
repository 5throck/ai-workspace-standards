param(
    [Parameter(Mandatory)][string]$ProjectName,
    [Parameter(Mandatory=$false)][string]$Description = "A new project",
    [Parameter(Mandatory=$false)][string]$TechStack = "Node.js / Python / etc"
)

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'


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

# ── 1. Copy templates (robocopy handles hidden files and subdirs) ──────────
New-Item -ItemType Directory -Path $ProjectDir -Force | Out-Null
robocopy $TemplatesDir $ProjectDir /E /NFL /NDL /NJH /NJS | Out-Null

# ── 2. Remove docs/_examples (reference-only - not part of a real project) ───
$examplesDir = Join-Path $ProjectDir "docs\_examples"
if (Test-Path $examplesDir) { Remove-Item $examplesDir -Recurse -Force }

# ── 2.5. Remove any accidentally copied .cmd files and Enforce .ps1 / .sh Pairs ──
Get-ChildItem -Path $ProjectDir -Recurse -Filter "*.cmd" | Remove-Item -Force

$scriptsDir = Join-Path $ProjectDir "scripts"
if (Test-Path $scriptsDir) {
    # Check .ps1 missing .sh
    Get-ChildItem -Path $scriptsDir -Filter "*.ps1" | ForEach-Object {
        $base = $_.BaseName
        $shPair = Join-Path $scriptsDir "$base.sh"
        if (-not (Test-Path $shPair)) {
            Write-Host "❌ Script Pair Validation Failed: Missing .sh pair for $_.Name" -ForegroundColor Red
            exit 1
        }
    }
    # Check .sh missing .ps1
    Get-ChildItem -Path $scriptsDir -Filter "*.sh" | ForEach-Object {
        $base = $_.BaseName
        $ps1Pair = Join-Path $scriptsDir "$base.ps1"
        if (-not (Test-Path $ps1Pair)) {
            Write-Host "❌ Script Pair Validation Failed: Missing .ps1 pair for $_.Name" -ForegroundColor Red
            exit 1
        }
    }
}

# ── 3. Remove .gitkeep placeholders ────────────────────────────────────────────
Get-ChildItem -Path $ProjectDir -Recurse -Filter ".gitkeep" | Remove-Item -Force

# ── 4. Substitute placeholders in all text files ─────────────────
$extensions = @('.md', '.json', '.sh', '.ps1', '.yaml', '.yml', '.sample')
Get-ChildItem -Path $ProjectDir -Recurse -File |
  Where-Object { $_.Extension -in $extensions } |
  ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($content) {
        $modified = $false
        if ($content -match '\[Project Name\]') { $content = $content -replace '\[Project Name\]', $ProjectName; $modified = $true }
        if ($content -match '\{\{PROJECT_NAME\}\}') { $content = $content -replace '\{\{PROJECT_NAME\}\}', $ProjectName; $modified = $true }
        if ($content -match '\{\{PROJECT_DESCRIPTION\}\}') { $content = $content -replace '\{\{PROJECT_DESCRIPTION\}\}', $Description; $modified = $true }
        if ($content -match '\{\{PROJECT_CHARACTERISTICS\}\}') { $content = $content -replace '\{\{PROJECT_CHARACTERISTICS\}\}', $TechStack; $modified = $true }
        
        if ($modified) {
            Set-Content $_.FullName $content -Encoding UTF8 -NoNewline
        }
    }
  }

# ── 5. Initialize git ──────────────────────────────────────────────────────────
Set-Location $ProjectDir
git init
git config core.hooksPath .githooks

# ── 6. Set executable bit on hooks and scripts (for WSL / Git Bash users) ──────
Get-ChildItem -Path (Join-Path $ProjectDir ".githooks") -File -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = ".githooks" + $_.Name
    git update-index --chmod=+x $rel 2>$null
}
Get-ChildItem -Path (Join-Path $ProjectDir "scripts") -File -Include "*.sh","*.ps1" -ErrorAction SilentlyContinue | ForEach-Object {
    $rel = "scripts" + $_.Name
    git update-index --chmod=+x $rel 2>$null
}

# ── 7. Post-scaffold audit ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "Running post-scaffold audit..." -ForegroundColor Cyan
.\scripts\audit.ps1
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Project '$ProjectName' scaffolded and verified at: $ProjectDir" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "⚠️  Project scaffolded but audit found issues - review above before continuing." -ForegroundColor Yellow
}

# ── 8. Environment setup (env file, deps, initial commit) ─────────────────────
Write-Host ""
Write-Host "Running environment setup..." -ForegroundColor Cyan
& "$ProjectDir\scripts\setup.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  Setup encountered an error - run '.\scripts\setup.ps1' manually to retry." -ForegroundColor Yellow
}

# ── 9. Move into project directory ────────────────────────────────────────────
Write-Host ""
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host "PROJECT DIRECTORY: $ProjectDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "WARNING: Your shell is still at the workspace root." -ForegroundColor Yellow
Write-Host "Run the following command to move into your new project:"
Write-Host ""
Write-Host "   cd '$ProjectDir'" -ForegroundColor Green
Write-Host ""
Write-Host "All subsequent work must be run from inside this directory."
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host ""

Set-Location $ProjectDir
Write-Host ""
Write-Host "Extension templates (ADR, analyst agent, skill, daily log):" -ForegroundColor DarkGray
Write-Host "  -> $TemplatesDir\docs\_examples" -ForegroundColor DarkGray





