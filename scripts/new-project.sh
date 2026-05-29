#!/usr/bin/env bash
# new-project.sh - Scaffold a new project under the workspace root
# Usage: bash scripts/new-project.sh "<project-name>" [--variant co-develop|co-design|co-work|co-security] [--version X.Y.Z]

# Force English locale for consistent error messages
export LC_ALL=C
export LANG=C

set -euo pipefail

VARIANT="co-develop"
TEMPLATE_VER=""
PROJECT_NAME=""
PLATFORM="both"

# Parse optional arguments
prev_arg=""
for arg in "$@"; do
  if [ "$prev_arg" = "--variant" ]; then
    VARIANT="$arg"
  elif [ "$prev_arg" = "--version" ]; then
    TEMPLATE_VER="$arg"
  elif [ "$prev_arg" = "--platform" ]; then
    PLATFORM="$arg"
  elif [[ "$arg" != --* ]] && [ "$prev_arg" != "--variant" ] && [ "$prev_arg" != "--version" ] && [ "$prev_arg" != "--platform" ] && [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="$arg"
  fi
  prev_arg="$arg"
done

# Validate required arguments
if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: bash scripts/new-project.sh \"<project-name>\" [--variant co-develop|co-design|co-work|co-security] [--platform claude|antigravity|both] [--version X.Y.Z]"
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
  echo "❌ --variant requires a value. Available: co-develop, co-design, co-work, co-security"
  exit 1
fi

# Validate --platform flag
if [[ "$PLATFORM" != "claude" && "$PLATFORM" != "antigravity" && "$PLATFORM" != "both" ]]; then
  echo "❌ --platform must be: claude, antigravity, or both (default: both)"
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
  echo "   Available variants: co-develop (stable), co-design (stable), co-work (stable), co-security (draft)"
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

# ── D-05: lifecycle-governance.json variant pre-check ─────────────────────────
GOVERNANCE_JSON="$WORKSPACE_ROOT/templates/common/lifecycle-governance.json"
if command -v bun &>/dev/null && [ -f "$WORKSPACE_ROOT/scripts/validate-templates.ts" ] && [ -f "$GOVERNANCE_JSON" ]; then
  echo ""
  echo "Running lifecycle governance pre-check for variant '$VARIANT'…"

  # Determine mandatory domains from governance JSON
  MANDATORY_DOMAINS=$(python3 -c "
import json, sys
data = json.load(open(sys.argv[1], encoding='utf-8'))
policy = data.get('variantValidationPolicy', {})
print(','.join(policy.get('mandatoryBeforeProjectCreation', ['variant', 'agent', 'skill'])))
" "$GOVERNANCE_JSON" 2>/dev/null || echo "variant,agent,skill")

  # Run validate-templates for the selected variant in JSON mode
  VALIDATE_OUTPUT=$(bun "$WORKSPACE_ROOT/scripts/validate-templates.ts" --variant "$VARIANT" --json 2>/dev/null || echo '{"errors":[{"check":"validate-failed","message":"validate-templates.ts failed to run"}]}')

  # Check mandatory domain errors
  GOVERNANCE_ERRORS=$(python3 -c "
import json, sys
output, mandatory = sys.argv[1], sys.argv[2].split(',')
try:
    data = json.loads(output)
    errors = data.get('errors', [])
    mandatory_errors = [e for e in errors if any(d in e.get('check', '') for d in mandatory)]
    if mandatory_errors:
        for e in mandatory_errors:
            print('  ❌ ' + e.get('message', ''))
        sys.exit(1)
except Exception as ex:
    print('  WARN: Could not parse validation output: ' + str(ex))
    sys.exit(0)
" "$VALIDATE_OUTPUT" "$MANDATORY_DOMAINS" 2>/dev/null)

  GOVERNANCE_EXIT=$?
  if [ -n "$GOVERNANCE_ERRORS" ]; then
    echo "$GOVERNANCE_ERRORS"
  fi

  if [ "$GOVERNANCE_EXIT" -ne 0 ]; then
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

# ── 2.5. Apply platform profile ────────────────────────────────────────────────
if [ "$PLATFORM" = "claude" ]; then
  rm -f "$PROJECT_DIR/GEMINI.md"
elif [ "$PLATFORM" = "antigravity" ]; then
  rm -f "$PROJECT_DIR/CLAUDE.md"
fi

# ── 2.6. Remove any accidentally copied .cmd files ────────────────────────────
find "$PROJECT_DIR" -name "*.cmd" -delete

# ── 3. Remove docs/_examples (reference-only - not part of a real project) ───
rm -rf "$PROJECT_DIR/docs/_examples"

# ── 3.5. Enforce .sh / .ps1 script pairs ──────────────────────────────────────
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

# ── 4. Remove .gitkeep placeholders ────────────────────────────────────────────
find "$PROJECT_DIR" -name ".gitkeep" -delete

# ── 5. Substitute placeholders in all text files ─────────────────────────────
while IFS= read -r -d '' file; do
  python3 -c "
import sys
path, name = sys.argv[1], sys.argv[2]
content = open(path, encoding='utf-8').read()
content = content.replace('[Project Name]', name)
content = content.replace('{{PROJECT_NAME}}', name)
content = content.replace('{{PROJECT_DESCRIPTION}}', 'A new project')
content = content.replace('{{PROJECT_CHARACTERISTICS}}', '')
open(path, 'w', encoding='utf-8').write(content)
" "$file" "$PROJECT_NAME"
done < <(find "$PROJECT_DIR" -type f \
  \( -name "*.md" -o -name "*.json" -o -name "*.sh" -o -name "*.ps1" \
     -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" -o -name "*.sample" \) \
  -print0)

# ── 5.5b. Update lifecycle.statusSince in the project's variant.json ─────────
PROJECT_DATE="$(date -u +%Y-%m-%d)"
PROJ_VARIANT_JSON="$PROJECT_DIR/variant.json"
if [ -f "$PROJ_VARIANT_JSON" ]; then
  python3 -c "
import sys, json
path, date, variant = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(path, encoding='utf-8'))
lc = data.get('lifecycle', {})
lc['statusSince'] = date
lc['lastTransition'] = 'initial → ' + data.get('status', 'unknown') + ' on ' + date
data['lifecycle'] = lc
json.dump(data, open(path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
open(path, 'a', encoding='utf-8').write('\n')
" "$PROJ_VARIANT_JSON" "$PROJECT_DATE" "$VARIANT"
  echo "  ✅ variant.json lifecycle.statusSince set to $PROJECT_DATE"
fi

# ── 5.5c. Write scripts-snapshot.json with L1 script version map ──────────────
SCRIPTS_MD="$WORKSPACE_ROOT/scripts/SCRIPTS.md"
SNAPSHOT_FILE="$PROJECT_DIR/scripts-snapshot.json"
if [ -f "$SCRIPTS_MD" ]; then
  python3 -c "
import sys, json, re
scripts_md, snapshot_path, date, variant, l1_source = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
content = open(scripts_md, encoding='utf-8').read()
registry_match = re.search(r'## Registry\n.*?\n\|[-| ]+\|\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
scripts = {}
if registry_match:
    for line in registry_match.group(1).strip().split('\n'):
        parts = [p.strip() for p in line.split('|') if p.strip()]
        if len(parts) >= 4:
            name = parts[0].strip('\`')
            version = parts[2]
            status = parts[3]
            if re.match(r'^\d+\.\d+\.\d+$', version):
                scripts[name] = {'version': version, 'status': status}
snapshot = {'created': date, 'variant': variant, 'l1_source': l1_source, 'scripts': scripts}
json.dump(snapshot, open(snapshot_path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
open(snapshot_path, 'a', encoding='utf-8').write('\n')
" "$SCRIPTS_MD" "$SNAPSHOT_FILE" "$PROJECT_DATE" "$VARIANT" "templates/common/scripts"
  echo "  ✅ scripts-snapshot.json written ($(python3 -c "import json; d=json.load(open('$SNAPSHOT_FILE')); print(len(d['scripts']))" 2>/dev/null || echo '?') scripts)"
fi

# ── 5.5d. Merge workspace scripts into package.json (Tier 2 integration) ────────
PKG_JSON="$PROJECT_DIR/package.json"
if [ -f "$PKG_JSON" ]; then
  python3 -c "
import sys, json
path = sys.argv[1]
data = json.load(open(path, encoding='utf-8'))
scripts = data.get('scripts', {})
workspace_scripts = {
    'audit': 'bun scripts/audit.ts',
    'dev-sync': 'bun scripts/dev-sync.ts',
    'sync-md': 'bun scripts/sync-md.ts'
}
for k, v in workspace_scripts.items():
    if k not in scripts:
        scripts[k] = v
data['scripts'] = scripts
json.dump(data, open(path, 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
open(path, 'a', encoding='utf-8').write('\n')
" "$PKG_JSON"
  echo "  ✅ Tier 2 scripts merged into package.json"
fi

# ── 5.5. Record template provenance in variant context file ───────────────────
TEMPLATE_VERSION="${TEMPLATE_VER:-$(cat "$VERSION_FILE" 2>/dev/null | tr -d '[:space:]' || echo 'unknown')}"
VARIANT_CONTEXT_MD="$PROJECT_DIR/docs/$VARIANT.context.md"
if [ -f "$VARIANT_CONTEXT_MD" ]; then
  # Add template provenance if not already present
  if ! grep -q "Template-Version:" "$VARIANT_CONTEXT_MD"; then
    printf '\n## Template Provenance\n\n- **Template-Version**: %s\n- **Template-Variant**: %s\n' \
      "$TEMPLATE_VERSION" "$VARIANT" >> "$VARIANT_CONTEXT_MD"
  fi
fi

# ── 5.6. Write template-version.txt for upgrade tracking ──────────────────────
CLAUDE_DIR="$PROJECT_DIR/.claude"
mkdir -p "$CLAUDE_DIR"
printf 'variant=%s\nversion=%s\nplatform=%s\ncreated=%s\n' \
  "$VARIANT" "$TEMPLATE_VERSION" "$PLATFORM" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > "$CLAUDE_DIR/template-version.txt"

# ── 5.6b. Inject AGENTS.md Skills into docs/context.md ───────────────────────
AGENTS_MD="$PROJECT_DIR/AGENTS.md"
CONTEXT_MD="$PROJECT_DIR/docs/$VARIANT.context.md"
if [ -f "$AGENTS_MD" ] && [ -f "$CONTEXT_MD" ]; then
  python3 -c "
import sys, re
agents_path, context_path = sys.argv[1], sys.argv[2]
agents = open(agents_path, encoding='utf-8').read()
context = open(context_path, encoding='utf-8').read()
m = re.search(r'^## Skills\s*(\| Skill .*?)(?=\n---|\Z)', agents, re.MULTILINE | re.DOTALL)
if m:
    skills_table = m.group(1).strip()
    new_context = re.sub(
        r'(<!-- DYNAMIC_SKILLS_START -->).*?(<!-- DYNAMIC_SKILLS_END -->)',
        r'\1\n' + skills_table + r'\n\2',
        context, flags=re.DOTALL
    )
    if new_context != context:
        open(context_path, 'w', encoding='utf-8').write(new_context)
        print('  ✅ Injected dynamic skills from AGENTS.md into docs/context.md')
" "$AGENTS_MD" "$CONTEXT_MD" 2>/dev/null || true
fi

# ── 5.7. Protect context.md from accidental overwrites (merge=ours) ───────────
GITATTRIBUTES="$PROJECT_DIR/.gitattributes"
if [ -f "$GITATTRIBUTES" ]; then
  if ! grep -q "docs/context.md" "$GITATTRIBUTES"; then
    echo "docs/context.md merge=ours" >> "$GITATTRIBUTES"
  fi
else
  echo "docs/context.md merge=ours" > "$GITATTRIBUTES"
fi

# ── 6. Make scripts and hooks executable ───────────────────────────────────────
find "$PROJECT_DIR/.githooks" -type f -exec chmod +x {} \;
find "$PROJECT_DIR/scripts" -name "*.sh" -exec chmod +x {} \;

# ── 7. Initialize git ──────────────────────────────────────────────────────────
cd "$PROJECT_DIR"
git init
git config core.hooksPath .githooks

# Mark .ps1 scripts executable in git index (for WSL / Git Bash users)
for rel in scripts/dev-sync.ps1 scripts/audit.ps1 scripts/sync-md.ps1 scripts/setup.ps1; do
  [ -f "$rel" ] && git update-index --chmod=+x "$rel" 2>/dev/null || true
done

# ── 6.5. Security Bootstrap Verification ──────────────────────────────────────
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
  echo "   Run 'bash scripts/audit.sh' after fixing to verify."
  exit 1
fi
echo "  ✅ All security bootstrap checks passed"

# ── 8. Post-scaffold audit ─────────────────────────────────────────────────────
echo ""
echo "Running post-scaffold audit…"
if bash scripts/audit.sh; then
  echo ""
  echo "✅ Project '$PROJECT_NAME' scaffolded and verified at: $PROJECT_DIR"
else
  echo ""
  echo "⚠️  Project scaffolded but audit found issues - review above before continuing."
fi

# ── 9. Environment setup (env file, deps, initial commit) ─────────────────────
echo ""
echo "Running environment setup…"
bash "$PROJECT_DIR/scripts/setup.sh" || {
  echo ""
  echo "⚠️  Setup encountered an error - run 'bash scripts/setup.sh' manually to retry."
}

# ── 10. Move into project directory ────────────────────────────────────────────
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
