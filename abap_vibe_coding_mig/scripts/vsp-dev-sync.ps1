$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
# ============================================================================
# DEPRECATED: Use vsp-sync.ps1 instead (Phase 3: Hook Architecture)
# ============================================================================
# scripts/vsp-dev-sync.ps1
# Version: 1.0.0 (Phase 2 - Deprecated)
# Usage: .\scripts\vsp-dev-sync.ps1 [-Message "type: summary"] [-SkipAudit] [-SkipMcpSync] [-SkipSapSync]
#
# DEPRECATION NOTICE:
# This script is deprecated and maintained only for backward compatibility during
# the Phase 2→Phase 3 transition period (2026-06-01 to 2026-06-15).
#
# MIGRATION PATH:
#   New Script: .\scripts\vsp-sync.ps1
#   Flag Changes:
#     -SkipAudit → -NoAudit (supports incremental mode)
#     -SkipMcpSync → -NoMcp
#     -SkipSapSync → -NoPostHook (skip post-hook only)
#
# Will be removed in Phase 4 (post-2026-06-15).
#
# Original Description:
# Hybrid sync pipeline combining workspace audit, MCP sync, and VSP infrastructure sync

param(
    [string]$Message = "",
    [switch]$SkipAudit,
    [switch]$SkipMcpSync,
    [switch]$SkipSapSync
)

# Script paths
$ScriptRoot = $PSScriptRoot
$WorkspaceRoot = Split-Path $ScriptRoot -Parent

# Helper functions
function Write-Phase {
    param([string]$Text)
    Write-Host $Text -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host $Text -ForegroundColor Green
}

function Write-Error-Color {
    param([string]$Text)
    Write-Host $Text -ForegroundColor Red
}

function Write-Warn-Color {
    param([string]$Text)
    Write-Host $Text -ForegroundColor Yellow
}

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$phaseTimer = [System.Diagnostics.Stopwatch]::StartNew()
$allPhasesPassed = $true
$warningOccurred = $false

Write-Host "=== VSP Dev Sync Pipeline ===" -ForegroundColor Cyan
if (-not [string]::IsNullOrWhiteSpace($Message)) {
    Write-Host "Commit message: $Message" -ForegroundColor Cyan
}
Write-Host ""

# Phase 1: Workspace Audit
if (-not $SkipAudit) {
    Write-Phase "[Phase 1/3] Running workspace audit..."
    $phaseTimer.Restart()

    & bun "$ScriptRoot\audit.ts"
    $auditExitCode = $LASTEXITCODE
    $phaseTimer.Stop()

    if ($auditExitCode -eq 0) {
        Write-Success "✓ Audit passed ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        Write-Host ""
    } else {
        Write-Error-Color "✗ Audit failed ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        Write-Error-Color "ERROR: Workspace validation failed"
        Write-Error-Color "HALT: Fix workspace issues and retry"
        Write-Error-Color "       Run 'bun scripts/audit.ts' for full details"
        $stopwatch.Stop()
        exit 1
    }
} else {
    Write-Warn-Color "[Phase 1/3] Skipped workspace audit (-SkipAudit)"
    Write-Host ""
}

# Phase 2: MCP Sync
if (-not $SkipMcpSync) {
    Write-Phase "[Phase 2/3] Syncing MCP configuration..."
    $phaseTimer.Restart()

    & bun "$ScriptRoot\sync-mcp.ts"
    $mcpExitCode = $LASTEXITCODE
    $phaseTimer.Stop()

    if ($mcpExitCode -eq 0) {
        Write-Success "✓ MCP synced ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        Write-Host ""
    } else {
        Write-Warn-Color "⚠ WARNING: MCP sync failed ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        Write-Warn-Color "   Reason: MCP configuration could not be synchronized"
        Write-Warn-Color "   Action: Continuing to SAP sync (MCP can be synced later)"
        Write-Host ""
        $warningOccurred = $true
    }
} else {
    Write-Warn-Color "[Phase 2/3] Skipped MCP sync (-SkipMcpSync)"
    Write-Host ""
}

# Phase 3: SAP Sync
if (-not $SkipSapSync) {
    Write-Phase "[Phase 3/3] Syncing VSP infrastructure..."
    $phaseTimer.Restart()

    # Inherit core logic from vsp-sync.ps1
    $date = Get-Date -Format "yyyy-MM-dd"
    $memoryDir = Join-Path $WorkspaceRoot "memory"
    $memoryFile = Join-Path $memoryDir "$date.md"
    $indexFile = Join-Path $memoryDir "MEMORY.md"

    # 3.1 Documentation Audit
    & "$ScriptRoot\vsp-audit.ps1"
    if ($LASTEXITCODE -ne 0) {
        $phaseTimer.Stop()
        Write-Error-Color "✗ Documentation audit failed ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
        Write-Error-Color "ERROR: VSP documentation validation failed"
        Write-Error-Color "HALT: Fix SAP documentation and retry"
        Write-Error-Color "       Run '.\scripts\vsp-audit.ps1' for full details"
        $stopwatch.Stop()
        exit 1
    }
    Write-Success "✓ Documentation audit passed ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"

    # 3.2 Memory Log Management
    if (-not (Test-Path $memoryFile)) {
        Write-Host "Memory log for today not found. Auto-creating $date.md..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $memoryDir -Force | Out-Null
        $time = Get-Date -Format "HH:mm"
        $header = @(
            "# Memory Log: $date",
            "",
            "<!-- Auto-created by vsp-dev-sync.ps1. Add entries below. -->",
            "",
            "## $time — Session",
            "",
            "<!-- Describe what was done today -->"
        )
        Set-Content -Path $memoryFile -Value $header -Encoding UTF8
        Write-Host "Created: $memoryFile" -ForegroundColor Green
    }

    # 3.3 Update MEMORY.md Index
    if (Test-Path $indexFile) {
        $indexContent = Get-Content $indexFile
        if (-not ($indexContent -match "\[$date\]\($date\.md\)")) {
            Write-Host "Updating memory index..." -ForegroundColor Green

            $summary = "Development update"
            $logContent = Get-Content $memoryFile
            $firstHeader = $logContent | Where-Object { $_ -match "^##\s+(.*)" } | Select-Object -First 1
            if ($firstHeader -match "##\s+(.*)") { $summary = $matches[1] }
            if ($Message -match ":\s*(.*)") { $summary = $matches[1] }

            $newEntry = "| [$date]($date.md) | $summary |"

            $newContent = @()
            $inserted = $false
            foreach ($line in $indexContent) {
                $newContent += $line
                if (-not $inserted -and $line -match "^\|------\|---------\|$") {
                    $newContent += $newEntry
                    $inserted = $true
                }
            }
            Set-Content -Path $indexFile -Value $newContent -Encoding UTF8
        }
    }

    Write-Success "✓ Memory log updated: memory/$date.md"

    # 3.4 Git Commit
    if ([string]::IsNullOrWhiteSpace($Message)) {
        $Message = Read-Host "Enter commit message (e.g., feat: add new report)"
    }

    if ([string]::IsNullOrWhiteSpace($Message)) {
        Write-Error-Color "ERROR: Commit message is required."
        $stopwatch.Stop()
        exit 1
    }

    $gitTimer = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "Committing to Git..." -ForegroundColor Green
    Set-Location $WorkspaceRoot
    git add -A
    git commit -m "$Message"
    $gitTimer.Stop()

    Write-Success "✓ Git commit successful ($($gitTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
    $phaseTimer.Stop()

    Write-Success "✓ VSP synced successfully ($($phaseTimer.Elapsed.TotalSeconds.ToString('0.0'))s)"
    Write-Host ""
} else {
    Write-Warn-Color "[Phase 3/3] Skipped VSP sync (-SkipSapSync)"
    Write-Host ""
}

# Summary
$stopwatch.Stop()

if ($SkipAudit -and $SkipMcpSync -and $SkipSapSync) {
    Write-Warn-Color "WARNING: All phases skipped (no-op mode)"
    Write-Host "Summary: No operations performed" -ForegroundColor Cyan
} elseif ($warningOccurred) {
    Write-Host "Summary: Completed with warnings in $($stopwatch.Elapsed.TotalSeconds.ToString('0.0'))s" -ForegroundColor Yellow
} else {
    Write-Success "Summary: All phases completed in $($stopwatch.Elapsed.TotalSeconds.ToString('0.0'))s"
}
