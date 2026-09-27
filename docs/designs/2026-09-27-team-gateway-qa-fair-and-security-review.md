# Team Gateway (co-workspace) — QA Quality Fair & Security Review Backlog

- **Date**: 2026-09-27
- **Status**: Implemented (Wave 1) + Backlog (deferred items below)
- **Origin**: user-requested QA fair (4 reviewers) + co-security PM security assessment; consolidated by PM
- **Related**: ADR-0092 (Addendum 4/5), spec `2026-09-27-team-gateway-phase2-hardening`

## Implemented this round (17 items)

| ID | Source | Fix |
|---|---|---|
| QA-01 (P1) | UX | Demo module script crashed on load (TS annotations, duplicate `me`, dead `variantSel` refs) — stripped/rebuilt; this was the root cause of the broken-UI reports |
| QA-02 (P1) | UX | Streamed replies were invisible (bubble removed on first delta) — bubble now stays and fills |
| QA-03 (P1) | Reliability | claude/codex runtimes lost continuity (conversationId never persisted) + codex output-token mis-map — persisted for all runtimes; mapping fixed |
| QA-04 (P2) | Reliability | Restart-orphaned "provisioning" tenants stranded forever — startup sweep marks them failed |
| QA-05 (P2) | Reliability | DELETE raced an active turn + leaked chat-lock/turn rows — lock awaited, rows purged |
| QA-06 (P2) | UX | Stored XSS via unescaped innerHTML (file names, admin table, auth name, profile value) — `esc()` everywhere |
| SEC-01 (HIGH) | Security | Cross-tenant IDOR — `requireTenantAccess` (owner/admin/open-mode-anonymous) on all tenant-scoped routes; `/tenants` list default-filtered |
| SEC-02 (HIGH) | Security | Client-controlled `user` field hijacked other users' lazy tenants — identity now bound to the authenticated principal |
| SEC-03 (HIGH) | Security | `/admin/reload` had no admin gate — admin session required |
| SEC-04 (HIGH) | Security | Stored XSS (same as QA-06) |
| SEC-06 (MED) | Security | Session cookie `Secure` when login-required; password change rotates sessions |
| SEC-08 (MED-LOW) | Security | `/health` no longer discloses dataDir/hermesBin paths |
| SEC-11 (LOW) | Security | Scaffold `description` leading-dash argv injection stripped |
| SEC-13 (LOW) | Security | `bootstrapAdmin` wired at startup via `CO_WORKSPACE_ADMIN_EMAIL` (was dead code) |
| QA-08 (P2) | Reliability | Spawned runtimes inherit an allowlisted env (PATH/HOME/HERMES_/ANTHROPIC_/OPENAI_/GOOGLE_…) — never the full gateway env with operator secrets |
| QA-11 (P2) | Performance | SSE heartbeat (`: ping` every 15s) on all four streaming surfaces |
| C-fix | Reliability | codex `output` token mis-mapping corrected |

## Backlog disposition (2026-09-27, second wave — 11 of 12 implemented)

Implemented in this wave: **SEC-05** (in-memory fixed-window rate limiter on `/auth/login|signup|resend` + per-principal tenant cap `CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL`), **SEC-09** (`CO_WORKSPACE_CSRF_REQUIRED=true` — keyless mutating routes require the `x-requested-with` header; compose default on), **SEC-10** (docker isolation resource caps + `no-new-privileges` + `cap-drop ALL`, configurable via `CO_WORKSPACE_CONTAINER_*`), **SEC-12** (append-only SQLite audit log + `GET /admin/audit`; login success/failure, tenant create/delete, key reload, admin actions recorded), **SEC-14** (outbox sweep at startup, 24h expiry), **QA-07** (`POST /tenants/:id/cancel` + Stop button, per-tenant active-process tracking), **QA-09** (resume replays the last 10 turns from the history store), **QA-10** (`dirSize` async via fs/promises), **QA-12** (`GET /admin/mail-outbox` viewer for remote signups), **QA-13** (session rows show input→output tokens), **QA-14** (history tab caches per tenant, refetches only when the turn count changes).

**SEC-05 remnant closed (2026-09-27, same day)**: per-principal lifetime token budget across tenants (`CO_WORKSPACE_PRINCIPAL_MAX_TOKENS`) — enforced on all four chat surfaces before the turn runs; aggregate usage + remaining budget exposed via `/auth/me`.

Still deferred:

| ID | Source | Item | Why deferred |
|---|---|---|---|
| SEC-07 | Security | Shared credential store least-privilege (token broker / RO mount + refresh channel) | Upstream Hermes capability dependent |

## Verification

- 97 tests green across nine gateway suites; typecheck clean; audit all-pass
- Security review evidence: file:line citations in the agent transcript (session 2026-09-27)
