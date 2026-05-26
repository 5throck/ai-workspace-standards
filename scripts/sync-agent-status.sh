#!/usr/bin/env bash
# sync-agent-status.sh - Synchronize agent status between files and AGENTS.md
# Detects deprecated agents and updates AGENTS.md, handles archiving after 30 days

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Color output
red() { echo -e "\033[31m$*\033[0m"; }
green() { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }

# Check for required commands
command -v git >/dev/null 2>&1 || { red "Error: git not installed"; exit 1; }

# Track changes
changes_made=0

echo "=== Agent Status Synchronization ==="
echo ""

# Check each agent file
for agent_file in agents/*.md; do
    [ -f "$agent_file" ] || continue
    agent_name=$(basename "$agent_file" .md)

    # Extract status from agent file
    file_status=$(grep "^status:" "$agent_file" 2>/dev/null | cut -d: -f2 | xargs || echo "")

    if [ -z "$file_status" ]; then
        yellow "⚠️  No status field found in $agent_file"
        continue
    fi

    # Check if agent is deprecated
    if [ "$file_status" = "deprecated" ]; then
        echo "🔍 Found deprecated agent: $agent_name"

        # Check AGENTS.md for current status
        agents_md_line=$(grep -n "^|.*\`${agent_name}\.md\`" AGENTS.md 2>/dev/null || true)

        if [ -n "$agents_md_line" ]; then
            line_num=$(echo "$agents_md_line" | cut -d: -f1)
            current_status=$(echo "$agents_md_line" | grep -oP 'status: \K\w+' || echo "")

            if [ "$current_status" != "deprecated" ]; then
                echo "  📝 Updating AGENTS.md status for $agent_name: $current_status → deprecated"

                # Update the status in AGENTS.md
                sed -i.bak "${line_num}s/status: $current_status/status: deprecated/" AGENTS.md
                rm -f "AGENTS.md.bak"
                ((changes_made++)) || true

                green "  ✅ Updated AGENTS.md"
            else
                echo "  ✓ AGENTS.md already up-to-date"
            fi

            # Check last modified date for archiving
            last_modified=$(git log -1 --format=%ct "$agent_file" 2>/dev/null || echo "0")
            current_time=$(date +%s)
            days_since_modified=$(( (current_time - last_modified) / 86400 ))

            if [ "$days_since_modified" -ge 30 ]; then
                yellow "  ⚠️  Agent $agent_name has been deprecated for $days_since_modified days (≥30 days)"
                echo "     Consider moving to agents/_archive/ (run manually)"
            fi
        fi
    fi
done

echo ""
if [ "$changes_made" -gt 0 ]; then
    green "✅ Synchronized $changes_made agent status(es)"
    echo ""
    echo "Next steps:"
    echo "  1. Review changes: git diff AGENTS.md"
    echo "  2. Commit: git add AGENTS.md && git commit -m 'chore: sync agent status'"
    echo "  3. For agents deprecated ≥30 days: mv agents/DEPRECATED.md agents/_archive/"
else
    green "✅ All agent statuses already in sync"
fi

exit 0
