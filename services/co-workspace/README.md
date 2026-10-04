# co-workspace

Serve the workspace's variant agent teams (`templates/co-*`) as **chat sessions over
OpenAI/Anthropic/Gemini-compatible web APIs**, backed by headless
[Hermes Agent](https://github.com/NousResearch/hermes-agent) runtimes.
Governance: ADR-0092 · Design: `docs/designs/2026-09-27-co-workspace-service-design.md`,
`docs/designs/2026-09-28-co-workspace-usability-wave-design.md`.

**Current posture:** multi-user (sign-in required, per-user identity and quotas), a web
app with explicit **team** creation, an account model with verified email changes and
admin-issued temporary passwords, an admin panel (stats, users, audit), and
**docker isolation** (opt-in via the socket override) — each agent turn runs in an ephemeral sibling container that mounts
only that team's files. See [Security model](#security-model).

## How it works — teams

- A **team** = one agent workspace for one user and one variant (one `templates/co-*`).
  The registry keys teams by `<variant>::<principal>`; there is exactly one active team
  per pair, and the web UI never auto-creates one — creation is explicit
  (**+ New team** → pick a variant, optional name → `POST /sessions`).
- The web composer always targets the selected team (`POST /tenants/:id/chat`), so a
  team can only be chatted in after it exists. Deleting a team removes the tenant
  (registry row, project files, Hermes home, history) permanently.
- **API wires keep lazy provisioning**: OpenAI/Anthropic/Gemini clients resolve or create
  the team for their (`model`, `user`) key on first message, as documented — that is the
  wires' public contract and is covered by tests.

## Web UI

- **Sidebar** — sessions grouped by **variant** by default (recency inside each group,
  collapsible groups, Today badges); a toggle at the SESSIONS header flips to recency
  grouping (`gw-grouping`, persisted). `+ New team` opens the creation modal (catalog
  from `/v1/models`, beta behind its own toggle). Each group header carries
  **Delete variant**, gated behind a confirm modal that lists every team and requires
  acknowledging that needed files have been secured.
- **Chat** — responses stream live; while a team is provisioning the log shows its
  progress stages (`⏳ [scaffolding] …`). Enter sends, Shift+Enter breaks a line
  (IME-safe: Enter that commits a Korean/Chinese candidate never fires).
- **Account modal** (✎) — password change (current password required) and self-service
  email change with verification. Display names are changed by an admin.
- **Admin panel** (⚙, admins only) — stat boxes, three composition donuts (tenants by
  status / by variant / users by state), per-user ranking bars, and the users table with
  search + paging: rename, reset password (one-time temp password, Copy button), delete
  (archive or remove tenant files).

## Accounts & sign-in

- **Sign-up** is PII-safe: a login ID + email + password create a pending account; the
  verification mail (dev mailer → outbox dir) activates it and the raw email is dropped —
  only a SHA-256 hash is kept for uniqueness. The same privacy invariant covers later
  email changes (see below), so the signup notices stay true.
- **Sign-in** issues an HttpOnly session cookie (hashed server-side, 7-day TTL).
- **Password change** (self-service) requires the current password; other sessions are
  invalidated. **Admin reset** issues a one-time **temp password** (15 min) — shown once
  with a Copy button — which forces a password change at first sign-in.
- **Email change** is self-service with verification: a staged pending row holds the new
  address ≤24 h; confirming swaps the account's email hash. Admins can rename users but
  never read their email.
- **Google SSO** links by verified email when `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` are set.

## Quickstart (bare metal)

Requirements: bun >= 1.1, a Hermes Agent install (`hermes` on PATH), this workspace
checkout, and LLM credentials in one of two modes.

**Recommended: provider key + base-url mode.** A static provider key needs no OAuth
tokens, so the per-turn `auth.json` re-seed is skipped.

```sh
cd services/co-workspace
bun install

CO_WORKSPACE_LLM_PROVIDER=custom \
CO_WORKSPACE_LLM_BASE_URL=https://api.openai.com/v1 \
CO_WORKSPACE_LLM_API_KEY=<provider key> \
CO_WORKSPACE_HERMES_MODEL=<model id> bun run dev
# [co-workspace] listening on http://127.0.0.1:9030
```

Creating a team needs a credential: sign up/sign in via the web UI (`/login`) or present an
API key. Anonymous team creation answers `401` unless `CO_WORKSPACE_ALLOW_ANON_PROVISIONING=true`
(and that switch requires explicit quotas at boot — see the configuration table).

`CO_WORKSPACE_HERMES_MODEL` is stamped as `model.default` into each team's generated
`config.yaml` (trust keys there scope project skills to the team directory). Without an
explicit model, Hermes auto-resolves one, which may be a paid model. See the
configuration table for the provider selector.

**Legacy/alternative: seed-home (OAuth) mode**, used when no key is configured:

```sh
CO_WORKSPACE_HERMES_SEED_HOME="$HOME/.hermes" bun run dev
```

`CO_WORKSPACE_HERMES_SEED_HOME` points at a Hermes home (signed in to at least one
provider) whose `auth.json`/`.env` seed each team's isolated `HERMES_HOME`.

## API wires (OpenAI / Anthropic / Gemini)

Any OpenAI-wire client works; no plugin needed. Auth: a Bearer key
(`CO_WORKSPACE_API_KEYS` or the key file, `key:label` maps a key to a trusted principal)
or a signed-in session cookie.

1. Open WebUI → **Settings → Admin Panel → Connections → OpenAI API**.
2. Add connection: URL `http://127.0.0.1:9030/v1`, key `sk-co-workspace` (any non-empty
   string). Models refresh lists the variant catalog; the first message lazily creates
   the team for that client key (takes a minute or two to scaffold), then the agent team
   answers.

Anthropic Messages (`/v1/messages`, streaming supported) and Gemini
(`/v1beta/models/{model}:generateContent|streamGenerateContent?alt=sse|countTokens`)
surfaces behave identically: `system`/`systemInstruction` are ignored (the team defines
its own instructions from AGENTS.md), `max_tokens`/`generationConfig` are accepted but
enforced through Hermes run ceilings, and team keying uses the key-file principal or the
optional `user` extension field (default `default`). The count-token endpoints return a
rough chars/4 estimate, not a tokenizer count.

## Native REST surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/` , `/login` | Web app (redirects when signed out) / sign-in page — `Cache-Control: no-cache` |
| GET | `/health` | Liveness + config summary (no secrets) |
| POST | `/sessions` | Create a team `{variant, name?, description?}` → `202`; idempotent per (principal, variant) → `200` + `existing: true` |
| GET | `/tenants` , `/tenants?mine=1` , `/tenants/:id` | Registry (status: `provisioning/ready/failed`) — admins see all teams, everyone else only their own |
| DELETE | `/tenants/:id` | Remove the team: registry row, project files, Hermes home, history |
| POST | `/tenants/:id/chat` | Raw Hermes stream-json events over SSE + `done`; streams provisioning stages while the team prepares |
| POST | `/tenants/:id/cancel` | Cancel a running turn |
| GET | `/tenants/:id/history` | Recent turn summaries |
| GET | `/tenants/:id/files/*` , `/tenants/:id/file/*` | Team workspace listing / 256 KB-capped file content (owner or admin) |
| POST | `/auth/signup` · `/auth/verify` · `/auth/resend` | PII-safe account creation with email verification (dev mailer: outbox dir) |
| POST | `/auth/login` · `/auth/logout` | Session issue / destroy (temp-password logins carry `mustChangePassword`) |
| GET/PATCH | `/auth/me` | Session identity + usage / password change (`currentPassword` required) |
| POST | `/auth/email/change` · `/auth/email/verify` | Self-service email change with verification (hash-only storage) |
| GET | `/auth/google/login` · `/auth/google/callback` | Google SSO (OAuth code + PKCE) |
| GET | `/admin/stats` | Users/tenants/turns/disk aggregates (disk sizes cached 60 s) |
| GET | `/admin/users` | All users with status and usage |
| PATCH | `/admin/users/:id/name` | Rename a user (audited) |
| POST | `/admin/users/:id/reset-password` | Issue a one-time temp password (15 min, purges sessions, forces rotation) |
| DELETE | `/admin/users/:id?tenants=archive\|delete` | Delete a user and disposition their teams (audited) |
| POST | `/admin/reload` | Re-read the key file without restart (admin-only) |
| GET | `/admin/audit` , `/admin/mail-outbox` | Audit trail / dev-mailer contents (admin-only) |

## Session runtimes

`CO_WORKSPACE_RUNTIME` selects how team turns execute (default `hermes`):

| Runtime | Command | Provider | Continuity | Credentials | Container isolation |
|---|---|---|---|---|---|
| `hermes` | `hermes chat --format stream-json` | operator-configured | named thread (`--continue gw-<tenantId>`) | per-tenant HERMES_HOME (re-seeded per turn) | ✅ |
| `antigravity` | `agy -p --output-format stream-json` | Google | `--conversation <id>` (persisted) | local Antigravity login | ❌ |
| `claude` | `claude -p --output-format stream-json --verbose` | Anthropic | `--resume <session_id>` (persisted) | operator `claude login` (`~/.claude`) — never copied | ❌ |
| `codex` | `codex exec --json` (+ `resume <thread_id>`) | OpenAI | thread id (persisted) | operator `codex login` (`~/.codex`) — never copied | ❌ |

`CO_WORKSPACE_ANTIGRAVITY_BIN` / `_CLAUDE_BIN` / `_CODEX_BIN` override the binary paths.
Adding a runtime follows the P6 checklist: live protocol probe → adapter → persisted
continuity handle → credential model → isolation matrix → provider disclosure in
`/v1/models` → canned-JSONL tests.

### Runtime matrix (2026-10-03 CLI provider-key design)

| Runtime | Wire protocol | Continuity | Credentials | Process isolation | Docker-isolated turns |
|---|---|---|---|---|---|
| hermes (default) | `hermes chat --format stream-json` | named threads | provider-key (config.yaml stamp) or OAuth shared store | ✅ | ✅ (runtime image carries hermes) |
| claude | `claude -p --output-format stream-json` | `--resume <id>` | **provider-key → `ANTHROPIC_API_KEY` (+`ANTHROPIC_BASE_URL`)** or login mount | ✅ (gateway image carries the CLI) | ❌ not delivered (T-20261003-023 follow-up) |
| codex | `codex exec --json` | `exec resume <id>` | **provider-key → `OPENAI_API_KEY`** (custom base URL = `~/.codex/config.toml` stanza, operator-side) or login mount | ✅ (gateway image carries the CLI) | ❌ not delivered (same) |
| antigravity (agy) | `agy -p --output-format stream-json` | `--conversation <id>` | Google sign-in ONLY — the CLI exposes no API-key surface; login home mounted RO via `docker-compose.creds.yml` (binary baked via Google's official installer) | ✅ (agy baked in the gateway image) | ❌ blocked — no API-key credential path; mounting operator login state into a tenant container is a SEC-07-class exposure |

Injection precedence: a configured provider key whose family matches the runtime overrides
the operator's interactive login for that turn; family mismatch (e.g. a `gemini` key with
the codex runtime) injects nothing and warns at boot; `custom` matches both claude and
codex — the operator guarantees the base URL speaks that protocol. `zai` + claude requires
`CO_WORKSPACE_LLM_BASE_URL` pointing at the Anthropic-compatible endpoint
(`https://api.z.ai/api/anthropic`).

### CLI refresh (2026-10-03 cli-refresh design)

claude/codex are **pinned** in `docker/Dockerfile` and bump deliberately (never silent
`latest` — the Bun-pin policy precedent); a weekly scheduled workflow
(`cli-version-drift.yml`) opens an issue when a pin lags npm latest. After merging a bump,
refresh the running stack with:

    ./docker/rebuild.sh --runtime

which rebuilds the gateway image AND the per-turn runtime image (it builds FROM the gateway
image, so it inherits the baked CLIs — `--runtime` is required for turn parity). hermes
tracks the workspace checkout (`build-runtime-image.sh` rsyncs it); the agy installer has
no versioned artifact, so image rebuilds pick up current-at-build (caveat recorded in the
design). In-container background self-updates are inert by design.

## Configuration (environment)

| Variable | Default | Purpose |
|---|---|---|
| `CO_WORKSPACE_HOST` / `CO_WORKSPACE_PORT` | `127.0.0.1` / `9030` | Bind address (keep loopback unless fronted by auth) |
| `CO_WORKSPACE_DATA_DIR` | `services/co-workspace/data` | Accounts, registry, history, audit and team storage (`storage/<principal>/<project>/`) |
| `CO_WORKSPACE_DATA_DIR_HOST` | — | Host path of the data dir (bind + docker-isolation sibling mounts) |
| `CO_WORKSPACE_WORKSPACE_DIR` | repo root | Workspace clone used for scaffolding |
| `CO_WORKSPACE_VARIANTS` | compose: `all` | Variant allowlist — `all` auto-discovers every `status: stable` `templates/co-*` |
| `CO_WORKSPACE_VARIANTS_INCLUDE_BETA` | `false` (compose: `true`) | Adds beta variants to the catalog (tagged `meta.status: "beta"`); also selectable per-creation in the New-team modal |
| `CO_WORKSPACE_TEMPLATE_VERSION` | HEAD (`templates/VERSION`) | Pin to a `template-vX.Y.Z` tag |
| `CO_WORKSPACE_HERMES_SEED_HOME` | — | Legacy/alternative (no provider key): Hermes home whose `auth.json`/`.env` seed team homes |
| `CO_WORKSPACE_HERMES_AUTH_DIR` / `CO_WORKSPACE_HERMES_AUTH_DIR_HOST` | `<seed>/shared` | Shared credential store — one token store across operator and teams |
| `CO_WORKSPACE_HERMES_MODEL` | Hermes auto | Model id stamped into team `config.yaml` (`model.default`), e.g. `upstage/solar-pro4:free` |
| `CO_WORKSPACE_LLM_PROVIDER` + `CO_WORKSPACE_LLM_BASE_URL` + `CO_WORKSPACE_LLM_API_KEY` | — (off) | **Provider key+base-url mode** (recommended; co-newbiz scheme): `PROVIDER` selects `openai \| anthropic \| gemini \| zai \| custom` (default `custom`; `none` = off). Teams authenticate with a static provider key — stamped into team `config.yaml` (`model.api_key`; hermes agent turns resolve keys through their secret scope and do not borrow ambient env) plus injected as the provider's env name (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / `ZAI_API_KEY`) — and `model.provider`/`model.base_url` are stamped into team `config.yaml`; the OAuth auth.json re-seed is skipped. `zai` pairs with `https://api.z.ai/api/anthropic` (the coding-plan endpoint; hermes's `zai` provider preserves dotted model ids like `GLM-5.3-Flash`). `BASE_URL` is required for `custom`, optional override for named providers. Unset key = legacy shared-store/auth.json path. The stamped key is plaintext on the tenant's disk — use a dedicated low-limit key (ADR-0092 Addendum 9) |
| `CO_WORKSPACE_HERMES_REASONING_EFFORT` | `low` (key mode) | Default effort stamped into team `config.yaml` (`agent.reasoning_effort`) — thinking-mandatory models (glm-5.3-flash) reject effort-less requests, so key-mode turns run with zero operator flags. `low \| high \| max`; an explicitly empty value omits the stamp (compose uses `${VAR-low}`, so empty is kept, not defaulted) |
| `CO_WORKSPACE_RUN_BUDGET_SECONDS` / `CO_WORKSPACE_MAX_TURNS` | `300` / `100` | Wall-clock and tool-iteration ceilings per turn |
| `CO_WORKSPACE_INTERACTION_STANDARD` | `true` | Prepend the LLM Interaction Standard short form (docs/standards/llm-interaction-standard.md) to fresh sessions; `false` opts out |
| `CO_WORKSPACE_HERMES_TOOLSETS` / `CO_WORKSPACE_HERMES_EXTRA_ARGS` | — | Toolset scoping (`-t`) and extra CLI args per session |
| `CO_WORKSPACE_QUOTA_WINDOW` | `lifetime` | `daily` resets per-team quota counters each UTC day |
| `CO_WORKSPACE_API_KEYS` / `CO_WORKSPACE_API_KEYS_FILE` | — | Bearer keys; `key:label` (key file only) maps a key to a trusted principal; the file re-reads on `POST /admin/reload` |
| `CO_WORKSPACE_LOGIN_REQUIRED` | compose: `true` | Web app requires a session; keyless, sessionless visitors are redirected. A valid Bearer key satisfies the demand without a session, so keys and the login gate compose (ADR-0092 Addendum 15) |
| `CO_WORKSPACE_PUBLISH` | `127.0.0.1` | Host IP of the compose publish binding; `0.0.0.0` exposes the gateway on all interfaces — keep auth on before widening (see Security model) |
| `CO_WORKSPACE_CSRF_REQUIRED` | compose: `true` | Keyless mutating requests need `x-requested-with: co-workspace` |
| `CO_WORKSPACE_TRUST_PROXY` | `false` | Key auth rate limits on the right-most `X-Forwarded-For` hop (set only behind a reverse proxy); otherwise the socket peer IP |
| `CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL` | `0` (=unlimited; compose: `10`) | Teams per principal — set a positive value for multi-user deployments |
| `CO_WORKSPACE_TENANT_MAX_TURNS` / `CO_WORKSPACE_TENANT_MAX_TOKENS` | `0` | Per-team turn/token caps (`429`, enforced before a turn starts) |
| `CO_WORKSPACE_ISOLATION` | `process` | `docker` = per-turn ephemeral sibling container (tenant files only) |
| `CO_WORKSPACE_RUNTIME_IMAGE` | `co-workspace-runtime:latest` | Runtime image for docker isolation (the gateway image also qualifies — it carries hermes) |
| `CO_WORKSPACE_DOCKER_BIN` | `docker` | Docker CLI used for isolation spawns |
| `CO_WORKSPACE_INSTANCE_ID` | `default` | Label value on turn containers; at boot the gateway removes leftover turn containers carrying its own id (set distinct ids when several gateways share one Docker daemon) |
| `CO_WORKSPACE_COOKIE_SECURE` | `auto` | `true`/`false` force the session-cookie `Secure` flag; `auto` sets it on HTTPS requests, or on `X-Forwarded-Proto: https` only when `CO_WORKSPACE_TRUST_PROXY=true` |
| `CO_WORKSPACE_SESSION_TTL_HOURS` / `CO_WORKSPACE_SESSION_IDLE_HOURS` | `24` / `4` | Session hardening (2026-10-03): absolute lifetime and idle expiry — activity slides the idle window but never past the absolute cap; sign-in is required again after either. Admin destructive ops additionally re-confirm the operator password per call |
| `CO_WORKSPACE_ALLOW_ANON_PROVISIONING` | `false` | `false` = creating a team requires a credential (sign-in or API key); unauthenticated creation answers `401` and is audited (`tenant.provision.denied`). `true` restores zero-friction anonymous first-use for throwaway deploys — and REQUIRES explicit quotas (`CO_WORKSPACE_TENANT_MAX_TURNS`, `_TENANT_MAX_TOKENS`, `_PRINCIPAL_MAX_TOKENS`): boot fails when any of them is `0`, because anonymous tenants would otherwise spend unmetered provider tokens (2026-10-03 review M6) |
| `CO_WORKSPACE_DATA_VOLUME` | — (bind mode) | Volume-subpath mode (T-20260930-038): a named Docker volume holding `storage/<P>/<N>/…`; turn containers mount it via `volume-subpath` and no host path is ever named to the daemon. Requires `docker-compose.volume.yml` in `COMPOSE_FILE` and `docker volume create` first (boot probe fails fast) |
| `CO_WORKSPACE_BROKER_TOKEN` | — (base mode) / **required** (volume mode) | Shared secret between the gateway and the docker broker's volume-control route (sent as `x-co-workspace-token`). Volume mode refuses to start without it — the route runs an `rm -rf` helper inside the data volume (2026-10-03 review M13) |
| `CO_WORKSPACE_PRINCIPAL_MAX_TOKENS` | `0` (=unlimited) | Token cap across all of a principal's teams |
| `CO_WORKSPACE_SCAFFOLD_TIMEOUT_MS` | `600000` | Time limit for scaffolding a team (ms) |
| `CO_WORKSPACE_CLAUDE_BIN` / `CO_WORKSPACE_CODEX_BIN` / `CO_WORKSPACE_ANTIGRAVITY_BIN` / `CO_WORKSPACE_ANTIGRAVITY_BIN_PREFIX` / `HERMES_BIN_PREFIX` | image defaults | claude/codex/agy are baked into the gateway image (2026-10-03; agy via Google's official installer). Overrides are for bare-metal runs or alternate binaries |
| `CO_WORKSPACE_CONTAINER_MEMORY` / `CO_WORKSPACE_CONTAINER_CPUS` / `CO_WORKSPACE_CONTAINER_PIDS_LIMIT` | `2g` / `2` / `256` | Resource caps for isolated turns |
| `CO_WORKSPACE_RUNTIME` | `hermes` | `hermes` / `antigravity` (agy) / `claude` / `codex` |
| `CO_WORKSPACE_ADMIN_EMAIL` | — | Bootstrap admin account (created at startup) |
| `CO_WORKSPACE_TURN_TIMING` | compose: `1` | Per-stage turn timing logs (`t0/t_lock/t_spawn/…` JSON lines; set `0` to silence; T-20260930-011) |
| `CO_WORKSPACE_VOLUME_INIT_IMAGE` | `alpine:3.20` | Helper image for the broker-internal volume init/rm containers (volume mode only; pin by digest for supply-chain hygiene) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | — | Google SSO |
| `HERMES_BIN` | `hermes` | Hermes binary path |
| `HERMES_INFERENCE_MODEL` / `_PROVIDER` | — | Passed through to Hermes sessions |

## Docker deployment

Deploy from **this workspace checkout** (compose builds from it and mounts it at
`/workspace` for scaffolding) and keep deployment paths in `docker/.env` (local-only,
never committed). The full variable inventory — provider key+base-url mode, quotas,
SSO, isolation knobs — lives in **`docker/.env.sample`**: copy it to `.env` and fill
in values. Set `CO_WORKSPACE_DATA_DIR_HOST` to a durable host directory — team
storage must survive reboots, so keep it off `/tmp` (the default
`services/co-workspace/data` inside this checkout qualifies — it is gitignored):

```sh
cat > services/co-workspace/docker/.env <<'ENV'
CO_WORKSPACE_DATA_DIR_HOST=/absolute/durable/path/for/services/co-workspace/data
CO_WORKSPACE_ISOLATION=docker
# Docker isolation adds a socket proxy (see Security model):
COMPOSE_FILE=docker-compose.yml:docker-compose.isolation.yml
# Legacy OAuth mode only: also mount the Hermes home via the seed override:
#CO_WORKSPACE_HERMES_SEED_HOME=/Users/you/.hermes
#COMPOSE_FILE=docker-compose.yml:docker-compose.isolation.yml:docker-compose.seed.yml
# Build it once from your working Hermes build: ./build-runtime-image.sh
CO_WORKSPACE_RUNTIME_IMAGE=co-workspace-runtime:latest
CO_WORKSPACE_HERMES_MODEL=upstage/solar-pro4:free
# Provider key mode (recommended over the OAuth flow) — full inventory in .env.sample:
#CO_WORKSPACE_LLM_PROVIDER=custom
#CO_WORKSPACE_LLM_BASE_URL=https://api.openai.com/v1
#CO_WORKSPACE_LLM_API_KEY=your_provider_api_key_here
ENV

cd services/co-workspace/docker
docker compose build && docker compose up -d
# serves http://127.0.0.1:9030 — bootstrap the admin with CO_WORKSPACE_ADMIN_EMAIL if needed
```

- The image is based on the official `nousresearch/hermes-agent` image (hermes + python)
  with bun + the gateway server added; **one image serves both roles** — the gateway
  container and the per-turn docker-isolation runtime (`CO_WORKSPACE_RUNTIME_IMAGE`).
  The docker CLI is baked in via `COPY --from=docker:cli`. The host socket
  (`/var/run/docker.sock`) is never mounted into the gateway: docker isolation requires the
  `docker/docker-compose.isolation.yml` override (a socket proxy), enabled via `COMPOSE_FILE`
  in `.env` or `docker compose -f docker-compose.yml -f docker-compose.isolation.yml ...`.
  The runtime image must be pre-built (`./build-runtime-image.sh`).
- Provisioning scaffolds into the clone's `Projects/` and relocates the team immediately;
  docker-isolated turns run as the unprivileged runtime user (10000) and the team tree is
  chowned to it at provisioning.

### Reflecting development changes into Docker

What a code change needs before the running stack serves it:

| You changed | How it reaches Docker |
| --- | --- |
| `templates/**` (L1/L2 team templates) | Nothing — `/workspace` is a live bind mount; the next tenant provisioning scaffolds from the edited templates |
| `services/co-workspace/src/**` or `web/**` | `./rebuild.sh` — rebuilds the image and recreates the containers; or layer `docker-compose.dev.yml` (below) to reflect edits live |
| The Hermes checkout (`~/.hermes/hermes-agent`) | `./rebuild.sh --runtime` — also rebuilds the per-turn runtime image |
| `Dockerfile`, `package.json`/`bun.lock`, compose files | `./rebuild.sh` |

One command for the common case (run from `services/co-workspace/docker/`; it preserves
your `COMPOSE_FILE` layering from `.env`):

```sh
./rebuild.sh            # gateway image + container recreation
./rebuild.sh --runtime  # + turn runtime image from the Hermes checkout
```

For an inner-loop development cycle (edit → save → the container restarts with the new
source, no image build), layer the dev overlay:

```sh
# in docker/.env
COMPOSE_FILE=docker-compose.yml:docker-compose.dev.yml
docker compose up -d
```

`docker-compose.dev.yml` bind-mounts `src/` and `web/` over the baked copies and runs
`bun --watch src/server.ts`: the gateway process restarts on each source save (the
tenant registry on `/data` survives; in-memory login sessions do not). Dependency
changes (`package.json`/`bun.lock`) still need `./rebuild.sh` — the dev overlay mounts
source only, not `node_modules`.

## Security model

- **Identity** — per-user accounts (login ID + password, optional Google SSO) with
  sessions stored hashed. `key:label` file entries map API keys to trusted principals.
  `/auth/*` is intentionally reachable without an API key; every other route demands a
  key or a session, and admin routes demand the admin role.
- **Composability** — API keys and the login-required web UI stack: the sign-in page
  (`GET /login`) is key-exempt so a fresh browser can always sign in, and a valid Bearer
  key satisfies the session demand on API routes — one deployment serves browser users
  (session) and wire clients (key) at once (ADR-0092 Addendum 15).
- **Authorization** — tenant reads/writes/deletes are owner-or-admin (`requireTenantAccess`);
  `?mine=1` is session-aware; keyless mutating requests require the CSRF header.
- **Isolation** — docker mode runs each turn in an ephemeral sibling (memory/cpus/pids
  caps, `no-new-privileges`, `cap-drop ALL`, non-root runtime user) mounting only that
  team's project dir and Hermes home. Process mode (default in bare-metal quickstarts)
  shares the gateway container's filesystem — fine for a trusted single operator only.
  **The real process-mode boundary (2026-10-03 review H1):** the env allowlist filters what
  the gateway CONSTRUCTS for the child; it is not a sandbox. A same-uid agent can read
  `/proc/1/environ` (the gateway's own env — `CO_WORKSPACE_LLM_API_KEY`,
  `GOOGLE_CLIENT_SECRET`, `CO_WORKSPACE_API_KEYS`) and the entire shared data dir (every
  principal's `storage/`, `users.db`, `turns.db`, the live mail outbox). The gateway prints
  this warning at boot when credentials are on; use `CO_WORKSPACE_ISOLATION=docker` for
  genuine per-tenant separation.
- **Rate limiting** — login/signup limits key on the socket peer IP (never a client-supplied
  `X-Forwarded-For`), and logins are additionally limited per login ID. Behind Docker's
  bridge NAT all direct clients share one socket IP, so the per-IP limit is effectively
  global unless a reverse proxy is trusted via `CO_WORKSPACE_TRUST_PROXY=true`.
- **PII** — raw emails live ≤24 h in a pending-verification row and are then dropped;
  accounts keep only a SHA-256 email hash. Admins can rename users but cannot read or
  set their email.
- **Non-root gateway** — the gateway container runs as uid:gid 10000:10000 (matching the
  sibling turn containers, so files it creates are already owned by the turn user) with
  `no-new-privileges` and all capabilities dropped. Override with `CO_WORKSPACE_GATEWAY_UID`
  / `_GID`. On Linux, `chown -R 10000:10000` the data dir (`CO_WORKSPACE_DATA_DIR_HOST`) and
  the shared auth dir once, and make the workspace clone writable by uid 10000; macOS Docker
  Desktop maps ownership, so no chown is needed. The gateway skips its best-effort tenant
  chown when not root and logs `running as uid N` at boot. Verified live (2026-09-30, macOS
  Docker Desktop): the hermes base image already has uid/gid 10000, and as that uid the image
  runs bun, git and the docker CLI with a writable `HOME`; provisioning, turns and delete work
  with no permission errors. Linux host bind-mount ownership is not yet verified.
- **Docker socket** — the gateway does not mount the raw socket. `docker-compose.isolation.yml`
  adds a `docker-broker` service (`src/docker-broker.ts` plus the pure policy module
  `src/docker-broker-policy.ts`, in the same gateway image via a command override; read-only
  socket mount, no published ports) on an internal-only `dockerapi` network; the gateway uses
  `DOCKER_HOST=tcp://docker-broker:2375`. The broker is a raw socket proxy (T-20260930-027,
  replacing the endpoint-only tecnativa proxy and the first fetch-based broker, which was
  bypassable and could not carry `docker run -i`). Real controls: (1) one request per
  connection, strictly parsed (16 KiB head, 64 KiB body, `Transfer-Encoding` rejected), the
  upstream head rebuilt from scratch, and any pipelined bytes close the connection; (2) the
  create body is validated by a strict JSON scanner (duplicate or case-variant keys rejected),
  an exact allowlist of every key at every level, and is forwarded as the canonical
  re-serialized text, never the raw text. Dangerous HostConfig fields must equal the CLI
  default; the top-level `User` must be `10000:10000`; `CapDrop` exactly `["ALL"]`;
  `SecurityOpt` exactly `["no-new-privileges"]`; the image must equal
  `CO_WORKSPACE_RUNTIME_IMAGE`; resource caps come from the gateway's env; `Binds` must be
  exactly `<DATA>/storage/<P>/<N>/project` and `.../hermes-home` onto `/work/project` and
  `/work/hermes-home`; (3) the broker walks the bind sources with `lstat` at create and
  re-checks them against the recorded binds at start (the data dir is mounted read-only into
  the broker at the same host path for this); (4) container refs are resolved through an
  internal inspect whose result is never relayed, and are forwarded only if the name matches
  the turn pattern and the container carries this instance's label; the list route is
  filtered the same way. Inspect, resize, exec, images, volumes, networks, build, swarm and
  info are not allowed; versioned (`/v1.NN/...`) paths are accepted, paths containing `%` are
  not. **Residual risk (accepted)**: a symlink swap between the start-time check and the
  daemon resolving the bind source cannot be closed by any string or `lstat` check while the
  gateway can write the data dir; the broker narrows it to milliseconds, and rootless Docker
  or userns-remap is the only complete fix. A compromised gateway can also still create,
  start and kill the turn containers it legitimately owns, within the policy bounds. The
  broker runs as root (needed for the socket's root:root 660 check) with all capabilities
  dropped and a read-only filesystem. Do not run other sensitive workloads on the same Docker
  daemon as the gateway. `IMAGES=0` semantics carry over: the image allowlist makes a missing
  runtime image fail at create time instead of pulling. Not verified: Docker Desktop versus
  Linux symlink semantics on real bind mounts, Linux data-dir ownership with the read-only
  broker mount, output backpressure under very large output.
  Not yet verified: a real provider turn end to end, Google SSO, legacy OAuth seed mode.
  Single-operator deployments only.
- **Seed home is optional** — the base compose no longer mounts a Hermes home. Legacy OAuth
  mode adds `docker-compose.seed.yml` (mounts `CO_WORKSPACE_HERMES_SEED_HOME` read-only at
  `/seed-home`); provider key mode needs no seed home. The `.env.keys` and shared-store host
  paths default under the seed home when set, otherwise under `<data dir>/seed`.
- **Known tradeoffs** (documented, by design):
  - *SEC-07 composed residual (the umbrella entry — 2026-10-03 review H4/T-20261003-018)*:
    three accepted tradeoffs COMPOSE into one risk: a plaintext provider key (or the OAuth
    `auth.json` re-seeded every turn in legacy mode) sits on a read-write-mounted Hermes
    home, the turn container's network egress is open, and the agent is prompt-injectable —
    so a single injected turn can exfiltrate the credential. Individually each acceptance
    lives in its own doc; THIS entry is the tracked composition. Exit criteria (either one
    closes it): the iron-proxy egress policy deployment, or credential-injected-at-runtime
    (token broker / RO mount + refresh channel — upstream Hermes capability) instead of
    stamping credentials to disk. Provider-key mode with a dedicated low-limit key remains
    the recommended mitigation until then.
  - *Provider key mode (recommended)*: no OAuth token is copied, so the refresh-token-reuse
    revocation class is gone. The key is stored in plaintext in each team's `config.yaml`
    (`model.api_key`; hermes turns do not read it from env) and is readable by the team's own
    tools, including in docker mode where the Hermes home is mounted read-write. Use a
    dedicated, low-limit key (ADR-0092 Addendum 9).
  - *Seed-home/OAuth mode (legacy)*: every turn, each team's Hermes home is re-seeded with the
    operator's CURRENT `auth.json` — one login covers all teams, but the copy is readable by
    the turn, and multiple homes refreshing the same single-use token can get the session
    revoked (the reason provider key mode exists). Process mode additionally binds the shared
    token store; team-scoped token separation is future work.
  - *Restart and orphan turns*: `chatLocks`/`activeProcs` are memory-only, but every runtime
    now carries a uniform kill+watchdog contract (2026-10-03 review H1): turns register their
    live process, enforce `runBudgetSeconds` externally (exit 124), SIGTERM/SIGINT drain
    children and checkpoint the stores, docker mode reaps orphaned turn containers hourly.
    A bare-host orphan between watchdog ticks is still possible; stop the process group to
    be certain.
  - The dev mailer writes verification mails to a local outbox instead of SMTP. Rate limiters
    are in-memory; session-authenticated mutations rely on SameSite=Lax (the CSRF header
    guards keyless requests).

Known limits: provisioning is asynchronous; usage is metered but not billed; multi-team
per variant (beyond one per user) is future work. History: Phase 2 hardening design
`docs/designs/2026-09-27-co-workspace-phase2-hardening-design.md`, usability wave
`docs/designs/2026-09-28-co-workspace-usability-wave-design.md`.
