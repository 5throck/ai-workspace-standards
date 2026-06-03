#!/usr/bin/env bash
# gen-pr-body.sh - Thin wrapper → delegates to gen-pr-body.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/gen-pr-body.ts
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/gen-pr-body.ts" "$@"
