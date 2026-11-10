# co-workspace Admin Console — round 2: working group creation, policy CRUD, user/group-centric tenant loop

> **Status:** Approved plan (2026-11-09, user gate) — pending implementation. Extends `docs/designs/2026-11-09-gw-admin-console-design.md`.

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
- **Named policies:** reusable, with CRUD, assigned to groups and to individual users. The effective limit is the strictest of all assigned policies.
- **Group/user enrollment in the tenant loop:** loop groups merge into the user groups. A group or user is enrolled with a schedule and scopes, and all of its tenants, including new ones, follow automatically. Per-tenant exceptions are kept.

## Design

### 1. Group creation fix
- Reproduce first: drive `POST /admin/groups` via `handleRequest` on a copy of the live DB, with a Korean name, an uppercase id and a valid id. Record the actual status and error.
- UX: drop the manual id field. The UI sends only `name` and `description`. The server generates `groupId` as an ASCII slug of the name, falling back to `g-<8 hex>` when the slug is empty (for example a Korean name), and de-duplicates with a numeric suffix. `groupId` is still accepted from API callers.
- Errors: the server returns a field-specific `{error, field}` (`invalid_name`, `conflict`, …). The modal stays open and shows the error inline, not in a flash that disappears. After a successful create, the UI opens the new group's Members tab.
- A tenant-loop row created through `PUT /admin/tenant-loop/config` must also get `kind`, `created_at` and `description` defaults.

### 2. Named policies (migration v4)
- New table `policies(policy_id PK, name, description, limits JSON, created_at, updated_at)`. The limits shape is the existing `GroupPolicy` from `src/policy.ts` (`maxTenants`/`maxTurns`/`maxTokens`/`allowedVariants`, validated by `validateGroupPolicy`).
- New table `policy_assignments(policy_id, target_kind 'group'|'user', target_id, PRIMARY KEY(...))` with an index on `(target_kind, target_id)`.
- Data migration: every non-null `groups.policy` becomes a policy named `<group name> limits`, assigned to that group. Then `groups.policy` is set to NULL. The column stays for downgrade safety.
- Resolution (`src/policy.ts` `effectivePolicyFor`): sources are the policies assigned directly to the user plus those assigned to each of the user's groups. Strictest wins, falling back to the cfg baseline, exactly as today. The `sources` output lists the policy names and how each was assigned (direct or via a group).
- API in a new `src/routes/admin/policies.ts`:
  - `GET/POST /admin/policies`, `GET/PATCH/DELETE /admin/policies/:id`, `POST/DELETE /admin/policies/:id/assignments` (`{targets:[{kind,id}]}`).
  - `GET /admin/users/:id/effective-policy` keeps its shape and adds sources.
  - Reauth is required for delete, unassign and any PATCH. A create with no assignments needs no reauth. Every mutation is audited (`policy.create/update/delete/assign/unassign`), and updates record the old and new values.
- `PUT /admin/groups/:id/policy` stays as a compatibility shim that creates or updates that group's own policy. The UI moves to the new endpoints.

### 3. User/group-centric tenant loop (migration v4, same step)
- Merge the group kinds. Loop settings move to an enrollment table `loop_enrollments(target_kind 'group'|'user', target_id, status 'active'|'suspended', scopes JSON, windows JSON, git_remote, enrolled_at, PRIMARY KEY(target_kind,target_id))`.
- Data migration:
  - Each `kind='loop'` group becomes a general group with the same id and members (from `user_groups`), and gets an active group enrollment with its scopes and windows.
  - Its `designatedUsers` become loop operators (`loop_operators(group_id, principal)`), so the existing delegate ACL keeps working.
  - Per-tenant `loopStatus/loopGroup/loopOverride/loopGitRemote` are kept as **tenant exceptions**.
- Resolution at export time: for each tenant, find enrollments for its owner and for the owner's groups, pick the strictest scopes and the narrowest windows, then apply the tenant exception on top. A tenant exception can force `excluded`.
  - The export writer `buildTenantLoopExportDetailed` (`src/tenant-loop.ts:298`) consumes this resolver.
  - The **export JSON schema is unchanged** (per-tenant rows), so `scripts/lib/fleet.ts` and the workspace consumers need no change.
  - New tenants of enrolled users or groups appear automatically at the next export. Tenant create, delete and owner changes also trigger the export.
- ACL: `assertTenantLoopAllowed` (`src/access.ts`) resolves the governing group from the enrollment that covers the tenant. The QA-S2 rule is kept: a caller can never name an arbitrary group to act on another group's tenant.
- API (`tenant-loop.ts`):
  - `GET /admin/tenant-loop/enrollments`; `PUT/DELETE /admin/tenant-loop/enrollments/:kind/:id` (enroll, update, suspend, unenroll).
  - `GET /admin/tenant-loop/preview?kind=&id=` lists the resolved tenants with their effective settings.
  - Per-tenant `register/suspend/deregister` stay as exception endpoints, and `upgrade` is unchanged.
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
  - The bulk bar gains "assign policy" and "enroll in loop".
- **Tenant Loop page:** rebuilt around enrollments.
  - A table of enrolled groups and users with status, scopes, windows and tenant count, plus an enroll form (pick a group or user).
  - A second table holds per-tenant exceptions.
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
4. `bun scripts/audit.ts`, then `/sync`. Redeploy only after the user approves.
