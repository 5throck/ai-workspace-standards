# Team Gateway — Phase 2 image (ADR-0092 Addendum 2/D3).
# Base = the official Hermes Agent image (carries hermes + python + s6 init; the gateway's
# per-turn isolation spawns use `--entrypoint hermes` to bypass s6). Adds bun + the gateway
# server, so ONE image serves both roles: the compose gateway container AND the per-turn
# isolation runtime (`CO_WORKSPACE_RUNTIME_IMAGE=co-workspace-runtime:latest`).
# Build context is the WORKSPACE ROOT (see docker-compose.yml).
#
# Phase 0 posture: the workspace clone is MOUNTED at /workspace for provisioning; Phase 2 bakes
# a pinned workspace snapshot into the image instead.

FROM oven/bun:1 AS bun

FROM nousresearch/hermes-agent:latest

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Docker isolation (CO_WORKSPACE_ISOLATION=docker) from INSIDE a container needs the docker
# CLI to spawn sibling containers — baked via the official docker:cli image (no apt repo churn).

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker

WORKDIR /app/services/co-workspace
COPY services/co-workspace/package.json ./
COPY services/co-workspace/tsconfig.json ./
COPY services/co-workspace/src ./src
COPY services/co-workspace/web ./web
RUN bun install

ENV CO_WORKSPACE_HOST=0.0.0.0 \
    CO_WORKSPACE_PORT=9030 \
    CO_WORKSPACE_DATA_DIR=/data \
    CO_WORKSPACE_WORKSPACE_DIR=/workspace \
    HERMES_BIN=hermes

EXPOSE 9030
ENTRYPOINT []
CMD ["bun", "src/server.ts"]
