# Meeting — co-workspace usability wave (R1–R7)

- **Date**: 2026-09-28
- **Facilitator**: PM (ZCode session)
- **Participants**: architect, security-expert, automation-engineer, docs-writer (**designated dissent seat**)
- **Rounds**: 2 (round-robin; round 2 = final positions on contested items)
- **Status**: PROPOSAL — nothing here is decided until the user approves (governance rule 2)

## Agenda

Review seven user-requested changes to the co-workspace web service, identify gaps, and
produce an execution plan:

- R1 password reset → make the generated credential copyable
- R2 Admin/Artifacts header overlap → move Admin left of the theme toggle
- R3 remove personal profile settings; admin can change users' email accounts
- R4 logout confirmation, then land on the logon screen
- R5 admin user management at scale + 3 circular (donut) charts in the same area
- R6 group sidebar sessions by variant
- R7 remove "+ New chat"; add explicit variant/team creation (beta selectable); only created teams chattable

## Round 1 — positions (condensed; full texts in session transcript)

**architect**: R2/R4/R6 agree (XS). R1 widen scope — the reset token is a dead end
(`consumeResetToken` has no calling route; login.html accepts no token); build
`POST /auth/reset` redemption. R3 modify — reuse the existing nullable `users.email`
column as admin-set contact email (SSO/bootstrap already write it); lockout guard:
remove self-service password change only after redemption exists. R5 — the real wall
is `dirSize()` per tenant per panel-open; donuts suit composition not per-user rankings;
SVG stroke-dasharray over conic-gradient. R7 — interpretation (a): explicit per-(user,
variant) instantiation from the existing catalog; reject scaffolding-templates (c) and a
mutable DB catalog (b); key-stamp fix; web callers gated, Bearer-key APIs stay lazy.

**security-expert**: R1 approve-with-modification — reset IS audit-logged; token flow
incomplete; recommends temp password + forced first-login rotation instead of a token
redemption endpoint (no new unauthenticated surface); purge target sessions at reset
(`createResetToken` currently does not). R3 conditional — reverses the shipped PII-safe
notice; ranks re-verification-only > plaintext > encrypted-at-rest (last: same breach
domain as the DB); retain self-service password change (HOLD). R7 approve — and it FIXES
a quota bypass (lazy `getOrStartTenant` never checks `tenantMaxPerPrincipal`); variant
allowlist check is the path-traversal guard, keep it; beta gating is currently
client-side only. Found `/tenants?mine=1` ignores the session cookie
(`principalFor(presentedCredential)`, server.ts:805) — cookie users filter as
"anonymous".

**automation-engineer**: premise correction — `users` table already has BOTH
`email TEXT UNIQUE` and `email_hash`; R3 needs no migration. R1 S (reusable `showModal()`;
clipboard needs secure-context fallback ladder — LAN http has no `navigator.clipboard`).
R2 S. R3 M (PATCH /admin/users/:id/email; 409 on UNIQUE; audit `user.set-email`).
R4 S. R5 M — client-side search+pager fine until ~200 users; donuts SVG viewBox 42 ring,
top-7+others; stats `perUser` already sorted server-side. R6 S. R7 M if web-scoped
(composer → `POST /tenants/:id/chat`; wires untouched; tenants table IS the registry),
L if lazy is removed globally (≈15 tests) — not recommended. Found `/sessions` creates
tenants WITHOUT `key` while lazy lookup is `findByKey("<variant>::<user>")` —
created-vs-lazy divergence (pre-existing bug R7 depends on).

**docs-writer (dissent seat)**: 👍 R4, R5a (pagination/search). 👎 R3 (removes the only
self-service password change — weekend-lockout scenario; admin-email surveillance
perception), 👎 R5b donuts for per-user metrics (Cleveland & McGill; 30-slice donut is
decoration; disk donut loses absolute MB), 👎 R6 forced variant grouping (recency was
the deliberate ChatGPT pattern; variant tag already on each row), 👎 R7 (chips advertise
a flow that stops existing; deleted-last-team dead end; sharing semantics undesigned).
Remedies it would accept: R1 temp password wording; R3 keep password self-service +
admin email field alongside; R5 donut only for variant share ≤8 slices; R6 toggle;
R7 "+ New team" modal with chips carrying the message through creation.

## Round 2 — final positions

**architect**: (1) R3 recommend full removal per literal request; same-wave R1
redemption path is the compensating control; design doc must record accepted
admin-availability risk, session-invalidation-on-reset, display-name disposition,
breaking-change note. (2) R5 LITERAL: 3 donuts, top-6+others, legends carry counts+MB —
satisfies the wording at ~zero information cost. (3) R6 variant DEFAULT + localStorage
toggle to recency (docs-writer's mechanism, amended default). (4) R7 confirmed; design
doc must carry a normative tenant-identity invariant: "exactly one active team per
(principal, variant), identified solely by registry key `<variant>::<principal>`;
every creation path stamps the key; the web surface resolves by key and NEVER
auto-creates; legacy key-less rows are adopted by stamping, never duplicated."
(5) Downgrades "drop per-user charts entirely" (superseded by top-N legends).

**security-expert**: (1) R3 email ranking: re-verification-only > plaintext column >
encrypted-at-rest (downgraded below plaintext). If plaintext: audit `user.email-change`
(no email value in the audit row), admin-only visibility, hash kept in sync (409 on
collision), notice rewrite same change, design doc + recorded approval, guard SSO
re-link on `google_sub` accounts. (2) R3 password change: HOLD — keep `PATCH /auth/me`
password change (~15 tested lines, primary containment); the ✎ screen can still
disappear. If overruled: working temp-password reset, session purge at reset, audited
forced rotation, single-admin dependency + passwordless-bootstrap recovery documented,
ADR-0074 doc. (3) R7 creator: any authenticated user; default
`CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL=10` in loginRequired deployments (today 0 =
unlimited AND lazy paths bypass the cap). (4) R1: temp password, not token+redemption —
argon2id hash only, `must_change_password` forced rotation, purge sessions at reset AND
rotation, audit issuance + completion, 15-min TTL, clipboard copy inside the click
gesture. (5) Posture notes → separate tickets: CSRF credentialed exemption,
`GET /tenants` full-metadata exposure, Secure-flag-vs-TLS. `/tenants?mine=1` bug is
in-wave must-fix.

**automation-engineer**: (1) R7 confirmed — must-stay-green: open-mode lazy tests
(co-workspace-server.test.ts:204-257 + anthropic/gemini suites); new tests: chat after
`POST /sessions` hits the SAME tenant (registry count 1), zero-teams empty state,
deleted-last-team 404. (2) Sequencing confirmed; fold R6 into R7's PR (both rewrite
`loadSessions()`) → 5 PRs + a standalone bugfix PR0 before everything (mine=1 cookie
principal + /sessions key stamp) so R7's tests assert fixed semantics and bisection
stays clean. (3) R5 pagination: CLIENT-side now (2 users → dozens; server-side
deferred past ~150 users ticket). (4) Donuts SVG confirmed; top-7+others; CSS vars
cascade into SVG for themes; downgrades the per-user disk donut (long tail reads
badly) — per-user stays tabular. (5) PR0 standalone; rest sequential.

**docs-writer (dissent seat)**: D1 (R3) WITHDRAW conditional — requirements: same-wave
R1 modal, working first-login force-change, admin gains email AND display-name edit.
D2 (R5 donuts) **HOLD** — if proceeding literally: ≤8 slices via top-N+Others, legend
count+percentage, absolute MB for disk, tooltips, per-user detail stays in the table;
retracts the absolutist "Three donuts in a row: no". D3 (R6) WITHDRAW — requirements:
`gw-grouping` toggle at SESSIONS header (persisted), recency inside groups, collapsible
with remembered state, Today badges, no empty groups. D4 (R7) WITHDRAW onboarding
objection (chips remedy accepted, failed creation returns the message to the composer);
HOLD on sharing semantics (blocker) + zero-team state requirement. Blockers: Q-A (R7
sharing/migration), Q-B (R1/R3 redemption destination). Scale question downgraded to
nice-to-know.

## Synthesis (PROPOSAL)

Converged without dissent: R2, R4, R6-with-toggle, R5 table work, R7 web-scope design
(private-to-creator, chips remedy, zero-team state, identity invariant), PR0 bugfixes.

Decision points for the user (see final response):
1. R1 shape — (A) temp password + forced first-login change [security, docs-writer;
   recommended] vs (B) token + redemption UI [architect, automation].
2. R3 profile — full removal per literal wording (all guardrails) vs remove-UI-but-keep
   self-service password change (security HOLD + docs-writer condition).
3. R3 email storage — re-verification-only vs admin-set contact email (plaintext
   column + mitigations).
4. R5 donut subjects — literal (per-user tenants / per-user disk / per-variant) with
   top-7+others caps, or composition subjects (status / variant / user-state).
5. R7 sharing — private-to-creator (recommended; matches current isolation).

## Action items

- PM: present synthesis + execution plan to the user (this document + final response).
- User: answer decision points 1–5 (Q-A, Q-B included).
- Post-approval: Row 0 design doc (ADR-0074) covering the wave, then PR0..PR5 per plan.
- Backlog tickets (separate): CSRF credentialed-exemption tightening;
  `GET /tenants` metadata exposure; Secure-flag/TLS posture.
