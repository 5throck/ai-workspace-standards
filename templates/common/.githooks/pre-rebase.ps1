# pre-rebase.ps1 - Scan commits being rebased for secrets (Windows)
# Triggered: Before git rebase operation
# Blocks: Rebase if secrets detected in any commit being rewritten
# Bypass: Set environment variable $env:REBASE_BYPASS_SECRET_SCAN="1"

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

# Allow bypass with environment variable (use carefully!)
if ($env:REBASE_BYPASS_SECRET_SCAN -eq "1") {
    Write-Host "⚠️  WARNING: Secret scan bypassed via REBASE_BYPASS_SECRET_SCAN=1" -ForegroundColor Yellow
    exit 0
}

# Check if gitleaks is available
$Gitleaks = Get-Command gitleaks -ErrorAction SilentlyContinue
if (-not $Gitleaks) {
    Write-Host "⚠️  gitleaks not found - skipping secret scan during rebase" -ForegroundColor Yellow
    Write-Host "   Install gitleaks for protection: https://github.com/gitleaks/gitleaks" -ForegroundColor Cyan
    exit 0
}

Write-Host "🔍 Scanning for secrets in commits being rebased..." -ForegroundColor Cyan

# Get rebase parameters from args
# Git passes: upstream branch [branch being rebased]
if ($args.Count -ge 2) {
    $Upstream = $args[0]
    $RebaseBranch = $args[1]

    # Scan each commit in the rebase range
    $Commits = git rev-list --no-merges "$Upstream..$RebaseBranch" 2>$null
    if ($Commits) {
        foreach ($Commit in $Commits) {
            $Content = git show $Commit 2>$null
            if ($Content) {
                $Content | gitleaks detect --no-git --verbose --exit-code 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✅ Commit $Commit : clean" -ForegroundColor Green
                } else {
                    Write-Host "❌ SECRET DETECTED in commit $Commit" -ForegroundColor Red
                    Write-Host "   Rebase blocked to prevent secret exposure" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "To bypass (not recommended):" -ForegroundColor Yellow
                    Write-Host "  `$env:REBASE_BYPASS_SECRET_SCAN='1'; git rebase $Upstream $RebaseBranch" -ForegroundColor Cyan
                    exit 1
                }
            }
        }
    }
} else {
    # Fallback: scan recent commits if no parameters provided
    Write-Host "⚠️  No rebase parameters - scanning last 10 commits" -ForegroundColor Yellow
    $Commits = git log -n 10 --format="%H" 2>$null
    if ($Commits) {
        foreach ($Commit in $Commits) {
            $Content = git show $Commit 2>$null
            if ($Content) {
                $Content | gitleaks detect --no-git --verbose --exit-code 2>$null
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "❌ SECRET DETECTED in commit $Commit" -ForegroundColor Red
                    exit 1
                }
            }
        }
    }
}

Write-Host "✅ No secrets found - rebase can proceed" -ForegroundColor Green
exit 0
