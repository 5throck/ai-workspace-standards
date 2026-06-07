#!/usr/bin/env bash
# upgrade-project.sh - Upgrade an existing project to the current template version
# @version 1.1.0
# Usage: bash scripts/upgrade-project.sh <project-path> [--variant <variant>] [--platform claude|antigravity|both] [--dry-run]
# Variants are auto-detected from the templates/ directory (e.g. co-develop, co-design, co-consult, co-security).

export LC_ALL=C
export LANG=C
set -euo pipefail

# --- defaults ---
PROJECT_PATH=""
VARIANT=""
PLATFORM="both"
DRY_RUN=false

# --- arg parsing ---
prev_arg=""
for arg in "$@"; do
  if [ "$prev_arg" = "--variant" ]; then
    VARIANT="$arg"
  elif [ "$prev_arg" = "--platform" ]; then
    PLATFORM="$arg"
  elif [ "$arg" = "--dry-run" ]; then
    DRY_RUN=true
  elif [[ "$arg" != --* ]] && [ "$prev_arg" != "--variant" ] && [ "$prev_arg" != "--platform" ] && [ -z "$PROJECT_PATH" ]; then
    PROJECT_PATH="$arg"
  fi
  prev_arg="$arg"
done

# --- usage ---
if [ -z "$PROJECT_PATH" ]; then
  echo "Usage: bash scripts/upgrade-project.sh <project-path> [--variant <variant>] [--platform claude|antigravity|both] [--dry-run]"
  echo "  Variants are auto-detected from templates/ (e.g. co-develop, co-design, co-consult, co-security)"
  exit 1
fi

# --- resolve workspace root ---
WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$WORKSPACE_ROOT/templates/VERSION"
CURRENT_VERSION="$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]' || echo 'unknown')"

# --- resolve project dir (absolute) ---
if [[ "$PROJECT_PATH" = /* ]]; then
  PROJECT_DIR="$PROJECT_PATH"
else
  PROJECT_DIR="$(cd "$PROJECT_PATH" 2>/dev/null && pwd)" || {
    echo "ERROR: Project path does not exist: $PROJECT_PATH"
    exit 1
  }
fi

if [ ! -d "$PROJECT_DIR" ]; then
  echo "ERROR: Project directory not found: $PROJECT_DIR"
  exit 1
fi

# --- validate git repo ---
if ! git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: Not a git repository: $PROJECT_DIR"
  exit 1
fi

# --- validate platform ---
if [[ "$PLATFORM" != "claude" && "$PLATFORM" != "antigravity" && "$PLATFORM" != "both" ]]; then
  echo "ERROR: --platform must be one of: claude, antigravity, both"
  exit 1
fi

# --- detect or validate variant ---
TEMPLATE_VERSION_FILE="$PROJECT_DIR/.claude/template-version.txt"
DETECTED_VERSION="unknown"
DETECTED_VARIANT=""

if [ -f "$TEMPLATE_VERSION_FILE" ]; then
  DETECTED_VARIANT="$(grep '^variant=' "$TEMPLATE_VERSION_FILE" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo '')"
  DETECTED_VERSION="$(grep '^version=' "$TEMPLATE_VERSION_FILE" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo 'unknown')"
else
  echo ""
  echo "WARNING: template-version.txt not found in this project."
  echo "    This project may have been created before version tracking was introduced."
  echo "    Treating as: unknown -> current ($CURRENT_VERSION)"
  echo ""
  read -r -p "    Proceed? [y/N] " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# Use CLI-specified variant or fall back to detected
if [ -z "$VARIANT" ]; then
  if [ -n "$DETECTED_VARIANT" ]; then
    VARIANT="$DETECTED_VARIANT"
    echo "Auto-detected variant: $VARIANT"
  else
    echo "ERROR: Could not detect variant from template-version.txt. Specify --variant explicitly."
    exit 1
  fi
fi

# Validate variant - detect valid variants dynamically from templates/ directory
VALID_VARIANTS=$(ls "$WORKSPACE_ROOT/templates/" 2>/dev/null | grep "^co-" | sort -u || echo "")

if ! echo "$VALID_VARIANTS" | grep -qx "$VARIANT"; then
  echo "ERROR: Invalid variant: $VARIANT"
  echo "   Valid variants: $(echo $VALID_VARIANTS | tr '\n' ' ')"
  exit 1
fi

TEMPLATES_DIR="$WORKSPACE_ROOT/templates/$VARIANT"
COMMON_DIR="$WORKSPACE_ROOT/templates/common"

if [ ! -d "$TEMPLATES_DIR" ]; then
  echo "ERROR: Template variant not found: $TEMPLATES_DIR"
  exit 1
fi

if [ ! -d "$COMMON_DIR" ]; then
  echo "ERROR: Common templates directory not found: $COMMON_DIR"
  exit 1
fi

# ── C-05: scripts-snapshot.json version comparison ────────────────────────────
SCRIPTS_SNAPSHOT="$PROJECT_DIR/scripts-snapshot.json"
SCRIPTS_MD="$WORKSPACE_ROOT/scripts/SCRIPTS.md"

if [ -f "$SCRIPTS_SNAPSHOT" ] && [ -f "$SCRIPTS_MD" ]; then
  echo ""
  echo "--- Script version comparison (L2 snapshot vs L1 current) ---"

  python3 - "$SCRIPTS_SNAPSHOT" "$SCRIPTS_MD" <<'PYEOF'
import sys, json, re

snapshot_path, scripts_md_path = sys.argv[1], sys.argv[2]

try:
    snapshot = json.load(open(snapshot_path, encoding='utf-8'))
    l2_scripts = snapshot.get('scripts', {})
    created = snapshot.get('created', 'unknown')
    print(f"  Snapshot created: {created}  ({len(l2_scripts)} scripts)")
except Exception as e:
    print(f"  WARN: Could not parse scripts-snapshot.json: {e}")
    sys.exit(0)

content = open(scripts_md_path, encoding='utf-8').read()
registry_match = re.search(r'## Registry\n.*?\n\|[-| ]+\|\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
l1_scripts = {}
if registry_match:
    for line in registry_match.group(1).strip().split('\n'):
        parts = [p.strip() for p in line.split('|') if p.strip()]
        if len(parts) >= 4 and re.match(r'^\d+\.\d+\.\d+$', parts[2]):
            name = parts[0].strip('`')
            l1_scripts[name] = {'version': parts[2], 'status': parts[3]}

outdated = []
deprecated_in_l1 = []
for name, l2_info in l2_scripts.items():
    l1_info = l1_scripts.get(name)
    if not l1_info:
        continue
    if l2_info['version'] != l1_info['version']:
        outdated.append((name, l2_info['version'], l1_info['version']))
    if l1_info['status'] == 'deprecated':
        deprecated_in_l1.append((name, l1_info['version']))

if not outdated and not deprecated_in_l1:
    print("  ✅ All scripts up-to-date with L1 SCRIPTS.md")
else:
    if outdated:
        print(f"  ⚠️  {len(outdated)} script(s) have newer versions available:")
        for name, old, new in outdated:
            print(f"     {name:<40} {old} → {new}")
    if deprecated_in_l1:
        print(f"  ❌ {len(deprecated_in_l1)} script(s) are deprecated in L1 SCRIPTS.md:")
        for name, ver in deprecated_in_l1:
            print(f"     {name:<40} {ver}  (deprecated — remove or replace)")
    print("")
    print("  Run: bash scripts/upgrade-project.sh <path> to get updated scripts.")
PYEOF
  echo ""
elif [ -f "$SCRIPTS_SNAPSHOT" ]; then
  echo ""
  echo "  INFO: scripts-snapshot.json found but SCRIPTS.md not accessible — skipping version comparison."
  echo ""
fi

# --- print header ---
echo ""
echo "========================================================"
if $DRY_RUN; then
  echo "  [DRY RUN] upgrade-project.sh"
else
  echo "  upgrade-project.sh"
fi
echo "  Project : $PROJECT_DIR"
echo "  Variant : $VARIANT"
echo "  Platform: $PLATFORM"
echo "  From    : ${DETECTED_VERSION}"
echo "  To      : ${CURRENT_VERSION}"
echo "========================================================"
echo ""

# ============================================================
# Pre-upgrade snapshot (done BEFORE any file writes)
# ============================================================
if ! $DRY_RUN; then
  echo "--- Creating pre-upgrade git stash snapshot ---"
  SNAP_DATE="$(date +%Y%m%d)"
  if git -C "$PROJECT_DIR" stash push -m "pre-upgrade-snapshot-${SNAP_DATE}" 2>/dev/null; then
    echo "Snapshot saved. To revert: git stash pop"
  else
    echo "INFO: Nothing to stash (working tree clean) - snapshot skipped."
  fi
  echo ""
fi

# --- helpers ---
dry_prefix() {
  $DRY_RUN && printf "[DRY RUN] " || true
}

# Resolve template source: prefer variant-specific file, fall back to common
resolve_template() {
  local rel="$1"
  local variant_file="$TEMPLATES_DIR/$rel"
  local common_file="$COMMON_DIR/$rel"
  if [ -f "$variant_file" ]; then
    echo "$variant_file"
  elif [ -f "$common_file" ]; then
    echo "$common_file"
  else
    echo ""
  fi
}

# Show a line diff summary between two files
diff_summary() {
  local old="$1"
  local new="$2"
  if [ ! -f "$old" ]; then
    echo "    (project file does not exist - will create)"
    return
  fi
  local old_lines new_lines
  old_lines=$(wc -l < "$old" 2>/dev/null || echo 0)
  new_lines=$(wc -l < "$new" 2>/dev/null || echo 0)
  local added removed
  added=$(diff "$old" "$new" 2>/dev/null | grep -c '^>' || true)
  removed=$(diff "$old" "$new" 2>/dev/null | grep -c '^<' || true)
  echo "    Lines: $old_lines -> $new_lines  (+${added}/-${removed})"
}

# Extract content between <!-- WORKSPACE-MANAGED --> markers from a file
# Returns: 0 if markers found, 1 if not
extract_managed_block() {
  local file="$1"
  # Returns the content between the markers (inclusive of markers)
  if grep -q '<!-- WORKSPACE-MANAGED -->' "$file" 2>/dev/null; then
    return 0
  fi
  return 1
}

# Replace WORKSPACE-MANAGED section in project file with template's section
merge_workspace_managed() {
  local project_file="$1"
  local template_file="$2"
  local rel="$3"

  # Check if template has markers
  if ! grep -q '<!-- WORKSPACE-MANAGED -->' "$template_file" 2>/dev/null; then
    echo "    INFO: Template has no WORKSPACE-MANAGED markers - skipping $rel"
    return 0
  fi

  # Extract template managed block content (between markers)
  local tpl_block
  tpl_block=$(awk '/<!-- WORKSPACE-MANAGED -->/{found=1} found{print} /<!-- \/WORKSPACE-MANAGED -->/{found=0}' "$template_file")

  if [ ! -f "$project_file" ]; then
    echo "    INFO: Project file does not exist, will create with template content"
    if ! $DRY_RUN; then
      mkdir -p "$(dirname "$project_file")"
      cp "$template_file" "$project_file"
    fi
    $(dry_prefix)echo "    CREATED: $rel"
    return 0
  fi

  if grep -q '<!-- WORKSPACE-MANAGED -->' "$project_file" 2>/dev/null; then
    # Replace between markers
    if ! $DRY_RUN; then
      # Use python for reliable multi-line replacement
      python3 - "$project_file" "$template_file" <<'PYEOF'
import sys, re

proj_path = sys.argv[1]
tpl_path  = sys.argv[2]

with open(proj_path, 'r', encoding='utf-8', errors='replace') as f:
    proj = f.read()
with open(tpl_path, 'r', encoding='utf-8', errors='replace') as f:
    tpl = f.read()

marker_start = '<!-- WORKSPACE-MANAGED -->'
marker_end   = '<!-- /WORKSPACE-MANAGED -->'

# Extract template block (inclusive)
tpl_match = re.search(re.escape(marker_start) + r'.*?' + re.escape(marker_end), tpl, re.DOTALL)
if not tpl_match:
    sys.exit(0)
tpl_block = tpl_match.group(0)

# Replace in project
result = re.sub(re.escape(marker_start) + r'.*?' + re.escape(marker_end), tpl_block, proj, flags=re.DOTALL)

with open(proj_path, 'w', encoding='utf-8') as f:
    f.write(result)
PYEOF
    fi
    echo "    $(dry_prefix)MERGED managed section in: $rel"
  else
    # No markers in project file — append markers+content at end
    echo "    WARNING: $rel has no WORKSPACE-MANAGED markers."
    echo "             Appending managed block at end of file."
    if ! $DRY_RUN; then
      printf '\n\n%s\n' "$tpl_block" >> "$project_file"
    fi
    echo "    $(dry_prefix)APPENDED managed block to: $rel"
  fi
}

# --- tracking ---
LOCKED_CHANGED=0
MERGE_CHANGED=0
PRESERVE_LISTED=0

# ============================================================
# LOCKED files - always overwrite
# ============================================================
echo "--- LOCKED files (always overwrite) ---"

LOCKED_FILES=(
  ".githooks/pre-commit"
  ".githooks/pre-push"
  ".githooks/commit-msg"
  ".githooks/post-checkout"
  ".githooks/pre-rebase"
  ".gitattributes"
  ".gitleaks.toml"
)

for rel in "${LOCKED_FILES[@]}"; do
  src="$(resolve_template "$rel")"
  dest="$PROJECT_DIR/$rel"

  if [ -z "$src" ]; then
    echo "  SKIP (no template): $rel"
    continue
  fi

  echo "  LOCKED: $rel"
  diff_summary "$dest" "$src"

  if ! $DRY_RUN; then
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    # Make hooks executable
    if [[ "$rel" == .githooks/* ]]; then
      chmod +x "$dest"
    fi
  fi
  echo "  $(dry_prefix)WROTE: $rel"
  LOCKED_CHANGED=$((LOCKED_CHANGED + 1))
done

echo ""

# ============================================================
# MERGE files - WORKSPACE-MANAGED sections only
# ============================================================
echo "--- MERGE files (WORKSPACE-MANAGED sections) ---"

# Build MERGE list based on --platform flag
MERGE_FILES=()

# Platform-conditional
if [[ "$PLATFORM" == "claude" || "$PLATFORM" == "both" ]]; then
  MERGE_FILES+=("CLAUDE.md")
fi
if [[ "$PLATFORM" == "antigravity" || "$PLATFORM" == "both" ]]; then
  MERGE_FILES+=("GEMINI.md")
fi

# Always merge
MERGE_FILES+=(
  "CONSTITUTION.md"
  ".gitignore"
  "agents/pm.md"
  "agents/architect.md"
  "agents/automation-engineer.md"
  "agents/docs-writer.md"
  "agents/scaffolding-expert.md"
  "agents/security-expert.md"
)

for rel in "${MERGE_FILES[@]}"; do
  src="$(resolve_template "$rel")"
  dest="$PROJECT_DIR/$rel"

  if [ -z "$src" ]; then
    echo "  SKIP (no template): $rel"
    continue
  fi

  echo "  MERGE: $rel"
  merge_workspace_managed "$dest" "$src" "$rel"
  MERGE_CHANGED=$((MERGE_CHANGED + 1))
done

echo ""

# ============================================================
# PRESERVE files - list only, never touch
# ============================================================
echo "--- PRESERVE files (listed only, not modified) ---"

PRESERVE_FILES=(
  "README.md"
  "README_ko.md"
  "docs/context.md"
)

for rel in "${PRESERVE_FILES[@]}"; do
  dest="$PROJECT_DIR/$rel"
  if [ -f "$dest" ]; then
    echo "  PRESERVE: $rel"
    PRESERVE_LISTED=$((PRESERVE_LISTED + 1))
  fi
done

# Check for src/ directory
if [ -d "$PROJECT_DIR/src" ]; then
  echo "  PRESERVE: src/ (directory - not touched)"
  PRESERVE_LISTED=$((PRESERVE_LISTED + 1))
fi

echo ""

# ============================================================
# Post-upgrade: write template-version.txt
# ============================================================
if ! $DRY_RUN; then
  mkdir -p "$PROJECT_DIR/.claude"
  ISO_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ)"
  cat > "$TEMPLATE_VERSION_FILE" <<EOF
variant=${VARIANT}
version=${CURRENT_VERSION}
platform=${PLATFORM}
upgraded=${ISO_NOW}
EOF
  echo "Written: .claude/template-version.txt (version=$CURRENT_VERSION)"
else
  echo "[DRY RUN] Would write: .claude/template-version.txt (version=$CURRENT_VERSION)"
fi
echo ""

# ============================================================
# Security Bootstrap Verification
# ============================================================
echo "--- Security Bootstrap Verification ---"
SECURITY_PASS=true

# 1. .gitleaks.toml exists
if [ -f "$PROJECT_DIR/.gitleaks.toml" ]; then
  echo "  OK  .gitleaks.toml exists"
else
  echo "  FAIL .gitleaks.toml missing"
  SECURITY_PASS=false
fi

# 2. .githooks/pre-commit exists
if [ -f "$PROJECT_DIR/.githooks/pre-commit" ]; then
  echo "  OK  .githooks/pre-commit exists"
else
  echo "  FAIL .githooks/pre-commit missing"
  SECURITY_PASS=false
fi

# 3. .gitattributes has eol=lf
if grep -q 'eol=lf' "$PROJECT_DIR/.gitattributes" 2>/dev/null; then
  echo "  OK  .gitattributes has eol=lf"
else
  echo "  FAIL .gitattributes missing eol=lf"
  SECURITY_PASS=false
fi

# 4. .gitignore has .env pattern
if grep -q '\.env' "$PROJECT_DIR/.gitignore" 2>/dev/null; then
  echo "  OK  .gitignore has .env pattern"
else
  echo "  FAIL .gitignore missing .env pattern"
  SECURITY_PASS=false
fi

# 5. git core.hooksPath set to .githooks
HOOKS_PATH="$(git -C "$PROJECT_DIR" config core.hooksPath 2>/dev/null || echo '')"
if [ "$HOOKS_PATH" = ".githooks" ]; then
  echo "  OK  git core.hooksPath = .githooks"
else
  echo "  WARN git core.hooksPath = '${HOOKS_PATH}' (expected .githooks)"
  if ! $DRY_RUN; then
    git -C "$PROJECT_DIR" config core.hooksPath .githooks
    echo "       -> Auto-fixed: set core.hooksPath to .githooks"
  fi
fi

echo ""

# ============================================================
# Summary
# ============================================================
echo "========================================================"
echo "  Upgrade Complete"
echo "  Locked files updated : $LOCKED_CHANGED"
echo "  Merge files processed: $MERGE_CHANGED"
echo "  Preserve files listed: $PRESERVE_LISTED"
if $SECURITY_PASS; then
  echo "  Security checks      : PASSED"
else
  echo "  Security checks      : FAILED (see above)"
fi
if $DRY_RUN; then
  echo ""
  echo "  [DRY RUN] No files were modified."
fi
echo "========================================================"
