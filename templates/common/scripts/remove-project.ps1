# @version 1.0.0
# remove-project.ps1 — Safely delete a project directory on Windows without administrator privileges
#
# SYNOPSIS:
#   .\\scripts\\remove-project.ps1 "path\\to\\project"
#
# DESCRIPTION:
#   Windows projects created by new-project.ps1 contain .git loose-object files
#   marked ReadOnly and directories with disabled ACL inheritance. This script:
#     1. Detects if Claude Code / Antigravity is running and prompts for confirmation
#     2. Recursively clears ReadOnly, Hidden, and System file attributes (incl. .git/)
#     3. Resets NTFS ACLs to grant the current user Full Control
#     4. Deletes the project folder via Remove-Item; falls back to robocopy /mir if needed
#
# USAGE:
#   .\\scripts\\remove-project.ps1 "my-project"                         # relative path
#   .\\scripts\\remove-project.ps1 "C:\\git\\ai_workspace\\my-project"    # absolute path
#
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath
)

# UTF-8 encoding enforcement
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
    [System.Text.Encoding]::RegisterProvider([System.Text.CodePages.CodePagesEncodingProvider]::Instance)
} catch { }
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

# ── Resolve project directory path ───────────────────────────────────────────
$ProjectDir = $ProjectPath
if (-not [System.IO.Path]::IsPathRooted($ProjectPath)) {
    $ProjectDir = Join-Path (Get-Location) $ProjectPath
}
$ProjectDir = [System.IO.Path]::GetFullPath($ProjectDir)

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host "  REMOVE PROJECT: $ProjectDir" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor DarkGray
Write-Host ""

# ── Validate path exists ──────────────────────────────────────────────────────
if (-not (Test-Path $ProjectDir -PathType Container)) {
    Write-Host "[FAIL] Project directory not found: $ProjectDir" -ForegroundColor Red
    exit 1
}

# ── Step 1: Detect running processes (Hybrid Model) ──────────────────────────
Write-Host "[Step 1/5] Checking for running Claude Code / Antigravity processes..." -ForegroundColor Cyan

$runningProcs = @()
$procNames = @("claude", "antigravity", "Code", "node")
foreach ($name in $procNames) {
    $found = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -and ($_.Path -like "*claude*" -or $_.Path -like "*antigravity*")
    }
    if ($found) { $runningProcs += $found }
}

if ($runningProcs.Count -gt 0) {
    Write-Host ""
    Write-Host "  [WARN] The following processes are currently running:" -ForegroundColor Yellow
    $runningProcs | ForEach-Object { Write-Host "    - $($_.Name) (PID $($_.Id))" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "  [WARN] Continuing may cause data loss for unsaved work." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "  Continue with deletion? (Y/N)"
    if ($response -notmatch '^[Yy]$') {
        Write-Host ""
        Write-Host "  Deletion cancelled." -ForegroundColor Cyan
        exit 0
    }
    Write-Host ""
    Write-Host "  [Step 1/5] Terminating processes..." -ForegroundColor Cyan
    $runningProcs | ForEach-Object {
        try {
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            Write-Host "    [OK] Stopped: $($_.Name) (PID $($_.Id))" -ForegroundColor Green
        } catch {
            Write-Host "    [WARN] Could not stop $($_.Name): $_" -ForegroundColor Yellow
        }
    }
    Start-Sleep -Seconds 1
} else {
    Write-Host "  [OK] No conflicting processes detected." -ForegroundColor Green
}

# ── Step 2: Clear ReadOnly / Hidden / System attributes ──────────────────────
Write-Host ""
Write-Host "[Step 2/5] Clearing ReadOnly/Hidden/System attributes (including .git objects)..." -ForegroundColor Cyan

$attributesToClear = [System.IO.FileAttributes]::ReadOnly `
    -bor [System.IO.FileAttributes]::Hidden `
    -bor [System.IO.FileAttributes]::System

# Files (use -Force to traverse hidden dirs like .git/)
$fileCount = 0
Get-ChildItem -Path $ProjectDir -Recurse -Force -File -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Attributes -band $attributesToClear) {
        try {
            $_.Attributes = $_.Attributes -band (-bnot $attributesToClear)
            $fileCount++
        } catch { }
    }
}

# Directories
Get-ChildItem -Path $ProjectDir -Recurse -Force -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        $null = & cmd /c "attrib -R -S -H `"$($_.FullName)`"" 2>&1
    } catch { }
}

# Root dir itself
try {
    $null = & cmd /c "attrib -R -S -H `"$ProjectDir`"" 2>&1
} catch { }

Write-Host "  [OK] Attributes cleared on $fileCount files." -ForegroundColor Green

# ── Step 3: Reset ACLs to grant current user Full Control ────────────────────
Write-Host ""
Write-Host "[Step 3/5] Resetting NTFS ACLs..." -ForegroundColor Cyan

$currentUser     = [System.Environment]::UserName
$currentDomain   = [System.Environment]::UserDomainName

try {
    # Reset all ACEs first, then grant Full Control with inheritance flags
    $null = & icacls $ProjectDir /reset /T /C /Q 2>&1
    $null = & icacls $ProjectDir /grant "${currentDomain}\${currentUser}:(OI)(CI)F" /T /C /Q 2>&1
    $null = & icacls $ProjectDir /grant "${currentUser}:(OI)(CI)F" /T /C /Q 2>&1
    Write-Host "  [OK] ACL reset complete (Full Control granted to $currentUser)." -ForegroundColor Green
} catch {
    Write-Host "  [WARN] ACL reset encountered issues: $_" -ForegroundColor Yellow
}

# ── Step 4: Take ownership (handles edge cases where owner differs) ───────────
Write-Host ""
Write-Host "[Step 4/5] Taking ownership of project directory..." -ForegroundColor Cyan
try {
    $null = & takeown /F $ProjectDir /R /D Y 2>&1
    Write-Host "  [OK] Ownership transferred to $currentUser." -ForegroundColor Green
} catch {
    Write-Host "  [WARN] takeown encountered issues (non-fatal): $_" -ForegroundColor Yellow
}

# ── Step 5: Delete project directory ─────────────────────────────────────────
Write-Host ""
Write-Host "[Step 5/5] Deleting project directory..." -ForegroundColor Cyan

$deleted = $false

# Primary: Remove-Item -Recurse -Force
try {
    Remove-Item -Path $ProjectDir -Recurse -Force -ErrorAction Stop
    $deleted = $true
    Write-Host "  [OK] Project deleted successfully via Remove-Item." -ForegroundColor Green
} catch {
    Write-Host "  [WARN] Remove-Item failed: $_" -ForegroundColor Yellow
    Write-Host "  [INFO] Attempting robocopy mirror fallback..." -ForegroundColor Cyan
}

# Fallback: robocopy /mir with empty temp dir, then remove
if (-not $deleted) {
    $TempEmpty = Join-Path ([System.IO.Path]::GetTempPath()) ("empty_" + [System.IO.Path]::GetRandomFileName())
    try {
        New-Item -ItemType Directory -Path $TempEmpty -Force | Out-Null

        # Mirror empty dir onto project (effectively deletes all contents)
        $null = & robocopy $TempEmpty $ProjectDir /mir /w:0 /r:0 /njh /njs /nfl /ndl 2>&1

        # Remove the now-empty project dir and temp dir
        Remove-Item -Path $ProjectDir -Recurse -Force -ErrorAction SilentlyContinue
        $deleted = $true
        Write-Host "  [OK] Project deleted successfully via robocopy fallback." -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] Robocopy fallback also failed: $_" -ForegroundColor Red
    } finally {
        Remove-Item -Path $TempEmpty -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
if ($deleted) {
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host "  [SUCCESS] Project removed: $ProjectDir" -ForegroundColor Green
    Write-Host ("=" * 60) -ForegroundColor DarkGray
} else {
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host "  [FAIL] Could not fully delete: $ProjectDir" -ForegroundColor Red
    Write-Host "  Manual steps:" -ForegroundColor Yellow
    Write-Host "    1. Close all editors / terminals using this project." -ForegroundColor Yellow
    Write-Host "    2. Run as administrator: Remove-Item -Path `"$ProjectDir`" -Recurse -Force" -ForegroundColor Yellow
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    exit 1
}
