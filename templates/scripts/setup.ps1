# setup.ps1 — Post-scaffold environment setup (Windows PowerShell)
# Mirrors setup.sh exactly. Called automatically by new-project.ps1;
# can also be re-run manually at any time.
#
# Supported stacks:
#   Node.js    package.json          → npm install
#   Python     requirements.txt /    → .venv (mandatory) + pip install
#              pyproject.toml
#   Ruby       Gemfile               → bundle install
#   .NET       *.csproj / *.sln      → dotnet restore
#   Java       pom.xml (Maven)       → mvn dependency:resolve
#              build.gradle (Gradle) → gradlew dependencies
#   C/C++      CMakeLists.txt        → cmake -B build (configure only)
#              Makefile              → info only (not run automatically)
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
$IsWin = $true
$IsMac = $false
$IsLin = $false
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $IsMac = $IsMacOS
    $IsLin = $IsLinux
    $IsWin = -not ($IsMac -or $IsLin)
}
$OsLabel = if ($IsMac) { "macOS" } elseif ($IsLin) { "Linux" } else { "Windows" }
Info "Detected OS: $OsLabel (PowerShell $($PSVersionTable.PSVersion))"

# ── Helper: require a command or warn ────────────────────────────────────────
function Require {
    param([string]$Cmd, [string]$Hint)
    if (-not (Get-Command $Cmd -ErrorAction SilentlyContinue)) {
        Warn "$Cmd not found — $Hint"
        return $false
    }
    return $true
}

# ── Python binary resolution ──────────────────────────────────────────────────
$PyBin = $null
foreach ($candidate in @("python3", "python")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $ver = & $candidate --version 2>&1
        if ($ver -match "^Python 3") {
            $PyBin = $candidate
            break
        }
    }
}

# ── Python venv helpers ───────────────────────────────────────────────────────
function Activate-Venv {
    $scripts = @(".venv\Scripts\Activate.ps1", ".venv/bin/Activate.ps1")
    foreach ($s in $scripts) {
        if (Test-Path $s) { & $s; return }
    }
    Warn "Could not find venv Activate.ps1 — continuing without activation"
}

function Show-VenvHint {
    if ($IsWin) {
        Info "  Activate venv (PowerShell): .venv\Scripts\Activate.ps1"
        Info "  Activate venv (Git Bash):   source .venv/Scripts/activate"
    } else {
        Info "  Activate venv: source .venv/bin/activate"
    }
}

function Ensure-Venv {
    if (-not $PyBin) {
        Warn "Python 3 not found — skipping venv creation (install from https://python.org)"
        return $false
    }
    if (-not (Test-Path ".venv")) {
        Info "Creating Python virtual environment (.venv)…"
        & $PyBin -m venv .venv
        Pass ".venv created"
    } else {
        Info ".venv already exists — reusing"
    }
    Activate-Venv
    return $true
}

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

    # ── Node.js ────────────────────────────────────────────────────────────────
    if (Test-Path "package.json") {
        if (Require "npm" "install Node.js from https://nodejs.org") {
            Info "Node.js project detected — running npm install"
            npm install
            if ($LASTEXITCODE -eq 0) { Pass "npm install complete" }
        }
    }

    # ── Python (requirements.txt) ─────────────────────────────────────────────
    if (Test-Path "requirements.txt") {
        Info "Python project detected (requirements.txt)"
        if (Ensure-Venv) {
            pip install -r requirements.txt
            if ($LASTEXITCODE -eq 0) { Pass "pip install -r requirements.txt complete" }
            Show-VenvHint
        }
    }

    # ── Python (pyproject.toml, no requirements.txt) ──────────────────────────
    if ((Test-Path "pyproject.toml") -and (-not (Test-Path "requirements.txt"))) {
        Info "Python project detected (pyproject.toml)"
        if (Ensure-Venv) {
            pip install -e .
            if ($LASTEXITCODE -eq 0) { Pass "pip install -e . complete" }
            Show-VenvHint
        }
    }

    # ── Ruby ──────────────────────────────────────────────────────────────────
    if (Test-Path "Gemfile") {
        if (Require "bundle" "run: gem install bundler") {
            Info "Ruby project detected — running bundle install"
            bundle install
            if ($LASTEXITCODE -eq 0) { Pass "bundle install complete" }
        }
    }

    # ── .NET ──────────────────────────────────────────────────────────────────
    $dotnetProj = Get-ChildItem -Path . -Recurse -Depth 3 -Include "*.csproj","*.sln","*.fsproj" -ErrorAction SilentlyContinue |
                  Where-Object { $_.FullName -notmatch "\\.git\\" } |
                  Select-Object -First 1
    if ($dotnetProj) {
        if (Require "dotnet" "install .NET SDK from https://dotnet.microsoft.com/download") {
            Info ".NET project detected ($($dotnetProj.Name)) — running dotnet restore"
            dotnet restore
            if ($LASTEXITCODE -eq 0) { Pass "dotnet restore complete" }
        }
    }

    # ── Java / Maven ──────────────────────────────────────────────────────────
    if (Test-Path "pom.xml") {
        if (Require "mvn" "install Maven from https://maven.apache.org or use SDKMAN: sdk install maven") {
            Info "Maven project detected — running mvn dependency:resolve -q"
            mvn dependency:resolve -q
            if ($LASTEXITCODE -eq 0) { Pass "mvn dependency:resolve complete" }
        }
    }

    # ── Java / Gradle ─────────────────────────────────────────────────────────
    $gradleBuild = @("build.gradle", "build.gradle.kts") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($gradleBuild) {
        $gradleCmd = if (Test-Path "gradlew.bat") { ".\gradlew.bat" } elseif (Test-Path "./gradlew") { "bash ./gradlew" } else { "gradle" }
        $gradleExe = $gradleCmd.Split(" ")[0]
        if (Require $gradleExe "install Gradle from https://gradle.org or use SDKMAN: sdk install gradle") {
            Info "Gradle project detected — running $gradleCmd dependencies"
            Invoke-Expression "$gradleCmd dependencies -q"
            if ($LASTEXITCODE -eq 0) { Pass "Gradle dependencies resolved" }
        }
    }

    # ── C/C++ (CMake) ─────────────────────────────────────────────────────────
    if (Test-Path "CMakeLists.txt") {
        if (Require "cmake" "install CMake from https://cmake.org") {
            Info "CMake project detected — configuring build (cmake -B build)"
            cmake -B build -S . 2>&1 | Select-Object -Last 5
            if ($LASTEXITCODE -eq 0) {
                Pass "CMake configure complete — build artifacts in build\"
                Info "  To build: cmake --build build"
            }
        }
    }

    # ── C/C++ (plain Makefile, no CMake) ─────────────────────────────────────
    if ((Test-Path "Makefile") -and (-not (Test-Path "CMakeLists.txt"))) {
        $makeAvail = (Get-Command make -ErrorAction SilentlyContinue) -or (Get-Command nmake -ErrorAction SilentlyContinue)
        if ($makeAvail) {
            Info "Makefile detected — 'make' is available but NOT run automatically"
            Info "  Run manually: make"
        } else {
            Warn "Makefile detected but make/nmake not found"
            Warn "  Windows: install via 'winget install GnuWin32.Make' or Visual Studio Build Tools"
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
