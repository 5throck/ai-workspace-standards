# AGENTS.md

**co-price Variant Agent Ecosystem**

> **⚠️ For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles (PM, Architect, CPA Auditor, etc.) for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI), or `.gemini/` / `.claude/` settings.

This document is the **Single Source of Truth (SSOT)** for the co-price agent ecosystem:
roster registry, PM Gateway workflow, dispatch rules, and role boundaries.
Detailed personas live in [`agents/*.md`](agents/); reusable workflows in [`skills/`](skills/).

---

## §1: Agent Ecosystem Overview

15 agents across five groups (`variant_type: consulting`). Every specialist accepts work
**only** via PM dispatch — the flat PM Gateway has no exceptions.

### Agent Roster

| Agent | File | Tier | Subdomain | Role |
|-------|------|------|-----------|------|
| **I18N Specialist Agent** | [`agents/i18n-specialist.md`](agents/i18n-specialist.md) | Medium | i18n | Locale documentation — translation zones, language-policy enforcement, Korean plain-language output. |
| **PM — Pricing Consulting Orchestrator** | [`agents/pm.md`](agents/pm.md) | Medium | orchestration | Runs the build lifecycle (5-phase) and consulting engagement lifecycle; sole dispatcher; enforces Harness order and PR-only sync |

<!-- VARIANT-AGENTS-START -->
| **Finance Strategy & Channel Lead** | [`agents/finance-strategy-lead.md`](agents/finance-strategy-lead.md) | High | strategy | Multi-industry pricing/P&L LaTeX spec authorship — revenue engine, waterfall, dual pricing, discount timing, scorecard weights — margin floors & price-waterfall governance |
| **Cost & Asset Management** | [`agents/cost-asset-mgmt.md`](agents/cost-asset-mgmt.md) | High | cost | OPEX/CAPEX, depreciation schedules, BOM cost roll-ups, labor scaling, raw-material shock bands |
| **P&L Engine Auditor (CPA)** | [`agents/cpa-auditor.md`](agents/cpa-auditor.md) | High | audit | Double-entry integrity (A=L+E $0.00), `[Ref:]`-tagged Vitest harness, Harness Pass Certificates — exception log & double-entry guardrails |
| **Pricing Strategist** | [`agents/pricing-strategist.md`](agents/pricing-strategist.md) | High | strategy | Applies diagnostics/elasticity to F/T/S recommendations, discount ladders, price corridors — ledger-traced figures only — discount governance, corridors, MAP stance |
| **Market Intelligence Analyst** | [`agents/market-intelligence-analyst.md`](agents/market-intelligence-analyst.md) | High | research | Benchmarks curation, competitor prices, VW/GG survey analytics, provenance discipline — TPM ROI gates (stage 8) |
| **Engagement Director** | [`agents/engagement-director.md`](agents/engagement-director.md) | High | delivery | Diagnose→Design→Validate→Deliver orchestration; deliverable register; human approval gates — channel strategy & Deal Desk process, governance cadence |
| **Lead Architect & Data Guard** | [`agents/lead-architect.md`](agents/lead-architect.md) | High | architecture | Prisma modeling, v10.1 batch schema design, migration safety, AI-infrastructure contracts |
| **Core Engine Developer** | [`agents/core-engine-dev.md`](agents/core-engine-dev.md) | High | engine | BIZ_LOGIC → drift-free TypeScript engine modules + on-rails AI transport implementation |
| **Security Auditor** | [`agents/security-auditor.md`](agents/security-auditor.md) | High | security | Zod guardrails, API boundary audits, PRICE_* env schema, prompt-injection defenses |
| **UX & Visual Specialist** | [`agents/ux-specialist.md`](agents/ux-specialist.md) | High | interface | Onyx 2.0 components, v10.1 surfaces, copilot panel, bilingual user guides — Governance tab / policy UI surfaces |
| **Global Strategy & L10N Auditor** | [`agents/l10n-auditor.md`](agents/l10n-auditor.md) | Medium | localization | 16-locale parity, glossary adherence, RTL safety |
| **Security Monitor** | [`agents/security-monitor.md`](agents/security-monitor.md) | Medium | monitoring | Vuln/advisory scans, gitleaks, findings register, dependency policy |
| **End-to-End QA Engineer** | [`agents/qa-tester.md`](agents/qa-tester.md) | High | testing | Component mounting, browser assertions, streaming-state checks |
| **DevOps & CI/CD Admin** | [`agents/devops-admin.md`](agents/devops-admin.md) | High | infrastructure | bun toolchain, Docker stages, git hooks, deploy standards |
<!-- VARIANT-AGENTS-END -->

## §2: Individual Agent Definitions

Each file under [`agents/`](agents/) carries schema-compliant frontmatter
(`status`, 4-platform `tier`, `version`, `lifecycle`) and the golden section structure:
Role / Responsibilities / Output Format / Non-Negotiable Boundaries / Three-Stage Review /
⚠️ PM-ONLY INVOCATION / Constraints.

<!-- VARIANT-AGENT-DETAILS-START -->
| Group | Agents |
|-------|--------|
| Lead & Coordination | `pm` |
| Financial Intelligence Group | `finance-strategy-lead`, `cost-asset-mgmt`, `cpa-auditor`, `pricing-strategist`, `market-intelligence-analyst`, `engagement-director` |
| Technical Architecture & Dev Group | `lead-architect`, `core-engine-dev`, `security-auditor` |
| UX & Visualization Group | `ux-specialist`, `l10n-auditor` |
| Quality & Infrastructure Group | `security-monitor`, `qa-tester`, `devops-admin` |

Validation: run workspace validators against this roster after any change
(`bun scripts/validate-agents.ts Projects/co-price` from the ai_workspace root).
<!-- VARIANT-AGENT-DETAILS-END -->

## §3: Engineering Workflows

### Harness Engineering Workflow (non-negotiable order)

1. **Specs to LaTeX (`docs/biz_logic.md`)**: all business rules finalized as formulas first.
2. **Tests (`[Ref: BIZ_LOGIC.Section_X]`)**: Vitest blocks tagged to the section they verify,
   authored red before implementation goes green.
3. **Code Implementation (`src/lib/*`)**: `core-engine-dev` implements with `mathjs` wrappers.
4. **Verification Skill (`skills/harness-verification/SKILL.md`)**: `cpa-auditor` issues a
   Harness Pass Certificate.
5. **Localization Skill (`skills/i18n-audit/SKILL.md`)**: `l10n-auditor` proves 16-locale parity.

*All structural changes pass `bun run test` before Git synchronization.*

### Commercial Operating Cycle (business loop — runs alongside the build lifecycle)

The 8-step closed loop for distribution/pricing/promotion strategy & execution. SSOT:
[`docs/co-price.context.md → Commercial Operating Cycle`](docs/co-price.context.md).
PM orchestrates; `engagement-director` owns stage gates; stage-8 output feeds stages
0–2 of the next cycle.

Governance layer (policy → rules → SOP, owned by existing roster agents — no new agent
files): `docs/channel-pricing-promotion-policy.md`, `docs/pricing-governance-rules.md`,
`docs/commercial-operating-manual.md`.

```
0 Objectives & Constraints → 1 Diagnose → 2 Select → 3 Allocate
   → [4 Terms Design | 5 Price Path Design] → 6 Validate → 7 Execute → 8 Review ─┐
◄──────────────────────────────────────────────────────────────────────┘
```

<!-- VARIANT-PHASE-GATE-START -->
### Dual Lifecycle Phase Gates

**Build lifecycle (AIG 5-phase)**

| Phase | Gate to advance |
|---|---|
| 1. Triage & Strategy | parallel finance/cost analysis complete |
| 2. Technical Design | user approval recorded (mandatory for DB/core changes) |
| 3. Implementation Chain | engine → UI, serial, no file-lock conflicts |
| 4. Verification & Audit | cpa + security-auditor + l10n (+ qa after UI) all PASS |
| 5. Finalization | memlog written, CHANGELOG updated, `/sync` PR opened |

**Consulting engagement lifecycle**

| Stage | Exit criteria |
|---|---|
| Diagnose | diagnostics + market intel complete, ledger IDs issued |
| Design | strategy options drafted with guardrail citations |
| Validate | simulation scenarios green + Harness Pass Certificate |
| Deliver | human approval entry per artifact; disclaimers verified |

Stage advances require `engagement-director` sign-off and are logged in the engagement
state file. Client-facing export additionally requires explicit user approval.

**Commercial Operating Cycle gates** (business loop — see §3 diagram)

| Stage | Entry condition | Owner | Artifact |
|---|---|---|---|
| 0 | Objectives & Constraints | user objective + budget cap recorded | pm | goal declaration |
| 1 | Diagnose | CompetitorPrice/Survey sample ≥ minimum | market-intelligence-analyst | ledger-registered diagnostic report |
| 2 | Select | scorecard re-scored | pricing-strategist (review) | portfolio decision |
| 3 | Allocate | capacity & mixRatio constraints met | core-engine-dev (verify) | allocation table |
| 4 | Terms Design | wholesaleParamsSchema pass | finance-strategy-lead | TradeTerm draft |
| 5 | Price Path | consumerParamsSchema pass | pricing-strategist | ConsumerPricePlan draft |
| 6 | Validate | tri-view approved (**user gate**) | cpa-auditor | approved snapshot pair |
| 7 | Execute | paths injected + settlement mode set | engagement-director | active policies |
| 8 | Review | netROI(8w) + classification + re-score | engagement-director | review memo → next cycle 0–2 |

Stage-8 output is a **mandatory input** to stages 0–2 of the following cycle —
closing this loop is what distinguishes TPO from decorated guesswork.
<!-- VARIANT-PHASE-GATE-END -->

### Governance Operating Model (policy → rules → manual → agents)

The three governance docs are owned and operated by existing roster agents (no new
agent files). This closes the audit gaps (Deal Desk, TPM pre-approval, CFO guardrails,
MAP enforcement, governance cadence):

| Governance concept | Owning agent(s) | Source doc |
|---|---|---|
| Channel strategy & rules of engagement | `engagement-director` | policy §3, manual stages 0/7 |
| Pricing architecture (corridors, fences, MAP stance) | `pricing-strategist` | policy §4, rules §2/§7 |
| Margin & waterfall (floors, cost-to-serve) | `finance-strategy-lead` | policy §4, rules §6 |
| Trade promotion ROI gates (stage 6/8) | `market-intelligence-analyst` + `pricing-strategist` | policy §5, manual stage 8 |
| Exception / Deal Desk process | `engagement-director` + `cpa-auditor` (log) | rules §1/§5 |
| Guardrails (schema + double-entry) | `security-auditor` + `cpa-auditor` | rules §1, engine GUA-* |
| Governance cadence (weekly→annual) | `pm` (orchestrates) + `engagement-director` | policy §7, manual cadence |

Skills backing these: `pricing-governance`, `price-waterfall-analysis`,
`map-channel-enforcement` (registered in `variant.json → skill_manifest`).

### §3.6 3-Tier Strategy

When leading execution and improvement tasks, PM MUST use the 3-Tier model strategy:

<!-- WORKSPACE-MANAGED: tier-model-mapping -->
- **High-tier**: Complex reasoning, architectural design, planning (claude-opus-5-0 / gemini-3.1-pro / gpt-5.6-sol)
- **Medium-tier**: Code review, testing, PR review, quality gates (claude-sonnet-5-0 / gemini-3.8-flash / gpt-5.6-terra)
- **Low-tier**: Fast, repetitive coding, script maintenance (claude-haiku-4-5 / gemini-3.8-flash / gpt-5.6-luna)
<!-- /WORKSPACE-MANAGED -->

<!-- WORKSPACE-MANAGED: tier-model-mapping -->
> **Note**: The `Model` column below shows the Claude Code short alias (`sonnet`/`opus`/`haiku`/`fable`) actually passed to the `Agent()` tool's `model` parameter — not the registry ID (e.g. `claude-sonnet-5-0`). See [CLAUDE.md §6](CLAUDE.md#6-native-sub-agents-agent-tool) for the registry-ID → alias translation table. On Gemini/Antigravity, use the literal model ID instead (see GEMINI.md's equivalent example).
<!-- /WORKSPACE-MANAGED -->

## §4: PM Subagent Dispatch Protocol

<!-- VARIANT-SUBAGENT-ROSTER-START -->
### Parallel Research & Strategy (Read-Only)

| Subagent | Prompt file | Parallelizable | Write Allowed? |
|----------|-------------|:--------------:|:--------------:|
| `finance-strategy-lead` | `agents/finance-strategy-lead.md` | ✅ Always | ❌ No |
| `cost-asset-mgmt` | `agents/cost-asset-mgmt.md` | ✅ Always | ❌ No |
| `pricing-strategist` | `agents/pricing-strategist.md` | ✅ Analysis | ❌ No |
| `market-intelligence-analyst` | `agents/market-intelligence-analyst.md` | ✅ Research | ❌ No |
| `engagement-director` | `agents/engagement-director.md` | ✅ Planning | ❌ No |
| `lead-architect` (Design) | `agents/lead-architect.md` | ✅ Design only | ❌ No |

### Serial Execution & Verification (Write-Capable)

| Subagent | Prompt file | Parallelizable | Write Allowed? |
|----------|-------------|:--------------:|:--------------:|
| `core-engine-dev` | `agents/core-engine-dev.md` | ❌ Never (Serial) | ✅ Yes |
| `ux-specialist` | `agents/ux-specialist.md` | ❌ Never (Serial) | ✅ Yes |
| `security-monitor` | `agents/security-monitor.md` | ❌ After write | ✅ Yes (Findings) |
| `cpa-auditor` | `agents/cpa-auditor.md` | ❌ After write | ✅ Yes (Tests) |
| `security-auditor` | `agents/security-auditor.md` | ❌ After write | ✅ Yes (Schemas) |
| `l10n-auditor` | `agents/l10n-auditor.md` | ❌ After write | ✅ Yes (Locales) |
| `qa-tester` | `agents/qa-tester.md` | ❌ After UI write | ✅ Yes (Tests) |
| `devops-admin` | `agents/devops-admin.md` | ❌ Infrastructure | ✅ Yes (CI/CD) |
<!-- VARIANT-SUBAGENT-ROSTER-END -->

<!-- VARIANT-DISPATCH-TRIGGERS-START -->
### Dispatch Triggers

| Trigger phrases (examples) | Dispatch to |
|---|---|
| "design pricing strategy", "define P&L rules", "waterfall/dual-pricing spec" | `finance-strategy-lead` |
| "define depreciation", "fixed costs", "cost shock bands" | `cost-asset-mgmt` |
| "recommend a price", "discount ladder", "F/T/S guidance" | `pricing-strategist` |
| "competitor prices", "run Van Westendorp / Gabor-Granger", "benchmark check" | `market-intelligence-analyst` |
| "client engagement", "deliverable review", "scorecard session" | `engagement-director` |
| "design DB", "modify Prisma schema", "AI transport contracts" | `lead-architect` |
| "implement math logic", "build AI adapter", "engine module" | `core-engine-dev` |
| "create zod schemas", "audit API boundary", "copilot route guards" | `security-auditor` |
| "verify accounting logic", "check A=L+E", "harness certificate" | `cpa-auditor` |
| "build UI component", "style dashboard", "user guide update" | `ux-specialist` |
| "audit translations", "add locale strings", "glossary sync" | `l10n-auditor` |
| "scan secrets/advisories", "pre-PR security check" | `security-monitor` |
| "test UI", "E2E check", "streaming badge behavior" | `qa-tester` |
| "setup CI/CD", "Docker/hook changes", "bun pipeline" | `devops-admin` |
| "price waterfall", "pocket margin analysis", "leakage diagnostic" | `finance-strategy-lead` |
| "discount governance", "authority matrix", "exception log" | `pricing-strategist` |
| "MAP policy", "channel conflict", "3-strikes enforcement" | `pricing-strategist` + `security-auditor` |
| "promotion ROI gate", "TPM evaluation", "netROI review" | `market-intelligence-analyst` |
| "governance cadence", "weekly price review" | `engagement-director` |
<!-- VARIANT-DISPATCH-TRIGGERS-END -->

## §5: Agent Role Boundary Matrix

<!-- VARIANT-ROLE-BOUNDARY-START -->
| Task / Scenario | Use | Do NOT use |
|-----------------|-----|------------|
| Design Database Models (Prisma), AI-layer contracts, or overall architecture | `lead-architect` | `core-engine-dev` |
| Write Next.js UI components, CSS styling, or user guides | `ux-specialist` | `core-engine-dev` |
| Implement mathematical logic or AI transport in TypeScript | `core-engine-dev` | `cpa-auditor` |
| Verify TS logic precisely matches `biz_logic.md` formulas | `cpa-auditor` | `security-auditor` |
| Define P&L strategy or pricing business rules | `finance-strategy-lead` | `lead-architect` |
| Apply diagnostics into concrete price recommendations | `pricing-strategist` | `finance-strategy-lead` |
| Curate benchmarks, competitor data, VW/GG survey analysis | `market-intelligence-analyst` | `pricing-strategist` |
| Gate client-facing deliverables and engagement stages | `engagement-director` | `pm` (direct) |
| Audit Zod runtime guardrails or API boundary safety | `security-auditor` | `cpa-auditor` |
| Prevent secret leaks and enforce package policies | `security-monitor` | `security-auditor` |
| Verify translation keys across 16 locales and formatting | `l10n-auditor` | `ux-specialist` |
| Execute E2E UI tests, React component mounting checks | `qa-tester` | `cpa-auditor` |
| Configure Docker, GitHub Actions, hooks, or bun pipelines | `devops-admin` | `lead-architect` |
| Own distribution channel strategy / rules of engagement | `engagement-director` | `finance-strategy-lead` |
| Build/audit price waterfall & pocket margin | `finance-strategy-lead` | `pricing-strategist` |
| Define discount governance / authority matrix / exception log | `pricing-strategist` | `finance-strategy-lead` |
| Define MAP policy / channel-conflict enforcement | `pricing-strategist` | `security-auditor` |
<!-- VARIANT-ROLE-BOUNDARY-END -->

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
- **Single location requirement**: Workspace-level skills should exist **only** in `skills/` folder (priority 1). Do not duplicate these in `.claude/skills/` or `.gemini/skills/`.
- **Platform-specific skills**: `.claude/skills/` and `.gemini/skills/` are reserved for platform-specific hooks, commands, and lifecycle management tools that differ between Claude Code and Gemini CLI.
- **No cross-duplication**: Avoid duplicating the same skill across multiple locations. Choose the single most appropriate location based on the skill's purpose.

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

---


## §7: Universal Baseline Behaviors

All agents, regardless of role:

- **SOLID + tests**: functional code ships with unit tests; harness tags mandatory for math.
- **Security boundaries**: never expose or log secrets; no CI/CD edits without permission;
  `PRICE_*` keys never committed.
- **Communication**: concise markdown; explain *why*, not just *what*; conversational
  replies in Korean, code/docs/logs in English.
- **Conflicting instructions**: if a request violates project rules (e.g., bypassing
  tests), warn and require explicit confirmation before proceeding.

## Dynamic Roster Updates

**Phase 0 Kickoff authority**: the PM may expand this registry by creating new specialist
agents or skills when requirements demand it. Any new agent file must satisfy
`schemas/agent.schema.json` (workspace) and the golden section structure, and must be
registered here inside the `VARIANT-AGENTS` block.

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
