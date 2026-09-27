# Team Gateway — Phase 0 image (ADR-0092 D6).
# bun (gateway server) + python/Hermes (session runtime) in one container.
# Build context is the WORKSPACE ROOT (see docker-compose.yml) so the service tree copies in.
#
# Phase 0 posture: the workspace clone is MOUNTED at /workspace for provisioning; Phase 2 bakes
# a pinned workspace snapshot into the image instead.

FROM oven/bun:1 AS bun

FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Hermes Agent runtime (session runner). Pinned ref recommended for deployments:
#   pip install git+https://github.com/NousResearch/hermes-agent.git@<ref>
RUN pip install --no-cache-dir git+https://github.com/NousResearch/hermes-agent.git

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun

WORKDIR /app/services/team-gateway
COPY services/team-gateway/package.json ./
COPY services/team-gateway/tsconfig.json ./
COPY services/team-gateway/src ./src
COPY services/team-gateway/web ./web
RUN bun install

ENV TEAM_GATEWAY_HOST=0.0.0.0 \
    TEAM_GATEWAY_DATA_DIR=/data \
    TEAM_GATEWAY_WORKSPACE_DIR=/workspace \
    HERMES_BIN=hermes

EXPOSE 8787
CMD ["bun", "src/server.ts"]
