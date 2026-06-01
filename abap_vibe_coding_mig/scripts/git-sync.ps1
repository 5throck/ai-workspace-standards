$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
# scripts/git-sync.ps1
# Usage: .\scripts\git-sync.ps1 [-Message "..."]
# Commits and pushes all changes to the current branch.

param(
    [string]$Message = "chore: auto-sync documentation and configuration"
)

$branch = git rev-parse --abbrev-ref HEAD

Write-Host "--- Git Sync ---" -ForegroundColor Cyan
Write-Host "Branch: $branch"

git add .

$status = git status --porcelain
if ($null -ne $status -and $status.Length -gt 0) {
    git commit -m "$Message"
    git push origin $branch
    Write-Host "Successfully synced to Git." -ForegroundColor Green
} else {
    Write-Host "No changes to sync." -ForegroundColor Yellow
}
