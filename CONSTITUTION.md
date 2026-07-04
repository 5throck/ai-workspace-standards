# Project Constitution

These principles apply to every project under the workspace root (the directory where you cloned this repository, e.g., `C:\git` or `~/git`). They define the **design standard** - implementation is handled per-project via each project's own scripts and settings.

---

## Required Reading

> **AI tools MUST load these files at session start** in addition to this document:
> - `docs/constitution/00-ssot-architecture.md` (SSOT 3-Layer Structure)
> - `docs/constitution/05-multi-agent-architecture.md`
> - `docs/constitution/08-coding-guidelines.md`
> - `docs/constitution/09-operations-workflow.md` (for PM and maintenance tasks)

---

### Workspace Overview

> **Workspace Root (Tier 1 SSOT)** - The workspace root is the directory where you cloned the repository. This is the **true source** and the ONLY place where core configurations, scripts, and agents should be edited. See [00-ssot-architecture.md](docs/constitution/00-ssot-architecture.md) for the 3-layer structural principles.
> If you clone to a new location, ensure you update any hardcoded paths in your local environment or platform config files (`CLAUDE.md`, `GEMINI.md`) if necessary.

This workspace contains multiple independent projects. Each subdirectory is a separate project/repository. Run `ls` (or `dir` on Windows) at the workspace root to see the current list - do not rely on a hardcoded list.

Common project types:
- MCP (Model Context Protocol) servers and tools
- Python-based CLI applications
- Web applications and demos

Each project directory contains its own `docs/context.md` as the authoritative description.

#### Working with Projects

Navigate to the project directory before starting work. Each project has its own build system (`package.json`, `pyproject.toml`, etc.), dependencies, testing framework, and development workflow (`bun scripts/dev-sync.ts`).

**Session start checklist / Context Loading** (run in order at the beginning of every session):

> **Tool-Specific Instructions:**
> - **Claude Code / CLI tools**: Read the files using your native file reading capabilities.
> - **Gemini / Web UI tools**: Use the `@` file reference syntax to load these into context.

0. **Forced Hook Activation**: Ensure automated PR-enforcement hooks are bound. Execute:
   ```bash
   git config core.hooksPath .githooks
   ```
1. **Workspace Standard**: Read this file (`CONSTITUTION.md`) or load `@CONSTITUTION.md`. (For the root workspace itself, this file ALSO serves as the `docs/context.md` SSOT).
2. **Project Context**: Read `docs/context.md` or load `@docs/context.md`. (Skip at workspace root, as `CONSTITUTION.md` covers it).
3. **Agent Roster**: Read `AGENTS.md` or load `@AGENTS.md`.
4. **Session History**: Read `memory/MEMORY.md` or load `@memory/MEMORY.md` (skip if file does not exist).
5. **Session Skills**: Load any skills listed under `## Session Start Skills` in `docs/context.md` (or `CONSTITUTION.md` for the root workspace). (For Gemini, load `@skills/`).

If `docs/context.md` does not exist (legacy or external project), fall back to `README.md` and any local `CLAUDE.md` or `GEMINI.md` in the project root.

For internationalization (i18n) work, also load the baseline translation reference (e.g. `@locales/en.json`).

#### General Development Notes

- Most projects use Python or JavaScript/TypeScript.
- Python projects use virtual environments (`.venv/`).
- Node.js projects use npm/yarn/pnpm for package management.
- Always check the project's `docs/context.md`, `CLAUDE.md`, and `GEMINI.md` for specific instructions.

---

## Terminology Definition

This section clearly defines hierarchy and distribution-related terms used in this document.

**Layer Structure** - Based on ADR-0031:

| Term | Definition | Description |
|------|------------|-------------|
| **L1** | templates/common | Common infrastructure layer - templates shared by all variants |
| **L2** | templates/co-* | Variant-specific layer - co-work, co-design, etc. |
| **L3** | Projects/* | Actual project layer - result of new project creation |

**Source and Distribution**:

| Term | Definition | Description |
|------|------------|-------------|
| **L0 Source** | workspace root | scripts/, agents/ reference point - original source code location |
| **Distribution Path** | workspace root → templates/common → templates/co-* | Path where L0 source is distributed to L1 and L2 |
| **Scaffolding** | templates/co-* → Projects/* | Copied from L2 to L3 for project creation |
| **workspace root** | Root directory containing L0 source | Git repository top-level directory |

**Reference Documents**:
- **ADR-0031 (L1-L2 Fork Model)**: L1 independent evolution, L2 scaffold-time delivery
- **ADR-0039 (L0→L1→L2 Hierarchy and Extends)**: Extends chain processing, L0→L1→L2 inheritance and governance

**Notes**:
- The "L0 → L1 → L2" expression refers to the **distribution path**, not the **layer structure**.
- The layer structure forms a static hierarchy as "L1 → L2 → L3".

---

### 1. Standard Folder Structure → [Full details](docs/constitution/01-folder-structure.md)

Every project follows a standard layout with `src/`, `docs/`, `scripts/`, `memory/`, `agents/`, `skills/`, `.github/`, `.claude/`, and `.gemini/` directories. Key rules: `docs/context.md` is mandatory for all projects, `scripts/` must be divided into Tier 1 (Shell) and Tier 2 (Bun/TS) according to their purpose, and ADRs use sequential 4-digit prefix naming (`0001-slug.md`) with mandatory Context/Decision/Consequences sections.

**Temporary Testing Artifacts (`tests/.temp/`)**: The `tests/.temp/` directory is the officially defined standard temporary directory for testing and simulation scratchpads. This folder MUST be ignored by Git. All automation scripts and tests should use this folder for temporary test artifacts and automatically clean it up.

---

### 2. Memory System → [Full details](docs/constitution/02-memory-system.md)

Every session that produces changes must be logged in `memory/YYYY-MM-DD.md` using the mandatory four-section format (Session Summary, Changes, Decisions, Open Issues). `CHANGELOG.md` is for product-facing changes (what), while `memory/` is for developer-facing documentation (how/why). Both must be in English. Archive when `MEMORY.md` exceeds ~50 rows: move older content to `docs/history.md` and `memory/archive/`.

---

### 3. GitHub PR Workflow → [Full details](docs/constitution/03-pr-workflow.md)

All changes reach `main` via Pull Request—never by direct push. The `/sync` pipeline enforces this: memlog → MEMORY.md → CHANGELOG → audit → branch → commit → push → PR. All Git artifacts (commits, PR titles/bodies, branch names, comments) must be in English. Follow Conventional Commits (`feat:`, `fix:`, `docs:`, etc.). Active branches follow pattern `pr/<YYYYMMDD-HHmmss>-<slug>`. Run `git config core.hooksPath .githooks` to bind pre-commit and pre-push hooks.

---

### 4. Internationalization (i18n) → [Full details](docs/constitution/04-i18n.md)

Apply only to projects with user-facing UI (web app, desktop app, CLI with messages). Pure API servers and libraries are exempt. Standard: 16 languages (`en` default, `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `pt`, `vi`, `ms`, `id`, `th`, `ru`, `it`, `ar` RTL). Translation files use flat JSON (`locales/<lang-code>.json`). Language detection: `APP_LOCALE` env var → OS locale → `en` fallback. All keys must exist in `en.json` as source of truth.

---

### 5. Multi-Agent Architecture → [Full details](docs/constitution/05-multi-agent-architecture.md)

Every project uses role-based agents defined in `agents/*.md` with YAML frontmatter (tier, model, color, description, examples). Three-tier cost optimization: High-tier models (claude-opus-4-7, gemini-3.1-pro) for PM/Architect; Medium-tier (claude-sonnet-4-6, gemini-3.5-flash) for QA; Low-tier (claude-haiku-4-5, gemini-3.5-flash) for execution. PM orchestrator follows a 6-phase governance workflow (Phase 0: Project Initiation → Phase 1-2: Planning & Architecture → Phase 3: Design Handoff → Phase 4: Execution → Phase 5: Quality Assurance → Phase 6: Lifecycle Finalization). See [`docs/workspace-schema.json`](docs/workspace-schema.json) for the canonical phase definitions. See [§5.6 Agent Lifecycle](docs/constitution/05.6-agent-lifecycle.md) for creation/modification procedures.

---

### 5.5 PM Gateway Workflow → [Full details](CLAUDE.md#5-agent-dispatch-rules)

All specialist agent dispatch MUST go through the PM orchestrator. The PM Gateway enforces governance consistency across multi-agent tasks through a mandatory execution plan display.

#### Enforcement Model

The PM Gateway operates at **4 enforcement levels** (see [§5 Multi-Agent Architecture](docs/constitution/05-multi-agent-architecture.md) for full model):

| Level | Trigger | PM Action | Specialist Involved |
|-------|---------|-----------|-------------------|
| **Level 1** | Single-step, single-file tasks | PM executes directly | None |
| **Level 2** | Multi-step (2+ files) or multi-agent tasks | PM displays execution plan, then dispatches | Yes |
| **Level 3** | Direct user invokes specialist | PM refuses, redirects through PM | Blocked |
| **Level 4** | Emergency fix (production down) | PM executes directly, logs post-incident | Optional |

#### Mandatory Execution Plan Display

Before dispatching any specialist agents (Level 2 tasks), PM **must** output an execution plan table in the user's active language:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task description] | [agent name] | High/Medium/Low | opus/sonnet/haiku |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [Model] |

**Rules**:
- Declare execution order (parallel vs sequential) below the table
- Always include Lifecycle Update and Final QA Audit as the final two steps
- The Agent tool MUST NOT be called until this table is visible to the user
- At workspace root, dispatch `lifecycle-manager` and `auditor`; in variant projects, PM handles both directly

#### Phase 2 (Planning & Architecture) Requirements

**Cross-Modification Verification:**
Before finalizing the work plan in Phase 2, the PM MUST verify cross-modification requirements. Specifically, when modifying any script, the PM must check `scripts/SCRIPTS.md` for the `depends_on:` attribute. If a target script has declared dependencies, all dependent scripts MUST be included in the Execution Task Plan to guarantee simultaneous modification and maintain consistency.

#### Specialist Agent List

The following agents require PM dispatch (no direct invocation):
- **architect** (Phase 1-2) - System design and architecture decisions
- **automation-engineer** (Phase 4) - Script implementation and DevOps automation
- **docs-writer** (Phase 4) - Documentation standardization and updates
- **scaffolding-expert** (Phase 0) - Project scaffolding and template instantiation
- **security-expert** (Phase 6) - Security audits and vulnerability assessments

#### Permission Denial Protocol

When a specialist agent's required tool is denied by the user, PM must **not substitute** for the specialist. Instead:
1. Classify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

For detailed PM procedures, dispatch rules, and escalation templates, see [`CLAUDE.md`](CLAUDE.md#5-agent-dispatch-rules) and [`agents/pm.md`](agents/pm.md).

---

### 5.6 Agent Lifecycle Management → [Full details](docs/constitution/05.6-agent-lifecycle.md)

Agents have three states: **active** (production use), **deprecated** (being phased out—reassign skills within 30 days), **retired** (move to `agents/_archive/`, delete after 90 days). PM is the designated owner of all agents. If an agent's prompt contains a vulnerability, immediately set `status: deprecated` and open a PR. Manage lifecycle via `agent-create.ts`, `agent-delete.ts`, and `agent-verify.ts`. After any agent change, update both `AGENTS.md` (canonical roster) and `CONSTITUTION.md §5` (architecture references).

---

### 5.8 Additive Template Architecture

L2 variant `pm.md` files must use the strict additive format utilizing `<!-- VARIANT-SECTION: [id] -->` markers.

- `templates/common/agents/pm.md` acts as the single source of truth containing the base skeleton with injection anchors.
- Variant `pm.md` files must ONLY contain the YAML frontmatter and the additive sections (`governance-workflow`, `agent-roster`, `dispatch-protocol`).
- Variant `pm.md` files must NEVER duplicate the core PM text or exceed 200 lines.

---

### 6. Skill Lifecycle Management → [Full details](docs/constitution/06-skill-lifecycle.md)

Skills are reusable workflows defined as `skills/<name>/SKILL.md` or `.claude/skills/<name>/SKILL.md`. When creating a new skill, use the `skill-creator` plugin and complete the registration checklist: add to `docs/context.md ## Skills` (individual projects) and `AGENTS.md ## Skills` (workspace root). Skills have four states: **draft**, **active**, **deprecated** (archive after 30 days), **archived** (delete after 90 days). Version bump rules: **patch** (1.0.x) for wording fixes, **minor** (1.x.0) for new steps, **major** (x.0.0) for rewrites. Shared skills (`owner: [agent1, agent2]`) require both owners' approval.

---

### 6.5 Script Lifecycle Management → [Full details](docs/constitution/06.5-script-lifecycle.md)

**Script deployment path**:
- **Source**: workspace root/scripts/ (L0 source)
- **Stage 1**: templates/common/scripts/ (auto-synced via dev-sync)
- **Stage 2**: templates/co-*/scripts/ (variant overlay — common scripts land at top-level; variant-specific scripts in `scripts/<variant>/` subdirectory)
- **Target**: Projects/*/scripts/ (copied at scaffolding time)

**Layer reference**: L0 (workspace root) → L1 (templates/common) → L2 (templates/co-*) → L3 (Projects/*)

**Variant-specific scripts**: Scripts unique to a variant MUST be placed in `scripts/<variant>/` (subdirectory), NOT at `scripts/` top-level. Reason: L1 `audit.ts` `verifyScriptRegistryConsistency()` uses non-recursive `readdirSync` — only top-level `.ts` files are checked against `scripts/SCRIPTS.md`. Variant scripts in subdirectories are excluded intentionally. Variant MUST NOT place `scripts/SCRIPTS.md` in its overlay (overwrites L1 registry). Declare scripts in `variant.json` → `script_manifest.local`; validated by `validate-templates.ts`. See [full details](docs/constitution/06.5-script-lifecycle.md) and [ADR-0033](docs/adr/0033-variant-specific-skills-scripts-blueprint.md).

Scripts have three statuses: **active** (version bump required on change), **deprecated** (90-day minimum notice with `removal-date`), **experimental** (not propagated). Dependency tracking: scripts that call other scripts must declare `depends_on` in `SCRIPTS.md` Registry; `verify-scripts.ts` checks for circular and missing dependencies. Security advisories trigger immediate hard blocks.

---

### 6.6 VERSION_MANIFEST System → [Full details](docs/adr/0012-version-manifest-schema.md)

The **VERSION_MANIFEST** is the single source of truth (SSOT) for lifecycle artifact versions across the workspace. It provides centralized visibility into agents, skills, scripts, and commands, along with platform parity status and drift detection.

#### Location and Generation

- **File**: `docs/VERSION_MANIFEST.md`
- **Update timing**: Generated during `/sync` pipeline only (not on every commit)
- **Generation method**: Hybrid approach — auto-generated core sections + manual annotations section
- **Generator script**: `scripts/generate-version-manifest.ts`

#### Single Source of Truth Principle

Source files remain authoritative:
- **Agents**: `agents/*.md` (YAML frontmatter for tier/model/color)
- **Skills**: `skills/*/SKILL.md` and `.claude/skills/*/SKILL.md` (version field in frontmatter)
- **Scripts**: `scripts/*.ts` (`@version` comment in header)
- **Commands**: `.claude/commands/*.md` and `.gemini/commands/*.md` (file analysis)

VERSION_MANIFEST.md aggregates and displays this information — it does not replace source file definitions.

#### Manifest Structure

```markdown
# Version Manifest

> **Last Generated**: [ISO timestamp]
> **Generation Source**: Auto-generated from source files by scripts/generate-version-manifest.ts
> **Single Source of Truth**: Source files (agents/*.md, skills/*/SKILL.md, scripts/*.ts)
> **Manual Annotations Section**: Below is human-maintained context

---

## Auto-Generated Sections

### Agents
| Name | File | Tier | Model | Last Modified |

### Skills
| Name | Version | Location | Platform | Triggers | Owner |

### Scripts
| Name | Version | Location | Dependencies |

### Commands
| Name | File | Platform | Skill Integration |

### Platform Parity Status
#### Claude ↔ Gemini Sync Status
#### Workspace → Templates/Common Propagation

### Drift Detection
#### Lifecycle Sync Drift
#### Platform Parity Drift
#### Documentation Drift

---

## Manual Annotations Section

> This section is human-maintained. Do not edit auto-generated sections above.

### Release Notes
### Migration Guides
### Deprecation Warnings
### Known Issues
```

#### Key Sections Explained

**Auto-Generated Sections** (regenerated on each `/sync`):
- **Agents**: Tier, model, last modified timestamp for all agents
- **Skills**: Version, platform scope, trigger phrases, owner for all skills
- **Scripts**: Version, dependencies (extracted from imports) for all scripts
- **Commands**: Platform parity, skill integration for all commands
- **Platform Parity Status**: Claude ↔ Gemini sync, workspace → templates propagation
- **Drift Detection**: Lifecycle sync drift, platform parity violations, documentation version drift

**Manual Annotations Section** (human-maintained, persists across regenerations):
- **Release Notes**: Human-readable summary of manifest changes
- **Migration Guides**: Instructions for transitioning from manual version tracking
- **Deprecation Warnings**: Alerts for deprecated skills/agents/scripts
- **Known Issues**: Documented limitations or bugs in manifest generation

#### Usage Patterns

**Checking current ecosystem state**:
```bash
# View all agent, skill, and script versions in one place
cat docs/VERSION_MANIFEST.md
```

**Detecting drift before releases**:
```bash
# Run /sync to regenerate manifest, then check Drift Detection section
/sync "chore: regenerate version manifest"
```

**Verifying platform parity**:
```bash
# Check Platform Parity Status section for Claude ↔ Gemini sync status
grep -A 10 "Platform Parity Status" docs/VERSION_MANIFEST.md
```

#### Schema Stability and Versioning

The VERSION_MANIFEST schema is governed by ADR process (see [ADR 0012](docs/adr/0012-version-manifest-schema.md)). Schema changes require:
1. New ADR documenting the change
2. Migration guide in Manual Annotations Section
3. Update to `generate-version-manifest.ts` script
4. Documentation update in this section (CONSTITUTION.md §6.6)

#### Relationship to Other Lifecycle Systems

| System | Purpose | VERSION_MANIFEST Role |
|--------|---------|----------------------|
| **CHANGELOG.md** | User-facing release history (what changed) | Provides "current state at a glance" for all versions |
| **memory/YYYY-MM-DD.md** | Developer-facing session logs (how/why) | Release Notes section provides historical context |
| **AGENTS.md** | Canonical agent roster | References VERSION_MANIFEST for skill versions (delegates version tracking) |
| **SCRIPTS.md** | Script registry with metadata | VERSION_MANIFEST displays aggregated versions from SCRIPTS.md |

#### Implementation Dependencies

- **A-03** (automation-engineer): `scripts/generate-version-manifest.ts` implementation
- **A-04** (lifecycle-manager): AGENTS.md Skills table update to reference VERSION_MANIFEST
- **ADR 0012**: Full schema specification, rationale, and consequences

See [ADR 0012: VERSION_MANIFEST Schema Design](docs/adr/0012-version-manifest-schema.md) for complete schema definition, generation algorithm, and open questions.

---

### 7. New Project Initialization → [Full details](docs/constitution/07-new-project.md)

Every new project starts with `/new-project` (Claude Code) or `bun scripts/new-project.ts` (cross-platform CLI). The script copies `templates/` into the new directory, substitutes `[Project Name]` placeholders, removes `_examples/`, and initializes git with hooks active. Generated files include `docs/context.md` (fill in 10 sections), `AGENTS.md` (ready), 5 agent files (`[Project Name]` already substituted), `CLAUDE.md`/`GEMINI.md` (add project-specific settings if needed), `scripts/` (audit, dev-sync, sync-md), `.githooks/`, `CHANGELOG.md`, `README.md`, `.env.sample`, `.gitignore`, and `memory/MEMORY.md`.

> **Layer × Stage model**: workspace lifecycle spans three layers (L0 workspace root / L1 templates / L2 generated projects) and three phases (Phase A Scaffold / Phase B Refinement / Phase C Promotion). See [§7.4 Layer × Stage Reference Matrix](docs/constitution/07-new-project.md) for the full cross-reference.

---

### 7.5 Common Layer Governance (`templates/common/`)

The `templates/common/` directory is the shared foundation for all variant templates (`co-design`, `co-develop`, `co-work`, `co-security`). When `/new-project` runs, common content is copied first; variant-specific overlays are applied on top.

#### Purpose
- Agents and skills that are identical across all variants live in `templates/common/agents/` and `templates/common/skills/`.
- The authoritative manifest of common content is `docs/templates/common-contract.json`. Every file listed there is guaranteed to be present in every generated project.
- Variant templates may extend or replace common files via the override system described below.

#### Classification Criteria

| Category | Condition | Examples |
|----------|-----------|---------|
| **Common agent** | Exists identically across all variants | `pm.md` |
| **Common skill** | Used in all variants without modification | `project-review`, `meeting-facilitation`, `audit-workspace`, `security-scan`, `skill-lifecycle-manager`, `agent-lifecycle-manager` |
| **Variant-specific** | Unique to one variant; not applicable elsewhere | Domain-expert agents, variant-only skills |

#### Override Types

| Type | When to use | Approval | `variant.json` declaration |
|------|-------------|----------|----------------------------|
| **Additive** | Variant appends sections to a common file | Auto-approved | `"type": "additive"` |
| **Replacement** | Variant modifies common content | Requires PM review before commit | `"type": "replacement"` |

Additive overrides are concatenated with the common file during scaffolding. Replacement overrides fully substitute the common file. Both types require `reason` and `since` fields in the `variant.json` entry.

#### Anti-Swelling Rule
If **≥ 50 %** of variants declare an override for the same agent or skill, the common definition must be updated instead of accumulating per-variant overrides. `bun scripts/validate-templates.ts` enforces this threshold and will fail with an actionable error listing the affected files.

#### L0 Agent Non-Propagation

L0 specialist agents (`architect.md`, `auditor.md`, `automation-engineer.md`,
`docs-writer.md`, `lifecycle-manager.md`, `scaffolding-expert.md`,
`security-expert.md`) are **not** propagated to `templates/common/agents/`.
This is intentional — see ADR-0039 (L0→L1→L2 Hierarchy) and ADR-0040
(L0→L1 Deployment Strategy).

**Rationale**:
- **PM is the only agent with an L0→L1→L2 extends chain.** Specialist agents are
  dispatched by PM and resolved at runtime by the AI platform — they do not
  require a template-layer copy.
- **Variant projects define their own specialist agents.** L2 variants declare
  domain-specific agents in their `variant.json` `agent_roster`, which may
  differ from the L0 roster (e.g., a co-security variant uses `red-team-lead`
  instead of `architect`).
- **Bottom-up promotion instead of top-down propagation.** If a specialist agent
  becomes common across 3+ variants (Jaccard similarity ≥ 80%), it may be
  promoted to L1 via the process described in ADR-0043 (L1 Agent Layer Hybrid
  Override). This is a separate, intentional workflow distinct from L0→L1
  propagation.

**Current L1 agent**: Only `pm.md` (uses `extends: ../../../agents/pm.md`).

#### CONSTITUTION.md Non-Propagation

`CONSTITUTION.md` is the L0 workspace-root governance document. It must **never** be
present in L1 (`templates/common/`) or L2 (variant projects), and L1/L2 `.md` files
must **not** contain references to it.

**Rules**:
- `CONSTITUTION.md` is on the blocklist in
  [`docs/governance/variant-contract.md`](docs/governance/variant-contract.md) —
  `validate-templates.ts` Check 0 blocks any copy in `templates/common/`.
- L1 and L2 documentation (`.md` files, agent definitions, skill specs, CLAUDE.md,
  GEMINI.md) must **not** reference `CONSTITUTION.md` by file path, section anchor,
  or markdown link.
- **L2 substitute**: generated projects use `docs/context.md` and
  `<variant>.context.md` instead.
- The session-start directive in CLAUDE.md / GEMINI.md ("read CONSTITUTION.md first")
  is L0-only; `merge-frontmatter.ts` strips CONSTITUTION.md references from L2
  output during scaffolding.

**Enforcement**:
- `audit.ts` L0 Leakage check scans all `.md` files under `templates/` for
  unauthorized `CONSTITUTION.md` or `docs/constitution/` references.
- The `intentional-duplicate` HTML comment is the sole escape hatch — it exempts
  the containing file from the L0 Leakage check. Use it **only** when the file is
  verified to be L1-only (i.e., never copied into L2 variants).

#### Adding a New Common Agent or Skill
1. Add the file to `templates/common/agents/` or `templates/common/skills/`.
2. Register it in `docs/templates/common-contract.json`.
3. Run `bun scripts/validate-templates.ts` — must exit 0 before committing.

#### Adding a Variant Override
1. Create the partial (additive) or replacement file under `templates/co-xxx/agents/` or `templates/co-xxx/skills/`.
2. Add an entry to `templates/co-xxx/variant.json` under `agent_overrides` or `skill_overrides`:
   ```json
   {
     "file": "agents/pm.md",
     "type": "additive",
     "reason": "Adds co-design-specific PM rituals",
     "since": "2026-05-30"
   }
   ```
3. For **replacement** overrides, open a PR and request PM review before merging.

---

### 8. Coding Behavior Guidelines → [Full details](docs/constitution/08-coding-guidelines.md)

Behavior guidelines to reduce common LLM coding mistakes. **Think Before Coding**: state assumptions, surface tradeoffs, ask when uncertain. **Simplicity First**: minimum code, no speculative features, no premature abstractions. **Surgical Changes**: touch only what you must, match existing style, clean up only your own orphans. **Goal-Driven Execution**: define verifiable success criteria, loop until confirmed. **Secrets Management**: never hardcode credentials—use `.env.sample` template. **Open-Source Policy**: prefer OSI-approved licenses (MIT, Apache-2.0, BSD), audit after install. **Response Language**: default to Korean conversational, but all Git/PR artifacts must be English. **File Encoding**: all text files UTF-8 without BOM. **Hybrid Scripting**: Tier 1 (Bootstrap) in Native Shell, Tier 2 (Ops/Automation) in Bun/TS + package.json. **Bilingual README**: `templates/*` and workspace root require `README.md` and `README_ko.md` synced via `sync_version: <int>` YAML frontmatter. Other folders like `scripts/` require only English `README.md`.

---

### 9. Operations Workflow → [Full details](docs/constitution/09-operations-workflow.md)

Operational procedures for maintaining workspace health and lifecycle hygiene. **Post-Implementation QA (Mandatory)**: All tasks executed based on an `implementation_plan.md` or formal plan MUST undergo a QA validation step via testing or verification scripts before completion, regardless of the agentic tool used (Claude/Antigravity). **Weekly Health Check** (PM, every Friday): Run lifecycle audits (`agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`) and review deprecated items. **Monthly Lifecycle Review** (PM + Architect, first Friday): Review deprecated items >30 days, perform archive cleanup (move to `*_archive/` after 30 days, delete after 90), plan template synchronization, create action items. **Quarterly Template Sync** (Architect + PM, start of each quarter): Validate templates, propagate L0 changes to variants, update `templates/VERSION`. **On-Demand Synchronization**: Run `bun scripts/sync-agent-status.ts` and `bun scripts/sync-skill-status.ts` after agent/skill changes. **Operational Metrics**: Track agent/skill health (100% target), deprecated backlog (<5 items), archive age (<90 days), template sync lag (<7 days).

---

### 10. Terminology → Canonical Definitions

The following terms have precise meanings across all workspace tools, agents, and documentation. Use these exact terms — do not substitute synonyms.

#### Template Variant
One of six project archetypes: `co-develop`, `co-design`, `co-work`, `co-security`, `co-consult` (all stable), `co-deck` (beta). Specifies which `templates/<variant>/` folder is used during project scaffolding. Recorded in `.claude/template-version.txt` as `variant=<value>`.

#### Platform Profile
Controls which AI-platform-specific configuration files are included in a project. Three values:
- `claude` — includes `CLAUDE.md` only; `GEMINI.md` is excluded
- `antigravity` — includes `GEMINI.md` only; `CLAUDE.md` is excluded
- `both` — includes both (default for all new projects)

Recorded in `.claude/template-version.txt` as `platform=<value>`.

#### context.md vs variant.context.template.md

Two template files serve distinct roles in the documentation layer:

| File | Layer | Role |
|------|-------|------|
| `templates/common/docs/_common/context.md` | L1 | **Project identity document** — immutable project architecture, standards, and invariants. Copied to `docs/context.md` in every new L2 project. Do NOT modify after project creation. |
| `templates/common/docs/variant.context.template.md` | L1 | **Variant overlay template** — customization layer rendered into `docs/<variant>.context.md`. Contains VARIANT-INJECT markers for variant-specific sections. |

**Read order for AI tools in any L2 project:**
1. `docs/context.md` — immutable project identity
2. `docs/<variant>.context.md` — THIS FILE — variant-specific tech stack, agents, skills, workflow

#### WORKSPACE-MANAGED Marker
A pair of HTML comment markers used in MERGE-tier files to delimit sections managed by the workspace template system:

```
<!-- WORKSPACE-MANAGED -->
... content owned and updated by upgrade-project scripts ...
<!-- /WORKSPACE-MANAGED -->
```

Rules:
- Content between these markers is automatically replaced by `upgrade-project.ts` during upgrades.
- Content outside the markers is user-owned and is never modified by upgrade scripts.
- `bun scripts/audit.ts` verifies that these markers exist in expected files.
- Do **not** remove or reorder these markers manually.

#### File Upgrade Tiers (LOCKED / MERGE / PRESERVE)

Used by `upgrade-project.ts` to classify every project file during a template upgrade:

| Tier | Behavior | Examples |
|------|----------|---------|
| **LOCKED** | Always overwritten; diff shown before overwrite | `.githooks/*`, `.gitattributes`, `.gitleaks.toml` |
| **MERGE** | Only `WORKSPACE-MANAGED` sections replaced; rest preserved | `CLAUDE.md`, `GEMINI.md`, `CONSTITUTION.md`, `.gitignore`, `agents/*.md` |
| **PRESERVE** | Never touched; listed in upgrade report only | `README.md`, `src/`, `docs/context.md`, project-specific files |

#### Platform Documentation Parity
The requirement that `CLAUDE.md` and `GEMINI.md` in every project template maintain equivalent section coverage. If a security configuration, behavioral rule, or workflow is documented in `CLAUDE.md`, an equivalent entry must exist in `GEMINI.md`, and vice versa. Verified during template validation (`bun scripts/validate-templates.ts`).

#### Script Parity Annotation
A comment tag added to TypeScript scripts to declare that a specific security or behavioral check is implemented. Format: `# [parity:<tag>]`. Example: `# [parity:secret-scan]`. The `validate-templates.ts` script checks that declared parity tags are consistently present across all scripts that share the same responsibility.

#### Intentional Duplicate Annotation

When a section in a project file deliberately repeats CONSTITUTION.md content (e.g., for AI context proximity or variant-specific contextualization), annotate it immediately below the section heading:

```
<!-- intentional-duplicate: CONSTITUTION.md §N — [reason]; update when source changes -->
```

This annotation:
- Signals to AI tools and reviewers that the duplication is deliberate, not an oversight
- Documents the sync obligation: update the local section when the referenced CONSTITUTION section changes significantly
- Enables future tooling to generate a registry of all intentional duplicates (`intentional-duplicate:` keyword is machine-parseable)

Valid reasons include: AI context proximity (faster access without full CONSTITUTION.md load), variant-specific contextualization, platform-specific adaptation.

#### Language Policy Exception — Korean Legal/Regulatory Content

The English-only policy admits a narrow exception for files where Korean is legally
or academically mandatory. To declare an exception, add to the file's frontmatter:

```yaml
lang: ko
lang_reason: legal   # legal | source-material | proper-noun
```

The allowable values for `lang_reason` are:
- `legal`: Statutory texts, ordinances, regulations, contracts where the Korean original has legal force.
- `source-material`: Primary source quotations where English translation would compromise academic accuracy or meaning.
- `proper-noun`: Files dominated by Korean proper nouns (e.g., institution names, person names).

Exception is NOT available for: agents/*.md, skills/*.md, CONSTITUTION.md,
CLAUDE.md, GEMINI.md, AGENTS.md, or any variant context.md file.

#### Pluggable Variant Audit Hook

A mechanism that allows variant-specific validation checks to be executed during the synchronization and validation pipeline without modifying core script files (e.g., `dev-sync.ts`, `audit.ts`). Variant-specific audits are placed in `scripts/audit-variant.ts`. If this script is present, the core validation runner (`audit.ts`) dynamically detects and executes it. Any non-zero exit code from `audit-variant.ts` will fail the audit gate.

---

*Last Updated: 2026-07-01*
