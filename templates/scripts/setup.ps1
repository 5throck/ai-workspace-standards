# setup.ps1 — Post-scaffold environment setup (Windows PowerShell)
# Mirrors setup.sh exactly. Called automatically by new-project.ps1;
# can also be re-run manually at any time.
#
# Supported stacks:
#   Node.js    package.json          → npm install  → license-checker audit
#   Python     requirements.txt /    → .venv (mandatory) + pip install → pip-licenses audit
#              pyproject.toml
#   Ruby       Gemfile               → bundle install
#   .NET       *.csproj / *.sln      → dotnet restore
#   Java       pom.xml (Maven)       → mvn dependency:resolve
#              build.gradle (Gradle) → gradlew dependencies
#   C/C++      CMakeLists.txt        → cmake -B build (configure only)
#              Makefile              → info only (not run automatically)
#
# Usage: .\scripts\setup.ps1 [-SkipInstall] [-SkipLicenseCheck] [-SkipCommit]
param(
    [switch]$SkipInstall,
    [switch]$SkipLicenseCheck,
    [switch]$SkipCommit
)

function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "=== setup.ps1 — environment setup ===" -ForegroundColor Cyan

# OSI-approved licenses accepted by default
$OssLicenses = "MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Apache-1.1;CC0-1.0;CC-BY-3.0;CC-BY-4.0;Unlicense;0BSD;PSF-2.0;Python-2.0;MPL-2.0;LGPL-2.0;LGPL-2.1;LGPL-3.0;Artistic-2.0;Zlib;BlueOak-1.0.0"

# ── OS detection ──────────────────────────────────────────────────────────────
$IsWin = $true; $IsMac = $false; $IsLin = $false
if ($PSVersionTable.PSVersion.Major -ge 6) {
    $IsMac = $IsMacOS; $IsLin = $IsLinux; $IsWin = -not ($IsMac -or $IsLin)
}
$OsLabel = if ($IsMac) { "macOS" } elseif ($IsLin) { "Linux" } else { "Windows" }
Info "Detected OS: $OsLabel (PowerShell $($PSVersionTable.PSVersion))"

# ── Helper: require a command or warn ────────────────────────────────────────
function Require([string]$Cmd, [string]$Hint) {
    if (-not (Get-Command $Cmd -ErrorAction SilentlyContinue)) {
        Warn "$Cmd not found — $Hint"; return $false
    }
    return $true
}

# ── Python toolchain resolution (uv preferred, python -m venv fallback) ───────
$UvBin = if (Get-Command uv -ErrorAction SilentlyContinue) { "uv" } else { $null }

$PyBin = $null
foreach ($candidate in @("python3", "python")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $ver = & $candidate --version 2>&1
        if ($ver -match "^Python 3") { $PyBin = $candidate; break }
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

function Show-VenvHint([string]$Mgr = "pip") {
    if ($IsWin) {
        Info "  Activate venv (PowerShell): .venv\Scripts\Activate.ps1"
        Info "  Activate venv (Git Bash):   source .venv/Scripts/activate"
    } else {
        Info "  Activate venv: source .venv/bin/activate"
    }
    if ($Mgr -eq "uv") { Info "  Or skip activation: uv run <command>" }
}

# Ensure-Venv: creates .venv via uv (preferred) or python -m venv (fallback).
# Returns the manager string: "uv" or "pip".
function Ensure-Venv {
    if ($UvBin) {
        if (-not (Test-Path ".venv")) {
            Info "Creating Python virtual environment with uv (.venv)…"
            uv venv .venv; Pass ".venv created (uv)"
        } else { Info ".venv already exists — reusing (uv)" }
        Activate-Venv; return "uv"
    } elseif ($PyBin) {
        if (-not (Test-Path ".venv")) {
            Info "uv not found — creating .venv with $PyBin -m venv (fallback)"
            Info "  Install uv for faster installs: winget install astral-sh.uv  or  pip install uv"
            & $PyBin -m venv .venv; Pass ".venv created (venv)"
        } else { Info ".venv already exists — reusing" }
        Activate-Venv; return "pip"
    } else {
        Warn "Neither uv nor Python 3 found — skipping venv"
        Warn "  Install uv (recommended): winget install astral-sh.uv"
        Warn "  Or install Python 3: https://python.org"
        return $null
    }
}

# Py-Install: run 'uv pip install' or 'pip install' depending on manager.
function Py-Install([string]$Mgr, [string[]]$Args) {
    if ($Mgr -eq "uv") { uv pip install @Args }
    else                { pip install @Args }
}

# ── License audit helpers ─────────────────────────────────────────────────────
function Audit-NodeLicenses {
    if ($SkipLicenseCheck) { Info "Skipping license audit (-SkipLicenseCheck)"; return }
    Info "Running Node.js license audit…"
    if (Get-Command npx -ErrorAction SilentlyContinue) {
        $result = npx --yes license-checker --summary --onlyAllow $OssLicenses 2>&1
        if ($LASTEXITCODE -eq 0) {
            Pass "License audit passed — all packages use OSI-approved licenses"
        } else {
            Warn "⚠  License audit flagged non-OSS packages. Review before committing."
            Warn "   Run: npx license-checker --summary"
            Warn "   Document justified exceptions in docs/context.md § Non-OSS Dependencies"
        }
    } else { Warn "npx not available — skipping Node.js license audit" }
}

function Audit-PythonLicenses {
    if ($SkipLicenseCheck) { Info "Skipping license audit (-SkipLicenseCheck)"; return }
    Info "Running Python license audit…"
    if (-not (Get-Command pip-licenses -ErrorAction SilentlyContinue)) {
        Info "pip-licenses not installed — installing for audit…"
        if ($UvBin) { uv pip install pip-licenses --quiet 2>$null }
        else         { pip install pip-licenses --quiet 2>$null }
    }
    if (Get-Command pip-licenses -ErrorAction SilentlyContinue) {
        $report = pip-licenses --format=csv 2>$null
        $flagged = $report | Select-String -Pattern "GPL-3|AGPL|SSPL|BSL|Proprietary|Commercial" |
                   Where-Object { $_ -notmatch "^Name" }
        if (-not $flagged) {
            Pass "License audit passed — no restrictive licenses detected"
        } else {
            Warn "⚠  License audit flagged these packages:"
            $flagged | ForEach-Object { Warn "   $_" }
            Warn "   Document justified exceptions in docs/context.md § Non-OSS Dependencies"
        }
    } else { Warn "Could not install pip-licenses — skipping Python license audit" }
}

# ── 1. .env.sample → .env ─────────────────────────────────────────────────────
if (Test-Path ".env.sample") {
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.sample" ".env"
        Pass ".env created from .env.sample — fill in secrets before running the app"
    } else { Info ".env already exists — skipping copy" }
}

# ── 2. Dependency install + license audit (stack auto-detection) ──────────────
if (-not $SkipInstall) {

    # ── Node.js ────────────────────────────────────────────────────────────────
    if (Test-Path "package.json") {
        if (Require "npm" "install Node.js from https://nodejs.org") {
            Info "Node.js project detected — running npm install"
            npm install
            if ($LASTEXITCODE -eq 0) { Pass "npm install complete"; Audit-NodeLicenses }
        }
    }

    # ── Python (requirements.txt) ─────────────────────────────────────────────
    if (Test-Path "requirements.txt") {
        Info "Python project detected (requirements.txt)"
        $mgr = Ensure-Venv
        if ($mgr) {
            Py-Install $mgr @("-r", "requirements.txt")
            if ($LASTEXITCODE -eq 0) { Pass "Dependencies installed (requirements.txt) via $mgr"; Audit-PythonLicenses; Show-VenvHint $mgr }
        }
    }

    # ── Python (pyproject.toml, no requirements.txt) ──────────────────────────
    if ((Test-Path "pyproject.toml") -and (-not (Test-Path "requirements.txt"))) {
        Info "Python project detected (pyproject.toml)"
        $mgr = Ensure-Venv
        if ($mgr) {
            Py-Install $mgr @("-e", ".")
            if ($LASTEXITCODE -eq 0) { Pass "Dependencies installed (pyproject.toml) via $mgr"; Audit-PythonLicenses; Show-VenvHint $mgr }
        }
    }

    # ── Ruby ──────────────────────────────────────────────────────────────────
    if (Test-Path "Gemfile") {
        if (Require "bundle" "run: gem install bundler") {
            Info "Ruby project detected — running bundle install"
            bundle install
            if ($LASTEXITCODE -eq 0) {
                Pass "bundle install complete"
                if (-not $SkipLicenseCheck) {
                    Info "  Optional license audit: gem install licensee && licensee detect"
                }
            }
        }
    }

    # ── .NET ──────────────────────────────────────────────────────────────────
    $dotnetProj = Get-ChildItem -Path . -Recurse -Depth 3 `
        -Include "*.csproj","*.sln","*.fsproj" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch "\\.git\\" } | Select-Object -First 1
    if ($dotnetProj) {
        if (Require "dotnet" "install .NET SDK from https://dotnet.microsoft.com/download") {
            Info ".NET project detected ($($dotnetProj.Name)) — running dotnet restore"
            dotnet restore
            if ($LASTEXITCODE -eq 0) {
                Pass "dotnet restore complete"
                if (-not $SkipLicenseCheck) {
                    if (Get-Command dotnet-project-licenses -ErrorAction SilentlyContinue) {
                        Info "Running .NET license audit…"
                        dotnet-project-licenses --input . 2>$null
                    } else {
                        Info "  Optional license audit: dotnet tool install -g dotnet-project-licenses"
                    }
                }
            }
        }
    }

    # ── Java / Maven ──────────────────────────────────────────────────────────
    if (Test-Path "pom.xml") {
        if (Require "mvn" "install Maven from https://maven.apache.org or: sdk install maven") {
            Info "Maven project detected — running mvn dependency:resolve -q"
            mvn dependency:resolve -q
            if ($LASTEXITCODE -eq 0) {
                Pass "mvn dependency:resolve complete"
                if (-not $SkipLicenseCheck) {
                    Info "  Optional license audit: mvn license:aggregate-add-third-party"
                }
            }
        }
    }

    # ── Java / Gradle ─────────────────────────────────────────────────────────
    $gradleBuild = @("build.gradle","build.gradle.kts") | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($gradleBuild) {
        $gradleExe = if (Test-Path "gradlew.bat") { ".\gradlew.bat" } elseif (Test-Path "./gradlew") { "bash" } else { "gradle" }
        if (Require $gradleExe "install Gradle from https://gradle.org or: sdk install gradle") {
            Info "Gradle project detected — running dependencies"
            if ($gradleExe -eq "bash") { bash ./gradlew dependencies -q } else { & $gradleExe dependencies -q }
            if ($LASTEXITCODE -eq 0) {
                Pass "Gradle dependencies resolved"
                if (-not $SkipLicenseCheck) {
                    Info "  Optional license audit: add 'com.github.jk1:gradle-license-report' plugin"
                }
            }
        }
    }

    # ── Go ─────────────────────────────────────────────────────────────────────
    if (Test-Path "go.mod") {
        if (Require "go" "install Go from https://go.dev/dl/") {
            Info "Go project detected — running go mod download"
            go mod download
            if ($LASTEXITCODE -eq 0) {
                Pass "go mod download complete"
                if (-not $SkipLicenseCheck) { Info "  Optional license audit: go install github.com/google/go-licenses@latest" }
            }
        }
    }

    # ── Rust ──────────────────────────────────────────────────────────────────
    if (Test-Path "Cargo.toml") {
        if (Require "cargo" "install Rust from https://rustup.rs  (run: winget install Rustlang.Rustup)") {
            Info "Rust project detected — running cargo fetch"
            cargo fetch
            if ($LASTEXITCODE -eq 0) {
                Pass "cargo fetch complete"
                if (-not $SkipLicenseCheck) {
                    if (Get-Command cargo-license -ErrorAction SilentlyContinue) {
                        Info "Running Rust license audit (cargo-license)…"; cargo license 2>$null
                    } else { Info "  Optional license audit: cargo install cargo-license && cargo license" }
                }
            }
        }
    }

    # ── Elixir / Mix ──────────────────────────────────────────────────────────
    if (Test-Path "mix.exs") {
        if (Require "mix" "install Elixir from https://elixir-lang.org/install.html  or  winget install ElixirLang.Elixir") {
            Info "Elixir project detected — running mix deps.get"
            mix deps.get
            if ($LASTEXITCODE -eq 0) {
                Pass "mix deps.get complete"
                if (-not $SkipLicenseCheck) { Info "  Optional license audit: mix licenses (add licensir to deps)" }
            }
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
            Info "Makefile detected — 'make' available but NOT run automatically"
            Info "  Run manually: make"
        } else {
            Warn "Makefile detected but make/nmake not found"
            Warn "  Install: winget install GnuWin32.Make  or  Visual Studio Build Tools"
        }
    }

    # ── Unknown stack detection ───────────────────────────────────────────────
    $knownManifests = @(
        "package.json","requirements.txt","pyproject.toml","Gemfile",
        "go.mod","Cargo.toml","mix.exs",
        "pom.xml","build.gradle","build.gradle.kts",
        "CMakeLists.txt","Makefile"
    )
    $foundStack = ($knownManifests | Where-Object { Test-Path $_ }).Count -gt 0
    if (-not $foundStack) {
        $dotnetFound = Get-ChildItem -Path . -Recurse -Depth 3 -Include "*.csproj","*.sln","*.fsproj" `
                       -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "\\.git\\" }
        if ($dotnetFound) { $foundStack = $true }
    }

    if (-not $foundStack) {
        Write-Host ""
        Write-Host ("━" * 60) -ForegroundColor DarkGray
        Write-Host "⚠  UNKNOWN STACK — manual setup required" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  No recognized project manifest found in this directory."
        Write-Host "  Automatic dependency installation has been skipped."
        Write-Host ""
        Write-Host "  To set up this project, invoke the stack-setup agent:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "    Agent: agents/stack-setup.md" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  The agent will:"
        Write-Host "    1. Search for the correct setup procedure for your stack"
        Write-Host "    2. Perform a security review of all proposed commands"
        Write-Host "    3. Present the plan with risk assessment for your approval"
        Write-Host "    4. Execute ONLY after explicit confirmation"
        Write-Host ""
        Write-Host "  ⛔ Do NOT run any install commands without agent security review." -ForegroundColor Red
        Write-Host ("━" * 60) -ForegroundColor DarkGray
        Write-Host ""
    }

} else { Info "Skipping dependency install (-SkipInstall)" }

# ── 3. Gemini Plugins Setup ───────────────────────────────────────────────────
$SuperpowersDir = Join-Path $HOME ".gemini\config\plugins\superpowers"
if (-not (Test-Path $SuperpowersDir)) {
    Info "Gemini superpowers plugin not found — installing globally…"
    $PluginsDir = Join-Path $HOME ".gemini\config\plugins"
    if (-not (Test-Path $PluginsDir)) { New-Item -ItemType Directory -Path $PluginsDir -Force | Out-Null }
    git clone https://github.com/obra/superpowers $SuperpowersDir 2>$null
    if ($LASTEXITCODE -eq 0) { Pass "superpowers plugin installed successfully" }
    else { Warn "Failed to install superpowers plugin" }
}

# ── 4. Initialize CodeGraph MCP ───────────────────────────────────────────────
if (Get-Command npx -ErrorAction SilentlyContinue) {
    Info "Initializing and indexing CodeGraph for AI context…"
    npx -y @colbymchenry/codegraph init 2>$null
    npx -y @colbymchenry/codegraph index 2>$null
    if ($LASTEXITCODE -eq 0) { Pass "CodeGraph initialized successfully" }
    else { Warn "Failed to initialize CodeGraph" }
} else {
    Warn "npx not found — skipping CodeGraph initialization"
}

# ── 5. Initialize memory log ──────────────────────────────────────────────────
$Date = Get-Date -Format "yyyy-MM-dd"
if (-not (Test-Path "memory")) { New-Item -ItemType Directory -Path "memory" -Force | Out-Null }
$LogPath = "memory\$Date.md"
if (-not (Test-Path $LogPath)) {
    Add-Content $LogPath "## Session — chore: initial scaffold`n`n- Project successfully scaffolded from workspace templates.`n"
}
$IndexPath = "memory\MEMORY.md"
if (Test-Path $IndexPath) {
    $IndexContent = Get-Content $IndexPath -Raw
    if ($IndexContent -notmatch "\[$Date\]") {
        Add-Content $IndexPath "| [$Date]($Date.md) | chore: initial scaffold |"
    }
}

# ── 6. Initial commit ─────────────────────────────────────────────────────────
if (-not $SkipCommit) {
    $gitDir = git rev-parse --git-dir 2>$null
    if ($LASTEXITCODE -eq 0) {
        git add -A 2>$null
        $msg = "chore: initial scaffold`n`nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
        git commit -m $msg 2>$null
        if ($LASTEXITCODE -eq 0) { Pass "Initial commit created" } else { Warn "Nothing to commit (already committed?)" }
    } else { Warn "Not inside a git repository — skipping initial commit" }
} else { Info "Skipping initial commit (-SkipCommit)" }

Write-Host ""
Write-Host "✅ Setup complete." -ForegroundColor Green
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  git remote add origin <url>"
Write-Host "  git push -u origin main"

