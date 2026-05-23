# sync-md.ps1 — Update memory/MEMORY.md index (Windows)
# Usage: .\scripts\sync-md.ps1 "YYYY-MM-DD" "summary"
param(
    [string]$Date    = (Get-Date -Format "yyyy-MM-dd"),
    [string]$Summary = "update"
)
$MemFile = "memory\MEMORY.md"
if (-not (Test-Path $MemFile)) {
    @"
# Memory Index

| Date | Summary |
|------|---------|
"@ | Set-Content $MemFile -Encoding UTF8
}
# Only append if this date is not already in the index
$existing = Get-Content $MemFile -Raw -ErrorAction SilentlyContinue
if (-not $existing -or $existing -notmatch [regex]::Escape("[$Date]")) {
    Add-Content $MemFile "| [$Date]($Date.md) | $Summary |"
}

