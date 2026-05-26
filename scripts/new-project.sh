#!/usr/bin/env bash
# new-project.sh - Scaffold a new project under the workspace root
# Usage: bash scripts/new-project.sh "<project-name>" [--variant co-develop|co-design|co-work] [--version X.Y.Z]

# Force English locale for consistent error messages
export LC_ALL=C
export LANG=C

set -euo pipefail

VARIANT="co-develop"
TEMPLATE_VER=""
PROJECT_NAME=""

# Parse optional arguments
prev_arg=""
for arg in "$@"; do
  if [ "$prev_arg" = "--variant" ]; then
    VARIANT="$arg"
  elif [ "$prev_arg" = "--version" ]; then
    TEMPLATE_VER="$arg"
  elif [[ "$arg" != --* ]] && [ "$prev_arg" != "--variant" ] && [ "$prev_arg" != "--version" ] && [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="$arg"
  fi
  prev_arg="$arg"
done

# Validate required arguments
if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: bash scripts/new-project.sh \"<project-name>\" [--variant co-develop|co-design|co-work]"
  exit 1
fi

# Validate PROJECT_NAME: alphanumeric, hyphens, underscores only; max 64 chars
if [[ ! "$PROJECT_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "❌ Invalid project name: '$PROJECT_NAME'"
  echo "   Only letters, numbers, hyphens (-), and underscores (_) are allowed."
  exit 1
fi
if [ "${#PROJECT_NAME}" -gt 64 ]; then
  echo "❌ Project name too long (${#PROJECT_NAME} chars). Maximum is 64 characters."
  exit 1
fi

# Validate --variant was not left without a value (last arg was --variant)
if [ "$prev_arg" = "--variant" ] && [ "$VARIANT" = "co-develop" ]; then
  echo "❌ --variant requires a value. Available: co-develop, co-design, co-work"
  exit 1
fi

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="$WORKSPACE_ROOT/$PROJECT_NAME"
TEMPLATES_DIR="$WORKSPACE_ROOT/templates/$VARIANT"
COMMON_DIR="$WORKSPACE_ROOT/templates/common"
VERSION_FILE="$WORKSPACE_ROOT/templates/VERSION"

# ── Version resolution ─────────────────────────────────────────────────────────
TEMP_DIR=""
if [ -n "$TEMPLATE_VER" ]; then
  TAG="template-v${TEMPLATE_VER}"
  if ! git -C "$WORKSPACE_ROOT" tag -l "$TAG" | grep -q "^${TAG}$"; then
    echo "❌ Template version not found: $TAG"
    echo "   Run: bash scripts/list-template-versions.sh"
    exit 1
  fi
  TEMP_DIR=$(mktemp -d)
  # Extract BOTH common and variant from tag
  git -C "$WORKSPACE_ROOT" archive "$TAG" "templates/common/" "templates/${VARIANT}/" | tar -x -C "$TEMP_DIR" 2>/dev/null || {
    echo "❌ Failed to extract template version $TAG"
    rm -rf "$TEMP_DIR"
    exit 1
  }
  COMMON_DIR="$TEMP_DIR/templates/common"
  TEMPLATES_DIR="$TEMP_DIR/templates/${VARIANT}"
  if [ ! -d "$TEMPLATES_DIR" ]; then
    echo "❌ Variant '$VARIANT' not found in template version $TAG"
    rm -rf "$TEMP_DIR"
    exit 1
  fi
  if [ ! -d "$COMMON_DIR" ]; then
    echo "❌ templates/common/ not found in template version $TAG"
    rm -rf "$TEMP_DIR"
    exit 1
  fi
  echo "📦 Using template version: $TAG"
fi
# Cleanup temp dir on exit
[ -n "$TEMP_DIR" ] && trap "rm -rf '$TEMP_DIR'" EXIT

if [ -d "$PROJECT_DIR" ]; then
  echo "❌ Directory already exists: $PROJECT_DIR"
  exit 1
fi

if [ ! -d "$TEMPLATES_DIR" ]; then
  echo "❌ Template variant not found: $TEMPLATES_DIR"
  echo "   Available variants: co-develop (stable), co-design (stable), co-work (stable)"
  exit 1
fi

# Check variant status
VARIANT_JSON="$TEMPLATES_DIR/variant.json"
if [ -f "$VARIANT_JSON" ]; then
  VARIANT_STATUS=$(grep '"status"' "$VARIANT_JSON" | sed 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  if [ "$VARIANT_STATUS" != "stable" ]; then
    echo "⚠️  Variant '$VARIANT' has status: $VARIANT_STATUS"
    echo "   This variant may not be fully implemented."
    read -r -p "   Continue anyway? [y/N] " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "Aborted."
      exit 1
    fi
  fi
fi

echo "🚀 Scaffolding new project: $PROJECT_NAME"

# ── 1. Copy common/ first (shared infrastructure) ────────────────────────────
if [ ! -d "$COMMON_DIR" ]; then
  echo "❌ Common templates directory not found: $COMMON_DIR"
  exit 1
fi
mkdir -p "$PROJECT_DIR"
cp -r "$COMMON_DIR/." "$PROJECT_DIR/"

# ── 2. Overlay variant/ on top (variant-specific files override common) ──────
if [ ! -d "$TEMPLATES_DIR" ]; then
  echo "❌ Variant templates directory not found: $TEMPLATES_DIR"
  exit 1
fi
cp -r "$TEMPLATES_DIR/." "$PROJECT_DIR/"

# ── 2. Remove docs/_examples (reference-only - not part of a real project) ───
rm -rf "$PROJECT_DIR/docs/_examples"

# ── 3. Remove .gitkeep placeholders ────────────────────────────────────────────
find "$PROJECT_DIR" -name ".gitkeep" -delete

# ── 4. Substitute [Project Name] placeholder in all text files ─────────────────
# Use perl for cross-platform compatibility (macOS sed -i requires '' suffix)
while IFS= read -r -d '' file; do
  perl -pi -e "s/\[Project Name\]/\Q$PROJECT_NAME\E/g" "$file"
done < <(find "$PROJECT_DIR" -type f \
  \( -name "*.md" -o -name "*.json" -o -name "*.sh" -o -name "*.ps1" \
     -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" -o -name "*.sample" \) \
  -print0)

# ── 4.5. Record template provenance in docs/context.md ────────────────────────
TEMPLATE_VERSION="${TEMPLATE_VER:-$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]' || echo 'unknown')}"
CONTEXT_MD="$PROJECT_DIR/docs/context.md"
if [ -f "$CONTEXT_MD" ]; then
  # Add template provenance if not already present
  if ! grep -q "Template-Version:" "$CONTEXT_MD"; then
    printf '\n## Template Provenance\n\n- **Template-Version**: %s\n- **Template-Variant**: %s\n' \
      "$TEMPLATE_VERSION" "$VARIANT" >> "$CONTEXT_MD"
  fi
fi

# ── 5. Make scripts and hooks executable ───────────────────────────────────────
find "$PROJECT_DIR/.githooks" -type f -exec chmod +x {} \;
find "$PROJECT_DIR/scripts" -name "*.sh" -exec chmod +x {} \;

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
  echo "⚠️  Project scaffolded but audit found issues - review above before continuing."
fi

# ── 8. Environment setup (env file, deps, initial commit) ─────────────────────
echo ""
echo "Running environment setup…"
bash "$PROJECT_DIR/scripts/setup.sh" || {
  echo ""
  echo "⚠️  Setup encountered an error - run 'bash scripts/setup.sh' manually to retry."
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
echo "Extension templates (ADR, analyst agent, skill, daily log):"
echo "  → $TEMPLATES_DIR/docs/_examples/"
