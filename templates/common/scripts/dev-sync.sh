#!/usr/bin/env bash
# dev-sync.sh - Full pipeline: memlog → sync-md → changelog → audit → commit → PR
# Usage: bash scripts/dev-sync.sh "feat: description"

# Force English locale for consistent error messages
export LC_ALL=C
export LANG=C

set -euo pipefail

MSG="${1:-chore: update}"
DATE=$(date +%Y-%m-%d)

# ── 1. Write daily session log ─────────────────────────────────────────────────
mkdir -p memory
GIT_STATUS=$(git status --short 2>/dev/null || true)
FILE_LIST=""
if [ -n "$GIT_STATUS" ]; then
  FILE_LIST=$(echo "$GIT_STATUS" | sed -E 's/^.{2}[[:space:]]+//' | paste -sd ", " -)
fi

SEPARATOR=""
[ -f "memory/$DATE.md" ] && SEPARATOR=$'\n---\n\n'

# Safe printf: keep format string static, pass values as arguments
printf '%s## %s\n- **Files**: %s\n- **Purpose**: \n- **Decisions**: \n- **Issues**: None\n' \
  "$SEPARATOR" "$MSG" "$FILE_LIST" >> "memory/$DATE.md"

# ── 2. Update MEMORY.md index ─────────────────────────────────────────────────
bash scripts/sync-md.sh "$DATE" "$MSG"

# ── 3. Auto-add to CHANGELOG.md [Unreleased] if the section has no entries ────
if [ -f "CHANGELOG.md" ]; then
  SECTION=$(awk '/\[Unreleased\]/{f=1;next} f && /^## /{exit} f{print}' CHANGELOG.md)
  if ! echo "$SECTION" | grep -Fq "$MSG"; then
    TODAY=$(date +%Y-%m-%d)
    # \Q$m\E prevents Perl metachar expansion in the replacement string
    perl -i -pe 'BEGIN{$m=shift; $d=shift}
      if (/^## \[Unreleased\]/) { $_ .= "\n### Added\n- **[$d]**: \Q$m\E\n" }
    ' "$MSG" "$TODAY" CHANGELOG.md
    echo "📝 Auto-added changelog entry: $MSG"
  fi
fi

# ── 4. Audit gate ──────────────────────────────────────────────────────────────
bash scripts/audit.sh

# ── 5. Guard against committing sensitive files ────────────────────────────────
# Check for unignored sensitive filenames before staging everything
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
