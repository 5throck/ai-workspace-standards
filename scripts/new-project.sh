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

if [ -d "$PROJECT_DIR" ]; then
  echo "❌ Directory already exists: $PROJECT_DIR"
  exit 1
fi

echo "🚀 Scaffolding new project: $PROJECT_NAME"

# Create directory structure
mkdir -p "$PROJECT_DIR"/{src,docs,scripts,memory,agents,skills,.claude/commands,.gemini/commands,.githooks}

# Initialize git
cd "$PROJECT_DIR"
git init
git config core.hooksPath .githooks

# ── docs/context.md ──────────────────────────────────────────────────────────
cat > docs/context.md << 'CONTEXT_EOF'
# [Project Name]

## Project Overview
[One-sentence description of what this project does and who it's for.]

## Tech Stack
- **Language**: [e.g., Python 3.11+ / TypeScript 5+]
- **Framework**: [e.g., FastAPI / Next.js / none]
- **Key Libraries**: [e.g., pydantic, httpx, react-query]
- **Package Manager**: [e.g., pip + uv / npm / pnpm]

## Architecture
```
src/
├── [folder]    # [description]
└── [folder]    # [description]
```

## Environment Setup
- Copy `.env.sample` → `.env` and fill in all required values.
- **Python**:
  - macOS/Linux: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
  - Windows:     `python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt`
- **Node.js**: `npm install`
- Required env keys (see `.env.sample`):
  - `[KEY_NAME]` — [description]

## Agents
<!-- See AGENTS.md at the project root for the full agent index (canonical source). -->
| Group | Agent file | Role |
|-------|------------|------|
| Orchestration | `agents/pm.md` | PM orchestrator — owns the workflow, dispatches parallel tasks |
| Design | `agents/architect.md` | Architect — produces implementation plans and ADRs |
| Execution | `agents/code-writer.md` | Code writer — implements approved plans |
| Execution | `agents/test-runner.md` | Test runner — verifies acceptance criteria and runs QA gate |

## Skills
| Skill path | Trigger condition |
|------------|-------------------|
| *(none yet)* | |

## Session Start Skills
- *(none yet)*

## Development Workflow
```bash
bash scripts/audit.sh
bash scripts/dev-sync.sh "feat: description"
```

## Key Files
| File | Purpose |
|------|---------|
| `docs/context.md` | This file — single source of truth for all AI tools |
| `AGENTS.md` | Canonical agent index |
| `agents/pm.md` | PM orchestrator agent |
| `scripts/dev-sync.sh` | Full sync pipeline |
| `scripts/audit.sh` | Documentation audit script |
| `memory/MEMORY.md` | Session log index |
| `CHANGELOG.md` | User-visible change history |
| `.env.sample` | Required environment variable template |

## Coding Guidelines

> These rules apply to every AI tool working in this project.
> Full rationale: [CONSTITUTION.md §8](../../CONSTITUTION.md#8-coding-behavior-guidelines)
> *(Path assumes project is at workspace root depth. Adjust if nested deeper.)*

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask — don't guess silently.
- If multiple interpretations exist, present them; don't pick one silently.
- **Secrets**: Never hardcode passwords, API tokens, or keys. Always use env vars / `.env.sample`.

### 2. Simplicity First
- Write the minimum code that solves the problem. Nothing speculative.
- No abstractions for single-use code. No unrequested "flexibility."

### 3. Surgical Changes
- Touch only what is necessary. Don't "improve" adjacent code.
- Match existing style even if you'd do it differently.

### 4. Goal-Driven Execution
- Convert every task into a verifiable goal before starting.
- For multi-step tasks, state a brief numbered plan with a verify step for each.

### 5. Response Language
- All **conversational** replies to the user → **Korean (한국어)** by default.
- All code, config, commit messages, PR titles, branch names → **English only**.
CONTEXT_EOF

# ── AGENTS.md ─────────────────────────────────────────────────────────────────
cat > AGENTS.md << 'AGENTS_EOF'
# AGENTS.md

> **Canonical agent index** — auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context → `docs/context.md`.

## Available Agents

| Group | Agent | File | Role |
|-------|-------|------|------|
| Orchestration | PM Orchestrator | `agents/pm.md` | Owns the full workflow; dispatches parallel tasks |
| Design | Architect | `agents/architect.md` | Produces implementation plans and ADRs; never writes code |
| Execution | Code Writer | `agents/code-writer.md` | Implements approved plans; surgical changes only |
| Execution | Test Runner | `agents/test-runner.md` | Runs tests and verifies acceptance criteria |

*(Add Analysis agents as needed: `agents/<name>-analyst.md`)*

## Agent Dispatch

- **Claude Code**: use the `Agent` tool — embed the target `agents/<name>.md` content in the prompt field.
- **Gemini CLI**: use `invoke_subagent` with the agent role definition from `agents/<name>.md`.

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Add a row to the table above.
2. Update the `## Agents` table in `docs/context.md` to match.
AGENTS_EOF

# ── Minimal agent stubs ───────────────────────────────────────────────────────
for agent in pm architect code-writer test-runner; do
  echo "---
name: $agent
model: inherit
color: yellow
description: >
  [$agent] — replace with role description. See CONSTITUTION.md §7 for full scaffold template.
---

## Role
[Replace with role content from CONSTITUTION.md §7 agents/$agent.md scaffold template.]
" > "agents/$agent.md"
done

# ── CHANGELOG.md ──────────────────────────────────────────────────────────────
cat > CHANGELOG.md << 'CL_EOF'
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
CL_EOF

# ── memory/MEMORY.md ──────────────────────────────────────────────────────────
cat > memory/MEMORY.md << 'MEM_EOF'
# Memory Index

| Date | Summary |
|------|---------|
MEM_EOF

# ── .env.sample ───────────────────────────────────────────────────────────────
cat > .env.sample << 'ENV_EOF'
# .env.sample — copy to .env and fill in values
# If this project has no environment variables, leave this file with only this comment.
ENV_EOF

# ── .gitignore ────────────────────────────────────────────────────────────────
cat > .gitignore << 'GI_EOF'
.env
.venv/
__pycache__/
*.pyc
node_modules/
.next/
dist/
build/
.DS_Store
Thumbs.db
GI_EOF

# ── CLAUDE.md (project-level) ─────────────────────────────────────────────────
cat > CLAUDE.md << 'CC_EOF'
# CLAUDE.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Claude Code behaviors → [`../../CLAUDE.md`](../../CLAUDE.md)

## Project-Specific Claude Code Settings

### Session Start
<!-- Skills are loaded from docs/context.md ## Session Start Skills. -->
<!-- Add entries here ONLY for Claude Code-exclusive skills not in context.md. -->

### MCP Servers
<!-- Document project-specific .mcp.json entries here, if any. -->

### Hooks Override
<!-- Default runs scripts/audit.sh on Write/Edit. Override here if needed. -->

### Model Selection Override
<!-- - Heavy reasoning  : claude-opus-4-7    -->
<!-- - Default          : claude-sonnet-4-6  -->
<!-- - Fast lookups     : claude-haiku-4-5-20251001 -->
CC_EOF

# ── .claude/settings.json ─────────────────────────────────────────────────────
cat > .claude/settings.json << 'CS_EOF'
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "bash scripts/audit.sh"
          }
        ]
      }
    ]
  }
}
CS_EOF

# ── GEMINI.md (project-level) ─────────────────────────────────────────────────
cat > GEMINI.md << 'GM_EOF'
# GEMINI.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Gemini behaviors → [`../../GEMINI.md`](../../GEMINI.md)

## Context Loading

```
@../../CONSTITUTION.md   # workspace design standard
@docs/context.md         # project knowledge (includes Session Start Skills)
@memory/MEMORY.md        # recent changes (skip if file does not exist)
```

## Project-Specific Gemini Settings

### Session Start
<!-- Skills are loaded from docs/context.md ## Session Start Skills. -->

### Model Selection Override
<!-- - Default      : gemini-2.5-pro   -->
<!-- - Fast lookups : gemini-2.5-flash -->
GM_EOF

# ── scripts stubs ─────────────────────────────────────────────────────────────
cp "$WORKSPACE_ROOT/scripts/audit.sh"  scripts/audit.sh
cp "$WORKSPACE_ROOT/scripts/audit.ps1" scripts/audit.ps1

cat > scripts/dev-sync.sh << 'DS_EOF'
#!/usr/bin/env bash
# dev-sync.sh — Full pipeline: audit → memlog → commit → PR
# Usage: bash scripts/dev-sync.sh "feat: description"
set -euo pipefail
MSG="${1:-chore: update}"
bash scripts/audit.sh
DATE=$(date +%Y-%m-%d)
echo "Session synced: $MSG" >> "memory/$DATE.md"
bash scripts/sync-md.sh "$DATE" "$MSG"
git add -A
git commit -m "$MSG

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
BRANCH="pr/$(date +%Y%m%d-%H%M%S)-$(echo "$MSG" | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | cut -c1-40)"
git checkout -b "$BRANCH"
git push -u origin "$BRANCH"
gh pr create --fill
DS_EOF
chmod +x scripts/dev-sync.sh

cat > scripts/sync-md.sh << 'SM_EOF'
#!/usr/bin/env bash
# sync-md.sh — Update memory/MEMORY.md index
# Usage: bash scripts/sync-md.sh "YYYY-MM-DD" "summary"
DATE="${1:-$(date +%Y-%m-%d)}"
SUMMARY="${2:-update}"
MEMORY_FILE="memory/MEMORY.md"
[ ! -f "$MEMORY_FILE" ] && echo -e "# Memory Index\n\n| Date | Summary |\n|------|---------|" > "$MEMORY_FILE"
echo "| [$DATE]($DATE.md) | $SUMMARY |" >> "$MEMORY_FILE"
SM_EOF
chmod +x scripts/sync-md.sh

# ── .githooks ─────────────────────────────────────────────────────────────────
cat > .githooks/pre-commit << 'PC_EOF'
#!/usr/bin/env bash
bash scripts/audit.sh || exit 1
PC_EOF
chmod +x .githooks/pre-commit

cat > .githooks/pre-push << 'PP_EOF'
#!/usr/bin/env bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
  echo "❌ Direct push to $BRANCH is blocked. Use a PR branch."
  exit 1
fi
PP_EOF
chmod +x .githooks/pre-push

echo ""
echo "✅ Project '$PROJECT_NAME' scaffolded at: $PROJECT_DIR"
echo ""
echo "Next steps:"
echo "  1. Fill in docs/context.md placeholders"
echo "  2. Replace agent stubs in agents/ with full templates from CONSTITUTION.md §7"
echo "  3. bash scripts/audit.sh   (verify scaffold passes)"
