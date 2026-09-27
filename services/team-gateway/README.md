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

## Connect Gemini-ecosystem clients (Antigravity ecosystem)

The same tenants are also served over the Gemini wire (`generateContent` /
`streamGenerateContent?alt=sse` / `countTokens` / `models`), so Google-ecosystem tools that
speak the Gemini API attach directly:

```sh
curl -sN "http://127.0.0.1:8787/v1beta/models/co-consult:streamGenerateContent?alt=sse" \
  -H 'content-type: application/json' \
  -d '{"contents":[{"role":"user","parts":[{"text":"hi"}]}]}'
```

- `systemInstruction` is ignored (the tenant team defines its own instructions); `generationConfig`
  is accepted but not enforced.
- Tenant keying: optional gateway-extension `user` field (default `default`) — continuity is a
  named Hermes thread per tenant, identical to the other surfaces.
- Antigravity itself exposes no public model-serving API spec (its extension surface is MCP), so
  the ecosystem-standard Gemini contract is what is served.

## Session runtimes

`TEAM_GATEWAY_RUNTIME` selects how tenant turns execute (default `hermes`):

| Runtime | Command | Notes |
|---|---|---|
| `hermes` | `hermes chat --format stream-json` | Named threads (`--continue gw-<tenantId>`), per-tenant `HERMES_HOME`, toolset scoping, container isolation supported |
| `antigravity` | `agy -p … --output-format stream-json` | Continuity via explicit `--conversation <id>` persisted on the tenant record; auth via the local Antigravity login; container isolation NOT supported (agy is not in the runtime image) |

`TEAM_GATEWAY_ANTIGRAVITY_BIN` overrides the `agy` path. Both runtimes emit the same normalized
events to every wire surface.

## Native REST surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness + config summary (no secrets) |
| GET | `/v1/models` | Variant catalog as OpenAI model list |
| POST | `/v1/chat/completions` | OpenAI wire; `model` = variant; `stream` supported |
| POST | `/v1/messages` | Anthropic Messages wire; `model` = variant; `stream` supported |
| POST | `/v1/messages/count_tokens` | Rough token estimate stub |
| POST | `/v1beta/models/{model}:generateContent` / `:streamGenerateContent` | Gemini wire; `model` = variant; `stream` via `alt=sse` |
| POST | `/v1beta/models/{model}:countTokens` | Rough token estimate stub |
| GET | `/v1beta/models` | Variant catalog as Gemini model list |
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
| `TEAM_GATEWAY_HERMES_SEED_HOME` | — | Hermes home whose `.env` seeds tenant homes |
| `TEAM_GATEWAY_HERMES_AUTH_DIR` | `<seed>/shared` | Shared Nous credential store — ONE token store across operator + tenants; refreshes stay valid everywhere |
| `TEAM_GATEWAY_HERMES_MODEL` | Hermes auto | Model id stamped into tenant `config.yaml` (`model.default`), e.g. `upstage/solar-pro4:free` |
| `TEAM_GATEWAY_RUN_BUDGET_SECONDS` | `300` | Wall-clock ceiling per Hermes turn |
| `TEAM_GATEWAY_MAX_TURNS` | `100` | Tool-iteration ceiling per turn |
| `TEAM_GATEWAY_HERMES_EXTRA_ARGS` | — | Extra CLI args (e.g. toolset scoping) |
| `TEAM_GATEWAY_HERMES_TOOLSETS` | — | Comma-separated Hermes toolsets passed as `-t` on every session |
| `TEAM_GATEWAY_QUOTA_WINDOW` | `lifetime` | `daily` resets per-tenant quota counters each UTC day |
| `TEAM_GATEWAY_API_KEYS_FILE` | — | Key file (one per line, `#` comments); union-ed with `TEAM_GATEWAY_API_KEYS`, re-read by `POST /admin/reload` |
| `TEAM_GATEWAY_ISOLATION` | `process` | `docker` = per-turn ephemeral sibling container |
| `TEAM_GATEWAY_RUNTIME_IMAGE` | `team-gateway-runtime:latest` | Runtime image for docker isolation |
| `TEAM_GATEWAY_DOCKER_BIN` | `docker` | Docker CLI binary for the isolation probe |
| `TEAM_GATEWAY_RUNTIME` | `hermes` | `hermes` or `antigravity` (agy headless print mode) |
| `TEAM_GATEWAY_ANTIGRAVITY_BIN` | `agy` | Antigravity CLI binary for the antigravity runtime |
| `HERMES_BIN` | `hermes` | Hermes binary path |
| `HERMES_INFERENCE_MODEL` / `_PROVIDER` | — | Passed through to Hermes sessions |

## Docker

```sh
export TEAM_GATEWAY_DATA_DIR_HOST=/absolute/host/path/for/data   # e.g. /srv/team-gateway/data
export TEAM_GATEWAY_HERMES_SEED_HOME="$HOME/.hermes"             # mounted ro at /seed
export TEAM_GATEWAY_HERMES_MODEL="upstage/solar-pro4:free"       # optional model routing
docker compose -f services/team-gateway/docker/docker-compose.yml up --build -d
```

- The image is based on the official `nousresearch/hermes-agent` image (hermes + python) with
  bun + the gateway server added; the compose service overrides the s6 entrypoint to run the
  server as PID 1. It serves `127.0.0.1:8787`.
- The workspace clone is mounted at `/workspace` (provisioning writes `Projects/` there in
  Phase 0) and the data dir is a BIND mount at `/data` from `TEAM_GATEWAY_DATA_DIR_HOST`.
- **Docker isolation** (`TEAM_GATEWAY_ISOLATION=docker`) spawns SIBLING containers whose mounts
  resolve on the host — set `TEAM_GATEWAY_DATA_DIR_HOST` to the absolute host path (the gateway
  passes it down automatically) and additionally mount the Docker socket
  (`/var/run/docker.sock:/var/run/docker.sock`); the Docker CLI is not baked into the image, so
  add it (static binary or `docker-cli` package) for this mode.

## Security (Phase 2 hardening)

Auth, quotas, toolset scoping, and container isolation are enforced by the gateway:

```sh
TEAM_GATEWAY_API_KEYS="sk-mykey-1,sk-mykey-2" \
TEAM_GATEWAY_TENANT_MAX_TURNS=200 \
TEAM_GATEWAY_TENANT_MAX_TOKENS=2000000 \
TEAM_GATEWAY_HERMES_TOOLSETS="fs,web" \
TEAM_GATEWAY_ISOLATION=docker \
bun run dev
```

- **Auth** — when `TEAM_GATEWAY_API_KEYS` is set, every route except `GET /health` and `GET /`
  requires a key via `Authorization: Bearer`, `x-api-key`, or `x-goog-api-key` (`401` otherwise).
  Keys are compared in constant time and never echoed. Unset = Phase 0 localhost mode
  (a startup warning states it).
- **Quotas** — `TEAM_GATEWAY_TENANT_MAX_TURNS` / `TEAM_GATEWAY_TENANT_MAX_TOKENS` are per-tenant
  caps enforced before a turn starts (`429`, costs nothing). `TEAM_GATEWAY_QUOTA_WINDOW=lifetime`
  (default) or `daily` (UTC-day buckets, reset each day). Token counts come from the Hermes
  result envelope; counters live in the tenant registry.
- **Toolset scoping** — `TEAM_GATEWAY_HERMES_TOOLSETS` (e.g. `fs,web`) is passed as `-t` on every
  session: a real per-session tool-confinement knob.
- **Container isolation** — `TEAM_GATEWAY_ISOLATION=docker` runs each turn inside an ephemeral
  sibling container (`docker run --rm -i`, image from `TEAM_GATEWAY_RUNTIME_IMAGE`, default
  `team-gateway-runtime:latest` — build it from `docker/Dockerfile`); only the tenant project dir
  and Hermes home are mounted. Startup fails fast when Docker is unusable.
- **Shared credentials** — tenants do NOT get per-tenant `auth.json` copies (a copied OAuth
  refresh token goes stale the first time another home refreshes it — found live 2026-09-27).
  Instead every session sets `HERMES_SHARED_AUTH_DIR` to one shared store (default
  `<seed>/shared`), so a single `hermes login` covers the operator and all tenants.
- **Key rotation** — set `TEAM_GATEWAY_API_KEYS_FILE` (one key per line, `#` comments) alongside
  or instead of `TEAM_GATEWAY_API_KEYS`; rotate by rewriting the file and calling
  `POST /admin/reload` with a valid key. Point the file at any managed-secret mount.
- **Egress** — network egress enforcement is host-side: Hermes iron-proxy (`hermes egress`,
  TLS-intercepting firewall, operator-deployed) fronts tenant containers/sessions; the gateway
  contributes toolset scoping + run ceilings. See the iron-proxy docs in the Hermes user guide.

Known limits: provisioning runs asynchronously; usage is metered but not billed; auth is a
shared bearer-key pool, not per-human identities. Full Phase 2
design: `docs/designs/2026-09-27-team-gateway-phase2-hardening-design.md`.
