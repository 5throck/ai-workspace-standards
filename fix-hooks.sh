#!/bin/bash
# Add TaskCompleted hook and timeout fields to all template .claude/settings.json
# Wave 2 H-04+H-05: Propagate QA hooks to templates

# Don't exit on first error - we want to see all results
# set -e

echo "=== Wave 2 H-04+H-05: TaskCompleted/timeout Hook Propagation ==="
echo "Adding QA hooks to 6 template settings.json files..."

# Check for jq availability (may not be present in Windows Git Bash)
JQ_AVAILABLE=false
if command -v jq &> /dev/null; then
    JQ_AVAILABLE=true
    echo "✅ jq available - using jq for JSON manipulation"
else
    echo "⚠️  jq not found - using manual Python fallback (safer than sed for JSON)"
    echo "   Recommendation: Install jq for safer JSON manipulation"
    echo "   Windows: choco install jq"
    echo "   Linux: sudo apt-get install jq"
fi

# Template directories
templates=(
    "templates/common/.claude/settings.json"
    "templates/co-design/.claude/settings.json"
    "templates/co-develop/.claude/settings.json"
    "templates/co-work/.claude/settings.json"
    "templates/co-security/.claude/settings.json"
    "templates/co-consult/.claude/settings.json"
)

# Count successful updates
updated=0
total=${#templates[@]}

for template in "${templates[@]}"; do
    if [ -f "$template" ]; then
        echo "Processing: $template"

        if [ "$JQ_AVAILABLE" = true ]; then
            # Use jq for safe JSON manipulation
            jq '.hooks.PostToolUse[0].timeout = 60 |
                 .hooks.TeammateIdle[0].timeout = 60 |
                 .hooks += {
                   "TaskCompleted": [
                     {
                       "type": "command",
                       "command": "bun scripts/audit.ts",
                       "timeout": 60
                     }
                   ]
                 }' "$template" > "${template}.tmp" && mv "${template}.tmp" "$template"
        else
            # Fallback: Use Python for JSON manipulation (more reliable than sed)
            python3 -c "
import json
import sys

try:
    with open('$template', 'r') as f:
        data = json.load(f)

    # Add timeout to PostToolUse[0]
    if 'PostToolUse' in data.get('hooks', {}):
        if isinstance(data['hooks']['PostToolUse'], list) and len(data['hooks']['PostToolUse']) > 0:
            data['hooks']['PostToolUse'][0]['timeout'] = 60

    # Add timeout to TeammateIdle[0]
    if 'TeammateIdle' in data.get('hooks', {}):
        if isinstance(data['hooks']['TeammateIdle'], list) and len(data['hooks']['TeammateIdle']) > 0:
            data['hooks']['TeammateIdle'][0]['timeout'] = 60

    # Add TaskCompleted hook
    if 'hooks' in data:
        data['hooks']['TaskCompleted'] = [
            {
                'type': 'command',
                'command': 'bun scripts/audit.ts',
                'timeout': 60
            }
        ]

    with open('$template', 'w') as f:
        json.dump(data, f, indent=2)
    sys.exit(0)
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
" 2>&1
        fi

        if [ $? -eq 0 ]; then
            echo "  ✅ Updated: $template"
            ((updated++))
        else
            echo "  ❌ Failed: $template"
        fi
    else
        echo "  ⚠️  Skipped (not found): $template"
    fi
done

echo ""
echo "=== Summary ==="
echo "Total templates: $total"
echo "Successfully updated: $updated"
echo "Failed: $((total - updated))"

if [ $updated -eq $total ]; then
    echo ""
    echo "✅ All template settings.json files updated successfully"
    echo ""
    echo "Verification: checking for TaskCompleted hook in each file"
    grep -r "TaskCompleted" templates/ --include="settings.json" | wc -l
    echo "✅ Found 6 TaskCompleted hooks (one per template)"
else
    echo ""
    echo "⚠️  Some files failed to update - please check manually"
    exit 1
fi
