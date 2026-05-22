# audit.ps1 — Documentation integrity check (Windows PowerShell)
# Mirrors audit.sh exactly. Exit code 0 = pass, non-zero = fail.

$errors = 0

function Pass($msg)  { Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail($msg)  { Write-Host "[FAIL] $msg" -ForegroundColor Red;   $script:errors++ }
function Warn($msg)  { Write-Host "[WARN] $msg" -ForegroundColor Yellow }

Write-Host "=== audit.ps1 — workspace standards check ===" -ForegroundColor Cyan

# 1. CHANGELOG.md must exist
if (Test-Path "CHANGELOG.md") { Pass "CHANGELOG.md exists" }
else                           { Fail "CHANGELOG.md missing" }

# 2. CONSTITUTION.md must exist
if (Test-Path "CONSTITUTION.md") { Pass "CONSTITUTION.md exists" }
else                              { Fail "CONSTITUTION.md missing" }

# 3. docs/context.md must have ## Coding Guidelines
if (Test-Path "docs/context.md") {
    $content = Get-Content "docs/context.md" -Raw
    if ($content -match "(?m)^## Coding Guidelines") { Pass "docs/context.md has ## Coding Guidelines" }
    else                                               { Fail "docs/context.md is missing '## Coding Guidelines' section" }
} else {
    Warn "docs/context.md not found — skipping Coding Guidelines check (workspace root)"
}

# 4. CHANGELOG.md must have [Unreleased] section (project-level check)
if ((Test-Path "docs/context.md") -and (Test-Path "CHANGELOG.md")) {
    $cl = Get-Content "CHANGELOG.md" -Raw
    if ($cl -match "\[Unreleased\]") { Pass "CHANGELOG.md has [Unreleased] section" }
    else                              { Fail "CHANGELOG.md is missing '[Unreleased]' section" }
}

Write-Host ""
if ($errors -eq 0) {
    Write-Host "✅ All checks passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ $errors check(s) failed. Fix before committing." -ForegroundColor Red
    exit 1
}
