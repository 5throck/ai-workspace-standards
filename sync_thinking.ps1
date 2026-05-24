$msg = "feat: Explicitly specify Gemini thinking_level for 3-tier strategy"
$repos = @("abap_vibe_coding", "abap_vibe_coding_plugin", "Pricing-Mgmt-Simulation", "quickdl")

Write-Host "=== Syncing Root (C:\git) ==="
Set-Location "C:\git"
powershell -ExecutionPolicy Bypass -File .\scripts\dev-sync.ps1 $msg

$rootPr = gh pr list --limit 1 --json number -q ".[0].number"
if ($rootPr) { gh pr merge $rootPr --merge --delete-branch }

foreach ($repo in $repos) {
    Write-Host "`n=== Syncing $repo ==="
    Set-Location "C:\git\$repo"
    
    git checkout main
    
    $branch = "pr/think-lvl-$(Get-Date -Format 'HHmmss')"
    git checkout -b $branch
    git add -A
    git commit -m "$msg`n`nCo-Authored-By: Gemini <noreply@google.com>"
    git push -u origin $branch
    
    gh pr create --title $msg --fill
    
    $prNum = gh pr list --head $branch --json number -q ".[0].number"
    if ($prNum) { gh pr merge $prNum --merge --delete-branch }
    
    git checkout main
    git pull
}
