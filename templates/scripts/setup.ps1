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

# ── OS detection ──────────────────────────────────────────────────────────────
$IsWin   = $env:OS -eq "Windows_NT"
$IsMac   = $IsMacOS  # Built-in PS 6+ variable; false in PS 5 on Windows
$IsLin   = $IsLinux  # Built-in PS 6+ variable
if ($PSVersionTable.PSVersion.Major -lt 6) {
    # PowerShell 5 (Windows only) — $IsMacOS/$IsLinux don't exist
    $IsMac = $false
    $IsLin = $false
    $IsWin = $true
}
$OsLabel = if ($IsMac) { "macOS" } elseif ($IsLin) { "Linux" } else { "Windows" }
Info "Detected OS: $OsLabel (PowerShell $($PSVersionTable.PSVersion))"

# ── Python binary ─────────────────────────────────────────────────────────────
$PyBin = $null
if (Get-Command python3 -ErrorAction SilentlyContinue) { $PyBin = "python3" }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $PyBin = "python" }

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

    # Node.js
    if (Test-Path "package.json") {
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            Warn "Node.js / npm not found — skipping npm install (install from https://nodejs.org)"
        } else {
            Info "Node.js project detected — running npm install"
            npm install
            if ($LASTEXITCODE -eq 0) { Pass "npm install complete" }
        }
    }

    # Python (requirements.txt)
    if (Test-Path "requirements.txt") {
        if (-not $PyBin) {
            Warn "Python not found — skipping venv + pip install (install from https://python.org)"
        } else {
            Info "Python project detected — creating .venv and installing dependencies"
            & $PyBin -m venv .venv

            # Activate: Windows PowerShell uses Scripts\Activate.ps1
            # macOS/Linux PowerShell uses bin/Activate.ps1
            $activateScript = if (Test-Path ".venv\Scripts\Activate.ps1") {
                ".venv\Scripts\Activate.ps1"
            } elseif (Test-Path ".venv/bin/Activate.ps1") {
                ".venv/bin/Activate.ps1"
            } else { $null }

            if ($activateScript) { & $activateScript }

            pip install -r requirements.txt
            if ($LASTEXITCODE -eq 0) { Pass "pip install complete (.venv created)" }

            if ($IsWin) {
                Info "Activate venv in PowerShell: .venv\Scripts\Activate.ps1"
            } else {
                Info "Activate venv in your shell: source .venv/bin/activate"
            }
        }
    }

    # Python (pyproject.toml, no requirements.txt)
    if ((Test-Path "pyproject.toml") -and (-not (Test-Path "requirements.txt"))) {
        if (-not $PyBin) {
            Warn "Python not found — skipping pip install -e . (install from https://python.org)"
        } else {
            Info "pyproject.toml detected — running pip install -e ."
            pip install -e .
            if ($LASTEXITCODE -eq 0) { Pass "pip install -e . complete" }
        }
    }

    # Ruby
    if (Test-Path "Gemfile") {
        if (-not (Get-Command bundle -ErrorAction SilentlyContinue)) {
            Warn "Bundler not found — skipping bundle install (run: gem install bundler)"
        } else {
            Info "Ruby project detected — running bundle install"
            bundle install
            if ($LASTEXITCODE -eq 0) { Pass "bundle install complete" }
        }
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
