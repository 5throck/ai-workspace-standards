# Gateway Group-Shared Teams — Design (Row 0, round 3 PRECEDE)

- **Spec id**: `2026-11-09-gw-shared-teams-design`
- **Date**: 2026-11-09
- **Status**: approved (2026-11-09, user gate) — implementation round 3, pending
- **Author**: architect (PM-dispatched, Design Gate Row 0 — design + registration only; implementation is a separate future change set)
- **Decision provenance**: user gate, 2026-11-09 — the mandatory decisions below (§3-§13) are encoded as ruled, not re-opened
- **Related**: `docs/designs/2026-11-09-gw-admin-console-design.md` (round 1 — groups, general-group policies, admin console), `docs/designs/2026-11-09-gw-admin-console-round2-plan.md` (round 2 — named policies v4, `loop_enrollments` group/user enrollment model), `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (§4.1 migration runner, §3.1 registry export schema)

All paths below are relative to `services/co-workspace/` unless stated otherwise.

## 1. Context and problem

Today every gateway team is personal: **a team = one agent workspace for one user and one variant** (`README.md:16-19` — "The registry keys teams by `<variant>::<principal>`; there is exactly one active team per pair"). The key function `tenantKeyFor(variant, user)` returns `` `${variant}::${user}` `` (`src/lifecycle.ts:247-249`) and `getOrStartTenant` (`src/lifecycle.ts:308-316`) looks that key up first-row (`findByKey`, `src/registry-db.ts:80-84`) or provisions a fresh scaffold.

This model has no way for a **user group** (round 1 `groups.kind='general'`, round 2 policies and enrollments) to own one shared team that all of its members work in together. Concretely:

1. **No shared working context.** Two members of a group who want to collaborate on one variant get two unrelated teams, two unrelated file trees, and two unrelated Hermes homes. The hub-and-spoke doctrine ("a common instance serves the group") has no gateway expression.
2. **No group ownership.** `TenantRecord.ownerPrincipal` is a single principal; `requireTenantAccess` (`src/access.ts:86-100`) grants access only to the owner, a password-set admin, or anonymous-tenant open mode. Group membership is consulted nowhere in tenant access.
3. **No attribution inside a team.** A personal team's turns all belong to its owner, so the turn log (`turns.db`, `src/tenant-files.ts:107-118`, keyed `(tenant_id, seq)` — **no acting-user column**) cannot distinguish authors. In a shared team that is a correctness gap, not a nicety.

Round 3 adds **group-shared teams**: additive team kind, live group-membership ACL, per-turn attribution, and loop coverage via the owning group's enrollment. Existing personal teams are untouched.

## 2. Scope and non-goals

**In scope (round 3)**: `TenantRecord.kind` (`personal | shared`), shared-team key namespace + registry `key` UNIQUE migration (v-migration, §4), shared-team ACL in `requireTenantAccess` (§7), `acting_principal` column in `turns.db` (§6), create permission + per-group team cap (§7), quota via `effectivePolicyFor` (§8), UI changes in `web/index.html` (§12), loop export coverage (§10), tests (§15).

**Non-goals** (explicit, user-gated):

- **No parallel turns within a team.** A shared team inherits the per-tenant `chatLock` queue (§5); member B's turn queues behind A's. Never concurrent.
- **No per-member private subdirectories inside a shared team.** Isolation within a shared team is explicitly not provided (§9, §14) — members share files AND agent thread state; that is the point.
- **No cross-group sharing.** One team is owned by exactly one group. No multi-group ownership, no per-member ACL overrides beyond group membership.
- **No wire targeting of shared teams.** The OpenAI/Anthropic/Gemini wires keep personal-team lazy-provisioning ONLY in v1 (§11).
- **No change to the personal-team model.** `tenantKeyFor` for personal teams, `resolveLazyTenant` on the wires, the "exactly one active team per (user, variant)" rule — all unchanged.
- **No live migration of personal teams into shared ones.** Conversion of an existing personal team to a shared team is a future consideration, not round 3. Existing teams need zero migration beyond the schema columns that are additive.
- **No per-member quota enforcement in v1.** Acting-principal token usage is recorded per turn for audit/insights (§8) — record, don't bill.
- **No turn cancellation.** Group removal ends access immediately for new turns; an in-flight turn completes (§7, §14).

## 3. Team kinds and ownership (D-S1)

`TenantRecord` gains `kind: "personal" | "shared"` (rides the versionable `tenants.data` JSON column, `src/registry-db.ts:6-11,32-41` — same pattern as `loopGroup`/`loopOverride`/`archivedAt`; no DDL on the tenants table for this field). Semantics:

| Kind | Owner | Key | Created by |
|---|---|---|---|
| `personal` (default, today's model) | the user principal (`ownerPrincipal`) | `<variant>::<principal>` (`lifecycle.ts:247-249`) | `+ New team` (personal path, unchanged) or wire lazy-provisioning |
| `shared` | **a user group** (`groups` table, any kind — `groups.kind` is round 1's `general | loop`) | `<variant>::group:<group_id>` (§4) | a member of the group or an admin, via the `+ New team` modal |

For a shared team, `ownerPrincipal` stores `group:<group_id>` (a synthetic principal in the shared namespace, §4). The ownerPrincipal string stays the single ownership field — no new owner column — and `requireTenantAccess` interprets a `group:` owner via group membership (§7). Records also carry `ownerGroupId: string` for direct lookup, to avoid prefix-parsing `ownerPrincipal` in hot paths.

**Fully additive**: no existing row changes kind, key, or owner. Every existing team is and stays `personal`.

## 4. Key namespace and registry uniqueness migration (D-S2)

**Shared-team key = `<variant>::group:<group_id>`.** The collision guard is the `group:` prefix: group ids and principals share one character space — `GROUP_ID_RE = /^[a-z0-9-]{2,40}$/` (`src/routes/admin/groups.ts:13`) and the login-id rule `/^[a-z0-9][a-z0-9-]{2,31}$/` (`src/users.ts:310`, principal = loginId per the principal unification, `src/users.ts:316`) both allow exactly `[a-z0-9-]`. A principal can therefore be syntactically equal to a group id; without the `group:` prefix, `<variant>::x` would be ambiguous between principal `x` and group `x`. The prefix makes the namespace disjoint by construction; `tenantKeyFor` gains a shared-variant branch (`tenantKeyFor(variant, {type:"group", id})`) and unit pins assert the format (§15).

**Registry `key` is NOT UNIQUE today.** `src/registry-db.ts:38` declares `key TEXT`, indexed only by `idx_tenants_key` (`:42`, a plain `CREATE INDEX`), and `findByKey` (`:80-84`) reads `ORDER BY created_at ASC LIMIT 1` — first row wins. For personal teams this is a benign degenerate case (the upsert path keeps one live row per key); for shared teams, where the key is the group's single team identity, first-row-wins is a correctness hazard: two rows with the same key make team resolution non-deterministic. **Round 3 therefore requires a v-migration** (through the standard versioned runner in `src/migrations.ts`, `PRAGMA user_version`, downgrade guard unchanged) that:

1. **Pre-migration duplicate check** (inside the migration step, before any DDL): `SELECT key FROM tenants GROUP BY key HAVING COUNT(*) > 1` — if any key has more than one row, the migration **refuses to open** with an explicit error naming the duplicated keys and requiring operator resolution. A duplicate under today's semantics means a corrupted registry state; guessing a winner is forbidden.
2. Adds `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_key_unique ON tenants(key)`.

The old non-unique `idx_tenants_key` is dropped in the same step (the unique index covers the lookup). `findByKey` keeps its `LIMIT 1` shape (now deterministic by constraint rather than by luck).

## 5. Concurrency: inherited per-tenant chatLock queue (D-S3)

`runTurn` queues every turn behind the tenant's existing chain: `state.chatLocks.get(rec.tenantId)` (`src/chat.ts:51`), the turn's task is chained via `prev.then(...)` and the tail is written back (`src/chat.ts:295`). A shared team **inherits this mechanism unchanged** — the lock is keyed on `tenantId`, and a shared team has exactly one `tenantId`. Consequences (all user-gated):

- Member B's turn **queues behind member A's running turn, never rejected** and never run in parallel. There is no per-principal queue inside a team.
- The UI shows **`queued (ahead: <member>)`** while waiting. Queue-position visibility is **best-effort via the existing `chatLocks` map**: the gateway can report "N queued, fronted by principal P" from the chain, but it is a synchronous in-memory map with no persistence and no FIFO ledger beyond the promise chain — the UI must treat the position/attribution as informational, not authoritative (best-effort wording in the UI, not a guarantee).
- The attach-hub secondary lock (`hubLockKey = "attach-hub:<resolved attachHub>"`, `src/chat.ts:52`) is unchanged and orthogonal — it serializes turns into a shared hub queue and applies to attached tenants of any kind.

## 6. Attribution: `acting_principal` (D-S4)

**`turns.db` gains an `acting_principal TEXT` column** (round-3 migration through the same versioned runner as §4). Schema today (`src/tenant-files.ts:107-118`): `turns(tenant_id, seq, session_id, exit_code, final_text, input_tokens, output_tokens, at)` with `PRIMARY KEY (tenant_id, seq)` and **no acting-user column** — on a personal team that is fine (owner = actor); on a shared team it is not.

- `NULL = legacy / anonymous` — every pre-migration row keeps NULL; the migration is `ALTER TABLE turns ADD COLUMN acting_principal TEXT` (additive; no backfill, no rewrite of `final_text` blobs).
- Every new turn records the authenticated principal of the caller that issued it (`callerPrincipal(state, req)`, `src/access.ts:31`; `"anonymous"` in open mode).
- **The chat log shows the author tag**: the web history panel renders `acting_principal` next to each turn; NULL renders as "legacy" (no fabricated attribution).
- **The Hermes thread stays ONE shared thread per shared team.** All members' turns run against the same Hermes home and session stream — the shared working context is the point of the feature. Recording per-member threads is a Considered alternative, rejected (§13b) for context loss and turn-history fragmentation: the agent would lose sight of what the other member just did, which defeats the collaboration model.
- The `TurnStore.record` signature gains the acting principal as a parameter; the `(tenant_id, seq)` allocation logic (`MAX(seq)+1`, race-free under the single-process + per-tenant chatLock invariant, `src/tenant-files.ts:124-133`) is unchanged.

## 7. ACL and create permission (D-S5)

**Access = live group-membership check.** `requireTenantAccess` (`src/access.ts:86-100` — today: password-set admin bypass, anonymous-tenant open mode, `ownerPrincipal === caller`) is extended: when `rec.kind === "shared"`, after the admin bypass, the caller's **group memberships are queried at request time** (`state.users.groupsOf(caller)` — the round 1 method backed by `idx_user_groups_principal`) and access is granted iff the owning group is among them. Live query, not a snapshot on the tenant record: **group removal = immediate access loss** on the next request. An in-flight turn completes; turn cancellation is out of scope (§2). The existing denial path (audit `tenant.access.denied` with the owner detail kept out of the client message, `access.ts:96-99`) applies unchanged, with `owner=group:<id>` in the audit detail.

Password-set admin access is **preserved** (the `isPasswordSetAdmin` bypass at `access.ts:89` runs before the membership check — admins reach any shared team exactly as they reach any personal team today).

**Create permission**: creating a shared team for group G requires (a) caller is a **member of G** (self-service) or (b) caller is an admin. The create route validates membership live and audits `tenant.create` with `kind=shared owner=<group_id>`.

**Per-group team cap**: the governing group's policy caps how many teams the group may own — `assertTenantCap` (`src/access.ts:150`, today `effectivePolicyFor(state, owner).maxTenants` where owner is a principal) is extended to accept group-owned teams: for a shared team the cap source is the **group's own policy** (`groups.policy`, round 1 §5) resolved through `effectivePolicyFor` against the group id, not the creating member's policy. Creating the N+1th team beyond `maxTenants` → 429, message unchanged in shape.

## 8. Quota (D-S6)

Quotas for shared teams resolve through `effectivePolicyFor` (`src/policy.ts:125-130`, strictest-wins over `cfg` + general-group policies). For a shared team:

- **The governing group's policy is the strictest source** — group policies already participate in `resolveEffectivePolicy` (`src/policy.ts:77`); the team's turn/token quota checks (`assertQuota`, called per turn in `routes/tenants.ts` and the wires) resolve against the owning group's effective policy. A creating member's personal group policies do not tighten a group-owned team's quotas — the group governs its own team.
- **Acting-principal token usage is recorded per turn** (the §6 `acting_principal` column plus the existing per-tenant usage rollups) for audit/insights.
- **No per-member quota enforcement in v1** (§2 non-goal): a member's own principal-level token cap (`assertPrincipalQuota`, `src/access.ts:172`) is NOT applied to their turns in someone else's shared team in v1 — usage is recorded so enforcement can be added later without another schema change.

## 9. Isolation model (D-S7)

**Unchanged, and that is the point.** The container/mount contract is untouched: each turn runs with only the team's project dir and Hermes home mounted (`src/hermes.ts:64-66,141-165` — "only the tenant project dir and Hermes home mounted — nothing else is reachable"). A shared team therefore mounts **one** project dir and **one** Hermes home to every member's turn.

- **Trust boundary = group membership.** Members share the team's files AND the agent's thread state (Hermes home, session stream). There is no per-member isolation inside a shared team, by design (§14 states this as the intended trust model, not a leak).
- **No new mounts, no new namespaces**: `hermes.ts` mount layout (project + hermes-home only), `lifecycle.ts` orphan sweeps (`sweepOrphanedScaffolds`, `src/lifecycle.ts:139`; `sweepOrphanedStorage`, `:167` — keyed on registry rows) and the storage layout (`registry-db.ts:138-150`) all apply to shared teams without modification, because a shared team is just another tenant record with a different key shape and owner.

## 10. Loop integration (D-S8)

A shared team is **covered directly by its owning group's enrollment** — the round 2 model (`docs/designs/2026-11-09-gw-admin-console-round2-plan.md` §Design 3: `loop_enrollments(target_kind 'group'|'user', target_id, ...)`; group enrollment covers "all of its tenants, including new ones"). Since a shared team's owner IS the group (`group:<group_id>`), the export-time resolution ("find enrollments for its owner and for the owner's groups") matches a group enrollment to a shared team's owner string directly — no new resolution rule needed, provided the owner comparison uses the same `group:<id>` form on both sides. Round 3 pins that form explicitly:

- **Export row `principal` field = `group:<group_id>`** for shared teams. The workspace-side reader contract accepts this today: `scripts/lib/fleet.ts:436-437` validates only `typeof principal === "string" && principal.trim().length > 0` ("principal must be a non-empty string") — any non-empty principal string is a legal export row (`fleet.ts:321` interface field). No reader change is required or made.
- **Team delete triggers export refresh** — the existing discipline (export rewritten after every successful admin mutation, 2026-11-08 design §4.5) applies; a shared-team delete is a tenant mutation and regenerates `tenant-loop-registry.json` like any other.

## 11. Wire scope (D-S9)

The OpenAI/Anthropic/Gemini wires (`src/routes/compat.ts:20-41` and the Gemini route) **keep personal-team lazy-provisioning ONLY in v1**. `resolveLazyTenant` (`src/lifecycle.ts:334-345`) resolves-or-creates keyed on the authenticated principal (`callerPrincipal(state, req) ?? "anonymous"`, `:342`), and the wire request body's user field is intentionally ignored (`compat.ts:21,36` comments) — there is **no way to target an existing team on the wires** today, and round 3 does not add one. A wire message always resolves/creates the caller's **personal** team for that variant.

**Explicit non-goal**: no wire route accepts a shared-team target, no `model` value maps to a shared team, and no `resolveLazyTenant` variant branches on group membership. Shared teams are **web-console targets** only (`POST /tenants/:id/chat` from the SPA, `web/index.html:690`). Rationale: wires are unauthenticated-body surfaces; making them group-aware would reintroduce exactly the tenant-targeting surface the compat hardening removed.

## 12. UI (D-S10)

`web/index.html` composer changes:

- **`+ New team` modal gains a kind choice** (button at `web/index.html:143`, modal builder `openNewTeamModal` `:250`, handler `:286`): `personal` is the default (variant picker, unchanged path → `POST /sessions`); choosing `shared` swaps in a **group picker populated from the user's memberships** (`GET /admin/groups` filtered to groups the caller belongs to, via `groupsOf`-backed listing) plus a team name.
- **Shared teams are marked in the session list**: a badge (`shared · <group name>`) next to the team name.
- **The team detail/header shows the member list** for shared teams (read-only, from the group membership listing).
- **Per-turn author tags** in the chat log (§6 — `acting_principal` rendered per turn).
- **Delete available to all members** with a **strong confirm modal listing the member set** (all principals who currently have access, fetched at modal-open time) and the delete action audited with the acting principal (§14 audit events). Delete removes the tenant (registry row, files, Hermes home, history) exactly as today — a shared-team delete destroys the group's shared context, hence the member-set confirmation.

## 13. Considered alternatives (rejected, user-gated)

- **(a) One fully-common instance per variant shared by ALL users.** Rejected: destroys isolation (every user in every other user's files and agent state) and attribution (no membership boundary at all). It is the degenerate version of a shared team with the group = everyone, which no group models.
- **(b) Per-(team, member) Hermes threads inside one shared team.** Rejected: fragments the shared context that motivates shared teams — the agent would not carry what member A just did into member B's turn, and the turn history would fork per member, reintroducing the exact disjointness §1.1 names as the problem. One shared thread is the chosen model (§6).
- **(c) Key namespace without the `group:` prefix** (`<variant>::<group_id>` directly). Rejected: principals and group ids share the `[a-z0-9-]` character space (`users.ts:310` vs `routes/admin/groups.ts:13`), so `<variant>::acme` would collide between principal `acme` and group `acme` — the registry key could resolve to a personal team or a shared team depending on which existed first. The `group:` prefix makes the namespaces disjoint by construction.
- **(d) A duplicated personal team per member with mirrored history.** Rejected: sync complexity (file-tree and Hermes-home mirroring with conflict semantics nobody wants to own) and it violates the hub-and-spoke doctrine that a common instance serves the group — members would drift apart instantly.

## 14. Security analysis

- **Shared-file trust boundary — intended, not a leak.** Any member of the owning group can read (and the agent can act on) another member's project files and the full agent thread state. This is stated as the **intended trust model**: joining a group is a grant of collaboration trust, and the feature exists to provide exactly this sharing (§2 forbids per-member subdirectories). The doc and the UI member list make the boundary visible; it must never be described in user-facing copy as "private to each member".
- **Membership revocation vs in-flight turns.** Removal from the group takes effect at the next `requireTenantAccess` (live `groupsOf` query) — no cached grant, no stale token window. An **in-flight turn completes** under the access check it already passed (turn cancellation is out of scope, §2); its output lands in the shared thread, tagged with the (now-former) member's `acting_principal` — acceptable and auditable; the residual exposure window is one turn's duration.
- **Admin access preserved.** `requireTenantAccess` already allows password-set admins (`access.ts:89`); shared teams inherit this unchanged — an admin can inspect any shared team under the existing reauth posture. No new admin-only bypass is introduced.
- **Registry-key uniqueness as a correctness invariant.** Two shared teams with the same key would make `findByKey` (`registry-db.ts:80-84`, first-row-wins) non-deterministic — team resolution, quota accounting, and the loop export could disagree about which team is "the" team. The §4 UNIQUE migration + duplicate-check makes this a schema-enforced invariant, and the pre-migration refusal turns a silent hazard into an operator-visible failure.
- **Audit events for create/delete/access by acting principal.** New/extended audit actions: `tenant.create` (detail `kind=shared owner=<group_id> actor=<principal>`), `tenant.delete` (actor + member-set context from the confirm modal), `tenant.access.denied` (existing action; detail now carries `owner=group:<id>`), and the existing per-turn usage records tagged with `acting_principal`. Every allow/deny decision keeps the 2026-11-08 §4.2 posture (audit both ways).

## 15. Verification (test plan)

Unit tests in `tests/unit/`, mkdtemp fixtures with absolute roots (the standing hygiene lesson):

| File | Cases |
|---|---|
| `co-workspace-shared-team-keys.test.ts` | unit pins for the key format (`<variant>::group:<id>`), the namespace collision guard (a group id equal to a principal never produces the same key), and `tenantKeyFor` personal-branch byte-identity with today's output |
| `co-workspace-turns-migration.test.ts` | turns.db migration: legacy rows keep `acting_principal = NULL`; new rows record the caller; `(tenant_id, seq)` PK unchanged; registry `key` UNIQUE migration — duplicate-key fixture DB **refused** pre-migration with named keys; clean DB gets the unique index; idempotent re-run |
| `co-workspace-shared-team-access.test.ts` | `requireTenantAccess` membership matrix: member ✓, non-member ✗, admin (password set) ✓, passwordless admin ✗, removed-member-next-request ✗; create permission (member ✓ self-service, admin ✓, outsider 403); per-group team cap 429 |
| `co-workspace-composer-wire-regression.test.ts` | UI pins (kind choice, group picker from memberships, badge, member list, author tags, strong delete modal with member set); wire regression — `/v1/chat/completions` and `/v1/messages` still resolve personal teams only, `parsed.req.user` still ignored, no shared-team targeting route exists |
| `co-workspace-shared-team-loop.test.ts` | loop export integration: shared team covered by its group's enrollment; export row `principal = group:<id>`; the workspace reader (`scripts/lib/fleet.ts`) parses the row (non-empty principal contract); delete triggers export refresh |
| migrations dry-run | against a **fixture DB with pre-existing teams** (personal rows untouched: kind defaults to `personal`, keys/owners unchanged; duplicate-key fixture refuses) |

Run with `cd services/co-workspace && bun run test`, then `bun test tests/unit/` from the repo root.

## 16. Relationship to prior docs

- **Round 1** — `docs/designs/2026-11-09-gw-admin-console-design.md`: the `groups` / `user_groups` tables, `groups.kind`, `GroupPolicy`/`EffectivePolicy` strictest-wins resolution, and the admin console this design's UI extends. Shared teams sit **on top of** that group model — no group schema change in round 3.
- **Round 2** — `docs/designs/2026-11-09-gw-admin-console-round2-plan.md`: named policies (migration v4) and the **(group × variant) enrollment model** (`loop_enrollments`). Shared teams sit **on top of** that enrollment model: a shared team needs no enrollment of its own — its owning group's enrollment covers it (§10), and its quota ceiling is the group's resolved policy (§8). Round 2's v4 migration (`policies` / `loop_enrollments` / `loop_operators`) is this design's **prerequisite** — shared teams consume the same (group × variant) enrollment resolver, so round 2 must land first.
- **2026-11-08 hardening design** — the migration runner (§4.1) both §4 migrations ride, the registry export schema and mutation-triggered rewrite discipline (§3.1/§4.5) that §10 depends on.

## 17. Implementation notes (2026-11-11)

As-built record from the round-3 landing (follow-up to round 2, PR #1955). The design text
above is left unchanged; deviations and one addition are recorded here.

- **Deviation 1 — real DDL columns instead of the `tenants.data` JSON (§3).** The kind and
  owner fields landed as REAL `tenants` columns `team_kind` / `owner_group` (record fields
  `teamKind` / `ownerGroup`; the design's names were `kind` / `ownerGroupId`), added by
  registry migration v5 — not as fields inside the versionable `tenants.data` JSON. Why:
  the §4 uniqueness invariant had to be schema-visible (a UNIQUE index cannot back a JSON
  blob, and the v5 duplicate pre-check must query column-level state), and the group-owned
  cap/ACL paths read the owner group directly (queryable, typed migration — no JSON
  parsing in hot paths). Fully additive: migrated rows default to `team_kind='personal'`.
- **Deviation 2 — the `queued (ahead: <member>)` UI was omitted (§5, §12).** The per-tenant
  `chatLock` exposes no queue ledger (an in-memory promise chain, no FIFO position or
  front-of-queue attribution), so the visibility UI would have been invented state; §5
  already marked it best-effort. Turns queue unchanged; the UI shows the plain in-progress
  state. The design's best-effort caveat stands as the recorded tradeoff.
- **Addition beyond the design — group-delete quarantine (2026-11-11 QA, S2).** Group ids
  are deliberately reusable, so deleting a group that owns shared teams would let a LATER
  group recreated with the same id inherit the dead group's teams (live membership checks
  pass; `findByKey` returns the old team). Defense in depth: the group-delete route
  archives every shared team owned by the group (`quarantineGroupSharedTeams` —
  `status='archived'` + `archivedAt`, audit action `tenant.archived.group_deleted`; a full
  `deleteTenantData` was rejected as too destructive for a group-delete side effect, the
  team stays on disk for admin restore/inspection); archived teams are excluded from the
  member listing (the composer/sidebar source) and `requireTenantAccess` denies archived
  rows before every other check; `getOrStartTenant`'s shared branch asserts
  `teamKind === 'shared' && ownerGroup === <id>` on any existing-key match (a collision row
  → 409 `shared_team_conflict`, an archived match → 409 `tenant_archived` — never a silent
  reuse); and `group:`-prefixed API-key labels/spoke-ids are refused at key-file parse
  (such a label would mint a personal principal whose tenant key collides with a shared
  team key). Tests: `tests/unit/co-workspace-shared-team-quarantine.test.ts`.

## References

- `services/co-workspace/README.md:16-19` (team model — exactly one active team per (user, variant))
- `services/co-workspace/src/lifecycle.ts` — `tenantKeyFor` :247-249, `getOrStartTenant` :308-316, `resolveLazyTenant` :334-345 (keyed on authenticated principal, :342), `sweepOrphanedScaffolds` :139, `sweepOrphanedStorage` :167
- `services/co-workspace/src/registry-db.ts` — `key TEXT` :38, non-unique `idx_tenants_key` :42, `findByKey` first-row :80-84, storage layout :138-150
- `services/co-workspace/src/chat.ts` — per-tenant chatLock :51, attach-hub lock key :52, tail write-back :295
- `services/co-workspace/src/tenant-files.ts` — `TurnRecord` :91-103, `turns` table `PRIMARY KEY (tenant_id, seq)` :107-118 (no acting-user column), seq allocation :124-133
- `services/co-workspace/src/access.ts` — `callerPrincipal` :31, `requireTenantAccess` :86-100, `assertTenantCap` :150, `assertPrincipalQuota` :172, `windowUsage` :184
- `services/co-workspace/src/policy.ts` — `resolveEffectivePolicy` :77, `effectivePolicyFor` :125-130
- `services/co-workspace/src/users.ts` — `principalFromEmail` :127, login-id rule :310, principal unification :316; group id rule `GROUP_ID_RE` in `src/routes/admin/groups.ts:13` (same `[a-z0-9-]` character space)
- `services/co-workspace/src/migrations.ts` — `groups` / `user_groups` DDL :27-38 (v1)
- `services/co-workspace/src/routes/compat.ts` — wires resolve via `resolveLazyTenant` only (:20-41); body user ignored (:21, :36)
- `services/co-workspace/src/hermes.ts` — project + hermes-home mounts only (:64-66, :141-165)
- `services/co-workspace/web/index.html` — `#newTeam` :143, modal :250/:286, `POST /tenants/:id/chat` :690
- `scripts/lib/fleet.ts` — export reader principal contract :321, :428, :436-437 (non-empty string accepted)
- `docs/designs/2026-11-09-gw-admin-console-design.md` (round 1), `docs/designs/2026-11-09-gw-admin-console-round2-plan.md` (round 2 enrollment model), `docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md` (migration runner, export discipline)
