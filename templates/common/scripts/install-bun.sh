#!/usr/bin/env bash
# Bun installer for Unix/macOS

set -e

echo "📦 Installing Bun..."

if command -v bun &> /dev/null; then
    BUN_VERSION=$(bun --version)
    echo "✅ Bun is already installed: $BUN_VERSION"
    echo ""
    echo "To upgrade, run: bun upgrade"
    exit 0
fi

# Install Bun using official installer
# TODO: Security — pin to a specific release URL with SHA-256 verification before production use
# See: https://bun.sh/docs/installation for versioned release URLs
curl -fsSL https://bun.sh/install | bash

# Set up environment
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

echo ""
echo "✅ Bun installed successfully!"
echo "   Version: $(bun --version)"
echo ""
echo "⚠️  Add this to your shell profile (~/.bashrc, ~/.zshrc, or ~/.config/fish/config.fish):"
echo ""
echo "   # Bun"
echo '   export BUN_INSTALL="$HOME/.bun"'
echo '   export PATH="$BUN_INSTALL/bin:$PATH"'
echo ""
echo "Then restart your shell or run: source ~/.bashrc (or ~/.zshrc)"
