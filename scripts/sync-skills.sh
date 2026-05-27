#!/bin/bash
# sync-skills.sh
# Distributes skills from the SSOT (templates/common/skills/) to .claude/skills/ and .gemini/skills/

set -e

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

SSOT_SKILLS="$WORKSPACE_ROOT/templates/common/skills"
CLAUDE_SKILLS="$WORKSPACE_ROOT/.claude/skills"
GEMINI_SKILLS="$WORKSPACE_ROOT/.gemini/skills"

mkdir -p "$CLAUDE_SKILLS"
mkdir -p "$GEMINI_SKILLS"

echo "Syncing skills from SSOT ($SSOT_SKILLS)..."

for skill_dir in "$SSOT_SKILLS"/*; do
    if [ -d "$skill_dir" ]; then
        skill_name=$(basename "$skill_dir")
        
        # Copy to .claude
        rm -rf "$CLAUDE_SKILLS/$skill_name"
        cp -r "$skill_dir" "$CLAUDE_SKILLS/"
        echo "  -> Synced $skill_name to .claude/skills/"

        # Copy to .gemini
        rm -rf "$GEMINI_SKILLS/$skill_name"
        cp -r "$skill_dir" "$GEMINI_SKILLS/"
        echo "  -> Synced $skill_name to .gemini/skills/"
    fi
done

echo "Skill synchronization complete!"
