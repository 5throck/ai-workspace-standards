#!/usr/bin/env bash
# setup.sh — Post-scaffold environment setup
# Detects OS and tech stack, installs dependencies, copies .env, and makes initial commit.
# Called automatically by new-project.sh; can also be re-run manually at any time.
#
# Supported stacks:
#   Node.js    package.json          → npm install
#   Python     requirements.txt /    → .venv (mandatory) + pip install
#              pyproject.toml
#   Ruby       Gemfile               → bundle install
#   .NET       *.csproj / *.sln      → dotnet restore
#   Java       pom.xml (Maven)       → mvn dependency:resolve
#              build.gradle (Gradle) → ./gradlew dependencies
#   C/C++      CMakeLists.txt        → cmake -B build (configure only)
#              Makefile              → make (info-only, user confirms)
#
# Usage: bash scripts/setup.sh [--skip-install] [--skip-commit]
set -euo pipefail

SKIP_INSTALL=false
SKIP_COMMIT=false
for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=true ;;
    --skip-commit)  SKIP_COMMIT=true ;;
  esac
done

pass() { echo -e "\033[32m[PASS]\033[0m $*"; }
info() { echo -e "\033[36m[INFO]\033[0m $*"; }
warn() { echo -e "\033[33m[WARN]\033[0m $*"; }

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

# ── 1. .env.sample → .env ─────────────────────────────────────────────────────
if [ -f ".env.sample" ]; then
  if [ ! -f ".env" ]; then
    cp .env.sample .env
    pass ".env created from .env.sample — fill in secrets before running the app"
  else
    info ".env already exists — skipping copy"
  fi
fi

# ── 2. Dependency install (stack auto-detection) ──────────────────────────────
if [ "$SKIP_INSTALL" = false ]; then

  # ── Node.js ────────────────────────────────────────────────────────────────
  if [ -f "package.json" ]; then
    if require npm "install Node.js from https://nodejs.org"; then
      info "Node.js project detected — running npm install"
      npm install
      pass "npm install complete"
    fi
  fi

  # ── Python (requirements.txt) ─────────────────────────────────────────────
  if [ -f "requirements.txt" ]; then
    info "Python project detected (requirements.txt)"
    if ensure_venv; then
      pip install -r requirements.txt
      pass "pip install -r requirements.txt complete"
      venv_activate_hint
    fi
  fi

  # ── Python (pyproject.toml, no requirements.txt) ──────────────────────────
  if [ -f "pyproject.toml" ] && [ ! -f "requirements.txt" ]; then
    info "Python project detected (pyproject.toml)"
    if ensure_venv; then
      pip install -e .
      pass "pip install -e . complete"
      venv_activate_hint
    fi
  fi

  # ── Ruby ──────────────────────────────────────────────────────────────────
  if [ -f "Gemfile" ]; then
    if require bundle "run: gem install bundler"; then
      info "Ruby project detected — running bundle install"
      bundle install
      pass "bundle install complete"
    fi
  fi

  # ── .NET ──────────────────────────────────────────────────────────────────
  DOTNET_PROJ=$(find . -maxdepth 3 \( -name "*.csproj" -o -name "*.sln" -o -name "*.fsproj" \) -not -path "./.git/*" 2>/dev/null | head -1)
  if [ -n "$DOTNET_PROJ" ]; then
    if require dotnet "install .NET SDK from https://dotnet.microsoft.com/download"; then
      info ".NET project detected ($DOTNET_PROJ) — running dotnet restore"
      dotnet restore
      pass "dotnet restore complete"
    fi
  fi

  # ── Java / Maven ──────────────────────────────────────────────────────────
  if [ -f "pom.xml" ]; then
    if require mvn "install Maven from https://maven.apache.org or use 'sdk install maven' (SDKMAN)"; then
      info "Maven project detected — running mvn dependency:resolve -q"
      mvn dependency:resolve -q
      pass "mvn dependency:resolve complete"
    fi
  fi

  # ── Java / Gradle ─────────────────────────────────────────────────────────
  if [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
    GRADLE_CMD="./gradlew"
    [ ! -f "./gradlew" ] && GRADLE_CMD="gradle"
    if require "$GRADLE_CMD" "install Gradle from https://gradle.org or use 'sdk install gradle' (SDKMAN)"; then
      info "Gradle project detected — running $GRADLE_CMD dependencies (quiet)"
      "$GRADLE_CMD" dependencies -q 2>/dev/null || "$GRADLE_CMD" dependencies
      pass "Gradle dependencies resolved"
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
    if require make "install build tools (Linux: build-essential, macOS: xcode-select --install)"; then
      info "Makefile detected — 'make' is available but NOT run automatically"
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
