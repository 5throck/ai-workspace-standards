#!/bin/bash
# scripts/vsp-publish.sh
# Usage: bash ./scripts/vsp-publish.sh "feat: align with main reference implementation"
# Standardized packaging script to sanitize and copy core framework assets to the plugin repository.

COMMIT_MESSAGE="$1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "--- Harness Packaging & Publishing Hook ---"

# 1. Resolve target directory (env var required; no hardcoded fallback)
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    TARGET_DIR="$CLAUDE_PLUGIN_ROOT"
else
    echo "  [!] CLAUDE_PLUGIN_ROOT is not set."
    echo "  [!] Usage: CLAUDE_PLUGIN_ROOT=/path/to/co-abap_plugin bash ./scripts/vsp-publish.sh \"<message>\""
    exit 1
fi

# 2. Validate Target Directory
if [ ! -d "$TARGET_DIR" ]; then
    echo "  [!] Target plugin directory '$TARGET_DIR' does not exist."
    exit 1
fi

echo "Copying core assets to plugin..."

# Define assets to sync
SYNC_FOLDERS=("agents" "skills" ".claude/commands:commands")
SYNC_FILES=(
    "docs/prd-template.md"
    "docs/task-template.md"
    "docs/plugin-setup.md"
    "scripts/install-vsp.ps1"
    "scripts/install-vsp.sh"
    "scripts/sync-md.ps1"
    "scripts/sync-md.sh"
    "scripts/vsp-audit.ps1"
    "scripts/vsp-audit.sh"
    "scripts/vsp-task.ps1"
    "scripts/vsp-task.sh"
    ".mcp.json.sample"
)

# 2. Sync folders
for item in "${SYNC_FOLDERS[@]}"; do
    SRC=$(echo "$item" | cut -d':' -f1)
    TGT=$(echo "$item" | cut -d':' -f2)
    if [ "$SRC" == "$TGT" ]; then
        TGT_DIR="$TARGET_DIR/$SRC"
    else
        TGT_DIR="$TARGET_DIR/$TGT"
    fi
    SRC_DIR="$SOURCE_DIR/$SRC"
    
    if [ -d "$SRC_DIR" ]; then
        rm -rf "$TGT_DIR"
        mkdir -p "$TGT_DIR"
        cp -rf "$SRC_DIR"/* "$TGT_DIR/"
        echo "  [+] Synced Folder: $SRC -> $TGT"
    else
        echo "  [!] Source Folder '$SRC_DIR' not found. Skipping."
    fi
done

# 3. Sync files
for file in "${SYNC_FILES[@]}"; do
    SRC_FILE="$SOURCE_DIR/$file"
    TGT_FILE="$TARGET_DIR/$file"
    
    if [ -f "$SRC_FILE" ]; then
        mkdir -p "$(dirname "$TGT_FILE")"
        cp -f "$SRC_FILE" "$TGT_FILE"
        echo "  [+] Synced File  : $file -> $file"
    else
        echo "  [!] Source File '$SRC_FILE' not found. Skipping."
    fi
done

# 4. Hash Verification
echo "Verifying copied assets integrity..."
VERIFY_FAILED=0

# Verify folders
for item in "${SYNC_FOLDERS[@]}"; do
    SRC=$(echo "$item" | cut -d':' -f1)
    TGT=$(echo "$item" | cut -d':' -f2)
    if [ "$SRC" == "$TGT" ]; then
        TGT_DIR="$TARGET_DIR/$SRC"
    else
        TGT_DIR="$TARGET_DIR/$TGT"
    fi
    SRC_DIR="$SOURCE_DIR/$SRC"
    
    if [ -d "$SRC_DIR" ]; then
        # Find all files recursively in SRC_DIR
        while read -r sf; do
            rel_path="${sf#$SRC_DIR/}"
            tf="$TGT_DIR/$rel_path"
            if [ ! -f "$tf" ]; then
                echo "  [!] Missing target file: $TGT/$rel_path"
                VERIFY_FAILED=1
                continue
            fi
            
            src_hash=$(md5sum "$sf" | awk '{print $1}')
            tgt_hash=$(md5sum "$tf" | awk '{print $1}')
            if [ "$src_hash" != "$tgt_hash" ]; then
                echo "  [!] Hash mismatch in file: $TGT/$rel_path"
                VERIFY_FAILED=1
            fi
        done < <(find "$SRC_DIR" -type f)
    fi
done

# Verify files
for file in "${SYNC_FILES[@]}"; do
    SRC_FILE="$SOURCE_DIR/$file"
    TGT_FILE="$TARGET_DIR/$file"
    
    if [ -f "$SRC_FILE" ]; then
        src_hash=$(md5sum "$SRC_FILE" | awk '{print $1}')
        tgt_hash=$(md5sum "$TGT_FILE" | awk '{print $1}')
        if [ "$src_hash" != "$tgt_hash" ]; then
            echo "  [!] Hash mismatch in file: $file"
            VERIFY_FAILED=1
        fi
    fi
done

if [ $VERIFY_FAILED -ne 0 ]; then
    echo "Integrity check FAILED. Assets do not match."
    exit 1
else
    echo "Integrity verification PASSED. All copied assets match 100%."
fi

# 5. Commit and Push inside the Target Repository
if [ -n "$COMMIT_MESSAGE" ]; then
    echo "Staging and committing in target plugin repository..."
    CURRENT_DIR=$(pwd)
    cd "$TARGET_DIR" || exit 1
    
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    git add -A
    STATUS=$(git status --porcelain)
    if [ -z "$STATUS" ]; then
        echo "No changes detected in plugin repository. Distribution up to date."
    else
        git commit -m "$COMMIT_MESSAGE" || { echo "  [!] Commit failed."; exit 1; }
        echo "Pushing to remote origin $BRANCH..."
        git push origin "$BRANCH" || { echo "  [!] Push failed."; exit 1; }
        echo "Distribution successfully pushed!"
    fi
    
    cd "$CURRENT_DIR" || exit 1
fi

echo "Harness packaging complete!"
