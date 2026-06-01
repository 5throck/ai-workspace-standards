# context.md

> **Immutable project identity** for the abap_vibe_coding variant.
> 
> This file contains only **unchanging project identity** and **architecture overview**.
> 
> **Variant-specific customization** (tech stack, agents, workflow) lives in `docs/abap.context.md`.
> 
> **Workspace governance rules** are defined in the workspace root **CONSTITUTION.md** — this variant references those rules and does not duplicate them.

---

## Project Overview

SAP ABAP Harness Engineering framework --a PM-led, multi-agent development harness for SAP ABAP projects using the **vsp** MCP server. Provides governance workflows, role-based agents, reusable skills, and automated QA chains for ABAP development.

> **Variant architecture**: This project is a **co-develop variant** of the workspace root standards.
> All governance (multi-agent architecture, PR workflow, coding guidelines) is defined in workspace root CONSTITUTION.md and referenced here.

---

## Governance References

This project is a **co-develop variant**. All governance rules are defined in the workspace root **CONSTITUTION.md**:

### Core Governance Sections

| Governance Area | CONSTITUTION.md Section | Description |
|----------------|-------------------------|-------------|
| **Folder Structure** | §1 | Standard folder layout (src/, docs/, scripts/, memory/, agents/, skills/) |
| **Memory System** | §2 | Session logging format (4-section), CHANGELOG vs memory separation |
| **GitHub PR Workflow** | §3 | All changes via PR, /sync pipeline, English-only artifacts |
| **Multi-Agent Architecture** | §5 | Role-based agents, PM Gateway, 3-tier cost optimization |
| **PM Gateway Workflow** | §5.5 | Mandatory execution plan display, specialist dispatch rules |
| **Agent Lifecycle** | §5.6 | Agent states (active/deprecated/retired), PM ownership |
| **Skill Lifecycle** | §6 | Skill creation, version management, platform parity |
| **Script Lifecycle** | §6.5 | L0/L1/L2 script layers, dependency tracking |
| **Coding Guidelines** | §8 | Think before coding, simplicity first, no hardcoded secrets |
| **Operations Workflow** | §9 | Weekly health checks, monthly lifecycle reviews |

> **Workspace root CONSTITUTION.md location**: `/c/git/CONSTITUTION.md`
> **How to reference**: When governance questions arise, consult the appropriate CONSTITUTION.md section. Do not duplicate governance rules locally.

---

## Coding Guidelines

> **Note**: Coding guidelines are defined in workspace root CONSTITUTION.md §8.
> This section is present for audit.ps1 compatibility.

See CONSTITUTION.md §8 for complete coding guidelines:
- Think before coding
- Simplicity first
- No hardcoded secrets
- English-only documentation (except ko/ and locales/ko/)
- Git commit messages via /sync pipeline only

---

## Architecture

> **Full codebase map**: See `docs/abap.context.md` for ABAP-specific architecture details.

### High-Level Structure

```
abap_vibe_coding/
├── agents/          # 19 AI agent role definitions (SAP-specific)
├── skills/          # ABAP development skills (abap-dev, post-write-chain, sap-*)
├── scripts/         # Cross-platform automation (dev-sync, audit, vsp-sync)
├── memory/          # Session logs (YYYY-MM-DD.md)
├── scratch/         # Active work files (tasks/, stable/, temp/)
├── docs/            # Documentation (context.md, abap.context.md, ADRs)
├── vsp             # vsp binary (gitignored -- install via scripts)
└── .mcp.json        # MCP server config (gitignored -- from .env)
```

### Directory Reference

| Directory | Purpose | Git-tracked? |
|-----------|---------|:--------------:|
| `agents/` | Agent role definitions (`.md` files) for all AI tools | Yes |
| `skills/` | Skill definitions (`SKILL.md`) loaded per-session | Yes |
| `docs/` | Shared engineering documentation | Yes |
| `memory/` | Date-stamped development logs (`YYYY-MM-DD.md`) | Yes |
| `scratch/tasks/` | Active task handoff files | Yes |
| `scratch/stable/` | Exported ABAP sources (read-only snapshots) | Yes |
| `scratch/temp/` | Throwaway work files | No (gitignored) |
| `.agents/` | Claude Code plugin runtime cache | No (auto-generated) |
| `.claude/worktrees/` | Parallel session worktrees | No (auto-managed) |

> **Workspace reference**: See CONSTITUTION.md §1 for standard folder structure rules.

---

## Governance References

This project is a **co-develop variant**. All governance rules are defined in the workspace root **CONSTITUTION.md**:

### Core Governance Sections

| Governance Area | CONSTITUTION.md Section | Description |
|----------------|-------------------------|-------------|
| **Folder Structure** | §1 | Standard folder layout (src/, docs/, scripts/, memory/, agents/, skills/) |
| **Memory System** | §2 | Session logging format (4-section), CHANGELOG vs memory separation |
| **GitHub PR Workflow** | §3 | All changes via PR, /sync pipeline, English-only artifacts |
| **Multi-Agent Architecture** | §5 | Role-based agents, PM Gateway, 3-tier cost optimization |
| **PM Gateway Workflow** | §5.5 | Mandatory execution plan display, specialist dispatch rules |
| **Agent Lifecycle** | §5.6 | Agent states (active/deprecated/retired), PM ownership |
| **Skill Lifecycle** | §6 | Skill creation, version management, platform parity |
| **Script Lifecycle** | §6.5 | L0/L1/L2 script layers, dependency tracking |
| **Coding Guidelines** | §8 | Think before coding, simplicity first, no hardcoded secrets |
| **Operations Workflow** | §9 | Weekly health checks, monthly lifecycle reviews |

> **How to reference**: When governance questions arise, consult the appropriate CONSTITUTION.md section. Do not duplicate governance rules locally.

---

## Initial Context Files (Session Start)

**Read order for abap_vibe_coding variant**:

> **Tool-specific instructions**: 
> - **Claude Code / CLI tools**: Read files using native file reading capabilities
> - **Gemini / Web UI tools**: Use `@` file reference syntax to load into context

```
0. git config core.hooksPath .githooks         # Activate hooks (run once per clone)
1. ../../CONSTITUTION.md                         # Workspace governance (read once, reference as needed)
2. docs/context.md (this file)                  # Immutable project identity
3. docs/abap.context.md                         # ABAP-specific customization
4. AGENTS.md                                     # Agent roster
5. memory/MEMORY.md                              # Recent session history (if exists)
6. skills/abap-dev/SKILL.md                      # SAP development workflows
7. skills/post-write-chain/SKILL.md              # Mandatory QA chain after any write
```

**File purpose summary**:
- **CONSTITUTION.md**: Workspace governance rules (read from workspace root)
- **docs/context.md** (this file): Immutable project identity and architecture
- **docs/abap.context.md**: ABAP-specific tech stack, agents, workflow
- **AGENTS.md**: Canonical agent registry and dispatch protocols
- **memory/MEMORY.md**: Index of daily session logs
- **skills/**: Per-session skills for ABAP development and QA

---

## Variant Extension

> **ABAP-specific content**: All ABAP development details (tech stack, environment setup, agents, workflow rules) are documented in `docs/abap.context.md`.
> 
> **Workspace standards**: All governance, coding behavior, and operational rules are defined in workspace root CONSTITUTION.md and referenced above.
> 
> This separation ensures:
> - ✓ Governance consistency across all variants (single source of truth)
> - ✓ Clear separation between immutable identity (this file) and customizable content (abap.context.md)
> - ✓ No duplication of workspace standards
> - ✓ ABAP domain specificity preserved

---

## Phase 3 Deployment Notice (Deployed)

**Status**: 🚨 DEPLOYED (2026-06-02)

**What's New**:
- vsp-sync.ps1 with hook architecture (SAP-first orchestration)
- Solution C integration (--incremental flag for faster validation)
- Domain-driven workflow (code-writer owned SAP sync)
- Non-blocking post-hook execution

**Breaking Changes** (see Migration Guide below):
- **Script Name**: `vsp-dev-sync.ps1` → `vsp-sync.ps1`
- **Flag Changes**: `-SkipAudit` → `-NoAudit`, `-SkipMcpSync` → `-NoMcp`, `-SkipSapSync` → `-NoPostHook`
- **Script Removal**: `vsp-dev-sync.ps1` will be removed post-2026-06-15

**What You Should Do**:
- **IMMEDIATE**: Switch to `vsp-sync.ps1` for all sync operations
- **Update CI/CD**: Replace `vsp-dev-sync.ps1` with `vsp-sync.ps1` and adjust flags
- **Review Migration Guide**: See breaking changes table below for detailed migration path
- **Use New Flags**: `-NoAudit` for fast iteration, `-NoMcp` for MCP maintenance, `-NoPostHook` for minimal sync

**Migration Timeline**:
- **Immediate**: Use vsp-sync.ps1 (primary script)
- **Week 1-2**: Update all CI/CD pipelines
- **Week 3**: Test new flags in development workflows
- **Post-2026-06-15**: Remove vsp-dev-sync.ps1 (deprecated)

**Benefits**:
- 0.58s average execution time (vs 1.2s Phase 2)
- Hook extensibility for future domain-specific enhancements
- Solution C for 50% faster iteration with incremental audit
- Clear domain ownership (code-writer manages SAP sync)

**Questions**: Contact code-writer or pm

### Migration Guide

| Scenario | Phase 2 Command | Phase 3 Command | Migration Priority |
|----------|----------------|----------------|-------------------|
| Full sync | `.\scripts\vsp-dev-sync.ps1 -Message "feat: update"` | `.\scripts\vsp-sync.ps1 -Message "feat: update"` | **HIGH** |
| Fast iteration | `.\scripts\vsp-dev-sync.ps1 -Message "feat: update" -SkipAudit` | `.\scripts\vsp-sync.ps1 -Message "feat: update" -NoAudit` | **HIGH** |
| MCP maintenance | `.\scripts\vsp-dev-sync.ps1 -Message "update mcp" -SkipMcpSync` | `.\scripts\vsp-sync.ps1 -Message "update mcp" -NoMcp` | **HIGH** |
| SAP sync only | `.\scripts\vsp-dev-sync.ps1 -Message "sap only" -SkipSapSync` | `.\scripts\vsp-sync.ps1 -Message "sap only" -NoPostHook` | **MEDIUM** |
| Debug mode | `.\scripts\vsp-dev-sync.ps1 -Message "debug" -SkipAudit -SkipMcpSync -SkipSapSync` | `.\scripts\vsp-sync.ps1 -Message "debug" -NoAudit -NoMcp -NoPostHook` | **MEDIUM** |

### Breaking Changes

| Change | Type | Impact | Mitigation |
|--------|------|--------|------------|
| **Script name**: `vsp-dev-sync.ps1` → `vsp-sync.ps1` | Breaking | HIGH (CI/CD pipelines) | Update all references immediately |
| **Flag**: `-SkipAudit` → `-NoAudit` | Breaking | MEDIUM (user muscle memory) | Use `-NoAudit` for fast iteration |
| **Flag**: `-SkipMcpSync` → `-NoMcp` | Breaking | MEDIUM (user muscle memory) | Use `-NoMcp` for MCP maintenance |
| **Flag**: `-SkipSapSync` → `-NoPostHook` | Breaking | LOW (rare use case) | Use `-NoPostHook` for minimal sync |

---

*Last Updated: 2026-06-01 - Phase 3 deployment completed*
*See ADR-0022 for transition plan and BREAKING CHANGES notice*
