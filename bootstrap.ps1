# bootstrap.ps1 - GitHub-first entry point for ai-workspace-standards
# Standalone bootstrap script that detects execution mode and downloads templates if needed

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$true)]
    [string]$ProjectName,

    # Optional: Pass-through arguments to new-project.ps1
    [string]$Description = "A new project",
    [string]$TechStack = "Node.js / Python / etc",
    [string]$Variant = "co-develop",
    [string]$Platform = "both"
)

# Force UTF-8 encoding for all operations
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$PSDefaultParameterValues['*:Encoding'] = 'utf8'
$ErrorActionPreference = 'Stop'

try {
    [System.Text.Encoding]::RegisterProvider([System.Text.CodePages.CodePagesEncodingProvider]::Instance)
} catch {
    # Not critical - UTF-8 is already set
}

# =============================================================================
# Configuration
# =============================================================================
$RepoOwner = "5throck"
$RepoName = "ai-workspace-standards"
$ChecksumsBaseUrl = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/main/templates/bootstrap/checksums.txt"
$ArchiveBaseUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/tags"

# =============================================================================
# Functions
# =============================================================================

function Write-ColorOutput {
    <#
    .SYNOPSIS
    Write colored output with consistent formatting
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,

        [ConsoleColor]$Color = [ConsoleColor]::White
    )
    Write-Host $Message -ForegroundColor $Color
}

function Test-InGitRepository {
    <#
    .SYNOPSIS
    Check if current directory is inside a git repository
    #>
    return Test-Path (Join-Path $PWD ".git")
}

function Get-TemplateChecksum {
    <#
    .SYNOPSIS
    Retrieve expected checksum for a template version from checksums.txt
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$TemplateVersion,

        [Parameter(Mandatory=$true)]
        [string]$ChecksumsContent
    )

    foreach ($line in $ChecksumsContent -split "`n") {
        if ($line -match "^\s*#") { continue }  # Skip comments
        if ([string]::IsNullOrWhiteSpace($line)) { continue }

        $parts = $line -split '\s+'
        if ($parts[0] -eq $TemplateVersion -and $parts.Count -ge 2) {
            return @{
                Hash = $parts[1].ToLower()
                Size = if ($parts.Count -ge 3) { [int]$parts[2] } else { 0 }
            }
        }
    }

    return $null
}

function Invoke-ChecksumVerification {
    <#
    .SYNOPSIS
    Verify downloaded archive against expected checksum
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ArchivePath,

        [Parameter(Mandatory=$true)]
        [string]$ExpectedHash,

        [Parameter(Mandatory=$true)]
        [string]$TemplateVersion
    )

    Write-ColorOutput "Verifying archive integrity..." ([ConsoleColor]::Cyan)

    $actualHash = (Get-FileHash -Algorithm SHA256 -Path $ArchivePath).Hash.ToLower()

    if ($actualHash -ne $ExpectedHash.ToLower()) {
        Write-ColorOutput "SECURITY ALERT: Checksum mismatch!" ([ConsoleColor]::Red)
        Write-ColorOutput "  Template: $TemplateVersion" ([ConsoleColor]::Yellow)
        Write-ColorOutput "  Expected: $ExpectedHash" ([ConsoleColor]::Yellow)
        Write-ColorOutput "  Actual:   $actualHash" ([ConsoleColor]::Yellow)
        Write-ColorOutput "" ([ConsoleColor]::Yellow)
        Write-ColorOutput "Possible causes:" ([ConsoleColor]::Yellow)
        Write-ColorOutput "  - MITM attack or repository compromise" ([ConsoleColor]::Yellow)
        Write-ColorOutput "  - Corrupted download" ([ConsoleColor]::Yellow)
        Write-ColorOutput "  - Checksums.txt out of date" ([ConsoleColor]::Yellow)
        Write-ColorOutput "" ([ConsoleColor]::Yellow)
        Write-ColorOutput "Action: Aborted for your safety. Please report this issue at:" ([ConsoleColor]::Yellow)
        Write-ColorOutput "  https://github.com/$RepoOwner/$RepoName/issues" ([ConsoleColor]::Yellow)

        # Log the failed verification attempt
        $logEntry = @"
=== FAILED Bootstrap Verification Attempt ===
Timestamp: $(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
Template-Version: $TemplateVersion
Expected-Hash: $ExpectedHash
Actual-Hash: $actualHash
Status: CHECKSUM_MISMATCH
"@
        $logPath = Join-Path $PWD ".template-bootstrap-failed.log"
        $logEntry | Out-File -FilePath $logPath -Encoding UTF8 -Append
        Write-ColorOutput "  Failed attempt logged to: $logPath" ([ConsoleColor]::Yellow)

        exit 1
    }

    Write-ColorOutput "Checksum verified: $actualHash" ([ConsoleColor]::Green)
    return $actualHash
}

function Invoke-BootstrapMode {
    <#
    .SYNOPSIS
    Execute Bootstrap mode (GitHub-first) - download and verify template archive
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$TemplateVersion,

        [Parameter(Mandatory=$true)]
        [string]$ProjectName,

        [hashtable]$PassThroughArgs
    )

    Write-ColorOutput "=== Bootstrap Mode (GitHub-First) ===" ([ConsoleColor]::Cyan)
    Write-ColorOutput "Downloading template archive from GitHub..." ([ConsoleColor]::Cyan)

    $tag = "template-v$TemplateVersion"
    $archiveUrl = "$ArchiveBaseUrl/$tag.zip"
    $archivePath = Join-Path $PWD "workspace.zip"
    $checksumsPath = Join-Path $PWD "checksums.txt"

    try {
        # Step 1: Download checksums.txt
        Write-ColorOutput "Downloading checksums.txt..." ([ConsoleColor]::Cyan)
        Invoke-WebRequest -Uri $ChecksumsBaseUrl -OutFile $checksumsPath -UseBasicParsing
        $checksumsContent = Get-Content $checksumsPath -Raw -Encoding UTF8

        # Step 2: Parse expected checksum
        $checksumInfo = Get-TemplateChecksum -TemplateVersion $tag -ChecksumsContent $checksumsContent
        if (-not $checksumInfo) {
            Write-ColorOutput "Template version '$tag' not found in checksums.txt" ([ConsoleColor]::Red)
            Write-ColorOutput "Available versions can be found at:" ([ConsoleColor]::Yellow)
            Write-ColorOutput "  https://github.com/$RepoOwner/$RepoName/tags" ([ConsoleColor]::Yellow)
            Remove-Item $checksumsPath -Force -ErrorAction SilentlyContinue
            exit 1
        }

        # Step 3: Download archive
        Write-ColorOutput "Downloading $tag archive..." ([ConsoleColor]::Cyan)
        Invoke-WebRequest -Uri $archiveUrl -OutFile $archivePath -UseBasicParsing
        $archiveSize = (Get-Item $archivePath).Length

        # Verify size matches if available
        if ($checksumInfo.Size -gt 0 -and $archiveSize -ne $checksumInfo.Size) {
            Write-ColorOutput "WARNING: Archive size mismatch" ([ConsoleColor]::Yellow)
            Write-ColorOutput "  Expected: $($checksumInfo.Size) bytes" ([ConsoleColor]::Yellow)
            Write-ColorOutput "  Actual:   $archiveSize bytes" ([ConsoleColor]::Yellow)
        }

        # Step 4: Verify checksum
        $verifiedHash = Invoke-ChecksumVerification -ArchivePath $archivePath -ExpectedHash $checksumInfo.Hash -TemplateVersion $tag

        # Step 5: User confirmation
        Write-ColorOutput "" ([ConsoleColor]::White)
        Write-ColorOutput "=== Download Summary ===" ([ConsoleColor]::Cyan)
        Write-ColorOutput "  Template: $tag" ([ConsoleColor]::Green)
        Write-ColorOutput "  Size:     $($archiveSize) bytes ($([math]::Round($archiveSize/1KB, 2)) KB)" ([ConsoleColor]::Green)
        Write-ColorOutput "  SHA256:   $verifiedHash" ([ConsoleColor]::DarkGray)
        Write-ColorOutput "" ([ConsoleColor]::White)
        $confirm = Read-Host "Continue extraction and project creation? (y/n)"

        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-ColorOutput "Aborted by user." ([ConsoleColor]::Yellow)
            Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
            Remove-Item $checksumsPath -Force -ErrorAction SilentlyContinue
            exit 0
        }

        # Step 6: Extract archive
        Write-ColorOutput "Extracting archive..." ([ConsoleColor]::Cyan)
        $extractDir = Join-Path $PWD $tag
        Expand-Archive -Path $archivePath -DestinationPath $PWD -Force

        # Step 7: Locate and execute new-project.ps1
        $scriptPath = Join-Path $extractDir "scripts\new-project.ps1"
        if (-not (Test-Path $scriptPath)) {
            Write-ColorOutput "ERROR: new-project.ps1 not found in extracted archive" ([ConsoleColor]::Red)
            Write-ColorOutput "  Expected at: $scriptPath" ([ConsoleColor]::Yellow)
            Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
            Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
            exit 1
        }

        # Step 8: Execute new-project.ps1 with pass-through arguments
        Write-ColorOutput "Executing new-project.ps1..." ([ConsoleColor]::Cyan)

        $argList = @("-ProjectName", $ProjectName)
        if ($PassThroughArgs.Description) { $argList += "-Description", $PassThroughArgs.Description }
        if ($PassThroughArgs.TechStack) { $argList += "-TechStack", $PassThroughArgs.TechStack }
        if ($PassThroughArgs.Variant) { $argList += "-Variant", $PassThroughArgs.Variant }
        if ($PassThroughArgs.Platform) { $argList += "-Platform", $PassThroughArgs.Platform }

        & $scriptPath @argList
        $exitCode = $LASTEXITCODE

        # Step 9: Create bootstrap log in generated project
        $logPath = Join-Path $PWD $ProjectName ".template-bootstrap.log"
        $logContent = @"
=== Template Bootstrap Log ===
Timestamp: $(Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
Workspace-Root: $PWD

Bootstrap-Configuration:
  Mode: Bootstrap (GitHub-First)
  Template-Version: $tag
  Download-URL: $archiveUrl
  Target-Project: $ProjectName

Security-Verification:
  Checksum-Expected: $($checksumInfo.Hash)
  Checksum-Actual: $verifiedHash
  Checksum-Status: PASS
  User-Confirmed: true

Execution:
  Exit-Code: $exitCode
  Status: $(if ($exitCode -eq 0) { "Success" } else { "Failed with code $exitCode" })
"@
        $logContent | Out-File -FilePath $logPath -Encoding UTF8

        # Step 10: Cleanup
        Write-ColorOutput "Cleaning up temporary files..." ([ConsoleColor]::Cyan)
        Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
        Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $checksumsPath -Force -ErrorAction SilentlyContinue

        return $exitCode

    } catch {
        Write-ColorOutput "ERROR: $($_.Exception.Message)" ([ConsoleColor]::Red)
        Write-ColorOutput $_.ScriptStackTrace ([ConsoleColor]::DarkGray)

        # Cleanup on error
        Remove-Item $archivePath -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $PWD $tag) -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $checksumsPath -Force -ErrorAction SilentlyContinue

        exit 1
    }
}

function Invoke-LocalMode {
    <#
    .SYNOPSIS
    Execute Local mode - delegate to existing scripts/new-project.ps1
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectName,

        [hashtable]$PassThroughArgs
    )

    Write-ColorOutput "=== Local Mode (Clone-Based) ===" ([ConsoleColor]::Cyan)
    Write-ColorOutput "Using local templates and scripts..." ([ConsoleColor]::Cyan)

    $scriptPath = Join-Path $PSScriptRoot "scripts\new-project.ps1"

    if (-not (Test-Path $scriptPath)) {
        Write-ColorOutput "ERROR: new-project.ps1 not found at: $scriptPath" ([ConsoleColor]::Red)
        Write-ColorOutput "  Are you in the ai-workspace-standards repository root?" ([ConsoleColor]::Yellow)
        exit 1
    }

    $argList = @("-ProjectName", $ProjectName)
    if ($PassThroughArgs.Description) { $argList += "-Description", $PassThroughArgs.Description }
    if ($PassThroughArgs.TechStack) { $argList += "-TechStack", $PassThroughArgs.TechStack }
    if ($PassThroughArgs.Variant) { $argList += "-Variant", $PassThroughArgs.Variant }
    if ($PassThroughArgs.Platform) { $argList += "-Platform", $PassThroughArgs.Platform }

    & $scriptPath @argList
    return $LASTEXITCODE
}

# =============================================================================
# Main Execution
# =============================================================================

Write-ColorOutput "" ([ConsoleColor]::White)
Write-ColorOutput "╔═══════════════════════════════════════════════════════════════════╗" ([ConsoleColor]::Cyan)
Write-ColorOutput "║  AI Workspace Standards - Bootstrap Script                     ║" ([ConsoleColor]::Cyan)
Write-ColorOutput "║  GitHub-first entry point for template scaffolding            ║" ([ConsoleColor]::Cyan)
Write-ColorOutput "╚═══════════════════════════════════════════════════════════════════╝" ([ConsoleColor]::Cyan)
Write-ColorOutput "" ([ConsoleColor]::White)

# Validate ProjectName before proceeding
if ($ProjectName -notmatch '^[a-zA-Z0-9_-]+$') {
    Write-ColorOutput "ERROR: Invalid project name: '$ProjectName'" ([ConsoleColor]::Red)
    Write-ColorOutput "  Only letters, numbers, hyphens (-), and underscores (_) are allowed." ([ConsoleColor]::Yellow)
    exit 1
}
if ($ProjectName.Length -gt 64) {
    Write-ColorOutput "ERROR: Project name too long ($($ProjectName.Length) chars). Maximum is 64 characters." ([ConsoleColor]::Red)
    exit 1
}

# Detect execution mode
$isInGit = Test-InGitRepository

$passThroughArgs = @{
    Description = $Description
    TechStack   = $TechStack
    Variant     = $Variant
    Platform    = $Platform
}

if ($isInGit) {
    Write-ColorOutput "Detected: Git repository" ([ConsoleColor]::Green)
    $exitCode = Invoke-LocalMode -ProjectName $ProjectName -PassThroughArgs $passThroughArgs
} else {
    Write-ColorOutput "Detected: Non-git directory" ([ConsoleColor]::Yellow)
    Write-ColorOutput "Using Bootstrap mode (download from GitHub)..." ([ConsoleColor]::Cyan)
    $exitCode = Invoke-BootstrapMode -TemplateVersion $Version -ProjectName $ProjectName -PassThroughArgs $passThroughArgs
}

exit $exitCode
