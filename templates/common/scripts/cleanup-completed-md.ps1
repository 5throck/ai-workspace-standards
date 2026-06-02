# Move completed task plans from memory/ to memory/completed/
# This script identifies completed meeting transcripts and task plans
# and archives them to keep the memory/ folder clean

$ErrorActionPreference = "Stop"

$COMPLETED_MARKER = "## Task Status: Completed"
$FINAL_SYNTHESIS_MARKER = "## Synthesis"
$MEETING_COMPLETE_MARKER = "✅  MEETING CLOSED"
$MOVED = 0
$SKIPPED = 0

Write-Host "🧹 Cleaning up completed memory files..."
Write-Host ""

# Ensure memory/completed/ directory exists
New-Item -ItemType Directory -Force -Path "memory/completed" | Out-Null

# Check all .md files in memory/ directory
Get-ChildItem -Path "memory" -Filter "*.md" | ForEach-Object {
    $file = $_
    $filename = $_.Name

    # Check if file is a daily log (format: YYYY-MM-DD.md) - skip these
    if ($filename -match '^\d{4}-\d{2}-\d{2}\.md$') {
        $SKIPPED++
        return
    }

    # Check if file is already in completed/ - skip
    if ($filename -match '^completed-') {
        $SKIPPED++
        return
    }

    # Check for completion markers
    $isCompleted = $false
    $content = Get-Content $file.FullName -Raw

    if ($content -match [regex]::Escape($COMPLETED_MARKER)) {
        $isCompleted = $true
    }

    if ($content -match [regex]::Escape($MEETING_COMPLETE_MARKER)) {
        $isCompleted = $true
    }

    # Check for meeting transcripts with final synthesis
    if ($content -match '## Transcript' -and $content -match [regex]::Escape($FINAL_SYNTHESIS_MARKER)) {
        # Verify meeting is closed
        if ($content -match [regex]::Escape($MEETING_COMPLETE_MARKER)) {
            $isCompleted = $true
        }
    }

    if ($isCompleted) {
        # Move to memory/completed/ with completed- prefix
        $newFilename = "memory/completed/completed-$filename"
        Move-Item -Path $file.FullName -Destination $newFilename -Force
        Write-Host "✅ Moved completed file: $filename → completed-$filename"
        $MOVED++
    } else {
        $SKIPPED++
    }
}

# Summary
Write-Host ""
Write-Host "📊 Cleanup Summary:"
Write-Host "   Files moved: $MOVED"
Write-Host "   Files skipped (still active): $SKIPPED"

if ($MOVED -gt 0) {
    Write-Host ""
    Write-Host "✅ Cleanup complete: $MOVED file(s) moved to memory/completed/"
} else {
    Write-Host ""
    Write-Host "ℹ️  No completed files found to move"
}

exit 0
