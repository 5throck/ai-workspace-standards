# Project Improvement Design: VSP Harness Engineering

**Date:** 2026-05-24
**Status:** Approved
**Author:** PM Agent + All Agents Review

---

## Executive Summary

This document outlines a comprehensive improvement plan for the VSP (SAP ABAP) Harness Engineering project. The plan addresses configuration management, script standardization, agent coordination, skill system enhancement, and automation/monitoring.

**Key Decision:** Migrate to **Bun-based single-source scripts** for cross-platform compatibility and reduced maintenance burden.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Design Principles](#design-principles)
3. [Phase 1: Foundation Layer](#phase-1-foundation-layer)
4. [Phase 2: Orchestration Layer](#phase-2-orchestration-layer)
5. [Phase 3: Automation & Monitoring](#phase-3-automation--monitoring)
6. [Implementation Priority](#implementation-priority)
7. [Migration Strategy](#migration-strategy)

---

## Problem Statement

### Current Issues Identified

| Area | Issue | Impact |
|------|-------|--------|
| **Configuration** | `.claude/settings.json` and `.gemini/settings.json` are duplicated | Maintenance burden, drift risk |
| **Scripts** | `.sh` + `.ps1` dual maintenance | 2x work, synchronization errors |
| **Documentation** | Content overlap between `context.md` and `AGENTS.md` | Confusion, inconsistent updates |
| **Hooks** | Desktop App doesn't fire PostToolUse hooks | Manual QA required |
| **Monitoring** | No health check system | Issues detected late |

---

## Design Principles

1. **Single Source of Truth:** Each piece of information lives in exactly one place
2. **Cross-Platform Compatibility:** Solutions must work on Windows, Linux, macOS
3. **Automation Over Manual:** Use tooling to prevent human error
4. **Backward Compatibility:** Maintain compatibility during transition
5. **Pragmatism Over Purity:** Choose practical solutions over theoretical perfection

---

## Phase 1: Foundation Layer

### 1A. Documentation Structure Reorganization

**Current State:**
- `docs/context.md` and `AGENTS.md` have overlapping content
- `memory/` vs `CHANGELOG.md` boundary unclear

**Target State:**

| File | Role | Owner |
|------|------|-------|
| `docs/context.md` | Common engineering rules (build, codebase map, ABAP rules) | All |
| `AGENTS.md` | Agent registry and orchestration contract | PM |
| `CLAUDE.md` | Claude Code-specific configuration | Claude |
| `GEMINI.md` | Gemini CLI-specific configuration | Gemini |

**Memory vs Changelog Rule (Reinforced):**
```
memory/YYYY-MM-DD.md → HOW & WHY (design decisions, debugging context)
CHANGELOG.md         → WHAT (user-visible changes)
```

**Action Items:**
- [ ] Remove agent workflow sections from `docs/context.md` → migrate to `AGENTS.md`
- [ ] Add `scripts/update-memory-index.sh/.ps1` for automatic index updates
- [ ] Standardize `CHANGELOG.md` template

---

### 1B. Bun-based Script Standardization

**Decision:** Migrate from dual `.sh`/`.ps1` to single-source `.ts` files powered by Bun.

**Rationale:**
- Single file to maintain (vs 2x with .sh/.ps1)
- Native TypeScript support (no build step)
- Cross-platform by design
- Modern language features (async/await, native JSON)
- Fast startup (~50ms, negligible vs human time)

**Target File Structure:**

```
scripts/
├── Core Scripts (TypeScript - Single Source)
│   ├── dev-sync.ts       # Full dev sync pipeline
│   ├── audit.ts          # Documentation audit
│   ├── sync-mcp.ts       # MCP config synchronization
│   ├── health-check.ts   # System health monitoring
│   ├── post-write.ts     # Post-write QA chain
│   └── verify-skills.ts  # Skill verification
│
├── Legacy Wrappers (Optional backward compat)
│   ├── dev-sync.sh       # → `bun scripts/dev-sync.ts "$@"`
│   ├── audit.sh
│   └── ...
│
├── Runtime
│   ├── install-bun.sh    # Bun installer for Unix/macOS
│   └── install-bun.ps1   # Bun installer for Windows
│
├── Package
│   ├── package.json      # Bun manifest
│   ├── bun.lockb         # Lock file
│   └── tsconfig.json     # TypeScript config
│
└── README.md             # Usage documentation
```

**Prerequisites:**
```bash
# Install Bun (one-time)
curl -fsSL https://bun.sh/install | bash           # Unix/macOS
powershell -c "irm bun.sh/install.ps1"             # Windows
```

**Usage:**
```bash
# Direct execution
bun scripts/dev-sync.ts "feat: add feature"

# Via npm scripts
bun run dev-sync "feat: add feature"

# Legacy wrappers (backward compatible)
bash scripts/dev-sync.sh "feat: add feature"
```

**Action Items:**
- [ ] Create `scripts/package.json` with Bun scripts
- [ ] Implement core `.ts` scripts (dev-sync, audit, sync-mcp, health-check, post-write, verify-skills)
- [ ] Create `install-bun.sh/.ps1` installers
- [ ] Add legacy wrappers for backward compatibility
- [ ] Update `scripts/README.md` with Bun usage guide
- [ ] Add `.gitignore` rule: `*.cmd` (prevent cmd file creation)

---

### 1C. MCP Configuration with Sync Script

**Decision:** Create `.mcp.json` as Single Source of Truth, sync to tool-specific settings.

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│  .mcp.json (Single Source of Truth)                    │
│  - MCP server definitions (abap, abap-docs, codegraph) │
│  - Common environment variables (SAP_*, features)      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  scripts/sync-mcp.ts                                   │
│  - .mcp.json → .claude/settings.json                   │
│  - .mcp.json → .gemini/settings.json                   │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│ .claude/settings    │       │ .gemini/settings    │
│ (Claude-specific)   │       │ (Gemini-specific)   │
│ + permissions       │       │ + tool options      │
│ + hooks             │       │ + subagent config   │
└─────────────────────┘       └─────────────────────┘
```

**`.mcp.json` Content:**
```json
{
  "mcpServers": {
    "abap": {
      "command": "./vsp",
      "args": ["--mode", "hyperfocused"],
      "env": {
        "SAP_MODE": "hyperfocused",
        "SAP_ALLOWED_PACKAGES": "Z*,,$TMP,$ZADT_VSP,$VSP_ADT",
        "SAP_FEATURE_ABAPGIT": "on",
        "SAP_FEATURE_TRANSPORT": "on",
        "SAP_FEATURE_UI5": "on",
        "SAP_FEATURE_RAP": "on"
      }
    },
    "abap-docs": {
      "type": "http",
      "url": "https://mcp-abap.marianzeis.de/mcp"
    },
    "sap-docs": {
      "type": "http",
      "url": "https://mcp-sap-docs.marianzeis.de/mcp"
    },
    "codegraph": {
      "command": "npx",
      "args": ["-y", "@colbymchenry/codegraph", "serve"]
    }
  }
}
```

**Action Items:**
- [ ] Create `.mcp.json` with common MCP server definitions
- [ ] Implement `scripts/sync-mcp.ts` synchronization script
- [ ] Add pre-commit hook to check configuration drift
- [ ] Update `CLAUDE.md` and `GEMINI.md` with workflow documentation

---

## Phase 2: Orchestration Layer

### 2A. Agent Coordination Improvements

**Current Issues:**
- Parallel dispatch context passing is duplicated
- Serial vs Parallel decision tree is complex
- Agent handoff format not standardized

**Proposed Improvements:**

| Area | Change |
|------|--------|
| **Dispatch Template** | Standardized subagent prompt templates (`templates/dispatch-*.md`) |
| **Context Pass** | `--context-file` argument for context passing standardization |
| **Handoff Format** | JSON-based handoff (`scratch/handoff-*.json`) |
| **Error Recovery** | Subagent failure retry/fallback policy documentation |

**Action Items:**
- [ ] Create `templates/dispatch-parallel.md` - parallel dispatch template
- [ ] Create `templates/dispatch-serial.md` - serial dispatch template
- [ ] Create `agents/handoff-spec.md` - handoff format specification
- [ ] Add error recovery section to `AGENTS.md`

---

### 2B. Skill System Enhancement

**Current Issues:**
- Desktop App doesn't fire PostToolUse hooks
- Post-Write chain must be run manually
- Skill discovery and loading not automated

**Proposed Improvements:**

| Issue | Solution |
|-------|----------|
| **Desktop App hooks** | `skills/desktop-app-fallback/SKILL.md` - manual execution guide |
| **Post-Write automation** | `scripts/post-write.ts` - automatic chain execution |
| **Skill index** | `skills/SKILLS.md` - auto-generated skill index |
| **Skill verification** | `scripts/verify-skills.ts` - skill loading verification |

**Action Items:**
- [ ] Create Desktop App fallback skill
- [ ] Implement `scripts/post-write.ts` wrapper
- [ ] Auto-generate `skills/SKILLS.md` index
- [ ] Create `scripts/verify-skills.ts` for skill verification

---

## Phase 3: Automation & Monitoring

### 3A. QA Automation Enhancement

**Current State:**
- SyntaxCheck → RunUnitTests → RunATCCheck executed manually
- ATC Priority 1 findings blocking rule exists but under-automated

**Proposed Improvements:**

| Component | Purpose |
|-----------|---------|
| `scripts/qa-full.ts` | Full QA chain execution |
| `scripts/qa-quick.ts` | Quick syntax check only |
| `.githooks/pre-commit` | QA check required before commit |
| `scratch/qa-reports/` | QA report auto-save |

**Action Items:**
- [ ] Create `scripts/qa-full.ts` and `scripts/qa-quick.ts`
- [ ] Integrate QA into pre-commit hook
- [ ] Create QA report template

---

### 3B. Connection State Monitoring

**Proposed Monitoring Stack:**

```
scripts/health-check.ts
├── vsp health check (SAP connectivity)
├── MCP server status (abap, codegraph)
├── Git repo status (uncommitted changes)
└── Memory log status (today's log exists)
```

**Output Format:** Markdown table + JSON status file

**Action Items:**
- [ ] Create `scripts/health-check.ts`
- [ ] Set up cron/background job for periodic execution
- [ ] Create status dashboard (`scratch/status.md`)

---

## Implementation Priority

| Phase | Component | Complexity | Impact | Priority |
|-------|-----------|:----------:|:------:|:--------:|
| 1C | `.mcp.json` + Sync Script | Medium | High | **P0** |
| 1B | Bun runtime setup | Low | High | **P0** |
| 1B | Core .ts scripts | Medium | High | **P0** |
| 1B | Legacy wrappers | Low | Low | P2 |
| 1A | Documentation reorganization | Low | Medium | P1 |
| 2A | Agent coordination | High | High | **P0** |
| 2B | Skill system enhancement | Medium | High | P1 |
| 3A | QA automation (.ts) | Low | Medium | P1 |
| 3B | Status monitoring (.ts) | Low | Low | P2 |

---

## Migration Strategy

### Phase 1: Coexistence (Week 1)
- Keep existing `.sh`/`.ps1` scripts
- Add new `.ts` versions alongside
- Document both as valid options
- Install Bun runtime

### Phase 2: Gradual Shift (Weeks 2-3)
- New scripts written in `.ts`
- Critical scripts migrated first (dev-sync, audit, sync-mcp)
- Compare outputs between old and new

### Phase 3: Full Migration (Week 4)
- Deprecate `.sh`/`.ps1` (keep as legacy wrappers)
- Remove dual maintenance
- Bun as primary runtime
- Update all documentation

---

## Success Criteria

- [ ] `.mcp.json` created and synced to both tool settings
- [ ] Bun runtime installed and verified
- [ ] At least 3 core scripts migrated to `.ts`
- [ ] Documentation reorganization completed
- [ ] Agent dispatch templates created
- [ ] Skill index auto-generated
- [ ] Health check operational

---

## Appendix A: File Manifest

### New Files to Create

```
docs/superpowers/specs/2026-05-24-project-improvement-design.md
.mcp.json
scripts/package.json
scripts/tsconfig.json
scripts/dev-sync.ts
scripts/audit.ts
scripts/sync-mcp.ts
scripts/health-check.ts
scripts/post-write.ts
scripts/verify-skills.ts
scripts/install-bun.sh
scripts/install-bun.ps1
scripts/README.md
templates/dispatch-parallel.md
templates/dispatch-serial.md
agents/handoff-spec.md
skills/desktop-app-fallback/SKILL.md
skills/SKILLS.md
```

### Files to Modify

```
docs/context.md (remove agent workflow sections)
AGENTS.md (add error recovery section)
CLAUDE.md (update MCP workflow)
GEMINI.md (update MCP workflow)
.githooks/pre-commit (add QA and drift checks)
```

---

*Document Version: 1.0*
*Last Updated: 2026-06-01*
