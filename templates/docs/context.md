# [Project Name]

## Project Overview
[One-sentence description of what this project does and who it's for.]

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | [e.g., Python 3.11+ / TypeScript 5+] |
| **Framework** | [e.g., FastAPI / Next.js / none] |
| **Database** | [e.g., PostgreSQL + SQLAlchemy / SQLite / none] |
| **Key Libraries** | [e.g., pydantic, httpx, react-query] |
| **Package Manager** | [e.g., pip + uv / npm / pnpm] |
| **Testing** | [e.g., pytest / Vitest / Jest] |

## Architecture
```
[project root]/
├── src/                  # [main source — e.g., app logic, API handlers]
│   ├── [folder]          # [description]
│   └── [folder]          # [description]
├── docs/                 # project context, ADRs
├── agents/               # AI agent definitions
├── scripts/              # audit, dev-sync, sync-md
├── memory/               # session logs
└── [any other top-level dirs]
```

## Environment Setup
- Copy `.env.sample` → `.env` and fill in all required values.
- **Python**:
  - macOS/Linux: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
  - Windows:     `python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt`
- **Node.js**: `npm install`
- Required env keys (see `.env.sample`):
  - `[KEY_NAME]` — [description] *(replace with actual keys, or write "N/A — no env vars required")*

## Agents
<!-- See AGENTS.md at the project root for the full agent index (canonical source). -->
<!-- Duplicate the table here only as a quick-reference summary for non-CC tools.   -->
| Group | Agent file | Role |
|-------|------------|------|
| Orchestration | `agents/pm.md` | PM orchestrator — owns the workflow, dispatches parallel tasks |
| Design | `agents/architect.md` | Architect — produces implementation plans and ADRs |
| Design | `agents/designer.md` | Designer — produces UI/UX specs, wireframes, and component definitions |
| Execution | `agents/code-writer.md` | Code writer — implements approved plans |
| Execution | `agents/test-runner.md` | Test runner — verifies acceptance criteria and runs QA gate |

## Skills
| Skill path | Trigger condition |
|------------|-------------------|
| *(none yet — add entries as skills are created in `skills/`)* | |

## Session Start Skills
<!-- Skills listed here are loaded at the start of EVERY session by ALL AI tools. -->
<!-- Format: `skills/<name>/SKILL.md` — reason / trigger                          -->
<!-- Example: `skills/auth-flow/SKILL.md` — always load when auth-related tasks   -->
<!-- Add a skill: create skills/<name>/SKILL.md, then add a line below.           -->
<!-- See ../../templates/_examples/skills/example-skill/SKILL.md for the template.-->
- *(none yet)*

## Development Workflow
```bash
# Audit (enforced via pre-commit hook and dev-sync pipeline; run manually any time)
bash scripts/audit.sh            # Windows: .\scripts\audit.ps1

# Log a session entry (without syncing)
# Claude Code:  /memlog "summary"
# Bash:         echo "## Session — summary" >> memory/$(date +%Y-%m-%d).md

# Add a changelog entry (optional, before sync)
# Claude Code:  /changelog "added|changed|fixed|removed <description>"
# Gemini CLI:   append to CHANGELOG.md under [Unreleased]

# Full sync: memlog → sync-md → changelog → audit → commit → PR
bash scripts/dev-sync.sh "feat: description"   # Windows: .\scripts\dev-sync.ps1 "feat: ..."
# Claude Code:  /sync "feat: description"
```

### Auto-Updating & Context Maintenance
- **Trigger**: Agents MUST automatically append a summary to the `memory/MEMORY.md` or update architecture sections in `docs/context.md` whenever a significant architectural decision or multi-file feature is completed.
- **Archiving**: If `docs/context.md` or logs become too unwieldy, older decisions should be archived to `docs/history.md`.

### Claude Code Slash Commands
Each `.claude/commands/<name>.md` file is auto-registered as a Skill in Claude Code:
| Command | Skill name | Purpose |
|---------|-----------|---------|
| `/changelog "..."` | `changelog` | Add CHANGELOG.md entry |
| `/sync "..."` | `sync` | Full sync pipeline |
| `/memlog "..."` | `memlog` | Log session entry only |
| `/new-task "..."` | `new-task` | Create task block in memory log |

## Git / PR Workflow

```
/sync "feat: description"
  ↓
  1. memory/YYYY-MM-DD.md append (memlog)
  2. memory/MEMORY.md index update (sync-md)
  3. CHANGELOG.md [Unreleased] auto-add
  4. audit.sh                    ← must exit 0
  5. git checkout -b pr/<date>-<slug>
  6. git commit + push
  7. gh pr create → GitHub PR
```

> Run `/changelog "description"` before `/sync` to pre-populate the changelog entry.
> **Rule: All changes reach `main` via PR only — never direct push.**

---

## Key Files
| File | Purpose |
|------|---------|
| `docs/context.md` | This file — single source of truth for all AI tools |
| `AGENTS.md` | Canonical agent index — auto-loaded by Claude Code |
| `agents/pm.md` | PM orchestrator — workflow owner |
| `agents/architect.md` | Design agent — implementation plans and ADRs |
| `agents/designer.md` | Design agent — UI/UX specs and component definitions |
| `agents/code-writer.md` | Implementation agent — writes code from approved plans |
| `agents/test-runner.md` | QA agent — runs tests and verifies acceptance criteria |
| `scripts/dev-sync.sh` | Full sync pipeline (memlog → sync-md → changelog → audit → commit → PR) |
| `scripts/audit.sh` | Documentation audit script |
| `scripts/sync-md.sh` | Updates `memory/MEMORY.md` index with today's session entry |
| `memory/MEMORY.md` | Session log index |
| `CHANGELOG.md` | User-visible change history |
| `.env.sample` | Required environment variable template |

## Coding Guidelines

> These rules apply to every AI tool working in this project.
> Full rationale: [CONSTITUTION.md §8](../../CONSTITUTION.md#8-coding-behavior-guidelines)
> *(This file lives in `docs/` — `../` = project root, `../../` = workspace root where `CONSTITUTION.md` lives.)*

### 1. Think Before Coding
- State assumptions explicitly before implementing. If uncertain, ask — don't guess silently.
- If multiple interpretations exist, present them; don't pick one silently.
- If something is unclear, stop and name what's confusing.
- **Secrets**: Never hardcode passwords, API tokens, or keys. Always use env vars / `.env.sample`.

### 2. Simplicity First
- Write the minimum code that solves the problem. Nothing speculative.
- No abstractions for single-use code. No unrequested "flexibility."
- If a 200-line solution could be 50 lines, rewrite it.

### 3. Surgical Changes
- Touch only what is necessary. Don't "improve" adjacent code.
- Match existing style even if you'd do it differently.
- Remove only the dead code that **your** changes created.

### 4. Goal-Driven Execution
- Convert every task into a verifiable goal before starting:
  - "Add validation" → "Write tests for invalid inputs, then make them pass"
  - "Fix the bug" → "Write a reproducer test, then fix it"
- For multi-step tasks, state a brief numbered plan with a verify step for each.

### 5. Response Language
- All **conversational** replies to the user → **Korean (한국어)** by default.
- All code, config, commit messages, PR titles, branch names → **English only**.
