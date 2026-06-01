# GEMINI.md

**vsp** ?봆o-native MCP server and CLI for SAP ABAP Development Tools (ADT).

> This file contains **Gemini-specific overrides only**.
> All shared dev context (build commands, codebase map, current priorities, common issues,
> ABAP rules, security) lives in [docs/context.md](docs/context.md) and applies to all AI tool sessions equally.
> Read `docs/context.md` first, then apply the overrides below.

---

## Context Loading

Load project files at session start using the `@` syntax:
*(Ref: `docs/context.md` -> `Initial Context Files`)*

```
@docs/context.md                            # full project knowledge (ABAP rules, build, codebase map)
@AGENTS.md                                  # canonical agent roster
@memory/MEMORY.md                           # recent changes (skip if file does not exist)
@skills/abap-dev/SKILL.md                   # SAP development workflows
@skills/post-write-chain/SKILL.md           # mandatory QA chain after any write
```

---



## Gemini-Specific Configuration

### Recommended Mode

Use `--mode hyperfocused` for all Gemini sessions. In hyperfocused mode all 101 MCP operations are accessible via `sap_execute`; the single entry point reduces tool-selection hallucinations without restricting capability.

```bash
vsp mcp --mode hyperfocused
```

### Settings File

Gemini reads `.gemini/settings.json` in the project root. Confirm `mcpServers.abap.args`
contains `["--mode", "hyperfocused"]` before starting a session.

### Tool Usage in Hyperfocused Mode

All operations are routed through `sap_execute` with an `action` parameter:

```json
{ "action": "GetSource", "object_type": "PROG", "name": "ZPROG_SBOOK_QUERY" }
{ "action": "EditSource", "object_url": "/sap/bc/adt/...", "old_string": "...", "new_string": "..." }
{ "action": "GrepPackages", "packages": ["$TMP"], "pattern": "ZPROG_" }
```

See [docs/mcp_usage.md](docs/mcp_usage.md) for the full tool catalog and parameter reference.

---

## Gemini Skill Additions

The following capabilities extend those in [skills/abap-dev/SKILL.md](skills/abap-dev/SKILL.md):

- **Role-Based Execution**: Switch between Business and Technical roles defined in `AGENTS.md`
  by explicitly stating the active role at the start of a task.
- **Multi-Agent Coordination**: Delegate long-running research to background sessions;
  keep write operations (EditSource, WriteSource) in the primary session.
- **Advanced Diagnostics**: Use `vsp health` to validate architecture and
  `vsp slim` for context optimization before large read sessions.
- **Post-Write Test Chain**: Hooks are not supported. After any write operation, execute the mandatory chain manually via `sap_execute` as defined in `docs/context.md`.
  ```json
  { "action": "SyntaxCheck",   "object_url": "/sap/bc/adt/..." }
  { "action": "RunUnitTests",  "object_url": "/sap/bc/adt/..." }
  { "action": "RunATCCheck",   "object_url": "/sap/bc/adt/..." }
  ```

> **Common engineering rules** (memory logging, language, file isolation, post-write chain, git): [docs/context.md 吏?Project-Wide Rules](docs/context.md#project-wide-rules-all-tools).

---


## Gemini Tool Safeguards

#### ?슚 Surgical Multi-Replace Offset Safeguard
When calling `multi_replace_file_content` with multiple `ReplacementChunks`, the line numbers of subsequent target blocks will shift if previous edits change the line count.
- **Rule**: Sort and process `ReplacementChunks` from the **bottom of the file to the top** (descending order of line numbers: largest `StartLine` first).

#### ?슚 Grep Search 50-Match Cap Safeguard
The `grep_search` tool silently truncates results at exactly **50 matches**.
- **Rule**: If a search yields 50 results, do **NOT** assume you have all occurrences.
- **Remediation**: Partition the search by targeting specific subdirectories or applying restrictive file glob filters via the `Includes` parameter (e.g., `["*.go"]`).

---

## Gemini-Specific Workflows

### 1. Planning Mode & Artifact Specifications
For complex tasks or architectural modifications, Gemini must enter **Planning Mode**. Leverage these three Markdown artifacts (set `IsArtifact: true` with accurate metadata):

#### 1a. `implementation_plan.md`
*Path: `<appDataDir>\brain\<session-id>\implementation_plan.md`*
- **Purpose**: Detailed technical design document presented to the user for feedback and approval.
- **Metadata**: `ArtifactType: "implementation_plan"`, `RequestFeedback: true`.
- **Governance**: Stop and wait for explicit user approval before modifying any code.

#### 1b. `task.md`
*Path: `<appDataDir>\brain\<session-id>\task.md`*
- **Purpose**: Running TODO list to track development progress dynamically.
- **Metadata**: `ArtifactType: "task"`.
- **Syntax**: `- [ ]` uncompleted 夷?`- [/]` in progress 夷?`- [x]` completed.

#### 1c. `walkthrough.md`
*Path: `<appDataDir>\brain\<session-id>\walkthrough.md`*
- **Purpose**: Post-implementation document summarizing changes, test logs, and manual validation details.
- **Metadata**: `ArtifactType: "walkthrough"`.

After changes are verified, summarize outcomes in `memory/YYYY-MM-DD.md`.

### 2. Executing Custom Commands
Unlike Claude Code, Gemini does not natively register local custom slash commands from `.gemini/commands/` or `.claude/commands/`. Instead:
- Automation workflows like `/sync` or `/memlog` are simulated or executed directly as project scripts (e.g., executing `.\scripts\dev-sync.ps1` or `./scripts/dev-sync.sh` via terminal tools).
- System-provided slash commands (like `/goal`, `/schedule`, `/browser`, `/grill-me`) can be recommended to the user.

### 3. Coexistence, Precedence & Migration of .claude
This project contains a `.claude/` directory. To prevent configuration drift and avoid issues when transitioning away from Claude Code, Gemini follows these rules:
- **Absolute Precedence**: `.gemini/` always takes absolute precedence over `.claude/`. If `.gemini/` exists, `.claude/` is ignored by Gemini to prevent duplicate or conflicting configurations.
- **Fallback (Coexistence Phase)**: If a project lacks a `.gemini/` directory but contains `.claude/`, Gemini will temporarily read and respect `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/commands/` as the fallback source of truth.
- **Graceful Migration**: If the project transitions fully away from Claude Code, or if Gemini needs to write new project-level settings/commands, Gemini should proactively offer to migrate the `.claude/` configuration to `.gemini/` (copying and adapting files) rather than leaving legacy files orphaned.
- **Command Emulation**: Custom slash commands defined as markdown files in `.claude/commands/` must be emulated by Gemini. Read the `.md` file to understand the underlying script execution and run those commands directly via terminal tools.
- **Gemini Integration Rule**: Gemini can dynamically instantiate roles defined in `AGENTS.md` using `define_subagent` and `invoke_subagent`.

#### Define Subagent (`define_subagent`)
```json
{
  "name": "abap-analyst",
  "description": "Read-only ABAP code analysis and dependency mapping",
  "system_prompt": "You are an ABAP code analyst...",
  "enable_write_tools": false,
  "enable_subagent_tools": false
}
```

#### Invoke Subagent (`invoke_subagent`)
```json
{
  "Subagents": [
    {
      "TypeName": "abap-analyst",
      "Role": "ABAP Analyst",
      "Prompt": "Analyze dependencies of ZPROG_SBOOK_QUERY in package $TMP"
    }
  ]
}
```

#### Communication (`send_message`)
Interact with spawned agents via their unique `conversationID`.
**Reactive Wakeup**: Do not poll in a loop ?봲imply yield execution and the platform wakes you automatically when an agent replies or a background task completes.


#### Superpowers Plugin & Cost Optimization (3-Tier Strategy)
The PM agent MUST leverage the **`superpowers`** plugin (e.g., `subagent-driven-development`, `dispatching-parallel-agents`) for multi-agent harness engineering using a 3-tier model strategy:
**Model Selection Overrides** (overridden per subagent invocation when appropriate):
- **High-tier (Design/Planning)** ??`gemini-3.1-pro` (Parameter: `thinking_level="medium"`): Complex reasoning, architectural design, planning, and PM orchestration.
- **Medium-tier (Review/QA)** ??`gemini-3.5-flash` (Parameter: `thinking_level="medium"`): Code review, testing, PR review, and quality gates (`verification-before-completion`). Supervises the Low-tier.
- **Low-tier (Execution/Coding)** ??`gemini-3.5-flash` (Parameter: `thinking_level="low"`): Fast, repetitive coding, boilerplate generation, or strictly scoped sub-agent tasks.

---

### Optimal Interaction Guidelines
- **Context Management**: Leverage your massive context window by cross-referencing multiple files simultaneously (e.g., when debugging, review log files along with related code).
- **Tool Usage**: Actively use tools like `search_web` for real-time package version verification or resolving external dependencies.

---

*Last Updated: 2026-06-01*



