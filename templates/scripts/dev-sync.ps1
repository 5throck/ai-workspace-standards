# dev-sync.ps1 — Full pipeline: audit → memlog → commit → PR (Windows)
# Usage: .\scripts\dev-sync.ps1 "feat: description"
param([string]$Msg = "chore: update")

.\scripts\audit.ps1
if ($LASTEXITCODE -ne 0) { exit 1 }

$Date = Get-Date -Format "yyyy-MM-dd"
New-Item -ItemType Directory -Path "memory" -Force | Out-Null
Add-Content "memory\$Date.md" "## Session — $Msg"
.\scripts\sync-md.ps1 $Date $Msg

$Slug = ($Msg -replace '[^a-z0-9]', '-' -replace '-+', '-').ToLower()
$Slug = $Slug.Substring(0, [Math]::Min(40, $Slug.Length)).TrimEnd('-')
$Branch = "pr/$(Get-Date -Format 'yyyyMMdd-HHmmss')-$Slug"
git checkout -b $Branch
git add -A
git commit -m "$Msg`n`nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push -u origin $Branch
gh pr create --fill
