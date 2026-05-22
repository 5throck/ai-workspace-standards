# setup.ps1 — Post-scaffold environment setup (Windows PowerShell)
# Mirrors setup.sh exactly. Called automatically by new-project.ps1;
# can also be re-run manually at any time.
#
# Usage: .\scripts\setup.ps1 [-SkipInstall] [-SkipCommit]
param(
    [switch]$SkipInstall,
    [switch]$SkipCommit
)

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "=== setup.ps1 — environment setup ===" -ForegroundColor Cyan

# ── 1. .env.sample → .env ─────────────────────────────────────────────────────
if (Test-Path ".env.sample") {
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.sample" ".env"
        Pass ".env created from .env.sample — fill in secrets before running the app"
    } else {
        Info ".env already exists — skipping copy"
    }
}

# ── 2. Dependency install (stack auto-detection) ──────────────────────────────
if (-not $SkipInstall) {
    if (Test-Path "package.json") {
        Info "Node.js project detected — running npm install"
        npm install
        if ($LASTEXITCODE -eq 0) { Pass "npm install complete" }
    }

    if (Test-Path "requirements.txt") {
        Info "Python project detected — creating .venv and installing dependencies"
        python -m venv .venv
        $activateScript = ".venv\Scripts\Activate.ps1"
        if (Test-Path $activateScript) {
            & $activateScript
        }
        pip install -r requirements.txt
        if ($LASTEXITCODE -eq 0) { Pass "pip install complete (.venv activated)" }
    }

    if ((Test-Path "pyproject.toml") -and (-not (Test-Path "requirements.txt"))) {
        Info "pyproject.toml detected — running pip install -e ."
        pip install -e .
        if ($LASTEXITCODE -eq 0) { Pass "pip install -e . complete" }
    }

    if (Test-Path "Gemfile") {
        Info "Ruby project detected — running bundle install"
        bundle install
        if ($LASTEXITCODE -eq 0) { Pass "bundle install complete" }
    }
} else {
    Info "Skipping dependency install (-SkipInstall)"
}

# ── 3. Initial commit ─────────────────────────────────────────────────────────
if (-not $SkipCommit) {
    $gitDir = git rev-parse --git-dir 2>$null
    if ($LASTEXITCODE -eq 0) {
        git add -A
        $commitMsg = "chore: initial scaffold`n`nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
        git commit -m $commitMsg 2>$null
        if ($LASTEXITCODE -eq 0) {
            Pass "Initial commit created"
        } else {
            Warn "Nothing to commit (already committed?)"
        }
    } else {
        Warn "Not inside a git repository — skipping initial commit"
    }
} else {
    Info "Skipping initial commit (-SkipCommit)"
}

Write-Host ""
Write-Host "✅ Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  git remote add origin <url>"
Write-Host "  git push -u origin main"
