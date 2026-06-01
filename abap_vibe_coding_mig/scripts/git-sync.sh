#!/bin/bash
# scripts/git-sync.sh
# Usage: ./scripts/git-sync.sh [message]
# Commits and pushes all changes to the current branch.

MESSAGE=${1:-"chore: auto-sync documentation and configuration"}
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "--- Git Sync ---"
echo "Branch: $BRANCH"

git add .

if ! git diff --cached --quiet; then
    git commit -m "$MESSAGE"
    git push origin "$BRANCH"
    echo "Successfully synced to Git."
else
    echo "No changes to sync."
fi
