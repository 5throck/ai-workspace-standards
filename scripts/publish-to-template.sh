#!/usr/bin/env bash
# publish-to-template.sh — Publishes L0 scripts and skills (workspace) to L1 template snapshot
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
while IFS='|' read -r _ script_col source_col _ _ _ _ drift_col _; do
  script=$(echo "$script_col" | tr -d '` \t')
  source=$(echo "$source_col" | tr -d ' \t')
  drift=$(echo "${drift_col:-}" | tr -d ' \t')
  [ "$source" != "L0" ] && continue
  [ "$drift" = "intentional" ] && continue  # skip intentional divergences
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
fi

# ── Skills: L0 (skills/) → L1 (templates/common/skills/) ─────────────────────
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
L0_SKILLS="$WORKSPACE_ROOT/skills"
L1_SKILLS="$WORKSPACE_ROOT/templates/common/skills"

echo ""
echo "L0 → L1 publish: skills/ → templates/common/skills/"

skill_count=0
for item in "$L0_SKILLS"/*; do
  item_name=$(basename "$item")
  if [ -d "$item" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "  [dry-run] $item_name/"
    else
      rm -rf "$L1_SKILLS/$item_name"
      cp -r "$item" "$L1_SKILLS/"
      echo "  ✅ $item_name/"
      skill_count=$((skill_count + 1))
    fi
  elif [ -f "$item" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "  [dry-run] $item_name"
    else
      cp "$item" "$L1_SKILLS/$item_name"
      echo "  ✅ $item_name"
      skill_count=$((skill_count + 1))
    fi
  fi
done

if [ "$DRY_RUN" = false ]; then
  echo ""
  echo "✅ Published $skill_count items  L0 (skills/) → L1 (templates/common/skills/)"
else
  echo ""
  echo "(dry-run complete — no files written)"
fi
