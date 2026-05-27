# Bun installer for Windows

# UTF-8 encoding enforcement — must follow param() block (PowerShell parser requirement)
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "📦 Installing Bun..." -ForegroundColor Cyan

# Check if bun is already installed
if (Get-Command bun -ErrorAction SilentlyContinue) {
    $version = bun --version
    Write-Host "✅ Bun is already installed: $version" -ForegroundColor Green
    Write-Host ""
    Write-Host "To upgrade, run: bun upgrade" -ForegroundColor Yellow
    exit 0
}

# Install Bun using official installer
powershell -c "irm bun.sh/install.ps1 | iex"

Write-Host ""
Write-Host "✅ Bun installed successfully!" -ForegroundColor Green
Write-Host "   Version: $(bun --version)"
Write-Host ""
Write-Host "⚠️  Restart your terminal to use Bun" -ForegroundColor Yellow
