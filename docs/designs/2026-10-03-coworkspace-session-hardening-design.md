# co-workspace Session Hardening Design — 2026-10-03

**Date**: 2026-10-03
**Status**: Approved (Row 0 design; implementation lands in this wave)
**Spec id**: 2026-10-03-coworkspace-session-hardening-design
**Scope**: services/co-workspace (session lifetime, admin re-auth, session management)
**Trigger**: operator concern — the 7-day fixed session with no idle expiry is the only time defense against cookie theft, and destructive admin ops run without re-authentication.

## 1. Current posture (verified)

7-day absolute session TTL (`users.ts` `SESSION_TTL_MS`), hashed token storage, HttpOnly/SameSite=Lax/Secure-auto cookie, purge-others on password change/rotation/admin promotion. Gaps: no idle expiry (a stolen cookie is valid up to 7 days regardless of use), no re-auth for destructive admin operations, no user-facing session revocation.

## 2. Requirements

- R1 (A — user-set values): sessions carry an absolute TTL (**default 24h**) AND an idle timeout (**default 4h**) — activity slides the idle window but never past the absolute cap; both operator-configurable via env. (User decision on the A recommendation: 24h absolute / 4h idle — stricter than the originally proposed 168h/24h.)
- R2 (B): destructive admin operations (user delete, temp-password issuance, `/admin/reload`) require the caller to re-present their password (`x-admin-password` header, verified against the caller's argon2 hash). Passwordless (SSO/bootstrap) admins must set a password first — first-time password set (null hash) does NOT require the current password.
- R3 (C): users can list their own sessions (current flagged, with last-active) and revoke others or all (all = signed out everywhere, cookie cleared).

## 3. Design

- D1 — config: `CO_WORKSPACE_SESSION_TTL_HOURS` (default 24), `CO_WORKSPACE_SESSION_IDLE_HOURS` (default 4); both parsed as positive numbers → ms on `GatewayConfig` (`sessionTtlMs`, `sessionIdleMs`); `idle > ttl` is legal (absolute simply governs). `UserStore(dataDir, ttlMs, idleMs)` takes them (the module constant moves into the constructor; `state.ts` wires from cfg).
- D2 — schema: `sessions.last_seen_at` column (try/catch ALTER migration, existing pattern). `createSession` sets `expires_at = now + ttl`, `last_seen_at = now`. `resolveSession` rejects when `now > expires_at` (absolute) OR `now > last_seen_at + idle` (idle); on success it bumps `last_seen_at` — write-throttled to at most once per idleWindow/12 (20min at defaults) so the per-request resolve path stays cheap.
- D3 — cookie `Max-Age` stays the absolute TTL (the browser-held cookie outliving an idle-expired session is harmless: the server rejects it and the user re-signs-in).
- D4 — admin re-auth: `requireAdminReauth(state, req)` (access.ts) — reads the `x-admin-password` header, verifies against the SESSION caller's `passwordHash` (constant-time argon2 verify), 403 "password re-confirmation required" on missing/wrong/empty-hash. Applied to: `DELETE /admin/users/:id`, `POST /admin/users/:id/reset-password`, `POST /admin/reload`. Rename is non-destructive and stays exempt.
- D5 — first-time password set: `PATCH /auth/me` skips the current-password check when the caller's `passwordHash` is null (first set); afterwards normal R3 rules apply. This gives SSO/passwordless admins the path to satisfy D4.
- D6 — session management (`routes/auth.ts`): `GET /auth/sessions` (own sessions: id-prefix, createdAt, lastActive, expiresAt, current flag), `POST /auth/sessions/revoke-others` (keep current), `POST /auth/sessions/revoke-all` (purge everything; response clears the cookie — user is signed out everywhere). Audit events `session.revoke-others` / `session.revoke-all`.
- D7 — web: admin delete/reset-password buttons prompt for the operator password (modal) and send the header; the Account modal gains a Sessions section (list + revoke-others / revoke-all buttons).
- D8 — deployment surface: compose + `.env.sample` + README config table gain the two new vars (env-parity ratchet covers all three).

## 4. Security notes

Idle expiry bounds cookie-theft value to ≤ idle window (default 4h) instead of 7 days; the absolute cap bounds a continuously-used stolen session. Re-auth blocks a stolen session from destructive admin actions even within the window. The re-auth proof is the password itself (argon2 verify), never a derived bearer.

## 5. Test plan

Idle expiry (tiny windows) rejects and recovers via activity; absolute expiry unchanged; last_seen throttling (≤1 write per window/12); admin ops 403 without/wrong password, pass with correct; passwordless first-set works then re-auth works; revoke-others keeps current + kills others; revoke-all kills all; list flags current. Full battery + typecheck.

## 6. Non-goals

Token rotation on every request (hash-stored tokens make replay-checking the dominant control); WebAuthn/2FA (future); per-session device labels (the list shows last-active instead).
