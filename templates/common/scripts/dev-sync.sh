#!/usr/bin/env bash
# dev-sync.sh - Thin wrapper → delegates to dev-sync.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/dev-sync.ts
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/dev-sync.ts" "$@"
