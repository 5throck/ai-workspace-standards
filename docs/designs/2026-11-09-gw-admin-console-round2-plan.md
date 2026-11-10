# co-workspace Admin Console — round 2: working group creation, policy CRUD, user/group-centric tenant loop

> **Status:** Approved plan (2026-11-09, user gate) — pending implementation, as amended by the unit-model amendment below (2026-11-09, user decision; four-role review ratified). Extends `docs/designs/2026-11-09-gw-admin-console-design.md`.

## Handoff notes (for implementing with another tool)
- **Repo:** `/Users/techcross/git/ai_workspace`. Service: `services/co-workspace` (Bun + TypeScript, SQLite via `bun:sqlite`). Tests live in `tests/unit/co-workspace-*.test.ts`.
- **Start state:**
  - PRs #1938 (admin console) and #1939 (signed-out `/admin` redirect) are merged into `main`.
  - Branch from the latest `main` (`git checkout main && git pull`).
  - The round-1 spec is `docs/designs/2026-11-09-gw-admin-console-design.md`. Read it first; this plan extends it.
- **Live deployment:**
  - The gateway runs in Docker (`co-workspace-co-workspace-1`, port 9030), built by `services/co-workspace/docker/rebuild.sh`. Live data is bind-mounted from `services/co-workspace/data`, and the live `users.db` is at migration v3.
  - Back up `data/` (`cp -a data data.bak-<ts>`, already gitignored) and dry-run the migration on a copy before any redeploy.
- **Workspace rules:**
  - Commit only through `/sync` (`bun scripts/dev-sync.ts --body-file <git-dir>/sync-pr-body.md "<msg>"`). Direct `git commit` and `--no-verify` are blocked by hooks.
  - Stage task files explicitly and run with `SYNC_SCOPED_STAGING=1`.
  - Add a `CHANGELOG.md` entry first.
  - All docs, commits and PRs must be in English.
- **Known gotchas from round 1:**
  - The pre-commit regex blocks lines like `API_KEY = "…"` in tests, so use names like `FIXTURE_KEY`.
  - Windows CI checks files out with CRLF, so split checked-in files on `/\r?\n/`.
  - Every non-GET `/admin/*` call needs the `x-requested-with: co-workspace` header.
- **Gates before PR:**
  - `cd services/co-workspace && bun run test`
  - `bunx tsc --noEmit -p .`
  - `bun scripts/audit.ts`
  - `trail check`

## Context
The user tested the deployed `/admin` console (PRs #1938/#1939) and reported three gaps:
1. **Group creation does not work.** The live DB is v3 and `createGroup` inserts correctly (`src/users.ts` around line 721), but the audit log has no `group.create` row and the container logs show no error. So the request most likely fails at validation. The likely cause is the group id field (`GROUP_ID_RE = /^[a-z0-9-]{2,40}$/`, `src/routes/admin/groups.ts:13`): a Korean or uppercase id returns a bare `invalid_request`. The UI then shows only a transient flash (`createGroupFlow`, `web/admin.js` around line 812). This must be confirmed by reproduction before fixing.
2. **Policies have no CRUD.** A policy exists only as a JSON blob on a group (`groups.policy`). The Policies menu is a read-only matrix.
3. **The tenant loop is tenant-centric.** Register, suspend and deregister act on one tenant at a time (`src/routes/admin/tenant-loop.ts`). Loop groups are a separate `kind='loop'` and cannot be general user groups.

The user chose these models:
> **SUPERSEDED 2026-11-09** — see the amendment section. Policies attach to GROUPS ONLY; there is no per-user assignment.

- **Named policies:** reusable, with CRUD, assigned to groups and to individual users. The effective limit is the strictest of all assigned policies.
> **SUPERSEDED 2026-11-09** — see the amendment section. Enrollments are keyed (group_id, variant) with a `'*'` wildcard; there are no user enrollments and NO per-tenant exceptions.

- **Group/user enrollment in the tenant loop:** loop groups merge into the user groups. A group or user is enrolled with a schedule and scopes, and all of its tenants, including new ones, follow automatically. Per-tenant exceptions are kept.

## 2026-11-09 unit-model amendment (user decision — supersedes conflicting sections below)

> **This section rules.** On 2026-11-09, after this plan was approved, the user redefined the management unit. Where any text below (Context, Design, Verification) conflicts, this section wins; the conflicting prose is marked `> **SUPERSEDED 2026-11-09**` rather than deleted. The implementation requirements in part C were ratified by the 2026-11-09 four-role review. Line references in this section were verified against the worktree at `8943d3d16` (paths relative to `services/co-workspace/`).

### A. Redefined unit model (user decision, 2026-11-09)

1. **Policies attach to GROUPS ONLY.** No per-user policy targets exist: no `target_kind='user'` rows, no user-assignment API, no user-assignment UI. A user's effective limits are the strictest of the policies assigned to the user's groups plus the cfg baseline (`src/policy.ts` — `resolveEffectivePolicy` :77, `effectivePolicyFor` :125).
2. **Loop enrollments are keyed `(group_id, variant)`** with a `'*'` wildcard meaning "all variants". No per-user (target_kind/target_id) enrollments. A tenant is covered by the active enrollments of the groups its owner belongs to, where the enrollment's variant matches the tenant's variant or is `'*'`.
3. **Per-tenant exceptions/registrations are REMOVED.** `TenantRecord.loopStatus/loopGroup/loopOverride/loopGitRemote` (`src/tenant.ts:85-91`) are deprecated at v4 and are NEVER read afterwards; the per-tenant register/suspend/deregister exception endpoints go away. **Uncovered tenants are fail-closed: they are simply not exported.**
4. **Multiple enrollments covering one tenant resolve strictest-wins:** scopes AND per key (a scope is on only if every covering enrollment turns it on); windows intersect. If the window intersection is empty, or is not a single contiguous interval representable as one `LoopWindows` (one tz, one day-set, one start/end), the tenant is OMITTED from the export (fail-closed), an audit row `tenant.loop.export.window_unrepresentable` is recorded, and the explicit reason (which enrollments, why unrepresentable) is surfaced in the preview and in the upgrade 403.
5. The export JSON schema is unchanged (per-tenant rows, `src/tenant-loop.ts` `buildTenantLoopExportDetailed` :298); the resolver that feeds it changes as above.

### B. Co-governance ACL (rewrites `assertTenantLoopAllowed`, `src/access.ts:329-351`)

- **Governing = ALL active enrollment groups covering the tenant** (not a single `loopGroup`).
- **Operators = `loop_operators(group_id, principal)` of any covering group** — the permitted non-admin caller pool is the union of the covering groups' operator sets. No user-enrollments exist, so there is no user-based governing path.
- **Audit attribution = the sorted group set** (ascending, comma-joined) recorded in the detail of every allow/deny row.
- **Atomic switch:** `assertTenantLoopAllowed` is rewritten onto the `loop_operators` co-governance rule **in the same commit as the v4 migration** — today's `designatedUsers` fallback (`src/access.ts:345-349`) is deleted, not kept behind a flag. The QA-S2 rule stands: a caller can never act on a tenant by naming an arbitrary group.

### C. Review-ratified implementation requirements (2026-11-09 four-role review)

- **Migration v4 `up()` wraps its whole body in `db.transaction`.** The runner (`runMigrations`, `src/migrations.ts:138-157`) applies `step.up(db)` with no per-step transaction, so a mid-step crash would otherwise strand a half-applied v4.
- **The migration is declared ONE-WAY.** There is no v4 downgrade path; a downgrade loses v4 data (policies, assignments, enrollments, operators). Recovery = restore the pre-migration backup (`data.bak-<ts>`). Stated on the migration step and in the handoff notes.
- **Reauth matrix:** policy create = no reauth, but a create carrying inline assignments answers `409` (create first, then assign under reauth); read = no reauth; policy PATCH / delete / assign / unassign = reauth (`requireAdminReauth`, `src/access.ts:261`); every mutation is audited with old + new values.
- **Enrollment PUT/DELETE = admin + reauth only** (no operator path on the enrollment routes).
- **Compat shim: `PUT /admin/groups/:id/policy` (`src/routes/admin/groups.ts:116-130`) becomes 410 Gone** pointing at the policies API. It does not stay as a working shim.
- **Delete cascades:** deleting a group or a user cleans up that group's/principal's `policy_assignments`, `loop_enrollments`, and `loop_operators` rows — otherwise a reused group id would inherit the old id's policies and enrollments (inheritance escalation).
- **`policies.name` UNIQUE.** The data migration suffixes duplicate names (`<group name> limits`, `<group name> limits 2`, …).
- **Limits = the 5 `GroupPolicy` fields** — `maxTenants/maxTurns/maxTokens/maxPrincipalTokens/allowedVariants` (`src/policy.ts:13-19`), not the 4-field list in §2 below.
- **Export triggers:** enrollment changes (PUT/DELETE), group member changes (add/remove), and the tenant delete paths. The earlier "owner changes" trigger is deleted — there is no owner-change route.
- **Preview = `requireAdminReady`** (`src/access.ts:75`), the same posture as the other admin read routes.
- **Round-3 feed:** this implementation feeds the round-3 shared-teams design (`docs/designs/2026-11-09-gw-shared-teams-design.md`) — its teams are covered by these enrollments.

## Design

### 1. Group creation fix
- Reproduce first: drive `POST /admin/groups` via `handleRequest` on a copy of the live DB, with a Korean name, an uppercase id and a valid id. Record the actual status and error.
- UX: drop the manual id field. The UI sends only `name` and `description`. The server generates `groupId` as an ASCII slug of the name, falling back to `g-<8 hex>` when the slug is empty (for example a Korean name), and de-duplicates with a numeric suffix. `groupId` is still accepted from API callers.
- Errors: the server returns a field-specific `{error, field}` (`invalid_name`, `conflict`, …). The modal stays open and shows the error inline, not in a flash that disappears. After a successful create, the UI opens the new group's Members tab.
- A tenant-loop row created through `PUT /admin/tenant-loop/config` must also get `kind`, `created_at` and `description` defaults.

### 2. Named policies (migration v4)
- New table `policies(policy_id PK, name, description, limits JSON, created_at, updated_at)`. The limits shape is the existing `GroupPolicy` from `src/policy.ts` (`maxTenants`/`maxTurns`/`maxTokens`/`allowedVariants`, validated by `validateGroupPolicy`).
> **SUPERSEDED 2026-11-09** — see the amendment section. Limits are the 5 `GroupPolicy` fields (maxPrincipalTokens included), `policies.name` is UNIQUE, and assignments carry GROUPS ONLY.

- New table `policy_assignments(policy_id, target_kind 'group'|'user', target_id, PRIMARY KEY(...))` with an index on `(target_kind, target_id)`.
- Data migration: every non-null `groups.policy` becomes a policy named `<group name> limits`, assigned to that group. Then `groups.policy` is set to NULL. The column stays for downgrade safety.
- Resolution (`src/policy.ts` `effectivePolicyFor`): sources are the policies assigned directly to the user plus those assigned to each of the user's groups. Strictest wins, falling back to the cfg baseline, exactly as today. The `sources` output lists the policy names and how each was assigned (direct or via a group).
> **SUPERSEDED 2026-11-09** — see the amendment section. Sources are the policies assigned to the user's GROUPS only; no direct user assignments exist.
- API in a new `src/routes/admin/policies.ts`:
  - `GET/POST /admin/policies`, `GET/PATCH/DELETE /admin/policies/:id`, `POST/DELETE /admin/policies/:id/assignments` (`{targets:[{kind,id}]}`).
  - `GET /admin/users/:id/effective-policy` keeps its shape and adds sources.
  - Reauth is required for delete, unassign and any PATCH. A create with no assignments needs no reauth. Every mutation is audited (`policy.create/update/delete/assign/unassign`), and updates record the old and new values.
- `PUT /admin/groups/:id/policy` stays as a compatibility shim that creates or updates that group's own policy. The UI moves to the new endpoints.
> **SUPERSEDED 2026-11-09** — see the amendment section. The shim answers 410 Gone pointing at the policies API; it does not stay functional.

### 3. User/group-centric tenant loop (migration v4, same step)
> **SUPERSEDED 2026-11-09** — see the amendment section. This subsection's enrollment schema (target_kind/target_id), per-tenant exceptions, and single-group ACL are replaced by the (group_id, variant) enrollment key, the removal of per-tenant state, and the co-governance ACL.

- Merge the group kinds. Loop settings move to an enrollment table `loop_enrollments(target_kind 'group'|'user', target_id, status 'active'|'suspended', scopes JSON, windows JSON, git_remote, enrolled_at, PRIMARY KEY(target_kind,target_id))`.
- Data migration:
  - Each `kind='loop'` group becomes a general group with the same id and members (from `user_groups`), and gets an active group enrollment with its scopes and windows.
  - Its `designatedUsers` become loop operators (`loop_operators(group_id, principal)`), so the existing delegate ACL keeps working.
  - Per-tenant `loopStatus/loopGroup/loopOverride/loopGitRemote` are kept as **tenant exceptions**.
> **SUPERSEDED 2026-11-09** — see the amendment section. Per-tenant loop fields (`src/tenant.ts:85-91`) are deprecated and never read; per-tenant exceptions do not exist; uncovered tenants are fail-closed not-exported.
- Resolution at export time: for each tenant, find enrollments for its owner and for the owner's groups, pick the strictest scopes and the narrowest windows, then apply the tenant exception on top. A tenant exception can force `excluded`.
  - The export writer `buildTenantLoopExportDetailed` (`src/tenant-loop.ts:298`) consumes this resolver.
  - The **export JSON schema is unchanged** (per-tenant rows), so `scripts/lib/fleet.ts` and the workspace consumers need no change.
  - New tenants of enrolled users or groups appear automatically at the next export. Tenant create, delete and owner changes also trigger the export.
> **SUPERSEDED 2026-11-09** — see the amendment section. Export triggers are: enrollment changes, group member changes, and the tenant delete paths. There is no owner-change route ("owner change" trigger deleted).
- ACL: `assertTenantLoopAllowed` (`src/access.ts`) resolves the governing group from the enrollment that covers the tenant. The QA-S2 rule is kept: a caller can never name an arbitrary group to act on another group's tenant.
> **SUPERSEDED 2026-11-09** — see the amendment section. The governing set is ALL active enrollment groups covering the tenant (co-governance over `loop_operators`, audit attribution = sorted group set); the rewrite lands in the same commit as the v4 migration with no `designatedUsers` fallback.
- API (`tenant-loop.ts`):
  - `GET /admin/tenant-loop/enrollments`; `PUT/DELETE /admin/tenant-loop/enrollments/:kind/:id` (enroll, update, suspend, unenroll).
  - `GET /admin/tenant-loop/preview?kind=&id=` lists the resolved tenants with their effective settings.
  - Per-tenant `register/suspend/deregister` stay as exception endpoints, and `upgrade` is unchanged.
> **SUPERSEDED 2026-11-09** — see the amendment section. Enrollment routes are keyed `/:groupId/:variant` (`'*'` wildcard), PUT/DELETE = admin + reauth only, preview = `requireAdminReady`; the per-tenant exception endpoints are removed.
  - The kill switch `CO_WORKSPACE_TENANT_LOOP_DISABLED` still blocks every route.

### 4. Console UI (`web/admin.js`, `web/admin.html`)
- **Groups:**
  - The create modal asks for name and description only. Errors show inline.
  - One list with no kind badge.
  - The group detail page gets tabs: Members, Policies (assigned, with assign/unassign), and Tenant loop (enrollment status, scopes, windows, enroll/suspend/unenroll, and a resolved-tenant preview).
- **Policies:** a full CRUD page.
  - A list of policies with their limits and assignment counts.
  - Create/edit with a form for each limit (numeric inputs, variant multi-select from the catalog).
  - An assignment tab to add groups or users by search, or remove them.
  - Delete shows a confirmation with the assignment count.
- **Users:**
  - The drawer gains a Policies section (direct and via groups, with assign/unassign) and a Tenant loop section (enrollment and resulting tenants).
  > **SUPERSEDED 2026-11-09** — see the amendment section. The drawer shows the user's groups' policies (read view) and the loop tenants covered via the user's groups; no per-user assignment or enrollment UI exists.
  - The bulk bar gains "assign policy" and "enroll in loop".
- **Tenant Loop page:** rebuilt around enrollments.
  - A table of enrolled groups and users with status, scopes, windows and tenant count, plus an enroll form (pick a group or user).
  - A second table holds per-tenant exceptions.
  > **SUPERSEDED 2026-11-09** — see the amendment section. One table of (group_id, variant) enrollments with status, scopes, windows and covered-tenant count; the enroll form picks a group and a variant (or `'*'`); there is no per-tenant exceptions table.
  - The live registry preview and dry-run upgrade are kept.

## Execution plan (PM Gateway)

> Amended 2026-11-10: the Model/Platform columns below are stale — sessions dispatch on the zcode harness (models resolve via the zai column of the workspace tier map; the Agent tool takes no model parameter), so treat this table as tier+agent guidance only.

| # | Task | Agent | Tier | Model | Platform |
|---|---|---|---|---|---|
| 0 | Reproduce the group-create failure on a live-DB copy; amend design doc `docs/designs/2026-11-09-gw-admin-console-design.md` with §R2 (migration v4 DDL + data migration, policy/enrollment resolution, API, UI) — Design Gate | architect | High | opus | Claude Code |
| 1 | Migration v4 + UserStore policy/assignment/enrollment/operator methods + resolvers (`policy.ts`, `tenant-loop.ts`) + ACL update | automation-engineer | Low | haiku | Claude Code |
| 2 | Group-create fix + `policies.ts` routes + enrollment routes + export triggers | automation-engineer | Low | haiku | Claude Code |
| 3 | Console UI: Groups tabs, Policies CRUD, Users drawer/bulk, Tenant Loop rebuild | automation-engineer | Low | haiku | Claude Code |
| 4 | Tests: migration v4 on a v3 fixture with loop groups + group policies; resolution matrices; export schema unchanged; ACL S2 regression; UI pins | automation-engineer | Low | haiku | Claude Code |
| 5 | Security review (policy assignment escalation, enrollment ACL, export integrity) | security-expert | Medium | sonnet | Claude Code |
| 6 | QA: tests, tsc, audit; migration dry-run on a live-DB copy; browser click-through of group create, policy CRUD and enrollment; `/sync`; redeploy after the user's go | PM | Medium | — | Claude Code |

## Critical files
- `src/migrations.ts` (v4), `src/users.ts`, `src/policy.ts`, `src/tenant-loop.ts`, `src/access.ts`
- `src/routes/admin/{groups,policies (new),tenant-loop,users}.ts`
- `web/admin.js`, `web/admin.html`
- Tests: `tests/unit/co-workspace-admin-console.test.ts`, `co-workspace-tenant-loop*.test.ts`, `co-workspace-migrations.test.ts`

## Verification
1. `cd services/co-workspace && bun run test` and `bunx tsc --noEmit -p .` are green. The existing tenant-loop suites still pass: the export schema and the S2 ACL are unchanged.
2. Migration v4 dry-run on a copy of the live `data/tenants/users.db`: the version reaches 4, users are kept, and any group policies become named policies.
3. Local gateway on a throwaway data dir, in the browser:
   - Create a group with a Korean name.
   - Create a policy, assign it to the group and to a user, and check the effective policy in the user drawer.
   - Enroll the group in the loop, and confirm its members' tenants appear in the registry preview. Create a new tenant for a member and confirm it appears automatically.
   - Add a tenant exception, then unenroll.
   > **SUPERSEDED 2026-11-09** — see the amendment section. Click-through instead: assign the policy to the GROUP only; enroll the group per variant (`'*'` included); confirm an uncovered tenant stays out of the export; confirm a second overlapping enrollment narrows scopes/windows and that an unrepresentable window intersection omits the tenant with the `tenant.loop.export.window_unrepresentable` audit row and an explicit preview/403 reason.
4. `bun scripts/audit.ts`, then `/sync`. Redeploy only after the user approves.
