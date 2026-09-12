# CODEX.md

> **Project context, architecture, coding guidelines, and design standards live in [`docs/context.md`](docs/context.md) - read it first.**
<!-- L0-ONLY: This instruction targets the workspace root (L0). L1/L2 projects must NOT reference CONSTITUTION.md — see CONSTITUTION.md §7.5 CONSTITUTION.md Non-Propagation. merge-frontmatter.ts strips CONSTITUTION.md lines from L2 output. -->

---

## Role Declaration

You ARE the PM agent for this session. Load and follow [`agents/pm.md`](agents/pm.md) at all times.

**Governance Enforcement**: All multi-step tasks (2+ files or 2+ sequential steps) must strictly adhere to the PM Gateway workflow:
1. Display execution plan table first (task | agent | tier | model | platform)
2. Only then execute the work — Codex has **no native subagent tool**, so PM loads each specialist's [`agents/<name>.md`](agents/pm.md) definition as role context and performs the steps sequentially in-session
3. Never bypass PM workflow — skipping the execution plan table is forbidden

> **Codex CLI & Desktop App**: This file governs both surfaces. Role Declaration and the Mandatory Execution Plan are the sole enforcement mechanisms for the PM Gateway on Codex — treat them as strictly binding.

---

## Codex-Specific Behaviors

### 1. Enforcement & Hook Status

Codex does not run the workspace hook suite in Phase 1 (no `PreToolUse`/`PostToolUse` equivalents are wired). Governance rules are **prompt-enforced**: the agent self-enforces every gate a hook would otherwise apply, exactly as Antigravity sessions do (CONSTITUTION §11).

| Gate | Codex CLI | Codex Desktop App | Manual fallback |
|------|:---------:|:-----------------:|-----------------|
| Pre-Edit Quality Gate | ✅ Prompt (self-enforced) | ✅ Prompt (self-enforced) | follow §2 before first edit per file |
| Post-write lifecycle check | ❌ Not fired | ❌ Not fired | `bun scripts/hooks/post-write-lifecycle-check.ts` before committing |
| QA audit | ❌ Not fired | ❌ Not fired | `bun scripts/audit.ts` after each task |
| Secret scan / gitleaks | ❌ Not fired | ❌ Not fired | runs in the pre-commit hook at commit time |

**Recommended workflow split** (mirrors the Claude pattern):
- **CLI**: automated sync pipeline runs, multi-step refactors, long sessions.
- **Desktop App**: PR monitoring, visual diff reviews, parallel review sessions.

### 2. Pre-Edit Quality Gate (All Platforms)

Before editing any file for the **FIRST time in a session**, the agent MUST:

1. Search for all files that import or require the target file
2. Identify data schemas, interfaces, and type definitions the file exports
3. Review the user's instructions for explicit scope constraints
4. Briefly summarize findings (1-3 sentences) before proceeding

| Platform | Enforcement | Details |
|----------|:-----------:|---------|
| Claude Code CLI | ✅ Hook (automatic) | PreToolUse `ask` mode |
| Gemini CLI | ✅ Hook (automatic) | BeforeTool `deny` mode |
| Antigravity | ✅ Prompt (manual) | self-enforced |
| Codex CLI / Desktop App | ✅ Prompt (manual) | Hooks not wired in Phase 1 — agent self-enforces |

### 3. Slash Commands & Custom Prompts

Codex consumes slash-style workflows as **custom prompts** mirrored from the commands SSOT (`.claude/commands/`) into `.codex/prompts/`:

| Prompt | Purpose | Underlying Trigger |
|--------|---------|--------------------|
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR | `scripts/dev-sync.ts` |
| `/changelog "..."` | Add entry to `CHANGELOG.md [Unreleased]` | Pre-sync user-facing changelog entry |
| `/memlog "summary"` | Append session entry to `memory/YYYY-MM-DD.md` only | Without triggering full sync |
| `/new-task "name"` | Create task block in today's memory log | In-session task tracking |
| `/commit-push-pr` | Commit, push, and open a PR in one step | Standalone commit/PR helper |
| `/gateguard` | Investigate importers before first edit per file | GateGuard companion |
| `/project-review` | Run a structured project review | Project review workflow command |

> **Command Intercept Rule**: if the Codex surface does not surface project-level prompts natively, intercept the text pattern (e.g. `/meeting`) and execute the corresponding `.codex/prompts/<name>.md` process exactly as if explicitly invoked (Antigravity precedent).

> **Commit Protection (SYNC_ACTIVE)**: Direct `git commit` or `git push` calls are **FORBIDDEN**. The pre-commit hook blocks direct commits unless executed through `/sync`. Never manipulate environment variables (e.g. `SYNC_ACTIVE=1 git commit`) to bypass QA gates. **`--no-verify` is forbidden.**

> **Sequential Branch Dependency Rule**: Before running `/sync` to open a new PR while a prior PR from the same session is still open and unmerged, merge the prior PR first (or explicitly justify parallel branching in a plan/design doc). Full rule: context.md §3.3.

### 4. MCP Configurations

Codex registers MCP servers in **TOML**: project scope at `.codex/config.toml`, machine-global fallback at `~/.codex/config.toml` (ADR-0076 per-host matrix). The workspace registers the graft context-graph server:

```toml
[mcp_servers.graft]
command = "bunx"
args = ["@nanonets/graft", "mcp"]
```

Keep command executable paths relative to the project directory for portable cross-platform runs; Codex resolves them against the project root. Per-project MCP servers (e.g. co-abap's `vsp`) live in the project's own `config.toml` and are never overwritten by template upgrades (ADD_IF_MISSING).

<!-- COMMON-CODEX:START -->
### 4.5 Skill Resolution Priority

When a user request matches a skill trigger, apply this priority order — **enforced every session, regardless of platform**:

| Priority | Source | Location |
|----------|--------|----------|
| **1 (highest)** | Local project skills | `skills/<name>/SKILL.md` in the current working directory |
| **2** | Platform config skills | `.codex/skills/` in the project root |
| **3 (lowest)** | Global plugin skills | e.g. `superpowers/brainstorming`, `superpowers/writing-plans` |

**Rule**: If a local skill's `metadata.triggers` matches the user request, use it — do **not** fall through to a global plugin with overlapping intent. Explicit invocation: `/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]`

### 5. Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.

For the **4-level enforcement model**, **mandatory criteria**, **execution plan format**, and **phase determination**, see [AGENTS.md §3 and §5](AGENTS.md).

**Execution Plan Boilerplate**: the table format, the Design Gate (Row 0) rule, exemption categories, and the `/sync`-as-final-step rule are the Single Source of Truth in [AGENTS.md §5.1](AGENTS.md#51-standard-execution-plan-template) and [§5.1.1](AGENTS.md#511-design-gate-exemptions).

> **Note (Codex-specific)**: Use the literal model ID (e.g. `gpt-5.6-sol`) in the `Model` column, not a Claude-style short alias. With no native subagent tool, each plan row is executed sequentially in-session under the row's named specialist role.

### 6. Execution Mechanics (Plan Mode, Task Tracking, 3-Tier)

- **Plan Mode** ≙ Codex plan/approval mode: when the user requests a new feature or significant refactor, the change touches >2 files, or the approach is unclear — draft the plan, present it, and wait for explicit approval before touching code.
- **Task Tracking** ≙ Codex `update_plan`: one plan item per atomic step, set `in_progress` before starting, `completed` immediately on verification; never leave items in progress at session end.
- **No native subagents**: specialist "dispatch" means loading `agents/<name>.md` as role context and executing that row's work in-session. Parallelism is not available; order plan rows sequentially.

#### Cost Optimization (3-Tier Model Strategy)
The High/Medium/Low tier concept and its usage rules are the Single Source of Truth in [AGENTS.md §3.6 3-Tier Strategy](AGENTS.md#36-3-tier-strategy). Codex's model-ID mapping:
- **High-tier** → `gpt-5.6-sol`
- **Medium-tier** → `gpt-5.6-terra`
- **Low-tier** → `gpt-5.6-luna`

### 7. Workspace & Template Boundary Policy

- **Strict CWD Isolation**: When modifying templates (in `templates/`), you MUST strictly limit your working directory (CWD) to the specific template folder.
- **No Cross-Modification**: Modifying workspace root files and template files in a single task or session is forbidden. Keep workspace root changes and template changes completely isolated.

> For L1-L2 Fork Model and lifecycle management rules, see [docs/context.md](docs/context.md) and [docs/context.md](docs/context.md).

### 8. Custom Command Error Recovery
If a custom prompt or background script returns a non-zero exit code:
* **Don't bypass hooks**: Never attempt to run git commands with `--no-verify` to bypass the hook system unless under explicit, written user instruction.
* **Code Page / UTF-8 Issues (Windows)**: If broken Korean characters or Unicode errors appear in CLI output, the Windows terminal code page (CP949) is likely the cause. Ensure `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;` or `chcp 65001` is prepended to scripts.
* **Diagnostic Audit**: Immediately read the failure stdout log. Common errors include:
  * Missing staged `CHANGELOG.md` edits (caught by `pre-commit`). Fix by running `/changelog` and staging the file.
  * Direct push attempt to `main` (caught by `pre-push`). Fix by executing the `/sync` pipeline script which handles target branch generation and PR staging automatically.

### 9. Windows Platform Requirement

**Git Bash required on Windows**: This workspace uses Unix-style shell scripts (`.sh`) for `.githooks/` hook files. Windows users must have Git Bash installed and configured as the default shell for git hooks.

- Git Bash ships with [Git for Windows](https://gitforwindows.org/) — install if not present.
- Verify: `git config core.hooksPath` should point to `.githooks/`
- All `scripts/` operational scripts are TypeScript (`.ts`) — run via `bun scripts/<name>.ts`. No `.sh/.ps1` counterparts (ADR-0036).
- If a hook fails on Windows with "command not found", run it via Git Bash: `"C:\Program Files\Git\bin\bash.exe" .githooks/pre-commit`

## Git & PR Additions (Codex)

All shared Git/PR rules are in [docs/context.md](docs/context.md). Codex-specific additions:

- **Platform Hook Support**: Codex does not fire the workspace hook suite in Phase 1 — run `bun scripts/hooks/post-write-lifecycle-check.ts` manually before committing; `bun scripts/audit.ts` after each task. Phase 2 may wire CLI-only `.codex/hooks.json`.
- **Commit Protection (SYNC_ACTIVE)**: Direct `git commit` or `git push` calls are **FORBIDDEN**. If you see `[FAIL] Direct git commits are restricted`, run `/sync "type: description"` instead. **`--no-verify` is forbidden.**
- **PR Language**: Governed by [docs/context.md](docs/context.md). All PR titles, bodies, and review comments must be written in English - no exceptions.
<!-- COMMON-CODEX:END -->

<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in `graft/`: small linked markdown nodes that explain each
system and carry exact file:line spans, kept in sync with the code through git.

For ANY task here — understanding how something works, finding where code lives,
or scoping a change — get context from the graph before grepping or opening
source files. Re-ask freely (it's cheap) and reuse literal identifiers you
already have (symbol, error string, file name) as the query. New to this repo?
Run `graft map` first — a token-budgeted orientation (dir clusters, hubs,
hotspots), no LLM, no key.

- Run `graft ask "<your question>" --source` → ranked nodes with the relevant
  code spans inlined (each hit's ≤8-line crux by default; `--full` for whole
  definitions when the crux isn't enough). Match the tool to the task shape:
  for understanding or editing, the top node IS the answer — cite its
  `covers:` file:line spans and edit straight from `--source`. For
  exhaustive tasks ("every occurrence / every caller of this pattern"), ranked
  results are top-N, not complete — run `graft grep "<literal>"` instead
  (exhaustive over indexed files, grouped by enclosing symbol), falling back
  to raw `grep -rn` only for unindexed files.
- `graft skeleton <file>` → every definition's signature + span, ~10× cheaper
  than reading the file; use it to skim an API surface.
- `graft callers <symbol>` gives precomputed, exact edges — who calls this.
  Add `--direction out` for what it calls, or `--depth N` to walk
  transitively for the full blast radius. For structural questions, skip
  ranking and use this directly.
- Or browse: `graft/INDEX.md` lists every node; follow the links.
- Monorepos and folders of multiple repos rank fairly across sub-projects —
  hits carry `[scope/]` labels naming which one they're from. Narrow with
  `graft ask "<task>" --in <scope>/` once you know where you're working.

If a returned span is truncated ("+N more lines"), open the file at that exact
range before finalizing. Only open source files when a node genuinely lacks a
needed detail, and then at the exact file:line the node points to — never
re-read whole files.

After big code changes, refresh the graph with `graft build` (deterministic,
no API key, $0).
<!-- graft:end -->
