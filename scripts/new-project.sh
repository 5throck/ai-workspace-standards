#!/usr/bin/env bash
# new-project.sh — Scaffold a new project under the workspace root
# Usage: bash scripts/new-project.sh "<project-name>"
set -euo pipefail

PROJECT_NAME="${1:-}"
if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: bash scripts/new-project.sh \"<project-name>\""
  exit 1
fi

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="$WORKSPACE_ROOT/$PROJECT_NAME"
TEMPLATES_DIR="$WORKSPACE_ROOT/templates"

if [ -d "$PROJECT_DIR" ]; then
  echo "❌ Directory already exists: $PROJECT_DIR"
  exit 1
fi

if [ ! -d "$TEMPLATES_DIR" ]; then
  echo "❌ Templates directory not found: $TEMPLATES_DIR"
  exit 1
fi

echo "🚀 Scaffolding new project: $PROJECT_NAME"

# ── 1. Copy templates (including hidden files) ─────────────────────────────────
mkdir -p "$PROJECT_DIR"
cp -r "$TEMPLATES_DIR/." "$PROJECT_DIR/"

# ── 2. Remove _examples (reference-only — not part of a real project) ──────────
rm -rf "$PROJECT_DIR/_examples"

# ── 3. Remove .gitkeep placeholders ────────────────────────────────────────────
find "$PROJECT_DIR" -name ".gitkeep" -delete

# ── 4. Substitute [Project Name] placeholder in all text files ─────────────────
# Use perl for cross-platform compatibility (macOS sed -i requires '' suffix)
while IFS= read -r -d '' file; do
  perl -pi -e "s/\[Project Name\]/\Q$PROJECT_NAME\E/g" "$file"
done < <(find "$PROJECT_DIR" -type f \
  \( -name "*.md" -o -name "*.json" -o -name "*.sh" -o -name "*.ps1" \
     -o -name "*.yaml" -o -name "*.yml" -o -name "*.sample" \) \
  -print0)

# ── 5. Make scripts and hooks executable ───────────────────────────────────────
chmod +x "$PROJECT_DIR/.githooks/pre-commit" \
         "$PROJECT_DIR/.githooks/pre-push" \
         "$PROJECT_DIR/scripts/audit.sh" \
         "$PROJECT_DIR/scripts/dev-sync.sh" \
         "$PROJECT_DIR/scripts/sync-md.sh"

# ── 6. Initialize git ──────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
git init
git config core.hooksPath .githooks

echo ""
echo "✅ Project '$PROJECT_NAME' scaffolded at: $PROJECT_DIR"
echo ""
echo "Next steps:"
echo "  1. Fill in docs/context.md placeholders (## Tech Stack, ## Architecture, [KEY_NAME])"
echo "  2. Set your test command in agents/test-runner.md (replace [project test command])"
echo "  3. bash scripts/audit.sh          (verify scaffold passes — must exit 0)"
echo "  4. git config core.hooksPath .githooks  (already set, verify it stuck)"
echo ""
echo "Extension templates (ADR, analyst agent, skill, daily log):"
echo "  → $TEMPLATES_DIR/_examples/"
