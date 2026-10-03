# Design: co-workspace forced-rotation keeps the rotating session

- **Spec ID**: `2026-10-02-coworkspace-rotation-keeps-session-design`
- **Date**: 2026-10-02
- **Status**: implemented
- **Scope**: `services/co-workspace/src/users.ts` (one method), `src/routes/auth.ts` (one branch), `web/index.html` (one dialog), `tests/unit/co-workspace-phase2b.test.ts`. No other surface.

## Accessibility (ADR-0065/0070)

The wave touches one user-facing surface: the forced-password-change dialog's save
button keeps the user signed in. No modal closes or focus moves — the existing dialog
structure, labels, and focus handling are unchanged, and screen-reader state now matches
reality (the session survives). No new a11y obligations.

## 1. Problem

The R1 forced-rotation flow (admin issues a temp password; holder signs in and must set a
real password) ended by purging EVERY session of the user — including the one that had
just authenticated with the temp credential and performed the rotation. The web app then
dropped the user onto the signed-out sidebar card, and the user had to find the small
sign-in form at the sidebar bottom to get back in. Operator report (2026-10-02): "after
the password change the sidebar should show the signed-in user's info" — the flow reads
as broken even though each step is intentional.

The R3 self-service change path already models the right semantics
(`changePassword(..., keepToken)`: the session that performed the change survives, every
OTHER session is invalidated — SEC-06). The R1 path is the only one that over-applies the
purge to the acting session.

## 2. Requirements

- R1: After completing the forced rotation, the session that performed it stays signed
  in; the sidebar shows the user's info without any re-login.
- R2: Every OTHER session of the user is still invalidated at rotation (SEC-06 kept).
- R3: The R1 confinement gate (temp sessions are confined to the auth surface) still
  lifts exactly when the flag clears; the kept session is fully privileged afterwards.
- R4: The temp-password expiry and forced-flag semantics are unchanged.

## 3. Design

- `UserStore.completeTempPasswordChange(userId, newPassword, keepToken?)` mirrors
  `changePassword`: with a `keepToken`, `DELETE ... WHERE user_id=? AND token_hash != ?`
  (purge others only); without one, the legacy purge-all. Callers that do not pass a
  token keep the old behavior.
- `PATCH /auth/me` (mustChangePassword branch) passes `sessionTokenFromCookie(req)` and
  now returns `{ user: { loginId, name, role } }` — the same shape as the R3 branch
  directly below it — instead of `{ ok, message }`.
- `forcePasswordChange()` in the web app sets `me = body.user`, re-renders the signed-in
  card, refreshes sessions, and bubbles "password updated — other sessions were signed
  out". The dialog button becomes "Save and continue". No drop to the signed-out card.

## 4. Non-goals

- No change to `createTempPassword` (reset still purges all sessions of the target —
  that purge is the point of an admin reset).
- No change to the R1 confinement gate itself or to temp-password expiry.
- No auto-login helper for the JSON API (a programmatic client that used the old
  purge-all behavior can still pass no cookie-token path: the API contract only gains an
  optional keep-token parameter server-side; the response shape for the confined branch
  changes from `{ok,message}` to `{user}` — the only known consumer is the shipped web
  app, updated here).

## 5. Alternatives rejected

- **Client-side auto re-login after rotation** (POST /auth/login with the new password
  from the dialog): keeps the server's purge-all but lets the web client silently regain
  a session — hides the behavior instead of fixing it, and doubles the auth round-trips.
- **Drop SEC-06 entirely on rotation**: rejected — other sessions must still die.

## 6. Test plan

- `tests/unit/co-workspace-phase2b.test.ts`:
  - admin-reset test now asserts the rotating session survives (`/auth/me` 200,
    `mustChangePassword: false`) and the PATCH returns `{ user }`.
  - R1-gate test now asserts `/tenants` opens on the SAME session right after the
    rotation PATCH, in addition to the fresh re-login.
- Full adjacent suites green: phase2b (18), server + tenant + auth-hardening +
  cookie-secure (67); `tsc --noEmit` clean.
