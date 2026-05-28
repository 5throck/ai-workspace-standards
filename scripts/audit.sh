#!/usr/bin/env bash
# audit.sh - Documentation integrity check
# Checks that required files and sections exist before a commit.
# Exit code 0 = pass, non-zero = fail.
set -euo pipefail

errors=0

red()   { echo -e "\033[31m[FAIL]\033[0m $*"; }
green() { echo -e "\033[32m[PASS]\033[0m $*"; }
warn()  { echo -e "\033[33m[WARN]\033[0m $*"; }

echo "=== audit.sh - workspace standards check ==="

# 1. CHANGELOG.md must exist
if [ -f "CHANGELOG.md" ]; then
  green "CHANGELOG.md exists"
else
  red  "CHANGELOG.md missing"
  ((errors++)) || true
fi

# 2. CONSTITUTION.md must be accessible (workspace root OR one level up for project dirs)
if [ -f "CONSTITUTION.md" ] || [ -f "../CONSTITUTION.md" ]; then
  green "CONSTITUTION.md accessible"
else
  red  "CONSTITUTION.md not found (expected at ./ or ../)"
  ((errors++)) || true
fi

# 2.5. Constitution section files must exist and be non-empty (workspace root only)
if [ -f "CONSTITUTION.md" ] && [ -d "docs/constitution" ]; then
  for ref in $(grep -oP '(?<=docs/constitution/)[\w.-]+\.md' CONSTITUTION.md 2>/dev/null || true); do
    if [ -s "docs/constitution/$ref" ]; then
      green "constitution section: $ref"
    else
      red "constitution section missing or empty: docs/constitution/$ref"
      ((errors++)) || true
    fi
  done
fi

# 2.6. Web URL link validation (workspace root only)
if [ -f "AGENTS.md" ] || [ -f "templates/common/docs/context.md" ]; then
  link_errors=0
  base_url="https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md"

  # Check if curl is available
  if command -v curl &>/dev/null; then
    # Check AGENTS.md web URLs
    if [ -f "AGENTS.md" ]; then
      web_urls=$(grep -oP 'https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#[\w-]+' AGENTS.md 2>/dev/null || true)
      for url in $web_urls; do
        if curl -fsI "$url" &>/dev/null; then
          : # Link is valid
        else
          red "Dead link detected in AGENTS.md: $url"
          ((link_errors++)) || true
        fi
      done
    fi

    # Check templates/common/docs/context.md web URLs
    if [ -f "templates/common/docs/context.md" ]; then
      web_urls=$(grep -oP 'https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#[\w-]+' templates/common/docs/context.md 2>/dev/null || true)
      for url in $web_urls; do
        if curl -fsI "$url" &>/dev/null; then
          : # Link is valid
        else
          red "Dead link detected in templates/common/docs/context.md: $url"
          ((link_errors++)) || true
        fi
      done
    fi

    if [ "$link_errors" -eq 0 ]; then
      green "Web URL validation: all external links resolve"
    else
      ((errors += link_errors)) || true
    fi
  else
    warn "curl not available - skipping web URL validation"
  fi
fi

# ── Project-level checks (skip at workspace root where docs/context.md is absent) ──

# 3. CHANGELOG.md must have [Unreleased] section (all projects + workspace root)
if [ -f "CHANGELOG.md" ]; then
  if grep -q "\[Unreleased\]" "CHANGELOG.md"; then
    green "CHANGELOG.md has [Unreleased] section"
  else
    red  "CHANGELOG.md is missing '[Unreleased]' section"
    ((errors++)) || true
  fi
fi

# 3.5. UTF-8 BOM check for Markdown files
bom_errors=0
FIND_CMD="find . -name \"*.md\" -not -path \"*/node_modules/*\" -not -path \"*/.git/*\" -print0"
if [ ! -f "docs/context.md" ] && [ -d "templates" ]; then
  # We are at workspace root, avoid scanning project folders
  FIND_CMD="find . -maxdepth 1 -name \"*.md\" -print0 2>/dev/null; find agents docs memory scripts skills templates .claude -name \"*.md\" -not -path \"*/node_modules/*\" -not -path \"*/.git/*\" -print0 2>/dev/null"
fi

while IFS= read -r -d '' file; do
  if head -c 3 "$file" | grep -q $'\xEF\xBB\xBF'; then
    red "UTF-8 BOM found in $file - files must be UTF-8 without BOM"
    ((bom_errors++)) || true
  fi
done < <(eval "$FIND_CMD" || true)
if [ "$bom_errors" -eq 0 ]; then
  green "UTF-8 BOM check: all markdown files are clean"
else
  ((errors += bom_errors)) || true
fi

# --- Agent checks (applicable to all projects AND workspace root) ---

# 4. AGENTS.md must exist
if [ -f "AGENTS.md" ]; then
    green "AGENTS.md exists"
else
    red "AGENTS.md missing (required for agent-first projects)"
    ((errors++)) || true
fi

# 5. At least one agent file must exist in agents/
if [ -n "$(ls -A agents/*.md 2>/dev/null)" ]; then
    green "agents/ has agent files"
else
    red "agents/ is empty or missing - create at least agents/pm.md"
    ((errors++)) || true
fi

# --- Project-level checks (skip at workspace root where docs/context.md is absent) ---

if [ -f "docs/context.md" ]; then
    # 6. docs/context.md must have ## Coding Guidelines
    if grep -q "^## Coding Guidelines" "docs/context.md"; then
        green "docs/context.md has ## Coding Guidelines"
    else
        red "docs/context.md is missing '## Coding Guidelines' section"
        ((errors++)) || true
    fi

  # 7. .env.sample must exist
  if [ -f ".env.sample" ]; then
    green ".env.sample exists"
  else
    warn ".env.sample not found - add one if this project uses environment variables"
  fi

  # 8. scripts/ .sh/.ps1 parity check
  for sh_file in scripts/*.sh; do
    [ -f "$sh_file" ] || continue
    ps1_file="${sh_file%.sh}.ps1"
    if [ -f "$ps1_file" ]; then
      green "script parity: $(basename "$sh_file") / $(basename "$ps1_file")"
    else
      warn "script parity gap: $sh_file has no matching .ps1"
    fi
  done

else
  warn "docs/context.md not found - skipping project-level checks (workspace root)"
fi

# --- Skills registry cross-check ---
# Verify every directory in skills/ and .claude/skills/ has a SKILL.md file
for skills_dir in "skills" ".claude/skills"; do
  if [ -d "$skills_dir" ]; then
    for skill_dir in "$skills_dir"/*/; do
      [ -d "$skill_dir" ] || continue
      skill_name=$(basename "$skill_dir")
      if [ -f "${skill_dir}SKILL.md" ]; then
        green "skill exists: $skills_dir/$skill_name/SKILL.md"
      else
        red "skill directory missing SKILL.md: $skill_dir"
        ((errors++)) || true
      fi
    done
  fi
done

# --- Lifecycle Audits ---
if command -v bun &>/dev/null; then
    if [ -f "scripts/agent-lifecycle-audit.ts" ]; then
        if bun scripts/agent-lifecycle-audit.ts --json 2>/dev/null | grep -q '"errors": \[\]'; then
            green "Agent audit: all agents healthy"
        else
            red "Agent audit detected issues (run 'bun scripts/agent-lifecycle-audit.ts' to see details)"
            ((errors++)) || true
        fi
    fi
    if [ -f "scripts/skill-lifecycle-audit.ts" ]; then
        if bun scripts/skill-lifecycle-audit.ts --json 2>/dev/null | grep -q '"errors": \[\]'; then
            green "Skill audit: all skills healthy"
        else
            red "Skill audit detected issues (run 'bun scripts/skill-lifecycle-audit.ts' to see details)"
            ((errors++)) || true
        fi
    fi
    if [ -f "scripts/verify-memory.ts" ] && [ -d "memory" ]; then
        if bun scripts/verify-memory.ts --verify 2>/dev/null; then
            green "Memory audit: all session logs valid"
        else
            warn "Memory audit: some entries use legacy format (run 'bun scripts/verify-memory.ts --report')"
        fi
    fi
    if [ -f "scripts/verify-scripts.ts" ]; then
        if bun scripts/verify-scripts.ts --verify 2>/dev/null; then
            green "Script registry audit: all scripts verified"
        else
            red "Script registry audit detected issues (run 'bun scripts/verify-scripts.ts --report' to see details)"
            ((errors++)) || true
        fi
    fi
    if [ -f "scripts/readme-lifecycle-audit.ts" ]; then
        if bun scripts/readme-lifecycle-audit.ts 2>/dev/null; then
            green "README audit: all READMEs healthy"
        else
            red "README audit detected issues (run 'bun scripts/readme-lifecycle-audit.ts' to see details)"
            ((errors++)) || true
        fi
    fi
else
    warn "Bun not installed - skipping lifecycle audits"
fi

# --- Agent/Skill State Synchronization Check ---
if [ -f "AGENTS.md" ] && [ -d "agents" ]; then
  sync_errors=0
  for agent_file in agents/*.md; do
    [ -f "$agent_file" ] || continue
    agent_name=$(basename "$agent_file" .md)

    # Extract status from agent file
    file_status=$(grep "^status:" "$agent_file" 2>/dev/null | cut -d: -f2 | xargs || echo "")

    if [ -n "$file_status" ]; then
      # Check AGENTS.md for matching status
      agents_md_status=$(grep -A2 "^|.*\`${agent_name}\.md\`" AGENTS.md 2>/dev/null | grep -oP 'status: \K\w+' || echo "")

      if [ -n "$agents_md_status" ] && [ "$file_status" != "$agents_md_status" ]; then
        red "Agent state mismatch: $agent_name (file=$file_status, AGENTS.md=$agents_md_status)"
        ((sync_errors++)) || true
      fi
    fi
  done

  if [ "$sync_errors" -eq 0 ]; then
    green "Agent state synchronization: all agents in sync"
  else
    ((errors += sync_errors)) || true
  fi
fi

# --- Cross-Platform Command Parity Check ---
# Ensures every .claude/commands/ file has a matching .gemini/commands/ file.
# Files with 'gemini-parity: skip' in their frontmatter are intentional exceptions.
if [ -d ".claude/commands" ]; then
  parity_warnings=0
  for claude_cmd in .claude/commands/*.md; do
    [ -f "$claude_cmd" ] || continue
    cmd_name=$(basename "$claude_cmd")
    # Check for explicit opt-out
    if grep -q "^gemini-parity: skip" "$claude_cmd" 2>/dev/null; then
      continue
    fi
    gemini_cmd=".gemini/commands/$cmd_name"
    if [ ! -f "$gemini_cmd" ]; then
      warn "Command parity gap: .claude/commands/$cmd_name has no matching .gemini/commands/$cmd_name (add 'gemini-parity: skip' to frontmatter for intentional Claude-only commands)"
      ((parity_warnings++)) || true
    fi
  done
  if [ "$parity_warnings" -eq 0 ]; then
    green "Command parity: all .claude/commands/ files have matching .gemini/commands/ files"
  fi
fi

echo ""
if [ "$errors" -eq 0 ]; then
  echo -e "\033[32m✅ All checks passed.\033[0m"
  exit 0
else
  echo -e "\033[31m❌ $errors check(s) failed. Fix before committing.\033[0m"
  exit 1
fi
