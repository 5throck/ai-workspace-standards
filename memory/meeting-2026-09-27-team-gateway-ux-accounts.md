# Meeting Transcript — Team Gateway UX & Accounts (2026-09-27, second session)

- **Facilitator**: PM
- **Participants**: Template Architect, Automation Engineer, Security & Git Expert, Consistency Auditor (red-team seat)
- **Evidence base**: current state as of #1137 — chat-first demo (sidebar sessions, header variant select), key-principal auth (key-file labels), SQLite registry (interface-separated), no user accounts, no login UI, no right panel, beta toggle in sidebar (functional but misplaced per user).

## Agenda (user requests)

1. beta toggle → move to central top; fix "not working properly"
2. Right panel: view chat artifacts (deliverables/files produced by chatting)
3. Both side panels collapsible
4. Login window + new-user signup + Google SSO; user info under sidebar; editable profile
5. Admin menu (top right): password reset, user deletion (tenant delete-or-archive choice), more

---

## Round 1

### Template Architect

- **(1) beta toggle**: root cause of "not working properly": the toggle is a client-side display filter, but it sits in the sidebar while the variant select lives in the chat header — after toggling, the user's mental model (header select should change) doesn't update visibly and there's no feedback. Move both the toggle and the variant select into the header as one control group; the toggle re-fetches `/v1/models` and the select re-renders with a toast ("13 variants · 5 beta"). Optionally expose the user's include-beta preference server-side (per-principal preference in the registry) so it persists across devices.
- **(2) Right panel**: an artifacts/files panel with three tabs: **Files** (tenant workspace tree: deliverables/, docs/), **Preview** (markdown/code viewer), **History** (per-turn event log with tool calls). Data source: a new read-only files API is REQUIRED — the gateway currently has no file-serving endpoint; without it the panel has nothing to show. Endpoints: `GET /tenants/:id/files?path=…` (sandboxed to the tenant dir, no symlink escape), `GET /tenants/:id/file?path=…` (content, size-capped). This is the real engineering cost of the request.
- **(3) Collapse**: CSS grid `grid-template-columns: [sidebar] [chat] [right]` with collapsed states → icon rails (32px). Persist collapsed state per browser (localStorage), not per account.
- **(4) Accounts**: the big one. Current auth = static key pool with labels; accounts introduce: user store (SQLite table), signup, sessions (HTTP-only cookie or bearer token per login), password hashing (argon2/bcrypt — bun has built-in `Bun.password`), Google OAuth (authorization-code flow, `accounts.google.com/o/oauth2/v2/auth`, client id/secret env), and **linking**: an SSO login must map to the same principal the key labels use. Recommendation: keep keys for machine access, add an interactive session cookie for the web UI; principals unify both.
- **(5) Admin**: role field on the user record (`admin` flag); admin routes (`POST /admin/users/:id/reset-password`, `DELETE /admin/users/:id` with `archive|delete` tenant disposition, `GET /admin/users`); audit log of admin actions. The "delete user → tenants delete-or-archive" maps cleanly onto the existing tenant delete.

### Automation Engineer

- **(2) Files API**: implement with a path-allowlist walker — resolve the requested path inside the tenant project dir, reject `..` and symlink escapes, cap file size (~256KB per read), list directories with metadata. Cheap with bun APIs; the security-sensitive part is the path resolution (Security expert should review).
- **(4)**: signup + Google OAuth both feasible with bun built-ins (crypto for state/PKCE, no new deps for OAuth if we hand-roll the code exchange with fetch). New tables: `users(id, email, name, password_hash?, google_sub?, role, created_at)`, `sessions(token_hash, user_id, expires_at)`. `Bun.password` covers hashing. Google: redirect URI must be registered by the operator — document as env (`GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`) + `/auth/google/login` and `/auth/google/callback` routes.
- **Preference storage**: the include-beta preference belongs on the user record (per-principal), defaulting false — this also fixes the "toggle resets on reload" feel.
- **Effort order**: users table + local auth → Google SSO → admin routes → files API → UI restructure. The UI (collapse, panel) is the easy part; the account system is the milestone.

### Security & Git Expert

- **(4) Non-negotiables**: (a) sessions via HttpOnly+Secure+SameSite=Lax cookies, token stored hashed; (b) password hashing with `Bun.password` (argon2id) — never reversible; (c) Google OAuth: state param (CSRF) + PKCE; only the callback exchanges the code server-side; (d) login-rate-limit per IP+email (SQLite table or in-memory); (e) the existing key-principal auth stays for API/machine access — web sessions and API keys are separate credentials, both mapping to principals; (f) user deletion: prefer archive-by-default (soft delete: `deleted_at` set, tenants archived) — hard delete cascades are destructive and irreversible.
- **(5) Admin**: the first user via env bootstrap (`TEAM_GATEWAY_ADMIN_EMAIL`) becomes admin; admin actions require the session cookie AND the role check server-side; every admin action writes an audit row (who/what/when/target). Password reset = set a one-time reset token, not a plaintext password.
- **(1)**: include-beta as a user preference is fine, but the CATALOG itself must remain server-gated (`TEAM_GATEWAY_VARIANTS_INCLUDE_BETA`) — a user preference narrows the served list, never widens it.
- **(2) Files API**: read-only, tenant-scoped path resolution, and NEVER serve `.env`, `auth.json`, or `*-home/**` — an explicit denylist on top of the tenant-dir confinement.

### Consistency Auditor (red-team seat — dissent preserved verbatim)

- Dissent on **(4) Google SSO in this milestone**: "We just hardened a credential-sharing flaw. Adding OAuth, user tables, sessions, and admin in the same wave as UI restructuring is the largest attack-surface jump so far, with zero soak time. Split it: Wave A = files API + panel + collapse + toggle move (pure UI/read-only); Wave B = accounts (local auth first, SSO second, admin last). Shipping A and B together means a security incident in B blocks the harmless A."
- Dissent on **(5) 'archive' ambiguity**: "'Archive' must be defined before it is built — is the tenant dir kept but unlisted, moved aside, or exported? If archive just means a flag in SQLite while files stay on disk, say so; if it means relocation, that is a new filesystem contract. Do not let the UI offer three words for one behavior."
- Challenge on **(2) scope**: "'Chatting results' — what IS a result? A deliverable file, a console log, a diff? If the answer is 'files the runtime wrote', the Files API is right. If it is 'a log of what the team said/did', that is the History tab and it needs the turn events persisted per turn — which we do NOT store today. Decide now or the panel ships half-empty."
- Challenge on **(4) principal unification**: "Users table + key labels are two identity systems. The unification rule (email == label? google_sub == label?) must be written down before signup exists, or we create a second orphaned identity class."

### PM (facilitator note)

Converged structure: Wave A (UI/panel/files) and Wave B (accounts/SSO/admin) as separate PRs. Definition of "result" = tenant workspace files (Files tab) + turn history (persist per-turn events into SQLite — cheap, already have the turn summary). Archive = soft delete (flag + excluded from lists; files stay on disk) — defined. Principal unification rule: user record IS the principal source; key-file labels must match a user's `principal` column (default email local-part); unknown labels map to "default".

## Round 2 — convergence

- **Architect → Auditor**: accept split A/B. The models-payload preference note: include-beta becomes a user preference persisted on the user record in Wave B; in Wave A it stays client-side (localStorage) with the toggle in the header.
- **Engineer → Auditor**: History tab = persist per-turn event summaries (already captured in the done event: session id, tokens, exit code, final text) into a `turns` table — small addition, high panel value. Files tab = tenant-confined read-only API.
- **Security → all**: archive = soft delete confirmed (`deleted_at` on user; tenants get `archived_at`, excluded from default lists, files untouched). Reset tokens: one-time, 15-minute expiry, stored hashed.
- **Auditor (closing dissent, preserved)**: "Wave B must ship behind auth-enabled-by-default once accounts exist — a user system next to an open server is decoration. And the files API denylist (.env, auth.json, *-home) must have a test that literally tries to fetch them."

---

## Synthesized Proposal (for user approval — NOT decided)

**P10. Wave A — UI restructure (S-M)**: header control group (variant select + include-beta toggle with toast feedback + count); right Artifacts panel with Files / Preview / History tabs; both side panels collapsible to icon rails (state in localStorage).
**P11. Files + History API (M)**: `GET /tenants/:id/files` + `GET /tenants/:id/file` (tenant-confined, denylist: `.env`, `auth.json`, `*-home/**`, size-capped); per-turn event persistence into a `turns` table (session id, tokens, exit code, text excerpt).
**P12. Wave B1 — local accounts (M)**: users + sessions tables (SQLite, same interface pattern); signup (email+password, `Bun.password` argon2id), login (HttpOnly cookie, hashed token, rate-limited), profile edit (name/password change); principal unification rule (user.principal = email local-part by default; key labels must match or fall to "default").
**P13. Wave B2 — Google SSO (M)**: OAuth authorization-code + PKCE + state; `/auth/google/*` routes; account linking by verified email; env: `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI`.
**P14. Wave B3 — admin (M)**: `role` on users; bootstrap admin via `TEAM_GATEWAY_ADMIN_EMAIL`; admin routes (list users, reset password via one-time hashed token, delete user with tenant disposition `archive|delete`); admin audit table; UI admin menu top-right; auth-on-by-default once accounts exist (Auditor condition).
**P15. beta toggle relocation (S, rides P10)**: header control group; user preference persists in Wave B (per-principal), client-side localStorage in Wave A; catalog remains server-gated (preference narrows, never widens).

## Action Items

| # | Action | Owner | Wave | Size |
|---|---|---|---|---|
| 1 | P10 UI restructure (header group, right panel, collapse) | automation-engineer | A | S-M |
| 2 | P11 files API + denylist + tests | automation-engineer | A | M |
| 3 | P11 turns table + history API | automation-engineer | A | S |
| 4 | P12 users/sessions tables + local auth + profile | automation-engineer | B1 | M |
| 5 | P13 Google SSO (PKCE, state, linking) | automation-engineer | B2 | M |
| 6 | P14 admin routes + audit + bootstrap admin | automation-engineer | B3 | M |
| 7 | Admin UI menu | automation-engineer | B3 | S |
| 8 | Design doc (ADR-0092 addendum + waves) | docs-writer | A0 | S |

## Revised Master Plan (2026-09-27, user request: fold in all previously-deferred items)

Previously deferred from the first meeting (evolution) that are NOT yet implemented:
- **P3**: Claude Code + Codex CLI session runtimes (each M: live protocol probe → adapter → continuity → credential model)
- **P2**: OpenAI SDK contract documentation (text-out only; tools passthrough deferred)
- **P6**: Runtime Addition Checklist (standing procedure in README)
Open points now resolved into plan: turn-history retention (prune to last 100 turns per tenant), auth-on-by-default decision = user's call at Wave B3 ship time.

### Unified wave order (supersedes the A/B-only order above)

| Wave | Content | Size |
|---|---|---|
| **A** | P10 UI restructure (header control group w/ beta toggle, right Artifacts panel Files/Preview/History, collapsible side panels) + P11 files/turns APIs | S-M |
| **B1** | P12 local accounts (users/sessions, signup/login/profile, principal unification) | M |
| **B2** | P13 Google SSO (PKCE, state, account linking) | M |
| **B3** | P14 admin (roles, bootstrap, reset tokens, user delete w/ archive|delete, audit) + auth-on-by-default decision | M |
| **C1** | P3-a Claude Code runtime (probe → adapter → live → provider disclosure "Anthropic") | M |
| **C2** | P3-b Codex CLI runtime (probe → adapter → live → provider disclosure "OpenAI") | M |
| **C3** | P2 SDK contract docs + P6 Runtime Addition Checklist | S |
| **C4** | Turn-history retention pruning (last 100 turns per tenant) | S |

Rationale: Wave A stays pure read-only/UI (Auditor's split accepted); accounts (B) are the security milestone; runtime expansion (C) rides the stabilized account/credential model — Claude Code and Codex credential handling (never copy token files; shared location or per-turn re-seed) benefits from the user-account identity added in B. P2/P6 (docs) ride the last wave so the checklist includes every runtime shipped in C1/C2.

## Open Points (explicitly unresolved)

- Google OAuth client registration is operator work (redirect URI per deployment).
- Turn History retention (prune policy) undecided.
- Whether the demo page keeps the no-auth Phase 0 mode when auth exists but the operator hasn't enrolled users (Security recommends auth-on-by-default once Wave B lands — final call is the user's).
