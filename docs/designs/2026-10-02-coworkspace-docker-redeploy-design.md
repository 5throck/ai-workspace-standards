# Design: co-workspace Docker redeploy — reflect developed content into the running stack

- **Spec ID**: `2026-10-02-coworkspace-docker-redeploy-design`
- **Date**: 2026-10-02
- **Status**: implemented
- **Scope**: `services/co-workspace/docker/` (one new script, one new compose overlay), service README, `.env.sample`. No `src/` behavior change.

## Accessibility (ADR-0065/0070 exemption)

Ops-facing infrastructure (rebuild script, compose layering, docs) — no user-facing UI
surface is touched. Explicitly exempt per ADR-0070.

## 1. Problem

The Docker deployment serves three classes of developed content, and today only one of
them reaches the running stack without operator archaeology:

1. **Team templates** (`templates/**`) — already live: `/workspace` is a bind mount and
   provisioning reads it at scaffold time.
2. **Gateway code** (`services/co-workspace/src`, `web`) — baked into
   `co-workspace-gateway:latest` at build time. Reaching the running stack needs
   `docker compose build && docker compose up -d`, which is documented nowhere; the
   Hermes runtime image additionally needs `./build-runtime-image.sh`. Operators (and
   agents) rediscover this by trial.
3. **The Hermes checkout** — baked into `co-workspace-runtime:latest` by
   `build-runtime-image.sh`, which exists but is not chained to any deployment step, so
   a gateway-only rebuild leaves turn runtimes stale.

There is also no inner-loop path: every source edit costs a full image build.

## 2. Requirements

- **R1**: One command rebuilds the images from the current workspace checkout and
  recreates the affected containers.
- **R2**: The command preserves the operator's compose layering — it must keep working
  unchanged with any `COMPOSE_FILE` combination in `docker/.env`
  (isolation / seed / volume layers).
- **R3**: A single flag extends the same run to rebuild the per-turn Hermes runtime
  image.
- **R4**: An overlay lets `src/`/`web/` edits reach the running container without an
  image build, for the development loop.
- **R5**: The service README maps each changed artifact class to the action required,
  so the flow is discoverable.

## 3. Design

### 3.1 `docker/rebuild.sh` (R1–R3)

A thin POSIX-sh entry point that `cd`s to `docker/` and calls plain `docker compose`:

1. `docker compose build` — builds every service in the active layer set that has a
   build stanza (the gateway always; the broker when the isolation layer is on). R2
   holds because compose itself resolves `COMPOSE_FILE` from `.env` in that directory.
2. `docker compose up -d --remove-orphans` — recreates only containers whose image or
   configuration changed.
3. With `--runtime`, chains the existing `./build-runtime-image.sh` (R3). Without it,
   prints that the runtime was left untouched.

No assumptions about which layers are active, no host paths, no compose file names
beyond the defaults compose already applies.

### 3.2 `docker/docker-compose.dev.yml` (R4)

An overlay layered as `COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml`:

- Adds bind mounts of the checkout's `services/co-workspace/src` and `web` over the
  baked copies at `/app/services/co-workspace/{src,web}`. Compose merges volume lists
  by container target, so the base mounts (`/data`, `/workspace`, `/seed/*`) survive.
- Replaces `command` with `bun --watch src/server.ts` — a full process restart per
  source save. `bun --hot` was rejected: it swaps module state in place while the
  gateway holds cross-request state (chat locks, SSE writers, session maps), which is
  not hot-swap-safe.
- Does NOT declare the `docker-broker` service: an overlay that names a service creates
  it when layered alone, and a broker needs the Docker socket — creating one in a plain
  dev stack would be a footgun. Broker-side source changes go through `./rebuild.sh`.

### 3.3 Documentation (R5)

README "Docker deployment" gains a "Reflecting development changes into Docker"
subsection with the artifact → action table and the `rebuild.sh` / dev-overlay usage;
`.env.sample` gains the commented dev-overlay `COMPOSE_FILE` line next to the other
layering examples.

## 4. Non-goals

- No file-watcher daemon that auto-rebuilds images in production — auto rebuilds are
  surprising and the dev overlay covers the inner loop.
- No CI/CD integration; the script is operator-run, same as the existing
  `build-runtime-image.sh`.
- The dev overlay does not cover `src/docker-broker.ts` (see 3.2).

## 5. Alternatives rejected

- **`bun --hot`** — see 3.2; unsafe with cross-request in-memory state.
- **Baking a pinned workspace snapshot into the image** (the Phase 2 posture note in
  the Dockerfile) — would remove the live template path the deployment already relies
  on; out of scope either way.
- **Auto-detecting Hermes checkout staleness** (mtimes vs. image digests) — fragile and
  surprising; an explicit `--runtime` flag keeps semantics obvious.

## 6. Test plan

- `sh -n rebuild.sh` syntax check; executable bit set.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` validates the
  merged model (volume merge by target, command override, base mounts intact).
- The env-parity ratchet (`tests/unit/co-workspace-env-parity.test.ts`) is unaffected:
  no environment variables are added, and the test pins its compose surface to
  `docker-compose.yml` + `docker-compose.volume.yml` explicitly.
