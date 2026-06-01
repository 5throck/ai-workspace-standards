## vsp-dev-sync.ps1 Architecture Design

**Version**: 1.0
**Date**: 2026-06-01
**Designer**: devops-admin
**Status**: Draft (A-14 Part 1)

---

## Overview

**Purpose**: Create a unified entry point for the VSP (Variant SAP Project) sync pipeline that combines generic workspace validation (co-develop's audit.ts) with SAP-specific synchronization logic (vsp-sync.ps1), while maintaining granular control via PowerShell switches.

**Context**: This hybrid script enables Phase 2 objectives by providing:
1. Single command for full sync pipeline (workspace + SAP)
2. Layer validation through co-develop's audit.ts
3. MCP configuration synchronization (sync-mcp.ts)
4. SAP-specific infrastructure sync (legacy VSP logic)
5. Fast iteration modes via skip switches

**Design Philosophy**: Progressive enhancement - start with full validation, allow selective skipping for rapid development cycles.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    vsp-dev-sync.ps1                             │
│                    (Entry Point)                                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────────┐
   │ Phase 1 │    │ Phase 2 │    │   Phase 3   │
   │ Audit   │───►│  MCP    │───►│  SAP Sync   │
   │ (.ts)   │    │  Sync   │    │  (legacy)   │
   └────┬────┘    └────┬────┘    └──────┬──────┘
        │              │                │
        │              │                │
        ▼              ▼                ▼
   ┌─────────┐    ┌─────────┐    ┌─────────────┐
   │Critical │    │Non-Crit │    │  Critical   │
   │ (halt)  │    │(warn+)  │    │   (halt)    │
   └─────────┘    └─────────┘    └─────────────┘
```

**Execution Flow**:
1. Phase 1: Generic workspace validation (audit.ts) - **HALT on failure**
2. Phase 2: MCP configuration sync (sync-mcp.ts) - **WARN on failure, continue**
3. Phase 3: SAP-specific sync (vsp-sync.ps1 logic) - **HALT on failure**

---

## Phase Breakdown

### Phase 1: Generic Workspace Validation (audit.ts)

**Purpose**: Validate workspace standards, lifecycle sync, documentation integrity, and cross-platform parity before any synchronization operations.

**Script**: `bun scripts/audit.ts`

**Execution Context**: Runs from workspace root, checks all governance policies.

**Failure Mode**: **Critical** - halts execution immediately if audit fails.

**Skip Switch**: `-SkipAudit`

**Use Cases for Skipping**:
- Fast iteration during active development (temporary workspace violations expected)
- Running audit separately in CI/CD pipeline
- Debugging specific sync phases without full validation

**Exit Code Behavior**:
- `0` = Audit passed, proceed to Phase 2
- `1` = Audit failed, halt with error message

**Integration Notes**:
- Must call `bun audit.ts` directly (not via shell wrapper)
- Capture `$LASTEXITCODE` for PowerShell error handling
- Parse colored output for user-friendly error reporting

---

### Phase 2: MCP Configuration Sync (sync-mcp.ts)

**Purpose**: Synchronize `.mcp.json` configurations between workspace root and SAP variant project, ensuring MCP server consistency across co-develop and VSP environments.

**Script**: `bun scripts/sync-mcp.ts`

**Execution Context**: Copies MCP config from workspace root to variant project, preserving relative path resolution.

**Failure Mode**: **Non-Critical** - logs warning, continues to Phase 3.

**Skip Switch**: `-SkipMcpSync`

**Use Cases for Skipping**:
- MCP configuration not changed
- Workspace-only sync (no SAP variant present)
- Running MCP sync separately in maintenance window

**Exit Code Behavior**:
- `0` = MCP synced successfully
- `Non-zero` = Log warning, continue to Phase 3

**Integration Notes**:
- Non-blocking because MCP sync can be deferred/retried without breaking SAP sync
- Warning must include specific error details for troubleshooting
- Consider environment-specific MCP configs (dev vs. prod)

---

### Phase 3: SAP-Specific Sync (legacy VSP logic)

**Purpose**: Execute SAP-specific synchronization including memory log management, documentation audit, and Git commit operations tailored to VSP infrastructure.

**Script**: Inherit from `scripts/vsp-sync.ps1` (lines 17-83)

**Execution Context**: Runs VSP-specific operations:
1. Documentation audit (vsp-audit.ps1)
2. Memory log auto-creation (today's log if missing)
3. MEMORY.md index update
4. Git commit with message

**Failure Mode**: **Critical** - halts execution if SAP sync fails.

**Skip Switch**: `-SkipSapSync`

**Use Cases for Skipping**:
- Workspace-only validation (no Git operations)
- Running SAP sync manually (transport release workflow)
- Testing Phase 1-2 without committing

**Exit Code Behavior**:
- `0` = SAP sync successful
- `1` = SAP sync failed, halt with error message

**Integration Notes**:
- Must preserve existing vsp-sync.ps1 behavior (backward compatibility)
- Reuse vsp-audit.ps1 for SAP-specific documentation checks
- Maintain memory log auto-creation logic
- Git commit must respect `$SYNC_ACTIVE` environment variable (pre-commit hook bypass)

---

## Error Handling Strategy

### Critical Errors (Phase 1, Phase 3)

**Behavior**: Immediate halt with clear error messaging.

**Error Reporting Format**:
```powershell
[Phase 1/3] Running workspace audit...
✗ Audit failed (2.1s)
ERROR: Broken link in docs/context.md (line 45)
       Agent state mismatch: pm.md (file=active, AGENTS.md=inactive)
HALT: Fix documentation and retry
```

**Remediation Suggestions**:
- Phase 1 failures: "Run `bun scripts/audit.ts` to see full details"
- Phase 3 failures: "Check vsp-audit.ps1 output and memory log format"

**Exit Code**: `1` (failure)

### Non-Critical Errors (Phase 2)

**Behavior**: Log warning with yellow/warning color, continue to next phase.

**Warning Format**:
```powershell
[Phase 2/3] Syncing MCP configuration...
⚠ WARNING: MCP sync failed (0.8s)
   Reason: .mcp.json not found in variant project
   Action: Continuing to SAP sync (MCP can be synced later)
```

**Exit Code**: Continue execution (warning does not affect final exit code)

---

## Switch Behavior Matrix

| `-SkipAudit` | `-SkipMcpSync` | `-SkipSapSync` | Behavior |
|--------------|----------------|----------------|----------|
| `$false` | `$false` | `$false` | **Full sync** - All 3 phases execute (default production mode) |
| `$true` | `$false` | `$false` | **Fast iteration** - Skip workspace audit (use during active dev) |
| `$false` | `$true` | `$false` | **Skip MCP** - MCP unchanged, workspace audit + SAP sync only |
| `$false` | `$false` | `$true` | **Workspace sync only** - Audit + MCP sync, no Git operations |
| `$true` | `$true` | `$false` | **SAP sync only** - Skip audit + MCP, direct to VSP sync |
| `$true` | `$false` | `$true` | **MCP sync only** - Skip audit + SAP, MCP configuration update |
| `$false` | `$true` | `$true` | **Audit only** - Workspace validation without sync operations |
| `$true` | `$true` | `$true` | **No-op** - All phases skipped (invalid, warn user) |

**Default Behavior** (no switches): Full sync pipeline (all phases execute).

**Recommended Usage**:
- **Production/CI**: `.\vsp-dev-sync.ps1` (no skips)
- **Active Development**: `.\vsp-dev-sync.ps1 -SkipAudit`
- **MCP Maintenance**: `.\vsp-dev-sync.ps1 -SkipSapSync`
- **Debugging**: `.\vsp-dev-sync.ps1 -SkipAudit -SkipSapSync` (MCP only)

---

## Integration Points

### With audit.ts (co-develop)

**Invocation Method**:
```powershell
& bun "$PSScriptRoot\..\scripts\audit.ts"
$auditExitCode = $LASTEXITCODE
```

**Expected Output Format**:
- Colored console output (GREEN/RED/YELLOW/CYAN)
- Final line: `✅ All checks passed.` or `❌ N check(s) failed.`
- Exit code: `0` (success) or `1` (failure)

**Error Handling**:
- Check `$LASTEXITCODE` immediately after execution
- Parse final output line for success/failure message
- On failure: Display "HALT: Fix workspace issues and retry"

**Path Resolution**:
- Use `$PSScriptRoot` for relative path resolution
- `audit.ts` location: `workspace root/scripts/audit.ts`
- Script location: `workspace root/scripts/vsp-dev-sync.ps1`

---

### With vsp-sync.ps1 (legacy VSP logic)

**Inheritance Strategy**:
1. Extract lines 17-83 from `vsp-sync.ps1` (core sync logic)
2. Wrap in `Invoke-SapSync` function within `vsp-dev-sync.ps1`
3. Preserve all existing behavior (memory log, Git commit)

**Preserved Behavior**:
- Documentation audit via `vsp-audit.ps1`
- Memory log auto-creation (today's log if missing)
- MEMORY.md index update (extract summary from first header)
- Git commit with message validation
- Exit code `1` on any failure

**Backward Compatibility**:
- Existing `vsp-sync.ps1` remains standalone (no breaking changes)
- `vsp-dev-sync.ps1` calls same functions, not the script itself
- Users can still use `vsp-sync.ps1` directly if preferred

**Integration Code Structure**:
```powershell
function Invoke-SapSync {
    param([string]$Message)

    # 1. Documentation audit
    & "$PSScriptRoot\vsp-audit.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "SAP documentation audit failed"
        return $false
    }

    # 2. Memory log management (reuse vsp-sync.ps1 lines 24-67)
    # ...

    # 3. Git commit (reuse vsp-sync.ps1 lines 69-82)
    # ...
}
```

---

## Output Format

### Success Output

```powershell
=== VSP Dev Sync Pipeline ===
Commit message: feat: add new report variant

[Phase 1/3] Running workspace audit...
✓ Audit passed (5.2s)

[Phase 2/3] Syncing MCP configuration...
✓ MCP synced (1.1s)
  Copied .mcp.json to variant project

[Phase 3/3] Syncing VSP infrastructure...
✓ Documentation audit passed (0.8s)
✓ Memory log updated: memory/2026-06-01.md
✓ Git commit successful (2.3s)
✓ VSP synced successfully (3.4s)

Summary: All phases completed in 9.7s
```

### Error Output (Phase 1 Failure)

```powershell
=== VSP Dev Sync Pipeline ===
Commit message: feat: add new report variant

[Phase 1/3] Running workspace audit...
✗ Audit failed (2.1s)
ERROR: Broken link in docs/context.md (line 45)
       https://raw.githubusercontent.com/.../CONSTITUTION.md#section-name → 404 Not Found
HALT: Fix documentation and retry
       Run 'bun scripts/audit.ts' for full details
```

### Error Output (Phase 2 Warning)

```powershell
=== VSP Dev Sync Pipeline ===
Commit message: feat: add new report variant

[Phase 1/3] Running workspace audit...
✓ Audit passed (4.8s)

[Phase 2/3] Syncing MCP configuration...
⚠ WARNING: MCP sync failed (0.6s)
   Reason: .mcp.json not found in variant project
   Action: Continuing to SAP sync (MCP can be synced later)
   Note: Run MCP sync manually after setting up variant project

[Phase 3/3] Syncing VSP infrastructure...
✓ VSP synced successfully (3.2s)

Summary: Completed with warnings in 8.6s
```

### Error Output (Phase 3 Failure)

```powershell
=== VSP Dev Sync Pipeline ===
Commit message: feat: add new report variant

[Phase 1/3] Running workspace audit...
✓ Audit passed (4.9s)

[Phase 2/3] Syncing MCP configuration...
✓ MCP synced (1.0s)

[Phase 3/3] Syncing VSP infrastructure...
✗ Documentation audit failed (0.7s)
ERROR: vsp-audit.ps1 detected broken links in docs/sap/
HALT: Fix SAP documentation and retry
       Run '.\scripts\vsp-audit.ps1' for full details
```

---

## Implementation Notes

### PowerShell vs. Bash Compatibility

**Platform Detection**:
```powershell
$IsWindows = $true  # Always true for .ps1 scripts
```

**Path Resolution**:
- Use `$PSScriptRoot` for script-relative paths
- Use `Join-Path` for cross-platform path construction
- Avoid hardcoded backslashes (use `\` or `Join-Path`)

**Bun Invocation**:
```powershell
& bun "$PSScriptRoot\..\scripts\audit.ts"
```

**Exit Code Handling**:
- Check `$LASTEXITCODE` after external command execution
- Use `return $false` for function failures, check `$?` for command failures

### Cross-Platform Path Resolution

**Relative Path Strategy**:
```powershell
$ScriptRoot = $PSScriptRoot
$WorkspaceRoot = Split-Path $ScriptRoot -Parent
$AuditScript = Join-Path $WorkspaceRoot "scripts" "audit.ts"
```

**Variant Project Detection**:
```powershell
$VariantProject = Join-Path $WorkspaceRoot "templates" "co-abap"
if (-not (Test-Path $VariantProject)) {
    Write-Warning "Variant project not found: $VariantProject"
}
```

### Dependency Requirements

**Required Tools**:
- `bun` - Must be installed and in PATH
- `git` - Must be installed and configured
- PowerShell 5.1+ (Windows) or PowerShell Core 7+ (cross-platform)

**Required Files**:
- `scripts/audit.ts` - co-develop workspace validation
- `scripts/sync-mcp.ts` - MCP configuration sync
- `scripts/vsp-sync.ps1` - Legacy VSP sync logic (for reference)
- `scripts/vsp-audit.ps1` - SAP-specific documentation audit

**Optional Files**:
- `memory/MEMORY.md` - Memory log index
- `.mcp.json` - MCP configuration (if sync-mcp.ts runs)

### Performance Considerations

**Execution Time Breakdown** (estimated):
- Phase 1 (audit.ts): 3-6 seconds (depends on workspace size)
- Phase 2 (sync-mcp.ts): 0.5-1.5 seconds (file copy + validation)
- Phase 3 (SAP sync): 2-4 seconds (audit + memory log + Git commit)
- **Total**: 5.5-11.5 seconds for full sync

**Optimization Opportunities**:
- Skip audit in rapid iteration (`-SkipAudit`) - saves 3-6s
- Skip MCP sync when unchanged (`-SkipMcpSync`) - saves 0.5-1.5s
- Parallel execution: Phase 2 can run in parallel with Phase 1 if both are non-blocking (future enhancement)

---

## Success Criteria

- [ ] **Architecture supports 3-phase execution** - Clear separation of concerns (audit → MCP → SAP)
- [ ] **All switches defined and documented** - `-SkipAudit`, `-SkipMcpSync`, `-SkipSapSync` with use cases
- [ ] **Error handling strategy clear** - Critical vs. non-critical failures, exit codes, remediation
- [ ] **Integration points specified** - audit.ts invocation, vsp-sync.ps1 inheritance, path resolution
- [ ] **Output format defined** - Success, error, and warning formats with color coding
- [ ] **Backward compatibility preserved** - Existing vsp-sync.ps1 remains functional
- [ ] **Cross-platform compatibility** - PowerShell 5.1+ on Windows, path resolution works on all platforms
- [ ] **Performance documented** - Execution time estimates, optimization opportunities

---

## Next Steps (A-14 Part 2)

1. **Implement `vsp-dev-sync.ps1`** based on this architecture
2. **Create test scenarios** for each phase (success, failure, skip)
3. **Update documentation** (AGENTS.md, scripts/SCRIPTS.md)
4. **Validate integration** with existing co-develop and VSP workflows
5. **Create migration guide** for users transitioning from vsp-sync.ps1 to vsp-dev-sync.ps1

---

**References**:
- [CONSTITUTION.md §5 - Multi-Agent Architecture](../constitution/05-multi-agent-architecture.md)
- [scripts/vsp-sync.ps1](../../scripts/vsp-sync.ps1) - Legacy VSP sync logic
- [scripts/dev-sync.ts](../../scripts/dev-sync.ts) - co-develop generic sync pattern
- [scripts/audit.ts](../../scripts/audit.ts) - Workspace validation implementation
- [ADR-0020: ABAP Variant Conversion Strategy](./0020-abap-variant-conversion.md) - Phase 2 context
