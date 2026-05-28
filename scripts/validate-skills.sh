#!/bin/bash
# Validate all skill/*.md files have required sections
# This script checks that each skill follows the lifecycle documentation standards

set -e

REQUIRED_SECTIONS=("## Phase History" "## Acceptance Criteria")
ERRORS=0
WARNINGS=0
TOTAL=0

echo "🔍 Validating skill lifecycle documentation..."
echo ""

# Check all .md files in skills/ directories
for skill_dir in skills/*/; do
  skill_file="${skill_dir}SKILL.md"

  if [ -f "$skill_file" ]; then
    ((TOTAL++))
    skill_name=$(basename "$skill_dir")
    missing_sections=()

    # Check for required sections
    for section in "${REQUIRED_SECTIONS[@]}"; do
      if ! grep -q "$section" "$skill_file"; then
        missing_sections+=("$section")
      fi
    done

    if [ ${#missing_sections[@]} -gt 0 ]; then
      echo "❌ $skill_name: Missing sections: ${missing_sections[*]}"
      ((ERRORS++))
    else
      echo "✅ $skill_name: All required sections present"
    fi
  fi
done

# Check lifecycle documents
echo ""
echo "🔍 Validating lifecycle documents in doc/lifecycle/skills/..."

if [ -d "doc/lifecycle/skills" ]; then
  for lifecycle_doc in doc/lifecycle/skills/*.md; do
    if [ -f "$lifecycle_doc" ]; then
      ((TOTAL++))
      doc_name=$(basename "$lifecycle_doc" .md)
      missing_sections=()

      # Check for required sections in lifecycle documents
      if ! grep -q "## Phase History" "$lifecycle_doc"; then
        missing_sections+=("Phase History")
      fi

      if ! grep -q "## Acceptance Criteria" "$lifecycle_doc"; then
        missing_sections+=("Acceptance Criteria")
      fi

      if [ ${#missing_sections[@]} -gt 0 ]; then
        echo "❌ Lifecycle doc $doc_name: Missing sections: ${missing_sections[*]}"
        ((ERRORS++))
      else
        echo "✅ Lifecycle doc $doc_name: All required sections present"
      fi
    fi
  done
else
  echo "⚠️  Warning: doc/lifecycle/skills/ directory not found"
  ((WARNINGS++))
fi

# Summary
echo ""
echo "📊 Validation Summary:"
echo "   Total files checked: $TOTAL"
echo "   Errors: $ERRORS"
echo "   Warnings: $WARNINGS"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ Validation failed with $ERRORS error(s)"
  echo "   Please add the missing sections to the skill/lifecycle documents"
  exit 1
else
  echo ""
  echo "✅ All skills validated successfully"
  exit 0
fi
