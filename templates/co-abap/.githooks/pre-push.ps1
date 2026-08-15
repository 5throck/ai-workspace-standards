# pre-push.ps1: run audit gate + block direct push to main/master.
# PowerShell equivalent of the bash pre-push hook.

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "=== pre-push audit ==="
bun scripts/audit.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Audit failed - push blocked. Fix issues above before pushing." -ForegroundColor Red
    exit 1
}

$zeroSha = "0000000000000000000000000000000000000000"
$blocked = $false
$blockedRef = ""

$input | ForEach-Object {
    $parts = ($_ -split "\s+") | Where-Object { $_ -ne "" }
    if ($parts.Count -lt 4) { return }
    $localRef = $parts[0]
    $localSha = $parts[1]
    $remoteRef = $parts[2]

    # Deleting a remote ref (local_sha is all zeros) is never a "direct push" - always allow.
    if ($localSha -eq $zeroSha) { return }

    if ($remoteRef -eq "refs/heads/main" -or $remoteRef -eq "refs/heads/master") {
        $script:blocked = $true
        $script:blockedRef = $remoteRef -replace '^refs/heads/', ''
    }
}

if ($blocked) {
    Write-Host ""
    Write-Host "Direct push to '$blockedRef' is blocked. Use a PR branch." -ForegroundColor Red
    Write-Host '   Create a PR with: /sync "feat: ..."  or  bun scripts/dev-sync.ts "feat: ..."'
    exit 1
}
