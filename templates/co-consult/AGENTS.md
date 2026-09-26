# AGENTS.md

**co-consult Variant Agent Ecosystem**

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

This document is the **Single Source of Truth (SSOT)** for the agent ecosystem, individual agent definitions, PM Gateway workflow, and execution plan templates.

---

## §1: Agent Ecosystem Overview

### 🎯 Agent Roster (Roles Overview)

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | Medium | Orchestrates team assembly (Phase 0), design validation (Phase 1-2), and lifecycle finalization (Phase 5). **PM does NOT execute code or documentation directly — all specialist work dispatched through PM.** |
| **I18N Specialist Agent** | [`agents/i18n-specialist.md`](agents/i18n-specialist.md) | Medium | Locale documentation — translation zones, language-policy enforcement, Korean plain-language output. |

<!-- VARIANT-AGENTS-START -->
| **change-management-partner** | [`agents/change-management-partner.md`](agents/change-management-partner.md) | Medium | Organizational transformation and stakeholder alignment specialist |
| **communications-lead** | [`agents/communications-lead.md`](agents/communications-lead.md) | Medium | Client-facing communications and strategic narrative producer |
| **data-analyst** | [`agents/data-analyst.md`](agents/data-analyst.md) | Medium | Statistical analysis, data modeling, and business insights specialist |
| **delivery-manager** | [`agents/delivery-manager.md`](agents/delivery-manager.md) | Low | Project delivery and operations coordination specialist |
| **industry-expert** | [`agents/industry-expert.md`](agents/industry-expert.md) | High | Industry-specific insights and competitive dynamics specialist |
| **sme** | [`agents/sme.md`](agents/sme.md) | Medium | Functional expertise and solution design specialist |
| **solutions-architect** | [`agents/solutions-architect.md`](agents/solutions-architect.md) | Medium | Technical solution design and implementation planning specialist |
| **strategy-analyst** | [`agents/strategy-analyst.md`](agents/strategy-analyst.md) | Medium | Market analysis, competitive research, and strategic assessment lead |
| **technology-specialist** | [`agents/technology-specialist.md`](agents/technology-specialist.md) | Low | Collaboration platforms and digital transformation support specialist |
| **workstream-lead** | [`agents/workstream-lead.md`](agents/workstream-lead.md) | Medium | Workstream management and delivery coordination lead |
<!-- VARIANT-AGENTS-END -->
---

## §2: Individual Agent Definitions

See [`agents/pm.md`](agents/pm.md) for the PM Agent full definition.

<!-- VARIANT-AGENT-DETAILS-START -->
### change-management-partner

| Field | Value |
|-------|-------|
| **File** | [`agents/change-management-partner.md`](agents/change-management-partner.md) |
| **Tier** | medium |
| **Phases** | 1, 2 |
| **Role** | Organizational transformation and stakeholder alignment specialist |

### communications-lead

| Field | Value |
|-------|-------|
| **File** | [`agents/communications-lead.md`](agents/communications-lead.md) |
| **Tier** | medium |
| **Phases** | 3 |
| **Role** | Client-facing communications and strategic narrative producer |

### data-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/data-analyst.md`](agents/data-analyst.md) |
| **Tier** | medium |
| **Phases** | 1, 3 |
| **Role** | Statistical analysis, data modeling, and business insights specialist |

### delivery-manager

| Field | Value |
|-------|-------|
| **File** | [`agents/delivery-manager.md`](agents/delivery-manager.md) |
| **Tier** | low |
| **Phases** | 4 |
| **Role** | Project delivery and operations coordination specialist |

### industry-expert

| Field | Value |
|-------|-------|
| **File** | [`agents/industry-expert.md`](agents/industry-expert.md) |
| **Tier** | high |
| **Phases** | 1, 2 |
| **Role** | Industry-specific insights and competitive dynamics specialist |

### sme

| Field | Value |
|-------|-------|
| **File** | [`agents/sme.md`](agents/sme.md) |
| **Tier** | medium |
| **Phases** | 1, 2, 3 |
| **Role** | Functional expertise and solution design specialist |

### solutions-architect

| Field | Value |
|-------|-------|
| **File** | [`agents/solutions-architect.md`](agents/solutions-architect.md) |
| **Tier** | medium |
| **Phases** | 3 |
| **Role** | Technical solution design and implementation planning specialist |

### strategy-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/strategy-analyst.md`](agents/strategy-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Market analysis, competitive research, and strategic assessment lead |

### technology-specialist

| Field | Value |
|-------|-------|
| **File** | [`agents/technology-specialist.md`](agents/technology-specialist.md) |
| **Tier** | low |
| **Phases** | 4 |
| **Role** | Collaboration platforms and digital transformation support specialist |

### workstream-lead

| Field | Value |
|-------|-------|
| **File** | [`agents/workstream-lead.md`](agents/workstream-lead.md) |
| **Tier** | medium |
| **Phases** | 4 |
| **Role** | Workstream management and delivery coordination lead |
<!-- VARIANT-AGENT-DETAILS-END -->
---

## §3: PM Gateway Workflow

**Thin-dispatcher section (ADR-0090)**: full phase protocol and ADR policy summaries → [`docs/governance/agents/pm-gateway-workflow.md`](docs/governance/agents/pm-gateway-workflow.md).

### §3.6 3-Tier Strategy

<!-- WORKSPACE-MANAGED: tier-model-mapping -->
- **High-tier**: Complex reasoning, architectural design, planning (claude-opus-5-0 / gemini-3.1-pro / gpt-5.6-sol)
- **Medium-tier**: Code review, testing, PR review, quality gates (claude-sonnet-5-0 / gemini-3.8-flash / gpt-5.6-terra)
- **Low-tier**: Fast, repetitive coding, script maintenance (claude-haiku-4-5 / gemini-3.8-flash / gpt-5.6-luna)
<!-- /WORKSPACE-MANAGED -->

<!-- WORKSPACE-MANAGED: tier-model-mapping -->
> **Note**: The `Model` column below shows the Claude Code short alias (`sonnet`/`opus`/`haiku`/`fable`) actually passed to the `Agent()` tool's `model` parameter — not the registry ID (e.g. `claude-sonnet-5-0`). See [CLAUDE.md §6](CLAUDE.md#6-native-sub-agents-agent-tool) for the registry-ID → alias translation table. On Gemini/Antigravity, use the literal model ID instead (see GEMINI.md's equivalent example).
<!-- /WORKSPACE-MANAGED -->




**Integrated from pm.md, CLAUDE.md §5, GEMINI.md §5**

### §3.5 Phase Determination (Deliverable-Type Gate)

Before assigning an agent to any task, PM MUST classify the deliverable type:

| Deliverable Type | Phase | Required Agent | Tier | Notes |
|------------------|-------|----------------|------|-------|
| New file design, schema definition, ADR | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| New directory structure, template layout | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| Cross-platform convention, naming standard | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| Script/tool implementation (approved plan exists) | Phase 4 | `[implementation specialist]` | Low–Medium | Plan from design specialist required |
| Documentation update | Phase 4 | `[docs specialist]` | Medium | |
| Documentation writing | Phase 4 | `[docs specialist]` | Medium | |
| Security configuration | Phase 6 | `[security specialist]` | Medium | |
| Project setup | Phase 0 | pm | Low | PM handles initial setup directly |

<!-- VARIANT-PHASE-GATE-START -->
| Organizational transformation and stakeholder alignment specialist | Phase 1, 2 | `change-management-partner` | Medium | |
| Client-facing communications and strategic narrative producer | Phase 3 | `communications-lead` | Medium | |
| Statistical analysis | Phase 1, 3 | `data-analyst` | Medium | |
| Project delivery and operations coordination specialist | Phase 4 | `delivery-manager` | Low | |
| Industry-specific insights and competitive dynamics specialist | Phase 1, 2 | `industry-expert` | High | |
| Functional expertise and solution design specialist | Phase 1, 2, 3 | `sme` | Medium | |
| Technical solution design and implementation planning specialist | Phase 3 | `solutions-architect` | Medium | |
| Market analysis | Phase 1 | `strategy-analyst` | Medium | |
| Collaboration platforms and digital transformation support specialist | Phase 4 | `technology-specialist` | Low | |
| Workstream management and delivery coordination lead | Phase 4 | `workstream-lead` | Medium | |
<!-- VARIANT-PHASE-GATE-END -->

**Tier Ceiling Rule**: An agent's tier may NOT be elevated beyond its defined tier.

> **Execution Plan Boilerplate Policy**: For mandatory and discretionary boilerplate cases, see [§3 (PM Gateway Workflow)](AGENTS.md#3-pm-gateway-workflow) above.


### §3.8 Permission Denial Protocol

When a specialist agent's required tool is denied, PM must **not** substitute for the specialist. Instead:

1. Identify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

---


---


<!-- COMMON-AGENTS:START -->
## Language Policy

**Canonical home: [docs/context.md](docs/context.md)** (ADR-0090 W1b) — English-only rule, translation zones, Korean legal exception, plain-language preference, enforcement, Git/PR artifact language. **Read it before writing any documentation or commit message.**

### Pluggable Variant Audit Hooks and Integrity Protection
- **Core Script Standardization**: The core synchronization and validation scripts (`scripts/dev-sync.ts` and `scripts/audit.ts`) must remain standardized and identical across all templates and variants. Direct modification of these core scripts in L2 projects is strictly forbidden.
- **Variant-Specific Audit Hook**: Variant projects requiring custom verification checks must implement them in a pluggable hook script at the path declared in the variant's `variant.json` → `script_manifest` (conventionally `scripts/audit-variant.ts` or `scripts/<variant>/audit-variant.ts`).
- **Integrity Enforcement**: During template reconciliation (`l3-to-variant-pipeline.ts`), any modified core scripts will be automatically detected and will fail the reconciliation.

### Universal Design Gate (ADR-0074)

Every code change at any tier (L0–L3) must carry spec activity: create/update a design doc at `docs/designs/<spec-id>-design.md` and register it (`bun scripts/spec-register.ts --file <design-doc> --source manual --status implemented`) before `/sync`. The sync-time spec-check (`audit.ts --spec-check`, dev-sync step 3.9) blocks commits without it; trivial changes use `--spec-exempt=E1..E5` (AGENTS.md §5.1.1). Project registries (`docs/specs/registry.json`) are add-if-missing seeds — upgrades never overwrite or prune project entries.

### LLM Work Routing Policy (ADR-0078)

Substantive LLM-assisted development work — generation or modification of code, documents, designs, tests, or scripts — MUST be routed through this project's agent team: `user → PM triage → Design Gate (unless exempt) → specialist dispatch → QA gate → /sync PR`. Querying an external LLM directly (e.g. a web chat) and landing its output in this repository is a policy violation. IDE inline completions and one-off Q&A that never land in the repository are exempt; repository-landing work uses the E1–E5 exemption codes only. An application calling LLM APIs at runtime is an architecture concern covered by the Design Gate (ADR-0074). Enforcement is structural via the existing hard gates — see ADR-0078 (workspace root, `docs/adr/0078-agent-mediated-llm-work-routing.md`) for the full decision.

### Instruction Writing Standard (ASD-STE100, ADR-0079)

Development-facing instruction text — requirement statements, task briefs, execution-plan task descriptions, agent dispatch prompts, design-doc requirement sections, API endpoint documentation, and how-to steps — follows ASD-STE100 (Simplified Technical English) structural rules, in every development domain (web, app, API, scripts, documents). Rules: one instruction per sentence (≤ 20 words procedural / ≤ 25 descriptive); active voice with imperative steps; present tense; one term = one meaning (use glossary/registry terms exactly); no idioms; positive phrasing preferred; minimal pronouns; lists for parallel items and tables for structured data. The STE dictionary is not adopted. Enforcement is advisory: PM conforms task briefs at triage; architect checks requirement sections at Design Gate review. Full policy: §3.10 (workspace root AGENTS.md) and ADR-0079 (`docs/adr/0079-simplified-english-development-instructions.md`).

### PM Team-Management Authority (ADR-0080)

PM owns team composition and skill-change rulings. Hiring and firing: PM decides timing and target from workflow signals — recurring unmatched work types, role overload, absorbed roles, the quarterly roster review — and records every decision (ADR-0061 decision record + memory log) before dispatch; the default exit for a fired agent is `status: deprecated`, and hard delete requires an explicit user request. Skill requests: agents file structured `create|attach|remove` request blocks with evidence in their task reports and memory logs; PM triages them and only approved requests are executed — agents never create, attach, or remove skills unilaterally. Procedures: `agent-lifecycle-manager` and `skill-lifecycle-manager` skills. Full decision: ADR-0080 in the workspace root `docs/adr/`.
<!-- COMMON-AGENTS:END -->

## §4: Other Workflows

**Thin-dispatcher section (ADR-0090)**: dispatch protocol, role boundary matrix, and schedules → [`docs/governance/agents/workflows.md`](docs/governance/agents/workflows.md).

## §5: Execution Plan Templates

**Thin-dispatcher section (ADR-0090)**: governed by [`docs/governance/agents/execution-plan-templates.md`](docs/governance/agents/execution-plan-templates.md) — Read before writing any execution plan.

## §6: Skills

> **📌 VERSION_MANIFEST is the Single Source of Truth (SSOT)**
>
> All skill versions, status, and lifecycle metadata are maintained in [`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md).
> The table below provides skill names and locations only. For current versions, status, and detailed metadata, always reference VERSION_MANIFEST.
>
> **Skill structure specification**: See [docs/context.md](docs/context.md) for frontmatter format and session skill registration.

> **`owner` field definition**: The `owner` field in `SKILL.md` frontmatter identifies the **maintainer responsibility** for that skill — the agent or role accountable for keeping the skill current. It does NOT require that agent to exist in the current project, and does NOT mean that agent is the only one who can invoke the skill.

### Skill Resolution Priority

When a user request matches a skill trigger, apply this priority order — **enforced every session, regardless of platform**:

| Priority | Source | Location | Purpose |
|----------|--------|----------|---------|
| **1 (highest)** | Workspace-level skills | `skills/<name>/SKILL.md` in the workspace root | Core workspace functionality (scaffolding, validation, security, audit) |
| **2** | Platform config skills | `.claude/skills/` or `.gemini/skills/` in the project root | Platform-specific hooks, commands, and lifecycle management |
| **3 (lowest)** | Global plugin skills | e.g., `superpowers/brainstorming`, `superpowers/writing-plans` | General-purpose development workflows |

**Location Rules**:
- **Canonical source**: `skills/<name>/SKILL.md` (priority 1) is the single source of truth for skill content. Edits are made there, never directly in a mirror.
- **Variant-specific skills are mirrored, not duplicated content**: any skill declared in `variant.json`'s `skill_manifest.variant_specific` is intentionally mirrored byte-for-byte into `.claude/skills/<name>/` and `.gemini/skills/<name>/` for platform-native discovery — `scripts/validate-templates.ts` requires this mirror to exist for every `skill_manifest.variant_specific` entry. This is not "cross-duplication" in the sense of divergent content; it's a required propagation step, kept in sync with the `skills/` source.
- **True platform-only skills**: `.claude/skills/` and `.gemini/skills/` may also contain skills that exist ONLY there (not in `skills/`) — reserved for platform-specific hooks, commands, and lifecycle tools that genuinely differ between Claude Code and Gemini CLI (e.g. `finishing-a-development-branch`, `platform-command-lifecycle-manager`).

**Resolution Rule**: If a higher-priority skill's `metadata.triggers` matches the user request, use it — do **not** fall through to lower-priority skills with overlapping intent.

**Canonical conflict example — meeting vs. brainstorming**:

| User says | Correct skill | Priority |
|-----------|--------------|----------|
| "meeting", "facilitate", "agent discussion" | `skills/meeting-facilitation` | 1 |
| "brainstorm", "design before coding", "explore options" | `superpowers/brainstorming` | 3 |

When ambiguous, prefer the higher-priority (workspace-level) skill and confirm intent with the user.
Explicit invocation: `/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]`

### Platform Skills Registry

| Skill | Location | Purpose |
|-------|----------|---------|
| **Agent Lifecycle Manager** | `.claude/skills/agent-lifecycle-manager/SKILL.md` | Managing agent lifecycle, creating/retiring agents, validation |
| **HWP Document Processing** | `skills/hwp-document-processing/SKILL.md` | Structural validation of HWP government-template deliverables |
| **Sample-Driven Report Writing** | `skills/sample-driven-report-writing/SKILL.md` | Analyzes a deliverable sample for TOC structure + per-section table/chart requirements, then researches and drafts to match |
| **K-DART** | `skills/k-dart/SKILL.md` | Korean FSS DART OpenAPI queries — disclosures, financials, company profiles, major-event reports (KR profile; common skill, deploys only to --country KR projects) |
| **K-Law** | `skills/k-law/SKILL.md` | Korean Ministry of Legislation National Law Information Center Open API queries (KR profile; common skill, deploys only to --country KR projects; referenced through `docs/countries/KR.md`) |

---


## §7: Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:

- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".
- **Conflicting Instructions**: If a user request violates project rules (e.g., bypassing tests), warn the user and request explicit confirmation before proceeding.
- **Coding Standards**: Follow SOLID principles. Write unit tests when creating functional code. No speculative abstractions.
- **Language**: All code, config, commit messages, and branch names - **English only**.
- **UTF-8 Enforcement**: Always use UTF-8 encoding; prevent CP949 or other localized encoding corruptions.
- **File Organization**: Never create `.md` files at the project root unless explicitly creating a standard root file (README.md, CHANGELOG.md, AGENTS.md, SECURITY.md). Place analysis and reports in `docs/`, session logs and meeting transcripts in `memory/`. Create all temporary code and scratch scripts in `tests/`.
- **Search Tool Prioritization**: Prioritize MCP semantic search tools for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.
- **Source Attribution**: When presenting research findings, external data, or factual claims, always cite the source using `[Source: URL/document]` inline or a `## References` section. If a source cannot be verified, explicitly mark it as `⚠️ Unverified` and recommend manual verification. Never present unverified information as established fact.
- **Computational Integrity**: Never perform high-precision or safety-critical numerical calculations directly. For aerospace, aviation, precision control, or regulated financial computations, delegate to a validated external tool (Fortran, Python+NumPy/SciPy, Julia, etc.). If the tool is missing, request installation through the PM — **never install tools without security review and explicit user approval**. Label any AI-generated numerical estimate explicitly as **approximate**. For all other reported numbers (aggregations, statistics, percentages, metrics), compute via executed code (bun/TypeScript scripts) — never by mental arithmetic.

---

## §8: Lifecycle Management

### Phase 5 Lifecycle Finalization

At **Phase 5 (Lifecycle Finalization)**, PM **must** execute finalization when any of the following occurred in the session:

| Trigger | Dispatch lifecycle-manager? |
|---------|---------------------------|
| Agent added, modified, or deprecated | ✅ Yes |
| Skill added, modified, or deprecated | ✅ Yes |
| Script status changed in SCRIPTS.md | ✅ Yes |
| Variant status changed (draft→beta, beta→stable, etc.) | ✅ Yes |
| Governance tool updated (audit.ts, validate-templates.ts, etc.) | ✅ Yes |
| `.claude/commands/*.md` or `.gemini/commands/*.md` added or removed | ✅ Yes |
| `.claude/skills/*/SKILL.md` or `.gemini/skills/*/SKILL.md` added or modified | ✅ Yes |
| `templates/common/.claude/` or `templates/common/.gemini/` structure changed | ✅ Yes |
| `common-contract.json` or `docs/templates/*.json` governance files modified | ✅ Yes |
| README/documentation-only changes | ❌ No |
| Memory log entries only | ❌ No |

PM will produce either a **"no drift" confirmation** or a **drift report + governance document updates**.

PM does NOT execute finalization updates for: pure documentation changes (body text only), README updates, memory log entries, or changes that do not affect lifecycle-tracked artifacts.

> **For Agent Lifecycle procedures**: See [docs/context.md](docs/context.md) for detailed lifecycle procedures.

---


## §9: Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification in [docs/context.md](docs/context.md).
5. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification in [docs/context.md](docs/context.md).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per [docs/context.md](docs/context.md).

---

## §10: Periodic Skill Review Schedule

**Frequency**: Quarterly (every 3 months)  
**Owner**: pm  
**Tool**: `bun scripts/skill-dependency-analysis.ts --report`

### Review Cadence

| Quarter | Target Month | Scope |
|---------|-------------|-------|
| Q1 | March | All active skills — full health report |
| Q2 | June | All active skills — full health report |
| Q3 | September | All active skills — full health report |
| Q4 | December | All active skills — full health report + deprecation sweep |

### Review Steps

1. **Generate health report**
   ```
   bun scripts/skill-dependency-analysis.ts --report
   bun scripts/validate-skills.ts
   ```

2. **Triage findings** by severity:
   - 🔴 Broken dependencies or circular references → fix before quarter ends
   - 🟡 Deprecated dependency usage → fix within 2 weeks
   - 🟢 Wording or example improvements → batch in next release cycle

3. **Apply modifications** following the review and triage steps defined inline in this section (§10)

4. **Update governance records** in `docs/lifecycle/skills/<name>.md` for every skill modified

5. **Deprecation sweep** (Q4 only): review skills with `last_updated` older than 12 months — evaluate whether they remain relevant or should be deprecated

6. **Log results** in the quarterly memory log: `memory/YYYY-MM-DD.md` with `## Skill Review Q[N] YYYY` heading

### Trigger Conditions (Outside Quarterly Cadence)

A skill health check should also be run outside the quarterly schedule when:
- A tool, agent, or script referenced by any skill is renamed or removed
- A new skill is added that may introduce dependency cycles
- CI reports skill validation failures on any branch

---

## Version History

- **v2.0.0 (2026-06-09)**: Restructured as SSOT - Integrated PM Gateway workflow (§3), execution plan templates (§5), and renumbered existing sections. Consolidated duplicate content from pm.md, CLAUDE.md §5, GEMINI.md §5 into single source of truth.
- **v1.x**: Previous versions maintained agent roster and individual definitions without PM Gateway integration

<!-- WORKSPACE-MANAGED: graft repo context graph -->
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
<!-- /WORKSPACE-MANAGED -->
