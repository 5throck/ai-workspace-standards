$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
# Bun installer for Windows

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
# TODO: Security — pin to a specific release URL with SHA-256 verification before production use
# See: https://bun.sh/docs/installation for versioned release URLs
powershell -c "irm bun.sh/install.ps1 | iex"

Write-Host ""
Write-Host "✅ Bun installed successfully!" -ForegroundColor Green
Write-Host "   Version: $(bun --version)"
Write-Host ""
Write-Host "⚠️  Restart your terminal to use Bun" -ForegroundColor Yellow
