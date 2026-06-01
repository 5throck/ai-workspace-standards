#!/bin/bash
# install-vsp.sh
# Downloads and installs the vsp binary from GitHub Releases.
# Source: https://github.com/oisee/vibing-steampunk
#
# Usage: bash scripts/install-vsp.sh [version]
#   version: optional tag, e.g. v2.38.1 (default: latest)
#
# Release asset naming convention (from vibing-steampunk):
#   vsp-darwin-amd64
#   vsp-darwin-arm64
#   vsp-linux-386
#   vsp-linux-amd64
#   vsp-linux-arm
#   vsp-linux-arm64
#   vsp-windows-386.exe
#   vsp-windows-amd64.exe
#   vsp-windows-arm64.exe

set -e

REPO="oisee/vibing-steampunk"
INSTALL_DIR="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BINARY_BASE="vsp"

# Detect OS
OS=$(uname -s)
case "$OS" in
  Darwin)               PLATFORM="darwin" ;;
  Linux)                PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *)
    echo "Error: Unsupported OS: $OS"
    exit 1
    ;;
esac

# Detect architecture
ARCH_RAW=$(uname -m)
case "$ARCH_RAW" in
  x86_64)          ARCH="amd64" ;;
  i386|i686)       ARCH="386" ;;
  aarch64|arm64)   ARCH="arm64" ;;
  armv7l|armv6l)   ARCH="arm" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH_RAW"
    exit 1
    ;;
esac

# Construct asset name (matches vibing-steampunk release naming)
if [ "$PLATFORM" = "windows" ]; then
  ASSET_NAME="${BINARY_BASE}-${PLATFORM}-${ARCH}.exe"
  TARGET="$INSTALL_DIR/${BINARY_BASE}.exe"
else
  ASSET_NAME="${BINARY_BASE}-${PLATFORM}-${ARCH}"
  TARGET="$INSTALL_DIR/${BINARY_BASE}"
fi

echo "--- vsp Installer (vibing-steampunk) ---"
echo "Repo    : https://github.com/$REPO"
echo "Platform: $PLATFORM / $ARCH"
echo "Asset   : $ASSET_NAME"
echo "Target  : $TARGET"
echo ""

# Resolve version
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Fetching latest release..."
  VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' \
    | head -1 \
    | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')
  if [ -z "$VERSION" ]; then
    echo "Error: Failed to fetch latest version from GitHub API."
    echo "       Check your internet connection or visit:"
    echo "       https://github.com/$REPO/releases"
    exit 1
  fi
fi

echo "Version : $VERSION"

DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$ASSET_NAME"
echo "URL     : $DOWNLOAD_URL"
echo ""

# Download
echo "Downloading..."
curl -fL --progress-bar "$DOWNLOAD_URL" -o "$TARGET"

# Verify download succeeded and is non-empty
if [ ! -s "$TARGET" ]; then
  echo "Error: Download failed or file is empty."
  echo "       Check that the release asset exists: $DOWNLOAD_URL"
  rm -f "$TARGET"
  exit 1
fi

# Make executable (not needed on Windows but harmless)
chmod +x "$TARGET"

echo ""
echo "✅ vsp $VERSION installed successfully."
echo "   Binary: $TARGET"
echo ""
echo "Next steps:"
echo "  1. Configure SAP connection in your environment:"
echo "     export SAP_URL=https://your-sap-host:44300"
echo "     export SAP_USER=your-username"
echo "     export SAP_PASSWORD=your-password"
echo "     export SAP_CLIENT=100"
echo "  2. Verify binary: $TARGET --version"
echo "  3. Test SAP connection: $TARGET system info"
echo ""
echo "  4. Install ZADT_VSP WebSocket infrastructure (required for debugging,"
echo "     RunReport, and RFC features):"
echo "     - In a Claude/Gemini session: 'Install VSP infrastructure to package \$TMP'"
echo "     - Then complete SAP GUI steps (see docs/setup-guide.md §9-C):"
echo "       a) SAPC: register application ZADT_VSP with handler ZCL_VSP_APC_HANDLER (Stateful)"
echo "       b) SICF: activate service node /sap/bc/apc/sap/zadt_vsp"
echo "     - Verify: $TARGET system info  →  ZADT_VSP: installed"
