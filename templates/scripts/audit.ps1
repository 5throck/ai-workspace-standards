# audit.ps1 — Documentation integrity check (Windows PowerShell)
# Mirrors audit.sh exactly. Exit code 0 = pass, non-zero = fail.

$errors = 0
function Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:errors++ }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "=== audit.ps1 — workspace standards check ===" -ForegroundColor Cyan

# 1. CHANGELOG.md must exist
if (Test-Path "CHANGELOG.md") { Pass "CHANGELOG.md exists" } else { Fail "CHANGELOG.md missing" }

# 2. CONSTITUTION.md must be accessible (workspace root or one level up)
if ((Test-Path "CONSTITUTION.md") -or (Test-Path "..\CONSTITUTION.md")) { Pass "CONSTITUTION.md accessible" }
else { Fail "CONSTITUTION.md not found (expected at ./ or ../)" }

# 3. docs/context.md must have ## Coding Guidelines
if (Test-Path "docs/context.md") {
    $content = Get-Content "docs/context.md" -Raw
    if ($content -match "(?m)^## Coding Guidelines") { Pass "docs/context.md has ## Coding Guidelines" }
    else { Fail "docs/context.md missing '## Coding Guidelines'" }
} else { Warn "docs/context.md not found — skipping (workspace root)" }

# 4. CHANGELOG.md must have [Unreleased] (project-level only)
if ((Test-Path "docs/context.md") -and (Test-Path "CHANGELOG.md")) {
    $cl = Get-Content "CHANGELOG.md" -Raw
    if ($cl -match "\[Unreleased\]") { Pass "CHANGELOG.md has [Unreleased]" }
    else { Fail "CHANGELOG.md missing '[Unreleased]'" }
}

Write-Host ""
if ($errors -eq 0) { Write-Host "✅ All checks passed." -ForegroundColor Green; exit 0 }
else { Write-Host "❌ $errors check(s) failed. Fix before committing." -ForegroundColor Red; exit 1 }
