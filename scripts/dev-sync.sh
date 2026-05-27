#!/usr/bin/env bash
# dev-sync.sh - Full pipeline: memlog → sync-md → changelog → audit → commit → PR
# Usage: bash scripts/dev-sync.sh "feat: description"
set -euo pipefail

MSG="${1:-chore: update}"
DATE=$(date +%Y-%m-%d)

# ── 1. Write daily session log ─────────────────────────────────────────────────
mkdir -p memory
GIT_STATUS=$(git status --short 2>/dev/null || true)
FILE_LIST=""
if [ -n "$GIT_STATUS" ]; then
  FILE_LIST=$(echo "$GIT_STATUS" | sed -E 's/^.{2}[[:space:]]+//' | sed 's/^/- `/' | sed 's/$/ -- modified`/')
fi

SEPARATOR=""
[ -f "memory/$DATE.md" ] && SEPARATOR=$'\n---\n\n'

# Mandatory 4-section format (CONSTITUTION.md §2 / docs/context.md § Documentation Standards)
printf '%s## Session Summary\n%s\n\n## Changes\n%s\n\n## Decisions\n- None\n\n## Open Issues\n- None\n' \
  "$SEPARATOR" "$MSG" "${FILE_LIST:-"- N/A"}" >> "memory/$DATE.md"

# ── 2. Update MEMORY.md index ─────────────────────────────────────────────────
bash scripts/sync-md.sh "$DATE" "$MSG"

# ── 2.5. Generate scripts/README.md ───────────────────────────────────────────
if [ -f "scripts/generate-scripts-readme.ts" ]; then
  bun scripts/generate-scripts-readme.ts
fi

# ── 3. Auto-add to CHANGELOG.md [Unreleased] if the section has no entries ────
if [ -f "CHANGELOG.md" ]; then
  SECTION=$(awk '/\[Unreleased\]/{f=1;next} f && /^## /{exit} f{print}' CHANGELOG.md)
  if ! echo "$SECTION" | grep -Fq "$MSG"; then
    TODAY=$(date +%Y-%m-%d)
    perl -i -pe 'BEGIN{$m=shift; $d=shift}
      if (/^## \[Unreleased\]/) { $_ .= "\n### Added\n- **[$d]**: \Q$m\E\n" }
    ' "$MSG" "$TODAY" CHANGELOG.md
    echo "📝 Auto-added changelog entry: $MSG"
  fi
fi

# ── 3.5. Warn if [Unreleased] section has no bullet items ────────────────────
if [ -f "CHANGELOG.md" ]; then
  UNRELEASED_CONTENT=$(awk '/^## \[Unreleased\]/{f=1;next} f && /^## \[/{exit} f{print}' CHANGELOG.md)
  if ! echo "$UNRELEASED_CONTENT" | grep -qE '^\s*-\s+'; then
    echo ""
    echo "⚠️  CHANGELOG.md [Unreleased] section has no entries."
    echo "   Consider running: /changelog \"type: description\" before syncing."
    echo "   (continuing anyway - use this warning to keep your changelog current)"
    echo ""
  fi
fi

# ── 3.6. Warn about deprecated scripts (if SCRIPTS.md exists) ─────────────────
if [ -f "SCRIPTS.md" ]; then
  DEPRECATED_SCRIPTS=$(grep -E '^\|.*\|.*deprecated' SCRIPTS.md 2>/dev/null || true)
  if [ -n "$DEPRECATED_SCRIPTS" ]; then
    echo "⚠️  Deprecated scripts detected in SCRIPTS.md:"
    echo "$DEPRECATED_SCRIPTS" | while IFS='|' read -r _ name _ _ _; do
      script_name=$(echo "$name" | xargs)
      echo "   - $script_name"
    done
    echo "   Consider removing or updating these scripts."
    echo ""
  fi
fi

# ── 3.7. L0/L1 script drift check (warning only) ─────────────────────────────
if command -v bun &>/dev/null && [ -f "scripts/verify-scripts.ts" ]; then
  bun scripts/verify-scripts.ts --check-drift 2>/dev/null || true
fi

# ── 4. Audit gate ──────────────────────────────────────────────────────────────
bash scripts/audit.sh

# ── 5. Guard against committing sensitive files ────────────────────────────────
SENSITIVE=$(git ls-files --others --exclude-standard | \
  grep -iE '\.(pem|key|p12|pfx|jks|keystore)$|^\.env(\.[^s][^a]|$)|credentials\.json|service.?account\.json|secrets\.ya?ml' \
  || true)
if [ -n "$SENSITIVE" ]; then
  echo "❌ Potentially sensitive untracked files detected - refusing git add -A:"
  echo "$SENSITIVE" | sed 's/^/   /'
  echo "   Stage files explicitly with 'git add <file>' or add them to .gitignore."
  exit 1
fi

# ── 6. Branch → commit → push → PR ───────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  SLUG=$(echo "$MSG" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)
  BRANCH="pr/$(date +%Y%m%d-%H%M%S)-${SLUG}"
  git checkout -b "$BRANCH"
else
  BRANCH="$CURRENT_BRANCH"
  echo "ℹ️  Already on branch '$BRANCH' - committing here without creating a new branch."
fi

git add -A
git commit -m "$MSG"
git push -u origin "$BRANCH"

# ── 7. Generate PR body ───────────────────────────────────────────────────────
if [ -f "scripts/gen-pr-body.sh" ]; then
  PR_BODY=$(bash scripts/gen-pr-body.sh "$MSG" 2>/dev/null || true)
fi

if [ -n "${PR_BODY:-}" ]; then
  gh pr create --title "$MSG" --body "$PR_BODY"
elif [ -f ".github/pull_request_template.md" ]; then
  gh pr create --title "$MSG" --body-file .github/pull_request_template.md
else
  gh pr create --fill
fi
