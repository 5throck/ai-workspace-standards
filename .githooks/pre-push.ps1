#!/usr/bin/env pwsh
# pre-push: run audit gate + integration tests + block direct push to main/master.

$ErrorActionPreference = "Stop"

# ── 1. Audit gate ──────────────────────────────────────────────────────────────
Write-Host "=== pre-push audit ===" -ForegroundColor Cyan
& bun scripts/audit.ts

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "❌ Audit failed — push blocked. Fix issues above before pushing." -ForegroundColor Red
  exit 1
}

# ── 2. Integration tests ──────────────────────────────────────────────────────
Write-Host "=== pre-push integration tests ===" -ForegroundColor Cyan

if (Get-Command bun -ErrorAction SilentlyContinue) {
  Write-Host "Running integration tests via Bun..." -ForegroundColor Yellow
  bun scripts/test-runner.ts integration

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Integration tests failed — push blocked. Fix test failures before pushing." -ForegroundColor Red
    exit 1
  }
} else {
  Write-Host "⚠️  Bun not found — skipping integration tests (install Bun to enable)" -ForegroundColor Yellow
  Write-Host "   Run: irm bun.sh | iex" -ForegroundColor Gray
}

# ── 3. Block direct push to protected branches ────────────────────────────────
$BRANCH = git rev-parse --abbrev-ref HEAD
if ($BRANCH -eq "main" -or $BRANCH -eq "master") {
  Write-Host ""
  Write-Host "❌ Direct push to '$BRANCH' is blocked. Use a PR branch." -ForegroundColor Red
  Write-Host "   Create a PR with: /sync `"feat: ..."`  or  bun scripts/dev-sync.ts `"feat: ..."` -ForegroundColor Yellow
  exit 1
}
