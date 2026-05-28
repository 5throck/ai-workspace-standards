#!/bin/bash
# Validate workspace root does not contain lifecycle-related md files
# This script ensures lifecycle files are properly organized in doc/lifecycle/

set -e

VIOLATIONS=0
WARNINGS=0

echo "🔍 Validating workspace root file organization..."
echo ""

# Files that should NOT be in workspace root (should be in doc/lifecycle/)
LIFECYCLE_FILES=(
  "lifecycle-*.md"
  "phase-*.md"
  "agent-*.md"
  "skill-*.md"
)

# Files that SHOULD be in workspace root
REQUIRED_FILES=(
  "CHANGELOG.md"
  "CLAUDE.md"
  "CONSTITUTION.md"
  "README.md"
  "AGENTS.md"
)

echo "Checking for misplaced lifecycle files..."
for pattern in "${LIFECYCLE_FILES[@]}"; do
  if ls $pattern 2>/dev/null | grep -q .; then
    echo "❌ Found misplaced lifecycle files matching: $pattern"
    ls $pattern 2>/dev/null | while read file; do
      echo "   → $file should be in doc/lifecycle/"
      ((VIOLATIONS++))
    done
  fi
done

echo ""
echo "Checking for required workspace root files..."
for file in "${REQUIRED_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file present (correct)"
  else
    echo "⚠️  $file missing (may be expected)"
    ((WARNINGS++))
  fi
done

# Summary
echo ""
echo "📊 Validation Summary:"
echo "   Misplaced files: $VIOLATIONS"
echo "   Warnings: $WARNINGS"

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "⚠️  Warning: Found $VIOLATIONS misplaced file(s)"
  echo "   Please move lifecycle-related files to doc/lifecycle/"
  echo "   Example: mv lifecycle-file.md doc/lifecycle/"
  exit 0  # Warning only - don't block commits
else
  echo ""
  echo "✅ No lifecycle files in root (correct organization)"
  exit 0
fi
