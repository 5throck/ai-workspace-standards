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

Requirements: bun ≥ 1.1, a Hermes Agent install (`hermes` on PATH, signed in to at least
one provider), and this workspace checkout.

```sh
cd services/co-workspace
bun install

CO_WORKSPACE_HERMES_SEED_HOME="$HOME/.hermes" bun run dev
# [co-workspace] listening on http://127.0.0.1:9030
```

`CO_WORKSPACE_HERMES_SEED_HOME` points at a Hermes home whose `auth.json`/`.env` seed each
team's isolated `HERMES_HOME` (its `config.yaml` is generated — trust keys scope project
skills to the team directory, and `CO_WORKSPACE_HERMES_MODEL` stamps `model.default`).
Without an explicit model, Hermes auto-resolves one — which may be a paid model.

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

## Configuration (environment)

| Variable | Default | Purpose |
|---|---|---|
| `CO_WORKSPACE_HOST` / `_PORT` | `127.0.0.1` / `9030` | Bind address (keep loopback unless fronted by auth) |
| `CO_WORKSPACE_DATA_DIR` | `services/co-workspace/data` | Accounts, registry, history, audit and team storage (`storage/<principal>/<project>/`) |
| `CO_WORKSPACE_DATA_DIR_HOST` | — | Host path of the data dir (bind + docker-isolation sibling mounts) |
| `CO_WORKSPACE_WORKSPACE_DIR` | repo root | Workspace clone used for scaffolding |
| `CO_WORKSPACE_VARIANTS` | compose: `all` | Variant allowlist — `all` auto-discovers every `status: stable` `templates/co-*` |
| `CO_WORKSPACE_VARIANTS_INCLUDE_BETA` | `false` (compose: `true`) | Adds beta variants to the catalog (tagged `meta.status: "beta"`); also selectable per-creation in the New-team modal |
| `CO_WORKSPACE_TEMPLATE_VERSION` | HEAD (`templates/VERSION`) | Pin to a `template-vX.Y.Z` tag |
| `CO_WORKSPACE_HERMES_SEED_HOME` | — | Hermes home whose `auth.json`/`.env` seed team homes |
| `CO_WORKSPACE_HERMES_AUTH_DIR` (+`_HOST`) | `<seed>/shared` | Shared credential store — one token store across operator and teams |
| `CO_WORKSPACE_HERMES_MODEL` | Hermes auto | Model id stamped into team `config.yaml` (`model.default`), e.g. `upstage/solar-pro4:free` |
| `CO_WORKSPACE_LLM_PROVIDER` + `CO_WORKSPACE_LLM_BASE_URL` + `CO_WORKSPACE_LLM_API_KEY` | — (off) | **Provider key+base-url mode** (recommended; co-newbiz scheme): `PROVIDER` selects `openai \| anthropic \| gemini \| zai \| custom` (default `custom`; `none` = off). Teams authenticate with a static provider key — stamped into team `config.yaml` (`model.api_key`; hermes agent turns resolve keys through their secret scope and do not borrow ambient env) plus injected as the provider's env name (`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / `ZAI_API_KEY`) — and `model.provider`/`model.base_url` are stamped into team `config.yaml`; the OAuth auth.json re-seed is skipped. `zai` pairs with `https://api.z.ai/api/anthropic` (the coding-plan endpoint; hermes's `zai` provider preserves dotted model ids like `GLM-5.3-Flash`). `BASE_URL` is required for `custom`, optional override for named providers. Unset key = legacy shared-store/auth.json path |
| `CO_WORKSPACE_HERMES_REASONING_EFFORT` | `low` (key mode) | Default effort stamped into team `config.yaml` (`agent.reasoning_effort`) — thinking-mandatory models (glm-5.3-flash) reject effort-less requests, so key-mode turns run with zero operator flags. `low \| high \| max`; set empty to omit the stamp |
| `CO_WORKSPACE_RUN_BUDGET_SECONDS` / `MAX_TURNS` | `300` / `100` | Wall-clock and tool-iteration ceilings per turn |
| `CO_WORKSPACE_HERMES_TOOLSETS` / `CO_WORKSPACE_HERMES_EXTRA_ARGS` | — | Toolset scoping (`-t`) and extra CLI args per session |
| `CO_WORKSPACE_QUOTA_WINDOW` | `lifetime` | `daily` resets per-team quota counters each UTC day |
| `CO_WORKSPACE_API_KEYS` / `_API_KEYS_FILE` | — | Bearer keys (`key:label` maps a key to a trusted principal); the file re-reads on `POST /admin/reload` |
| `CO_WORKSPACE_LOGIN_REQUIRED` | compose: `true` | Web app requires a session; keyless visitors are redirected |
| `CO_WORKSPACE_CSRF_REQUIRED` | compose: `true` | Keyless mutating requests need `x-requested-with: co-workspace` |
| `CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL` | `0` (=unlimited; compose: `10`) | Teams per principal — set a positive value for multi-user deployments |
| `CO_WORKSPACE_TENANT_MAX_TURNS` / `_MAX_TOKENS` | `0` | Per-team turn/token caps (`429`, enforced before a turn starts) |
| `CO_WORKSPACE_ISOLATION` | `process` | `docker` = per-turn ephemeral sibling container (tenant files only) |
| `CO_WORKSPACE_RUNTIME_IMAGE` | `co-workspace-runtime:latest` | Runtime image for docker isolation (the gateway image also qualifies — it carries hermes) |
| `CO_WORKSPACE_DOCKER_BIN` | `docker` | Docker CLI used for isolation spawns |
| `CO_WORKSPACE_CONTAINER_MEMORY` / `CO_WORKSPACE_CONTAINER_CPUS` / `CO_WORKSPACE_CONTAINER_PIDS_LIMIT` | `2g` / `2` / `256` | Resource caps for isolated turns |
| `CO_WORKSPACE_RUNTIME` | `hermes` | `hermes` / `antigravity` (agy) / `claude` / `codex` |
| `CO_WORKSPACE_ADMIN_EMAIL` | — | Bootstrap admin account (created at startup) |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_REDIRECT_URI` | — | Google SSO |
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
CO_WORKSPACE_HERMES_SEED_HOME=/Users/you/.hermes
CO_WORKSPACE_ISOLATION=docker
# Docker isolation needs the socket override (host-root equivalent — see Security model):
COMPOSE_FILE=docker-compose.yml:docker-compose.isolation.yml
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
  (`/var/run/docker.sock`) is NOT mounted by default: docker isolation requires the
  `docker/docker-compose.isolation.yml` override, enabled via `COMPOSE_FILE` in `.env`
  or `docker compose -f docker-compose.yml -f docker-compose.isolation.yml ...`.
- Provisioning scaffolds into the clone's `Projects/` and relocates the team immediately;
  docker-isolated turns run as the unprivileged runtime user (10000) and the team tree is
  chowned to it at provisioning.

## Security model

- **Identity** — per-user accounts (login ID + password, optional Google SSO) with
  sessions stored hashed. `key:label` file entries map API keys to trusted principals.
  `/auth/*` is intentionally reachable without an API key; every other route demands a
  key or a session, and admin routes demand the admin role.
- **Authorization** — tenant reads/writes/deletes are owner-or-admin (`requireTenantAccess`);
  `?mine=1` is session-aware; keyless mutating requests require the CSRF header.
- **Isolation** — docker mode runs each turn in an ephemeral sibling (memory/cpus/pids
  caps, `no-new-privileges`, `cap-drop ALL`, non-root runtime user) mounting only that
  team's project dir and Hermes home. Process mode (default in bare-metal quickstarts)
  shares the gateway container's filesystem — fine for a trusted single operator only.
- **PII** — raw emails live ≤24 h in a pending-verification row and are then dropped;
  accounts keep only a SHA-256 email hash. Admins can rename users but cannot read or
  set their email.
- **Docker socket** — `CO_WORKSPACE_ISOLATION=docker` needs `/var/run/docker.sock` mounted
  into the gateway, which is host-root equivalent; it is only mounted when the isolation
  override is included, and is meant for single-operator deployments. Running the gateway
  as non-root and fronting the socket with a socket proxy are NOT done yet (follow-up of
  T-20260929-005; needs live docker validation).
- **Known tradeoffs** (documented, by design): in docker mode each team's Hermes home is
  re-seeded with the operator's CURRENT `auth.json` every turn — one login covers all
  teams, and the copy is readable by the isolated turn (process mode instead binds the
  shared token store; team-scoped token separation is future work). The dev mailer
  writes verification mails to a local outbox instead of SMTP. Rate limiters are
  in-memory; session-authenticated mutations rely on SameSite=Lax (the CSRF header
  guards keyless requests).

Known limits: provisioning is asynchronous; usage is metered but not billed; multi-team
per variant (beyond one per user) is future work. History: Phase 2 hardening design
`docs/designs/2026-09-27-co-workspace-phase2-hardening-design.md`, usability wave
`docs/designs/2026-09-28-co-workspace-usability-wave-design.md`.
