#!/bin/bash
# Move completed task plans from memory/ to memory/completed/
# This script identifies completed meeting transcripts and task plans
# and archives them to keep the memory/ folder clean

set -e

COMPLETED_MARKER="## Task Status: Completed"
FINAL_SYNTHESIS_MARKER="## Synthesis"
MEETING_COMPLETE_MARKER="✅  MEETING CLOSED"
MOVED=0
SKIPPED=0

echo "🧹 Cleaning up completed memory files..."
echo ""

# Ensure memory/completed/ directory exists
mkdir -p memory/completed

# Check all .md files in memory/ directory
for file in memory/*.md; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")

    # Check if file is a daily log (format: YYYY-MM-DD.md) - skip these
    if [[ "$filename" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$ ]]; then
      ((SKIPPED++))
      continue
    fi

    # Check if file is already in completed/ - skip
    if [[ "$filename" =~ ^completed- ]]; then
      ((SKIPPED++))
      continue
    fi

    # Check for completion markers
    is_completed=false

    if grep -q "$COMPLETED_MARKER" "$file"; then
      is_completed=true
    fi

    if grep -q "$MEETING_COMPLETE_MARKER" "$file"; then
      is_completed=true
    fi

    # Check for meeting transcripts with final synthesis
    if grep -q "## Transcript" "$file" && grep -q "$FINAL_SYNTHESIS_MARKER" "$file"; then
      # Verify meeting is closed
      if grep -q "$MEETING_COMPLETE_MARKER" "$file"; then
        is_completed=true
      fi
    fi

    if [ "$is_completed" = true ]; then
      # Move to memory/completed/ with completed- prefix
      new_filename="memory/completed/completed-$filename"
      mv "$file" "$new_filename"
      echo "✅ Moved completed file: $filename → completed-$filename"
      ((MOVED++))
    else
      ((SKIPPED++))
    fi
  fi
done

# Also check if there are any old files in memory/completed/ that should be further archived
# (Optional: Add logic here to move very old files to an archive folder)

# Summary
echo ""
echo "📊 Cleanup Summary:"
echo "   Files moved: $MOVED"
echo "   Files skipped (still active): $SKIPPED"

if [ $MOVED -gt 0 ]; then
  echo ""
  echo "✅ Cleanup complete: $MOVED file(s) moved to memory/completed/"
else
  echo ""
  echo "ℹ️  No completed files found to move"
fi

exit 0
