param(
    [string]$Date    = (Get-Date -Format "yyyy-MM-dd"),
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    [string]$Summary = "update",
    [switch]$Meeting,
    [switch]$Adr,
    [string]$AdrId   = ""
)

# Force English culture for consistent error messages
[System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::GetCultureInfo("en-US")

# UTF-8 encoding enforcement
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

$MemFile = "memory\MEMORY.md"

# ── Initialize MEMORY.md with 3-section structure if missing ────────────────
if (-not (Test-Path $MemFile)) {
    @"
# Memory Index

## Sessions

| Date | Summary |
|------|---------|

## Meetings

| Date | Topic | File |
|------|-------|------|

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
"@ | Set-Content $MemFile -Encoding UTF8
}

$content = Get-Content $MemFile -Raw -Encoding UTF8

# ── Migrate legacy flat index if no sections exist ───────────────────────────
if ($content -notmatch "## Sessions") {
    $migrated = $content -replace "(# Memory Index\r?\n)", '$1
## Sessions

'
    $migrated = $migrated + @"

## Meetings

| Date | Topic | File |
|------|-------|------|

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
"@
    Set-Content $MemFile $migrated -Encoding UTF8 -NoNewline
    $content = Get-Content $MemFile -Raw -Encoding UTF8
}

# ── Append to appropriate section ────────────────────────────────────────────
if ($Meeting) {
    $Slug = ($Summary -replace '[^a-z0-9]', '-' -replace '-+', '-').ToLower().TrimEnd('-')
    $Slug = $Slug.Substring(0, [Math]::Min(40, $Slug.Length))
    $File = "meeting-${Date}-${Slug}.md"
    if ($content -notmatch [regex]::Escape($Date) -or $content -notmatch [regex]::Escape($Summary)) {
        $row = "| $Date | $Summary | [$File]($File) |"
        $content = $content -replace "(## Meetings\r?\n\r?\n\| Date \|[^\n]+\r?\n\|[-| ]+\|)", "`$1`n$row"
        Set-Content $MemFile $content -Encoding UTF8 -NoNewline
    }
} elseif ($Adr) {
    $Slug = ($Summary -replace '[^a-z0-9]', '-' -replace '-+', '-').ToLower().TrimEnd('-')
    $Slug = $Slug.Substring(0, [Math]::Min(50, $Slug.Length))
    $Id = if ($AdrId) { $AdrId } else { "ADR-XXXX" }
    $File = "${Id}-${Slug}.md"
    if ($content -notmatch [regex]::Escape($Id) -and $content -notmatch [regex]::Escape($Summary)) {
        $row = "| $Id | $Summary | Accepted | [$File]($File) |"
        $content = $content -replace "(## ADRs\r?\n\r?\n\| ID \|[^\n]+\r?\n\|[-| ]+\|)", "`$1`n$row"
        Set-Content $MemFile $content -Encoding UTF8 -NoNewline
    }
} else {
    # Session entry — dedup by date
    if ($content -notmatch [regex]::Escape("[$Date]")) {
        $row = "| [$Date]($Date.md) | $Summary |"
        $content = $content -replace "(## Sessions\r?\n\r?\n\| Date \|[^\n]+\r?\n\|[-| ]+\|)", "`$1`n$row"
        Set-Content $MemFile $content -Encoding UTF8 -NoNewline
    }
}
