$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
# scripts/install-vsp.ps1
# Downloads and installs the vsp binary from GitHub Releases.
# Source: https://github.com/oisee/vibing-steampunk
#
# Usage: .\scripts\install-vsp.ps1 [-Version <tag>]
#   -Version: optional tag, e.g. v2.38.1 (default: latest)
#
# Release asset naming convention (from vibing-steampunk):
#   vsp-windows-386.exe
#   vsp-windows-amd64.exe
#   vsp-windows-arm64.exe

param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$Repo       = "oisee/vibing-steampunk"
$InstallDir = if ($env:CLAUDE_PLUGIN_ROOT) { $env:CLAUDE_PLUGIN_ROOT } else { Split-Path -Parent $PSScriptRoot }
$BinaryBase = "vsp"

# Detect architecture
$ArchRaw = (Get-CimInstance Win32_Processor).Architecture
$Arch = switch ($ArchRaw) {
    9  { "amd64" }   # x64
    5  { "arm" }     # ARM
    12 { "arm64" }   # ARM64
    0  { "386" }     # x86
    default {
        Write-Error "Unsupported architecture: $ArchRaw"
        exit 1
    }
}

$AssetName = "${BinaryBase}-windows-${Arch}.exe"
$Target    = Join-Path $InstallDir "${BinaryBase}.exe"

Write-Host "--- vsp Installer (vibing-steampunk) ---"
Write-Host "Repo    : https://github.com/$Repo"
Write-Host "Platform: windows / $Arch"
Write-Host "Asset   : $AssetName"
Write-Host "Target  : $Target"
Write-Host ""

# Resolve version
if (-not $Version) {
    Write-Host "Fetching latest release..."
    try {
        $Release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
        $Version = $Release.tag_name
    } catch {
        Write-Error "Failed to fetch latest version from GitHub API.`nCheck your internet connection or visit:`nhttps://github.com/$Repo/releases"
        exit 1
    }
}

Write-Host "Version : $Version"

$DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$AssetName"
Write-Host "URL     : $DownloadUrl"
Write-Host ""

# Download
Write-Host "Downloading..."
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $Target -UseBasicParsing
} catch {
    Write-Error "Download failed.`nCheck that the release asset exists: $DownloadUrl"
    if (Test-Path $Target) { Remove-Item $Target }
    exit 1
}

if ((Get-Item $Target).Length -eq 0) {
    Write-Error "Download succeeded but file is empty: $Target"
    Remove-Item $Target
    exit 1
}

Write-Host ""
Write-Host "vsp $Version installed successfully."
Write-Host "   Binary: $Target"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Configure SAP connection in your environment:"
Write-Host "     `$env:SAP_URL      = 'https://your-sap-host:44300'"
Write-Host "     `$env:SAP_USER     = 'your-username'"
Write-Host "     `$env:SAP_PASSWORD = 'your-password'"
Write-Host "     `$env:SAP_CLIENT   = '100'"
Write-Host "  2. Verify binary: $Target --version"
Write-Host "  3. Test SAP connection: $Target system info"
Write-Host ""
Write-Host "  4. Install ZADT_VSP WebSocket infrastructure (required for debugging,"
Write-Host "     RunReport, and RFC features):"
Write-Host "     - In a Claude/Gemini session: 'Install VSP infrastructure to package `$TMP'"
Write-Host "     - Then complete SAP GUI steps (see docs/setup-guide.md §9-C):"
Write-Host "       a) SAPC: register application ZADT_VSP with handler ZCL_VSP_APC_HANDLER (Stateful)"
Write-Host "       b) SICF: activate service node /sap/bc/apc/sap/zadt_vsp"
Write-Host "     - Verify: $Target system info  ->  ZADT_VSP: installed"
