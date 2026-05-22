#!/usr/bin/env bash
# setup.sh — Post-scaffold environment setup
# Detects OS and tech stack, installs dependencies, audits licenses, copies .env,
# and makes initial commit.
# Called automatically by new-project.sh; can also be re-run manually at any time.
#
# Supported stacks:
#   Node.js    package.json          → npm install  → license-checker audit
#   Python     requirements.txt /    → .venv (mandatory) + pip install → pip-licenses audit
#              pyproject.toml
#   Ruby       Gemfile               → bundle install
#   .NET       *.csproj / *.sln      → dotnet restore
#   Java       pom.xml (Maven)       → mvn dependency:resolve
#              build.gradle (Gradle) → ./gradlew dependencies
#   C/C++      CMakeLists.txt        → cmake -B build (configure only)
#              Makefile              → info only (not run automatically)
#
# Usage: bash scripts/setup.sh [--skip-install] [--skip-license-check] [--skip-commit]
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

echo "=== setup.sh — environment setup ==="

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
    warn "$cmd not found — $hint"
    return 1
  fi
  return 0
}

# ── Python binary resolution ──────────────────────────────────────────────────
PY_BIN=""
if command -v python3 &>/dev/null; then
  PY_BIN="python3"
elif command -v python &>/dev/null; then
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
    warn "Could not find venv activate script — continuing without activation"
  fi
}

venv_activate_hint() {
  if [ "$OS_TYPE" = "macos" ] || [ "$OS_TYPE" = "linux" ]; then
    info "  Activate venv: source .venv/bin/activate"
  else
    info "  Activate venv (Git Bash): source .venv/Scripts/activate"
    info "  Activate venv (PowerShell): .venv\\Scripts\\Activate.ps1"
  fi
}

ensure_venv() {
  if [ -z "$PY_BIN" ]; then
    warn "Python 3 not found — skipping venv creation (install from https://python.org)"
    return 1
  fi
  if [ ! -d ".venv" ]; then
    info "Creating Python virtual environment (.venv)…"
    "$PY_BIN" -m venv .venv
    pass ".venv created"
  else
    info ".venv already exists — reusing"
  fi
  activate_venv
  return 0
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
      pass "License audit passed — all packages use OSI-approved licenses"
    else
      warn "⚠  License audit flagged non-OSS packages. Review before committing."
      warn "   Run: npx license-checker --summary"
      warn "   Document any justified exceptions in docs/context.md § Non-OSS Dependencies"
    fi
  else
    warn "npx not available — skipping Node.js license audit"
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
    report=$(pip-licenses --format=csv 2>/dev/null) || { warn "pip-licenses failed — skipping audit"; return; }
    local flagged
    flagged=$(echo "$report" | grep -iE "GPL-3|AGPL|SSPL|BSL|Proprietary|Commercial" | grep -v "^Name" || true)
    if [ -z "$flagged" ]; then
      pass "License audit passed — no restrictive licenses detected"
    else
      warn "⚠  License audit flagged these packages:"
      echo "$flagged" | while IFS= read -r line; do warn "   $line"; done
      warn "   Document any justified exceptions in docs/context.md § Non-OSS Dependencies"
    fi
  else
    info "pip-licenses not installed — installing for audit…"
    if pip install pip-licenses --quiet 2>/dev/null; then
      license_audit_python  # re-run now that it's installed
    else
      warn "Could not install pip-licenses — skipping Python license audit"
      warn "   Manual check: pip install pip-licenses && pip-licenses --format=csv"
    fi
  fi
}

# ── 1. .env.sample → .env ─────────────────────────────────────────────────────
if [ -f ".env.sample" ]; then
  if [ ! -f ".env" ]; then
    cp .env.sample .env
    pass ".env created from .env.sample — fill in secrets before running the app"
  else
    info ".env already exists — skipping copy"
  fi
fi

# ── 2. Dependency install + license audit (stack auto-detection) ──────────────
if [ "$SKIP_INSTALL" = false ]; then

  # ── Node.js ────────────────────────────────────────────────────────────────
  if [ -f "package.json" ]; then
    if require npm "install Node.js from https://nodejs.org"; then
      info "Node.js project detected — running npm install"
      npm install
      pass "npm install complete"
      license_audit_node
    fi
  fi

  # ── Python (requirements.txt) ─────────────────────────────────────────────
  if [ -f "requirements.txt" ]; then
    info "Python project detected (requirements.txt)"
    if ensure_venv; then
      pip install -r requirements.txt
      pass "pip install -r requirements.txt complete"
      license_audit_python
      venv_activate_hint
    fi
  fi

  # ── Python (pyproject.toml, no requirements.txt) ──────────────────────────
  if [ -f "pyproject.toml" ] && [ ! -f "requirements.txt" ]; then
    info "Python project detected (pyproject.toml)"
    if ensure_venv; then
      pip install -e .
      pass "pip install -e . complete"
      license_audit_python
      venv_activate_hint
    fi
  fi

  # ── Ruby ──────────────────────────────────────────────────────────────────
  if [ -f "Gemfile" ]; then
    if require bundle "run: gem install bundler"; then
      info "Ruby project detected — running bundle install"
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
      info ".NET project detected ($DOTNET_PROJ) — running dotnet restore"
      dotnet restore
      pass "dotnet restore complete"
      if [ "$SKIP_LICENSE" = false ]; then
        if command -v dotnet-project-licenses &>/dev/null; then
          info "Running .NET license audit…"
          dotnet-project-licenses --input . 2>/dev/null || warn "License audit failed — run manually: dotnet-project-licenses --input ."
        else
          info "  Optional license audit: dotnet tool install -g dotnet-project-licenses"
        fi
      fi
    fi
  fi

  # ── Java / Maven ──────────────────────────────────────────────────────────
  if [ -f "pom.xml" ]; then
    if require mvn "install Maven from https://maven.apache.org or: sdk install maven"; then
      info "Maven project detected — running mvn dependency:resolve -q"
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
      info "Gradle project detected — running $GRADLE_CMD dependencies (quiet)"
      "$GRADLE_CMD" dependencies -q 2>/dev/null || "$GRADLE_CMD" dependencies
      pass "Gradle dependencies resolved"
      if [ "$SKIP_LICENSE" = false ]; then
        info "  Optional license audit: add 'com.github.jk1:gradle-license-report' plugin"
      fi
    fi
  fi

  # ── C/C++ (CMake) ─────────────────────────────────────────────────────────
  if [ -f "CMakeLists.txt" ]; then
    if require cmake "install CMake from https://cmake.org"; then
      info "CMake project detected — configuring build (cmake -B build)"
      cmake -B build -S . 2>&1 | tail -5
      pass "CMake configure complete — build artifacts in build/"
      info "  To build: cmake --build build"
    fi
  fi

  # ── C/C++ (plain Makefile, no CMake) ─────────────────────────────────────
  if [ -f "Makefile" ] && [ ! -f "CMakeLists.txt" ]; then
    if require make "Linux: apt install build-essential · macOS: xcode-select --install"; then
      info "Makefile detected — 'make' available but NOT run automatically"
      info "  Run manually: make"
    fi
  fi

else
  info "Skipping dependency install (--skip-install)"
fi

# ── 3. Initial commit ─────────────────────────────────────────────────────────
if [ "$SKIP_COMMIT" = false ]; then
  if git rev-parse --git-dir > /dev/null 2>&1; then
    git add -A
    if git commit -m "chore: initial scaffold

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" 2>/dev/null; then
      pass "Initial commit created"
    else
      warn "Nothing to commit (already committed?)"
    fi
  else
    warn "Not inside a git repository — skipping initial commit"
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
