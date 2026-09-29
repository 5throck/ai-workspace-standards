# Project Review — co-workspace service — 2026-09-29
**Date**: 2026-09-29
**Scope**: `services/co-workspace` (ADR-0092), workspace root
**Method**: scoped (3 parallel read-only agents: architecture, security, automation+docs) + machine battery
> Analysis only — no files modified in this report.

## Baseline

`bun scripts/review-baseline.ts`: 6/6 green (audit, validate-templates, verify-scripts, agent-lifecycle-audit, skill-lifecycle-audit, drift check: tolerated 6 / unexpected 0).
Service checks (reported by the automation agent): `tsc --noEmit` clean; `bun test tests/unit/co-workspace-*.test.ts` 126 pass / 0 fail.

Verification note: findings marked **[verified]** were re-read by the PM in source. Others are agent-reported.

## 🔴 Critical

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| C1 | Cross-tenant IDOR: `POST /v1/messages` keys the tenant on client-supplied `metadata.user_id`, the same key `/sessions` derives from the caller principal; no `requireTenantAccess`. **[verified]** | Security | `src/server.ts:1029-1039`, `src/anthropic.ts:56-57`, `src/server.ts:248-256,909` | systemic | Derive key from `callerPrincipal` only; call `requireTenantAccess` after lookup |
| C2 | `POST /v1/chat/completions` falls back to client `user` when no principal resolves; lazy tenants created without owner. **[verified]** | Security | `src/server.ts:1017-1021,261` | systemic | Key and owner from `callerPrincipal`; never from request body |
| C3 | Gateway container mounts `/var/run/docker.sock` unconditionally and runs `USER root` (host-root equivalent). **[verified]** | Security, Automation | `docker/docker-compose.yml:104`, `docker/Dockerfile:15` | one-time | Move socket to a docker-isolation override, add a socket proxy, drop to non-root |
| C4 | Provider API key stamped in plaintext into each tenant `config.yaml` (agent-readable in docker mode); redundant with env injection; no YAML escaping; docs claim "never lands on disk". | Security, Automation | `src/tenant.ts:136-139`, `src/server.ts:337-350`, design `2026-09-29-co-workspace-provider-key-config-design.md:42-43`, `AGENTS.md:39` | systemic | Prefer env-only; if file stamping is required, document the trade-off (Addendum 9), escape via YAML lib, deny in files API |

## 🟡 High

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | Tenant DELETE removes turns and registry row **before** the path-escape guard; a tampered record 500s but is already unrecoverable. **[verified]** | Architecture | `src/server.ts:965-975` | one-time | Get, validate, remove files, then delete row (shared `deleteTenantData`) |
| H2 | Admin user delete (`tenants=delete`) runs `rmSync` on `projectDir`/`hermesHome` with no validation, no lock/provisioning wait, no audit, no proc kill; diverged copy of H1. **[verified]** | Architecture | `src/server.ts:1403-1414` | systemic | Reuse a single delete implementation; add test/lint against duplicates |
| H3 | SSE streams have no cancel/abort; client disconnect leaves turn running under `chatLocks`; enqueue/close can throw. | Architecture | `src/server.ts:527-650` | systemic | AbortSignal through `runChat`/adapters; safe enqueue helper |
| H4 | Provisioning progress `setInterval` not cleared on rejection. | Architecture | `src/server.ts:616-630` | one-time | `try/finally clearInterval` |
| H5 | Spawn env allowlist prefix `GOOGLE_` leaks `GOOGLE_CLIENT_SECRET` to agent processes. | Security | `src/hermes.ts` (`ENV_ALLOW_PREFIX`) | script-gap | Exact-name allowlist; test that no gateway secret survives `allowlistedEnv` |
| H6 | Provider key passed as `-e NAME=value` on docker argv (visible in `ps`/`docker inspect`). | Security | `src/hermes.ts:151` | one-time | `-e NAME` (inherit) or 0600 `--env-file` |
| H7 | Rate limiting trusts `X-Forwarded-For` unconditionally. | Security | `src/server.ts:801,1181,1196` | systemic | Trusted-proxy setting; else socket IP; per-loginId limit |
| H8 | SSO auto-links to existing account by email even if local email unverified. | Security | `src/server.ts:1297-1307` | one-time | Link only when local email verified |
| H9 | ADR-0092 body still describes `services/team-gateway`, `TEAM_GATEWAY_*`, Phase 0 no-auth; broken design link. | Docs | `docs/adr/0092-co-workspace-service.md:6,15`, design `:7` | one-time | Add supersession notes; fix link |
| H10 | ADR/design stale vs code: `zai` provider, per-provider env names, `model.provider` stamping, reasoning-effort var. | Docs | ADR Addendum 8 (`:79`), design R2/R6 | systemic | Addendum 9; update design |
| H11 | `.env.sample` says empty omits reasoning effort, compose `:-low` forces `low`; server falls back to `"low"` (nullish default) regardless of mode. | Docs | `docker/.env.sample:28`, `docker-compose.yml:69`, `src/server.ts:119,347` | one-time | Use `-` (no colon) or fix docs; align gates |
| H12 | Compose/sample omit variables `config.ts` reads (`COOKIE_SECURE`, `PRINCIPAL_MAX_TOKENS`, `SCAFFOLD_TIMEOUT_MS`, `DOCKER_BIN`, etc.). | Docs | `src/config.ts:159-232` | script-gap | Env-parity check script |
| H13 | README known-tradeoffs describe per-turn OAuth re-seed as universal; key mode skips it; quickstart leads with legacy path. | Docs | `README.md:74-77,131,152,228-231` | one-time | Document both modes + api_key note |

## 🟢 Moderate

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | SSO state/PKCE cookies joined into one `set-cookie` with ", " and lack `Secure`. | Security | `src/server.ts:1268-1316` | one-time | `Headers.append` per cookie |
| M2 | OAuth state compared with `!==`. | Security | `src/server.ts:1288` | one-time | `timingSafeEqual` |
| M3 | CSRF header guard skipped whenever a session cookie is present (SameSite=Lax only). | Security | `src/hardening.ts:74-78` | systemic | Exempt only Bearer/API-key |
| M4 | Session cookie not `Secure` by default; compose cannot set it. | Security | `src/users.ts:478-481` | one-time | Secure by default off-loopback; add env pass-through |
| M5 | File API denylist covers `.git` only; no `.env*`, `*.pem`, `config.yaml` patterns. | Security | `src/tenant-files.ts:29-32` | one-time | Pattern denylist |
| M6 | Whole Hermes seed home mounted read-only into gateway (SEC-07 accepted); visible to process-isolation agents. | Security | `docker-compose.yml` `/seed-home` | one-time | Minimal dir or docker-only isolation |
| M7 | Verification tokens in URL query; outbox plaintext. | Security | `src/server.ts` (~1200), `src/hardening.ts:81` | one-time | POST entry, 0600 files |
| M8 | Open mode makes anonymous tenants reachable (compose defaults login required). | Security | `src/server.ts:194-195` | one-time | Warn at startup |
| M9 | `activeProcs` leaked on error; `chatLocks` never pruned; DELETE waits unbounded lock. | Architecture | `src/server.ts:432,448,960-964` | one-time | `finally` cleanup; kill proc, timeout |
| M10 | Straggler sweep uses `startsWith(tenantId)`. | Architecture | `src/tenant.ts:23` | one-time | Match exact legacy shapes |
| M11 | Silent catches: corrupt `registry.json` ignored; key-file read errors return empty list. | Architecture | `src/registry-db.ts:~50`, `src/config.ts:~118` | script-gap | Log; distinguish ENOENT |
| M12 | `server.ts` 1546-line monolith (state, provisioning, four SSE surfaces, routes). | Architecture | `src/server.ts` | systemic | Split into routes/sse/chat/lifecycle |
| M13 | Startup recovery reaps only `provisioning` records, not orphan child processes. | Architecture | `src/server.ts:1524-1530` | one-time | Reap or document |
| M14 | Orphaned JSDoc / `numOr0` naming. | Architecture | `src/config.ts:~111,128` | one-time | Move comment |
| M15 | No `test` script; no direct tests for `google-sso`, `hardening`, `scaffold`, `tenant-files`, `util`; thin key-mode coverage. | Automation | `package.json:7-9`, `tests/unit/` | systemic | Add script and tests |
| M16 | Dockerfile unpinned images, no `bun.lock` copy, dev deps installed. | Automation | `docker/Dockerfile:13,27-31` | one-time | Pin, frozen lockfile |
| M17 | `build-runtime-image.sh` lacks rsync/image preflight and excludes no `.env`/`*.key`. | Automation | `docker/build-runtime-image.sh:12,23`, `Dockerfile.runtime:17` | script-gap | Preflight and excludes |
| M18 | Addendum reference wrong in compose comment (6 vs 7). | Docs | `docker-compose.yml:97` | one-time | Fix reference |
| M19 | `AGENTS.md` layout/posture stale (missing modules; "Phase 0 no auth"). | Docs | `AGENTS.md:12-29,49` | systemic | Refresh |
| M20 | Not registered in `services.yaml`; ADR claims allowlist entry not found. | Docs | `services.yaml:2-6` | one-time | Register or state intent |
| M21 | `docker/.env` holds a real key (gitignored, untracked). | Automation | `docker/.env` | one-time | Rotate if ever echoed |

## ℹ️ Low
- `tsconfig` does not type-check `web/app-helpers.js`.
- `.DS_Store` present locally (ignored).

## ✅ Strengths
- Typecheck clean; 126 offline unit tests pass; fake Hermes/scaffold binaries.
- Per-route tenant access checks on detail/delete/chat/files/history/cancel; `/tenants` filtered per principal.
- Constant-time API-key comparison; PKCE S256 + state on SSO; HttpOnly cookies; uniform resend response; web UI escapes consistently.
- Docker turns: `--cap-drop ALL`, `no-new-privileges`, non-root, resource limits; loopback-only port publish.
- Path-escape guard on tenant DELETE (only ordering wrong); restart recovery for provisioning; per-tenant chat serialization.
- Fail-fast config, `:?` compose guards, addendum-driven ADR recording real incidents; `.gitignore` covers data, `.env`, runtime staging.

## Not reviewed
`users.ts` internals (hashing, token entropy), provider adapters, `hermes.ts` beyond env/docker args, `Dockerfile.runtime` content, `/tenants/:id/chat` streaming path, admin delete-disposition beyond H2.

## Action wiring
No fixes applied this session; all Critical/High items deferred to tickets (fixes need the PM Gateway plan).

| Ticket | Covers |
|--------|--------|
| T-20260929-004 (urgent) | C1, C2 |
| T-20260929-005 | C3, M6 |
| T-20260929-006 | C4, H6 |
| T-20260929-007 | H1, H2, M9, M10 |
| T-20260929-008 | H3, H4 |
| T-20260929-009 | H5 (fix), H7 |
| T-20260929-010 | H9, H10, H11, H13, M18, M19 |
| T-20260929-011 (validator-hardening) | H12 |
| T-20260929-012 (validator-hardening) | H5 (ratchet) |

Unticketed (Moderate/Low, batch in a later cycle): H8, M1–M5, M7, M8, M11–M17, M20, M21.

## Verification

T-20260929-004 (C1, C2, plus the same pattern on the Gemini route at `server.ts` ~1491, missed in the review) fixed in-session: `resolveLazyTenant` in `services/co-workspace/src/server.ts` keys lazy tenants on the authenticated principal only and calls `requireTenantAccess`. New test `tests/unit/co-workspace-tenant-isolation.test.ts` (4 tests; fail against the old code).
- `tsc --noEmit`: clean
- `bun test tests/unit/co-workspace-*.test.ts`: 130 pass / 0 fail (was 126)
- `bun scripts/audit.ts`: all checks passed

Behavior change: the body `user` / `metadata.user_id` no longer selects a tenant (one tenant per principal per variant); tenants created earlier under `variant::<body user>` keys are no longer found.

New finding during the fix: `key:label` lines in the key file are kept whole in `cfg.apiKeys`, so labels never resolve (own ticket).
