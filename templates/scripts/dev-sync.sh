#!/usr/bin/env bash
# dev-sync.sh — Full pipeline: memlog → sync-md → changelog → audit → commit → PR
# Usage: bash scripts/dev-sync.sh "feat: description"
set -euo pipefail

MSG="${1:-chore: update}"
DATE=$(date +%Y-%m-%d)

# ── 1. Write daily session log ─────────────────────────────────────────────────
mkdir -p memory
GIT_STATUS=$(git status --short 2>/dev/null || true)
FILE_LIST=""
if [ -n "$GIT_STATUS" ]; then
  # Extract just file names, join with commas
  FILE_LIST=$(echo "$GIT_STATUS" | sed -E 's/^.{2}[[:space:]]+//' | paste -sd ", " -)
fi

SEPARATOR=""
if [ -f "memory/$DATE.md" ]; then
  SEPARATOR="\n---\n\n"
fi

printf "${SEPARATOR}## $MSG\n- **Files**: $FILE_LIST\n- **Purpose**: \n- **Decisions**: \n- **Issues**: None\n" >> "memory/$DATE.md"


# ── 2. Update MEMORY.md index ─────────────────────────────────────────────────
bash scripts/sync-md.sh "$DATE" "$MSG"

# ── 3. Auto-add to CHANGELOG.md [Unreleased] if the section has no entries ────
if [ -f "CHANGELOG.md" ]; then
  SECTION=$(awk '/\[Unreleased\]/{f=1;next} f && /^## /{exit} f{print}' CHANGELOG.md)
  if ! echo "$SECTION" | grep -qE "^[[:space:]]*[-*]|^### "; then
    perl -pi -e 'BEGIN{$m=shift} s/## \[Unreleased\]/## [Unreleased]\n\n- $m/' "$MSG" CHANGELOG.md
    echo "📝 Auto-added changelog entry: $MSG"
  fi
fi

# ── 4. Audit gate ──────────────────────────────────────────────────────────────
bash scripts/audit.sh

# ── 5. Branch → commit → push → PR ────────────────────────────────────────────
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "master" ]]; then
  BRANCH="pr/$(date +%Y%m%d-%H%M%S)-$(echo "$MSG" | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)"
  git checkout -b "$BRANCH"
else
  BRANCH="$CURRENT_BRANCH"
  echo "ℹ️  Already on branch '$BRANCH' — committing here without creating a new branch."
fi
git add -A
# NOTE: This is a template script. Update the commit message or AI Co-Author below as needed for your specific project.
git commit -m "$MSG"
git push -u origin "$BRANCH"
# Use PR template if present; fall back to --fill
if [ -f ".github/pull_request_template.md" ]; then
  gh pr create --title "$MSG" --body "$(cat .github/pull_request_template.md)"
else
  gh pr create --fill
fi
