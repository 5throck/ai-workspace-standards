# sync-md.ps1 - Update memory/MEMORY.md index (Windows)
# Usage: .\scripts\sync-md.ps1 "YYYY-MM-DD" "summary"

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

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
# Dedup: only append if this date is not already present
$IndexContent = Get-Content $MemFile -Raw -Encoding UTF8
if ($IndexContent -notmatch [regex]::Escape("[$Date]")) {
    Add-Content $MemFile "| [$Date]($Date.md) | $Summary |" -Encoding UTF8
}

