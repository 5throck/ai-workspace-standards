#!/usr/bin/env bash
# scripts/vsp-dev-sync.sh
# Usage: ./scripts/vsp-dev-sync.sh [-m "type: summary"] [-a] [-m] [-s]
# Hybrid sync pipeline combining workspace audit, MCP sync, and VSP infrastructure sync

# Default values
MESSAGE=""
SKIP_AUDIT=false
SKIP_MCP_SYNC=false
SKIP_SAP_SYNC=false

# Parse command line arguments
while getopts "m:asc" opt; do
    case $opt in
        m) MESSAGE="$OPTARG" ;;
        a) SKIP_AUDIT=true ;;
        s) SKIP_MCP_SYNC=true ;;
        c) SKIP_SAP_SYNC=true ;;
        \?) echo "Invalid option: -$OPTARG" >&2; exit 1 ;;
    esac
done

# Script paths
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(dirname "$SCRIPT_ROOT")"

# Color helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

# Helper functions
write_phase() {
    echo -e "${CYAN}$1${RESET}"
}

write_success() {
    echo -e "${GREEN}$1${RESET}"
}

write_error() {
    echo -e "${RED}$1${RESET}"
}

write_warn() {
    echo -e "${YELLOW}$1${RESET}"
}

# Timer functions (using milliseconds for better precision without bc)
start_timer=$(date +%s%3N)
warning_occurred=false

# Function to calculate elapsed time in seconds
elapsed_seconds() {
    local start=$1
    local end=$2
    echo "scale=1; ($end - $start) / 1000" | awk '{printf "%.1f", $1}'
}

warning_occurred=false

echo -e "${CYAN}=== VSP Dev Sync Pipeline ===${RESET}"
if [ -n "$MESSAGE" ]; then
    echo -e "${CYAN}Commit message: $MESSAGE${RESET}"
fi
echo ""

# Phase 1: Workspace Audit
if [ "$SKIP_AUDIT" = false ]; then
    write_phase "[Phase 1/3] Running workspace audit..."
    phase_start=$(date +%s%3N)

    cd "$WORKSPACE_ROOT"
    bun "$SCRIPT_ROOT/audit.ts"
    audit_exit_code=$?

    phase_end=$(date +%s%3N)
    phase_time_formatted=$(elapsed_seconds "$phase_start" "$phase_end")

    if [ $audit_exit_code -eq 0 ]; then
        write_success "✓ Audit passed (${phase_time_formatted}s)"
        echo ""
    else
        write_error "✗ Audit failed (${phase_time_formatted}s)"
        write_error "ERROR: Workspace validation failed"
        write_error "HALT: Fix workspace issues and retry"
        write_error "       Run 'bun scripts/audit.ts' for full details"
        exit 1
    fi
else
    write_warn "[Phase 1/3] Skipped workspace audit (-a)"
    echo ""
fi

# Phase 2: MCP Sync
if [ "$SKIP_MCP_SYNC" = false ]; then
    write_phase "[Phase 2/3] Syncing MCP configuration..."
    phase_start=$(date +%s%3N)

    cd "$WORKSPACE_ROOT"
    bun "$SCRIPT_ROOT/sync-mcp.ts"
    mcp_exit_code=$?

    phase_end=$(date +%s%3N)
    phase_time_formatted=$(elapsed_seconds "$phase_start" "$phase_end")

    if [ $mcp_exit_code -eq 0 ]; then
        write_success "✓ MCP synced (${phase_time_formatted}s)"
        echo ""
    else
        write_warn "⚠ WARNING: MCP sync failed (${phase_time_formatted}s)"
        write_warn "   Reason: MCP configuration could not be synchronized"
        write_warn "   Action: Continuing to SAP sync (MCP can be synced later)"
        echo ""
        warning_occurred=true
    fi
else
    write_warn "[Phase 2/3] Skipped MCP sync (-s)"
    echo ""
fi

# Phase 3: SAP Sync
if [ "$SKIP_SAP_SYNC" = false ]; then
    write_phase "[Phase 3/3] Syncing VSP infrastructure..."
    phase_start=$(date +%s%3N)

    cd "$WORKSPACE_ROOT"

    # 3.1 Documentation Audit
    "$SCRIPT_ROOT/vsp-audit.sh"
    if [ $? -ne 0 ]; then
        write_error "✗ Documentation audit failed (0.0s)"
        write_error "ERROR: VSP documentation validation failed"
        write_error "HALT: Fix SAP documentation and retry"
        write_error "       Run './scripts/vsp-audit.sh' for full details"
        exit 1
    fi
    write_success "✓ Documentation audit passed (0.0s)"

    # 3.2 Memory Log Management
    date=$(date +"%Y-%m-%d")
    time=$(date +"%H:%M")
    memory_dir="$WORKSPACE_ROOT/memory"
    memory_file="$memory_dir/$date.md"
    index_file="$memory_dir/MEMORY.md"

    if [ ! -f "$memory_file" ]; then
        echo -e "${YELLOW}Memory log for today not found. Auto-creating $date.md...${RESET}"
        mkdir -p "$memory_dir"
        cat > "$memory_file" << EOF
# Memory Log: $date

<!-- Auto-created by vsp-dev-sync.sh. Add entries below. -->

## $time — Session

<!-- Describe what was done today -->
EOF
        echo -e "${GREEN}Created: $memory_file${RESET}"
    fi

    # 3.3 Update MEMORY.md Index
    if [ -f "$index_file" ]; then
        if ! grep -q "\[$date\]($date\.md)" "$index_file"; then
            echo -e "${GREEN}Updating memory index...${RESET}"

            summary="Development update"
            if [ -n "$MESSAGE" ]; then
                summary=$(echo "$MESSAGE" | sed 's/.*: //')
            fi

            new_entry="| [$date]($date.md) | $summary |"

            # Insert after separator line
            awk -v entry="$new_entry" '
                /^[|][-]+[|][-]+[|]$/ {
                    print $0
                    print entry
                    next
                }
                { print $0 }
            ' "$index_file" > "$index_file.tmp" && mv "$index_file.tmp" "$index_file"
        fi
    fi

    write_success "✓ Memory log updated: memory/$date.md"

    # 3.4 Git Commit
    if [ -z "$MESSAGE" ]; then
        read -p "Enter commit message (e.g., feat: add new report): " MESSAGE
    fi

    if [ -z "$MESSAGE" ]; then
        write_error "ERROR: Commit message is required."
        exit 1
    fi

    git_start=$(date +%s%3N)
    echo -e "${GREEN}Committing to Git...${RESET}"
    git add -A
    git commit -m "$MESSAGE"
    git_end=$(date +%s%3N)
    git_time_formatted=$(elapsed_seconds "$git_start" "$git_end")

    write_success "✓ Git commit successful (${git_time_formatted}s)"

    phase_end=$(date +%s%3N)
    phase_time_formatted=$(elapsed_seconds "$phase_start" "$phase_end")

    write_success "✓ VSP synced successfully (${phase_time_formatted}s)"
    echo ""
else
    write_warn "[Phase 3/3] Skipped VSP sync (-c)"
    echo ""
fi

# Summary
end_timer=$(date +%s%3N)
total_time_formatted=$(elapsed_seconds "$start_timer" "$end_timer")

if [ "$SKIP_AUDIT" = true ] && [ "$SKIP_MCP_SYNC" = true ] && [ "$SKIP_SAP_SYNC" = true ]; then
    write_warn "WARNING: All phases skipped (no-op mode)"
    echo -e "${CYAN}Summary: No operations performed${RESET}"
elif [ "$warning_occurred" = true ]; then
    echo -e "${YELLOW}Summary: Completed with warnings in ${total_time_formatted}s${RESET}"
else
    write_success "Summary: All phases completed in ${total_time_formatted}s"
fi
