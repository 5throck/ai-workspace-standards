# Platform Harness — Subagent Dispatch Reference

> Companion to BUILD_GUIDE.md §6 (content verification), §7 (language proofreading), §7.5 (SVG diagrams).
> This file describes **HOW** to dispatch subagents on each platform.
> BUILD_GUIDE.md describes **WHAT** each subagent must do.

## Platform Overview

| Platform | Shell | Subagent Tool | File I/O | Inter-Agent Messaging |
|----------|-------|---------------|----------|----------------------|
| Claude Code CLI | `Bash` | `Agent()` | `Read` / `Write` / `Edit` | `SendMessage` (Agent Teams) |
| Claude Desktop App | `Bash` | `Agent()` (limited Teams) | `Read` / `Write` / `Edit` | `SendMessage` (limited) |
| Antigravity (VS Code) | `run_command` | `define_subagent` + `invoke_subagent` | `view_file` / `write_to_file` | `send_message` (by `conversationID`) |
| Antigravity CLI (Gemini CLI) | `run_command` | `define_subagent` + `invoke_subagent` | `view_file` / `write_to_file` | `send_message` (by `conversationID`) |

> **Note**: Antigravity VS Code does **not** fire hooks (extension limitation). Claude Desktop App hooks may fire intermittently. Claude CLI hooks fire reliably.

---

## 1. Claude Code CLI / Desktop App

### 1.1 Agent Tool API

Use the native `Agent` tool to spawn sub-agents. Sub-agents load their role-based configurations from `agents/<name>.md`.

```
Agent(
  description   = "Implement automation script",
  prompt        = "You are an automation engineer. [paste agents/<name>.md content here]\n\nTask: <specific task description>",
  subagent_type = "claude",
  model         = "haiku"     // tier-appropriate alias: opus | sonnet | haiku
)
```

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `description` | string | Yes | Short human-readable label for the sub-agent task |
| `prompt` | string | Yes | Full role definition + task instructions. Embed the agent's `agents/<name>.md` role definition, then append the specific task |
| `subagent_type` | string | Yes | Platform agent type. Always `"claude"` for Claude Code |
| `model` | string | Recommended | Short alias for the model tier: `"opus"`, `"sonnet"`, or `"haiku"`. **Always set explicitly** to get the cost-tier benefit. Omitting lets the subagent inherit the parent session's model |

**Concrete example — §6 Domain Expert persona dispatch**:

```
Agent(
  description   = "Verify factual accuracy of quantum computing section",
  prompt        = "You are a Domain Expert reviewer for the explain-me report verification harness (BUILD_GUIDE.md §6).\n\nPersona: Domain Expert — verify factual accuracy, flag outdated claims, check citation quality.\n\nTask: Read the generated report at <output-path>. Focus on the 'Quantum Computing' tab. Verify all factual claims against reliable sources. Output a JSON array of findings: [{\"location\": \"tab>section\", \"issue\": \"...\", \"severity\": \"critical|major|minor\", \"suggestion\": \"...\"}].",
  subagent_type = "claude",
  model         = "sonnet"
)
```

### 1.2 Model Tier Mapping

| Tier | Registry Model ID | Agent `model` Parameter | Typical Use |
|------|-------------------|------------------------|-------------|
| High | `claude-opus-5-0` | `"opus"` | Synthesis agent, complex reasoning, merge conflicts |
| Medium | `claude-sonnet-5-0` | `"sonnet"` | Persona reviewers (§6), proofreaders (§7), SVG designer (§7.5) |
| Low | `claude-haiku-4-5` | `"haiku"` | Structural validation, simple checks, formatting |

> **docs-writer tier**: Medium (`claude-sonnet-5-0`) — per 2026-05-28 team restructuring.

**Translation rule**: When dispatching, translate the agent's tier to its registry model, then to the matching alias:
- High → `claude-opus-5-0` → `model = "opus"`
- Medium → `claude-sonnet-5-0` → `model = "sonnet"`
- Low → `claude-haiku-4-5` → `model = "haiku"`

### 1.3 Parallel Dispatch

The `Agent` tool supports **parallel dispatch by issuing multiple `Agent()` calls in a single turn**. Each call returns independently. The orchestrating agent collects all results before proceeding to the next phase.

**Parallel pattern** (single turn, multiple calls):

```
// All four §6 personas dispatched in one turn:
Agent(description = "Domain Expert review",  prompt = "...", subagent_type = "claude", model = "sonnet")
Agent(description = "Devil's Advocate review", prompt = "...", subagent_type = "claude", model = "sonnet")
Agent(description = "Clarity Editor review",  prompt = "...", subagent_type = "claude", model = "sonnet")
Agent(description = "Consistency Auditor",   prompt = "...", subagent_type = "claude", model = "sonnet")

// After all return, dispatch synthesis:
Agent(description = "Synthesize findings",    prompt = "...", subagent_type = "claude", model = "opus")
```

**Agent Teams** (optional, CLI only): When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set in `.claude/settings.json`, multiple Claude instances run in-process with a shared task list and direct `SendMessage` inter-agent messaging. `teammateMode` controls execution: `"in-process"` (both CLI and Desktop), `"tmux"` (CLI only), or `null` (auto-select). This is **not required** for the verification harness — simple parallel `Agent()` calls suffice.

---

## 2. Antigravity (VS Code) / Gemini CLI

### 2.1 define_subagent + invoke_subagent

Antigravity and Gemini CLI use a two-step subagent API: first define the subagent type, then invoke instances.

**Step 1: Define Subagent (`define_subagent`)**

```json
{
  "name": "domain-expert",
  "description": "Verifies factual accuracy and flags outdated claims",
  "system_prompt": "You are a Domain Expert reviewer for the explain-me report verification harness (BUILD_GUIDE.md §6). Verify factual accuracy, flag outdated claims, check citation quality. Output a JSON array of findings.",
  "enable_write_tools": false,
  "enable_subagent_tools": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for this subagent type |
| `description` | string | Yes | Human-readable purpose description |
| `system_prompt` | string | Yes | Full role definition and behavior instructions |
| `enable_write_tools` | boolean | No | Allow file writes (default: `false` for reviewers) |
| `enable_subagent_tools` | boolean | No | Allow nested subagent dispatch (default: `false`) |

**Step 2: Invoke Subagent (`invoke_subagent`)**

Spawn parallel instances to execute dedicated work concurrently. PM **must** explicitly use `"Workspace": "share"` for execution agents that need safe parallel file writing.

```json
{
  "Subagents": [
    {
      "TypeName": "domain-expert",
      "Role": "Domain Expert",
      "Prompt": "Read the generated report at <output-path>. Focus on the 'Quantum Computing' tab. Verify all factual claims. Output findings as JSON.",
      "Workspace": "share"
    },
    {
      "TypeName": "devils-advocate",
      "Role": "Devil's Advocate",
      "Prompt": "Read the generated report at <output-path>. Challenge assumptions, find weak arguments, identify gaps. Output findings as JSON.",
      "Workspace": "share"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `TypeName` | string | Yes | References a previously defined subagent `name` |
| `Role` | string | Yes | Human-readable role label for this invocation |
| `Prompt` | string | Yes | Task-specific instructions appended to the system prompt |
| `Workspace` | string | Recommended | `"share"` for parallel execution agents that write files; ensures safe concurrent file access |

> **Subagent commit rule**: Subagents must NOT issue `git commit` or `git push` directly. All commits go through PM via `/sync` only.

### 2.2 Model Tier Mapping

| Tier | Model ID | Thinking Parameter | Typical Use |
|------|----------|-------------------|-------------|
| High | `gemini-3.1-pro` | `thinking_level="medium"` | Synthesis agent, complex reasoning |
| Medium | `gemini-3.7-flash` | (none) | Persona reviewers (§6), proofreaders (§7), SVG designer (§7.5) |
| Low | `gemini-3.7-flash` | (none) | Structural validation, simple checks |

> **Note**: Medium and Low tiers share the same model (`gemini-3.7-flash`) on the Gemini platform. The distinction is operational — Low-tier tasks get shorter prompts and simpler instructions. When writing the `Model` column in execution plan tables, use the literal Gemini model ID (e.g. `gemini-3.1-pro`), not a Claude-style short alias.

### 2.3 send_message for Inter-Agent Communication

Interact with spawned agents via their unique `conversationID`:

```
send_message(
  conversationID = "<agent-conversation-id>",
  message        = "Please re-examine section 3.2 — the synthesis agent found a contradiction you missed."
)
```

The platform supports **Reactive Wakeup**: you do not need to poll or query tasks in a loop. Simply yield execution, and the platform wakes you automatically when an agent replies or a background task completes.

**Coordination pattern for §6 harness**:

1. Dispatch all 4 persona subagents via `invoke_subagent` (parallel)
2. Yield execution — platform wakes you as each agent returns
3. Collect all findings into a unified findings array
4. Dispatch synthesis subagent with the merged findings
5. Apply synthesis output to the report file

> **Antigravity VS Code limitation**: Hooks do not fire in Antigravity (VS Code extension limitation). The PM must self-enforce quality gates manually. Claude CLI hooks fire reliably.

---

## 3. Fallback: Single-Agent Sequential Review

When subagent dispatch is **unavailable** (e.g., Claude Desktop App without Teams enabled, or a platform that lacks subagent tools entirely), fall back to a **single-agent sequential review** using personas/lenses as a structured checklist.

### Degraded Workflow

The verification is still thorough — it runs the same checks, just sequentially in a single agent session rather than in parallel across multiple agents.

**Step 1: Content Verification (§6) — Sequential Persona Passes**

For each persona, the agent adopts the persona's perspective and reviews the full report (or section-by-section for long reports):

```
[Persona 1/4: Domain Expert]
Re-read the report from a Domain Expert perspective. Check:
- Factual accuracy of all claims
- Currency of data and statistics
- Citation quality and source reliability
- Technical correctness of domain-specific terminology
Record findings as: [{location, issue, severity, suggestion}]

[Persona 2/4: Devil's Advocate]
Re-read the report from a Devil's Advocate perspective. Check:
- Unstated assumptions
- One-sided arguments or missing counterpoints
- Overconfident conclusions without sufficient evidence
- Logical fallacies or gaps in reasoning

[Persona 3/4: Clarity Editor]
Re-read the report from a Clarity Editor perspective. Check:
- Jargon accessibility for target audience
- Information density (overwhelming vs. sparse)
- Explanatory metaphors and analogies
- Structural flow within sections

[Persona 4/4: Consistency Auditor]
Re-read the report from a Consistency Auditor perspective. Check:
- Cross-tab contradictions
- Terminology consistency
- Data consistency across tabs
- Internal hyperlink validity
```

**Step 2: Language Proofreading (§7) — Sequential Proofreader Passes**

For each proofreader lens, scan relevant sections:

```
[Lens 1/4: Grammar]
Scan for grammar errors, agreement issues, tense consistency.

[Lens 2/4: Spelling + Technical Terminology]
Check spelling, technical term capitalization, acronym consistency.

[Lens 3/4: Loanword Refinement]
Apply loanword-refinements.json lookups. Replace unnecessary foreign borrowings.

[Lens 4/4: Style + Tone]
Check tone consistency, register formality, passive/active voice balance.
```

**Step 3: SVG Diagram Review (§7.5)**

Review any SVG diagrams for:
- Visual clarity and readability
- Label accuracy and completeness
- Color palette consistency with report theme
- Responsive sizing and viewBox correctness

**Step 4: Merge and Apply**

After all sequential passes, merge all findings, deduplicate, and apply fixes to the report in a single edit pass.

### Sequential vs. Parallel Comparison

| Aspect | Parallel (Subagent) | Sequential (Fallback) |
|--------|--------------------|-----------------------|
| Speed | Fast — all personas run concurrently | Slower — each persona runs one at a time |
| Quality | Same checks, same rigor | Same checks, same rigor |
| Cost | Same total token count | Same total token count |
| Isolation | Each persona is a fresh context window | Single context — may accumulate bias |
| Availability | Claude CLI, Gemini CLI, Antigravity | All platforms |

> **Tip for sequential mode**: To reduce context-window bias, read only the relevant tab/section for each persona pass rather than holding the entire report in context. This mimics the isolation benefit of true subagent dispatch.

---

## 4. Harness Dispatch Patterns

### 4.1 §6 Content Verification Harness

**Purpose**: 4 personas review the report for factual accuracy, argument quality, clarity, and consistency. A synthesis agent merges findings and applies fixes.

**Recommended tier allocation**:

| Role | Claude Model | Gemini Model |
|------|-------------|--------------|
| Domain Expert | `sonnet` | `gemini-3.7-flash` |
| Devil's Advocate | `sonnet` | `gemini-3.7-flash` |
| Clarity Editor | `sonnet` | `gemini-3.7-flash` |
| Consistency Auditor | `sonnet` | `gemini-3.7-flash` |
| Synthesis + Apply | `opus` | `gemini-3.1-pro` |

**Claude Code — Parallel Dispatch (single turn)**:

```
// Phase 1: Dispatch all 4 personas in parallel
Agent(description = "§6 Domain Expert review",   prompt = "You are a Domain Expert reviewer...\n\nRead report: <path>\nReview ALL tabs. Output JSON findings array.", subagent_type = "claude", model = "sonnet")
Agent(description = "§6 Devil's Advocate review", prompt = "You are a Devil's Advocate reviewer...\n\nRead report: <path>\nReview ALL tabs. Output JSON findings array.", subagent_type = "claude", model = "sonnet")
Agent(description = "§6 Clarity Editor review",  prompt = "You are a Clarity Editor reviewer...\n\nRead report: <path>\nReview ALL tabs. Output JSON findings array.", subagent_type = "claude", model = "sonnet")
Agent(description = "§6 Consistency Auditor",     prompt = "You are a Consistency Auditor...\n\nRead report: <path>\nReview ALL tabs. Output JSON findings array.", subagent_type = "claude", model = "sonnet")

// Phase 2 (after all return): Synthesize and apply
Agent(description = "§6 Synthesis — merge findings and apply fixes",
       prompt = "You are the synthesis agent. Merge these findings from 4 reviewers:\n\n<findings-1>\n<findings-2>\n<findings-3>\n<findings-4>\n\nDeduplicate, resolve conflicts, then apply all critical and major fixes to the report at <path>. Output a summary of changes.",
       subagent_type = "claude",
       model = "opus")
```

**Gemini CLI / Antigravity — Parallel Dispatch**:

```json
// Define phase (run once per session, or reuse prior definitions)
// define_subagent: "domain-expert", "devils-advocate", "clarity-editor", "consistency-auditor", "synthesist"

// Phase 1: Invoke all 4 personas in parallel
{
  "Subagents": [
    {
      "TypeName": "domain-expert",
      "Role": "Domain Expert",
      "Prompt": "Read report at <path>. Review ALL tabs for factual accuracy, currency, citation quality. Output JSON findings array.",
      "Workspace": "share"
    },
    {
      "TypeName": "devils-advocate",
      "Role": "Devil's Advocate",
      "Prompt": "Read report at <path>. Review ALL tabs for weak arguments, unstated assumptions, logical gaps. Output JSON findings array.",
      "Workspace": "share"
    },
    {
      "TypeName": "clarity-editor",
      "Role": "Clarity Editor",
      "Prompt": "Read report at <path>. Review ALL tabs for jargon accessibility, information density, structural flow. Output JSON findings array.",
      "Workspace": "share"
    },
    {
      "TypeName": "consistency-auditor",
      "Role": "Consistency Auditor",
      "Prompt": "Read report at <path>. Review ALL tabs for cross-tab contradictions, terminology consistency, data consistency. Output JSON findings array.",
      "Workspace": "share"
    }
  ]
}

// Phase 2 (after reactive wakeup): Synthesize and apply
{
  "Subagents": [
    {
      "TypeName": "synthesist",
      "Role": "Synthesis Agent",
      "Prompt": "Merge findings from all 4 reviewers: <findings>. Deduplicate, resolve conflicts, apply critical and major fixes to <path>. Output change summary.",
      "Workspace": "share"
    }
  ]
}
```

### 4.2 §7 Language Proofreading Harness

**Purpose**: 4 proofreader lenses scan the report for grammar, spelling/terminology, loanword refinement, and style/tone issues. A merge pass applies all fixes.

**Recommended tier allocation**:

| Role | Claude Model | Gemini Model |
|------|-------------|--------------|
| Grammar Checker | `sonnet` | `gemini-3.7-flash` |
| Spelling + Terminology | `sonnet` | `gemini-3.7-flash` |
| Loanword Refinement | `sonnet` | `gemini-3.7-flash` |
| Style + Tone | `sonnet` | `gemini-3.7-flash` |
| Merge + Apply | `sonnet` | `gemini-3.7-flash` |

> Language proofreading is less reasoning-intensive than content verification, so `sonnet`/`gemini-3.7-flash` is sufficient even for the merge step.

**Claude Code — Parallel Dispatch (single turn)**:

```
// Phase 1: Dispatch all 4 proofreaders in parallel
Agent(description = "§7 Grammar check",     prompt = "You are a Grammar proofreader...\n\nScan report: <path>\nCheck grammar, agreement, tense. Output JSON findings.", subagent_type = "claude", model = "sonnet")
Agent(description = "§7 Spelling check",    prompt = "You are a Spelling+Terminology proofreader...\n\nScan report: <path>\nCheck spelling, tech terms, acronyms. Output JSON findings.", subagent_type = "claude", model = "sonnet")
Agent(description = "§7 Loanword check",   prompt = "You are a Loanword Refinement proofreader...\n\nScan report: <path> using references/loanword-refinements.json. Output JSON findings.", subagent_type = "claude", model = "sonnet")
Agent(description = "§7 Style+Tone check", prompt = "You are a Style+Tone proofreader...\n\nScan report: <path> for tone consistency, register, voice. Output JSON findings.", subagent_type = "claude", model = "sonnet")

// Phase 2 (after all return): Merge and apply
Agent(description = "§7 Merge proofreading findings and apply",
       prompt = "Merge these proofreading findings:\n<findings-1..4>\n\nApply all fixes to <path>. Output change summary.",
       subagent_type = "claude",
       model = "sonnet")
```

**Gemini CLI / Antigravity — Parallel Dispatch**:

```json
// Define phase (once per session)
// define_subagent: "grammar-checker", "spelling-checker", "loanword-checker", "style-checker", "proofreader-merger"

// Phase 1: Invoke all 4 proofreaders in parallel
{
  "Subagents": [
    {
      "TypeName": "grammar-checker",
      "Role": "Grammar Checker",
      "Prompt": "Scan report at <path>. Check grammar, subject-verb agreement, tense consistency. Output JSON findings.",
      "Workspace": "share"
    },
    {
      "TypeName": "spelling-checker",
      "Role": "Spelling + Terminology",
      "Prompt": "Scan report at <path>. Check spelling, technical term capitalization, acronym consistency. Output JSON findings.",
      "Workspace": "share"
    },
    {
      "TypeName": "loanword-checker",
      "Role": "Loanword Refinement",
      "Prompt": "Scan report at <path>. Use references/loanword-refinements.json to replace unnecessary foreign borrowings. Output JSON findings.",
      "Workspace": "share"
    },
    {
      "TypeName": "style-checker",
      "Role": "Style + Tone",
      "Prompt": "Scan report at <path>. Check tone consistency, register formality, passive/active voice balance. Output JSON findings.",
      "Workspace": "share"
    }
  ]
}

// Phase 2 (after reactive wakeup): Merge and apply
{
  "Subagents": [
    {
      "TypeName": "proofreader-merger",
      "Role": "Proofreading Merger",
      "Prompt": "Merge findings from all 4 proofreaders: <findings>. Deduplicate, resolve conflicts, apply fixes to <path>. Output change summary.",
      "Workspace": "share"
    }
  ]
}
```

### 4.3 §7.5 SVG Specialist Designer

**Purpose**: A single specialist subagent creates or verifies inline SVG diagrams for the report — comparison heatmaps, process flow diagrams, architecture diagrams, or data visualizations.

**Recommended tier allocation**:

| Role | Claude Model | Gemini Model |
|------|-------------|--------------|
| SVG Designer | `sonnet` | `gemini-3.7-flash` |

> SVG creation is a focused task that benefits from a single specialist rather than parallel dispatch. The designer receives the report section context and produces a self-contained inline SVG string.

**Claude Code — Single Dispatch**:

```
Agent(
  description   = "§7.5 SVG diagram — create process flow diagram",
  prompt        = "You are an SVG Specialist Designer for the explain-me report (BUILD_GUIDE.md §7.5).\n\nTask: Create an inline SVG diagram for the 'Architecture Overview' section of the report at <path>.\n\nRequirements:\n- Self-contained: no external resources, no <img> tags, no data URIs\n- Responsive: use viewBox, no fixed width/height on outer <svg>\n- Accessible: include <title> and <desc> elements\n- Theme-aware: use CSS custom properties (--color-primary, --color-bg, etc.) matching the report theme\n- Label all elements clearly\n- Maximum 200x200 viewBox for small diagrams, 600x400 for complex ones\n\nContext section (for diagram content):\n<section-text>\n\nOutput the complete <svg>...</svg> string ready to insert into the report HTML.",
  subagent_type = "claude",
  model         = "sonnet"
)
```

**Gemini CLI / Antigravity — Single Dispatch**:

```json
// Define (once per session)
// define_subagent: "svg-designer" with system_prompt for SVG specialist role

// Invoke
{
  "Subagents": [
    {
      "TypeName": "svg-designer",
      "Role": "SVG Specialist Designer",
      "Prompt": "Create an inline SVG diagram for the 'Architecture Overview' section of the report at <path>. Requirements: self-contained, no external resources, viewBox-based, accessible (<title>/<desc>), theme-aware CSS custom properties, clearly labeled. Output the complete <svg>...</svg> string.",
      "Workspace": "share"
    }
  ]
}
```

**SVG Verification Pass** (after creation):

```
// Verify the SVG was inserted correctly and renders
Agent(
  description   = "§7.5 SVG verification",
  prompt        = "Verify the SVG diagram in the report at <path>:\n1. Confirm <svg> tag is present and well-formed\n2. Confirm viewBox is set (no fixed width/height on outer element)\n3. Confirm <title> and <desc> exist for accessibility\n4. Confirm no external resource references (<img>, external CSS, data URIs)\n5. Confirm CSS custom properties reference the report theme variables\n6. Open in browser and confirm it renders correctly\n\nOutput: PASS or FAIL with details.",
  subagent_type = "claude",
  model         = "haiku"
)
```

---

## Quick Reference: Tier-to-Model Cheat Sheet

| Tier | Claude Alias | Claude Registry ID | Gemini Model ID |
|------|-------------|-------------------|-----------------|
| **High** | `"opus"` | `claude-opus-5-0` | `gemini-3.1-pro` |
| **Medium** | `"sonnet"` | `claude-sonnet-5-0` | `gemini-3.7-flash` |
| **Low** | `"haiku"` | `claude-haiku-4-5` | `gemini-3.7-flash` |
