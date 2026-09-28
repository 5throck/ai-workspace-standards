# Project Review — workspace root (co-workspace wave focus) — 2026-09-28
**Date**: 2026-09-28
**Scope**: workspace root, full mode — co-workspace wave (PRs #1164–#1187) focus
**Method**: machine battery + PM sequential review (4 parallel agent slots were attempted first; all failed on `user concurrency limit exceeded` — the skill's sequential fallback ran PM-led per-domain checks)
<!-- Analysis only — no files modified in this report. -->

## Baseline

`bun scripts/review-baseline.ts` — **6/6 green**:
audit PASS · validate-templates PASS · verify-scripts PASS · agent-lifecycle-audit PASS · skill-lifecycle-audit PASS · drift PASS (6 tolerated gemini-settings, 0 unexpected).

## Review Results — co-workspace wave & workspace root — 2026-09-28

### 🔴 Critical (fix immediately)

| # | Issue | Agent (domain) | File:Line | Class | Fix |
|---|-------|----------------|-----------|-------|-----|
| C1 | CI billing: GitHub Actions minutes/spending exhausted on private 5throck/co-* repos since 2026-09-25 — all private-repo CI fails instantly (runner=none), so wave PRs #1164+ merged WITHOUT running CI; local gates carried the load | PM (automation) | tickets/ T-20260927-016 | one-time (billing) | Raise the Actions limit or move the repo public; until then treat local test+tsc+audit as the mandatory pre-merge gate (already practiced) |

### 🟡 High (fix within 1 week)

| # | Issue | Agent (domain) | File:Line | Class | Fix |
|---|-------|----------------|-----------|-------|-----|
| H1 | Stale untracked test files `tests/unit/team-gateway-{anthropic,jsonl,server,tenant}.test.ts` import the deleted `services/team-gateway/src/*` path; any push hook run that sweeps tests/ into changed-path testing blocks the push (observed 3× today) | PM (automation) | tests/unit/team-gateway-*.test.ts | one-time | Archive to docs/ or delete after confirming with the owning (parallel) session |
| H2 | Wave promised follow-up tickets but none exist for: server-side user pagination (~150 users), CSRF credentialed-exemption tightening, `GET /tenants` metadata exposure, Secure-flag/TLS posture, artifacts-panel light theme | PM (standards) | docs/designs/2026-09-28-co-workspace-usability-wave-design.md:80 | systemic | Ticketed this session (see Action wiring: T-20260928-005..007) |
| H3 | Spec-registry status drift: `2026-09-28-co-workspace-usability-wave-design` still `status: approved` although the wave is fully implemented (design-doc header says Implemented, ADR-0092 Addendum 5 shipped) | PM (standards) | docs/specs/registry.json | one-time | `spec-register.ts --update` to `implemented` |
| H4 | Single-file UI reached 1,173 lines / server 1,466 lines — structural debt concentration; every wave collides in one file (parallel-session sweep conflicts today were aggravated by this) | PM (architecture) | services/co-workspace/web/index.html, src/server.ts | systemic | Plan a split (web: view modules via build-less ES modules; server: admin/auth/tenants routers) at the next feature wave, not a forced refactor now |

### 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent (domain) | File:Line | Class | Fix |
|---|-------|----------------|-----------|-------|-----|
| M1 | Temp-password entropy is modest: 8 chars from a 58-char alphabet (~45 bits) — acceptable for a 15-min one-shot credential but below the workspace's usual bar | PM (security) | services/co-workspace/src/users.ts:407-410 | one-time | Bump to 12 chars (≥70 bits) in the same generator |
| M2 | `POST /admin/reload` empty-pool guard compares only unioned env+file keys; a file-only rotation to empty still correctly 400s — verified safe — but the guard lacks a regression test | PM (security) | services/co-workspace/src/server.ts:978-984 | script-gap | Add a test: file emptied + reload → 400, keys unchanged |
| M3 | Email-change verification lacks a collision re-check race guard (hash uniqueness enforced by app logic + 409; SQLite has no unique index on `email_hash`) | PM (security) | services/co-workspace/src/users.ts:360-372 | script-gap | Add `CREATE UNIQUE INDEX ... ON users(email_hash) WHERE email_hash IS NOT NULL` (partial, matches login_id pattern) |
| M4 | Rename action (`PATCH /admin/users/:id/name`) has no server test (endpoint tested only via the account test's admin segment) | PM (automation) | tests/unit/co-workspace-phase2b.test.ts | script-gap | Extend the self-service test with rename assertions (already partially there) or a dedicated case |
| M5 | Web UI interactive logic (variant-group delete modal, panel resize, donut render) has zero automated tests — the parse guard only proves the script parses | PM (automation) | services/co-workspace/web/index.html | systemic | GUI-test skill pass at each wave; consider extracting pure helpers (donut slice math, grouping) into an importable module for unit tests |

### ℹ️ Low / Improvements

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| L1 | `/auth/*` keyless exception is prefix-based (`path.startsWith("/auth/")`) — currently safe (only login/signup/verify/me/email/google live there, all self-authenticating), but a future route added under /auth/ silently inherits keylessness | PM (security) | services/co-workspace/src/server.ts:776 | script-gap | Replace prefix check with an explicit allowlist Set of the 10 auth routes |
| L2 | Docker-isolation sibling inherits the gateway image's full /opt/hermes python env — fine, but the `--user 10000:10000` + cap-drop decision deserves a comment cross-link to ADR-0092 Addendum 5 for future editors | PM (security) | services/co-workspace/src/hermes.ts | one-time | Comment added in next touch |
| L3 | `git clean -fdx` would wipe live tenant data now that storage sits in `services/co-workspace/data` — documented in README but easy to miss | PM (docs) | services/co-workspace/README.md (deployment section) | one-time | Loud warning block in the deployment section |

### ✅ Strengths

- Machine battery 6/6 green including L1 parity and drift gates after a 20+ PR day.
- Tenant-identity invariant verified end-to-end: keyed idempotent `POST /sessions`, session-aware `?mine=1`, web composer targeting `POST /tenants/:id/chat`, wires keeping lazy provisioning with untouched open-mode tests as tripwire.
- Docker isolation verified live: sibling containers see no `/seed`, no `/data`, run UID 10000 with cap-drop; turn completed exit 0.
- Account model tests cover the dangerous paths (temp-password rotation + session purge, wrong-current-password 403, email collision 409, admin rename + denial).
- HTML `Cache-Control: no-cache` closed the stale-UI class permanently (both pages, tested).
- Docs fully regenerated: README (229 lines, claims verified against code), ADR-0092 Addendum 5, design doc status — no broken relative links (checked).

## Action wiring

| Finding | Route | Ticket/Action |
|---|---|---|
| H2 (promised follow-ups) | Ticket | T-20260928-006 (pagination), T-20260928-007 (CSRF+tenants-metadata+Secure-flag bundle), T-20260928-008 (artifacts light theme) |
| M1 temp-password entropy | Fix now (trivial, next co-workspace touch) | recorded |
| M2 reload guard test | validator-hardening ticket | T-20260928-009 |
| M3 email_hash unique index | validator-hardening ticket | T-20260928-010 |
| M4 rename test | Ticket (test debt) | T-20260928-011 |
| M5 web logic testability | Ticket (design needed) | T-20260928-012 |
| L1 auth allowlist | validator-hardening ticket | T-20260928-013 |
| C1 CI billing | User decision required | existing T-20260927-016 (URGENT) |
| H1 stale tests | Needs owning-session confirmation | T-20260928-014 |
| H3 spec status drift | Fix now | spec-register --update (next sync) |
| H4 file split | Ticket (design gate) | T-20260928-015 |
| — (parallel-session board discovery) | Pre-existing ticket | T-20260928-005 (500-on-chat report) — locally NOT reproducible: anthropic suite 9/9 pass, full suite 109/109 pass on main @ 7c07d4e4; likely fixed by the wave or stale. Left done by owning session |

## Verification

Analysis-only session — no code files modified. Baseline re-run after review: unchanged 6/6 green. Tickets recorded via `scripts/ticket.ts` (see IDs above; report wiring completed 2026-09-28).
