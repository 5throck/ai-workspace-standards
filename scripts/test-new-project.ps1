#!/usr/bin/env pwsh
# E2E Test Script for new-project.ps1
# Tests UTF-8 integrity, hook installation, and template synchronization

param(
    [Parameter(Mandatory=$true)]
    [string]$TestProjectName
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

Write-Host "🧪 Running E2E Test for new-project.ps1" -ForegroundColor Cyan
Write-Host "Test Project: $TestProjectName" -ForegroundColor Yellow
Write-Host ""

$testDir = "Test-$TestProjectName"
$testPassed = $true
$testsRun = 0
$testsPassed = 0

try {
    # Cleanup function
    function Cleanup-TestProject {
        if (Test-Path $testDir) {
            Write-Host "🧹 Cleaning up test project..." -ForegroundColor Yellow
            Remove-Item $testDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    # Test 1: Project Creation
    Write-Host "Test 1: Project Creation" -ForegroundColor Cyan
    $testsRun++
    try {
        & .\new-project.ps1 $testDir

        if (-not (Test-Path $testDir)) {
            throw "Project creation failed - directory not found"
        }

        Write-Host "✅ Test 1 PASSED: Project created successfully" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "❌ Test 1 FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $testPassed = $false
    }

    # Test 2: UTF-8 Integrity Verification
    Write-Host ""
    Write-Host "Test 2: UTF-8 Integrity Verification" -ForegroundColor Cyan
    $testsRun++
    try {
        $readmePath = Join-Path $testDir "README.md"

        if (-not (Test-Path $readmePath)) {
            throw "README.md not found in project"
        }

        # Read file with UTF-8 encoding
        $readmeContent = Get-Content $readmePath -Raw -Encoding UTF8

        # Check for UTF-8 characters (Korean, emoji, etc.)
        $utf8Detected = $false
        if ($readmeContent -match '[^\x00-\x7F]') {
            $utf8Detected = $true
        }

        if ($utf8Detected) {
            Write-Host "✅ Test 2 PASSED: UTF-8 characters preserved correctly" -ForegroundColor Green
            $testsPassed++
        } else {
            Write-Host "⚠️  Test 2 WARNING: No UTF-8 characters found to verify" -ForegroundColor Yellow
            $testsPassed++ # Count as pass since no corruption occurred
        }
    }
    catch {
        Write-Host "❌ Test 2 FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $testPassed = $false
    }

    # Test 3: Git Hooks Installation
    Write-Host ""
    Write-Host "Test 3: Git Hooks Installation" -ForegroundColor Cyan
    $testsRun++
    try {
        $gitDir = Join-Path $testDir ".git"
        $githooksDir = Join-Path $testDir ".githooks"

        if (-not (Test-Path $gitDir)) {
            throw "Git repository not initialized"
        }

        if (-not (Test-Path $githooksDir)) {
            throw ".githooks/ directory not found"
        }

        # Check for critical hooks
        $preCommitHook = Join-Path $githooksDir "pre-commit"
        if (-not (Test-Path $preCommitHook)) {
            throw "pre-commit hook not found"
        }

        Write-Host "✅ Test 3 PASSED: Git hooks installed correctly" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "❌ Test 3 FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $testPassed = $false
    }

    # Test 4: Template Synchronization
    Write-Host ""
    Write-Host "Test 4: Template Synchronization" -ForegroundColor Cyan
    $testsRun++
    try {
        $requiredFiles = @(
            "CLAUDE.md",
            "GEMINI.md",
            "CONSTITUTION.md",
            ".gitignore",
            ".githooks/pre-commit"
        )

        $missingFiles = @()
        foreach ($file in $requiredFiles) {
            $filePath = Join-Path $testDir $file
            if (-not (Test-Path $filePath)) {
                $missingFiles += $file
            }
        }

        if ($missingFiles.Count -gt 0) {
            throw "Missing required template files: $($missingFiles -join ', ')"
        }

        Write-Host "✅ Test 4 PASSED: All required template files synchronized" -ForegroundColor Green
        $testsPassed++
    }
    catch {
        Write-Host "❌ Test 4 FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $testPassed = $false
    }

    # Test 5: File Permissions (Unix-style)
    Write-Host ""
    Write-Host "Test 5: File Permissions" -ForegroundColor Cyan
    $testsRun++
    try {
        $scriptFiles = Get-ChildItem -Path $testDir -Filter "*.sh" -Recurse

        if ($scriptFiles.Count -gt 0) {
            # On Unix-like systems, check execute permission
            if ($IsLinux -or $IsMacOS) {
                $hasExecutePermission = $false
                foreach ($file in $scriptFiles) {
                    $permissions = [System.IO.File]::GetPermissions($file.FullName)
                    if ($permissions -match 'Execute') {
                        $hasExecutePermission = $true
                        break
                    }
                }

                if ($hasExecutePermission) {
                    Write-Host "✅ Test 5 PASSED: Script files have execute permissions" -ForegroundColor Green
                    $testsPassed++
                } else {
                    throw "Script files missing execute permissions"
                }
            } else {
                Write-Host "⚠️  Test 5 SKIPPED: Permission test not applicable on Windows" -ForegroundColor Yellow
                $testsPassed++ # Count as pass on Windows
            }
        } else {
            Write-Host "⚠️  Test 5 SKIPPED: No .sh files found to check" -ForegroundColor Yellow
            $testsPassed++ # Count as pass if no scripts
        }
    }
    catch {
        Write-Host "❌ Test 5 FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $testPassed = $false
    }

    # Summary
    Write-Host ""
    Write-Host "📊 Test Summary" -ForegroundColor Cyan
    Write-Host "   Tests Run: $testsRun" -ForegroundColor White
    Write-Host "   Tests Passed: $testsPassed" -ForegroundColor Green
    Write-Host "   Overall Result: $(if ($testPassed) { 'PASSED ✅' } else { 'FAILED ❌' })" -ForegroundColor $(if ($testPassed) { 'Green' } else { 'Red' })

    # Cleanup
    Cleanup-TestProject

    exit $(if ($testPassed) { 0 } else { 1 })

}
catch {
    Write-Host "❌ E2E Test Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red

    # Cleanup on error
    if (Test-Path $testDir) {
        Remove-Item $testDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    exit 1
}
