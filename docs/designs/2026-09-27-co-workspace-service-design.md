# Team Gateway Service Design — Serving Variant Agent Teams over OpenAI-, Anthropic-, and Gemini-Compatible Web APIs

> **SUPERSEDED IN PART — pre-rebrand record (2026-10-03 review H6).** This is the founding
> design, written before the service was renamed. Current names: `services/co-workspace/`
> with the `CO_WORKSPACE_*` env prefix (nothing reads `TEAM_GATEWAY_*`); the `auth.json`
> seeding mechanism described here was replaced by the shared-store/provider-key models
> (ADR-0092 Addenda 2/4/8-10); Phase 0's no-auth posture was superseded by the Phase 2
> hardening design. The supersession ledger lives in ADR-0092 — read this document as
> the historical proposal, not the operating spec.

- **Spec id**: `2026-09-27-co-workspace-service-design`
- **Date**: 2026-09-27
- **Status**: Implemented (superseded in part — see the banner above and ADR-0092)
- **Related**: ADR-0092 (this design's decision record), ADR-0074 (Universal Design Gate), ADR-0088 (Hermes Agent platform support), ADR-0089 (template auto-release cadence), ADR-0078 (LLM work routing — see §2 N7), T-20260927-019 (upstream scaffold-pinning defect)
- **Scope**: Design + Phase 0 implementation of `services/team-gateway/` — a bun HTTP server with a scaffold bridge, a Hermes session bridge, OpenAI-, Anthropic-, and Gemini-compatible APIs, Docker packaging, and a single-file demo page, with unit tests. Phase 1 (multi-variant catalog at scale, per-conversation mapping) and Phase 2 (multi-tenant hardening) are roadmap-only (§10).

---

## 1. Background

The workspace maintains 14 variant team templates (`templates/co-*`): multi-agent consulting/engineering teams (PM gateway, specialist agents, skills) executed by CLI harnesses. They have no HTTP surface, so web clients cannot reach them. Three workspace facts make a generic bridge feasible without touching any template:

1. **Unattended scaffolding exists.** `bun scripts/new-project.ts <name> --variant <co-*> --platform hermes --yes` scaffolds a self-contained project non-interactively (`scripts/new-project.ts:144`, platform profile at `:1010-1019`), with template pinning via `--version X.Y.Z` (git tag `template-vX.Y.Z`, `:320-334`). It has no importable API — subprocess is the sanctioned boundary (precedent: `scripts/test-new-project.ts:278`).
2. **Hermes has a machine-readable headless session protocol.** `hermes chat --format stream-json` emits newline-delimited JSON events (`init` carrying `session_id`, text deltas, `tool_use`, terminal `result`), supports per-container config isolation (`HERMES_HOME`), project-skill trust (`skills.trusted_project_dirs` in the tenant's `config.yaml`), and run ceilings (`--run-budget`, `--max-turns`). This is the runtime that ADR-0088 already integrated into scaffolds (`.hermes/skills` mirror).
3. **Template versions are releasable artifacts.** `templates/VERSION` + `template-v*` tags + the nightly auto-release pipeline (ADR-0089) give the service a deterministic pinning contract.

The immediate consumers are Open WebUI (OpenAI wire) and Anthropic Messages-API clients (Anthropic wire): the service exposes each variant as a "model", which completes the previously deferred Open WebUI integration question without a per-project shim.

## 2. Goals / Non-Goals

**Goals**

- G1: A single bun HTTP service that serves variant teams over OpenAI-compatible (`/v1/chat/completions`), Anthropic-compatible (`/v1/messages`), and Gemini-compatible (`:generateContent`/`:streamGenerateContent`) wire surfaces with SSE streaming.
- G2: On-request tenant provisioning: scaffold from `templates/<variant>` with `--platform hermes`, relocate to the data directory, isolate a per-tenant `HERMES_HOME`, and trust only the tenant project directory.
- G3: Stateful sessions via `hermes chat --format stream-json` with deterministic named threads, translated to OpenAI chunks and Anthropic events on the wire.
- G4: Three-tier configuration: infrastructure via env vars, tenant parameters injected at scaffold time, secrets seeded into tenant `HERMES_HOME` and never returned by the API.
- G5: Per-turn token accounting captured from the terminal `result` envelope and surfaced in the native `done` event, the OpenAI usage block, and the Anthropic usage fields. (Live verification found `--usage-file` does not propagate to `chat` runs — it is a top-level `-z`-mode feature — so cost estimates are out of Phase 0 scope; see D3.)
- G6: Runs bare-metal (`bun run dev`) for the PoC and ships a Dockerfile/compose for packaging.

**Non-Goals**

- N1: No authentication/authorization in Phase 0 — the server binds `127.0.0.1` by default and is labeled local-only. Phase 2.
- N2: No per-tenant container isolation in Phase 0 — one container, per-tenant `HERMES_HOME` as the only runtime boundary. Phase 2.
- N3: No per-conversation session mapping — one named Hermes thread per tenant (which is per variant × client `user`). Multiple simultaneous conversations on one variant share the thread. Phase 1.
- N4: No template changes — the service consumes `templates/` read-only. No agent, skill, or script content changes.
- N5: No quota/billing enforcement — token usage is recorded (G5), not enforced. Phase 2.
- N6: Not shipped to scaffolded projects — L0-only platform component (same posture as `scripts/mcp-governance-server.ts`, D3 of its design).
- N7: Not an LLM work-routing path into this repository (ADR-0078) — tenant sessions work inside their own tenant project instance; repository-landing work still routes through the workspace PM Gateway.

## 3. Service Surface

| Method | Path | Purpose | Notes |
|---|---|---|---|
| GET | `/` | Single-file demo chat page | dev aid, not the product surface |
| GET | `/health` | Liveness + config summary | never echoes secrets |
| GET | `/v1/models` | Variant catalog as OpenAI model list | `TEAM_GATEWAY_VARIANTS` allowlist |
| POST | `/v1/chat/completions` | OpenAI wire format; `model` = variant | `stream:true` → SSE chunks; `stream:false` → single completion |
| POST | `/v1/messages` | Anthropic Messages wire; `model` = variant | `stream:true` → `message_start`/`content_block_*`/`message_delta`/`message_stop` frames; `system` ignored (the tenant team defines its own instructions), `max_tokens` accepted but enforced via Hermes ceilings |
| POST | `/v1/messages/count_tokens` | Rough chars/4 estimate stub | keeps tokenizer-dependent clients from hard-failing |
| POST | `/v1beta/models/{model}:generateContent` / `:streamGenerateContent` | Gemini wire (Antigravity/Gemini ecosystem); `alt=sse` for streaming | `systemInstruction` ignored; terminal chunk carries `finishReason: STOP` + `usageMetadata` |
| POST | `/v1beta/models/{model}:countTokens` | Rough chars/4 estimate stub | Gemini ecosystem equivalent |
| GET | `/v1beta/models` | Variant catalog as Gemini model list | `models/<variant>` names |
| POST | `/sessions` | Provision a tenant `{variant, name?, description?, country?}` | `202 {tenantId, status}`; async |
| GET | `/tenants` / `/tenants/:id` | Registry listing / detail | status: `provisioning/ready/failed` |
| POST | `/tenants/:id/chat` | Native chat `{message}` → SSE event stream | raw Hermes events + `done` summary |

OpenAI mapping: `model` identifies the variant; the tenant key is `(variant, user)` with `user` falling back to `"default"` when absent (`metadata.user_id` on the Anthropic wire); a missing tenant is provisioned lazily; conversation continuity uses a deterministic named Hermes thread per tenant (`--continue gw-<tenantId> --create-if-missing`).

## 4. Design Decisions

- **D1 — Code placement: new `services/team-gateway/` (L0).** The service spans server code, Docker assets, and a web page; housing it in `scripts/` would drag Docker/web assets into the L0 tooling surface (SCRIPTS.md registry, tsc zero-error baseline). The directory is self-governing (own `AGENTS.md`) and added to `docs/workspace-schema.json` `rootAllowlist.dirs`. Not shipped to scaffolds.
- **D2 — One bun server, four wire surfaces.** Native REST for programmatic control; OpenAI-compatible `/v1` so standard chat clients (Open WebUI, curl, SDKs) attach with zero custom code; Anthropic-compatible `/v1/messages` so Messages-API clients (Anthropic SDKs, `ANTHROPIC_BASE_URL`-style tooling) attach the same way; Gemini-compatible `/v1beta/models/{model}:generateContent` (plus `streamGenerateContent?alt=sse`, `countTokens` stub, models list) for the Antigravity/Gemini ecosystem — Antigravity itself exposes no public model-serving API spec (its extension surface is MCP), so the ecosystem-standard Gemini contract is what is served, labeled as such. Zero new npm dependencies: `Bun.serve` + hand-rolled SSE/JSONL handling, matching the workspace's dependency posture.
- **D3 — Session runtime: `hermes chat --format stream-json`, not `-z`.** `-z` prints final text only, hides the session id, and auto-bypasses approvals; `chat --format stream-json` gives the JSONL protocol (session id in `init`/`result`, tool visibility) plus `--run-budget`/`--max-turns` ceilings. The query travels via `--query-file -` (stdin; `-q` takes a value and cannot be combined). Live verification (2026-09-27 smoke): `--usage-file` is parsed only at the top level and does not reach `chat` runs, so token accounting comes from the `result` envelope. Unattended approval posture: pre-mined allowlists (`hermes approvals`), `HERMES_ACCEPT_HOOKS=1` for hooks, tenant-scoped toolsets; validated live — non-TTY chat runs unattended without approval prompts under this posture.
- **D4 — Provisioning via subprocess + relocate.** `new-project.ts` rejects destinations outside the workspace clone (`:291-312`) and has no import API; the service spawns it in `TEAM_GATEWAY_WORKSPACE_DIR`, then moves the finished project (a self-contained git repo) to `<DATA_DIR>/tenants/<id>/project`. Template upgrades later use `upgrade-project.ts <absolute-path>` which accepts relocated projects.
- **D5 — Three-tier configuration.** Infra env: `TEAM_GATEWAY_PORT/DATA_DIR/WORKSPACE_DIR/VARIANTS/TEMPLATE_VERSION`, `HERMES_BIN`, `TEAM_GATEWAY_HERMES_MODEL` (stamped into each tenant `config.yaml` as `model.default` — live verification showed tenant homes without a model block resolve to the paid default and fail on credit-less portals), provider pass-through (`HERMES_INFERENCE_MODEL/PROVIDER`). Tenant-injected: variant, description, country at scaffold. Secrets: a seed home (`TEAM_GATEWAY_HERMES_SEED_HOME`, e.g. the operator's `~/.hermes`) has its `auth.json`/`.env` copied into each tenant `HERMES_HOME` at provision; the operator's `config.yaml` is never copied — the tenant gets a generated one (trust keys + optional model block). Secrets are never echoed by any endpoint or log line.
- **D6 — Phase 0 security posture, stated honestly.** Loopback bind, no auth, single container, filesystem boundary = data dir; per-tenant `HERMES_HOME` (never share one home across concurrent tenants — per-home SQLite WAL `state.db`); `skills.trusted_project_dirs` scoped to the tenant project dir only (carries ADR-0088 D7's prompt-injection defense into the service); run ceilings on every spawn. Phase 2 hardening list in §10.
- **D7 — Continuity via named threads.** Every tenant turn runs `--continue gw-<tenantId> --create-if-missing` — deterministic "send to this thread, making it if needed" semantics. Live verification found `--resume latest` unusable here: the MRU lookup only covers the CLI source family (`run_agent.CLI_FAMILY_SOURCES = {cli, oneshot}`) and silently skips sessions created under other `--source` values; named threads avoid the MRU path entirely, so `--source tool` is dropped too (per-tenant homes make session visibility a non-issue). One thread per tenant is the documented Phase 0 limitation.
- **D8 — Template pinning.** `TEAM_GATEWAY_TEMPLATE_VERSION` → `new-project.ts --version` → tag `template-vX.Y.Z`; unset tracks `templates/VERSION` HEAD. Deployment guidance: pin to the latest release tag and rebuild the image on template releases (ADR-0089 cadence). Upstream defect (2026-09-27 smoke): the pinned path currently fails on main — `getValidVariants` invokes `git archive <tag> --list`, which git rejects ("extra command line parameter"); ticketed as T-20260927-019, and the flag is treated as unavailable until upstream fixes it (unpinned scaffolds are unaffected; live smoke ran unpinned).

## 5. Architecture

```
client (Open WebUI / Anthropic SDK / curl / demo page)
   │  OpenAI wire (SSE)      Anthropic wire (SSE)      native REST (SSE)
   ▼                              ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│ services/team-gateway  (bun, single process)                 │
│  server.ts   routing, SSE plumbing                           │
│  openai.ts   OpenAI wire translation (chunks ↔ JSONL)        │
│  anthropic.ts Anthropic wire translation (events ↔ JSONL)    │
│  tenant.ts   registry, HERMES_HOME seeding                   │
│  scaffold.ts new-project.ts subprocess bridge                │
│  hermes.ts   session spawn, JSONL parser                     │
└───────┬──────────────────────────┬───────────────────────────┘
        │ spawn (subprocess)       │ spawn (subprocess)
        ▼                          ▼
 bun scripts/new-project.ts   hermes chat --format stream-json
 (TEAM_GATEWAY_WORKSPACE_DIR) (HERMES_HOME=<tenant home>, --in <tenant project>,
        │                      --continue gw-<tenantId> --create-if-missing)
        ▼
 <DATA_DIR>/tenants/<id>/project + registry.json + token accounting
```

Provisioning is asynchronous: `POST /sessions` returns `202` and the scaffold completes in the background; chat on a non-`ready` tenant returns `409`. Per-tenant chat is serialized in-process (one Hermes session writer per `HERMES_HOME`).

## 6. Implementation Waves

| Wave | Content |
|---|---|
| W1 | This design doc + ADR-0092 + `spec-register.ts` registration |
| W2 | `services/team-gateway` skeleton: `src/{server,tenant,scaffold,config,util}.ts`, native REST, demo assets dir, unit tests |
| W3 | `src/hermes.ts` (spawn + JSONL parser + token accounting), `src/openai.ts` (`/v1` OpenAI endpoints, chunk translation), `src/anthropic.ts` (`/v1/messages` event frames, count_tokens stub) + unit tests (Hermes invoked via a canned-JSONL fake binary) |
| W4 | `docker/{Dockerfile,docker-compose.yml}`, `web/index.html` demo page, README runbook (incl. Open WebUI + Anthropic client connection), rootAllowlist += `services`, CHANGELOG |
| W5 | Full test + typecheck + audit gates; local smoke (provision → multi-turn chat round-trips on both wire surfaces against the live Hermes CLI); `/sync` PR |

## 7. Verification Plan

1. `bun test tests/unit/co-workspace-server.test.ts tests/unit/co-workspace-jsonl.test.ts tests/unit/co-workspace-tenant.test.ts tests/unit/co-workspace-anthropic.test.ts` — routing, JSONL parsing/translation, registry + config seeding against temp dirs; Hermes and scaffold invoked through configurable binaries faked in tests.
2. `bun scripts/audit.ts` — root allowlist gate (with `services/` registered) and spec-check green.
3. Service typecheck: `bun run typecheck` inside `services/team-gateway/`.
4. Local smoke (live, executed 2026-09-27): start the server with `TEAM_GATEWAY_DATA_DIR` pointed at a scratch dir; `GET /health`; `POST /sessions {variant: co-consult}` → `ready`; assert the relocated project contains `.hermes/skills` (55 skills), `AGENTS.md`, and a seeded `HERMES_HOME` (`auth.json`/`.env` copied, generated `config.yaml` trusting only the tenant dir); `GET /v1/models`; native chat turn 1 answered via the live LLM (exit 0, session id captured, tokens recorded); native turn 2 verified named-thread continuity (same session id, memory of turn 1, cache-reuse on input tokens); `POST /v1/chat/completions` (`stream:false`) returned a proper completion with mapped usage; the Anthropic surface was verified live on the same tenant (`/v1/messages` streaming emitted the full six-event frame sequence; a remember-then-recall probe on one `metadata.user_id` key answered "77" across turns, sessions counter incremented per turn). The live LLM leg used the operator's local Hermes credentials; no secrets entered the repo.
5. `bun run test:unit` — full unit suite green (excluding guardrails mid-flight from unrelated concurrent work in the same tree).

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Unattended `chat` approval prompts break sessions | Live-verified unattended posture (allowlist + `HERMES_ACCEPT_HOOKS=1`); documented fallback to `-z` + `--usage-file` (D3) |
| Hermes stream-JSON event shape drifts across versions | Parser is defensive (unknown event types pass through raw on the native endpoint, ignored by the wire translators); Hermes version pinned per deployment; parser validated against installed CLI source and live runs in W5 |
| Shared SQLite `state.db` corruption across tenants | One `HERMES_HOME` per tenant (D5/D6); in-process per-tenant serialization |
| Scaffold latency (minutes) blocks requests | Async provisioning (`202` + registry polling, §5); generous subprocess timeout; observed ~10–20 s per tenant in the live smoke |
| Prompt injection steers a tenant session | Trust list scoped to the tenant dir; run ceilings; Phase 0 mounts only the workspace clone (provisioning destination) + data volume; Phase 2 bakes a pinned workspace and adds an egress firewall (`hermes egress`) |
| Template drift breaks provisioning | `TEAM_GATEWAY_TEMPLATE_VERSION` pinning (D8) — currently blocked upstream (T-20260927-019); unpinned mode unaffected |
| MRU resume misses sessions created outside the CLI source family | Deterministic named threads (`--continue NAME --create-if-missing`) replace `--resume latest` (D7, live-verified) |
| Secret leakage via env/inspect in Phase 0 | Secrets live in tenant homes, never in API responses/logs; Phase 2 replaces env seeding with a secret manager |

## 9. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: exempt — the product surface is an HTTP API (backend service; ADR-0074's API-server class). The `web/index.html` demo page is a dev aid built with semantic HTML (labeled inputs, buttons); it is excluded from the product a11y audit scope, which applies when a product UI exists (Phase 2).
- **Preview Verification (ADR-0070)**: exempt — no shipped rendered UI artifact; verification is API/test-based (§7).

## 10. Roadmap (informational)

- **Phase 1**: multi-variant catalog at scale; per-conversation session mapping (named threads per conversation, surfaced through the OpenAI/Anthropic surfaces); async provisioning progress events.
- **Phase 2 hardening**: authentication/authorization; per-tenant containers or equivalent OS-level sandboxing; network egress policy (`hermes egress`); quotas and billing on the recorded usage; audit logging; secret manager integration; product-grade web UI with full a11y/preview verification.

## 11. References

- ADR-0092 (decision record for this service), ADR-0088 (Hermes platform support — `.hermes/skills` mirror, trust posture), ADR-0089 (template auto-release), ADR-0074 (Design Gate), T-20260927-019 (pinned-scaffold defect)
- `scripts/new-project.ts` (unattended scaffold, platform profiles, version pinning, destination constraints), `scripts/tag-template.ts`, `scripts/list-template-versions.ts`
- Hermes CLI (installed v0.21.x): `hermes chat --help` (`--format stream-json`, `--query-file`, `--run-budget`, `--continue`/`--create-if-missing`), `hermes --help` (`HERMES_HOME`, `--usage-file` top-level scope), `hermes skills trust`, `~/.hermes/config.yaml` `skills.trusted_project_dirs`, `run_agent.CLI_FAMILY_SOURCES` (named-thread rationale)
- `docs/designs/2026-09-25-mcp-governance-server-design.md` (workspace-root server component precedent), `docs/workspace-schema.json` (rootAllowlist)
