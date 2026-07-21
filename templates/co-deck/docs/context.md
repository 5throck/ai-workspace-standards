# co-deck — Project Context

> Shared reference for all AI tools (Claude Code, Gemini CLI, Antigravity).
> Tool-specific behaviors: CLAUDE.md (Claude Code), GEMINI.md (Gemini/Antigravity).
> Variant-specific configuration (tech stack, agents, skills, scripts, workflow):
>   → docs/co-deck.context.md
>
> ⚠️ This file is IMMUTABLE after project creation.
>    All project-specific changes belong in docs/co-deck.context.md

---

## Project Overview

Lecture and presentation material production variant — 11-stage AI workflow from research to print-ready PDF, plus an independent H-Stage pipeline for handbook/course-site production.

**Type**: variant
**Status**: Beta

---

## Architecture

### 3-Tier Agent Model Strategy

This project follows the workspace-wide 3-Tier model architecture to decouple agent roles from hardware.
The mapping is immutable per generation:

**Gemini Tier Mapping (3.x Generation):**
- **High**: `gemini-3.1-pro` (Complex reasoning, planning, PM/Architect)
- **Medium**: `gemini-3.5-flash` (Reviews, testing, QA)
- **Low**: `gemini-3.5-flash` (Fast, repetitive execution)

**Claude Tier Mapping:**
- **High**: `claude-opus-4-7`
- **Medium**: `claude-sonnet-4-6`
- **Low**: `claude-haiku-4-5`

Standard directory layout for all projects in this workspace:

```
<project-root>/
├── src/          # Source code
├── docs/         # context.md (this file) + co-deck.context.md + ADRs
├── scripts/      # Automation scripts (TypeScript, .ts via bun)
├── memory/       # Session logs (MEMORY.md index + daily logs)
├── agents/       # Role-based agent definitions
├── skills/       # Reusable workflow skills (SSOT for all platforms)
├── .claude/      # Claude Code / Claude App settings and slash commands
├── .gemini/      # Gemini CLI settings and slash commands
└── .agents/      # Antigravity / Antigravity CLI settings and slash commands
```

**Cross-Platform Skill Availability**: `skills/` is the Single Source of Truth (SSOT) for all skill definitions. Every skill MUST be available on all AI platforms (Claude Code, Claude App, Gemini CLI, Antigravity, Antigravity CLI). Platform distribution directories (`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`) are derived copies — they MUST NOT be the sole location of any skill.

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/context.md` | This file — immutable project identity |
| `docs/co-deck.context.md` | Variant config — tech stack, agents, skills, scripts, workflow |
| `CLAUDE.md` | Claude Code session behavior and slash commands |
| `GEMINI.md` | Gemini CLI / Antigravity session behavior |
| `AGENTS.md` | Canonical agent index (auto-loaded by Claude Code) |
| `.claude/skills.json` | Claude Code/App skill discovery config (registers `skills/` SSOT) |
| `.gemini/skills.json` | Gemini CLI skill discovery config (registers `skills/` SSOT) |
| `.agents/skills.json` | Antigravity/Antigravity CLI skill discovery config (registers `skills/` SSOT) |
| `scripts/audit.ts` | Documentation audit (enforced on pre-commit) |
| `scripts/dev-sync.ts` | Full sync pipeline (memlog → audit → commit → PR) |
| `memory/MEMORY.md` | Development log index |
| `CHANGELOG.md` | User-visible change history |

---

## Platform-Specific Tools

Standard package managers for each platform:

| Platform | Package Manager | Example Usage |
|----------|----------------|---------------|
| **Windows** | `winget` | `winget install Git.Git`, `winget install OpenJS.NodeJS` |
| **macOS** | `brew` | `brew install git`, `brew install node` |
| **Linux (Ubuntu/Debian)** | `apt` | `sudo apt install git`, `sudo apt install python3` |
| **Linux (Fedora/RHEL)** | `dnf` | `sudo dnf install git`, `sudo dnf install python3` |

> **Why This Matters**: Standard package managers ensure consistent installation experiences across teams. Always prefer platform-native package managers over manual downloads when available.

---

## Documentation Standards

### Session Log Format (`memory/YYYY-MM-DD.md`)

Every session log entry MUST include the following four sections:

```markdown
## Session Summary
<!-- One paragraph: what was accomplished this session -->

## Changes
<!-- File-level list of what was created, modified, or deleted -->
- `path/to/file` — created: reason
- `path/to/file` — modified: what changed and why
- `path/to/file` — deleted: reason

## Decisions
<!-- Architectural or design choices made, with rationale -->
- Decision: why this approach was chosen over alternatives

## Open Issues
<!-- Unresolved problems, blockers, or follow-up items -->
- Issue: symptom → root cause → resolution (or "pending")
```

> All AI tools (Claude Code, Gemini CLI, Antigravity) MUST produce session logs
> with these exact four section headings for cross-tool consistency.

### CHANGELOG Entry Format (`CHANGELOG.md`)

Every entry under `[Unreleased]` MUST include a PR reference:

```markdown
## [Unreleased]
### Added
- Short description of change (#PR-number)
```

### Language Policy

| Content | Language |
|---------|----------|
| Conversational replies to user | Korean (default) |
| Code, config, commit messages | English only |
| PR titles, bodies, branch names | English only |
| CHANGELOG.md entries | English only |
| memory/ session logs | English only |

#### Language Policy Exception (Korean Legal/Regulatory Content)
For files where Korean is legally or academically mandatory (such as statutory texts or primary source quotations), a narrow exception is permitted by adding the following frontmatter:
```yaml
lang: ko
lang_reason: legal # legal | source-material | proper-noun
```
*(This exception is NOT available for operational files like agents, skills, and context files)*

**Skills needing non-English reference data**: since `skills/*.md` can never carry the `lang: ko` exception, store terminology glossaries or source-language excerpts in a non-Markdown file under `skills/<name>/references/` (e.g. `references/terms-ko.json`) instead — language validation only scans `.md` files. `SKILL.md` stays English-only and links to it.

### File Encoding

All text files (Markdown, scripts) must be saved as **UTF-8 (without BOM)**.

---

## Coding Guidelines

This project follows the workspace coding standards defined in the project's Coding Guidelines section.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**

---

## File Organization Policy

All agents must follow this file routing policy. **Creating `.md` files at the project root is prohibited** unless they are standard root files.

### Standard Root Files (allowed at root)
`README.md`, `CHANGELOG.md`, `AGENTS.md`, `SECURITY.md`, `workspace standards`, `CLAUDE.md`, `GEMINI.md`

### File Type Routing
| File Type | Default Location |
|-----------|-----------------|
| Analysis, research, investigation results | `docs/` |
| Final reports, deliverables | `docs/` |
| Work-in-progress, drafts | `docs/drafts/` |
| Session logs, meeting transcripts | `memory/` |
| Temporary code, scratch scripts | `tests/` |
| Configuration, tooling files | project root (allowed) |

> **Rule**: When creating any file, always specify the full relative path. If unsure, default to `docs/`. Never create `.md` files at the project root unless it is a standard root file listed above.

### Workspace & Template Boundary Policy

- **Strict CWD Isolation**: When modifying templates (in `templates/`), you MUST strictly limit your working directory (CWD) to the specific template folder.
- **No Cross-Modification**: Modifying workspace root files and template files in a single task or session is forbidden. Keep workspace root changes and template changes completely isolated.

---

## Research Standards

When conducting research, investigation, or presenting factual claims from external sources:

### 1. Source Citation (Required)
Every factual claim derived from external sources must include a citation. Use one of these formats:

- **Inline reference**: `[Source: <URL or document name>]`
- **Dated inline reference**: `[Source: <URL>, accessed <YYYY-MM-DD>]`
- **End-of-document section**: Add a `## References` section listing all sources

### 2. Source Verification
Before citing a source, verify it actually contains the claimed information:
- If web access tools are available: access the URL and confirm the content exists
- If access is not possible: mark the claim as unverified using the disclosure format below
- Prefer primary sources (official documentation, academic papers, official announcements) over secondary sources (blog posts, summaries)

### 3. Uncertainty Disclosure
When a source cannot be verified or information is uncertain, explicitly disclose it:
```
⚠️ Unverified: [claim]. Recommend manual verification at [source].
```

### 4. Research Output Location
Research results must follow the File Organization Policy:
- Place research documents in `docs/research/` with a `## References` section
- Place analysis results in `docs/` with inline citations

---

## Computational Integrity Standards

For domains requiring high-precision or safety-critical numerical computation, **AI must NOT perform calculations directly**. Delegate to validated external tools instead.

### When External Tools Are Mandatory (Class A)

Use an external computation tool when the task involves ANY of the following:

- **Safety-critical engineering**: aerospace, aviation, nuclear, medical devices, structural engineering
- **Precision control systems**: PID tuning, transfer functions, stability margins, orbital mechanics, guidance systems
- **Regulated financial calculations**: accounting, tax, contract amounts, options pricing (Black-Scholes etc.), VaR, WACC, IRR/NPV with legal implications
- **High-precision requirements**: results requiring more than 4 decimal places of reliability
- **Iterative numerical methods**: differential equation solving, loops > 100 iterations

### Recommended Tools by Domain

| Domain | Recommended Tool | Install |
|--------|-----------------|---------|
| Aerospace / Precision Control | Fortran (gfortran), Julia | `apt install gfortran` / `juliaup` |
| Financial / Statistical | Python + NumPy, SciPy, pandas | `pip install numpy scipy pandas` |
| Structural / Thermal Analysis | Python + FEniCS, Fortran | domain-specific |
| General Scientific Computation | Python + NumPy | `pip install numpy` |

### Required Procedure

1. **Check availability**: verify the tool is installed (`which gfortran`, `python -c "import numpy"`)
2. **Install if missing**: route through the `stack-setup` agent — **never install tools without security review and explicit user approval**
3. **Write computation code**: document the algorithm, inputs, units, and assumptions in comments
4. **Execute and validate**: verify units, test boundary values and edge cases
5. **Document result**: state `Computed using: <tool> v<version>, code: <file-path>`

### AI Estimation vs. Tool Computation

| Scenario | Approach |
|----------|----------|
| Order-of-magnitude check or hypothesis formation | AI direct — label clearly as **approximate** |
| Any Class A domain computation | External tool — mandatory |
| Result to be cited, reported, or acted upon | External tool — mandatory |

> **Rule**: When in doubt whether a computation requires a tool, use a tool. An AI-estimated result presented as authoritative is a safety and accuracy risk.

---

## Lifecycle Management

This workspace follows explicit lifecycle management practices for Agents, Skills, and Scripts to ensure consistency and maintainability.

### Common Principles

- **Agent / Skill / Script** each have explicit lifecycle states (active, deprecated, retired/archived)
- Full lifecycle rules are defined in the workspace `workspace standards` section files
- Audit commands exist for each domain: `agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`, `verify-scripts.ts`

For full lifecycle procedures, see the workspace governance documentation (not part of this
template — this variant does not depend on workspace-root-only files):
- **Agent Lifecycle**: workspace governance docs → §5.6 Agent Lifecycle Management
- **Skill Lifecycle**: workspace governance docs → §6 Skill Lifecycle Management
- **Script Lifecycle**: workspace governance docs → §6.5 Script Lifecycle Management

---

*context.md version: 2.1 — synced from templates/common v2.0 with co-deck substitutions*
