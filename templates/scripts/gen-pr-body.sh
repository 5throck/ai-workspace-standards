#!/usr/bin/env bash
# gen-pr-body.sh — Generate a structured PR body from commit message + diff
# Usage: bash scripts/gen-pr-body.sh "commit message"
# Output: PR body markdown (stdout)
#
# Behaviour:
#   1. If `claude` CLI is available → ask Claude to write the PR body (AI mode)
#   2. Otherwise → build a structured template from commit message + file list (fallback)
#
# Cross-platform: Git Bash (Windows), macOS, Linux

set -euo pipefail

COMMIT_MSG="${1:-}"
if [ -z "$COMMIT_MSG" ]; then
  echo "Usage: bash scripts/gen-pr-body.sh \"<commit message>\"" >&2
  exit 1
fi

TODAY=$(date +%Y-%m-%d)

# ── Collect changed files ──────────────────────────────────────────────────────
FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)
[ -z "$FILES" ] && FILES=$(git diff --cached --name-only 2>/dev/null || true)
[ -z "$FILES" ] && FILES=$(git show --name-only --format="" HEAD 2>/dev/null || true)

FILE_LIST=$(echo "$FILES" | head -30 | sed 's/^/- /' || true)
DIFF_STAT=$(git diff --stat HEAD~1 HEAD 2>/dev/null || git diff --cached --stat 2>/dev/null || true)

# ── AI mode: generate body via Claude CLI ─────────────────────────────────────
if command -v claude &>/dev/null; then
  PROMPT="Generate a GitHub Pull Request body for the following change.
Output ONLY the PR body in markdown — no explanation, no code fences around the whole output.

Commit message : $COMMIT_MSG
Date           : $TODAY

Changed files  :
$FILES

Diff summary   :
$DIFF_STAT

Use EXACTLY this structure (keep all section headers, fill placeholders):

## Why
[1-3 sentences: what problem does this solve and why now?]

## What Changed
[concise bullet list of actual changes — be specific, not generic]

## Test Plan
- [ ] \`bash scripts/audit.sh\` passes
- [ ] [add relevant manual or automated test steps]

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No \`.env\` files staged (use \`.env.sample\` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
[Breaking changes, deployment steps, or reviewer guidance. Write 'None' if not applicable.]

---
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

  # Write prompt to temp file to avoid shell quoting issues
  TMPFILE=$(mktemp)
  printf '%s' "$PROMPT" > "$TMPFILE"
  BODY=$(claude -p "$(cat "$TMPFILE")" 2>/dev/null || true)
  rm -f "$TMPFILE"

  if [ -n "$BODY" ]; then
    echo "$BODY"
    exit 0
  fi
fi

# ── Fallback mode: structured template with auto-filled fields ─────────────────
cat <<EOF
## Why
$COMMIT_MSG

## What Changed
$FILE_LIST

## Test Plan
- [ ] \`bash scripts/audit.sh\` passes
- [ ] CHANGELOG.md updated under \`[Unreleased]\`

## Security Checklist
- [ ] No secrets, credentials, or API keys committed
- [ ] No \`.env\` files staged (use \`.env.sample\` for templates)
- [ ] Dependencies unchanged or reviewed for new CVEs

## Notes
None

---
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
