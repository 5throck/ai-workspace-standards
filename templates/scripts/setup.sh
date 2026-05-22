#!/usr/bin/env bash
# setup.sh — Post-scaffold environment setup
# Detects OS and tech stack, installs dependencies, copies .env, and makes initial commit.
# Called automatically by new-project.sh; can also be re-run manually at any time.
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
fail() { echo -e "\033[31m[FAIL]\033[0m $*"; }

echo "=== setup.sh — environment setup ==="

# ── OS detection ──────────────────────────────────────────────────────────────
OS_TYPE="unknown"
case "$(uname -s 2>/dev/null)" in
  Darwin)             OS_TYPE="macos" ;;
  Linux)              OS_TYPE="linux" ;;
  MINGW*|MSYS*|CYGWIN*) OS_TYPE="windows-bash" ;;
  *)
    if [ -n "${OS:-}" ] && [ "$OS" = "Windows_NT" ]; then
      OS_TYPE="windows-bash"
    fi
    ;;
esac
info "Detected OS: $OS_TYPE"

# ── Python binary (python3 on macOS/Linux, python on Windows Git Bash) ───────
PY_BIN=""
if command -v python3 &>/dev/null; then
  PY_BIN="python3"
elif command -v python &>/dev/null; then
  PY_BIN="python"
fi

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

  # Node.js
  if [ -f "package.json" ]; then
    if ! command -v npm &>/dev/null; then
      warn "Node.js / npm not found — skipping npm install (install from https://nodejs.org)"
    else
      info "Node.js project detected — running npm install"
      npm install
      pass "npm install complete"
    fi
  fi

  # Python (requirements.txt)
  if [ -f "requirements.txt" ]; then
    if [ -z "$PY_BIN" ]; then
      warn "Python not found — skipping venv + pip install (install from https://python.org)"
    else
      info "Python project detected — creating .venv and installing dependencies"
      "$PY_BIN" -m venv .venv

      # Activate: macOS/Linux use bin/, Windows Git Bash uses Scripts/
      if [ -f ".venv/bin/activate" ]; then
        # shellcheck disable=SC1091
        source .venv/bin/activate
      elif [ -f ".venv/Scripts/activate" ]; then
        # shellcheck disable=SC1091
        source .venv/Scripts/activate
      fi

      pip install -r requirements.txt
      pass "pip install complete (.venv created)"

      # macOS: remind user to activate venv in their shell
      if [ "$OS_TYPE" = "macos" ] || [ "$OS_TYPE" = "linux" ]; then
        info "Activate venv in your shell: source .venv/bin/activate"
      else
        info "Activate venv in Git Bash: source .venv/Scripts/activate"
      fi
    fi
  fi

  # Python (pyproject.toml, no requirements.txt)
  if [ -f "pyproject.toml" ] && [ ! -f "requirements.txt" ]; then
    if [ -z "$PY_BIN" ]; then
      warn "Python not found — skipping pip install -e . (install from https://python.org)"
    else
      info "pyproject.toml detected — running pip install -e ."
      pip install -e .
      pass "pip install -e . complete"
    fi
  fi

  # Ruby
  if [ -f "Gemfile" ]; then
    if ! command -v bundle &>/dev/null; then
      warn "Bundler not found — skipping bundle install (run: gem install bundler)"
    else
      info "Ruby project detected — running bundle install"
      bundle install
      pass "bundle install complete"
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
