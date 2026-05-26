#!/usr/bin/env bash
# sync-md.sh - Update memory/MEMORY.md index
# Usage:
#   bash scripts/sync-md.sh "YYYY-MM-DD" "summary"              # session entry
#   bash scripts/sync-md.sh "YYYY-MM-DD" "summary" --meeting    # meeting entry
#   bash scripts/sync-md.sh "YYYY-MM-DD" "summary" --adr "ID"   # ADR entry
set -euo pipefail

DATE="${1:-$(date +%Y-%m-%d)}"
SUMMARY="${2:-update}"
TYPE="session"
ADR_ID=""

# Parse optional flags
for arg in "${@:3}"; do
  case "$arg" in
    --meeting) TYPE="meeting" ;;
    --adr)     TYPE="adr" ;;
    ADR-*)     ADR_ID="$arg" ;;
  esac
done

MEMORY_FILE="memory/MEMORY.md"

# ── Initialize MEMORY.md with 3-section structure if missing ────────────────
if [ ! -f "$MEMORY_FILE" ]; then
  cat > "$MEMORY_FILE" << 'INIT'
# Memory Index

## Sessions

| Date | Summary |
|------|---------|

## Meetings

| Date | Topic | File |
|------|-------|------|

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
INIT
fi

# ── Ensure all 3 sections exist (migrate legacy flat index) ──────────────────
if ! grep -q "^## Sessions" "$MEMORY_FILE"; then
  # Legacy flat file — prepend section structure before first table row
  TMPFILE=$(mktemp)
  awk '
    /^# Memory Index/ { print; next }
    /^\| Date \| Summary/ && !done {
      print ""
      print "## Sessions"
      print ""
      done=1
    }
    { print }
    END {
      print ""
      print "## Meetings"
      print ""
      print "| Date | Topic | File |"
      print "|------|-------|------|"
      print ""
      print "## ADRs"
      print ""
      print "| ID | Title | Status | File |"
      print "|----|-------|--------|------|"
    }
  ' "$MEMORY_FILE" > "$TMPFILE"
  mv "$TMPFILE" "$MEMORY_FILE"
fi

# ── Append to appropriate section (dedup by date+summary) ───────────────────
case "$TYPE" in
  meeting)
    # Derive filename from summary slug
    SLUG=$(echo "$SUMMARY" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)
    FILE="meeting-${DATE}-${SLUG}.md"
    LINK="[$DATE](${FILE})"
    if ! grep -qF "$DATE" "$MEMORY_FILE" || ! grep -qF "$SUMMARY" "$MEMORY_FILE"; then
      # Insert before the next ## section after ## Meetings
      awk -v date="$DATE" -v topic="$SUMMARY" -v file="$FILE" '
        /^## ADRs/ { in_meetings=0 }
        /^## Meetings/ { in_meetings=1 }
        in_meetings && /^\|[-| ]+\|/ {
          print
          print "| " date " | " topic " | [" file "](" file ") |"
          in_meetings=0
          next
        }
        { print }
      ' "$MEMORY_FILE" > "${MEMORY_FILE}.tmp" && mv "${MEMORY_FILE}.tmp" "$MEMORY_FILE"
    fi
    ;;
  adr)
    SLUG=$(echo "$SUMMARY" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-50)
    FILE="${ADR_ID:-ADR-XXXX}-${SLUG}.md"
    if ! grep -qF "${ADR_ID:-$SUMMARY}" "$MEMORY_FILE"; then
      awk -v id="${ADR_ID:-ADR-XXXX}" -v title="$SUMMARY" -v file="$FILE" '
        /^\|[-| ]+\|[-| ]+\|[-| ]+\|[-| ]+\|/ && done=="adr" {
          print
          print "| " id " | " title " | Accepted | [" file "](" file ") |"
          done=""
          next
        }
        /^## ADRs/ { done="adr" }
        { print }
      ' "$MEMORY_FILE" > "${MEMORY_FILE}.tmp" && mv "${MEMORY_FILE}.tmp" "$MEMORY_FILE"
    fi
    ;;
  *)
    # Session: append date+summary row to ## Sessions section (dedup by date)
    if ! grep -qF "[$DATE]" "$MEMORY_FILE"; then
      awk -v date="$DATE" -v summary="$SUMMARY" '
        /^## Meetings/ { in_sessions=0 }
        /^## Sessions/ { in_sessions=1 }
        in_sessions && /^\|[-| ]+\|/ {
          print
          print "| [" date "](" date ".md) | " summary " |"
          in_sessions=0
          next
        }
        { print }
      ' "$MEMORY_FILE" > "${MEMORY_FILE}.tmp" && mv "${MEMORY_FILE}.tmp" "$MEMORY_FILE"
    fi
    ;;
esac
