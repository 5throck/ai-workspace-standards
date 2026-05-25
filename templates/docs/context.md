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
├── src/                  # [main source - e.g., app logic, API handlers]
│   ├── [folder]          # [description]
│   └── [folder]          # [description]
├── docs/                 # project context, ADRs
├── agents/               # AI agent definitions
├── scripts/              # audit, dev-sync, sync-md
│   └── temp/             # scratch scripts (git-ignored)
├── memory/               # session logs
└── [any other top-level dirs]
```

## Environment Setup
- Copy `.env.sample` -`.env` and fill in all required values.
- **Python**:
  - macOS/Linux: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
  - Windows:     `python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt`
- **Node.js**: `npm install`
- Required env keys (see `.env.sample`):
  - `[KEY_NAME]` -[description] *(replace with actual keys, or write "N/A -no env vars required")*

## Agents
<!-- See AGENTS.md at the project root for the full agent index (canonical source). -->
<!-- Duplicate the table here only as a quick-reference summary for non-CC tools.   -->
<!-- NOTE: This list may be dynamically expanded by the PM during the Kickoff Phase.-->
| Group | Agent file | Role |
|-------|------------|------|
| Orchestration | `agents/pm.md` | PM orchestrator -owns the workflow, dispatches parallel tasks |
| Orchestration | `agents/security-monitor.md` | Security monitor -enforces policies, prevents secrets leaks |
| Design | `agents/architect.md` | Architect -produces implementation plans and ADRs |
| Design | `agents/designer.md` | Designer -produces UI/UX specs, wireframes, and component definitions |
| Execution | `agents/code-writer.md` | Code writer -implements approved plans |
| Execution | `agents/test-runner.md` | Test runner -verifies acceptance criteria and runs QA gate |

## Skills
| Skill path | Trigger condition |
|------------|-------------------|
| *(none yet -add entries as skills are created in `skills/`)* | |

## Session Start Skills
<!-- Skills listed here are loaded at the start of EVERY session by ALL AI tools. -->
<!-- NOTE: This list may be dynamically expanded by the PM during the Kickoff Phase.-->
<!-- Format: `skills/<name>/SKILL.md` -reason / trigger                          -->
<!-- Example: `skills/auth-flow/SKILL.md` -always load when auth-related tasks   -->
<!-- Add a skill: create skills/<name>/SKILL.md, then add a line below.           -->
<!-- See https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/templates/_examples/skills/example-skill/SKILL.md for the template.-->
- *(none yet)*

## Multi-Agent Workflow

This project uses a **PM-first multi-agent architecture**. All development work flows through the PM orchestrator, which coordinates specialist agents to deliver high-quality, reviewed solutions.

### Single Entry Point

**The PM agent (`agents/pm.md`) is the ONLY interface for ALL requests.**

```
┌──────────────┐
│  Your Task   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ PM Agent     │ → Classify, dispatch, synthesize, execute
│ (Orchestrator)│
└──────┬───────┘
       │
       ├─▶[Read-only tasks] → Parallel agents (analyst, researcher)
       ├─▶[Design tasks]    → Architect + Designer (parallel)
       ├─▶[Code tasks]      → Code-writer → Test-runner → QA gate
       └─▶[Unknown stack]   → Stack-setup agent
```

### Agent & Skill Lifecycle Management

The PM agent also manages the lifecycle of both agents and skills in the project:

| Lifecycle State | Agents | Skills |
|-----------------|--------|--------|
| **Creation** | PM creates new agent files via `/new-agent` | PM or skill-creator creates new skills |
| **Active** | Agent in production use | Skill in production use |
| **Deprecated** | Marked with `status: deprecated` in frontmatter | Marked with `status: deprecated` in frontmatter |
| **Archived** | Moved to `agents/_archive/` after 30 days | Moved to `skills/_archive/` after 30 days |

When agent configurations change:
1. **New agent added** → PM creates or reassigns skills
2. **Agent role changed** → PM updates associated skill descriptions
3. **Agent removed** → PM reassigns or deprecates owned skills
4. **Agents consolidated** → PM merges skill inventories

#### Skill Frontmatter Template

All skills should include lifecycle metadata:

```yaml
---
name: skill-name
description: This skill should be used when...
version: 1.0.0

# Lifecycle metadata
status: active           # draft | active | deprecated | archived
owner: agent-name        # Primary owning agent (must exist in agents/)
requires: []             # Skills this depends on
supersedes: old-skill    # This replaces old-skill (optional)
superseded_by: []        # If another skill replaces this (optional)
---
```

#### Running Lifecycle Audit

**Skill Audit:**
```bash
bun scripts/skill-lifecycle-audit.ts
```

**Agent Audit:**
```bash
bun scripts/agent-lifecycle-audit.ts
```

The audit checks for:
- ✅ Skills without owners
- ✅ Orphaned skills (owner agent doesn't exist)
- ✅ Deprecated skills still being modified
- ✅ Missing dependencies (requires field)
- ✅ Circular dependencies
- ✅ Agents missing frontmatter (name, role, status)
- ✅ Agents not registered in AGENTS.md

> **Note**: Lifecycle audits run automatically via pre-commit hook when agent or skill files are staged for commit.
```

### Why PM-First?

| Benefit | Description |
|---------|-------------|
| **Consistency** | All work follows the same 6-phase workflow |
| **Quality** | No code without design review, no merge without QA |
| **Traceability** | All decisions logged to `memory/` with rationale |
| **Scalability** | Team expands by adding agents, not changing workflow |
| **Safety** | Security monitor checks all changes before commit |

### Starting Your First Task

After project scaffolding completes:

1. **Navigate to project:** `cd <project-name>`
2. **Context is auto-loaded** by your AI tool:
   - `docs/context.md` (this file)
   - `AGENTS.md` (agent roster)
   - `agents/pm.md` (PM role definition)
3. **Submit your request to PM:**
   - "PM, I need to [describe task]"
   - PM will triage, dispatch agents, and coordinate the entire workflow

### Workflow Phases

| Phase | Name | What Happens |
|-------|------|--------------|
| 0 | Team Assembly | PM assesses project needs; creates specialized agents/skills if required |
| 1 | Triage | PM classifies request; dispatches read-only agents in parallel |
| 2 | Analysis | PM synthesizes findings into requirements + acceptance criteria |
| 3 | Design | Architect produces implementation plan; Designer produces UI/UX spec (parallel) |
| 4 | Implementation | Code-writer implements; Test-runner verifies; Loop up to 3횞 on failures |
| 5 | Finalization | PM logs decisions; runs `/sync`; opens PR |

> **Full details:** See [`AGENTS.md`](AGENTS.md) for complete workflow, agent roster, and dispatch protocols.

---

## Development Workflow
```bash
# Audit (enforced via pre-commit hook and dev-sync pipeline; run manually any time)
bash scripts/audit.sh            # Windows: .\scripts\audit.ps1

# Log a session entry (without syncing)
# Claude Code:  /memlog "summary"
# Bash:         echo "## Session ??summary" >> memory/$(date +%Y-%m-%d).md

# Add a changelog entry (optional, before sync)
# Claude Code:  /changelog "added|changed|fixed|removed <description>"
# Gemini CLI:   append to CHANGELOG.md under [Unreleased]

# Full sync: memlog ??sync-md ??changelog ??audit ??commit ??PR
bash scripts/dev-sync.sh "feat: description"   # Windows: .\scripts\dev-sync.ps1 "feat: ..."
# Claude Code:  /sync "feat: description"
```

### Auto-Updating & Context Maintenance
- **Trigger**: Agents MUST automatically append a summary to the `memory/MEMORY.md` or update architecture sections in `docs/context.md` whenever a significant architectural decision or multi-file feature is completed.
- **Archiving**: If `docs/context.md` or logs become too unwieldy, older decisions should be archived to `docs/history.md`.

### Tracking Management: CHANGELOG vs. Memory
- **`CHANGELOG.md`**: For end-users and release notes. Record *what* changed (features, fixes) using structured categories. **(Must be written in English)**
- **`memory/` logs**: For developers and AI agents. Record *how* and *why* changes were made, including architectural decisions and debugging context. **(Must be written in English)**

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
  ??
  1. memory/YYYY-MM-DD.md append (memlog)
  2. memory/MEMORY.md index update (sync-md)
  3. CHANGELOG.md [Unreleased] auto-add
  4. audit.sh                    ??must exit 0
  5. git checkout -b pr/<date>-<slug>
  6. git commit + push
  7. gh pr create ??GitHub PR
```

> Run `/changelog "description"` before `/sync` to pre-populate the changelog entry.
> **Rule: All changes reach `main` via PR only -never direct push.**

---

## Key Files
| File | Purpose |
|------|---------|
| `docs/context.md` | This file -single source of truth for all AI tools |
| `AGENTS.md` | Canonical agent index -auto-loaded by Claude Code |
| `agents/pm.md` | PM orchestrator -workflow owner |
| `agents/security-monitor.md` | Security agent -enforces policies and scans for secrets |
| `agents/architect.md` | Design agent -implementation plans and ADRs |
| `agents/designer.md` | Design agent -UI/UX specs and component definitions |
| `agents/code-writer.md` | Implementation agent -writes code from approved plans |
| `agents/test-runner.md` | QA agent -runs tests and verifies acceptance criteria |
| `scripts/dev-sync.sh` | Full sync pipeline (memlog -sync-md -changelog -audit -commit -PR) |
| `scripts/audit.sh` | Documentation audit script |
| `scripts/agent-verify.ts` | Verifies agent/documentation synchronization |
| `scripts/sync-md.sh` | Updates `memory/MEMORY.md` index with today's session entry |
| `scripts/skill-lifecycle-audit.ts` | Agent & Skill lifecycle audit (Bun) - validates owners, dependencies, deprecated skills |

> **Platform Note:** Lifecycle management scripts use Bun (`.ts`) for cross-platform compatibility.
> Run with: `bun scripts/skill-lifecycle-audit.ts`
| `memory/MEMORY.md` | Session log index |
| `CHANGELOG.md` | User-visible change history |
| `.env.sample` | Required environment variable template |

## Coding Guidelines

> These rules apply to every AI tool working in this project.
> Full rationale: [CONSTITUTION.md §8](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#8-coding-behavior-guidelines)

### 1. Think Before Coding
- State assumptions explicitly before implementing. If uncertain, ask -don't guess silently.
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
  - "Add validation" -"Write tests for invalid inputs, then make them pass"
  - "Fix the bug" -"Write a reproducer test, then fix it"
- For multi-step tasks, state a brief numbered plan with a verify step for each.

### 5. Open-Source Package Policy
- **Prefer** packages with OSI-approved licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, PSF-2.0.
- **Avoid** GPL-3.0, AGPL-3.0, SSPL, BSL, or proprietary licenses unless explicitly justified.
- Run `bash scripts/setup.sh --skip-commit` after adding dependencies to trigger the license audit.
- Document any intentional non-OSS dependency in this file under a `## Non-OSS Dependencies` section.
- Full policy: [CONSTITUTION.md §8.5](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#5-open-source-package-policy)

### 6. Response Language
- All **conversational** replies to the user -**Korean (한국어)** by default.
- All code, config, commit messages, PR titles, **PR bodies**, branch names, **CHANGELOG.md**, and **memory/ logs** -**English only**.

### 7. PR Language Rule
All PR titles, bodies, and review comments must be written in English -governed by [CONSTITUTION.md §3 -Mandatory English Git & PR Artifacts](https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md#3-github-pr-workflow).


### 8. File Encoding Rule (Markdown & Scripts)
- All text files, including Markdown (.md) and scripts (.ps1, .sh, .py, .js, etc.), must be saved as **UTF-8 (without BOM)**.
- Script outputs (Add-Content, Set-Content) must explicitly specify -Encoding UTF8.
### 9. Plan Mode
- Enter plan mode when the user requests a new feature or significant refactor, or if the change touches more than 2 files.
- If the correct approach is unclear, stop and present a plan before modifying code.

### 10. Task Tracking
- Call task creation tools before starting any multi-step work.
- Keep statuses updated (in_progress, completed) and never leave tasks in_progress at the end of a session.

### 11. Subagent Pattern
- Each implementation task follows the Phase 4 execution loop:
  1. **code-writer** implements the changes
  2. **test-runner** verifies against acceptance criteria and runs tests
  3. **Quality gate (audit script)** validates compliance
- Fix and re-review if issues found - maximum **3 iterations** before escalating to the user.

### 12. Hybrid Scripting & Cross-Platform Rule
- **Hybrid Approach**: The project uses a hybrid scripting model. Complex multi-agent orchestration (e.g., `dispatch.ts`, `verify-skills.ts`) is implemented in **Bun (.ts)**. Everyday development utilities (e.g., `dev-sync`, `audit`) use native shell scripts.
- **Utility Script Pairing**: All utility shell scripts must be cross-platform compatible. Any creation, modification, or deletion of a PowerShell utility script (`.ps1`) MUST be accompanied by the exact same operation on its corresponding Bash script counterpart (`.sh`), and vice versa. They must always be kept in sync as a pair (e.g., `dev-sync.ps1` and `dev-sync.sh`).

### 13. Bilingual Documentation Rule (Template Maintenance)
- **README Pairing Requirement**: For any `README.md` file created in the `templates/` directory, a corresponding Korean version `README_ko.md` MUST also be created and maintained.
- **Synchronization**: When a `README.md` is modified, the corresponding `README_ko.md` MUST be updated to reflect the same changes. The Korean version should be a faithful translation, maintaining the same structure and content coverage.
- **Directory Structure**: Both files MUST reside in the same directory:
  ```
  templates/<directory>/
  ├── README.md      # English version
  └── README_ko.md   # Korean version (translation of README.md)
  ```
- **Verification**: The `audit.sh` / `audit.ps1` script will check for orphaned `README.md` files without corresponding `README_ko.md` in the `templates/` directory and report them as documentation violations.

---

## Agent Lifecycle Management

This project uses a **file-based agent system** where agents are defined as markdown files in `agents/`. The PM orchestrator is responsible for managing the agent lifecycle.

### Agent Lifecycle Phases

| Phase | Action | Command | Documentation Update |
|-------|--------|---------|---------------------|
| **Create** | Add new agent | `bun run agent:create <name> --role "Display" --group <group>` | Update `AGENTS.md` + `docs/context.md § Agents` |
| **List** | View all agents | `bun run agent:list [--group <group>] [--verbose]` | N/A (read-only) |
| **Update** | Modify agent | Edit `agents/<name>.md` directly | Update `AGENTS.md` if role/triggers change |
| **Delete** | Remove agent | `bun run agent:delete <name> --force` | Update `AGENTS.md` + `docs/context.md § Agents` |

### Agent Management Commands

```bash
# Create a new agent
bun run agent:create <name> --role "Display Name" --group <group> --description "Purpose"

# List all agents
bun run agent:list
bun run agent:list --group Technical
bun run agent:list --verbose

# Delete an agent
bun run agent:delete <name>
bun run agent:delete <name> --force
```

### Documentation Synchronization Rule

**CRITICAL**: After any agent creation, modification, or deletion, the PM MUST update:

1. **AGENTS.md** - Canonical agent index:
   - Add/remove row from Agent Roster table
   - Add/remove row from Subagent Roster table (with Parallelizable/Write columns)
   - Update Skills table if agent uses skills

2. **docs/context.md § Agents** - Quick reference summary:
   - Add/remove row from the Agents table
   - Keep in sync with AGENTS.md

3. **docs/context.md § Session Start Skills** - If applicable:
   - Add skill auto-load entry if agent requires specific skills

### Verification

Run `bun run agent:list --verbose` to verify:
- All agents in `agents/` have corresponding entries in `AGENTS.md`
- All agents in `AGENTS.md` have corresponding files in `agents/`
- Agent metadata (role, group, triggers) is consistent

### PM Responsibility

During **Phase 0 (Team Assembly)**, the PM:
1. Assesses project requirements
2. Creates specialized agents if needed using `agent:create.ts`
3. Updates `AGENTS.md` and `docs/context.md` with new agent entries
4. Documents agent handoff rules and dispatch triggers

> **Reference**: See `AGENTS.md` for complete agent roster, dispatch protocols, and maintenance rules.

---
