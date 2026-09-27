# AGENTS.md — services/team-gateway

> Component instructions for AI tools working in this directory. Workspace-wide rules live in
> the repository root `AGENTS.md`; governance record: ADR-0092, design:
> `docs/designs/2026-09-27-team-gateway-service-design.md`.

## What this is

Team Gateway serves the workspace's variant agent teams (`templates/co-*`) over an
OpenAI-compatible web API. On request it scaffolds a tenant project with
`scripts/new-project.ts --platform hermes`, relocates it into the data directory, and runs
headless Hermes sessions (`hermes chat -q --format stream-json`) inside it. Phase 0 is a
local-only PoC: loopback bind, no authentication, single process.

## Layout

| Path | Purpose |
|---|---|
| `src/config.ts` | Three-tier config; infrastructure tier reads `TEAM_GATEWAY_*` env vars |
| `src/scaffold.ts` | Subprocess bridge to `scripts/new-project.ts` (no import API exists) |
| `src/tenant.ts` | Tenant registry (`<dataDir>/tenants/registry.json`), per-tenant `HERMES_HOME` seeding |
| `src/hermes.ts` | Session spawn, stream-json (JSONL) parsing, `--usage-file` accounting |
| `src/openai.ts` | OpenAI wire translation (models list, chat completions, SSE chunks) |
| `src/anthropic.ts` | Anthropic Messages wire translation (`/v1/messages`, event frames, count_tokens stub) |
| `src/server.ts` | Routing, native REST + `/v1` endpoints, per-tenant chat serialization |
| `web/index.html` | Single-file demo chat page (dev aid, not the product surface) |
| `docker/` | Dockerfile + compose (build context is the workspace root) |
| `data/` | Runtime data (gitignored): tenants, projects, Hermes homes, usage reports |

## Invariants

- Do not import from `scripts/` — the scaffold engine is invoked as a subprocess only.
- One `HERMES_HOME` per tenant; never share a home across concurrent tenants (per-home SQLite).
- `skills.trusted_project_dirs` in a generated tenant `config.yaml` names only that tenant's
  project directory (ADR-0088 D7 posture). Never widen it.
- `--usage-file` does not reach `chat` runs (top-level `-z` feature, live-verified): token
  accounting comes from the terminal `result` envelope.
- Secrets (seeded `auth.json` / `.env`) never appear in API responses or logs.
- Zero new runtime npm dependencies; bun built-ins only.

## Commands

```sh
bun install          # dev deps for typecheck (typescript, @types/bun)
bun run dev          # start on 127.0.0.1:8787 (config via TEAM_GATEWAY_* env)
bun run typecheck    # tsc --noEmit over src/
```

Unit tests live in the workspace suite: `bun test tests/unit/team-gateway-*.test.ts`
(fake scaffold + fake Hermes binaries; no network, no LLM calls).
