# Gateway Admin Console (user/group-centric) — Design (Row 0)

- **Spec id**: `2026-11-09-gw-admin-console-design`
- **Date**: 2026-11-09
- **Status**: implemented (PRs #1938, #1939)
- **Author**: architect (PM-dispatched, Design Gate Row 0, design only)
- **Decision provenance**: approved plan `co-workspace-admin-serene-possum` (user-confirmed scope: users, groups, bulk operations, and group policy, delivered as a separate `/admin` page)
- **Related**: `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` §4.1 (groups tables, migration runner), session-hardening D4 (`requireAdminReauth`), T-20261003-027 (`requireAdminReady`), SEC-05 (tenant cap / principal quota), SEC-09 (CSRF header)

All paths below are relative to `services/co-workspace/` unless stated otherwise.

## 1. Context and problem

The admin surface is one panel embedded in the chat SPA (`web/index.html`, `#adminView`, roughly lines 1290-1720). It has four gaps:

- **Tenant-centric.** Stats are keyed by tenant `ownerPrincipal`.
- **Row-at-a-time.** Rename, reset password, and delete each act on one user.
- **No user groups.** The `groups` / `user_groups` tables (migration v1) serve only the tenant loop.
- **Global quotas only.** `CO_WORKSPACE_TENANT_MAX_*` and `principalMaxTokens` are read straight from `cfg` in `access.ts`.

This design adds the following:

- A standalone console at `GET /admin`, organized around users and groups.
- Bulk operations and CSV import/export.
- Group policies resolved strictest-wins.
- User suspension.
- Tenant views filtered by owner or group.

## 2. Scope and non-goals

**In scope:**

- Migration v3.
- `UserStore` group, membership, and suspension methods.
- `src/policy.ts` and its wiring into `access.ts`.
- Splitting the admin routes into modules, plus the new endpoints.
- A tenant archive flag.
- `web/admin.html` and `web/admin.js`, and removing the admin panel from `index.html`.
- Tests.

**Non-goals:**

- No change to tenant-loop semantics, the registry export schema, or the `/admin/tenant-loop/*` contracts.
- No per-tenant policy overrides. Policy attaches to groups only.
- No new authentication factor. Reauth stays on `x-admin-password`.
- No pagination change to existing endpoints except the new filters on `/admin/audit`.
- Policy follows the trusted principal on every channel (review M3). A session user, or an API key whose label equals a user principal, is bound by that user's general groups. Group policies only tighten, so this fails closed. A key whose label is a suspended or deleted account's principal carries no identity (review M2). Anonymous callers keep the cfg values.
- Login IDs and key labels share one principal namespace. Signup, Google signup, and CSV import refuse `anonymous`, `default`, `system`, `u-<12 hex>`, and any configured API-key label (review namespace rule).

## 3. Schema: migration v3

Append to `MIGRATION_STEPS` in `src/migrations.ts`. `MIGRATION_HEAD` becomes 3, so the downgrade guard applies automatically. Each `ALTER` is wrapped in try/catch (idempotent, same pattern as v2).

```ts
{
  version: 3,
  name: "admin console: general groups (kind/policy/description) + users.disabled_at + user_groups(principal) index",
  up(db: Database): void {
    for (const stmt of [
      "ALTER TABLE groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'loop'",
      "ALTER TABLE groups ADD COLUMN policy TEXT",
      "ALTER TABLE groups ADD COLUMN description TEXT",
      "ALTER TABLE groups ADD COLUMN created_at TEXT",
      "ALTER TABLE users ADD COLUMN disabled_at TEXT",
    ]) { try { db.exec(stmt); } catch { /* already applied */ } }
    // Existing rows are tenant-loop groups (the DEFAULT already sets this; explicit for clarity).
    db.exec("UPDATE groups SET kind='loop' WHERE kind IS NULL OR kind=''");
    db.exec("CREATE INDEX IF NOT EXISTS idx_user_groups_principal ON user_groups(principal)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_groups_kind ON groups(kind)");
  },
}
```

Column semantics:

| Column | Type | Meaning |
|---|---|---|
| `groups.kind` | `'general' \| 'loop'` | `loop`: membership is mirrored from `loop_config.designatedUsers` (read-only through the general API). `general`: membership is owned by `user_groups`. |
| `groups.policy` | JSON text or NULL | `GroupPolicy` (§5). NULL means no opinion. |
| `groups.description` | text or NULL | Free text, at most 500 chars. |
| `groups.loop_config` | (unchanged, NOT NULL) | General groups store `'{"designatedUsers":[]}'` to satisfy NOT NULL. Never read for general groups. |
| `users.disabled_at` | ISO text or NULL | Non-NULL means suspended (§7). Separate from `deleted_at`. |

`user_groups` becomes the membership single source of truth for **all** kinds. The loop-group mirror write in `upsertGroup` is unchanged.

**Live data.** v3 runs at startup through the `UserStore` constructor. Test it against copies of `data.bak-*` (§11).

## 4. UserStore API (`src/users.ts`)

`UserRecord` gains `disabledAt: string | null`, mapped from `disabled_at`. New types:

```ts
export type GroupKind = "general" | "loop";
export interface GroupRecord {
  groupId: string; name: string; kind: GroupKind; description: string | null;
  policy: GroupPolicy | null; memberCount: number; createdAt: string | null;
}
export interface UserQuery {
  q?: string;                       // substring on principal/name, case-insensitive (LIKE with escaped %_)
  group?: string;                   // group_id
  status?: "active" | "pending" | "suspended" | "deleted";
  role?: "user" | "admin";
  page?: number;                    // 1-based, default 1
  size?: number;                    // default 50, max 200
}
```

Methods. All are synchronous and run inside `db.transaction` where they write more than one row.

```ts
// groups (general CRUD; loop groups stay on upsertGroup/getGroup/listGroups/deleteGroup)
createGroup(init: { groupId: string; name: string; description?: string; policy?: GroupPolicy | null }): GroupRecord; // kind='general'; throws on duplicate id
getGroupRecord(groupId: string): GroupRecord | undefined;            // any kind
listGroupRecords(opts?: { kind?: GroupKind }): GroupRecord[];        // with memberCount
updateGroup(groupId: string, patch: { name?: string; description?: string | null }): GroupRecord | undefined;
setGroupPolicy(groupId: string, policy: GroupPolicy | null): GroupRecord | undefined;  // any kind
deleteGeneralGroup(groupId: string): boolean;                        // refuses kind='loop' (returns false)

// membership (general groups only; loop membership is edited via /admin/tenant-loop/config)
addMembers(groupId: string, principals: string[]): { added: number; unknown: string[] };   // unknown = no live user
removeMembers(groupId: string, principals: string[]): { removed: number };
listMembers(groupId: string): string[];
groupsOf(principal: string): GroupRecord[];                          // uses idx_user_groups_principal

// users
queryUsers(q: UserQuery): { users: UserRecord[]; total: number };
setDisabled(userIds: string[], disabled: boolean): number;           // disabling also DELETEs their sessions (same tx)
setRole(userIds: string[], role: "user" | "admin"): number;
countActiveAdmins(): number;                                          // role='admin' AND deleted_at IS NULL AND disabled_at IS NULL
removePrincipalFromAllGroups(principal: string): void;               // called by user delete
```

Changes to existing methods:

- `listGroups()` and `getGroup()` add `WHERE kind='loop'`. Their consumers (`buildTenantLoopExport`, `tenant-loop.ts:392,539`, `access.ts:281`) then see only loop groups.
- `upsertGroup()` writes `kind='loop'` on insert. It must refuse (throw) when the existing row is `general`.
- `resolveSession()` treats a user with `disabledAt` set as no session (§7).

Principals are validated against `^[a-z0-9-]{3,32}$` (the login-ID rule) before any insert.

## 5. Policy resolution (`src/policy.ts`)

```ts
export interface GroupPolicy {
  maxTenants?: number;        // positive integer; tenants owned by the principal
  maxTurns?: number;          // positive integer; per tenant, in cfg.quotaWindow
  maxTokens?: number;         // positive integer; per tenant, in cfg.quotaWindow
  maxPrincipalTokens?: number;// positive integer; lifetime across all owned tenants
  allowedVariants?: string[]; // non-empty subset of cfg.variants
}
export interface EffectivePolicy {
  maxTenants: number; maxTurns: number; maxTokens: number; maxPrincipalTokens: number; // 0 = unlimited
  allowedVariants: string[] | null;                    // null = no restriction beyond cfg.variants
  sources: Record<keyof GroupPolicy, string[]>;        // "cfg" and/or group ids that set the winning value
}
export function validateGroupPolicy(raw: unknown, cfg: GatewayConfig): GroupPolicy;   // throws HttpError(400,"invalid_policy")
export function resolveEffectivePolicy(cfg: GatewayConfig, groups: GroupPolicy[]): EffectivePolicy;
export function effectivePolicyFor(state: GatewayState, principal: string): EffectivePolicy;
// = resolveEffectivePolicy(state.cfg, state.users.groupsOf(principal).filter(g => g.kind === "general" && g.policy).map(g => g.policy))
// Loop groups never carry policy (review M1 — §8.3): only kind='general' groups are considered.
```

**Strictest-wins algorithm:**

- **Numeric fields.** For each numeric field `f` with cfg counterpart `c` (`maxTenants↔tenantMaxPerPrincipal`, `maxTurns↔tenantMaxTurns`, `maxTokens↔tenantMaxTokens`, `maxPrincipalTokens↔principalMaxTokens`), take the candidates `{cfg[c] if cfg[c] > 0} ∪ {g[f] for each group policy where g[f] is defined}`. The effective value is `min(candidates)`, or `0` (unlimited) when there are no candidates.
- **No loosening.** A group can only tighten. `validateGroupPolicy` rejects `0` and negative values, so "unlimited" cannot be expressed by a group.
- **`allowedVariants`.** Intersect every defined group list. When no group defines it, the result is `null`. An empty intersection means no variant is allowed, which is a deliberate deny: error `variant_not_allowed`.

**Backward-compatibility proof.**

- **No group policy.** If the principal is in no group, or every group's `policy` is NULL, `groups = []`. Each numeric candidate set is then `{cfg[c]}` when `cfg[c] > 0`, giving exactly `cfg[c]`; otherwise it is empty, giving `0`. Both match today's `max <= 0 → off` checks. `allowedVariants = null` adds no check. Every assertion in §6 therefore compares against the same number as today, and behavior is identical.
- **Existing loop groups.** They have `policy = NULL` after v3, so the result holds for every user on upgrade. Even a non-NULL policy written to a loop group directly is ignored by `effectivePolicyFor` (review M1).
- **Stored policy is re-validated on read (review L3).** A non-positive or non-numeric numeric field, or a non-string-array `allowedVariants`, is dropped when the row is loaded, so it counts as no opinion.

Unit tests assert this equivalence (§11).

## 6. `access.ts` change points

The cfg-only signatures stay valid for callers that do not pass a policy, which keeps the diff minimal and old tests green.

| Function | Change |
|---|---|
| `assertTenantCap(state, owner)` | `const max = effectivePolicyFor(state, owner).maxTenants` replaces `state.cfg.tenantMaxPerPrincipal`. Message and 429 unchanged. Callers: `lifecycle.ts:316`, `routes/tenants.ts:101`; unchanged. |
| `assertPrincipalQuota(state, principal)` | `max = effectivePolicyFor(state, principal).maxPrincipalTokens`. Callers unchanged. |
| `assertQuota(cfg, rec, dayKey?, limits?)` | New optional 4th param `limits?: { maxTurns: number; maxTokens: number }`, defaulting to `{cfg.tenantMaxTurns, cfg.tenantMaxTokens}`. Callers (`responses.ts:49`, `routes/tenants.ts:198`, `routes/compat.ts:23,38`, `routes/gemini.ts:41`) pass `effectivePolicyFor(state, rec.ownerPrincipal ?? "anonymous")`. Also add the archived check here: `rec.archivedAt` set → `HttpError(409, "tenant_archived")`. |
| `assertProvisioningAllowed(state, req, variant)` | Keep the existing auth check first. Then, if the caller principal is non-null: `ap = effectivePolicyFor(...).allowedVariants`; if `ap && !ap.includes(variant)`, audit `tenant.provision.denied` with detail `variant-policy`, then throw `HttpError(403, "variant_not_allowed")`. Callers: `lifecycle.ts:337`, `routes/tenants.ts:45`. |
| `requireAdminReady` / `requireAdminReauth` | No code change. They inherit suspension through `resolveSession`, so a suspended admin resolves no session and gets 403. |
| `assertTenantLoopAllowed` | No change (`getGroup` is now loop-filtered). |

**Performance.** `effectivePolicyFor` costs one indexed query per call (`groupsOf`). It is called at most twice per turn, so no cache is needed.

## 7. Suspended-user semantics

- **Suspend.** `setDisabled(ids, true)` sets `disabled_at = now` and deletes every session row for those users in the same transaction, so existing sessions are revoked immediately.
- **Session.** `resolveSession` loads the user. If `disabledAt` is set, it deletes the presented session row and returns `null`. Every route then sees the caller as unauthenticated: 401 or a `/login` redirect under `loginRequired`, and 403 `admin only` on admin routes.
- **Login.** `POST /auth/login` checks `disabledAt` **after** password verification succeeds, so a wrong password still returns the uniform 401 and does not reveal suspension. It then audits `login.denied.disabled` and returns 403 `{ error: "account_disabled" }`. The Google callback (`routes/auth.ts:289`) applies the same check before `createSession`.
- **Activate.** Clears `disabled_at`. No session is restored.
- **Tenants.** Suspension does not touch tenants. An admin can archive them separately.
- **Listing.** `status` precedence is `deleted > suspended > pending > active`.

## 8. Endpoints

### 8.1 Common rules

- **Authz.** Every route calls `requireAdminReady`. Routes marked **R** also `await requireAdminReauth` (header `x-admin-password`). Bulk and reauth run before any parsing of side effects.
- **CSRF.** Every non-GET request goes through the existing SEC-09 guard (`x-requested-with: co-workspace`). The console always sends the header. §10 makes it mandatory for `/admin/*` even when an API key is present.
- **Errors.** Errors use `HttpError(status, code)` with body `{ "error": "<code>" }`. Shared codes:
  - `400 invalid_request`, `400 invalid_policy`
  - `403 admin only`
  - `403 reauth_required` (existing message kept)
  - `404 not_found`
  - `409 conflict`, `409 loop_group_readonly`
  - `413 payload_too_large`
  - `422 self_lockout`, `422 last_admin`
- **Limits.**
  - Bulk `ids`: 1–500, deduplicated; otherwise `400 invalid_request` / `413 payload_too_large`.
  - CSV import: ≤ 1 MB body (checked against `content-length` and the actual byte count) and ≤ 2000 data rows; otherwise `413`.
  - Member batches: ≤ 500 principals.
  - Page size: ≤ 200.
- **Bulk results.** These are per-item, never all-or-nothing: `{ "ok": n, "failed": [{ "id": "...", "error": "<code>" }] }`. Each successful item writes one audit record. The request also writes one summary record with action `<area>.bulk.<action>` and detail `ok=n failed=m`.

### 8.2 Users (`src/routes/admin/users.ts`)

| Method / path | Authz | Request | Response | Audit |
|---|---|---|---|---|
| `GET /admin/users` | ready | query `q, group, status, role, page, size` | `{ users: [{ id, principal, loginId, name, role, status, groups: string[], tenantCount, usage: { input, output }, createdAt, disabledAt }], total, page, size }` | — |
| `POST /admin/users/bulk` | ready + **R** for `suspend`, `activate`, `delete`, `set-role`, `remove-group`; ready only for `add-group` | `{ ids: string[], action, role?, groupId?, disposition?: "delete"\|"keep" }` | bulk result | `user.suspend`, `user.activate`, `user.delete`, `user.set-role`, `group.member.add`, `group.member.remove` (target = principal) |
| `GET /admin/users/export.csv` | ready | same filters as list (no paging) | `text/csv; charset=utf-8`, `content-disposition: attachment; filename="users-YYYYMMDD.csv"`, `x-content-type-options: nosniff`, `cache-control: no-store`; columns `loginId,name,role,status,groups,tenantCount,createdAt` (groups joined by `;`) | `user.export` (detail `rows=n`) |
| `POST /admin/users/import?dryRun=1` | ready + **R** when not a dry run | `text/csv` body; header `loginId,name,role,groups`; at most 2000 rows for a dry run and 200 for a real import | `{ dryRun, created: [{ loginId, tempPassword? }], skipped: [{ row, loginId, error }] }`; `tempPassword` only when not a dry run, sent with `cache-control: no-store` | `user.import` (detail `created=n skipped=m reasons=<reason:count,...>`, plus `error=<name>` when it aborted; written even on a mid-loop failure), `user.create` per row |
| `GET /admin/users/:id/effective-policy` | ready | — | `EffectivePolicy` plus `groups: [{ groupId, name, policy }]` | — |
| (existing) reset-password, rename, delete | unchanged | | | unchanged |

Rules:

- `id` is the user id. The UI also accepts a principal and resolves it.
- **`delete` reuses the existing single-delete core.** Extract a `deleteUserWithTenants(state, user, disposition, actor)` helper from `routes/admin.ts:116-140` and use it from both paths. It also calls `removePrincipalFromAllGroups`.
- **Import:**
  - Each `loginId` must match the login rule. Duplicates are skipped with `login_taken`. Reserved names (namespace rule, §10) are skipped with `reserved_login`.
  - `role` is `user|admin`, default `user`.
  - Groups that are unknown or `loop` are skipped with `unknown_group`.
  - Accounts are created verified, with `mustChangePassword = true` and a temp password through the existing temp-credential issuer (the same as reset-password, including expiry).
  - A dry run performs every validation and writes nothing.

### 8.3 Groups (`src/routes/admin/groups.ts`)

| Method / path | Authz | Request | Response | Audit |
|---|---|---|---|---|
| `GET /admin/groups?kind=` | ready | | `{ groups: GroupRecord[] }` | — |
| `POST /admin/groups` | ready | `{ groupId (^[a-z0-9-]{2,40}$), name (1–80), description?, policy? }` | `201 GroupRecord` | `group.create` |
| `GET /admin/groups/:id` | ready | | `GroupRecord & { members: string[] }` | — |
| `PATCH /admin/groups/:id` | ready | `{ name?, description? }` | `GroupRecord` | `group.update` |
| `DELETE /admin/groups/:id` | ready + **R** | | `{ ok: true }`; `409 loop_group_readonly` for loop groups | `group.delete` (detail `members=n`) |
| `POST /admin/groups/:id/members` | ready | `{ principals: string[] }` (≤500) | `{ added, unknown }`; 409 for loop | `group.member.add` (detail `n`) |
| `DELETE /admin/groups/:id/members` | ready + **R** | `{ principals: string[] }` | `{ removed }`; 409 for loop | `group.member.remove` |
| `PUT /admin/groups/:id/policy` | ready + **R** (always) | `GroupPolicy` or `null` | `GroupRecord`; `409 loop_group_readonly` for loop groups | `group.policy.update` (detail = canonical JSON) |

Loop groups carry no policy (review M1): `PUT /admin/groups/:id/policy` on a `kind='loop'` group returns `409 loop_group_readonly`, and `effectivePolicyFor` ignores loop-group rows even if one is written directly. Their membership is edited only through `/admin/tenant-loop/config`.

### 8.4 Tenants (`src/routes/admin/tenants.ts`)

| Method / path | Authz | Request | Response | Audit |
|---|---|---|---|---|
| `GET /admin/tenants` | ready | query `owner, group, variant, status (active\|archived), page, size` | `{ tenants: [{ tenantId, name, variant, ownerPrincipal, archivedAt, sessions, inputTokens, outputTokens, createdAt }], total, page, size }` | — |
| `POST /admin/tenants/bulk` | ready + **R** | `{ ids, action: "archive"\|"restore"\|"delete" }` | bulk result | `tenant.archive`, `tenant.restore`, `tenant.delete` |

Rules:

- **Archive flag.** Archive sets `archivedAt` on `TenantRecord`. It rides the existing `tenants.data` JSON column (no DDL, same pattern as the tenant-loop override) and is persisted through `state.registry`. An archived tenant rejects turns with `409 tenant_archived` (§6) and still counts toward `maxTenants`.
- **Restore** clears the flag.
- **Delete** calls `deleteTenantData(state, rec, actor)` from `lifecycle.ts:373`.
- **Group filter.** `group` matches tenants whose `ownerPrincipal` is in `listMembers(group)`.

### 8.5 Existing endpoints

`/admin/stats`, `/admin/turn-config`, `/admin/mail-outbox`, and `/admin/tenant-loop/*` are unchanged. `/admin/audit` gains `actor`, `action` (prefix match), `page`, and `size` (≤200) filters. Without filters, the response stays the same as today.

## 9. Route split and UI

### 9.1 Module split

```
src/routes/admin/index.ts     handleAdmin(state, req, ctx): tries each module in order, returns null if none matched
src/routes/admin/legacy.ts    current admin.ts body (stats, single-user ops, audit, turn-config, mail-outbox, cancel), moved verbatim
src/routes/admin/tenant-loop.ts  /admin/tenant-loop/* block, moved verbatim
src/routes/admin/users.ts     §8.2
src/routes/admin/groups.ts    §8.3
src/routes/admin/tenants.ts   §8.4
src/routes/admin/shared.ts    parseBulkIds, readCsvBody, csvCell, bulkResult, assertNotSelfOrLastAdmin
```

- `server.ts:32` changes its import to `./routes/admin/index`. The export name `handleAdmin` is unchanged.
- Delete `src/routes/admin.ts`.
- Do the moves in a separate commit from behavior changes, so the diff can be reviewed.

### 9.2 Page route

`adminPage(state, req)` in `src/pages.ts` serves `web/admin.html` at `GET /admin`. Add `/admin.js` as a static asset alongside `/app-helpers.js`.

- **Non-admin callers.** If `resolveSession` is not an admin with a password set, the response is `302 → /`.
- **Routing.** Register this before the `/admin/*` API in `handleAdmin` and match `path === "/admin"` exactly.
- **Gates.** `loginRequired` and R1 must-change-password gates apply unchanged. `/admin` is not in the R1 shell list.

### 9.3 Console information architecture

The console is a left nav plus a content pane, with hash routing. Unknown hashes go to `#/dashboard`. It uses the same CSS variables and theme as `index.html` and reuses `web/app-helpers.js` for fetch, escaping, and theme.

| Nav | Hash route | Content |
|---|---|---|
| Dashboard | `#/dashboard` | `/admin/stats` cards |
| Users | `#/users`, `#/users/:id` | search, filters, paging, checkbox multi-select, bulk bar, CSV import (dry-run first) and export; drawer with details, groups, effective policy, and owned tenants |
| Groups | `#/groups`, `#/groups/:id/members`, `#/groups/:id/policy` | list with member counts; members tab (search-add, paste list); policy tab |
| Tenants | `#/tenants` | owner, group, variant, and status filters; bulk archive, restore, delete |
| Policies | `#/policies` | read-only matrix of groups × policy fields, plus the cfg baseline row |
| Tenant Loop | `#/tenant-loop` | existing section, moved |
| Audit Log | `#/audit` | filters for actor, action, page |
| System | `#/system` | turn-config, mail outbox |

**Reauth flow.** Destructive actions open a password prompt. The password is held in memory for that single request only and is never stored.

### 9.4 Migration path for `index.html`

1. Ship `/admin` with all sections, including ports of the stats, user table, and tenant-loop code.
2. In the same PR:
   - Change `#adminMenu` to `<a id="adminMenu" href="/admin">`, keeping its visibility toggle at line 1291.
   - Delete the `#adminView` container, its CSS (lines 138-172), and the panel JS (the `adminMenu` click handler through the end of the tenant-loop section, about lines 1327-1720).
   - Remove `adminView` from the chat/view toggle at line 1059.
3. Update `tests/unit/co-workspace-admin-ui.test.ts` assertions so they look for the panel in `web/admin.js` instead of `index.html`. A grep test asserts that `index.html` no longer contains `adminView`.

## 10. Security considerations

- **CSV injection.** `csvCell(v)` does three things:
  - Prefixes `'` to any cell whose first char is `=`, `+`, `-`, `@`, tab (`\t`), or CR.
  - Quotes cells containing `,`, `"`, CR, or LF, doubling inner `"`.
  - Applies to every exported field, including names.

  Import parses with an RFC 4180 reader, trims values, and rejects rows whose `name` would need the prefix (`invalid_name`) instead of silently storing formula text.
- **Self-lockout guards.** `assertNotSelfOrLastAdmin(state, caller, targets, action)` runs per item before mutation and yields per-item `failed` entries:
  - Self as target of `suspend`, `delete`, or `set-role` to `user` → `self_lockout`. This also covers the existing single delete route.
  - An action that would drop `countActiveAdmins()` to 0, counting all targets in the batch together → `last_admin`. When this triggers, every admin target in that batch is rejected. A partial batch must not leave the system with zero admins.
- **CSRF.** For `/admin/*` non-GET requests, require `x-requested-with: co-workspace` unconditionally, even when `csrfRequired` is false because of an API key. Session cookies are the console's credential, and the header costs nothing. Implement it in `handleAdmin`.
- **Reauth.** Required for:
  - bulk `suspend`, `activate`, `delete`, `set-role`, and `remove-group`
  - tenant bulk (all actions)
  - group delete
  - group member removal (`DELETE /admin/groups/:id/members`)
  - group policy writes (`PUT /admin/groups/:id/policy`, always)
  - non-dry-run import

  A failed reauth is audited `admin.reauth.failed` (existing behavior). Reauth attempts share the login limiter's per-account budget (`reauth:<principal>`, 10 per 15 minutes); a success clears it. Once the budget is spent, the attempt returns `429` and is audited `admin.reauth.failed` with detail `rate-limited` (review L6).
- **Last-admin re-check (review L1).** Bulk and single delete re-check `countActiveAdmins()` immediately before the soft delete of an admin target. A refusal is `last_admin` (per item in bulk, `409` on the single route) and happens before any tenant side effect.
- **Input bounds.** §8.1 limits are checked before any DB work. LIKE patterns escape `%`, `_`, and `\`. Every SQL statement uses bound parameters. Policy JSON is re-serialized from the validated object and never stored raw.
- **Temp passwords** appear only in the non-dry-run import response and the reset-password response. Both are sent with `cache-control: no-store` (review L6), and they are never audited or logged. Import hashes temp passwords with the async hasher in batches of 20 that yield to the event loop, and a real import is capped at 200 rows (review M5).
- **Namespace.** Login IDs and API-key labels share the principal namespace. Signup, Google signup, and CSV import refuse `anonymous`, `default`, `system`, any value matching `^u-[0-9a-f]{12}$`, and any configured API-key label (`reserved_login` on import). Signup and Google signup answer `409`.
- **Suspension** revokes sessions atomically (§7). Login does not leak suspension state on a wrong password.
- **Information exposure.** `/admin` HTML is served only to admins. API authz is still enforced server-side; the redirect is cosmetic.

## 11. Test matrix (`tests/unit/co-workspace-admin-*.test.ts`)

| File | Cases |
|---|---|
| `admin-migration-v3` | fresh DB reaches v3; v2 DB with loop groups → `kind='loop'`, policy NULL, rows intact; idempotent re-run; downgrade guard at user_version 4; run against a temp copy of `data.bak-*/users.db` when present (skip otherwise) |
| `admin-policy` | no groups equals cfg for every field (equivalence table, including cfg 0); a group tightens; a group cannot loosen; min across groups; `allowedVariants` intersection and empty deny; `validateGroupPolicy` rejects 0, negatives, and unknown variants |
| `admin-access` | `assertTenantCap` 429 at group `maxTenants=1`; `assertQuota` uses effective limits; archived → 409; provisioning `variant_not_allowed` 403 plus audit; loop-group consumers see only `kind='loop'` |
| `admin-suspend` | suspend revokes sessions; `resolveSession` returns null; login with correct password → 403 `account_disabled`; wrong password → 401; activate re-allows login; suspended admin → 403 on `/admin/*` |
| `admin-users-api` | list filters and paging; bulk without reauth → 403; bulk with reauth → per-item results; ids > 500 → 413; self-suspend → `self_lockout`; last admin → `last_admin`; set-role; add-group to a loop group → 409; audit records per item plus summary |
| `admin-csv` | export escapes `=`, `+`, `-`, `@`, tab, CR; quoting round-trip; import dry run writes nothing; > 1 MB and > 2000 rows → 413; duplicate and invalid rows skipped; temp password and `mustChangePassword` set |
| `admin-groups-api` | CRUD; loop group delete or membership edit → 409; policy PUT validation; members ≤ 500 |
| `admin-tenants-api` | owner and group filters; bulk archive, restore, delete (delete calls `deleteTenantData`); reauth required |
| `admin-csrf-page` | non-GET `/admin/*` without header → 403 even with an API key; `GET /admin` as non-admin → 302 `/`; as admin → 200 HTML; `index.html` has no `adminView` |
| existing suites | `co-workspace-admin-ui`, tenant-loop, and auth-hardening stay green (updated only where §9.4 moves the code) |

Run with `cd services/co-workspace && bun run test`, then `bun run test:unit` from the repo root.

## 12. Implementation order

| Order | Step |
|---|---|
| 1 | migration v3, `UserStore` methods, `policy.ts`, `access.ts` wiring, suspension, plus their tests |
| 2 | route split (verbatim move commit), then new endpoints, CSV, guards |
| 3 | `admin.html` / `admin.js`, `/admin` page, `index.html` strip |
| 4 | security review of §10 |
| 5 | QA and `/sync` |
