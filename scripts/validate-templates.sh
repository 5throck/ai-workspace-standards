#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C
export LANG=C
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun "$SCRIPT_DIR/validate-templates.ts" "$@"
