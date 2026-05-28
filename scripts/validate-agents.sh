#!/bin/bash
# Validate all agents/*.md files have required lifecycle frontmatter and governance records
# This script performs two validations:
# 1. Runtime definition validation: agents/*.md must have lifecycle frontmatter
# 2. Governance record validation: docs/lifecycle/agents/*.md must have detailed documentation

set -e

# Required sections in governance records (docs/lifecycle/agents/*.md)
GOVERNANCE_REQUIRED_SECTIONS=("## Phase History" "## Acceptance Criteria")

# Required frontmatter fields in runtime definitions (agents/*.md)
FRONTMATTER_REQUIRED_FIELDS=("lifecycle.phase" "lifecycle.governance")

ERRORS=0
WARNINGS=0
TOTAL=0

echo "🔍 Validating agent lifecycle documentation..."
echo ""

# Part 1: Validate runtime definitions (agents/*.md)
echo "📋 Part 1: Runtime Definition Validation (agents/*.md)"

for agent_file in agents/*.md; do
  if [ -f "$agent_file" ] && [ "$(basename "$agent_file")" != "README.md" ]; then
    ((TOTAL++))
    agent_name=$(basename "$agent_file" .md)
    missing_fields=()

    # Check for required frontmatter fields using awk to parse YAML frontmatter
    for field in "${FRONTMATTER_REQUIRED_FIELDS[@]}"; do
      # Check if field exists in frontmatter (between --- and ---)
      if ! awk "/^---$/,/^---$/ {if ($0 ~ \"${field}:\") print}" "$agent_file" | grep -q .; then
        missing_fields+=("$field")
      fi
    done

    if [ ${#missing_fields[@]} -gt 0 ]; then
      echo "❌ $agent_name: Missing frontmatter fields: ${missing_fields[*]}"
      ((ERRORS++))
    else
      echo "✅ $agent_name: All required frontmatter fields present"
    fi
  fi
done

# Part 2: Validate governance records (docs/lifecycle/agents/*.md)
echo ""
echo "📋 Part 2: Governance Record Validation (docs/lifecycle/agents/*.md)"

if [ -d "docs/lifecycle/agents" ]; then
  for lifecycle_doc in docs/lifecycle/agents/*.md; do
    if [ -f "$lifecycle_doc" ]; then
      ((TOTAL++))
      doc_name=$(basename "$lifecycle_doc .md)
      missing_sections=()

      # Check for required sections in lifecycle documents
      if ! grep -q "## Phase History" "$lifecycle_doc"; then
        missing_sections+=("Phase History")
      fi

      if ! grep -q "## Acceptance Criteria" "$lifecycle_doc"; then
        missing_sections+=("Acceptance Criteria")
      fi

      if [ ${#missing_sections[@]} -gt 0 ]; then
        echo "❌ Governance doc $doc_name: Missing sections: ${missing_sections[*]}"
        ((ERRORS++))
      else
        echo "✅ Governance doc $doc_name: All required sections present"
      fi
    fi
  done
else
  echo "⚠️  Warning: docs/lifecycle/agents/ directory not found"
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
  echo ""
  echo "Fix instructions:"
  echo "  1. For runtime definition errors: Add lifecycle frontmatter to agents/*.md"
  echo "     Example:"
  echo "     lifecycle:"
  echo "       phase: production"
  echo "       created: 2026-05-29"
  echo "       last_updated: 2026-05-29"
  echo "       governance: docs/lifecycle/agents/[name].md"
  echo "  2. For governance record errors: Add missing sections to docs/lifecycle/agents/*.md"
  exit 1
else
  echo ""
  echo "✅ All agents validated successfully"
  echo "   Runtime definitions and governance records are both valid"
  exit 0
fi
