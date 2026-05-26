#!/usr/bin/env bash
# list-template-versions.sh - List available template versions
export LC_ALL=C
export LANG=C

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Available template versions:"
echo ""

TAGS=$(git -C "$WORKSPACE_ROOT" tag -l "template-v*" | sort -V)

if [ -z "$TAGS" ]; then
  echo "  (no tagged versions found)"
  echo ""
  echo "  Current (untagged) version:"
  VERSION_FILE="$WORKSPACE_ROOT/templates/VERSION"
  if [ -f "$VERSION_FILE" ]; then
    echo "  → $(cat "$VERSION_FILE") (latest, untagged)"
  fi
else
  while IFS= read -r tag; do
    version="${tag#template-v}"
    echo "  → $version  ($tag)"
  done <<< "$TAGS"
fi

echo ""
echo "Usage: bash scripts/new-project.sh my-project --version X.Y.Z"
echo "       (omit --version to use the latest template)"
