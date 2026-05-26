#!/usr/bin/env bash
# sync-skill-status.sh - Synchronize skill status between SKILL.md and registry tables
# Detects deprecated skills and updates AGENTS.md, docs/context.md tables

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Color output
red() { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }

# Track changes
changes_made=0

echo "=== Skill Status Synchronization ==="
echo ""

# Check both skills directories
for skills_dir in "skills" ".claude/skills"; do
    [ -d "$skills_dir" ] || continue

    for skill_dir in "$skills_dir"/*/; do
        [ -d "$skill_dir" ] || continue
        skill_name=$(basename "$skill_dir")
        skill_file="${skill_dir}SKILL.md"

        [ -f "$skill_file" ] || continue

        # Extract status from skill file
        file_status=$(grep "^status:" "$skill_file" 2>/dev/null | cut -d: -f2 | xargs || echo "")

        if [ -z "$file_status" ]; then
            yellow "⚠️  No status field found in $skill_file"
            continue
        fi

        # Check if skill is deprecated
        if [ "$file_status" = "deprecated" ]; then
            echo "🔍 Found deprecated skill: $skill_name"

            # Update AGENTS.md Skills table (if exists)
            if [ -f "AGENTS.md" ]; then
                # Find the skill in AGENTS.md Skills table
                current_line=$(grep -n "\`${skill_name}\`" AGENTS.md 2>/dev/null | head -1 || true)

                if [ -n "$current_line" ]; then
                    line_num=$(echo "$current_line" | cut -d: -f1)
                    current_status=$(echo "$current_line" | grep -oP 'status: \K\w+' || echo "")

                    if [ "$current_status" != "deprecated" ]; then
                        echo "  📝 Updating AGENTS.md Skills table for $skill_name"

                        # Update the status in AGENTS.md
                        sed -i.bak "${line_num}s/status: $current_status/status: deprecated/" AGENTS.md
                        rm -f "AGENTS.md.bak"
                        ((changes_made++)) || true

                        green "  ✅ Updated AGENTS.md"
                    else
                        echo "  ✓ AGENTS.md already up-to-date"
                    fi
                fi
            fi

            # Update docs/context.md Skills table (if exists in project)
            if [ -f "docs/context.md" ]; then
                current_line=$(grep -n "\`${skill_name}\`" docs/context.md 2>/dev/null | head -1 || true)

                if [ -n "$current_line" ]; then
                    line_num=$(echo "$current_line" | cut -d: -f1)
                    current_status=$(echo "$current_line" | grep -oP 'status: \K\w+' || echo "")

                    if [ "$current_status" != "deprecated" ]; then
                        echo "  📝 Updating docs/context.md Skills table for $skill_name"

                        sed -i.bak "${line_num}s/status: $current_status/status: deprecated/" docs/context.md
                        rm -f "docs/context.md.bak"
                        ((changes_made++)) || true

                        green "  ✅ Updated docs/context.md"
                    else
                        echo "  ✓ docs/context.md already up-to-date"
                    fi
                fi
            fi

            # Check last modified date for archiving
            if command -v git >/dev/null 2>&1; then
                last_modified=$(git log -1 --format=%ct "$skill_file" 2>/dev/null || echo "0")
                current_time=$(date +%s)
                days_since_modified=$(( (current_time - last_modified) / 86400 ))

                if [ "$days_since_modified" -ge 30 ]; then
                    yellow "  ⚠️  Skill $skill_name has been deprecated for $days_since_modified days (≥30 days)"
                    echo "     Consider moving to ${skills_dir}/_archive/ (run manually)"
                fi
            fi
        fi
    done
done

echo ""
if [ "$changes_made" -gt 0 ]; then
    green "✅ Synchronized $changes_made skill status(es)"
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff AGENTS.md docs/context.md"
    echo "  2. Commit: git add AGENTS.md docs/context.md && git commit -m 'chore: sync skill status'"
    echo "  3. For skills deprecated ≥30 days: mv skills/DEPRECATED skills/_archive/"
else
    green "✅ All skill statuses already in sync"
fi

exit 0
