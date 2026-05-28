#!/usr/bin/env bash
# publish-to-template.sh - Thin wrapper → delegates to publish-to-template.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/publish-to-template.ts
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/publish-to-template.ts" "$@"
