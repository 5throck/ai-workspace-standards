# Phase 2→Phase 3 Architecture Transition Plan (A-16)

**Version**: 1.0
**Date**: 2026-06-01
**Architect**: architect
**Task**: A-16 - Architecture transition plan for vsp-dev-sync.ps1 → vsp-sync.ps1 refactoring
**Status**: Draft

---

## Overview

**Purpose**: This transition plan defines the strategic migration path from Phase 2 (temporary hybrid orchestration) to Phase 3 (SAP-first hook architecture), ensuring minimal disruption while establishing a robust, extensible sync pipeline for the Variant SAP Project ecosystem.

**Strategic Objectives**:
1. Establish hook-based architecture that allows SAP scripts to invoke co-develop utilities as configurable hooks
2. Preserve all Phase 2 functionality while improving maintainability
3. Enable Solution C (incremental audit) integration for faster iteration cycles
4. Create clear separation between workspace validation (co-develop) and domain-specific logic (VSP)
5. Enable domain-driven orchestration where code-writer owns the sync workflow

**Scope**: This plan covers the refactoring of `vsp-dev-sync.ps1` into `vsp-sync.ps1` with hook architecture, including integration points, testing strategy, and rollback procedures.

---

## Current State (Phase 2)

### vsp-dev-sync.ps1 Architecture

**Design**: Temporary hybrid script combining generic workspace validation with SAP-specific synchronization.

**Execution Model**: 3-phase sequential execution

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

**Features and Capabilities**:

| Feature | Implementation | Control |
|---------|---------------|----------|
| Workspace Audit | `bun scripts/audit.ts` | `-SkipAudit` switch |
| MCP Sync | `bun scripts/sync-mcp.ts` | `-SkipMcpSync` switch |
| VSP Documentation Audit | `vsp-audit.ps1` | Integrated in Phase 3 |
| Memory Log Management | Auto-creation logic | Integrated in Phase 3 |
| MEMORY.md Index Update | Inline logic | Integrated in Phase 3 |
| Git Commit | Direct git commands | `-SkipSapSync` switch |

**Current Script Location**: `C:\git\abap_vibe_coding_mig\scripts\vsp-dev-sync.ps1`

**Current Version**: 1.0 (from ADR-0021)

**Limitations**:
1. **Tight Coupling**: VSP-specific logic is embedded in a hybrid orchestration script
2. **No Hook Extensibility**: Cannot add pre/post processing without modifying core script
3. **Domain Ownership Unclear**: devops-admin owns orchestration, but code-writer should own SAP-specific workflow
4. **No Incremental Audit**: Full audit runs every time (no Solution C integration)
5. **Monolithic Design**: All phases hardcoded in single script

---

## Target State (Phase 3)

### vsp-sync.ps1 Architecture

**Design**: SAP-first hook architecture with pre-hook → main logic → post-hook pattern.

**Hook Philosophy**: Hooks are external invocations that can be configured, skipped, or extended without modifying core domain logic.

**Execution Model**: Hook-based execution

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          vsp-sync.ps1                                     │
│                    (SAP-First Entry Point)                               │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               │               ▼
    ┌─────────────┐       │       ┌─────────────┐
    │  Pre-Hook   │       │       │  Post-Hook  │
    │  (Optional) │       │       │  (Optional) │
    └──────┬──────┘       │       └──────┬──────┘
           │              │              │
           │              │              │
           │              │              │
           │              │              │
           ▼              ▼              ▼
    ┌─────────────────────────────────────────┐
    │           Main: SAP Sync Logic           │
    │  (Documentation + Memory + Git Commit)  │
    └─────────────────────────────────────────┘
```

**Hook Contract**:

```powershell
# Pre-hook contract
# Input: $NoAudit (switch), $NoMcp (switch)
# Output: Exit code 0 = continue, 1+ = halt
# Behavior: Validation and setup tasks

# Post-hook contract  
# Input: $NoPostHook (switch), $Message (string)
# Output: Exit code ignored (non-blocking)
# Behavior: Cleanup, reporting, and synchronization tasks
```

**Enhanced Features**:

| Feature | Phase 2 | Phase 3 | Enhancement |
|---------|---------|---------|-------------|
| Audit Integration | Inline in Phase 1 | Pre-hook | Configurable via hook |
| MCP Sync | Inline in Phase 2 | Pre-hook | Can be skipped independently |
| Incremental Audit | Not available | Pre-hook flag | Solution C integration |
| Documentation | Inline in Phase 3 | Main Logic | No change (preserved) |
| Memory Management | Inline in Phase 3 | Main Logic | No change (preserved) |
| Git Commit | Inline in Phase 3 | Main Logic | No change (preserved) |
| Post-Sync Reporting | Not available | Post-hook | New capability |

**New Capabilities**:
1. **Incremental Audit**: `--incremental` flag for faster iteration (Solution C)
2. **Hook Extensibility**: Can add custom hooks without modifying core script
3. **Domain-Driven Ownership**: code-writer owns SAP sync workflow
4. **Separation of Concerns**: Workspace validation (co-develop) separate from domain logic (VSP)

---

## Gap Analysis

### Feature Mapping (Phase 2 → Phase 3)

| Phase 2 Feature | Phase 3 Equivalent | Implementation Note | Risk Level |
|-----------------|---------------------|----------------------|------------|
| `-SkipAudit` switch | `$NoAudit` parameter | Convert switch to parameter with `$false` default | Low |
| `-SkipMcpSync` switch | `$NoMcp` parameter | Convert switch to parameter with `$false` default | Low |
| `-SkipSapSync` switch | Removed (not needed) | In Phase 3, SAP sync is the main logic — always runs | Low |
| 3-phase orchestration | Hook-based orchestration | Refactor execution flow to pre-hook → main → post-hook | Medium |
| Phase 1: audit.ts | Pre-hook: audit.ts | Preserve same behavior, add `--incremental` support | Low |
| Phase 2: sync-mcp.ts | Pre-hook: sync-mcp.ts | Preserve same behavior | Low |
| Phase 3: SAP sync | Main Logic | Extract from vsp-dev-sync.ps1 unchanged | Low |
| Direct git commit | Main Logic | Preserve same behavior | Low |
| Memory log management | Main Logic | Preserve same behavior | Low |

### Behavioral Differences

| Scenario | Phase 2 Behavior | Phase 3 Behavior | Impact |
|----------|------------------|------------------|--------|
| User runs script with no flags | Full 3-phase sync | Full sync with hooks | None (identical) |
| User skips audit | `-SkipAudit` | `$NoAudit = $true` | None (identical) |
| User skips MCP | `-SkipMcpSync` | `$NoMcp = $true` | None (identical) |
| User wants to skip SAP sync | `-SkipSapSync` | Not supported | Low (use case unclear in Phase 2) |
| Script execution fails at Phase 1 | Halts with error | Halts with error | None (identical) |
| Script execution fails at Phase 2 | Continues with warning | Continues with warning | None (identical) |
| Script execution fails at Phase 3 | Halts with error | Halts with error | None (identical) |

### Dependencies to Resolve

| Dependency | Phase 2 State | Phase 3 Requirement | Action |
|------------|---------------|---------------------|--------|
| audit.ts | v2.4.0 | v2.4.0 with `--incremental` flag | Implement Solution C |
| sync-mcp.ts | v1.0.0 | v1.0.0 (no changes) | None |
| vsp-sync.ps1 | Current legacy script | Deprecated | Mark as deprecated |
| vsp-audit.ps1 | Integrated in Phase 3 | Integrated in Main Logic | Preserve |

---

## Refactoring Strategy

### Step 1: Hook Infrastructure Design (Week 1)

**Objective**: Define hook calling convention and execution framework.

**Hook Calling Convention**:

```powershell
# Hook invocation pattern
function Invoke-PreHook {
    param([string]$HookName, [switch]$SkipFlag, [string]$ExtraArgs = "")
    
    if ($SkipFlag) {
        Write-Warn-Color "[Pre-Hook] Skipped $HookName"
        return $true
    }
    
    Write-Phase "[Pre-Hook] Running $HookName..."
    $hookTimer = [System.Diagnostics.Stopwatch]::StartNew()
    
    & bun "$ScriptRoot\$HookName.ts" $ExtraArgs
    $exitCode = $LASTEXITCODE
    $hookTimer.Stop()
    
    if ($exitCode -eq 0) {
        Write-Success "✓ $HookName passed ($($hookTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        return $true
    } else {
        Write-Error-Color "✗ $HookName failed ($($hookTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        return $false
    }
}

function Invoke-PostHook {
    param([string]$HookName, [switch]$SkipFlag, [string]$ExtraArgs = "")
    
    if ($SkipFlag) {
        Write-Warn-Color "[Post-Hook] Skipped $HookName"
        return
    }
    
    Write-Phase "[Post-Hook] Running $HookName..."
    $hookTimer = [System.Diagnostics.Stopwatch]::StartNew()
    
    & bun "$ScriptRoot\$HookName.ts" $ExtraArgs
    $hookTimer.Stop()
    
    # Post-hooks are non-blocking — log result but don't halt
    if ($LASTEXITCODE -eq 0) {
        Write-Success "✓ $HookName completed ($($hookTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
    } else {
        Write-Warn-Color "⚠ $HookName had issues ($($hookTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
    }
}
```

**Hook Execution Order**:
1. Pre-Hook: audit.ts (if not skipped)
2. Pre-Hook: sync-mcp.ts (if not skipped)
3. Main: SAP Sync Logic
4. Post-Hook: sync-md.ts (if not skipped)

**Deliverables**:
- [ ] Hook invocation helper functions
- [ ] Hook parameter standardization
- [ ] Hook error handling framework

---

### Step 2: Pre-Hook Integration (Week 1-2)

**Objective**: Integrate audit.ts and sync-mcp.ts as pre-hooks with skip flags.

**audit.ts Integration**:

```powershell
# In vsp-sync.ps1
param(
    [string]$Message = "",
    [switch]$NoAudit,
    [switch]$NoMcp,
    [switch]$NoPostHook
)

# Pre-Hook: Audit (if not skipped)
$auditArgs = @()
if ($NoAudit) {
    $auditArgs = "--incremental"  # Solution C: faster iteration mode
}

$auditPassed = Invoke-PreHook -HookName "audit" -SkipFlag:$NoAudit -ExtraArgs $auditArgs
if (-not $auditPassed) {
    Write-Error-Color "HALT: Fix workspace issues and retry"
    Write-Error-Color "       Run 'bun scripts/audit.ts' for full details"
    $stopwatch.Stop()
    exit 1
}
```

**sync-mcp.ts Integration**:

```powershell
# Pre-Hook: MCP Sync (if not skipped)
$mcpPassed = Invoke-PreHook -HookName "sync-mcp" -SkipFlag:$NoMcp
# Note: MCP sync failures are non-critical — continue even if failed
```

**Solution C Implementation**: Modify audit.ts to support `--incremental` flag:

```typescript
// In audit.ts
const INCREMENTAL = process.argv.includes('--incremental');

if (INCREMENTAL) {
    console.log(`${CYAN}Running incremental audit (fast mode)${RESET}\n`);
    // Skip expensive checks (web URL validation, full lifecycle audits)
    // Focus on: CHANGELOG.md, AGENTS.md, project-level checks
} else {
    console.log(`${CYAN}Running full audit${RESET}\n`);
    // All checks enabled
}
```

**Deliverables**:
- [ ] audit.ts with `--incremental` flag support
- [ ] vsp-sync.ps1 pre-hook integration for audit.ts
- [ ] vsp-sync.ps1 pre-hook integration for sync-mcp.ts
- [ ] Test coverage for skip modes

---

### Step 3: Main Logic Preservation (Week 2)

**Objective**: Extract and preserve SAP sync logic from vsp-dev-sync.ps1.

**Source Extraction**: Extract lines 99-195 from `vsp-dev-sync.ps1` (Phase 3: SAP Sync section)

**Main Logic Structure**:

```powershell
# Main: SAP Sync Logic
function Invoke-SapSync {
    param([string]$Message)
    
    $phaseTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Phase "[Main] Syncing VSP infrastructure..."
    
    # 3.1 Documentation Audit
    & "$ScriptRoot\vsp-audit.ps1"
    if ($LASTEXITCODE -ne 0) {
        $phaseTimer.Stop()
        Write-Error-Color "✗ Documentation audit failed ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        Write-Error-Color "ERROR: VSP documentation validation failed"
        Write-Error-Color "HALT: Fix SAP documentation and retry"
        Write-Error-Color "       Run '.\scripts\vsp-audit.ps1' for full details"
        return $false
    }
    Write-Success "✓ Documentation audit passed ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
    
    # 3.2 Memory Log Management (preserve from vsp-dev-sync.ps1 lines 122-138)
    # ...
    
    # 3.3 Update MEMORY.md Index (preserve from vsp-dev-sync.ps1 lines 140-165)
    # ...
    
    Write-Success "✓ Memory log updated: memory/$date.md"
    
    # 3.4 Git Commit (preserve from vsp-dev-sync.ps1 lines 169-186)
    # ...
    
    Write-Success "✓ Git commit successful ($($gitTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
    $phaseTimer.Stop()
    
    Write-Success "✓ VSP synced successfully ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
    return $true
}
```

**Preservation Checklist**:
- [ ] Documentation audit via vsp-audit.ps1
- [ ] Memory log auto-creation (today's log if missing)
- [ ] MEMORY.md index update (extract summary from first header)
- [ ] Git commit with message validation
- [ ] Exit code 1 on any failure
- [ ] All timing and formatting preserved

**Deliverables**:
- [ ] Invoke-SapSync function implemented
- [ ] All vsp-dev-sync.ps1 SAP logic preserved
- [ ] Backward compatibility verified

---

### Step 4: Post-Hook Integration (Week 2-3)

**Objective**: Integrate sync-md.ts as post-hook for reporting and synchronization.

**Post-Hook Design**:

```powershell
# After main SAP sync completes
if ($sapSyncResult) {
    # Post-Hook: sync-md.ts (if not skipped)
    $syncMdArgs = @($date, "vsp-sync: $Message")
    Invoke-PostHook -HookName "sync-md" -SkipFlag:$NoPostHook -ExtraArgs $syncMdArgs
} else {
    Write-Warn-Color "Skipping post-hook due to SAP sync failure"
}
```

**Post-Hook Behavior**:
- Non-blocking: failures logged but don't halt execution
- Purpose: Update MEMORY.md index, generate reports
- Can be skipped for fast iteration (`-NoPostHook`)

**Solution C Integration**: Use incremental mode in post-hook:

```powershell
# If audit was run in incremental mode, post-hook should respect that
if ($NoAudit) {
    # Already ran incremental audit — post-hook can be lighter
    $syncMdArgs = @($date, "vsp-sync (fast): $Message", "--incremental")
}
```

**Deliverables**:
- [ ] Post-hook integration for sync-md.ts
- [ ] Incremental mode support in post-hook
- [ ] Test coverage for post-hook scenarios

---

### Step 5: vsp-sync.ps1 Creation (Week 3)

**Objective**: Combine all components into final vsp-sync.ps1 script.

**Final Script Structure**:

```powershell
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
# scripts/vsp-sync.ps1
# Usage: .\scripts\vsp-sync.ps1 [-Message "type: summary"] [-NoAudit] [-NoMcp] [-NoPostHook]
# SAP-first sync pipeline with hook architecture

param(
    [string]$Message = "",
    [switch]$NoAudit,
    [switch]$NoMcp,
    [switch]$NoPostHook
)

# Script paths
$ScriptRoot = $PSScriptRoot
$WorkspaceRoot = Split-Path $ScriptRoot -Parent

# Helper functions (Write-Phase, Write-Success, Write-Error-Color, Write-Warn-Color)
# ...

# Hook invocation functions (Invoke-PreHook, Invoke-PostHook)
# ...

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

Write-Host "=== VSP Sync Pipeline (Phase 3: Hook Architecture) ===" -ForegroundColor Cyan
if (-not [string]::IsNullOrWhiteSpace($Message)) {
    Write-Host "Commit message: $Message" -ForegroundColor Cyan
}
Write-Host ""

# Pre-Hook 1: Audit
$auditPassed = Invoke-PreHook -HookName "audit" -SkipFlag:$NoAudit -ExtraArgs $(if ($NoAudit) { "--incremental" } else { "" })
if (-not $auditPassed) {
    # Error handling already in Invoke-PreHook
    $stopwatch.Stop()
    exit 1
}
Write-Host ""

# Pre-Hook 2: MCP Sync (non-critical)
$mcpPassed = Invoke-PreHook -HookName "sync-mcp" -SkipFlag:$NoMcp
Write-Host ""

# Main: SAP Sync
$sapSyncResult = Invoke-SapSync -Message $Message
Write-Host ""

# Post-Hook: sync-md (if main succeeded)
if ($sapSyncResult) {
    $syncMdArgs = @($date, "vsp-sync: $Message")
    Invoke-PostHook -HookName "sync-md" -SkipFlag:$NoPostHook -ExtraArgs $syncMdArgs
    Write-Host ""
}

# Summary
$stopwatch.Stop()
Write-Success "Summary: VSP sync completed in $($stopwatch.Elapsed.TotalSeconds.ToString('0.0'))s"
```

**Deprecation of vsp-dev-sync.ps1**:

1. Add deprecation notice to vsp-dev-sync.ps1 header:
```powershell
# DEPRECATED: Use vsp-sync.ps1 instead
# This script is maintained for backward compatibility during Phase 2→3 transition
# Will be removed in Phase 4 (post-2026-06-15)
```

2. Update documentation to reference vsp-sync.ps1

**Deliverables**:
- [ ] vsp-sync.ps1 created with hook architecture
- [ ] vsp-dev-sync.ps1 marked as deprecated
- [ ] Both scripts functional during transition period

---

## Code Structure Comparison

### Before (Phase 2 - vsp-dev-sync.ps1)

```powershell
param([string]$Message = "", [switch]$SkipAudit, [switch]$SkipMcpSync, [switch]$SkipSapSync)

# Phase 1: Audit (if not skipped)
if (-not $SkipAudit) {
    & bun "$ScriptRoot\audit.ts"
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# Phase 2: MCP Sync (if not skipped)
if (-not $SkipMcpSync) {
    & bun "$ScriptRoot\sync-mcp.ts"
    # Non-critical — continue even if failed
}

# Phase 3: SAP Sync
if (-not $SkipSapSync) {
    # Documentation audit
    & "$ScriptRoot\vsp-audit.ps1"
    # Memory log management
    # Git commit
}
```

**Characteristics**:
- Monolithic: All phases in single script
- Sequential: No parallel execution
- Mixed: Workspace and domain logic intertwined
- Rigid: Adding hooks requires script modification

---

### After (Phase 3 - vsp-sync.ps1)

```powershell
param(
    [string]$Message = "",
    [switch]$NoAudit,
    [switch]$NoMcp,
    [switch]$NoPostHook
)

# Pre-Hook 1: Audit (if not skipped)
$auditArgs = if ($NoAudit) { "--incremental" } else { "" }
$auditPassed = Invoke-PreHook -HookName "audit" -SkipFlag:$NoAudit -ExtraArgs $auditArgs
if (-not $auditPassed) { exit 1 }

# Pre-Hook 2: MCP Sync (if not skipped)
Invoke-PreHook -HookName "sync-mcp" -SkipFlag:$NoMcp
# Non-critical — continue even if failed

# Main: SAP Sync (domain logic)
$sapSyncResult = Invoke-SapSync -Message $Message

# Post-Hook: sync-md (if not skipped)
if ($sapSyncResult) {
    Invoke-PostHook -HookName "sync-md" -SkipFlag:$NoPostHook -ExtraArgs @($date, $Message)
}
```

**Characteristics**:
- Modular: Hooks separated from main logic
- Extensible: Adding hooks requires only parameter addition
- Domain-driven: SAP logic isolated in Invoke-SapSync
- Configurable: Fine-grained control via hook-specific flags

---

## Migration Path

### For Users

**Phase 2** (Current State - Week 0):
- Primary script: `vsp-dev-sync.ps1`
- Usage: `.\scripts\vsp-dev-sync.ps1 -Message "feat: update"`
- Flags: `-SkipAudit`, `-SkipMcpSync`, `-SkipSapSync`

**Phase 3** (Transition - Weeks 1-4):
- Primary script: `vsp-sync.ps1` (preferred)
- Fallback script: `vsp-dev-sync.ps1` (deprecated but functional)
- Usage: `.\scripts\vsp-sync.ps1 -Message "feat: update"`
- Flags: `-NoAudit`, `-NoMcp`, `-NoPostHook`
- Migration guide provided

**Post-Phase 3** (Stable State - Week 5+):
- Primary script: `vsp-sync.ps1`
- Legacy script: `vsp-dev-sync.ps1` removed
- Usage: `.\scripts\vsp-sync.ps1 -Message "feat: update"`
- Flags: `-NoAudit`, `-NoMcp`, `-NoPostHook`

---

### Compatibility Matrix

| User Scenario | Phase 2 | Phase 3 | Post-Phase 3 | Migration Required |
|---------------|---------|----------|---------------|-------------------|
| Manual sync (full pipeline) | `vsp-dev-sync.ps1` | `vsp-sync.ps1` | `vsp-sync.ps1` | Yes (script name) |
| Automated workflow (CI/CD) | `vsp-dev-sync.ps1` | `vsp-sync.ps1` | `vsp-sync.ps1` | Yes (script name + flags) |
| Fast iteration mode | `vsp-dev-sync.ps1 -SkipAudit` | `vsp-sync.ps1 -NoAudit` | `vsp-sync.ps1 -NoAudit` | Yes (script name + flag) |
| MCP maintenance | `vsp-dev-sync.ps1 -SkipSapSync` | `vsp-sync.ps1 -NoPostHook` | `vsp-sync.ps1 -NoPostHook` | Yes (script name + flag) |
| Debugging (MCP only) | `vsp-dev-sync.ps1 -SkipAudit -SkipSapSync` | `vsp-sync.ps1 -NoAudit -NoPostHook` | `vsp-sync.ps1 -NoAudit -NoPostHook` | Yes (script name + flags) |

**Migration Impact**: Medium — script name changes and flag renames require documentation updates.

---

### Breaking Changes

| Change | Type | Impact | Mitigation |
|--------|------|--------|------------|
| Script name: `vsp-dev-sync.ps1` → `vsp-sync.ps1` | Breaking | High (CI/CD pipelines) | Keep vsp-dev-sync.ps1 as wrapper during transition |
| Flag: `-SkipAudit` → `-NoAudit` | Breaking | Medium (user muscle memory) | Clear deprecation notice in old script |
| Flag: `-SkipMcpSync` → `-NoMcp` | Breaking | Medium (user muscle memory) | Clear deprecation notice in old script |
| Flag: `-SkipSapSync` → removed | Breaking | Low (use case unclear) | Use `-NoPostHook` for equivalent behavior |

**Mitigation Strategy**:
1. Maintain vsp-dev-sync.ps1 as compatibility wrapper during Weeks 1-4
2. Add deprecation warnings to old script
3. Document migration clearly in CHANGELOG.md
4. Update CI/CD pipelines during Week 2

---

## Testing Strategy

### Unit Tests

**Test Suite 1: Hook Invocation Functions**

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Invoke-PreHook success | HookName="audit", SkipFlag=$false | Returns $true, writes success message |
| Invoke-PreHook failure | HookName="audit", SkipFlag=$false, exitCode=1 | Returns $false, writes error message |
| Invoke-PreHook skipped | HookName="audit", SkipFlag=$true | Returns $true, writes skipped message |
| Invoke-PostHook success | HookName="sync-md", SkipFlag=$false | Writes success message |
| Invoke-PostHook failure | HookName="sync-md", SkipFlag=$false, exitCode=1 | Writes warning message (non-blocking) |
| Invoke-PostHook skipped | HookName="sync-md", SkipFlag=$true | Writes skipped message |

**Test Suite 2: Main Logic (Invoke-SapSync)**

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Documentation audit pass | vsp-audit.ps1 exitCode=0 | Returns $true, writes success message |
| Documentation audit fail | vsp-audit.ps1 exitCode=1 | Returns $false, writes error message, halts |
| Memory log missing | memory/2026-06-01.md not exist | Auto-creates file with header |
| MEMORY.md update | Index missing date entry | Adds entry to table |
| Git commit success | Valid message provided | Executes git commit, returns $true |
| Git commit failure | Empty message | Returns $false, writes error |

---

### Integration Tests

**Test Suite 3: Full Workflow Execution**

| Test Case | Parameters | Expected Behavior |
|-----------|------------|-------------------|
| Full sync (all hooks) | No flags | All hooks execute, SAP sync completes |
| Skip audit mode | `-NoAudit` | Audit hook skipped, audit runs with `--incremental` in post-hook |
| Skip MCP mode | `-NoMcp` | MCP hook skipped, rest executes |
| Skip post-hook mode | `-NoPostHook` | Post-hook skipped, main completes |
| All skips | `-NoAudit -NoMcp -NoPostHook` | Only main SAP sync executes |
| Audit failure | Force audit.ts failure | Halts before main, exit code 1 |
| Main failure | Force vsp-audit.ps1 failure | Halts before post-hook, exit code 1 |
| Post-hook failure | Force sync-md.ts failure | Logs warning, continues (non-blocking) |

---

### End-to-End Test (6-Step Workflow)

**Objective**: Verify complete PM-driven workflow from PRD to deployment.

**Test Steps**:

1. **PM → sd-analyst (PRD produced)**
   - Input: User request for new ABAP feature
   - Output: PRD document in `docs/prd/`
   - Verification: PRD exists and follows template

2. **PM → architect (impl. plan produced)**
   - Input: PRD document
   - Output: Implementation plan in `docs/adr/`
   - Verification: ADR exists with architecture decisions

3. **PM → code-writer (ABAP class)**
   - Input: Implementation plan
   - Output: ABAP class source code
   - Verification: Source code created, syntax valid

4. **PM → auditor (audit.ts pre-hook)**
   - Input: Workspace with new ABAP class
   - Output: Audit report (pass/fail)
   - Verification: audit.ts runs successfully in vsp-sync.ps1 pre-hook

5. **PM → test-runner (vsp-sync.ps1 with hooks)**
   - Input: ABAP class requiring sync
   - Output: Full sync pipeline execution
   - Verification: vsp-sync.ps1 completes all hooks and main logic

6. **PM → docs-writer (CHANGELOG updated)**
   - Input: Completed sync
   - Output: CHANGELOG.md entry
   - Verification: Entry exists in [Unreleased] section

**Success Criteria**:
- [ ] All 6 steps execute successfully without errors
- [ ] All hooks execute in correct order (pre → main → post)
- [ ] Error scenarios handled correctly (audit failure halts, post-hook failure warns)
- [ ] No regressions from Phase 2 functionality

**Test Execution Command**:
```powershell
# Full workflow test
.\scripts\vsp-sync.ps1 -Message "test: e2e workflow verification"
```

---

## Risk Assessment

### Risk 1: Breaking Changes in CI/CD Pipelines (High Risk)

**Scenario**: Existing CI/CD pipelines reference `vsp-dev-sync.ps1` with specific flags.

**Impact**: Pipeline failures during transition period if script name/flags changed.

**Probability**: High (multiple teams may have integrated the script)

**Mitigation**:
1. **Week 1-2**: Maintain `vsp-dev-sync.ps1` as compatibility wrapper that delegates to `vsp-sync.ps1`
2. **Week 2**: Add deprecation warnings to old script
3. **Week 2-3**: Update all CI/CD pipelines to use `vsp-sync.ps1`
4. **Week 4**: Remove `vsp-dev-sync.ps1` after all pipelines migrated

**Rollback Trigger**: More than 3 pipeline failures reported in Week 2.

---

### Risk 2: Hook Execution Failure Blocks SAP Sync (Medium Risk)

**Scenario**: Pre-hook audit fails, preventing developer from syncing SAP changes.

**Impact**: Developer workflow blocked until workspace issues resolved.

**Probability**: Medium (audit failures are common during active development)

**Mitigation**:
1. Provide `-NoAudit` flag for fast iteration mode
2. Add Solution C incremental audit for reduced failure surface
3. Clear error messages with remediation steps
4. Document audit skip scenarios in user guide

**Rollback Trigger**: More than 5 developer complaints in Week 1.

---

### Risk 3: Post-Hook Performance Degradation (Low Risk)

**Scenario**: Post-hook sync-md.ts adds significant latency to sync process.

**Impact**: Sync slower than Phase 2, developer productivity reduced.

**Probability**: Low (sync-md.ts is lightweight)

**Mitigation**:
1. Benchmark post-hook execution time (target < 0.5s)
2. Add `-NoPostHook` flag for fast iteration
3. Optimize sync-md.ts if needed before Phase 3 deployment

**Rollback Trigger**: Post-hook execution time > 2s in benchmark tests.

---

### Risk 4: Solution C Implementation Complexity (Medium Risk)

**Scenario**: `--incremental` flag implementation in audit.ts is more complex than anticipated.

**Impact**: Phase 3 delayed while Solution C is implemented.

**Probability**: Medium (audit.ts has complex validation logic)

**Mitigation**:
1. Implement Solution C as parallel task in Week 1-2
2. If not ready, deploy Phase 3 without incremental mode (fallback to full audit)
3. Add incremental mode in Phase 3.1 patch release

**Rollback Trigger**: Solution C not completed by end of Week 2.

---

## Rollback Plan

### Trigger Conditions

**Critical Issues Discovered**:
- More than 3 CI/CD pipeline failures in Week 2
- More than 5 developer complaints about hook behavior
- Post-hook execution time > 2s in benchmarks
- Solution C implementation blocked

**Decision Criteria**: Rollback if ANY trigger condition met and issue cannot be resolved within 48 hours.

---

### Rollback Steps

**Step 1: Halt Phase 3 Deployment** (Immediate)
- Issue announcement to all teams
- Tag current state as `rollback-point-phase3-attempt`
- Document issues in `memory/YYYY-MM-DD.md`

**Step 2: Restore vsp-dev-sync.ps1 as Primary** (Within 4 hours)
- Remove deprecation notice from `vsp-dev-sync.ps1`
- Revert CI/CD pipelines to use `vsp-dev-sync.ps1`
- Update documentation to reflect rollback

**Step 3: Root Cause Analysis** (Within 24 hours)
- Create incident report in `docs/incidents/`
- Identify technical root cause
- Propose fix or alternative approach

**Step 4: Fix and Retry** (Within 1 week)
- Implement fix based on root cause analysis
- Create new transition plan (A-16.1)
- Reattempt Phase 3 deployment

---

### Rollback Communication Template

```
Subject: Phase 3 Rollback - vsp-sync.ps1 Deployment

Dear Team,

We are rolling back the Phase 3 deployment of vsp-sync.ps1 due to:
[Issue description]

Impact:
- CI/CD pipelines reverted to vsp-dev-sync.ps1
- Phase 3 features unavailable until further notice
- Expected downtime: [X] days

Next Steps:
- Root cause analysis in progress
- Fix expected by: [Date]
- Retry deployment scheduled for: [Date]

Please continue using vsp-dev-sync.ps1 until further notice.

Regards,
Architecture Team
```

---

## Success Criteria

### Implementation Success Criteria

- [ ] **vsp-sync.ps1 created with hook architecture**
  - Script exists in `scripts/` directory
  - Implements pre-hook → main → post-hook pattern
  - All helper functions implemented

- [ ] **All Phase 2 features preserved in Phase 3**
  - Audit integration functional
  - MCP sync functional
  - SAP sync logic preserved
  - Memory log management preserved
  - Git commit preserved

- [ ] **Solution C (incremental audit) implemented**
  - audit.ts supports `--incremental` flag
  - Incremental mode reduces execution time by > 50%
  - No regressions in audit coverage

- [ ] **End-to-end 6-step workflow test passes**
  - All 6 steps execute successfully
  - Hooks execute in correct order
  - Error scenarios handled correctly

- [ ] **Documentation updated**
  - scripts/SCRIPTS.md reflects new script
  - docs/context.md updated with Phase 3 architecture
  - CHANGELOG.md entry added
  - Migration guide created

- [ ] **Migration guide created for users**
  - Script name changes documented
  - Flag changes documented
  - Use cases for new flags explained
  - Timeline provided

- [ ] **vsp-dev-sync.ps1 marked as deprecated**
  - Deprecation notice added to header
  - Compatibility wrapper maintained during transition
  - Removal date specified (post-2026-06-15)

---

### Quality Assurance Success Criteria

- [ ] **All unit tests pass**
  - Hook invocation functions
  - Main logic (Invoke-SapSync)
  - Error handling

- [ ] **All integration tests pass**
  - Full workflow execution
  - Skip modes
  - Error scenarios

- [ ] **No regressions from Phase 2**
  - All existing use cases work
  - Performance maintained or improved
  - Error messages preserved

- [ ] **CI/CD pipelines updated and tested**
  - All pipelines use vsp-sync.ps1
  - Flag mappings correct
  - No pipeline failures

---

## Timeline

### Phase 2→Phase 3 Transition: 3-4 Weeks

**Week 1: Hook Infrastructure + Pre-hook Integration**
- Day 1-2: Hook infrastructure design and implementation
- Day 3-4: Solution C implementation in audit.ts
- Day 5: Pre-hook integration for audit.ts and sync-mcp.ts
- Deliverables: Hook functions, audit.ts with incremental mode, pre-hook tests

**Week 2: Main Logic Preservation + Post-Hook Integration**
- Day 1-2: Extract SAP sync logic from vsp-dev-sync.ps1
- Day 3-4: Implement Invoke-SapSync function
- Day 5: Post-hook integration for sync-md.ts
- Deliverables: Invoke-SapSync function, post-hook integration, integration tests

**Week 3: vsp-sync.ps1 Creation + Testing**
- Day 1-2: Combine all components into vsp-sync.ps1
- Day 3-4: End-to-end testing (6-step workflow)
- Day 5: Performance benchmarking
- Deliverables: vsp-sync.ps1, test reports, benchmark results

**Week 4: Documentation + Migration Guide + QA**
- Day 1-2: Update documentation (SCRIPTS.md, context.md)
- Day 3: Create migration guide for users
- Day 4: Update CI/CD pipelines
- Day 5: Final QA and sign-off
- Deliverables: Updated documentation, migration guide, updated pipelines

**Documentation Handoff Checklist** (devops-admin → code-writer):

> **Context**: Per G0003 § Phase 2 Sign-Off and joint review concern #3, devops-admin must provide complete internal documentation to code-writer before ownership transition in Phase 3. This checklist ensures code-writer has all necessary documentation to assume vsp-sync.ps1 ownership.

**Internal Documentation**:
- [ ] **vsp-sync.ps1 Internal Architecture Documentation**
  - [ ] Hook contract specification (pre-hook → main → post-hook)
  - [ ] Parameter reference ($NoAudit, $NoMcp, $NoPostHook)
  - [ ] Hook invocation helper functions documented
  - [ ] Error handling framework documented
  - [ ] Acceptance: code-writer can explain hook execution flow without assistance

- [ ] **Troubleshooting Guide**
  - [ ] Common error codes and solutions (exit codes 0-255)
  - [ ] Hook failure scenarios and recovery procedures
  - [ ] Performance issues and diagnosis steps
  - [ ] Known limitations and workarounds
  - [ ] Acceptance: code-writer can resolve top 10 common errors independently

- [ ] **Maintenance Guide**
  - [ ] Version update procedures (audit.ts, sync-mcp.ts, sync-md.ts integration)
  - [ ] Hook addition template (how to add new pre/post hooks)
  - [ ] Testing checklist for validation (unit, integration, e2e)
  - [ ] Rollback procedures and triggers
  - [ ] Acceptance: code-writer can execute full update cycle without devops-admin assistance

- [ ] **Known Issues and Workarounds**
  - [ ] Documented edge cases (e.g., incremental audit limitations)
  - [ ] Platform-specific issues (Windows vs Unix hook behavior)
  - [ ] MCP sync failure handling (non-critical vs critical)
  - [ ] Post-hook failure scenarios (non-blocking behavior)
  - [ ] Acceptance: All known issues cataloged with severity levels

- [ ] **Performance Baseline Metrics**
  - [ ] Phase 2 benchmark results (execution time, success rate)
  - [ ] Phase 3 target metrics (≤ 2s for post-hook, ≤ 10s full sync)
  - [ ] Performance regression thresholds
  - [ ] Monitoring procedures for ongoing validation
  - [ ] Acceptance: Baseline established in docs/context.md, validated in Week 3

**Handoff Completion Criteria**:
- [ ] All 5 documentation categories complete
- [ ] Code-writer review session conducted (1-2 hours)
- [ ] Code-writer confirms documentation completeness
- [ ] Handoff log entry created in memory/YYYY-MM-DD.md
- [ ] PM sign-off obtained for ownership transition

**Handoff Deliverables**:
- [ ] `docs/vsp-sync-architecture.md` (internal documentation)
- [ ] `docs/vsp-sync-troubleshooting.md` (troubleshooting guide)
- [ ] `docs/vsp-sync-maintenance.md` (maintenance guide)
- [ ] `docs/vsp-sync-known-issues.md` (known issues catalog)
- [ ] `docs/vsp-sync-performance-baseline.md` (performance metrics)

---

## Conclusion

### Transition Readiness Assessment

**Technical Readiness**: ✅ High
- All Phase 2 components well-understood
- Hook architecture pattern proven
- Solution C implementation straightforward

**Organizational Readiness**: ✅ Medium
- Some CI/CD pipelines may need updates
- User training required for new flags
- Communication plan needed for deprecation

**Risk Level**: 🟡 Medium
- Breaking changes in script name and flags
- CI/CD pipeline updates required
- Solution C timeline uncertainty

### Recommendation

**Proceed with Phase 3 Transition** based on:
1. Clear technical path with minimal unknowns
2. Comprehensive rollback plan if issues arise
3. 4-week timeline allows for iterative refinement
4. Benefits (hook extensibility, domain ownership) justify transition cost

### Next Steps (A-16 Part 2)

1. **Obtain approval** for transition plan from stakeholders
2. **Begin Week 1** hook infrastructure implementation
3. **Create tracking task** in memory/YYYY-MM-DD.md for progress
4. **Schedule weekly checkpoints** to review progress against timeline

---

## Appendix A: File Inventory

### Phase 2 Files (Current State)

| File | Purpose | Status |
|------|---------|--------|
| `scripts/vsp-dev-sync.ps1` | Hybrid orchestration script | Active (to be deprecated) |
| `scripts/audit.ts` | Workspace validation | v2.4.0 (needs Solution C) |
| `scripts/sync-mcp.ts` | MCP configuration sync | v1.0.0 (no changes) |
| `scripts/vsp-sync.ps1` | Legacy VSP sync script | To be deprecated |
| `scripts/vsp-audit.ps1` | SAP documentation audit | Active (no changes) |
| `scripts/sync-md.ts` | Memory index update | v1.2.0 (to be post-hook) |

### Phase 3 Files (Target State)

| File | Purpose | Status |
|------|---------|--------|
| `scripts/vsp-sync.ps1` | SAP-first hook orchestration | New (to be created) |
| `scripts/audit.ts` | Workspace validation + incremental mode | v2.5.0 (Solution C) |
| `scripts/sync-mcp.ts` | MCP configuration sync | v1.0.0 (no changes) |
| `scripts/sync-md.ts` | Memory index update (post-hook) | v1.2.0 (no changes) |
| `scripts/vsp-audit.ps1` | SAP documentation audit | Active (no changes) |
| `scripts/vsp-dev-sync.ps1` | Legacy compatibility wrapper | Deprecated (remove Week 5+) |

---

## Appendix B: Command Reference

### Phase 2 Commands (Deprecated)

```powershell
# Full sync
.\scripts\vsp-dev-sync.ps1 -Message "feat: update"

# Skip audit (fast iteration)
.\scripts\vsp-dev-sync.ps1 -Message "feat: update" -SkipAudit

# Skip MCP sync
.\scripts\vsp-dev-sync.ps1 -Message "feat: update" -SkipMcpSync

# Skip SAP sync (workspace only)
.\scripts\vsp-dev-sync.ps1 -Message "feat: update" -SkipSapSync

# All skips (debug mode)
.\scripts\vsp-dev-sync.ps1 -Message "feat: update" -SkipAudit -SkipMcpSync -SkipSapSync
```

### Phase 3 Commands (New)

```powershell
# Full sync (all hooks)
.\scripts\vsp-sync.ps1 -Message "feat: update"

# Skip audit (fast iteration with incremental mode)
.\scripts\vsp-sync.ps1 -Message "feat: update" -NoAudit

# Skip MCP sync
.\scripts\vsp-sync.ps1 -Message "feat: update" -NoMcp

# Skip post-hook (no memory index update)
.\scripts\vsp-sync.ps1 -Message "feat: update" -NoPostHook

# All skips (SAP sync only)
.\scripts\vsp-sync.ps1 -Message "feat: update" -NoAudit -NoMcp -NoPostHook
```

---

## Appendix C: Contact Information

**Transition Team**:
- **Architect**: architect (this document)
- **Implementation Lead**: automation-engineer (Week 1-4)
- **QA Lead**: auditor (testing and validation)
- **Documentation**: docs-writer (migration guide)

**Escalation Path**:
1. Week 1-2: Report to architect
2. Week 3-4: Report to PM
3. Critical issues: Immediate rollback (see Rollback Plan)

---

**Document Version**: 1.0
**Last Updated**: 2026-06-01
**Next Review**: 2026-06-08 (end of Week 1)

---

**References**:
- [ADR-0021: vsp-dev-sync.ps1 Architecture Design](./0021-vsp-dev-sync-architecture.md)
- [scripts/vsp-dev-sync.ps1](../../scripts/vsp-dev-sync.ps1) - Current Phase 2 implementation
- [scripts/audit.ts](../../scripts/audit.ts) - Workspace validation
- [scripts/sync-mcp.ts](../../scripts/sync-mcp.ts) - MCP configuration sync
- [CONSTITUTION.md §5 - Multi-Agent Architecture](../constitution/05-multi-agent-architecture.md)
