#!/usr/bin/env bash
# publish-to-template.sh — Publishes L0 scripts (workspace) to L1 template snapshot
# Usage: bash scripts/publish-to-template.sh [--dry-run]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
L0_DIR="$SCRIPT_DIR"
L1_DIR="$(cd "$SCRIPT_DIR/../templates/common/scripts" && pwd)"
DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

if [ ! -f "$L0_DIR/SCRIPTS.md" ]; then
  echo "❌ SCRIPTS.md not found at $L0_DIR"
  exit 1
fi

echo "L0 → L1 publish: scripts/ → templates/common/scripts/"
[ "$DRY_RUN" = true ] && echo "(dry-run mode)"
echo ""

count=0
while IFS='|' read -r _ script_col source_col _; do
  script=$(echo "$script_col" | tr -d '` \t')
  source=$(echo "$source_col" | tr -d ' \t')
  [ "$source" != "L0" ] && continue
  [ -z "$script" ] && continue
  src="$L0_DIR/$script"
  dst="$L1_DIR/$script"
  [ ! -f "$src" ] && continue
  if [ "$DRY_RUN" = true ]; then
    echo "  [dry-run] $script"
  else
    cp "$src" "$dst"
    echo "  ✅ $script"
    count=$((count + 1))
  fi
done < <(grep -E '^\| `[^`]+`' "$L0_DIR/SCRIPTS.md" 2>/dev/null)

if [ "$DRY_RUN" = false ]; then
  cp "$L0_DIR/SCRIPTS.md" "$L1_DIR/SCRIPTS.md"
  echo "  ✅ SCRIPTS.md"
  count=$((count + 1))
  echo ""
  echo "✅ Published $count files  L0 (scripts/) → L1 (templates/common/scripts/)"
else
  echo ""
  echo "(dry-run complete — no files written)"
fi
