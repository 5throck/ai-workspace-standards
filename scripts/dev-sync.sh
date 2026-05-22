#!/usr/bin/env bash
# dev-sync.sh — Full pipeline: memlog → sync-md → changelog → audit → commit → PR
# Usage: bash scripts/dev-sync.sh "feat: description"
set -euo pipefail

MSG="${1:-chore: update}"
DATE=$(date +%Y-%m-%d)

# ── 1. Write daily session log ─────────────────────────────────────────────────
mkdir -p memory
echo "## Session — $MSG" >> "memory/$DATE.md"

# ── 2. Update MEMORY.md index ─────────────────────────────────────────────────
bash scripts/sync-md.sh "$DATE" "$MSG"

# ── 3. Auto-add to CHANGELOG.md [Unreleased] if the section has no entries ────
if [ -f "CHANGELOG.md" ]; then
  SECTION=$(awk '/\[Unreleased\]/{f=1;next} f && /^## /{exit} f{print}' CHANGELOG.md)
  if ! echo "$SECTION" | grep -qE "^[[:space:]]*[-*]|^### "; then
    perl -pi -e 's/## \[Unreleased\]/## [Unreleased]\n\n- '"$MSG"'/' CHANGELOG.md
    echo "📝 Auto-added changelog entry: $MSG"
  fi
fi

# ── 4. Audit gate ──────────────────────────────────────────────────────────────
bash scripts/audit.sh

# ── 5. Branch → commit → push → PR ────────────────────────────────────────────
BRANCH="pr/$(date +%Y%m%d-%H%M%S)-$(echo "$MSG" | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)"
git checkout -b "$BRANCH"
git add -A
git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin "$BRANCH"
gh pr create --fill
