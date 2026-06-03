#!/usr/bin/env bash
# setup.sh - Post-scaffold environment setup
# Detects OS and tech stack, installs dependencies, audits licenses, copies .env,
# and makes initial commit.
# Called automatically by new-project.sh; can also be re-run manually at any time.
#
# Supported stacks:
#   Node.js    package.json          → npm install  → license-checker audit
#   Python     requirements.txt /    → uv venv + uv pip install (fallback: python -m venv + pip)
#              pyproject.toml           → pip-licenses audit
#   Ruby       Gemfile               → bundle install
#   .NET       *.csproj / *.sln      → dotnet restore
#   Java       pom.xml (Maven)       → mvn dependency:resolve
#              build.gradle (Gradle) → ./gradlew dependencies
#   Go         go.mod                → go mod download
#   Rust       Cargo.toml            → cargo fetch
#   Elixir     mix.exs               → mix deps.get
#   C/C++      CMakeLists.txt        → cmake -B build (configure only)
#              Makefile              → info only (not run automatically)
#   Unknown    (none of the above)   → stack-setup agent invocation required
#
# Usage: bash scripts/setup.sh [--skip-install] [--skip-license-check] [--skip-commit]

# Force English locale for consistent error messages
export LC_ALL=C
export LANG=C

set -euo pipefail

SKIP_INSTALL=false
SKIP_LICENSE=false
SKIP_COMMIT=false
for arg in "$@"; do
  case "$arg" in
    --skip-install)        SKIP_INSTALL=true ;;
    --skip-license-check)  SKIP_LICENSE=true ;;
    --skip-commit)         SKIP_COMMIT=true ;;
  esac
done

pass() { echo -e "\033[32m[PASS]\033[0m $*"; }
info() { echo -e "\033[36m[INFO]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }

# OSI-approved licenses accepted by default
# Extend this list in docs/context.md if the project requires additional licenses.
OSS_LICENSES="MIT;ISC;BSD-2-Clause;BSD-3-Clause;Apache-2.0;Apache-1.1;CC0-1.0;CC-BY-3.0;CC-BY-4.0;Unlicense;0BSD;PSF-2.0;Python-2.0;MPL-2.0;LGPL-2.0;LGPL-2.1;LGPL-3.0;Artistic-2.0;Zlib;BlueOak-1.0.0"

echo "=== setup.sh - environment setup ==="

# ── OS detection ──────────────────────────────────────────────────────────────
OS_TYPE="unknown"
case "$(uname -s 2>/dev/null)" in
  Darwin)               OS_TYPE="macos" ;;
  Linux)                OS_TYPE="linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS_TYPE="windows-bash" ;;
  *)
    if [ -n "${OS:-}" ] && [ "$OS" = "Windows_NT" ]; then
      OS_TYPE="windows-bash"
    fi
    ;;
esac
info "Detected OS: $OS_TYPE"

# ── Helper: require a command or warn and skip ────────────────────────────────
require() {
  local cmd="$1" hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    warn "$cmd not found - $hint"
    return 1
  fi
  return 0
}

# ── Python toolchain resolution (uv preferred, python -m venv fallback) ───────
UV_BIN=""
if command -v uv &>/dev/null; then
  UV_BIN="uv"
fi

PY_BIN=""
if command -v python3 &>/dev/null; then
  PY_BIN="python3"
elif command -v python &>/dev/null; then
  # Guard against 'python' aliased to Python 2
  if python --version 2>&1 | grep -q "^Python 3"; then
    PY_BIN="python"
  fi
fi

# ── Python venv helpers ───────────────────────────────────────────────────────
activate_venv() {
  if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/bin/activate
  elif [ -f ".venv/Scripts/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/Scripts/activate
  else
    warn "Could not find venv activate script - continuing without activation"
  fi
}

venv_activate_hint() {
  local mgr="${1:-pip}"
  if [ "$OS_TYPE" = "macos" ] || [ "$OS_TYPE" = "linux" ]; then
    info "  Activate venv: source .venv/bin/activate"
  else
    info "  Activate venv (Git Bash): source .venv/Scripts/activate"
    info "  Activate venv (PowerShell): .venv\\Scripts\\Activate.ps1"
  fi
  if [ "$mgr" = "uv" ]; then
    info "  Or skip activation entirely: uv run <command>"
  fi
}

# ensure_venv: creates .venv via uv (preferred) or python -m venv (fallback).
# Prints the manager used ("uv" or "pip") to stdout - capture with $(...).
ensure_venv() {
  if [ -n "$UV_BIN" ]; then
    if [ ! -d ".venv" ]; then
      info "Creating Python virtual environment with uv (.venv)…"
      uv venv .venv
      pass ".venv created (uv)"
    else
      info ".venv already exists - reusing (uv)"
    fi
    activate_venv
    echo "uv"
    return 0
  elif [ -n "$PY_BIN" ]; then
    if [ ! -d ".venv" ]; then
      info "uv not found - creating .venv with $PY_BIN -m venv (fallback)"
      info "  Install uv for faster installs: curl -LsSf https://astral.sh/uv/install.sh | sh"
      "$PY_BIN" -m venv .venv
      pass ".venv created (venv)"
    else
      info ".venv already exists - reusing"
    fi
    activate_venv
    echo "pip"
    return 0
  else
    warn "Neither uv nor Python 3 found - skipping venv"
    warn "  Install uv (recommended): curl -LsSf https://astral.sh/uv/install.sh | sh"
    warn "  Or install Python 3: https://python.org"
    return 1
  fi
}

# py_install: run 'uv pip install' or 'pip install' depending on manager.
py_install() {
  local mgr="$1"; shift
  if [ "$mgr" = "uv" ]; then
    uv pip install "$@"
  else
    pip install "$@"
  fi
}

# ── License audit helpers ─────────────────────────────────────────────────────
license_audit_node() {
  if [ "$SKIP_LICENSE" = true ]; then
    info "Skipping license audit (--skip-license-check)"
    return
  fi
  info "Running Node.js license audit…"
  if command -v npx &>/dev/null; then
    if npx --yes license-checker --summary --onlyAllow "$OSS_LICENSES" 2>/dev/null; then
      pass "License audit passed - all packages use OSI-approved licenses"
    else
      warn "⚠  License audit flagged non-OSS packages. Review before committing."
      warn "   Run: npx license-checker --summary"
      warn "   Document any justified exceptions in docs/context.md § Non-OSS Dependencies"
    fi
  else
    warn "npx not available - skipping Node.js license audit"
  fi
}

license_audit_python() {
  if [ "$SKIP_LICENSE" = true ]; then
    info "Skipping license audit (--skip-license-check)"
    return
  fi
  info "Running Python license audit…"
  if command -v pip-licenses &>/dev/null; then
    # Warn-only on non-OSS: list packages, grep for non-permissive licenses
    local report
    report=$(pip-licenses --format=csv 2>/dev/null) || { warn "pip-licenses failed - skipping audit"; return; }
    local flagged
    flagged=$(echo "$report" | grep -iE "GPL-3|AGPL|SSPL|BSL|Proprietary|Commercial" | grep -v "^Name" || true)
    if [ -z "$flagged" ]; then
      pass "License audit passed - no restrictive licenses detected"
    else
      warn "⚠  License audit flagged these packages:"
      echo "$flagged" | while IFS= read -r line; do warn "   $line"; done
      warn "   Document any justified exceptions in docs/context.md § Non-OSS Dependencies"
    fi
  else
    info "pip-licenses not installed - installing for audit…"
    local install_cmd="pip"
    [ -n "$UV_BIN" ] && install_cmd="uv pip"
    if $install_cmd install pip-licenses --quiet 2>/dev/null; then
      license_audit_python  # re-run now that it's installed
    else
      warn "Could not install pip-licenses - skipping Python license audit"
      warn "   Manual check: pip install pip-licenses && pip-licenses --format=csv"
    fi
  fi
}

# ── 1. .env.sample → .env ─────────────────────────────────────────────────────
if [ -f ".env.sample" ]; then
  if [ ! -f ".env" ]; then
    cp .env.sample .env
    pass ".env created from .env.sample - fill in secrets before running the app"
  else
    info ".env already exists - skipping copy"
  fi
fi

# ── 2. Dependency install + license audit (stack auto-detection) ──────────────
if [ "$SKIP_INSTALL" = false ]; then

  # ── Bun Agent Orchestration ────────────────────────────────────────────────
  if [ -f "scripts/package.json" ]; then
    if require bun "install Bun using bash scripts/install-bun.sh"; then
      info "Agent orchestration (Bun) detected - running bun install in scripts/"
      (cd scripts && bun install)
      pass "bun install complete"
    fi
  fi

  # ── Node.js ────────────────────────────────────────────────────────────────
  # Skip if package.json is a workspace-management artifact (sentinel: "workspace-scripts": true).
  # Workspace root package.json contains bun/audit/dev-sync scripts only — not app dependencies.
  # New projects that genuinely need Node.js should have their own package.json without this field.
  if [ -f "package.json" ]; then
    if grep -q '"workspace-scripts"\s*:\s*true' "package.json" 2>/dev/null; then
      info "Skipping npm install — package.json is a workspace-scripts artifact (not an app manifest)"
    else
      if require npm "install Node.js from https://nodejs.org"; then
        info "Node.js project detected - running npm install"
        npm install
        pass "npm install complete"
        license_audit_node
      fi
    fi
  fi

  # ── Python (requirements.txt) ─────────────────────────────────────────────
  if [ -f "requirements.txt" ]; then
    info "Python project detected (requirements.txt)"
    mgr=$(ensure_venv) && {
      py_install "$mgr" -r requirements.txt
      pass "Dependencies installed (requirements.txt) via $mgr"
      license_audit_python
      venv_activate_hint "$mgr"
    }
  fi

  # ── Python (pyproject.toml, no requirements.txt) ──────────────────────────
  if [ -f "pyproject.toml" ] && [ ! -f "requirements.txt" ]; then
    info "Python project detected (pyproject.toml)"
    mgr=$(ensure_venv) && {
      py_install "$mgr" -e .
      pass "Dependencies installed (pyproject.toml) via $mgr"
      license_audit_python
      venv_activate_hint "$mgr"
    }
  fi

  # ── Ruby ──────────────────────────────────────────────────────────────────
  if [ -f "Gemfile" ]; then
    if require bundle "run: gem install bundler"; then
      info "Ruby project detected - running bundle install"
      bundle install
      pass "bundle install complete"
      if [ "$SKIP_LICENSE" = false ]; then
        if command -v licensee &>/dev/null; then
          info "Running Ruby license audit (licensee)…"
          licensee detect --json 2>/dev/null | grep -i "spdx_id" || true
        else
          info "  Optional license audit: gem install licensee && licensee detect"
        fi
      fi
    fi
  fi

  # ── .NET ──────────────────────────────────────────────────────────────────
  DOTNET_PROJ=$(find . -maxdepth 3 \( -name "*.csproj" -o -name "*.sln" -o -name "*.fsproj" \) \
    -not -path "./.git/*" 2>/dev/null | head -1)
  if [ -n "$DOTNET_PROJ" ]; then
    if require dotnet "install .NET SDK from https://dotnet.microsoft.com/download"; then
      info ".NET project detected ($DOTNET_PROJ) - running dotnet restore"
      dotnet restore
      pass "dotnet restore complete"
      if [ "$SKIP_LICENSE" = false ]; then
        if command -v dotnet-project-licenses &>/dev/null; then
          info "Running .NET license audit…"
          dotnet-project-licenses --input . 2>/dev/null || warn "License audit failed - run manually: dotnet-project-licenses --input ."
        else
          info "  Optional license audit: dotnet tool install -g dotnet-project-licenses"
        fi
      fi
    fi
  fi

  # ── Java / Maven ──────────────────────────────────────────────────────────
  if [ -f "pom.xml" ]; then
    if require mvn "install Maven from https://maven.apache.org or: sdk install maven"; then
      info "Maven project detected - running mvn dependency:resolve -q"
      mvn dependency:resolve -q
      pass "mvn dependency:resolve complete"
      if [ "$SKIP_LICENSE" = false ]; then
        info "  Optional license audit: mvn license:aggregate-add-third-party"
      fi
    fi
  fi

  # ── Java / Gradle ─────────────────────────────────────────────────────────
  if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
    GRADLE_CMD="./gradlew"
    [ ! -f "./gradlew" ] && GRADLE_CMD="gradle"
    if require "$GRADLE_CMD" "install Gradle from https://gradle.org or: sdk install gradle"; then
      info "Gradle project detected - running $GRADLE_CMD dependencies (quiet)"
      "$GRADLE_CMD" dependencies -q 2>/dev/null || "$GRADLE_CMD" dependencies
      pass "Gradle dependencies resolved"
      if [ "$SKIP_LICENSE" = false ]; then
        info "  Optional license audit: add 'com.github.jk1:gradle-license-report' plugin"
      fi
    fi
  fi

  # ── Go ─────────────────────────────────────────────────────────────────────
  if [ -f "go.mod" ]; then
    if require go "install Go from https://go.dev/dl/"; then
      info "Go project detected - running go mod download"
      go mod download
      pass "go mod download complete"
      if [ "$SKIP_LICENSE" = false ]; then
        info "  Optional license audit: go install github.com/google/go-licenses@latest"
      fi
    fi
  fi

  # ── Rust ───────────────────────────────────────────────────────────────────
  if [ -f "Cargo.toml" ]; then
    if require cargo "install Rust from https://rustup.rs  (run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh)"; then
      info "Rust project detected - running cargo fetch"
      cargo fetch
      pass "cargo fetch complete"
      if [ "$SKIP_LICENSE" = false ]; then
        if command -v cargo-license &>/dev/null; then
          info "Running Rust license audit (cargo-license)…"
          cargo license 2>/dev/null || true
        else
          info "  Optional license audit: cargo install cargo-license && cargo license"
        fi
      fi
    fi
  fi

  # ── Elixir / Mix ──────────────────────────────────────────────────────────
  if [ -f "mix.exs" ]; then
    if require mix "install Elixir from https://elixir-lang.org/install.html or: brew install elixir"; then
      info "Elixir project detected - running mix deps.get"
      mix deps.get
      pass "mix deps.get complete"
      if [ "$SKIP_LICENSE" = false ]; then
        info "  Optional license audit: mix licenses (add {:licenses, github: 'unnawut/licensir'} to deps)"
      fi
    fi
  fi

  # ── C/C++ (CMake) ─────────────────────────────────────────────────────────
  if [ -f "CMakeLists.txt" ]; then
    if require cmake "install CMake from https://cmake.org"; then
      info "CMake project detected - configuring build (cmake -B build)"
      cmake -B build -S . 2>&1 | tail -5
      pass "CMake configure complete - build artifacts in build/"
      info "  To build: cmake --build build"
    fi
  fi

  # ── C/C++ (plain Makefile, no CMake) ─────────────────────────────────────
  if [ -f "Makefile" ] && [ ! -f "CMakeLists.txt" ]; then
    if require make "Linux: apt install build-essential · macOS: xcode-select --install"; then
      info "Makefile detected - 'make' available but NOT run automatically"
      info "  Run manually: make"
    fi
  fi

  # ── Unknown stack detection ───────────────────────────────────────────────
  # If none of the known manifest files were found, flag for agent-assisted setup.
  KNOWN_MANIFESTS=(
    "package.json" "requirements.txt" "pyproject.toml" "Gemfile"
    "go.mod" "Cargo.toml" "mix.exs"
    "pom.xml" "build.gradle" "build.gradle.kts"
    "CMakeLists.txt" "Makefile"
  )
  _found_stack=false
  for _m in "${KNOWN_MANIFESTS[@]}"; do
    [ -f "$_m" ] && _found_stack=true && break
  done
  # Also check for .NET projects (depth search already done above)
  [ -n "$(find . -maxdepth 3 \( -name '*.csproj' -o -name '*.sln' \) -not -path './.git/*' 2>/dev/null | head -1)" ] && _found_stack=true

  if [ "$_found_stack" = false ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "\033[33m⚠  UNKNOWN STACK - manual setup required\033[0m"
    echo ""
    echo "  No recognized project manifest found in this directory."
    echo "  Automatic dependency installation has been skipped."
    echo ""
    echo "  To set up this project, invoke the stack-setup agent:"
    echo ""
    echo -e "  \033[36m  Agent: agents/stack-setup.md\033[0m"
    echo ""
    echo "  The agent will:"
    echo "    1. Search for the correct setup procedure for your stack"
    echo "    2. Perform a security review of all proposed commands"
    echo "    3. Present the plan with risk assessment for your approval"
    echo "    4. Execute ONLY after explicit confirmation"
    echo ""
    echo -e "  \033[31m  ⛔ Do NOT run any install commands without agent security review.\033[0m"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
  fi

else
  info "Skipping dependency install (--skip-install)"
fi

# ── 3. Gemini Plugins Setup ───────────────────────────────────────────────────
SUPERPOWERS_DIR="$HOME/.gemini/config/plugins/superpowers"
if [ ! -d "$SUPERPOWERS_DIR" ]; then
    info "Gemini superpowers plugin not found - installing globally…"
    mkdir -p "$HOME/.gemini/config/plugins"
    if git clone https://github.com/obra/superpowers "$SUPERPOWERS_DIR" 2>/dev/null; then
        pass "superpowers plugin installed successfully"
    else
        warn "Failed to install superpowers plugin"
    fi
fi

# ── 4. Install RTK (Rust Token Killer) ────────────────────────────────────────
if [ "$OS_TYPE" = "macos" ] || [ "$OS_TYPE" = "linux" ]; then
    if ! command -v rtk >/dev/null 2>&1; then
        info "Installing rtk (Rust Token Killer) for AI token optimization…"
        if command -v brew >/dev/null 2>&1; then
            brew install rtk
            pass "rtk installed via Homebrew"
        elif command -v cargo >/dev/null 2>&1; then
            cargo install --git https://github.com/rtk-ai/rtk --rev main  # TODO: pin to specific --rev <sha> before production
            pass "rtk installed via Cargo"
        else
            warn "Neither Homebrew nor Cargo found - skipping rtk installation."
        fi
    else
        info "rtk is already installed."
    fi
else
    info "Skipping rtk installation (Windows native is not fully supported)."
    info "  Note: If you run this script inside WSL, it will be detected as Linux and install rtk normally."
fi

# ── 5. Initialize CodeGraph MCP ───────────────────────────────────────────────
if command -v npx >/dev/null 2>&1; then
    info "Initializing and indexing CodeGraph for AI context…"
    echo "2" | npx @colbymchenry/codegraph@0.9.7 init 2>/dev/null || true
    npx @colbymchenry/codegraph@0.9.7 index 2>/dev/null || true
    npx @colbymchenry/codegraph@0.9.7 sync 2>/dev/null || true
    if [ $? -eq 0 ]; then
        pass "CodeGraph initialized successfully"
    else
        warn "Failed to initialize CodeGraph"
    fi
else
    warn "npx not found - skipping CodeGraph initialization"
fi

# ── 6. Initialize memory log ──────────────────────────────────────────────────
DATE_STR=$(date +%Y-%m-%d)
mkdir -p memory
LOG_PATH="memory/${DATE_STR}.md"
if [ ! -f "$LOG_PATH" ]; then
  echo -e "## Session - chore: initial scaffold\n\n- Project successfully scaffolded from workspace templates.\n" > "$LOG_PATH"
fi
INDEX_PATH="memory/MEMORY.md"
if [ -f "$INDEX_PATH" ]; then
  if ! grep -q "\[${DATE_STR}\]" "$INDEX_PATH"; then
    echo "| [${DATE_STR}](${DATE_STR}.md) | chore: initial scaffold |" >> "$INDEX_PATH"
  fi
fi

# ── 7. Initial commit ─────────────────────────────────────────────────────────
if [ "$SKIP_COMMIT" = false ]; then
  if git rev-parse --git-dir > /dev/null 2>&1; then
    git add -A 2>/dev/null
    if git commit -m "chore: initial scaffold"; then
      pass "Initial commit created"
    else
      warn "Nothing to commit (already committed?)"
    fi
  else
    warn "Not inside a git repository - skipping initial commit"
  fi
else
  info "Skipping initial commit (--skip-commit)"
fi

echo ""
echo -e "\033[32m✅ Setup complete.\033[0m"
echo ""
echo "Next:"
echo "  git remote add origin <url>"
echo "  git push -u origin main"
