# Design: Make API Keys and the Login-Required Web UI Composable

- **Date**: 2026-09-30
- **Status**: Implemented
- **Related**: `services/co-workspace/src/auth.ts`, `services/co-workspace/src/server.ts`, `tests/unit/co-workspace-phase2.test.ts`, `tests/unit/co-workspace-auth-hardening.test.ts`, design `2026-09-27-co-workspace-phase2-hardening` (D1 route gate), Wave B (login-required gate)
- **Problem**: Two defects surface when API keys are enabled (`authEnabled: true`) alongside `CO_WORKSPACE_LOGIN_REQUIRED=true` — the posture required for any non-loopback deployment:
  1. **Sign-in page unreachable.** The Phase 2 route gate demands a Bearer key for every route outside `AUTH_EXEMPT_ROUTES` (`GET /`, `GET /health`) unless the caller presents a signed-in session. A fresh browser has neither, and the sign-in flow is `GET /` → 302 → `GET /login` — so `GET /login` 401s and sign-in itself becomes impossible. (Found live 2026-09-30 while enabling LAN access with a key file.)
  2. **Key-authenticated API calls redirected.** The Wave B gate demanded a session from every non-exempt caller when `loginRequired` is on, including callers holding a valid Bearer key — `GET /v1/models` / `GET /tenants` returned 302 → `/login` and mutating routes returned 401 "sign-in required". That contradicts the gate's own contract ("the API demands a key (Bearer) or a valid session") and breaks every API wire once keys are configured.
- **Fix**:
  1. Add `GET /login` to `AUTH_EXEMPT_ROUTES`. The sign-in page is static shell content holding no tenant data; `POST /auth/login` already sits on the always-open `/auth/*` surface with per-IP and per-login-ID rate limits, and the Wave B gate separately demands a session for everything the page leads to.
  2. In the Wave B gate, treat a valid Bearer credential as satisfying the demand: `if (!exempt && !sessionUser && !hasApiKey)`. `hasApiKey` is already computed for the CSRF guard in the same request path; no new credential handling is introduced.

## 1. Auth matrix after the change (`loginRequired=true`, keys configured)

| Request | No key, no session | Valid key, no session | Signed-in session, no key |
|---|---|---|---|
| `GET /login` | 200 (exempt) | 200 | 200 |
| `GET /` | 302 → `/login` | 200 | 200 |
| `GET /tenants`, `GET /v1/models` | 302 → `/login` | 200 | 200 |
| `POST /tenants/:id/chat` | 401 "sign-in required" | 200 | 200 |

## 2. Deployment binding

Enabling keys was motivated by LAN exposure, and the compose publish previously pinned a
literal LAN IP (`192.168.0.44:9030:9030`) during the incident — that hard-codes one host.
The publish binding is now env-driven: `${CO_WORKSPACE_PUBLISH:-127.0.0.1}:9030:9030`.
The D6 loopback default is preserved for the repo; widening exposure is one `.env` line
(`CO_WORKSPACE_PUBLISH=0.0.0.0`, survives DHCP IP changes) instead of a compose edit, and
this design's auth fixes are the precondition that makes widening safe.

## 3. Non-goals

- No change to key validation, hashing, or principal mapping.
- No CSRF-posture change: `CO_WORKSPACE_CSRF_REQUIRED` stays opt-in and unaffected.
- Keyless mode (empty key pool) behaves exactly as before.
- Session-cookie issuance/rotation untouched.
