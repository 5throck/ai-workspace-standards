#!/usr/bin/env bash
# audit.sh — Documentation integrity check
# Exit code 0 = pass, non-zero = fail.
set -euo pipefail

errors=0
red()   { echo -e "\033[31m[FAIL]\033[0m $*"; }
green() { echo -e "\033[32m[PASS]\033[0m $*"; }
warn()  { echo -e "\033[33m[WARN]\033[0m $*"; }

echo "=== audit.sh — workspace standards check ==="

# 1. CHANGELOG.md must exist
if [ -f "CHANGELOG.md" ]; then green "CHANGELOG.md exists"
else red "CHANGELOG.md missing"; ((errors++)) || true; fi

# 2. CONSTITUTION.md must be accessible (workspace root or one level up)
if [ -f "CONSTITUTION.md" ] || [ -f "../CONSTITUTION.md" ]; then green "CONSTITUTION.md accessible"
else red "CONSTITUTION.md not found (expected at ./ or ../)"; ((errors++)) || true; fi

# 3. docs/context.md must have ## Coding Guidelines
if [ -f "docs/context.md" ]; then
  if grep -q "^## Coding Guidelines" "docs/context.md"; then green "docs/context.md has ## Coding Guidelines"
  else red "docs/context.md missing '## Coding Guidelines'"; ((errors++)) || true; fi
else warn "docs/context.md not found — skipping (workspace root)"; fi

# 4. CHANGELOG.md must have [Unreleased] (project-level only)
if [ -f "docs/context.md" ] && [ -f "CHANGELOG.md" ]; then
  if grep -q "\[Unreleased\]" "CHANGELOG.md"; then green "CHANGELOG.md has [Unreleased]"
  else red "CHANGELOG.md missing '[Unreleased]'"; ((errors++)) || true; fi
fi

echo ""
if [ "$errors" -eq 0 ]; then echo -e "\033[32m✅ All checks passed.\033[0m"; exit 0
else echo -e "\033[31m❌ $errors check(s) failed. Fix before committing.\033[0m"; exit 1; fi
