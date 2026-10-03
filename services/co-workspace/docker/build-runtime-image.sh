#!/bin/sh
# Rebuild the docker-isolation runtime image (co-workspace-runtime:latest) from the
# operator's current Hermes build (~/.hermes/hermes-agent). The published hermes-agent
# image lags the working build; the older in-container build cannot resolve
# shared-store-era credentials, which fails every isolated turn at provider resolution.
#
# Usage: ./build-runtime-image.sh [hermes-checkout]
# Defaults to ~/.hermes/hermes-agent. Heavy dirs (.git/node_modules/venv) are excluded.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
CHECKOUT="${1:-$HOME/.hermes/hermes-agent}"
STAGE="$SCRIPT_DIR/runtime-hermes"
IMAGE="${CO_WORKSPACE_RUNTIME_IMAGE:-co-workspace-runtime:latest}"

# Preflight: check for required tools and base image
command -v rsync >/dev/null 2>&1 || { echo "[FAIL] rsync not found" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "[FAIL] docker not found" >&2; exit 1; }
docker image inspect co-workspace-gateway:latest >/dev/null 2>&1 || { echo "[FAIL] base image co-workspace-gateway:latest missing — run docker compose build first" >&2; exit 1; }

if [ ! -d "$CHECKOUT/agent" ] || [ ! -f "$CHECKOUT/cli.py" ]; then
    echo "[FAIL] $CHECKOUT does not look like a hermes-agent checkout (agent/, cli.py missing)" >&2
    exit 1
fi

echo "[1/3] Staging $CHECKOUT → $STAGE/hermes-agent (excluding .git/node_modules/venv)…"
mkdir -p "$STAGE"
rsync -a --delete \
    --exclude '.git' --exclude 'node_modules' --exclude 'venv' \
    --exclude '__pycache__' --exclude '*.pyc' \
    --exclude '.env' --exclude '.env.*' --exclude '*.key' --exclude '*.pem' --exclude 'auth.json' \
    "$CHECKOUT/" "$STAGE/hermes-agent/"

echo "[2/3] Building ${IMAGE}…"
docker build -f "$SCRIPT_DIR/Dockerfile.runtime" -t "$IMAGE" "$STAGE"

echo "[3/3] Done. Running turns in docker isolation now use this Hermes build."
echo "       Verify: docker run --rm --entrypoint hermes $IMAGE --version"
