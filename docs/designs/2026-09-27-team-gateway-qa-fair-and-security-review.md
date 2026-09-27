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

## Deferred backlog (prioritized)

| ID | Source | Item | Why deferred |
|---|---|---|---|
| SEC-05 | Security | Rate limiting (`/auth/*`, `POST /sessions`), per-principal tenant/pending caps, global spend budget | Needs a limiter design (in-memory vs SQLite) — next hardening wave |
| SEC-09 | Security | CSRF header requirement in the keyless mode | Phase 0 is loopback-only (accepted posture); breaks many test fixtures — bundle with the limiter |
| SEC-10 | Security | Container hardening (`--memory/--cpus/--pids-limit/--network none/no-new-privileges`), narrow `/seed` mount | Phase 2 isolation roadmap item |
| SEC-12 | Security | Append-only audit log (auth events, admin actions, deletes) | Schema + retention design needed |
| SEC-07 | Security | Shared credential store least-privilege (token broker / RO mount + refresh channel) | Upstream Hermes capability dependent |
| SEC-14 | Security | Outbox expiry + token-in-body-only when SMTP lands | Mailer is dev-grade by design |
| QA-07 (P2) | Reliability | Cancel a running turn (`POST /tenants/:id/cancel` + Stop button) | Needs child-process plumbing through the chat lock |
| QA-09 (P2) | Product | Resume replays prior turns into the chat pane | UX polish; data already in `turns` |
| QA-10 (P2) | Performance | `dirSize` async/cached (admin stats walk is synchronous) | Admin-only; single-user Phase 0 impact low |
| QA-12 (P3) | Product | Admin outbox viewer (`GET /admin/mail-outbox`) for remote signups | Pairs with the SMTP wave |
| QA-13 (P3) | Product | Per-session usage/quota meter in the UI | Data exists in `publicTenant.usage` |
| QA-14 (P3) | Performance | History tab client cache + `?limit=` | Minor payload cost |

## Verification

- 97 tests green across nine gateway suites; typecheck clean; audit all-pass
- Security review evidence: file:line citations in the agent transcript (session 2026-09-27)
