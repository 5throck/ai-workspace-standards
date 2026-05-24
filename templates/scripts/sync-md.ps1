param(
    [string]$Date    = (Get-Date -Format "yyyy-MM-dd"),
    [string]$Summary = "update"
)

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

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


