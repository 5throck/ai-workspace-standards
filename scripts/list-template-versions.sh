#!/usr/bin/env bash
# list-template-versions.sh - Thin wrapper → delegates to list-template-versions.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/list-template-versions.ts
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/list-template-versions.ts" "$@"
