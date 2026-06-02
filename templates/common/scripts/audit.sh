#!/usr/bin/env bash
# audit.sh - Documentation integrity check
# Checks that required files and sections exist before a commit.
# Exit code 0 = pass, non-zero = fail.

# Force English locale for consistent error messages
export LC_ALL=C
export LANG=C

set -euo pipefail

errors=0

red()   { echo -e "\033[31m[FAIL]\033[0m $*"; }
green() { echo -e "\033[32m[PASS]\033[0m $*"; }
warn()  { echo -e "\033[33m[WARN]\033[0m $*"; }

echo "=== audit.sh - workspace standards check ==="

# 1. CHANGELOG.md must exist
if [ -f "CHANGELOG.md" ]; then
  green "CHANGELOG.md exists"
else
  red  "CHANGELOG.md missing"
  ((errors++)) || true
fi

# 2. CONSTITUTION.md must be accessible (workspace root OR one level up for project dirs)
if [ -f "CONSTITUTION.md" ] || [ -f "../CONSTITUTION.md" ]; then
  green "CONSTITUTION.md accessible"
else
  red  "CONSTITUTION.md not found (expected at ./ or ../)"
  ((errors++)) || true
fi

# 2.5. Constitution section files must exist and be non-empty (workspace root only)
if [ -f "CONSTITUTION.md" ] && [ -d "docs/constitution" ]; then
  for ref in $(grep -oP '(?<=docs/constitution/)[\w.-]+\.md' CONSTITUTION.md 2>/dev/null || true); do
    if [ -s "docs/constitution/$ref" ]; then
      green "constitution section: $ref"
    else
      red "constitution section missing or empty: docs/constitution/$ref"
      ((errors++)) || true
    fi
  done
fi

# ── Project-level checks (skip at workspace root where docs/context.md is absent) ──

# 3. CHANGELOG.md must have [Unreleased] section (all projects + workspace root)
if [ -f "CHANGELOG.md" ]; then
  if grep -q "\[Unreleased\]" "CHANGELOG.md"; then
    green "CHANGELOG.md has [Unreleased] section"
  else
    red  "CHANGELOG.md is missing '[Unreleased]' section"
    ((errors++)) || true
  fi
fi

# --- Agent checks (applicable to all projects AND workspace root) ---

# 4. AGENTS.md must exist
if [ -f "AGENTS.md" ]; then
    green "AGENTS.md exists"
else
    red "AGENTS.md missing (required for agent-first projects)"
    ((errors++)) || true
fi

# 5. At least one agent file must exist in agents/
if [ -n "$(ls -A agents/*.md 2>/dev/null)" ]; then
    green "agents/ has agent files"
else
    red "agents/ is empty or missing - create at least agents/pm.md"
    ((errors++)) || true
fi

# --- Project-level checks (skip at workspace root where docs/context.md is absent) ---

if [ -f "docs/context.md" ]; then
    # 6. docs/context.md must have ## Coding Guidelines
    if grep -q "^## Coding Guidelines" "docs/context.md"; then
        green "docs/context.md has ## Coding Guidelines"
    else
        red "docs/context.md is missing '## Coding Guidelines' section"
        ((errors++)) || true
    fi

  # 7. .env.sample must exist
  if [ -f ".env.sample" ]; then
    green ".env.sample exists"
  else
    warn ".env.sample not found - add one if this project uses environment variables"
  fi

  # 8. scripts/ .sh/.ps1 parity check
  for sh_file in scripts/*.sh; do
    [ -f "$sh_file" ] || continue
    ps1_file="${sh_file%.sh}.ps1"
    if [ -f "$ps1_file" ]; then
      green "script parity: $(basename "$sh_file") / $(basename "$ps1_file")"
    else
      warn "script parity gap: $sh_file has no matching .ps1"
    fi
  done

else
  warn "docs/context.md not found - skipping project-level checks (workspace root)"
fi

# --- Memory Format Audit ---
if command -v bun &>/dev/null && [ -f "scripts/verify-memory.ts" ] && [ -d "memory" ]; then
    if bun scripts/verify-memory.ts --verify 2>/dev/null; then
        green "Memory audit: all session logs valid"
    else
        warn "Memory audit: some entries use legacy format (run 'bun scripts/verify-memory.ts --report')"
    fi
fi

echo ""
if [ "$errors" -eq 0 ]; then
  echo -e "\033[32m✅ All checks passed.\033[0m"
  exit 0
else
  echo -e "\033[31m❌ $errors check(s) failed. Fix before committing.\033[0m"
  exit 1
fi
