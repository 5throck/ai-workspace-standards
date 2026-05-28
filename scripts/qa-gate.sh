#!/usr/bin/env bash
# qa-gate.sh - Thin wrapper → delegates to qa-gate.ts (Tier 2 TS implementation)
# Deprecated: 2026-05-29 | Removal: 2026-08-29
# Direct equivalent: bun scripts/qa-gate.ts
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/qa-gate.ts" "$@"
