#!/usr/bin/env bash
# @version 1.0.0
# remove-project.sh — Project deletion helper (Linux / macOS / WSL / Git Bash)
#
# SYNOPSIS:
#   bash scripts/remove-project.sh "path/to/project"
#
# DESCRIPTION:
#   On Linux/macOS the default 'rm -rf' works without special handling because
#   POSIX filesystems do not use Windows-style ReadOnly ACL attributes on git
#   objects.  This script provides a consistent cross-platform interface:
#     - On Linux / macOS: removes the project directory via 'rm -rf' after
#       sanity checks.
#     - On Windows (Git Bash / MSYS2 / WSL):  delegates to the PowerShell
#       companion script 'remove-project.ps1' which handles Windows NTFS ACL
#       quirks, ReadOnly file attributes on .git objects, and running process
#       detection.
#
# USAGE:
#   bash scripts/remove-project.sh "my-project"         # relative path
#   bash scripts/remove-project.sh "/abs/path/project"  # absolute path
#
set -euo pipefail

# ── Resolve project directory ─────────────────────────────────────────────────
PROJECT_PATH="${1:-}"
if [[ -z "$PROJECT_PATH" ]]; then
    echo "[FAIL] Usage: bash scripts/remove-project.sh <project-path>" >&2
    exit 1
fi

# Resolve to absolute path
if [[ "$PROJECT_PATH" != /* ]]; then
    PROJECT_DIR="$(pwd)/$PROJECT_PATH"
else
    PROJECT_DIR="$PROJECT_PATH"
fi

# Normalize (remove trailing slashes, resolve ..)
PROJECT_DIR="$(cd "$(dirname "$PROJECT_DIR")" 2>/dev/null && pwd)/$(basename "$PROJECT_DIR")" || true

echo ""
echo "============================================================"
echo "  REMOVE PROJECT: $PROJECT_DIR"
echo "============================================================"
echo ""

# ── Validate path exists ──────────────────────────────────────────────────────
if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "[FAIL] Project directory not found: $PROJECT_DIR" >&2
    exit 1
fi

# ── Detect Windows environment → delegate to PowerShell ──────────────────────
IS_WINDOWS=false
case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=true ;;
    *) [[ -n "${MSYSTEM:-}" || -n "${WINDIR:-}" ]] && IS_WINDOWS=true ;;
esac

if [[ "$IS_WINDOWS" == "true" ]]; then
    echo "[INFO] Windows environment detected — delegating to remove-project.ps1"
    echo ""
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PS1_SCRIPT="$SCRIPT_DIR/remove-project.ps1"

    if ! command -v powershell.exe &>/dev/null && ! command -v pwsh.exe &>/dev/null; then
        echo "[FAIL] PowerShell not found. Please run remove-project.ps1 directly from PowerShell." >&2
        exit 1
    fi

    PWSH="powershell.exe"
    command -v pwsh.exe &>/dev/null && PWSH="pwsh.exe"

    exec "$PWSH" -NonInteractive -ExecutionPolicy Bypass -File "$PS1_SCRIPT" "$PROJECT_DIR"
fi

# ── Linux / macOS: standard deletion ─────────────────────────────────────────
# Step 1: Check for running processes (informational only on POSIX)
echo "[Step 1/3] Checking for running processes..."
RUNNING_PROCS=()
for pname in "claude" "antigravity"; do
    if pgrep -i "$pname" &>/dev/null; then
        RUNNING_PROCS+=("$pname")
    fi
done

if [[ ${#RUNNING_PROCS[@]} -gt 0 ]]; then
    echo ""
    echo "  [WARN] The following processes are currently running: ${RUNNING_PROCS[*]}"
    echo "  [WARN] Continuing may cause data loss for unsaved work."
    echo ""
    read -rp "  Continue with deletion? (Y/N): " response
    if [[ "$response" != "Y" && "$response" != "y" ]]; then
        echo "  Deletion cancelled."
        exit 0
    fi
fi
echo "  [OK] Process check complete."

# Step 2: Ensure write permissions (clear read-only bits if any)
echo ""
echo "[Step 2/3] Ensuring write permissions..."
chmod -R u+w "$PROJECT_DIR" 2>/dev/null || true
echo "  [OK] Write permissions ensured."

# Step 3: Delete project directory
echo ""
echo "[Step 3/3] Deleting project directory..."
if rm -rf "$PROJECT_DIR"; then
    echo "  [OK] Project deleted successfully."
    echo ""
    echo "============================================================"
    echo "  [SUCCESS] Project removed: $PROJECT_DIR"
    echo "============================================================"
else
    echo "  [FAIL] Could not delete: $PROJECT_DIR" >&2
    echo "  Try: sudo rm -rf \"$PROJECT_DIR\"" >&2
    exit 1
fi
