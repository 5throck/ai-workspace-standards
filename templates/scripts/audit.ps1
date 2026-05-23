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

# ── Project-level checks (skip at workspace root where docs/context.md is absent) ──

# 3. CHANGELOG.md must have [Unreleased] section
if (Test-Path "CHANGELOG.md") {
    $cl = Get-Content "CHANGELOG.md" -Raw
    if ($cl -match "\[Unreleased\]") { Pass "CHANGELOG.md has [Unreleased]" }
    else { Fail "CHANGELOG.md missing '[Unreleased]'" }
}

if (Test-Path "docs\context.md") {
    $ctx = Get-Content "docs\context.md" -Raw

    # 4. docs/context.md must have ## Coding Guidelines
    if ($ctx -match "(?m)^## Coding Guidelines") { Pass "docs/context.md has ## Coding Guidelines" }
    else { Fail "docs/context.md missing '## Coding Guidelines'" }

    # 5. AGENTS.md must exist
    if (Test-Path "AGENTS.md") { Pass "AGENTS.md exists" }
    else { Fail "AGENTS.md missing (required for agent-first projects)" }

    # 6. At least one agent file must exist in agents/
    $agentFiles = Get-ChildItem -Path "agents" -Filter "*.md" -ErrorAction SilentlyContinue
    if ($agentFiles) { Pass "agents/ has agent files" }
    else { Fail "agents/ is empty or missing — create at least agents/pm.md" }

    # 7. .env.sample must exist
    if (Test-Path ".env.sample") { Pass ".env.sample exists" }
    else { Warn ".env.sample not found — add one if this project uses environment variables" }

    # 8. scripts/ .sh/.ps1 parity check
    Get-ChildItem -Path "scripts" -Filter "*.sh" -ErrorAction SilentlyContinue | ForEach-Object {
        $ps1 = Join-Path "scripts" ($_.BaseName + ".ps1")
        if (Test-Path $ps1) { Pass "script parity: $($_.Name) / $($_.BaseName).ps1" }
        else { Warn "script parity gap: $($_.Name) has no matching .ps1" }
    }

} else {
    Warn "docs/context.md not found — skipping project-level checks (workspace root)"
}

Write-Host ""
if ($errors -eq 0) { Write-Host "✅ All checks passed." -ForegroundColor Green; exit 0 }
else { Write-Host "❌ $errors check(s) failed. Fix before committing." -ForegroundColor Red; exit 1 }

