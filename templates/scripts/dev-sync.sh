#!/usr/bin/env bash
# dev-sync.sh — Full pipeline: audit → memlog → commit → PR
# Usage: bash scripts/dev-sync.sh "feat: description"
set -euo pipefail

MSG="${1:-chore: update}"
bash scripts/audit.sh

DATE=$(date +%Y-%m-%d)
mkdir -p memory
echo "## Session — $MSG" >> "memory/$DATE.md"
bash scripts/sync-md.sh "$DATE" "$MSG"

BRANCH="pr/$(date +%Y%m%d-%H%M%S)-$(echo "$MSG" | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)"
git checkout -b "$BRANCH"
git add -A
git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin "$BRANCH"
gh pr create --fill
