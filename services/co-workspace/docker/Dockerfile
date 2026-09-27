# Team Gateway — Phase 2 image (ADR-0092 Addendum 2/D3).
# Base = the official Hermes Agent image (carries hermes + python + s6 init; the gateway's
# per-turn isolation spawns use `--entrypoint hermes` to bypass s6). Adds bun + the gateway
# server, so ONE image serves both roles: the compose gateway container AND the per-turn
# isolation runtime (`TEAM_GATEWAY_RUNTIME_IMAGE=co-workspace-runtime:latest`).
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

# NOTE: docker isolation (TEAM_GATEWAY_ISOLATION=docker) from INSIDE a container additionally
# needs the docker CLI + a socket mount in the deployment — not baked here (see README).

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app/services/team-gateway
COPY services/team-gateway/package.json ./
COPY services/team-gateway/tsconfig.json ./
COPY services/team-gateway/src ./src
COPY services/team-gateway/web ./web
RUN bun install

ENV TEAM_GATEWAY_HOST=0.0.0.0 \
    TEAM_GATEWAY_PORT=9030 \
    TEAM_GATEWAY_DATA_DIR=/data \
    TEAM_GATEWAY_WORKSPACE_DIR=/workspace \
    HERMES_BIN=hermes

EXPOSE 9030
ENTRYPOINT []
CMD ["bun", "src/server.ts"]
