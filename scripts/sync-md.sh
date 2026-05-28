#!/usr/bin/env bash
# sync-md.sh - Thin wrapper → delegates to sync-md.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/sync-md.ts
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/sync-md.ts" "$@"
