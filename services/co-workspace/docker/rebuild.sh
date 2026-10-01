#!/bin/sh
# Redeploy the co-workspace Docker stack from the CURRENT workspace checkout — the
# operator entry point for reflecting development into the running stack (design
# docs/designs/2026-10-02-coworkspace-docker-redeploy-design.md).
#
#   ./rebuild.sh             rebuild the gateway image (src/web) and recreate containers
#   ./rebuild.sh --runtime   also rebuild the per-turn runtime image from the Hermes
#                            checkout (build-runtime-image.sh) — run after Hermes itself
#                            changed
#
# Templates are NOT part of this: /workspace is a live bind mount, so template edits
# reach the next tenant provisioning without any rebuild. The operator's compose
# layering is preserved — this script only calls plain `docker compose`, which picks up
# COMPOSE_FILE from .env in this directory.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$SCRIPT_DIR"

RUNTIME=0
for arg in "$@"; do
    case "$arg" in
        --runtime) RUNTIME=1 ;;
        *) echo "[FAIL] unknown argument: $arg (usage: $0 [--runtime])" >&2; exit 2 ;;
    esac
done

command -v docker >/dev/null 2>&1 || { echo "[FAIL] docker not found" >&2; exit 1; }

echo "[1/3] Building images from the workspace checkout (gateway, plus the broker when the isolation layer is active)…"
docker compose build

echo "[2/3] Recreating containers whose image or config changed…"
docker compose up -d --remove-orphans

if [ "$RUNTIME" = "1" ]; then
    echo "[3/3] Rebuilding the turn runtime image from the Hermes checkout…"
    "$SCRIPT_DIR/build-runtime-image.sh"
else
    echo "[3/3] Turn runtime untouched — pass --runtime after changing the Hermes checkout."
fi

echo "Done. Gateway serves http://127.0.0.1:9030 (or the CO_WORKSPACE_PUBLISH mapping)."
