# co-workspace Usability Wave Design (R1–R7)

- **Spec id**: `2026-09-28-co-workspace-usability-wave-design`

- **Date**: 2026-09-28
- **Status**: Implemented (2026-09-28 — PRs #1164, #1165, #1167, #1168, #1169, #1170 + #1171/#1176/#1178 follow-ups; docker isolation activated via PRs #1180/#1181/#1182)
- **Related**: ADR-0092 (Team Gateway / co-workspace), ADR-0074 (Universal Design Gate), ADR-0065 (accessibility), ADR-0070 (preview verification), meeting transcript `memory/meeting-2026-09-28-co-workspace-improvements.md`
- **Scope**: Seven usability changes to `services/co-workspace` (web UI + server), delivered as sequential PRs (PR0–PR5). No changes to the template catalog, workspace governance, or the public API wire contracts.

---

## 1. Background

A two-round multi-agent meeting (architect, security-expert, automation-engineer,
docs-writer as designated dissent seat) reviewed seven user requests. The meeting
surfaced two pre-existing correctness bugs the wave depends on, a dead-end password
reset flow, and one governance-sensitive privacy question. The user then fixed all
five decision points. This document records the binding decisions and the normative
invariant implementations must preserve.

## 2. User decisions (binding)

1. **R1 shape = (A)**: admin reset issues a one-time TEMP PASSWORD (not a token);
   first sign-in with it forces a password change.
2. **R3 profile**: self-service PASSWORD CHANGE is RETAINED, delivered as a popup
   (modal); the display-name self-edit form is removed.
3. **R3 email**: users change their OWN email (self-service), verification required.
   Admin email-editing is dropped. Raw email lives only in `pending_verifications`
   (≤24 h, already swept); after verification only the `email_hash` is retained —
   the shipped PII-safe invariant is preserved and the signup/login privacy notices
   stay true.
4. **R5 donuts**: the three donuts show COMPOSITION metrics — tenants by status,
   tenants by variant (top-7 + "others"), users by sign-in state — replacing the
   three per-user bar charts' donut conversion. Per-user rankings remain available
   as the existing horizontal bar charts / table columns.
5. **R7 teams**: managed per user ID (private to the creator — same isolation as
   today); existing auto-created workspaces migrate to teams automatically.

## 3. Normative invariant (must hold after PR5)

> **Tenant identity**: exactly one active team per (principal, variant), identified
> solely by the registry key `<variant>::<principal>`. Every creation path stamps the
> key. The web surface resolves tenants by key/id and NEVER auto-creates. Legacy
> key-less rows are adopted by stamping the key — never duplicated. Bearer-key API
> surfaces (OpenAI/Anthropic/Gemini wires) keep lazy provisioning as their documented
> contract.

## 4. Design decisions per PR

- **D-PR0 (pre-existing bugfixes)**: `GET /tenants?mine=1` resolves the principal via
  the session-aware `callerPrincipal()` (today it reads header credentials only and
  mis-filters cookie sessions, server.ts:805). `POST /sessions` stamps
  `key = tenantKeyFor(variant, owner)` and returns the existing tenant when the key
  already matches (idempotent creation) — closing the created-vs-lazy divergence.
- **D-PR1 (R2, R4)**: `#adminMenu` loses `position:absolute` and becomes a header flex
  child; final order `☰ · title(flex:1) · ⚙ Admin · ◐ theme · ▤ Artifacts` (Admin left
  of the theme toggle, per request). Logout wraps in `confirm("Sign out of
  co-workspace?")`, then `POST /auth/logout`, then `location.assign("/login")`.
- **D-PR2 (R1)**: `POST /admin/users/:id/reset-password` generates a pronounceable
  temp password, stores only its argon2id hash, sets `must_change_password = 1` with a
  15-minute expiry, and purges ALL target sessions (`createResetToken` today does
  neither). The admin modal shows it once with a Copy button (clipboard ladder:
  `navigator.clipboard` → `execCommand("copy")` fallback for LAN http → manual
  select). Login with a temp credential returns `mustChangePassword: true`; the app
  shows a blocking change-password modal that calls the password-change endpoint,
  then clears the flag and rotates sessions (SEC-06 pattern). Audit: issuance event
  already exists; add a rotation-completion event. The dead `consumeResetToken()` is
  removed with its tests.
- **D-PR3 (R3)**: the ✎ profile form becomes a "Change password" modal (current
  password + new password; server now REQUIRES `currentPassword` for password
  changes). Display-name self-edit is removed; the admin users table gains a rename
  action (dissent-seat withdrawal condition). Email change is self-service with
  verification: `POST /auth/email/change` (creates a `pending_verifications` row +
  outbox mail, reusing the signup verification mechanism) → `POST /auth/email/verify`
  → `email_hash` replaced (409 on collision). No raw email is stored beyond the
  24-hour pending window. `PATCH /auth/me` keeps password change only.
- **D-PR4 (R5)**: three SVG donuts (`viewBox="0 0 42 42"`, `stroke-dasharray`, CSS
  variables for theme colors, per-slice `<title>` tooltips) in one grid row:
  (1) tenants by status, (2) tenants by variant (top-7 + "others"), (3) users by
  sign-in state (local / Google / admin). Legends carry count + percentage. The
  per-user horizontal bar charts remain below the donut row. The users table gains a
  debounced client-side search and a pager (25/page; server-side pagination deferred
  past ~150 users — follow-up ticket). `/admin/stats` caches per-tenant `dirSize()`
  for 60 s (the O(total-files) wall).
- **D-PR5 (R6 + R7)**: `loadSessions()` groups by variant by default with a persisted
  `gw-grouping` toggle (variant | recency) at the SESSIONS header; recency order
  inside groups; collapsible groups with remembered state; Today badge; no empty
  groups. "+ New chat" becomes "+ New team": a compact modal lists catalog variants
  from `/v1/models` (own β toggle), optional name, `POST /sessions` → sidebar refresh +
  auto-select (⏳ provisioning tag already renders). The composer sends to
  `POST /tenants/:id/chat` for the selected team (error routes the user back to
  creation); the model select lists only variants of the user's teams; zero-team and
  deleted-last-team states show a "Create a team" CTA reusing the modal; suggestion
  chips open the modal with the message carried through and auto-sent after creation
  (creation failure returns the message to the composer).

## 5. Compatibility notes

- Bearer-key wire surfaces keep lazy provisioning — their open-mode tests must pass
  UNTOUCHED (co-workspace-server.test.ts:204-257 + anthropic/gemini suites). This is
  the regression tripwire.
- Breaking change (recorded): `POST /admin/users/:id/reset-password` response changes
  `{resetToken}` → `{tempPassword}`; `PATCH /auth/me` drops `name` handling and now
  requires `currentPassword`.

## 6. Verification Plan

1. Per-PR: `bun test tests/unit/co-workspace*` (104+ tests) + `tsc --noEmit` +
   `bun scripts/audit.ts --spec-check`; web parse guard covers every index.html edit.
2. PR0 adds: mine=1-with-cookie test; chat-after-`POST /sessions`-hits-same-tenant test.
3. Post-merge of each PR: Docker rebuild + loopback smoke; final GUI pass (browser):
   header order, logout confirm, reset modal copy, password popup, email change,
   donut row rendering in dark AND light themes, variant grouping toggle, team
   creation → chat.
4. Preview verification (ADR-0070): screenshots at ≥2 breakpoints (1280×800, 900×700)
   for the admin panel and sidebar changes.

## 7. Accessibility & Preview Verification Statements

- **Accessibility (ADR-0065)**: WCAG 2.1 AA baseline. Modals get `role="dialog"` +
  `aria-modal` + labelled headings; the copy button is a real `<button>` with a
  `role="alert"` status line ("Copied"); donuts carry `role="img"` + `aria-label`
  summarizing the slices (legend is the text alternative); the grouping toggle is a
  real button with `aria-pressed`; confirm dialogs keep the native `confirm()` pattern
  already used for deletes.
- **Preview Verification (ADR-0070)**: required — user-facing UI wave. Rendered
  evidence (screenshots, dark + light, two breakpoints) attached to the final PR
  description before close-out.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Lockout window between ✎ removal and working temp-password reset | PR2 lands BEFORE PR3 (sequential); modal + rotation tested together |
| API consumers break if lazy provisioning is touched | Wires untouched; open-mode tests are the tripwire |
| Clipboard unavailable on LAN http | Fallback ladder ends in manual select + "press Ctrl-C" hint |
| Single-file front-end concentration | Small sequential PRs, parse guard per PR, GUI pass per wave |
| Donut misread (dissent seat HOLD recorded) | Composition subjects per user decision; top-7+others cap; legends carry numbers; per-user detail stays tabular |
| Parallel working-tree sessions sweep uncommitted changes | Re-apply + immediate commit (encountered 2026-09-28 during PR0; recovery documented in memory log) |

## 9. Addendum (2026-10-01): R1 forced-rotation enforcement repaired (T-20261001-014)

Fleet verification found the R1 forced first-login rotation shipped as dead code:
`web/index.html` called `forcePasswordChange()` at login (R1 invariant step 3) and
at boot, but no implementation of the function ever landed — a must-change session
dropped straight into the normal app, and the boot-path ReferenceError also skipped
`renderAuthCard()`. The server likewise had no gate, so an un-rotated temp-credential
session could use every API area.

Repair (both halves of the R1 shape (A) contract, invariant-restoring):

1. **Web** — `forcePasswordChange()` implemented as the designed blocking dialog
   (`showModal` `dismissible: false`): new password twice, `PATCH /auth/me` without
   `currentPassword` (the temp credential was verified at sign-in), then drop to the
   signed-out card for re-login — rotation purges every session server-side
   (`completeTempPasswordChange`, SEC-06), so the client must re-authenticate.
2. **Server** — a must-change session is confined to `/auth/*` plus the GET shell
   pages the dialog renders on (`/`, `/login`, `/app-helpers.js`, `/health`);
   everything else answers `403 password change required` until rotation completes.
   API-key callers carry no session and are unaffected.

Test: `co-workspace-phase2b` "R1 gate: a must-change session is confined to the auth
surface and shell pages" (403 on `/tenants` and `/v1/models`, 200 shell + `/auth/me`
flag, rotation, re-login 200). Full co-workspace suites and typecheck green.
