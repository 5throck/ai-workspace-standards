# Scripts Index

This document provides an index of all automation scripts in the workspace, including their purpose, version, and usage.

## Scripts Strategy

### Revised 3-Tier Script Strategy (2026-06-02)

The script architecture has been redefined to align with actual implementation patterns and eliminate the documented/implementation gap that existed in the "Hybrid Scripting Automation" model (2026-05-25).

#### Strategy Background
- **Issue Identified**: audit.ts v2.6.0 (Solution C, Diff Algorithm) deployed as TypeScript using Bun runtime, contradicting the documented PowerShell/Bass model
- **Resolution**: Consolidated 7 duplicate scripts (audit.sh/ps1, sync-mcp.sh, sync-md.sh/ps1, gen-pr-body.sh/ps1) into single-source TypeScript implementation
- **New Model**: Three-tier categorization by technical requirements, deployment environment, and complexity

#### 3-Tier Architecture

| Tier | Technology | Examples | Criteria | Purpose |
|------|------------|----------|----------|---------|
| **Tier 1 (Core Utilities)** | Bun .ts | audit.ts, sync-mcp.ts, sync-md.ts, vsp-sync.ts, vsp-task.ts, vsp-publish.ts, git-sync.ts | Complex logic, Solution C, reusability required, global use | Complex workspace validation, MCP synchronization, date management, VSP pipeline automation, git operations |
| **Tier 2 (Domain Utilities)** | Shell/PowerShell | (None currently active) | SAP-specific, simple logic, platform-dependent, ABAP environment | SAP-specific validation, VSP domain utilities |
| **Tier 3 (Agent Orchestration)** | Bun .ts | dispatch.ts, retry-handler.ts, verify-skills.ts | Complex async handling, PM Gateway, multi-agent coordination | Agent dispatch, retry logic, skill verification |

#### Selection Guidelines
- **Use Tier 1** when: Complex business logic required, cross-platform compatibility needed, Solution C algorithms involved, global workspace operations, VSP pipeline automation
- **Use Tier 2** when: SAP-specific validation, Windows-native operations, ABAP environment optimization, simple domain-specific logic
- **Use Tier 3** when: Async process coordination, multi-agent workflows, PM Gateway compliance, error handling with retries

---

## Core Sync Scripts

### vsp-sync.ts (Phase 3 - Current)

**Version**: 1.0.0
**Status**: Active (Current Primary)
**Owner**: code-writer (Phase 3)
**Purpose**: SAP-first sync pipeline with hook architecture, Solution C (incremental audit)
**Technology**: TypeScript (Bun runtime) - Platform-neutral implementation

**Usage**:
```bash
bun run scripts/vsp-sync.ts -m "feat: add new report"
bun run scripts/vsp-sync.ts -m "feat: update" --no-audit
bun run scripts/vsp-sync.ts -m "fix: bug fix" --no-mcp
bun run scripts/vsp-sync.ts -m "docs: update" --no-post-hook
bun run scripts/vsp-sync.ts -m "test: e2e" --no-audit --no-mcp --no-post-hook
```

**Parameters**:
- `-m, --message <msg>`: Commit message (required)
- `--no-audit`: Skip audit hook (runs with --incremental instead)
- `--no-mcp`: Skip MCP sync hook
- `--no-post-hook`: Skip sync-md.ts post-hook
- `-h, --help`: Show help message

**Hook Architecture**:
1. Pre-Hook 1: audit.ts (workspace validation, critical)
2. Pre-Hook 2: sync-mcp.ts (MCP configuration sync, non-critical)
3. Main: SAP Sync Logic (documentation + memory + git commit)
4. Post-Hook: sync-md.ts (memory index update)

**Features**:
- Hook-based extensibility
- Solution C (incremental audit mode) with --incremental flag
- Domain-driven orchestration (SAP logic isolated)
- Non-blocking post-hook execution
- Diff Algorithm implementation (audit.ts v2.6.0)
- **Platform-neutral**: Works on Windows, macOS, and Linux (Bun runtime)
- **3-Tier Strategy**: Tier 2 Domain Utility (SAP-specific logic, now TypeScript for cross-platform)

**Migration from vsp-sync.ps1**:
- PowerShell parameters: `-Message` → `-m`, `-NoAudit` → `--no-audit`, `-NoMcp` → `--no-mcp`, `-NoPostHook` → `--no-post-hook`
- Same functionality, improved cross-platform compatibility

---

### vsp-dev-sync.ps1 (Phase 2 - Deprecated)

**Version**: 1.0.0
**Status**: Deprecated (use vsp-sync.ps1)
**Owner**: devops-admin (Phase 2) → code-writer (Phase 3)
**Purpose**: Hybrid sync pipeline combining workspace audit, MCP sync, and VSP infrastructure sync

**Deprecation Notice**: This script is maintained only for backward compatibility during the Phase 2→Phase 3 transition (2026-06-01 to 2026-06-15). Will be removed in Phase 4.

**Usage** (Legacy):
```powershell
.\scripts\vsp-dev-sync.ps1 -Message "feat: update" -SkipAudit
.\scripts\vsp-dev-sync.ps1 -Message "feat: update" -SkipMcpSync
```

**Migration Path**:
- Script name: `vsp-dev-sync.ps1` → `vsp-sync.ps1`
- Flag: `-SkipAudit` → `-NoAudit`
- Flag: `-SkipMcpSync` → `-NoMcp`
- Flag: `-SkipSapSync` → `-NoPostHook`

---

### vsp-task.ts (Phase 3 - Current)

**Version**: 1.0.0
**Status**: Active (Current Primary)
**Owner**: code-writer (Phase 3)
**Purpose**: VSP task automation with error handling and retry logic
**Technology**: TypeScript (Bun runtime) - Platform-neutral implementation

**Usage**:
```bash
bun run scripts/vsp-task.ts --task "create_report" --system "SAP"
bun run scripts/vsp-task.ts --task "generate_transport" --retry 3
bun run scripts/vsp-task.ts --task "validate_objects" --fail-fast
```

**Parameters**:
- `-t, --task <task>`: Task type (required)
- `-s, --system <system>`: Target system (required)
- `--retry <count>`: Retry count (default: 3)
- `--fail-fast`: Stop on first failure
- `-h, --help`: Show help message

**Features**:
- Cross-platform task execution
- Enhanced error handling with retry logic
- Platform-aware SAP invocation (Windows: powershell.exe, Unix: pwsh)
- Automated failure recovery and rollback
- **Platform-neutral**: Works on Windows, macOS, and Linux (Bun runtime)
- **3-Tier Strategy**: Tier 1 Core Utility (cross-platform task automation)

**Migration from vsp-task.ps1**:
- PowerShell parameters: `-Task` → `--task`, `-System` → `--system`, `-Retry` → `--retry`
- Enhanced cross-platform compatibility and error handling
- Same functionality, improved reliability

---

### vsp-publish.ts (Phase 3 - Current)

**Version**: 1.0.0
**Status**: Active (Current Primary)
**Owner**: code-writer (Phase 3)
**Purpose**: VSP publishing pipeline with distribution support
**Technology**: TypeScript (Bun runtime) - Platform-neutral implementation

**Usage**:
```bash
bun run scripts/vsp-publish.ts --package "my-vsp" --version "1.0.0"
bun run scripts/vsp-publish.ts --package "my-vsp" --version "1.0.0" --dry-run
bun run scripts/vsp-publish.ts --package "my-vsp" --version "1.0.0" --skip-validation
```

**Parameters**:
- `-p, --package <name>`: Package name (required)
- `-v, --version <version>`: Version number (required)
- `--dry-run`: Preview without executing
- `--skip-validation`: Skip package validation
- `-h, --help`: Show help message

**Features**:
- Unified publishing workflow across all platforms
- Automated packaging and release management
- Robust error handling and rollback capabilities
- Package validation and integrity checking
- **Platform-neutral**: Works on Windows, macOS, and Linux (Bun runtime)
- **3-Tier Strategy**: Tier 1 Core Utility (cross-platform publishing)

**Migration from vsp-publish.ps1**:
- PowerShell parameters: `-Package` → `--package`, `-Version` → `--version`, `-DryRun` → `--dry-run`
- Enhanced cross-platform compatibility and validation
- Same functionality, improved distribution support

---

## Auxiliary Scripts

### audit.ts

**Version**: 2.6.0 (with --incremental support and Diff Algorithm)
**Purpose**: Workspace validation and documentation audit

**Features**:
- Full audit mode (default)
- Incremental mode (--incremental flag for Solution C)
- CHANGELOG.md validation
- AGENTS.md validation
- Lifecycle sync audit

**Usage**:
```bash
bun scripts/audit.ts              # Full audit
bun scripts/audit.ts --incremental # Incremental audit (fast mode)
```

---

### sync-mcp.ts

**Version**: 1.0.0
**Purpose**: MCP configuration synchronization

**Usage**:
```bash
bun scripts/sync-mcp.ts
```

---

### sync-md.ts

**Version**: 1.2.0
**Purpose**: Memory index update and synchronization

**Usage**:
```bash
bun scripts/sync-md.ts [date] [message]
```

---

### git-sync.ts

**Version**: 1.0.0
**Status**: Active
**Owner**: automation-engineer
**Purpose**: Platform-neutral git synchronization with commit and push
**Technology**: TypeScript (Bun runtime)

**Usage**:
```bash
bun scripts/git-sync.ts "feat: add new feature"
bun scripts/git-sync.ts
```

**Parameters**:
- `message`: Commit message (optional, defaults to "chore: auto-sync documentation and configuration")

**Features**:
- Cross-platform git operations (Windows, macOS, Linux)
- Automatic branch detection
- Colored terminal output (success, warning, error)
- Change detection before commit
- Graceful error handling
- Default commit message with override option
- **3-Tier Strategy**: Tier 1 Core Utility (global git operations)

---

### validate-md-language.ts

**Version**: 1.2.0
**Purpose**: Markdown language validation with I18N support

**Features**:
- Official document validation (agents, governance, skills, templates)
- Korean-only content detection
- I18N locale exclusion (ko, ja, zh-CN, zh-TW, de, es, fr, pt, vi, ms, id, th, ru, it, ar)
- Allowlisted path validation
- Automatic code block exclusion

**Usage**:
```bash
bun scripts/validate-md-language.ts
```

**Policy**:
- Official documents must contain English sentences
- Locale-only content in excluded paths is acceptable
- Mixed-language content is acceptable in all paths
- See: CONSTITUTION.md §3 (Mandatory English Git & PR Artifacts) and §4 (I18N)

**Excluded Paths**:
- memory/ (session logs)
- docs/superpowers/ (planning docs)
- docs/adr/ (architecture decision records)
- Locale-specific files (*_ko.md, *-ko.md, ko/, locales/ko/)
- node_modules/, .git/, dist/, build/

**Supported I18N Locales**:
ko, ja, zh-CN, zh-TW, de, es, fr, pt, vi, ms, id, th, ru, it, ar

---

## Version History

| Date | Script | Version | Changes |
|------|--------|---------|---------|
| 2026-06-02 | validate-md-language.ts | 1.2.0 | I18N language validation (17 locales), official document policy enforcement, auto-excluded paths (memory/, docs/superpowers/, docs/adr/) |
| 2026-06-02 | git-sync.ts | 1.0.0 | Platform-neutral git sync conversion from PowerShell/Bash (git-sync.ps1/sh) |
| 2026-06-02 | vsp-audit.ps1 | 1.0.0 | Removed dead code (placeholder + deleted wrapper script) |
| 2026-06-02 | vsp-publish.ts | 1.0.0 | VSP publishing pipeline with platform-neutral TypeScript implementation |
| 2026-06-02 | vsp-task.ts | 1.0.0 | VSP task automation with cross-platform TypeScript implementation |
| 2026-06-02 | vsp-sync.ts | 1.0.0 | TypeScript conversion for platform neutrality, 3-Tier Strategy alignment |
| 2026-06-02 | vsp-sync.ps1 | 1.0.0 | Phase 3 final release with hook architecture and Solution C (deprecated) |
| 2026-06-02 | vsp-task.ps1 | 1.0.0 | Deprecated (use vsp-task.ts instead) |
| 2026-06-02 | vsp-publish.ps1 | 1.0.0 | Deprecated (use vsp-publish.ts instead) |
| 2026-06-02 | vsp-dev-sync.ps1 | 1.0.0 | Deprecated (will be removed post-2026-06-15) |
| 2026-06-02 | audit.ts | 2.6.0 | Diff Algorithm implementation + Solution C (--incremental) |
| 2026-06-01 | vsp-dev-sync.ps1 | 1.0.0 | Phase 2 initial release |

---

## Related Documentation

- [ADR-0022: Phase 2→Phase 3 Architecture Transition Plan](../adr/0022-phase-2-phase-3-transition-plan.md)
- [ADR-0021: vsp-dev-sync.ps1 Architecture Design](../adr/0021-vsp-dev-sync-architecture.md)
- [CONSTITUTION.md §5 - Multi-Agent Architecture](../constitution/05-multi-agent-architecture.md)
- [CHANGELOG.md: Phase 3 Release Notes](../CHANGELOG.md#unreleased)

---

**Last Updated**: 2026-06-02
**Maintainer**: code-writer (Phase 3)
