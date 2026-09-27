# Team Gateway

Serve the workspace's variant agent teams (`templates/co-*`) over an **OpenAI-compatible web
API**, backed by headless [Hermes Agent](https://github.com/NousResearch/hermes-agent) sessions.
Governance: ADR-0092 · Design: `docs/designs/2026-09-27-team-gateway-service-design.md`.

**Phase 0 scope (this release):** single variant (`co-consult`), single user, local-only
(loopback bind, no authentication). Not for untrusted networks — see
[Limits & security](#limits--security).

## Quickstart (bare metal)

Requirements: bun ≥ 1.1, a Hermes Agent install (`hermes` on PATH, signed in to at least one
provider), and this workspace checkout.

```sh
cd services/team-gateway
bun install

TEAM_GATEWAY_HERMES_SEED_HOME="$HOME/.hermes" bun run dev
# [team-gateway] listening on http://127.0.0.1:8787
```

`TEAM_GATEWAY_HERMES_SEED_HOME` points at a Hermes home whose `auth.json`/`.env` seed each
tenant's isolated `HERMES_HOME` (its `config.yaml` is **not** copied — tenants get a generated
one). Set `TEAM_GATEWAY_HERMES_MODEL` to route tenants to a specific model (e.g. a free tier);
without it Hermes auto-resolves, which may select a paid model.

## Connect Open WebUI

Any OpenAI-wire client works; no plugin needed.

1. Start the gateway (`bun run dev`, above).
2. Open WebUI → **Settings → Admin Panel → Connections → OpenAI API**.
3. Add connection: URL `http://127.0.0.1:8787/v1`, key `sk-team-gateway` (any non-empty string).
4. Models refresh → `co-consult` appears in the model list. Start a chat: the first message
   scaffolds the tenant project (takes a minute or two), then the PM agent team answers.

## Connect Anthropic SDK clients

The same tenants are also served over the Anthropic Messages wire (`/v1/messages`), so
`@anthropic-ai/sdk`-style clients and `ANTHROPIC_BASE_URL`-based tooling attach directly:

```sh
curl -s http://127.0.0.1:8787/v1/messages \
  -H 'content-type: application/json' \
  -H 'anthropic-version: 2023-06-01' \
  -d '{"model":"co-consult","max_tokens":1024,"stream":true,
       "messages":[{"role":"user","content":"hi"}]}'
```

- API key and `anthropic-version` headers are accepted and ignored (Phase 0 has no auth).
- `system` prompts are ignored — the tenant agent team defines its own instructions from
  AGENTS.md; `max_tokens` is accepted but enforced via Hermes run ceilings instead.
- Tenant keying uses `metadata.user_id` (falling back to `default`); conversation continuity is
  a named Hermes thread per tenant, identical to the OpenAI surface.
- `POST /v1/messages/count_tokens` returns a rough chars/4 estimate, not a tokenizer count.

## Native REST surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness + config summary (no secrets) |
| GET | `/v1/models` | Variant catalog as OpenAI model list |
| POST | `/v1/chat/completions` | OpenAI wire; `model` = variant; `stream` supported |
| POST | `/v1/messages` | Anthropic Messages wire; `model` = variant; `stream` supported |
| POST | `/v1/messages/count_tokens` | Rough token estimate stub |
| POST | `/sessions` | Provision a tenant `{variant, description?, country?}` → `202` |
| GET | `/tenants`, `/tenants/:id` | Registry (status: `provisioning/ready/failed`) |
| POST | `/tenants/:id/chat` | Raw Hermes stream-json events over SSE + `done` summary |

```sh
curl -s http://127.0.0.1:8787/v1/models
curl -N http://127.0.0.1:8787/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"co-consult","stream":true,"messages":[{"role":"user","content":"hi"}]}'
```

Conversation continuity: one Hermes session per (`model`, `user`) pair, continued with
`--resume latest`. Multiple simultaneous chats on the same pair share that session (Phase 0
limitation).

## Configuration (environment)

| Variable | Default | Purpose |
|---|---|---|
| `TEAM_GATEWAY_HOST` / `_PORT` | `127.0.0.1` / `8787` | Bind address (keep loopback in Phase 0) |
| `TEAM_GATEWAY_DATA_DIR` | `services/team-gateway/data` | Tenant projects, Hermes homes, registry |
| `TEAM_GATEWAY_WORKSPACE_DIR` | repo root | Workspace clone used for scaffolding |
| `TEAM_GATEWAY_VARIANTS` | `co-consult` | Comma-separated variant allowlist (the model catalog) |
| `TEAM_GATEWAY_TEMPLATE_VERSION` | HEAD (`templates/VERSION`) | Pin to a `template-vX.Y.Z` tag |
| `TEAM_GATEWAY_HERMES_SEED_HOME` | — | Hermes home whose `auth.json`/`.env` seed tenant homes |
| `TEAM_GATEWAY_HERMES_MODEL` | Hermes auto | Model id stamped into tenant `config.yaml` (`model.default`), e.g. `upstage/solar-pro4:free` |
| `TEAM_GATEWAY_RUN_BUDGET_SECONDS` | `300` | Wall-clock ceiling per Hermes turn |
| `TEAM_GATEWAY_MAX_TURNS` | `100` | Tool-iteration ceiling per turn |
| `TEAM_GATEWAY_HERMES_EXTRA_ARGS` | — | Extra CLI args (e.g. toolset scoping) |
| `HERMES_BIN` | `hermes` | Hermes binary path |
| `HERMES_INFERENCE_MODEL` / `_PROVIDER` | — | Passed through to Hermes sessions |

## Docker (Phase 0 packaging)

```sh
export TEAM_GATEWAY_HERMES_SEED_HOME="$HOME/.hermes"
docker compose -f services/team-gateway/docker/docker-compose.yml up --build
```

The image carries bun + Hermes; the compose file mounts the workspace clone at `/workspace`
(provisioning writes `Projects/` there in Phase 0) and a named volume at `/data`. The seed home
is mounted read-only at `/seed`.

## Limits & security

Read before exposing this to anyone: **Phase 0 has no authentication and one process per
variant tenant; the only runtime boundary is the per-tenant `HERMES_HOME`.** Treat the bind
address as `127.0.0.1` and the operator as the only user. Hardening (auth, per-tenant
containers, egress policy, quotas, secret manager) is Phase 2 — roadmap in the design doc §10.

Known limits: sessions are unattended runs (`--accept-hooks`, pre-scoped toolsets via
`TEAM_GATEWAY_HERMES_EXTRA_ARGS`); provisioning takes minutes and runs asynchronously; usage
accounting captures token counts from the terminal result envelope (Hermes does not emit its
per-run cost report for `chat` runs), and is recorded, not enforced.
