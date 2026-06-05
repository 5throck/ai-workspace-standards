#!/usr/bin/env bash
# @version 1.4.2
# new-project.sh - Scaffold a new project under the workspace root
# Usage: bash scripts/new-project.sh "<project-name>" [--variant <variant>] [--platform claude|antigravity|both] [--version X.Y.Z]
# Variants are auto-detected from templates/ directory (or git tag when --version is specified)

# Force English locale for consistent error messages
export LC_ALL=C
export LANG=C

set -euo pipefail

VARIANT=""
TEMPLATE_VER=""
PROJECT_NAME=""
PLATFORM="both"

# Parse optional arguments
prev_arg=""
for arg in "$@"; do
  if [ "$prev_arg" = "--variant" ]; then
    VARIANT="$arg"
    prev_arg=""
    continue
  elif [ "$prev_arg" = "--version" ]; then
    TEMPLATE_VER="$arg"
    prev_arg=""
    continue
  elif [ "$prev_arg" = "--platform" ]; then
    PLATFORM="$arg"
    prev_arg=""
    continue
  elif [[ "$arg" == --* ]]; then
    prev_arg="$arg"
  elif [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="$arg"
  elif [ "$prev_arg" != "--variant" ] && [ "$prev_arg" != "--version" ] && [ "$prev_arg" != "--platform" ]; then
    VARIANT="$arg"
    break
  fi
done

# Validate required arguments
if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: bash scripts/new-project.sh \"<project-name>\" [--variant <variant>] [--platform claude|antigravity|both] [--version X.Y.Z]"
  echo "       Variants are auto-detected from templates/"
  exit 1
fi

# Validate PROJECT_NAME: alphanumeric, hyphens, underscores, slashes, dots only; block path traversal; max 64 chars
if [[ ! "$PROJECT_NAME" =~ ^[a-zA-Z0-9_/\.-]+$ ]] || [[ "$PROJECT_NAME" == *".."* ]]; then
  echo "❌ Invalid project name: '$PROJECT_NAME'"
  echo "   Only letters, numbers, hyphens (-), underscores (_), and slashes (/) are allowed, without path traversal (..)."
  exit 1
fi
if [ "${#PROJECT_NAME}" -gt 64 ]; then
  echo "❌ Project name too long (${#PROJECT_NAME} chars). Maximum is 64 characters."
  exit 1
fi

# Validate VARIANT against dynamically detected list (prevent path traversal attacks)
if [ -n "$VARIANT" ]; then
  _WS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  # Dynamic variant detection — git tag or filesystem
  if [ -n "$TEMPLATE_VER" ]; then
    _TAG="template-v${TEMPLATE_VER}"
    VALID_VARIANTS=$(git -C "$_WS_ROOT" archive "$_TAG" --list 2>/dev/null \
      | grep -E "^templates/co-[^/]+/variant\.json$" \
      | sed 's|templates/||;s|/variant\.json||' \
      | sort -u || echo "")
    if [ -z "$VALID_VARIANTS" ]; then
      echo "❌ Could not detect variants from tag '$_TAG'. Tag may not exist or has no variant.json entries."
      echo "   To list available tags: git tag --list 'template-v*'"
      exit 1
    fi
  else
    VALID_VARIANTS=$(ls "$_WS_ROOT/templates/" 2>/dev/null | grep "^co-" | sort)
  fi

  if ! echo "$VALID_VARIANTS" | grep -qx "$VARIANT"; then
    echo "❌ Invalid variant: $VARIANT"
    echo "   Valid variants: $(echo "$VALID_VARIANTS" | tr '\n' ' ')"
    exit 1
  fi
fi

# Validate --variant was not left without a value (last arg was --variant)
if [ "$prev_arg" = "--variant" ] && [ -z "$VARIANT" ]; then
  echo "❌ --variant requires a value (auto-detected from templates/)"
  exit 1
fi

# Validate --platform flag
if [[ "$PLATFORM" != "claude" && "$PLATFORM" != "antigravity" && "$PLATFORM" != "both" ]]; then
  echo "❌ --platform must be: claude, antigravity, or both (default: both)"
  exit 1
fi

# -- Require explicit variant selection ------------------------------------------
if [ -z "$VARIANT" ]; then
    _WS_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
    echo ""
    echo "[INFO] No variant specified. Please choose one:"
    for v in $(ls "$_WS_ROOT/templates/" 2>/dev/null | grep "^co-" | sort); do
      echo "   $v"
    done
    echo ""
    echo "   Usage: bash scripts/new-project.sh \"$PROJECT_NAME\" --variant <variant>"
    echo ""
    exit 1
fi

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_DIR="$WORKSPACE_ROOT/$PROJECT_NAME"
TEMPLATES_DIR="$WORKSPACE_ROOT/templates/$VARIANT"
COMMON_DIR="$WORKSPACE_ROOT/templates/common"
VERSION_FILE="$WORKSPACE_ROOT/templates/VERSION"

# ── Version resolution ─────────────────────────────────────────────────────────  # TEST: none
TEMP_DIR=""
if [ -n "$TEMPLATE_VER" ]; then
  TAG="template-v${TEMPLATE_VER}"
  if ! git -C "$WORKSPACE_ROOT" tag -l "$TAG" | grep -q "^${TAG}$"; then
    echo "❌ Template version not found: $TAG"
    echo "   Run: bun scripts/list-template-versions.ts"
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
  echo "   Available variants: $(ls "$WORKSPACE_ROOT/templates/" 2>/dev/null | grep "^co-" | tr '\n' ' ')"
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

# ── D-05: lifecycle-governance.json variant pre-check ───────────────────────── # TEST: none
GOVERNANCE_JSON="$WORKSPACE_ROOT/docs/templates/lifecycle-governance.json"
if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/validate-templates.ts" ] && [ -f "$GOVERNANCE_JSON" ]; then
  echo ""
  echo "Running lifecycle governance pre-check for variant '$VARIANT'…"

  # Determine mandatory domains from governance JSON
  MANDATORY_DOMAINS=$(bun "$WORKSPACE_ROOT/scripts/helpers/lifecycle-governance.ts" 2>/dev/null || echo "variant,agent,skill")

  # Run validate-templates for the selected variant in JSON mode
  VALIDATE_OUTPUT=$(bun "$WORKSPACE_ROOT/scripts/validate-templates.ts" --variant "$VARIANT" --json 2>/dev/null || echo '{"errors":[{"check":"validate-failed","message":"validate-templates.ts failed to run"}]}')

  # Check mandatory domain errors
  if ! bun "$WORKSPACE_ROOT/scripts/helpers/validate-output.ts" "$MANDATORY_DOMAINS" "$VALIDATE_OUTPUT" 2>/dev/null; then
    echo ""
    echo "❌ Lifecycle governance pre-check FAILED for variant '$VARIANT'."
    echo "   Fix the issues above before creating a project from this variant."
    echo "   Run: bun scripts/validate-templates.ts --variant $VARIANT"
    exit 1
  else
    echo "  ✅ Lifecycle governance pre-check passed (mandatory domains: $MANDATORY_DOMAINS)"
  fi
fi

echo "🚀 Scaffolding new project: $PROJECT_NAME"

# ── Template validation before copying ────────────────────────────────────────  # TEST: none
if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/template-validation.ts" ]; then
  echo "Validating template integrity…"
  if ! bun "$WORKSPACE_ROOT/scripts/helpers/template-validation.ts" "$VARIANT" "$COMMON_DIR" "$TEMPLATES_DIR" 2>/dev/null; then
    exit 1
  fi
else
  echo "⚠️  Template validation skipped (bun not available or helper missing)"
fi

# ── 1. Copy common/ first (shared infrastructure) ──────────────────────────── # TEST: Test 1, Test 7
if [ ! -d "$COMMON_DIR" ]; then
  echo "❌ Common templates directory not found: $COMMON_DIR"
  exit 1
fi
mkdir -p "$PROJECT_DIR"
# Exclude workspace-root-only files that must NOT be copied into new projects.
# package.json at the root is a workspace management artifact (bun scripts for
# audit, dev-sync, agent:verify, etc.) — not an app dependency manifest.
# New projects that genuinely need Node.js should create their own package.json.
WORKSPACE_ONLY_FILES=("package.json" "package-lock.json" "bun.lock" "bun.lockb")
cp -r "$COMMON_DIR/." "$PROJECT_DIR/"
for f in "${WORKSPACE_ONLY_FILES[@]}"; do
  if [ -f "$PROJECT_DIR/$f" ]; then
    rm -f "$PROJECT_DIR/$f"
    echo "  🗑️  Excluded workspace-only file: $f"
  fi
done

# ── 2. Overlay variant/ on top (variant-specific files override common) ────── # TEST: Test 1, Test 7
if [ ! -d "$TEMPLATES_DIR" ]; then
  echo "❌ Variant templates directory not found: $TEMPLATES_DIR"
  exit 1
fi

# Copy with extends resolution - process files BEFORE losing template context
echo "📝 Copying variant templates with extends resolution..."
find "$TEMPLATES_DIR" -type f -name "*.md" | while read -r src_file; do
  rel_path="${src_file#$TEMPLATES_DIR/}"
  dest_file="$PROJECT_DIR/$rel_path"

  # Check if file has extends field
  if grep -q "^extends:" "$src_file" 2>/dev/null; then
    # Read skeleton path from extends field
    extends_path=$(grep "^extends:" "$src_file" | sed 's/^extends: *//')

    # Resolve skeleton absolute path (relative to template storage)
    src_dir=$(dirname "$src_file")
    skeleton_abs_path=$(cd "$src_dir" && realpath "$extends_path" 2>/dev/null || echo "")

    # Verify skeleton exists
    if [ -z "$skeleton_abs_path" ] || [ ! -f "$skeleton_abs_path" ]; then
      echo "⚠️  Skeleton not found for $rel_path (extends: $extends_path)"
      # Copy as-is
      mkdir -p "$(dirname "$dest_file")"
      cp "$src_file" "$dest_file"
    else
      # Create destination directory
      mkdir -p "$(dirname "$dest_file")"

      # Copy file to destination
      cp "$src_file" "$dest_file"

      # Merge with explicit skeleton path
      bun scripts/helpers/merge-frontmatter.ts "$dest_file" "$skeleton_abs_path" 2>/dev/null || {
        echo "⚠️  Extends merge failed: $rel_path"
      }
    fi
  else
    # Normal copy
    mkdir -p "$(dirname "$dest_file")"
    cp "$src_file" "$dest_file"
  fi
done

# Copy all non-.md files normally
find "$TEMPLATES_DIR" -type f ! -name "*.md" | while read -r src_file; do
  rel_path="${src_file#$TEMPLATES_DIR/}"
  dest_file="$PROJECT_DIR/$rel_path"
  mkdir -p "$(dirname "$dest_file")"
  cp "$src_file" "$dest_file"
done

# ── 2.5. Verify extends resolution (post-copy validation) ────────────────────  # TEST: Test 18
echo "📝 Verifying extends resolution..."
extends_count=$(find "$PROJECT_DIR" -type f -name "*.md" -exec grep -l "^extends:" {} \; | wc -l)
if [ "$extends_count" -gt 0 ]; then
  echo "⚠️  Found $extends_count files with unresolved extends field:"
  find "$PROJECT_DIR" -type f -name "*.md" -exec grep -l "^extends:" {} \; | while read -r file; do
    echo "   - $file"
  done
  echo "   This should not happen - extends fields should be resolved during copy."
else
  echo "  ✅ All extends fields resolved"
fi

# ── 2.6. Apply platform profile ───────────────────────────────────────────────  # TEST: Test 8
if [ "$PLATFORM" = "claude" ]; then
  rm -f "$PROJECT_DIR/GEMINI.md"
elif [ "$PLATFORM" = "antigravity" ]; then
  rm -f "$PROJECT_DIR/CLAUDE.md"
fi

# ── 2.7. Remove any accidentally copied .cmd files ───────────────────────────  # TEST: Test 17
find "$PROJECT_DIR" -name "*.cmd" -delete

# ── 3. Remove docs/_examples (reference-only - not part of a real project) ──  # TEST: Test 14
rm -rf "$PROJECT_DIR/docs/_examples"

# ── 3.5. Enforce .sh / .ps1 script pairs ──────────────────────────────────────  # TEST: Test 18
SCRIPTS_DIR_PROJ="$PROJECT_DIR/scripts"
if [ -d "$SCRIPTS_DIR_PROJ" ]; then
  PAIR_OK=true
  for f in "$SCRIPTS_DIR_PROJ"/*.ps1; do
    [ -f "$f" ] || continue
    base="$(basename "$f" .ps1)"
    [[ "$base" == test-* ]] && continue
    if [ ! -f "$SCRIPTS_DIR_PROJ/${base}.sh" ]; then
      echo "❌ Script Pair Validation Failed: Missing .sh pair for ${base}.ps1"
      PAIR_OK=false
    fi
  done
  for f in "$SCRIPTS_DIR_PROJ"/*.sh; do
    [ -f "$f" ] || continue
    base="$(basename "$f" .sh)"
    [[ "$base" == test-* ]] && continue
    if [ ! -f "$SCRIPTS_DIR_PROJ/${base}.ps1" ]; then
      echo "❌ Script Pair Validation Failed: Missing .ps1 pair for ${base}.sh"
      PAIR_OK=false
    fi
  done
  if [ "$PAIR_OK" = false ]; then
    echo "   Fix script pairs in templates before scaffolding."
    exit 1
  fi
fi

# ── 3.6. Agent Override Merge (VARIANT-SECTION substitution) ───────────────── # TEST: Test 20, Test 21, Test 22
# For additive overrides: substitute VARIANT-SECTION placeholders with variant content
# NOTE: Skip files that use 'extends' pattern (already processed above)
if [ -f "$TEMPLATES_DIR/variant.json" ] && command -v bun &>/dev/null; then
  bun - "$COMMON_DIR" "$TEMPLATES_DIR" "$PROJECT_DIR" <<'BUNSCRIPT'
    const fs = require('fs');
    const path = require('path');
    const [,, commonDir, variantDir, projectDir] = process.argv;

    const variantJsonPath = path.join(variantDir, 'variant.json');
    if (!fs.existsSync(variantJsonPath)) process.exit(0);

    const variant = JSON.parse(fs.readFileSync(variantJsonPath, 'utf8'));
    const overrides = variant.agent_overrides || {};

    for (const [agentName, override] of Object.entries(overrides)) {
      if (override.type !== 'additive') continue;

      const skeletonFile = path.join(commonDir, 'agents', agentName + '.md');
      const variantFile = path.join(variantDir, 'agents', agentName + '.md');
      const outFile = path.join(projectDir, 'agents', agentName + '.md');

      if (!fs.existsSync(skeletonFile) || !fs.existsSync(variantFile) || !fs.existsSync(outFile)) continue;

      // Check if variant file uses 'extends' pattern - if so, skip additive processing
      const variantContent = fs.readFileSync(variantFile, 'utf8');
      if (variantContent.match(/^---\n[\s\S]*?^extends:/m)) {
        console.log('  [SKIP-ADDITIVE] agents/' + agentName + '.md (uses extends pattern)');
        continue;
      }

      let skeleton = fs.readFileSync(skeletonFile, 'utf8');

      // Parse YAML frontmatter using js-yaml to preserve nested structures (e.g. tier: {antigravity: high})
      const yaml = require('js-yaml');
      function parseFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
        if (!match) return { fm: {}, body: content };
        try {
          const fm = yaml.load(match[1]) || {};
          return { fm, body: content.slice(match[0].length) };
        } catch {
          return { fm: {}, body: content };
        }
      }

      const { fm: skelFm, body: skelBody } = parseFrontmatter(skeleton);
      const { fm: varFm, body: varBody } = parseFrontmatter(variantContent);
      const mergedFm = { ...skelFm, ...varFm };
      const hasFrontmatter = Object.keys(mergedFm).length > 0;
      const fmStr = hasFrontmatter
        ? '---\n' + yaml.dump(mergedFm).trimEnd() + '\n---\n'
        : '';

      // Use varBody (frontmatter stripped) for section parsing; rebuild skeleton body only
      skeleton = fmStr + skelBody;
      const effectiveVariantContent = varBody;

      // Parse all ## sections from variant file
      const allSections = {};
      const lines = effectiveVariantContent.split('\n');
      let currentHeading = null;
      let currentLines = [];
      for (const line of lines) {
        if (line.startsWith('## ')) {
          if (currentHeading) allSections[currentHeading] = currentLines.join('\n');
          currentHeading = line.slice(3).trim();
          currentLines = [line];
        } else if (currentHeading) {
          currentLines.push(line);
        }
      }
      if (currentHeading) allSections[currentHeading] = currentLines.join('\n');

      // Map VARIANT-SECTION ids to heading names
      const headingMap = {
        'agent-roster': 'Agent Roster',
        'governance-workflow': 'Governance Workflow',
        'dispatch-protocol': 'Dispatch Protocol',
      };

      // Replace VARIANT-SECTION blocks in skeleton
      const vsRegex = /<!-- VARIANT-SECTION: ([\w-]+) -->([\s\S]*?)<!-- END VARIANT-SECTION -->/g;
      skeleton = skeleton.replace(vsRegex, (match, sectionId) => {
        const heading = headingMap[sectionId];
        if (heading && allSections[heading]) {
          return allSections[heading];
        }
        return ''; // remove markers if no variant section found
      });

      fs.writeFileSync(outFile, skeleton, 'utf8');
      console.log('  [SECTION-MERGE] agents/' + agentName + '.md (skeleton + variant sections)');
    }
BUNSCRIPT
fi

# ── 4. Remove .gitkeep placeholders ───────────────────────────────────────────  # TEST: Test 15
find "$PROJECT_DIR" -name ".gitkeep" -delete

# ── 5. Substitute placeholders in all text files ────────────────────────────── # TEST: Test 3, Test 2
if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/substitute-placeholders.ts" ]; then
  bun "$WORKSPACE_ROOT/scripts/helpers/substitute-placeholders.ts" "$PROJECT_DIR" "$PROJECT_NAME" "A new project" ""
else
  echo "⚠️  Placeholder substitution skipped (bun not available or helper missing)"
fi

# ── 5.5b. Update lifecycle.statusSince in the project's variant.json ────────  # TEST: Test 9
PROJECT_DATE="$(date -u +%Y-%m-%d)"
PROJ_VARIANT_JSON="$PROJECT_DIR/variant.json"
if [ -f "$PROJ_VARIANT_JSON" ]; then
  if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/update-variant-lifecycle.ts" ]; then
    bun "$WORKSPACE_ROOT/scripts/helpers/update-variant-lifecycle.ts" "$PROJECT_DIR" "$PROJECT_DATE" "$VARIANT"
  fi
fi

# ── 5.5c. Write scripts-snapshot.json with L1 script version map ─────────────  # TEST: Test 10
SCRIPTS_MD="$WORKSPACE_ROOT/scripts/SCRIPTS.md"
SNAPSHOT_FILE="$PROJECT_DIR/scripts-snapshot.json"
if [ -f "$SCRIPTS_MD" ]; then
  if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/write-scripts-snapshot.ts" ]; then
    bun "$WORKSPACE_ROOT/scripts/helpers/write-scripts-snapshot.ts" "$PROJECT_DIR" "$PROJECT_DATE" "$VARIANT" "templates/common/scripts"
  fi
fi

# ── 5.5d. Merge workspace scripts into package.json (Tier 2 integration) ───────  # TEST: Test 11
PKG_JSON="$PROJECT_DIR/package.json"
if [ -f "$PKG_JSON" ]; then
  if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/merge-package-scripts.ts" ]; then
    bun "$WORKSPACE_ROOT/scripts/helpers/merge-package-scripts.ts" "$PROJECT_DIR"
  fi
fi

# ── 5.5. Record template provenance in variant context file ───────────────────  # TEST: none
TEMPLATE_VERSION="${TEMPLATE_VER:-$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]' || echo 'unknown')}"
VARIANT_CONTEXT_MD="$PROJECT_DIR/docs/$VARIANT.context.md"
if [ -f "$VARIANT_CONTEXT_MD" ]; then
  # Add template provenance if not already present
  if ! grep -q "Template-Version:" "$VARIANT_CONTEXT_MD"; then
    printf '\n## Template Provenance\n\n- **Template-Version**: %s\n- **Template-Variant**: %s\n' \
      "$TEMPLATE_VERSION" "$VARIANT" >> "$VARIANT_CONTEXT_MD"
  fi
fi

# ── 5.6. Write template-version.txt for upgrade tracking ─────────────────────  # TEST: Test 12
CLAUDE_DIR="$PROJECT_DIR/.claude"
mkdir -p "$CLAUDE_DIR"
printf 'variant=%s\nversion=%s\nplatform=%s\ncreated=%s\n' \
  "$VARIANT" "$TEMPLATE_VERSION" "$PLATFORM" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$CLAUDE_DIR/template-version.txt"

# ── 5.6b. Inject AGENTS.md Skills into docs/context.md ──────────────────────  # TEST: Test 19
if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/inject-skills.ts" ]; then
  bun "$WORKSPACE_ROOT/scripts/helpers/inject-skills.ts" "$PROJECT_DIR"
fi

# ── 5.7. Protect context.md from accidental overwrites (merge=ours) ──────────  # TEST: Test 13
GITATTRIBUTES="$PROJECT_DIR/.gitattributes"
if [ -f "$GITATTRIBUTES" ]; then
  if ! grep -q "docs/context.md" "$GITATTRIBUTES"; then
    echo "docs/context.md merge=ours" >> "$GITATTRIBUTES"
  fi
else
  echo "docs/context.md merge=ours" > "$GITATTRIBUTES"
fi

# ── 6. Cleanup Strictly L0 Files ──────────────────────────────────────────────
# ── Remove L0-only scripts (SCRIPTS.md-driven via layer-filter.ts) ─────────────
if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/layer-filter.ts" ]; then
  # Authoritative: delegate to layer-filter.ts which reads SCRIPTS.md
  mapfile -t L0_SCRIPTS < <(bun "$WORKSPACE_ROOT/scripts/helpers/layer-filter.ts" --scripts-l0-only --format=list 2>/dev/null)
else
  # Minimal bootstrap fallback (only truly critical L0-only scripts)
  L0_SCRIPTS=("publish-to-template.ts" "validate-templates.ts" "create-l2-scaffold.ts" "l2-to-variant-pipeline.ts" "fix-script-versions.ts")
fi
for script in "${L0_SCRIPTS[@]}"; do
  rm -f "$PROJECT_DIR/scripts/$script"
  # Also clean up helpers and subdirs if they are L0
  rm -f "$PROJECT_DIR/scripts/helpers/$script"
done
# Always remove helpers/ directory (L0 pipeline internals — never needed in L2 projects)
rm -rf "$PROJECT_DIR/scripts/helpers/"

L0_SKILLS=("simulate-project-creation")
for skill in "${L0_SKILLS[@]}"; do
    rm -rf "$PROJECT_DIR/skills/$skill"
    rm -rf "$PROJECT_DIR/.claude/skills/$skill"
    rm -rf "$PROJECT_DIR/.gemini/skills/$skill"
done

# ── 6.1 Make scripts and hooks executable ───────────────────────────────────────  # TEST: Test 16, Test 5
find "$PROJECT_DIR/.githooks" -type f -exec chmod +x {} \;
find "$PROJECT_DIR/scripts" -name "*.sh" -exec chmod +x {} \;

# ── 7. Initialize git ──────────────────────────────────────────────────────────  # TEST: Test 4
cd "$PROJECT_DIR"
git init
git config core.hooksPath .githooks
if [ -z "$(git config user.email)" ]; then
  git config user.email "scaffold-bot@local"
  git config user.name "Scaffold Bot"
fi

# Mark .ps1 scripts executable in git index (for WSL / Git Bash users)
for rel in scripts/dev-sync.ps1 scripts/sync-md.ps1 scripts/setup.ps1; do
  [ -f "$rel" ] && git update-index --chmod=+x "$rel" 2>/dev/null || true
done

# ── 6.5. Security Bootstrap Verification ──────────────────────────────────────  # TEST: Test 6
echo ""
echo "Running security bootstrap verification…"
SECURITY_OK=true

# Check 1: .gitleaks.toml
if [ ! -f "$PROJECT_DIR/.gitleaks.toml" ]; then
  echo "  ❌ .gitleaks.toml not found"
  SECURITY_OK=false
else
  echo "  ✅ .gitleaks.toml present"
fi

# Check 2: pre-commit hook exists
if [ ! -f "$PROJECT_DIR/.githooks/pre-commit" ]; then
  echo "  ❌ .githooks/pre-commit not found"
  SECURITY_OK=false
else
  echo "  ✅ .githooks/pre-commit present"
fi

# Check 3: .gitattributes has eol=lf
if [ -f "$PROJECT_DIR/.gitattributes" ] && grep -q "eol=lf" "$PROJECT_DIR/.gitattributes"; then
  echo "  ✅ .gitattributes has eol=lf"
else
  echo "  ❌ .gitattributes missing eol=lf"
  SECURITY_OK=false
fi

# Check 4: .gitignore has .env pattern
if [ -f "$PROJECT_DIR/.gitignore" ] && grep -q "\.env" "$PROJECT_DIR/.gitignore"; then
  echo "  ✅ .gitignore excludes .env"
else
  echo "  ❌ .gitignore missing .env exclusion"
  SECURITY_OK=false
fi

# Check 5: git config core.hooksPath set
if git -C "$PROJECT_DIR" config core.hooksPath | grep -q "\.githooks"; then
  echo "  ✅ git core.hooksPath configured"
else
  echo "  ❌ git core.hooksPath not set to .githooks"
  SECURITY_OK=false
fi

if [ "$SECURITY_OK" = false ]; then
  echo ""
  echo "❌ Security bootstrap check FAILED. Fix the issues above before using this project."
  echo "   Run 'bun scripts/audit.ts' after fixing to verify."
  exit 1
fi
echo "  ✅ All security bootstrap checks passed"

# ── 8. Post-scaffold audit ────────────────────────────────────────────────────  # TEST: none
echo ""
echo "Running post-scaffold audit…"
if bun "$WORKSPACE_ROOT/scripts/audit.ts"; then
  echo ""
  echo "✅ Project '$PROJECT_NAME' scaffolded and verified at: $PROJECT_DIR"
else
  echo ""
  echo "⚠️  Project scaffolded but audit found issues - review above before continuing."
fi


# ── 9. Environment setup (env file, deps, initial commit) ──────────────────── # TEST: none
echo ""
echo "Running environment setup…"
bash "$PROJECT_DIR/scripts/setup.sh" || {
  echo ""
  echo "⚠️  Setup encountered an error - run 'bash scripts/setup.sh' manually to retry."
}

# ── 10. Move into project directory ───────────────────────────────────────────  # TEST: none
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

# --- Dynamic Plugin Injection ---
if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/helpers/inject-global-plugins.ts" ]; then
  bun "$WORKSPACE_ROOT/scripts/helpers/inject-global-plugins.ts" "$PROJECT_DIR" "${PLATFORM:-both}"
fi
