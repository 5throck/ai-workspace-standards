#!/usr/bin/env bash
# sync-md.sh - Update memory/MEMORY.md index
# Usage: bash scripts/sync-md.sh "YYYY-MM-DD" "summary"
DATE="${1:-$(date +%Y-%m-%d)}"
SUMMARY="${2:-update}"
MEMORY_FILE="memory/MEMORY.md"
[ ! -f "$MEMORY_FILE" ] && printf "# Memory Index\n\n| Date | Summary |\n|------|----------|\n" > "$MEMORY_FILE"
# Only append if this date is not already in the index
if ! grep -qF "[$DATE]" "$MEMORY_FILE"; then
  echo "| [$DATE]($DATE.md) | $SUMMARY |" >> "$MEMORY_FILE"
fi
