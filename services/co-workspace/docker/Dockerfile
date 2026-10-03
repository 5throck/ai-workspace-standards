# Team Gateway — Phase 2 image (ADR-0092 Addendum 2/D3).
# Base = the official Hermes Agent image (carries hermes + python + s6 init; the gateway's
# per-turn isolation spawns use `--entrypoint hermes` to bypass s6). Adds bun + the gateway
# server, so ONE image serves both roles: the compose gateway container AND the per-turn
# isolation runtime (`CO_WORKSPACE_RUNTIME_IMAGE=co-workspace-runtime:latest`).
# Build context is the WORKSPACE ROOT (see docker-compose.yml).
#
# Phase 0 posture: the workspace clone is MOUNTED at /workspace for provisioning; Phase 2 bakes
# a pinned workspace snapshot into the image instead.

# HERMES_TAG: pin to a specific tag or digest for reproducible builds (default: latest).
# Declared before the first FROM so it is global and usable in the FROM line below.
ARG HERMES_TAG=latest

FROM oven/bun:1.4 AS bun

# 2026-10-03 CLI provider-key design + T-20261003-023(a): node/npm stage for the claude/codex
# CLI install below (their installers expect node; bun's global install does not run their
# postinstall reliably). Pinned to the versions live-probed on 2026-10-03.
FROM node:22-slim AS node

FROM nousresearch/hermes-agent:${HERMES_TAG}

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Docker isolation (CO_WORKSPACE_ISOLATION=docker) from INSIDE a container needs the docker
# CLI to spawn sibling containers — baked via the official docker:cli image (no apt repo churn).

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker

# Non-hermes runtimes in container deployments (2026-10-03 T-20261003-023a): the claude and
# codex CLIs are baked so CO_WORKSPACE_RUNTIME=claude|codex works with process isolation.
# Credentials come from the provider-key env injection (see the cli-provider-key design) or
# from the login-home mounts in docker-compose.creds.yml. agy is NOT baked — no verifiable
# Linux artifact source (login-only runtime); mount the binary per the creds overlay.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
# -f: the hermes base image already carries an npm at /usr/local/bin/npm
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && npm install -g --omit=dev @anthropic-ai/claude-code@2.1.288 @openai/codex@0.160.0 \
 && claude --version >/dev/null && codex --version >/dev/null

WORKDIR /app/services/co-workspace
COPY services/co-workspace/package.json ./
COPY services/co-workspace/bun.lock ./
COPY services/co-workspace/tsconfig.json ./
COPY services/co-workspace/src ./src
COPY services/co-workspace/web ./web
RUN bun install --frozen-lockfile --production

# Non-root gateway. uid/gid 10000 matches the sibling turn containers (`--user 10000:10000`
# in src/hermes.ts), so files the gateway creates are already owned by the turn user. The
# hermes base image is not inspected here; the numeric uid needs no passwd entry. HOME is
# writable for bun caches; the app tree is chowned so bun can write beside it.
RUN git config --system safe.directory '*' \
 && mkdir -p /home/gw \
 && chown -R 10000:10000 /home/gw /app/services/co-workspace

ENV HOME=/home/gw \
    CO_WORKSPACE_HOST=0.0.0.0 \
    CO_WORKSPACE_PORT=9030 \
    CO_WORKSPACE_DATA_DIR=/data \
    CO_WORKSPACE_WORKSPACE_DIR=/workspace \
    HERMES_BIN=hermes

USER 10000:10000
EXPOSE 9030
ENTRYPOINT []
CMD ["bun", "src/server.ts"]
