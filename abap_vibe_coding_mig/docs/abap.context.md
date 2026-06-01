# ABAP Development Context (abap.context.md)

> **Variant-specific customization for abap_vibe_coding**.
> 
> This file contains ABAP-specific **tech stack**, **environment setup**, **agent roles**, and **development workflow**.
> 
> **Workspace governance** (multi-agent architecture, PR workflow, coding guidelines) is defined in workspace root **CONSTITUTION.md** and referenced in `docs/context.md`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **MCP Server** | `vsp` Go binary v2.38.1 — connects to SAP via ADT (ABAP Development Tools REST API) |
| **AI Orchestration** | Claude Code CLI / Desktop App, Gemini CLI, Antigravity (VS Code extension) |
| **SAP Connection** | HTTP/HTTPS to SAP NetWeaver AS ABAP; configured via `.env` (`SAP_*` prefix) |
| **Scripting** | Bash (`.sh`) + PowerShell (`.ps1`) pairs for all automation |
| **Documentation** | Markdown — `docs/`, `agents/`, `skills/`, `memory/` |

---

## Environment Setup

```bash
# 1. Place the vsp binary in the project root
#    Download from: https://github.com/5throck/vsp/releases
cp /path/to/vsp ./vsp
chmod +x ./vsp          # macOS/Linux
# Windows: copy vsp.exe to project root

# 2. Configure SAP credentials
cp .env.sample .env
# Edit .env --fill in SAP_URL, SAP_USER, SAP_PASSWORD

# 3. Activate git hooks
git config core.hooksPath .githooks

# 4. Verify connection
./vsp health
```

**Required env keys** (see `.env.sample`):
- `SAP_URL` — SAP system base URL (e.g. `https://my-sap-host:44300`)
- `SAP_USER` — SAP username
- `SAP_PASSWORD` — SAP password
- `SAP_MODE` — MCP mode (default: `hyperfocused`)

---

## Development Workflow

```bash
# 1. Start a task
/triage <request>          # PM classifies --creates task file --parallel research

# 2. After implementation
/post-write                # SyntaxCheck --RunUnitTests --RunATCCheck
/transport                 # Create/release CTS transport

# 3. Sync to Git
/sync "feat: description"  # memlog --changelog --audit --commit --PR

# Manual equivalents (bash)
bash scripts/dev-sync.sh "feat: description"
```

> **Full 6-phase workflow**: See AGENTS.md — Collaborative Workflow section for complete PM orchestration.

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/context.md` | Immutable project identity and architecture |
| `docs/abap.context.md` | This file — ABAP-specific customization |
| `AGENTS.md` | Canonical agent index — auto-loaded by Claude Code |
| `CLAUDE.md` | Claude Code-specific configuration |
| `GEMINI.md` | Gemini CLI-specific configuration |
| `agents/pm.md` | PM orchestrator — 6-phase workflow owner |
| `agents/architect.md` | Technical Execution Lead |
| `agents/code-writer.md` | ABAP implementation agent |
| `agents/test-runner.md` | QA agent — SyntaxCheck/RunUnitTests/RunATCCheck |
| `scripts/dev-sync.sh/.ps1` | Full sync pipeline |
| `scripts/audit.sh/.ps1` | Documentation integrity audit |
| `memory/MEMORY.md` | Session log index |
| `CHANGELOG.md` | User-visible change history |
| `.env.sample` | Required environment variable template |

---

## Agents & Skills

> **Agent roles and orchestration rules**: See [`AGENTS.md`](../AGENTS.md) for the complete agent registry, behavioral rules, and workflow coordination.

### Agent Groups

**Business Group** (PM + Module Analysts):
- PM (Orchestrator)
- SD Analyst (Sales & Distribution)
- MM Analyst (Materials Management)
- FI Analyst (Financial Accounting)
- CO Analyst (Controlling)
- PP Analyst (Production Planning)
- LE Analyst (Logistics Execution)

**Technical Group** (Architect + Execution):
- Architect (Technical Execution Lead)
- ABAP Developer (Code Writer)
- QA Engineer (Test Runner)
- DBA (Database Agent)
- DevOps/Admin (Transport management)
- Interface Expert (OData/RFC/IDoc)
- Fiori Developer (UI5/Fiori screens)
- Form Expert (SAP Script/Smart Forms/Adobe Forms)
- GUI Scripter (BDC/VBS automation — last resort)
- Security Monitor (Security policies, safe dependencies)

> **Full agent definitions**: See `agents/*.md` files for detailed roles, tools, and behavioral rules.

### Skills

**Auto-discovered** from `skills/` directory:
- `abap-dev/SKILL.md` — SAP development workflows and BAPI exploration
- `post-write-chain/SKILL.md` — Mandatory QA chain (SyntaxCheck → RunUnitTests → RunATCCheck)
- `sap-*` skills — Domain-specific SAP capabilities

---

## ABAP Development

### System Defaults
- **System**: NPL, Client: 001
- **Host**: vhcalnplci:50000
- **ABAP Version**: 7.52 (Verified via `vsp system info`)
- **Package**: `$TMP` (no transport required)

### ABAP Development Rules

**Naming Conventions**:
- **Classes**: `ZCL_` prefix
- **Interfaces**: `ZIF_` prefix
- **Programs**: `ZPROG_` prefix
- **Packages**: `Z*`, `$TMP`, `$ZADT*`

**Isolation**:
- All local `.abap` files must be created ONLY in the `scratch/` directory
- Use `EditSource` for small changes; always run `SyntaxCheck` before `WriteSource`

**QA Chain**:
- After any logic change or edit, the `Post-Write Mandatory Chain` MUST be executed:
  - `SyntaxCheck` → `RunUnitTests` → `RunATCCheck`
  - Priority 1 findings block deployment
  - See [`skills/post-write-chain/SKILL.md`](../skills/post-write-chain/SKILL.md) for details

> **Note**: If your environment (e.g., Gemini CLI, Claude Desktop App) does not support automatic PostToolUse hooks, you MUST execute this chain manually.

### ABAP SQL Reference (All Agents)

> All agents that run `RunQuery` MUST follow these rules.

```sql
-- Correct ordering
ORDER BY field DESCENDING        -- NOT: ORDER BY field DESC

-- Row limiting (use max_rows parameter, not SQL LIMIT)
RunQuery(sql=..., max_rows=50)   -- NOT: LIMIT 50 in SQL string

-- Date format
WHERE erdat >= '20260501'        -- YYYYMMDD string, no separators

-- Table aliasing in JOINs
FROM vbak AS a JOIN vbap AS b ON a~vbeln = b~vbeln

-- Field references with tilde
b~matnr    -- NOT: b.matnr

-- Anti-patterns to avoid
SELECT *                         -- always list explicit fields
MANDT = '001'                    -- never hardcode client
```

### Developer Quick Start (Task Lifecycle)

For full project governance and role-based orchestration, refer to [AGENTS.md — Collaborative Workflow](../AGENTS.md#agent-coordination-workflow-harness-advanced).

```powershell
# 1. Initialize Task
.\scripts\vsp-task.ps1 -Name "Task Description"

# 2. Execution (Research -> Implementation -> Verification)
# Use specialized skills from skills/abap-dev/SKILL.md

# 3. Synchronize & Commit
.\scripts\vsp-sync.ps1 -Message "feat: implementation summary"
```

---

## Project-Wide Rules (All Tools)

> These rules apply equally to Claude Code, Gemini CLI, Codex, Antigravity, and any other AI tool operating in this project.
> 
> Tool-specific overrides live in `CLAUDE.md`, `GEMINI.md`, and `.codex/`.

### MCP Configuration

MCP servers are configured in `.mcp.json` (Single Source of Truth).
Use `.\scripts\sync-mcp.ps1` or `bash scripts/sync-mcp.sh` to synchronize changes to tool-specific settings.

See `.mcp.json` for the complete server list.

> **Note**: This project uses the standard `SAP_*` prefix format for connection and feature flags (e.g. `SAP_MODE`, `SAP_ALLOWED_PACKAGES`), ensuring 100% compatibility with the upstream `vsp` engine.

### Memory Logging

Whenever an ABAP program, class, interface, or other object is **created or significantly changed**, append an entry to `memory/YYYY-MM-DD.md`.

**Required fields per entry**:
- **Object name, type, package, and ADT URL**
- **Purpose summary** (what it does, what it queries, how it outputs)
- **Key technical decisions** (design choices, reasons, alternatives considered)
- **Issue history** (symptom → root cause → resolution)
- **MCP / config changes** (`.mcp.json`, `.gemini/settings.json`, etc.)

**When to read**: Only when a recurring error occurs or when uncertain about a past design decision. Do **not** read memory files on every session start. All entries must be written in **English**.

**Scope boundary** — `memory/` and `CHANGELOG.md` serve different purposes:

| Change type | Record in |
|-------------|-----------|
| ABAP object created or significantly modified | `memory/YYYY-MM-DD.md` |
| Harness infrastructure changed (agents, skills, scripts, docs, config) | `CHANGELOG.md` — `[Unreleased]` section |

### Documentation Language

All `.md` files must be written in **English**. **Exception**: files whose name contains `_ko` (e.g., `README_ko.md`) must be written entirely in Korean.

**Git artifacts** (commit messages, PR titles, PR body, branch names, code review comments) must also be written in **English** at all times, regardless of the language used in conversation with the user.

### Documentation Synchronization

`docs/context.md` is the **immutable project identity** (Single Source of Truth).

| Change type | Action |
|-------------|--------|
| Immutable identity (architecture, overview) | Update `docs/context.md` only |
| ABAP-specific content (tech stack, agents, workflow) | Update `docs/abap.context.md` only |
| Tool-specific config or skill | Update `CLAUDE.md`, `GEMINI.md`, or `.codex/` only |
| Agent roles or workflow | Update `AGENTS.md`; reflect summary in `docs/abap.context.md` |

Do **not** copy immutable sections from `docs/context.md` into tool-specific files.

### Git Commit Policy & Reflection

All development artifacts (ABAP sources, docs, research reports) and memory logs must be committed to the local Git repository. The PM agent verifies repository status and memory file existence at the end of each major task.

**Manual Commit Rule**: Because auto-commits and hooks are disabled or unsupported in many AI CLI sessions (like Gemini or Claude Desktop), you must run `git add -A && git commit` manually or use the project synchronization script (`.\scripts\dev-sync.ps1`) at the end of each task.

---

## Coding Guidelines

> **Workspace standards**: See CONSTITUTION.md §8 for complete coding behavior guidelines.
> 
> These ABAP-specific rules supplement the workspace standards.

### Core Rules (from CONSTITUTION.md §8)

1. **Think Before Coding** — State assumptions explicitly; if uncertain, ask
2. **Simplicity First** — Minimum code that solves the problem
3. **Surgical Changes** — Touch only what is necessary
4. **No Hardcoded Secrets** — Always use env vars / `.env.sample`
5. **PR Required** — All changes via `/sync`; never direct push to main

### ABAP-Specific Rules

**File Encoding**:
- All text files (`.md`, `.ps1`, `.sh`, `.py`, `.js`, etc.) must be **UTF-8 (without BOM)**
- Script outputs (Add-Content, Set-Content) must explicitly specify `-Encoding UTF8`

**Hybrid Scripting**:
- **Complex orchestration** — Bun TypeScript (`.ts`)
- **Everyday utilities** — Cross-platform shell (`.sh` + `.ps1` pair, always kept in sync)

---

## Deployed vsp Binary

| Item | Value |
|------|-------|
| Binary | `vsp.exe` (project root) |
| Version | `2.38.1` (commit: a75fbfd9, built: 2026-04-07) |
| Last Modified | 2026-05-01 |
| Mode | `hyperfocused` (see `.mcp.json`) |

> To upgrade: replace `vsp.exe` with the new binary and update this table.

---

*Last Updated: 2026-06-01 - extracted from monolithic context.md*
*See ADR 0020 for migration decision and rationale*
