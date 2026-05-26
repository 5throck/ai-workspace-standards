> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §1 Standard Folder Structure
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 1. Standard Folder Structure {#standard-folder-structure}

#### 1.1 Project Layout

Every project follows this layout. Omit folders that don't apply to the project type.

```
<project-root>/
├── src/          # Source code
├── docs/         # Design docs, architecture, ADRs
│   ├── context.md    # Project knowledge - shared by all AI tools (required)
│   └── adr/          # Architecture Decision Records (ADRs)
│       └── NNNN-slug.md  # e.g., 0001-use-mcp-server.md
├── scripts/      # Automation scripts (.sh + .ps1 pairs, cross-platform)
│   └── temp/     # Temporary scratch scripts (git-ignored)
├── locales/      # i18n translation files (UI projects only)
├── memory/       # session logs (shared by all AI tools)
│   ├── MEMORY.md     # Index of all log entries
│   └── YYYY-MM-DD.md # Daily development log
├── agents/       # Role-based agent definitions
│   └── pm.md         # PM orchestrator (always required)
├── skills/       # Reusable workflow skills
│   └── <name>/
│       └── SKILL.md
├── .github/              # GitHub-specific files
│   ├── workflows/        # GitHub Actions CI/CD pipelines
│   ├── CODEOWNERS        # Automatic PR reviewer assignment
│   └── pull_request_template.md  # Default PR body template
├── .gemini/              # Gemini CLI configuration
│   ├── settings.json
│   └── settings.local.json
├── .claude/              # Claude Code configuration
│   ├── commands/
│   ├── settings.json
│   └── settings.local.json
├── AGENTS.md             # Agent index (shared by all AI tools; canonical source)
├── CHANGELOG.md          # User-visible change history (required by audit.sh)
├── CLAUDE.md             # Claude Code config
├── GEMINI.md             # Gemini CLI config
├── SECURITY.md           # Security vulnerability reporting policy
└── .env.sample           # Required env variable template (never commit .env)
```

> **Note**: `.gemini/` and `.claude/` both exist in every project - they coexist and each AI tool reads only its own directory.

#### 1.2 Rules
- **Coding Guidelines in context.md**: `docs/context.md` must contain a `## Coding Guidelines` section with the mandatory template from §8. The `audit.sh` / `audit.ps1` script must verify this heading exists and abort with a non-zero exit code if it is missing.
- **Hybrid Scripting & Cross-Platform Parity**: The workspace follows a hybrid scripting model:
  1. **Utility Scripts** (e.g., `dev-sync`, `audit`) are implemented in pure PowerShell (`.ps1`) and Bash (`.sh`). `scripts/` must always provide both `.sh` and `.ps1` pairs. Both files must accept the exact same parameters and perform identical side-effects.
  2. **Agent Orchestration** (e.g., `dispatch`, `verify-skills`) and complex workflows are implemented in TypeScript (`.ts`) executed via Bun. These `.ts` files do not require PS1/SH pairs.
- **ADR Format Standard**: ADRs in `docs/adr/` must follow sequential 4-digit prefix naming (`0001-slug.md`). Every ADR must consist of three mandatory sections:
  1. **Context**: What is the problem or architectural background context?
  2. **Decision**: What choice was made and why?
  3. **Consequences**: What are the trade-offs, side-effects, and future implications of this decision?
- **Execution Paths**: Script references within code or documentation must use relative platform-agnostic formatting or supply examples for both terminal types.
- **Shared Memory**: `memory/` is strictly shared across all AI tools - not for general application data or temporary local logs.
- **Locales**: `locales/` uses flat JSON files matching ISO language codes (`ko.json`, `en.json`, etc.).
- **Orchestration**: `agents/pm.md` is always created - even for single-agent or simple projects.
- **Agent Index**: `AGENTS.md` is always created at the project root - it is the canonical agent roster shared by all AI tools. Keep it in sync with `docs/context.md ## Agents` (or `CONSTITUTION.md` for the root workspace).
- **Secrets**: `.env.sample` is always committed; `.env` is always in `.gitignore`.
