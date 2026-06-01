#!/usr/bin/env bash
# list-template-versions.sh - List available template versions (Unix Tier 1 companion)
# Tier 1 companion to list-template-versions.ts

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
DARKGRAY='\033[0;90m'
RESET='\033[0m'

echo -e "${CYAN}Available template versions:${RESET}"
echo ""

TAGS=$(git -C "$WORKSPACE_ROOT" tag -l "template-v*" 2>/dev/null | sort)

if [ -z "$TAGS" ]; then
  echo -e "${DARKGRAY}  (no tagged versions found)${RESET}"
  echo ""
  VERSION_FILE="$WORKSPACE_ROOT/templates/VERSION"
  if [ -f "$VERSION_FILE" ]; then
    V=$(cat "$VERSION_FILE" | tr -d '[:space:]')
    echo -e "${DARKGRAY}  Current (untagged) version:${RESET}"
    echo -e "${GREEN}  -> $V (latest, untagged)${RESET}"
  fi
else
  while IFS= read -r tag; do
    version="${tag#template-v}"
    echo -e "${GREEN}  -> $version  ($tag)${RESET}"
  done <<< "$TAGS"
fi

echo ""
echo -e "${DARKGRAY}Usage: bash scripts/new-project.sh my-project --version X.Y.Z${RESET}"
echo -e "${DARKGRAY}       (omit --version to use the latest template)${RESET}"
