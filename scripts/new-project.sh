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
         "$PROJECT_DIR/scripts/sync-md.sh" \
         "$PROJECT_DIR/scripts/setup.sh"

# ── 6. Initialize git ──────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
git init
git config core.hooksPath .githooks

# Mark .ps1 scripts executable in git index (for WSL / Git Bash users)
for rel in scripts/dev-sync.ps1 scripts/audit.ps1 scripts/sync-md.ps1 scripts/setup.ps1; do
  [ -f "$rel" ] && git update-index --chmod=+x "$rel" 2>/dev/null || true
done

# ── 7. Post-scaffold audit ─────────────────────────────────────────────────────
echo ""
echo "Running post-scaffold audit…"
if bash scripts/audit.sh; then
  echo ""
  echo "✅ Project '$PROJECT_NAME' scaffolded and verified at: $PROJECT_DIR"
else
  echo ""
  echo "⚠️  Project scaffolded but audit found issues — review above before continuing."
fi

# ── 8. Environment setup (env file, deps, initial commit) ─────────────────────
echo ""
echo "Running environment setup…"
bash "$PROJECT_DIR/scripts/setup.sh" || {
  echo ""
  echo "⚠️  Setup encountered an error — run 'bash scripts/setup.sh' manually to retry."
}

# ── 9. Move into project directory ────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\033[36m📂 PROJECT DIRECTORY:\033[0m $PROJECT_DIR"
echo ""
echo -e "\033[33m⚠️  Your shell is still at the workspace root.\033[0m"
echo "   Run the following command to move into your new project:"
echo ""
echo -e "   \033[32mcd \"$PROJECT_DIR\"\033[0m"
echo ""
echo "   All subsequent work (git, scripts, sessions) must be run"
echo "   from inside this directory, not the workspace root."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "\033[35m🤖 MULTI-AGENT KICKOFF (Recommended):\033[0m"
echo "   Before writing code, start a PM-led kickoff meeting to plan architecture and roles:"
echo -e "   Ask the AI: \033[33m'Let's start the PM agent kickoff meeting for this project.'\033[0m"
echo ""
echo "Extension templates (ADR, analyst agent, skill, daily log):"
echo "  → $TEMPLATES_DIR/_examples/"
