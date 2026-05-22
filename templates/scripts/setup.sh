#!/usr/bin/env bash
# setup.sh — Post-scaffold environment setup
# Detects tech stack, installs dependencies, copies .env, and makes initial commit.
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

echo "=== setup.sh — environment setup ==="

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
  if [ -f "package.json" ]; then
    info "Node.js project detected — running npm install"
    npm install
    pass "npm install complete"
  fi

  if [ -f "requirements.txt" ]; then
    info "Python project detected — creating .venv and installing dependencies"
    python -m venv .venv
    if [ -f ".venv/bin/activate" ]; then
      # shellcheck disable=SC1091
      source .venv/bin/activate
    elif [ -f ".venv/Scripts/activate" ]; then
      # shellcheck disable=SC1091
      source .venv/Scripts/activate
    fi
    pip install -r requirements.txt
    pass "pip install complete (.venv activated)"
  fi

  if [ -f "pyproject.toml" ] && [ ! -f "requirements.txt" ]; then
    info "pyproject.toml detected — running pip install -e ."
    pip install -e .
    pass "pip install -e . complete"
  fi

  if [ -f "Gemfile" ]; then
    info "Ruby project detected — running bundle install"
    bundle install
    pass "bundle install complete"
  fi
else
  info "Skipping dependency install (--skip-install)"
fi

# ── 3. Initial commit ─────────────────────────────────────────────────────────
if [ "$SKIP_COMMIT" = false ]; then
  if git rev-parse --git-dir > /dev/null 2>&1; then
    git add -A
    git commit -m "chore: initial scaffold

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" \
      --allow-empty 2>/dev/null || warn "Nothing to commit (already committed?)"
    pass "Initial commit created"
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
