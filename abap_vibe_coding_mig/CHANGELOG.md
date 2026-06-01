# Changelog

All notable changes to **abap-harness-engineering** (main project harness) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- **[2026-06-02]**: Convert git-sync.ps1/sh to TypeScript (git-sync.ts v1.0.0) for platform neutrality
  - **Breaking Change**: Removed PowerShell/Bash implementations in favor of unified TypeScript implementation
  - **Platform Neutrality**: Works on Windows, macOS, and Linux (Bun runtime required)
  - **Features**: Cross-platform git operations, automatic branch detection, colored terminal output, change detection, graceful error handling
  - **3-Tier Strategy**: Promoted to Tier 1 (Core Utility) for global git operations
- **[2026-06-02]**: Remove vsp-audit.ps1/sh dead code (placeholder + deleted wrapper script)
  - Removed unused SAP-specific audit wrapper scripts that were placeholders for deleted functionality
  - Cleanup of legacy Phase 2 artifacts to maintain codebase hygiene
- **[2026-06-02]**: Complete VSP TypeScript conversion - platform-neutral implementation of all VSP pipeline scripts
  - **vsp-sync.ts**: VSP sync pipeline with hook architecture (Solution C, Diff Algorithm)
    - **Breaking Change**: PowerShell parameters converted to CLI flags: `-Message` → `-m`, `-NoAudit` → `--no-audit`, `-NoMcp` → `--no-mcp`, `-NoPostHook` → `--no-post-hook`
    - **Platform Neutrality**: Works on Windows, macOS, and Linux (Bun runtime required)
    - **Hook Architecture**: Maintains Phase 3 hook infrastructure (audit.ts, sync-mcp.ts, SAP sync, sync-md.ts)
    - **Solution C Support**: Preserves --incremental audit mode for fast iteration
  - **vsp-task.ts**: VSP task automation with error handling and retry logic
    - **Platform Neutrality**: Cross-platform task execution with unified interface
    - **Error Handling**: Enhanced platform-aware SAP invocation (Windows: powershell.exe, Unix: pwsh)
    - **Retry Logic**: Automatic retry mechanism for transient failures
  - **vsp-publish.ts**: VSP publishing pipeline with distribution support
    - **Platform Neutrality**: Unified publishing workflow across all platforms
    - **Distribution Support**: Automated packaging and release management
    - **Error Handling**: Robust failure recovery and rollback capabilities
  - **Migration**: All VSP PowerShell scripts deprecated, functionality preserved in TypeScript versions
  - **3-Tier Strategy**: All VSP scripts promoted to Tier 1 (Core Utilities) for cross-platform deployment
- **[2026-06-02]**: Revised 3-Tier Script Strategy - comprehensive redefinition of script architecture alignment and implementation guidelines
  - **Strategic Alignment**: Actual implementation analysis reveals the need to revise the "Hybrid Scripting Automation" model (2026-05-25) to match real-world deployment patterns
  - **Core Discovery**: audit.ts v2.6.0 (Solution C, Diff Algorithm) implemented in TypeScript using Bun runtime, not PowerShell/Bash as originally documented
  - **Script Consolidation**: 7 duplicate scripts eliminated (audit.sh/ps1, sync-mcp.sh, sync-md.sh/ps1, gen-pr-body.sh/ps1)
  - **New 3-Tier Model**:
    - **Tier 1**: Core Utilities (Bun .ts) - audit.ts, sync-mcp.ts, sync-md.ts, vsp-sync.ts, vsp-task.ts, vsp-publish.ts, git-sync.ts - complex logic, Solution C, global workspace validation
    - **Tier 2**: Domain Utilities (Shell/PowerShell) - (None currently active) - SAP-specific, Windows-native, ABAP environment optimized
    - **Tier 3**: Agent Orchestration (Bun .ts) - dispatch.ts, retry-handler.ts, verify-skills.ts - async coordination, PM Gateway, multi-agent dispatch
  - **Quality Standards**: English documentation, clear concise descriptions, tabular markdown format, implementation-accurate content
- **[2026-06-02]**: Phase 3 deployment - SAP-first hook architecture sync pipeline with Solution C and Diff Algorithm implementation
- **[2026-06-01]**: co-develop template Phase 2 integration - hybrid scripts and domain readiness assessment
- **[2026-06-01]**: co-develop template Phase 1 integration - governance framework and script coexistence
  - Created governance documentation (G0001-0003): hook execution policy, classification guidelines, phase completion process
  - Imported co-develop template scripts: audit.ts (workspace validation), dev-sync.ts (sync pipeline), sync-md.ts (date management)
  - Implemented PM Gateway health monitoring: failure rate tracking with threshold alerts (<1% healthy, 1-2% warning, >2% critical)
  - Established Phase 1 foundation: 3-phase migration plan (coexistence → selective enhancement → SAP-first ecosystem)
  - Auditor validation: All acceptance criteria met (AC-10, AC-11, AC-13, AC-17), Phase 2 authorized

### Fixed
- **[2026-05-25]**: fix: test changelog and memory automation

### Added
- **[2026-06-02]**: Diff Algorithm implementation in audit.ts v2.6.0 for optimized workspace validation (replaces full audit with incremental mode)
- **[2026-05-24]**: Bun-based single-source scripts (.ts) replacing dual .sh/.ps1 maintenance — health-check.ts, audit.ts, sync-mcp.ts, memory-index.ts
- **[2026-05-24]**: `.mcp.json` as Single Source of Truth for MCP configuration across all platforms (Claude Code, Gemini, Antigravity)
- **[2026-05-24]**: MCP sync script (sync-mcp.ts) for automatic settings synchronization from .mcp.json to platform-specific configs
- **[2026-05-24]**: Health check script (health-check.ts) for system monitoring and version verification
- **[2026-05-24]**: Memory index auto-updater (memory-index.ts) for maintaining memory/MEMORY.md index
- **[2026-05-24]**: Desktop App fallback skill for manual QA when PostToolUse hooks don't fire
- **[2026-05-24]**: Agent dispatch templates and handoff specification for standardized subagent coordination
- **[2026-05-24]**: Skills index (SKILLS.md) documenting all available skills and their entry points
- **[2026-05-23]**: `.githooks/pre-commit`: Add Markdown date auto-bumper and CHANGELOG auto-dating logic. Automatically updates `Last Updated:` date in staged `.md` files upon commit, and injects date into undated `CHANGELOG.md` entries.
- **[2026-05-23]**: `docs/context.md`: Add `security-monitor` (Security group) to Agents table.
- **[2026-05-23]**: `AGENTS.md`: Register `security-monitor` agent formally in the global Agent Roster.

### Deprecated
- **[2026-06-02]**: vsp-sync.ps1 (Phase 3 PowerShell script) — use vsp-sync.ts instead (platform-neutral TypeScript)
- **[2026-06-02]**: vsp-task.ps1 (VSP task automation script) — use vsp-task.ts instead (cross-platform TypeScript)
- **[2026-06-02]**: vsp-publish.ps1 (VSP publishing script) — use vsp-publish.ts instead (unified publishing workflow)
- **[2026-06-02]**: vsp-dev-sync.ps1 (Phase 2 hybrid script) — use vsp-sync.ts instead (hook architecture with Solution C)
- **[2026-05-24]**: Dual .sh/.ps1 script maintenance — use .ts scripts with Bun runtime instead (legacy wrappers retained for compatibility)

### Removed
- **[2026-05-23]**: `README.md` / `README_ko.md`: Remove obsolete manual kickoff instruction text.


### Changed
- **[2026-06-02]**: **Phase 3 Hybrid Model** transitioned from vsp-dev-sync.ps1 to vsp-sync.ps1 with hook architecture. Script execution optimized from 1.2s (Phase 2) to 0.58s (Phase 3) with Solution C integration.
- **[2026-06-02]**: **3-Tier Script Strategy** replaced "Hybrid Scripting Automation" model to align actual implementation patterns with documentation. audit.ts v2.6.0 (TypeScript) confirmed as core utility, 7 duplicate scripts eliminated.
- **[2026-05-25]**: Established **Hybrid Scripting Automation** model. Utility scripts (`dev-sync`, `audit`) reverted to native PowerShell/Bash for simplicity, while agent orchestration (`dispatch`, `retry-handler`, `verify-skills`) remains in Bun (.ts) for complex async handling.

### Added
- **[2026-05-24]**: MCP workflow references updated in CLAUDE.md and GEMINI.md to reflect .mcp.json SSoT approach
- **[2026-05-24]**: Pre-commit hook now checks MCP configuration drift between .mcp.json and platform-specific configs
- **[2026-05-23]**: Standardize session start checklist in CLAUDE.md to 6-step format (git config, CONSTITUTION, context, AGENTS, memory, skills)
- **[2026-05-23]**: Add `## Session Start Skills` section to docs/context.md for all-tool auto-discovery
- **[2026-05-23]**: Expand GEMINI.md with tool safeguards, Planning Mode artifacts, and Subagent orchestration

### Added (2026-05-23 Antigravity Project Configuration Support)
- **[2026-05-23]**: `.gemini.settings.json.sample`: Created a template for Antigravity 2.0 and Gemini CLI project-level configuration to streamline setup for new workspaces.

### Changed (2026-05-23 Antigravity Project Configuration Support)
- **[2026-05-23]**: `docs/antigravity-setup.md`: Updated to state that Antigravity 2.0 (and CLI) now supports project-level configs via `.gemini/settings.json`, no longer strictly requiring user-level VS Code settings.
- **[2026-05-23]**: `docs/setup-guide.md`: Updated Appendix A and cross-references to point Antigravity configurations to `.gemini/settings.json`.

### Fixed (2026-05-23 MD Consistency Audit)
- **[2026-05-23]**: `CLAUDE.md`: Removed outdated legacy `commands/` folder reference; corrected script delegation path to `audit.ps1`/`audit.sh`
- **[2026-05-23]**: Agent & CLI documents (`AGENTS.md`, `GEMINI.md`, `docs/context.md`, `CLAUDE.md`): Integrated Optimal Interaction Guidelines and Universal Baseline Behaviors for agent workflow consistency

### Fixed (2026-05-23 Audit Script — Relative Link Filter)
- **[2026-05-23]**: `scripts/audit.sh` / `audit.ps1`: Add `../../` relative-path exclusion to markdown link checker — GitHub Security Advisory links (`../../security/advisories/new`) are cross-repo relative URLs, not local file paths, and must be excluded from broken-link validation


### Added (2026-05-23 Project Structure Compliance)
- **[2026-05-23]**: `SECURITY.md`: Security vulnerability reporting policy (CONSTITUTION §1 required file)
- **[2026-05-23]**: `.github/pull_request_template.md`: Standard PR body template (CONSTITUTION §1 required file)

### Fixed (2026-05-22 Windows MCP Config)
- **[2026-05-23]**: `.mcp.json`: `"./vsp"` → `"./vsp.exe"` so Claude Code CLI resolves the binary on Windows
- **[2026-05-23]**: `.claude/settings.json`: PostToolUse hook matcher extended to `Write|Edit|mcp__abap__WriteSource|mcp__abap__EditSource` — ABAP MCP write calls now trigger the sync-md audit script
- **[2026-05-23]**: `.claude/settings.local.json`: Added `enableAllProjectMcpServers: true` alongside existing `enabledMcpjsonServers` list for full compatibility

### Changed
- **[2026-05-23]**: Add ## Architecture, ## Development Workflow, ## Key Files, ## Environment Setup sections to docs/context.md

### Changed
- **[2026-05-23]**: Add standard slash commands, smart pre-commit hook (memory/ exclusion), and Coding Guidelines section to docs/context.md

### Fixed (2026-05-22 Skill Command Wrappers)
- **[2026-05-23]**: `.claude/commands/abap-dev.md`: New wrapper — registers `abap-dev` skill for Skill tool invocation
- **[2026-05-23]**: `.claude/commands/sap-sd/mm/fi/co/le/pp.md`: Six new wrappers — all SAP module skills now invocable via `Skill("sap-*")`
- **[2026-05-23]**: `.claude/commands/post-write.md`: Converted from standalone duplicate to thin wrapper delegating to `skills/post-write-chain/SKILL.md` (single source of truth)

### Changed (2026-05-22)
- **[2026-05-23]**: `scripts/audit.sh` / `audit.ps1`: New standard audit entry point (replaces vsp-audit as primary)
- **[2026-05-23]**: `scripts/vsp-audit.sh` / `vsp-audit.ps1`: Now legacy wrappers delegating to audit.sh/ps1
- **[2026-05-23]**: `scripts/sync-md.sh` / `sync-md.ps1`: Updated to call audit.sh/ps1 directly

### Added (2026-05-22 Inventory Management Design)
- **[2026-05-23]**: `docs/superpowers/specs/2026-05-22-inventory-management-design.md`: Design document for custom inventory management system with Z tables (ZTINV_REQ, ZTINV_REQ_IT, ZTINV_STOCK) handling Goods Receipt and Goods Issue

### Added (2026-05-21 Memory Log)
- **[2026-05-23]**: `memory/2026-05-21.md`: Session log for 2026-05-21 — consistency audit, dispatch-card refactor, BAPI lifecycle expansion, Project Constitution compliance
- **[2026-05-23]**: `memory/MEMORY.md`: Updated index with 2026-05-21 entry; Last Updated bumped

### Added (2026-05-21 Git Hook Configuration)
- **[2026-05-23]**: `.githooks/pre-commit`: Added Git hook to enforce `CHANGELOG.md` updates on every commit.
- **[2026-05-23]**: `.githooks/pre-push`: Added Git hook to block direct pushes to `main` branch; enforces PR-based workflow.
- **[2026-05-23]**: `.github/workflows/auto-merge.yml`: Added GitHub Actions workflow that automatically Squash & Merges a PR when it receives an "Approved" review.

### Added (2026-05-21 Project Constitution Compliance)
- **[2026-05-23]**: `scripts/dev-sync.sh` / `dev-sync.ps1`: Added Project Constitution §3 standard entry-point wrappers delegating to `vsp-sync.sh` / `vsp-sync.ps1`
- **[2026-05-23]**: `docs/context.md`: Added `Project Overview`, `Tech Stack`, `Agents`, and `Skills` summary sections per Project Constitution §7 required sections
- **[2026-05-23]**: `CLAUDE.md`: Added `.claude/commands/` listing with slash command inventory; added note clarifying root `commands/` folder is legacy; updated Last Updated to 2026-05-21

### Changed (2026-05-21 Project Constitution Compliance)
- **[2026-05-23]**: `.claude/commands/sync.md`: Updated script invocation from `vsp-sync.sh` → `dev-sync.sh` to align with Project Constitution §3 standard

### Added (2026-05-21 BAPI Coverage Expansion)
- **[2026-05-23]**: `skills/sap-sd/SKILL.md`: Added `BAPI_SALESORDER_CHANGE` (Sales Order Change) and `BAPI_BILLINGDOC_CREATEMULTIPLE` (Billing Document Creation); expanded `BAPI_OUTB_DELIVERY_CREATE_SLS` stub to full parameter documentation; fixed typo `TARGET_QUY` → `TARGET_QTY` in `BAPI_SALESORDER_CREATEFROMDAT2`
- **[2026-05-23]**: `skills/sap-mm/SKILL.md`: Added `BAPI_PO_CHANGE` (Purchase Order Change) and `BAPI_MATERIAL_SAVEDATA` (Material Master Save); expanded existing BAPIs with additional parameter detail
- **[2026-05-23]**: `skills/sap-fi/SKILL.md`: Added `BAPI_ACC_DOCUMENT_REV_POST` (Document Reversal) and `BAPI_INCOMINGINVOICE_CREATE` (Incoming Invoice / MIRO equivalent); expanded `BAPI_ACC_DOCUMENT_POST` with full parameter detail
- **[2026-05-23]**: `skills/sap-co/SKILL.md`: Added `BAPI_COSTCENTER_CHANGE` (Cost Center Change) and `BAPI_INTERNALORDER_CREATE` (Internal Order Create); expanded existing BAPIs with additional parameter detail
- **[2026-05-23]**: `skills/sap-pp/SKILL.md`: Added `BAPI_PRODORD_RELEASE` (Production Order Release) and `BAPI_PRODORD_COMPLETE_CONF` (Production Order Confirmation)
- **[2026-05-23]**: `skills/sap-le/SKILL.md`: Added `BAPI_OUTB_DELIVERY_CONFIRM_DEC` (Delivery Goods Issue Confirmation/Cancellation) and `BAPI_WHSE_TO_CONFIRM` (WM Transfer Order Confirmation)

### Changed (2026-05-21 PM card + Architect Technical Lead)
- **[2026-05-23]**: `AGENTS.md`: PM entry converted to dispatch-card format — removed redundant §5 Finalization steps and Responsibilities bullets (detail lives in `agents/pm.md`); added `Entry point` and `Subagent prompt` fields
- **[2026-05-23]**: `AGENTS.md`: Architect designated as **Technical Execution Lead** — role explicitly stated in Technical Group intro and Architect card; added `Technical Lead responsibilities` field
- **[2026-05-23]**: `agents/architect.md`: Opening statement updated to reflect Technical Execution Lead role — single point of contact between PM and Technical Group

### Changed (2026-05-21 AGENTS.md Refactoring)
- **[2026-05-23]**: `AGENTS.md`: Refactored Business Group analyst entries (SD/LE/PP/MM/FI/CO) to dispatch-card format — removed redundant `Allowed Tools` and `Output Format` skeleton blocks; renamed `Context file` → `Subagent prompt`; deduplicated trigger keyword lists
- **[2026-05-23]**: `AGENTS.md`: Refactored Technical Group entries (Architect/ABAP Developer/QA Engineer/DBA/DevOps/Intelligence Investigator/Interface Expert/Fiori Developer/Form Expert/GUI Scripter) to dispatch-card format — replaced `Responsibilities` detail bullets with `When to dispatch` + `Output` summary; added missing `Subagent prompt` links to all agents (`code-writer.md`, `test-runner.md`, `dba.md`, `devops-admin.md`, `sap-investigator.md`, `interface-expert.md`, `fiori-developer.md`, `form-expert.md`, `gui-scripter.md`)
- **[2026-05-23]**: `AGENTS.md`: Added Technical Group intro note directing readers to `agents/*.md` for full behavioral rules
- **[2026-05-23]**: `AGENTS.md`: Updated Last Updated to 2026-05-21

### Fixed (2026-05-21 Consistency Audit)
- **[2026-05-23]**: `GEMINI.md`: Removed `browser_subagent` reference from Multi-Agent Coordination section; corrected "single tool" description — hyperfocused mode exposes all 101 operations via `sap_execute`
- **[2026-05-23]**: `docs/tooling-matrix.md`: Removed `browser_subagent` from PM dispatch cell and Default Rule note; renamed "Web research / browser subagent" row to "Web research"; updated Last Updated to 2026-05-20
- **[2026-05-23]**: `docs/setup-guide.md`: Removed `browser_subagent` from §8-C; corrected Appendix B mode table (hyperfocused = "101 ops via sap_execute", not "1 tool"); fixed `VSP_MODE` → `SAP_MODE` in Appendix B; clarified §5-D note; updated to version 1.7 / 2026-05-20
- **[2026-05-23]**: `docs/plugin-setup.md`: Fixed `VSP_MODE` → `SAP_MODE` and `VSP_ALLOWED_PACKAGES` → `SAP_ALLOWED_PACKAGES` in §3 `.env` template
- **[2026-05-23]**: `docs/mcp_usage.md`: Fixed `VSP_FEATURE_TRANSPORT/RAP/UI5` → `SAP_FEATURE_*` throughout Specialized Tools section; corrected Mode Selection Guide to accurately describe hyperfocused as 101-op routing
- **[2026-05-23]**: `AGENTS.md`: Removed non-existent `harness:memory-intelligence` skill reference from Intelligence Investigator; fixed CO trigger keyword `CSKP` → `CSKB`; corrected Role Boundary Matrix: "Analyse ABAP source logic" now maps to `architect` (not `sap-investigator`)
- **[2026-05-23]**: `agents/sap-investigator.md`: Fixed CO pattern `CSKP` → `CSKB`; added `GetSource` to tools list for pattern-context verification
- **[2026-05-23]**: `docs/testing-guidelines.md`: Fixed §Logging ATC Results to reference "active task file" not "task-template.md"; updated Last Updated to 2026-05-20
- **[2026-05-23]**: **C-08 verified non-issue**: `agents/architect.md` already contained `GetCDSImpactAnalysis` — no change needed

### Fixed
- **[2026-05-23]**: `AGENTS.md`: Removed 5 incorrect `browser_subagent` references from Form Expert, GUI Scripter, Fiori Dev (Design Mode), and Dispatch Sequences table — tool does not exist in vsp MCP server (IMP-01)
- **[2026-05-23]**: `docs/context.md`: Clarified that `hyperfocused` mode registers all 101 individual MCP tools, not a single unified tool — addresses Interface Expert tool availability concern (IMP-02)

### Added
- **[2026-05-23]**: `AGENTS.md`: Cross-Module Integration Orchestration section — parallel activation rule, PRD ownership policy, primary analyst designation, and 4 standard scenario templates (SD-FI, MM-FI, SD-LE, PP-MM) (IMP-09)
- **[2026-05-23]**: `docs/context.md`: Deployed vsp Binary version table (`v2.38.1`, built 2026-04-07) (IMP-05)
- **[2026-05-23]**: `docs/context.md`: Canonical ABAP SQL Reference section for all agents (DESCENDING, max_rows, tilde notation, anti-patterns) (IMP-08)
- **[2026-05-23]**: `scripts/vsp-audit.ps1` / `vsp-audit.sh`: Check 6 — reports vsp binary version on each audit run (IMP-05)
- **[2026-05-23]**: `agents/architect.md`: Pattern C partial-failure rollback procedure — 5-step recovery process when multi-object refactor aborts mid-sequence (IMP-04)
- **[2026-05-23]**: `docs/testing-guidelines.md`: ATC Priority-2 Escalation Workflow — three disposition options (Fix / Suppress-with-justification / Defer) with recording location and decision criteria (IMP-03)
- **[2026-05-23]**: `docs/testing-guidelines.md`: ABAP Unit Test Skeleton section with method naming convention and AAA pattern reference (IMP-10)
- **[2026-05-23]**: `scratch/stable/z_unit_test_skeleton.clas.abap`: Reference ABAP Unit test skeleton with TEST-SEAM injection pattern (IMP-10)
- **[2026-05-23]**: `agents/sap-investigator.md`: 6 cross-module pattern groups — SD-FI, MM-FI, SD-LE, PP-MM, LE extended, PP extended (IMP-06)
- **[2026-05-23]**: `skills/sap-co/SKILL.md`, `sap-pp/SKILL.md`, `sap-le/SKILL.md`: Strategic BAPIs & APIs section added to complete all 8 required skill sections (IMP-07)
- **[2026-05-23]**: `scratch/tasks/task-2026-05-20-001` through `-010`: Task handoff files for all 10 improvement items from 2026-05-20 all-hands review meeting

### Changed
- **[2026-05-23]**: `agents/test-runner.md`: ATC P2 standard updated to reference new escalation workflow (IMP-03)
- **[2026-05-23]**: `docs/task-template.md`: Rollback Plan table added to §2 Technical Design; P2 Disposition field added to §4.2 ATC Check Results (IMP-03, IMP-04)
- **[2026-05-23]**: `agents/read-only-analyst.md`: Inline ABAP SQL Quick Reference replaced with canonical reference pointer to `docs/context.md` (IMP-08)
- **[2026-05-23]**: `agents/dba.md`: SQL syntax rule reference added to behavior rules (IMP-08)
- **[2026-05-23]**: `agents/interface-expert.md`: Confirmed tool availability note added to `## Your Tools` section (IMP-02)

---

## [0.5.0] — 2026-05-20

### Fixed
- `docs/setup-guide.md §9`: Rewrote ZADT_VSP installation section with mandatory order warning (9-A → 9-C → 9-D)
- `docs/setup-guide.md §9-C`: Expanded SAPC and SICF finalization into step-by-step field-by-field guides with exact transaction codes, navigation paths, failure recovery instructions, and `⚠️ mandatory — do not skip` warning
- `docs/setup-guide.md §9-D`: Added failure checklist (SAPC handler, SICF active status, `S_BTCH_ADM` authorization)
- `docs/setup-guide.md §12`: `VSP_ALLOWED_PACKAGES` → `SAP_ALLOWED_PACKAGES` (prefix consistency)
- `docs/antigravity-setup.md`: `VSP_MODE`, `VSP_ALLOWED_PACKAGES`, `VSP_FEATURE_*` → `SAP_*` prefix throughout
- `scripts/install-vsp.sh`: Added step 4 in Next steps — ZADT_VSP install and SAP GUI finalization reminder with §9-C reference; corrected example port `8080` → `44300`
- `scripts/install-vsp.ps1`: Same as above for Windows

### Changed
- `AGENTS.md`: Strengthened preamble with explicit `⚠️ For AI tools reading this file` warning — clarifies this is a registry/orchestration reference, not behavioral instructions; redirects each tool to its own config file (`CLAUDE.md`, `GEMINI.md`, `.codex/config.toml`)
- `AGENTS.md`: Subtitle updated from "Agent Definitions" to "Agent Registry & Orchestration Contract"

---

## [0.4.0] — 2026-05-19

### Added
- `docs/tooling-matrix.md`: New file — Tool Selection Rule table and Hook Behavior table comparing Claude Code CLI, Desktop App, Gemini CLI, and Antigravity
- `AGENTS.md`: Agent Role Boundary Matrix — research agent disambiguation, technical agent boundaries, analyst trigger keywords, and escalation rules
- `docs/context.md`: Directory Reference table documenting all 9 project directories with Git-tracking status
- `docs/context.md`: Documentation Language rule extended to cover git artifacts (commit messages, PR titles, branch names)
- `C:/git/CLAUDE.md`: Git Conventions section requiring English for all git artifacts

### Fixed
- `agents/pm.md`: `color: gold` → `color: yellow`; removed non-existent `browser_subagent` tool reference
- `agents/devops-admin.md`: `color: orange` → `color: yellow`
- `agents/dba.md`, `read-only-analyst.md`, `sap-investigator.md`, `schema-inspector.md`: `color: purple` → `color: magenta`
- `.codex/config.toml`: All `VSP_*` env vars → `SAP_*` prefix (`VSP_MODE` → `SAP_MODE`, etc.)
- `scripts/vsp-audit.ps1`: Enforced script pairing (removed `sync-md` exemption, activated `$failed = $true`); added Check 5 — MCP prefix consistency
- `scripts/vsp-audit.sh`: Removed `install-vsp` exemption from pairing check; added Check 5 — MCP prefix consistency

---

## [0.3.0] — 2026-05-19

### Added
- `docs/plugin-setup.md`: Dedicated plugin installation guide (marketplace vs. standalone flows)
- `scripts/vsp-publish.sh` / `.ps1`: Automated packaging and publishing pipeline scripts
- `scripts/sync-md.sh` / `.ps1`: Cross-platform hook wrapper for PostToolUse audit trigger
- `docs/tooling-matrix.md`: Initial tooling comparison (superseded by v0.4.0 version)

### Changed
- `AGENTS.md`: Consolidated common session rules (memory logging, documentation language, file isolation, post-write chain, git reflection) into single authoritative section
- `docs/context.md`: Established as single source of truth for shared engineering content; removed duplicated sections from `CLAUDE.md` and `GEMINI.md`
- `CLAUDE.md` / `GEMINI.md`: Reduced to platform-specific adapter files with links to `docs/context.md`
- MCP documentation server domains updated to `marianzeis.de` endpoints (`mcp-abap.marianzeis.de`, `mcp-sap-docs.marianzeis.de`)
- `scratch/` restructured into `scratch/tasks/` (active task files), `scratch/stable/` (read-only ABAP snapshots), `scratch/temp/` (throwaway, not committed)

### Fixed
- `scripts/vsp-audit.ps1`: Script pairing check hardened; `.ps1` / `.sh` pair enforcement activated
- `scripts/vsp-audit.sh`: Script pairing check fixed for Windows Git Bash compatibility
- `.mcp.json.sample`: MCP URLs corrected to live `marianzeis.de` endpoints
- Agent YAML frontmatter errors corrected across multiple agent files
- Git worktree paths repaired in hook configuration

---

## [0.2.0] — 2026-05-19

### Added
- `agents/interface-expert.md`: New Interface Expert agent for RFC/BAPI/IDoc integration
- Subagent parallel execution framework: `§0-A` dispatch block pattern in `AGENTS.md`
- SAP module analyst agents elevated with full execution context (SD, MM, FI, CO, PP, LE)
- `scripts/`: `vsp-sync.sh` / `.ps1`, `vsp-task.sh` / `.ps1`, `vsp-audit.sh` / `.ps1`
- `.claude/settings.json`: Team-shared permissions committed to repo
- `.codex/config.toml` and `.codex/hooks.json`: Codex tool configuration
- `docs/setup-guide.md`: Comprehensive multi-platform environment setup guide (SAP, Claude Code, Gemini CLI, Antigravity)
- `docs/antigravity-setup.md`: Antigravity VS Code extension configuration guide
- `docs/security.md`: Security and sanitization rules
- `docs/mcp_usage.md`: MCP tool usage patterns and critical limitations (ABAP SQL syntax)

### Changed
- `AGENTS.md`: PM-led governance model established; triage → dispatch → QA → finalization workflow
- `README.md`: Updated with Harness Engineering concept and PM-led workflow
- SAP connection config migrated from `.vsp.json` to `.env` file

### Fixed
- `ZCL_VSP_APC_HANDLER`: Added `S_DEVELOP` authority check for security hardening
- `ZPROG_SBOOK_QUERY`: Refactored to OO-ABAP pattern

---

## [0.1.0] — 2026-05-01

### Added
- Initial commit: vsp ABAP development harness framework
- `docs/context.md`: Shared engineering context (vsp build commands, codebase map)
- `AGENTS.md`: Initial agent role definitions (Business Group + Technical Group)
- `CLAUDE.md`: Claude Code configuration
- `GEMINI.md`: Gemini CLI configuration
- `agents/`: Core agent definitions — pm, architect, code-writer, dba, devops-admin, fiori-developer, form-expert, gui-scripter, test-runner, read-only-analyst, sap-investigator, schema-inspector
- `agents/`: SAP module analysts — sd, mm, fi, co, pp, le
- `skills/abap-dev/SKILL.md`: SAP development workflows and MCP optimization
- `skills/post-write-chain/SKILL.md`: Mandatory QA chain (SyntaxCheck → RunUnitTests → RunATCCheck)
- `commands/`: triage, new-task, sync, transport, post-write, memlog, celebrate
- `.mcp.json`: MCP server configuration (vsp hyperfocused mode, abap-docs, sap-docs)
- `memory/`: Date-stamped development log directory
- `scratch/`: Working directory for ABAP sources and task files
- `LICENSE`: AGPL-3.0-only

test change
