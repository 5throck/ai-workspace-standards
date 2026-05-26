$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
# QA Gate Automation - Phase 5 (PowerShell version)
# Run by Consistency Auditor to verify workspace standards

Write-Host "🔬 QA Gate - Phase 5" -ForegroundColor Cyan
Write-Host "====================="

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

# 1. Workspace audit
Write-Host "Step 1: Workspace standards audit..."
bash scripts/audit.sh
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ FAIL: audit.sh failed" -ForegroundColor Red
    exit 1
}

# 2. Project-specific tests (if package.json exists)
if (Test-Path "package.json") {
    Write-Host "Step 2: Running project tests..."
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($packageJson.scripts.PSObject.Properties.Name -contains 'test') {
        npm test
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ FAIL: Tests failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "⚠️  SKIP: No test script found in package.json" -ForegroundColor Yellow
    }
}

# 3. Documentation consistency checks
Write-Host "Step 3: Checking documentation consistency..."

# Check AGENTS.md exists
if (-not (Test-Path "AGENTS.md")) {
    Write-Host "❌ FAIL: AGENTS.md not found" -ForegroundColor Red
    exit 1
}

# Check README.md has Korean pair (for templates only)
if ((Test-Path "templates/README.md") -and -not (Test-Path "templates/README_ko.md")) {
    Write-Host "❌ FAIL: templates/README.md exists but templates/README_ko.md missing" -ForegroundColor Red
    exit 1
}

Write-Host "✅ QA PASS" -ForegroundColor Green
Write-Host "=========="
exit 0