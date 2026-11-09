# Gateway Tenant Loop and Pipeline Hardening — Design (Row 0)

- **Spec id**: `2026-11-08-gw-tenant-loop-and-hardening-design`
- **Date**: 2026-11-08
- **Status**: implemented
- **Author**: architect (PM-dispatched, Design Gate Row 0 — design + registration only)
- **Decision provenance**: ratified in the two 2026-11-08 meetings recorded at `memory/meeting-2026-11-08-coworkspace-gap-review.md` and `memory/meeting-2026-11-08-coworkspace-public-repo-design-review.md` — including the ruling that **co-workspace STAYS in this repo** (no split)
- **Related**: `docs/designs/2026-11-07-fleet-membership-ssot-design.md` + DEC-20261107-01 (fleet SSOT this design must not disturb), ADR-0092 (co-workspace gateway), ADR-0090 (upstream tickets), `memory/2026-11-04.md:159` (the `rm -rf Projects` incident, T-20261104-004), T-20261104-003 + PR #1855 (test fixtures made absolute), `scripts/lib/fleet.ts` (helper under extension), `services/co-workspace/src/scaffold.ts` (new-project subprocess bridge)

## 1. Context and problem

Gateway tenants are variant projects scaffolded by `services/co-workspace` through the workspace scaffold engine (`scripts/new-project.ts` via `services/co-workspace/src/scaffold.ts:48`, ADR-0092 D4), then relocated out of `Projects/` into gateway storage (`services/co-workspace/src/registry-db.ts:138-150`: `storage/<principal>/<folder>/project` with `folder = name || tenantId`; tenant ids are `gw-<12hex>` from `genId("gw")`, `services/co-workspace/src/util.ts:7-10`). Today that relocation is a one-way door:

1. **No loop participation.** The backport·upgrade·upstream automation loop (resync waves, upgrade waves, upstream ticket filing) derives its project set from the fleet SSOT (`scripts/lib/fleet.ts listFleetProjects()`, DEC-20261107-01) — which enumerates `Projects/co-*` only. A relocated tenant is invisible to every loop consumer, and there is no controlled way to bring one in.
2. **No upstream filing channel.** `scripts/mcp-upstream-server.ts resolveProject()` (line 327) requires the working directory to be a direct `co-*` child of `Projects/` with `template-version.txt` at the root (`REGISTRATION_RULE`, line 183). A tenant cwd cannot file an upstream request at all, and the rejection message does not tell the agent why in terms it can act on.
3. **No admin surface for loop operations.** Even if tenants could join the loop, nothing gates *who* may register/suspend a tenant, change its loop config, or trigger an upgrade for it, *when* such operations may run, or *how often*.
4. **Two known failure classes remain unenforced.** (a) Test suites that leave working-tree residue — the 2026-11-04 `rm -rf Projects` incident class (`memory/2026-11-04.md:159`); PR #1855 made the fixtures absolute, but nothing *mechanically* forbids a future suite from recreating a repo-root `Projects/` directory. (b) A gateway boot with an empty resolved variant catalog (`config.ts resolveVariants()` returns `[]` when `templates/` is missing, lines 273-274) starts "successfully" and fails later in confusing ways.

The two meetings of 2026-11-08 ratified the scope: three work packages, all in-repo, co-workspace stays. This design encodes them.

## 2. Scope and non-goals

**In scope (Row 0)**: the design below — WP1 tenant loop (registry, fleet separation, upstream filing, upgrade guard, backport diff), WP2 admin ACL (groups migration, gating, windows, admin API, kill switch, quota, snapshot, credential separation, registry export), WP3 hardening (fixture-root hygiene gate, boot validation), schemas, failure semantics, test plan. Registration only; **no implementation edits in this PR**.

**Non-goals**:

- **No split.** `services/co-workspace` remains in this repository. No workspace-contract.json, no updater, no ADR-0104, no public-facing docs — none of the split-related artifacts are designed or referenced.
- **No public release path.** The gateway stays the internal team gateway (ADR-0092 Phase 0 posture unchanged).
- **No fleet SSOT change.** `FLEET_ID_RE = /^co-[a-z0-9-]{1,40}$/` (`scripts/lib/fleet.ts:58`), the `docs/fleet-membership.json` exclusions semantics, and the routing discipline of `tests/unit/fleet-iteration-routing.test.ts` stay byte-identical in behavior. Tenant ids (`^gw-[0-9a-f]{12}$`) are a **different namespace**; nothing in this design lets a tenant id enter a fleet enumeration or vice versa.
- **No new `Projects/` readdir sites.** All tenant enumeration goes through the registry file; the structural guard (§7.8) keeps the enumerator allowlist closed.
- **No new public machinery for WP3.** Both hardening gates are repo-internal (a dev-sync step + a script + a boot check); no user-facing docs or surfaces.
- Do **not** change how tenants are scaffolded or relocated (lifecycle, storage layout, attach mode all unchanged).

## 3. WP1 — Tenant loop

### 3.1 D1.1 — Tenant-loop registry (the tenant SSOT)

The gateway writes `<CO_WORKSPACE_WORKSPACE_DIR>/.pipeline-state/tenant-loop-registry.json` **atomically** (temp file + rename, the same discipline as `mcp-upstream-server.ts:320-323` and `registry.json` legacy migration) on **every** loop-config change, and once at gateway boot. `.pipeline-state/` is gitignored (`.gitignore:28`) — runtime state, never committed.

**Schema** (`schemaVersion` 1):

```json
{
  "schemaVersion": 1,
  "writtenAt": "2026-11-08T12:00:00.000Z",
  "tenants": [
    {
      "id": "gw-0123456789ab",
      "principal": "operator@example.com",
      "variant": "co-consult",
      "projectDir": "/abs/services/co-workspace/data/storage/<principal>/<folder>/project",
      "status": "active",
      "scopes": { "upgrade": true, "upstreamFile": true, "backportReview": true, "nightlyFleet": false },
      "windows": { "tz": "Asia/Seoul", "days": [0, 1, 2, 3, 4, 5, 6], "start": "22:00", "end": "06:00" },
      "gitRemote": "local-only"
    }
  ]
}
```

Field rules: `id` matches `^gw-[0-9a-f]{12}$` (same shape `genId("gw")` emits, `util.ts:7-10`); `status` ∈ `active | suspended`; `scopes` is exactly the four boolean keys; `windows.days` is a `number[]` of 0-6 (0 = Sunday, the `Intl` weekday convention); `start`/`end` are `HH:MM` in `windows.tz`; `start > end` wraps midnight (a 22:00-06:00 window spans the night); `gitRemote` is `"local-only"` or an URL.

**Writer (gateway)**: a small module under `services/co-workspace/src/` that serializes the loop config from `registry-db` records + group defaults and writes the file tmp+rename. Written after every successful admin mutation (§4.5) and at boot (§4.5).

**Reader (workspace, fail-closed)** — `scripts/lib/fleet.ts` new loader, mirroring `loadFleetRegistry`'s result shape:

| Condition | Behavior |
|---|---|
| File absent | zero tenants (`{ok:false, error:'absent-file'}` → consumers see `[]`) |
| Malformed JSON / invalid row / bad id / bad window | `malformed` with detail → consumers hard-fail, never guess (fail-closed, mirroring the fleet registry contract, `fleet.ts:16-21`) |
| `writtenAt` older than 24h | zero tenants — stale export must never drive automation; a WARN row tells the operator to restart/touch the gateway export |
| `schemaVersion` **major** mismatch (any `schemaVersion >= 2`) | treat the **entire file as absent** — rebuild on the gateway side, never misread a newer format with v1 code |

Fail-closed is the deliberate inversion of the fleet registry's absent-file rule (which falls back to historical glob behavior): for tenants there is **no historical behavior to fall back to** — absent/stale means zero tenants, full stop.

### 3.2 D1.2 — Fleet separation in `scripts/lib/fleet.ts`

`FLEET_ID_RE`, `isFleetMember`, `listFleetProjects`, and every existing export keep their exact semantics; `tests/unit/fleet-iteration-routing.test.ts` must keep passing unchanged. Added alongside (same file, same injected-`root` discipline, version header bumped with a rationale comment per the `fleet.ts:1-21` pattern):

```ts
export const TENANT_ID_RE = /^gw-[0-9a-f]{12}$/;

export interface TenantLoopTenant { id; principal; variant; projectDir; status;
  scopes: { upgrade; upstreamFile; backportReview; nightlyFleet };
  windows: { tz; days: number[]; start; end }; gitRemote; }

/** Registered tenant-loop projects, sorted by id: ONLY tenants with
 * scopes.nightlyFleet=true and status=active. Reads the registry under
 * <root>/.pipeline-state/ (injected root, deterministic, mkdtemp-friendly).
 * Absent/stale/malformed → fail-closed per design §3.1. Never readdir. */
export function listTenantLoopProjects(root?: string): TenantLoopTenant[];

/** tz-aware window check via Intl.DateTimeFormat (KST default when tz is
 * absent/invalid → false). Wrap-midnight windows supported. */
export function isTenantWithinWindows(tenant: TenantLoopTenant, now?: Date): boolean;
```

Plus a path-form guard `isTenantLoopProjectPath(path, root?)` (realpath prefix match against registered `projectDir`s — the twin of `isFleetProjectPath`, `fleet.ts:215-223`). **Consumers rule**: resync flows (`scripts/resync-audit.ts`), the `project-resync` skill Step-4 upgrade wave, and the review battery include tenants **only when `scopes.nightlyFleet: true`**, enumerated **exclusively** via `listTenantLoopProjects()` — never by readdir, never by name prefix. `scripts/backport-diff.ts` already imports from `lib/fleet.ts` (lines 116, 207-212) and gains the tenant list there.

### 3.3 D1.3 — Upstream filing for tenants (`scripts/mcp-upstream-server.ts`)

`resolveProject()` (line 327) gains a **second identity branch**, checked when the existing `Projects/` rule (realpath under `realProjectsDir`, walk-up nested-`.git` rejection :343-349, name regex, `template-version.txt` :352-366) does not match:

1. Load the tenant registry (§3.1 reader, in-process cache with the 24h/staleness rule).
2. Match `realCwd` against each **directly registered** `projectDir` by realpath prefix (`realCwd === projectDir` or `realCwd.startsWith(projectDir + sep)`). No walk-up discovery, no nested `.git` tolerated beyond the tenant root's own — the same nested-repo suspicion as the `Projects/` rule (the tenant root itself must have a `.git` directory; tenants are git repos from `new-project.ts`'s initial scaffold commit, `scripts/new-project.ts` v1.33.0 header).
3. On match → `ProjectIdentity { name: tenant.id, path: projectDir, variant: tenant.variant, version: <template-version.txt at the tenant root, when present> }`.

**Precedence unchanged**: cwd > client workspace roots (the E.4 tier, line 852+) > `self_declared project_root` — each still goes through `resolveProject()`.

**Rejection messages state the rule** (no silent blocking): the `Projects/` branch keeps naming `REGISTRATION_RULE` (line 183); the tenant branch returns its own explicit message — `tenant not registered in tenant-loop-registry (<path>): filing requires the tenant to be registered and scopes.upstreamFile=true (design 2026-11-08-gw-tenant-loop-and-hardening-design §3.3)`. A registered tenant with `scopes.upstreamFile=false` gets that reason verbatim, not the generic rule.

**Actor grammar** (`scripts/helpers/reprioritize.ts`): extend the `ReprioritizeActor` union (line 24) and parse regex (line 26) with `spoke-tenant:gw-<12hex>` (`/^spoke-tenant:(gw-[0-9a-f]{12})$/`); `strikeKeyFor` (lines 37-40) keys tenant actors on the tenant id (slice the `spoke-tenant:` prefix, like the spoke-pm case). P0/urgent stays user-only; the +1-level-per-ticket-per-24h cap applies to tenant actors exactly as to `spoke-pm` (lines 74-81). `scripts/helpers/ticket-store.ts` needs no logic change — it delegates to `checkReprioritize`/`strikeKeyFor` (lines 748-770) and its `history[]` rows (`{action:'reprioritize', actor, from, to}`, line 770) record the new actor value verbatim.

**Caps and first-seen**: tenant filings get the same per-project caps (`UPSTREAM_SOFT_CAP=10` / `UPSTREAM_HARD_CAP=30`, lines 196-197) **keyed on tenant id** (the cap counters treat `name` opaquely — using the tenant id as the project key is sufficient). `known-projects.json` (`KNOWN_PROJECTS_FILE`, line 227; `KnownProjects` map, line 305) is extended to also record tenants — keys `gw-<hex>` alongside `co-*` names, same `{first_seen, first_id}` shape — so a **first filing from an unknown tenant is forced to `triage: inbox`**, mirroring the existing first-seen behavior, under the same intake lock (line 600+).

### 3.4 D1.4 — Upgrade guard (`scripts/upgrade-project.ts`)

At the target-validation block (the membership refusal lives at lines 1463-1481 today; `allowNonMember` parsed at :1224/:1274): when the resolved target path matches a registered tenant via `isTenantLoopProjectPath()`, **before any write**:

- registry `status === "active"` (a suspended/absent tenant is refused, message naming the registry file);
- `scopes.upgrade === true`;
- `isTenantWithinWindows(tenant, new Date())` — the fleet.ts helper, so gateway windows and workspace execution re-check share one implementation (§4.3's double enforcement);
- **tenant mode defaults to `--dry-run`** unless `--confirm` is passed (a NEW flag, distinct from the existing `--yes` prompt-suppression, :1071 usage line): dry-run prints the plan; `--confirm` executes. `--dry-run` alone on a tenant stays dry-run.

Non-tenant paths (including non-member `Projects/co-*` refusals) are unchanged. The refusal/WARN rows record the tenant id and the reason (suspended / scope off / out-of-window) for the run log.

> **Addendum (2026-11-09, PR #1935 CI incident):** the guard's registry read is **lazy and path-scoped** (`upgrade-project.ts` v1.98.0): only a target whose realpath contains a `gw-<12hex>` segment (this section's `.../<principal>/gw-<12hex>/project` layout) consults the registry at all — every other outside-Projects target performs **zero registry IO**, so a stale or malformed registry file can never fail an ordinary upgrade. All refusal messages on plausible-tenant paths are unchanged (fail-closed preserved: malformed registry + tenant-shaped target → refuse; absent/stale → zero tenants → the normal outside-Projects WARN path). A registry path seam, `CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE` (absolute path to the registry FILE), replaces the repo-root resolution at the single point `lib/fleet.ts` `tenantLoopRegistryPath()` (fleet.ts v1.2.0, L0+L1 byte-identical), letting test fixtures keep registries in mkdtemp dirs instead of writing the real repo's gitignored `.pipeline-state` — the v1.0.0 backup/restore strategy there was the root cause of the incident: the guard test's leftover malformed repo-root registry made every later `upgrade-project` spawn (upgrade-decision-log, upgrade-instruction-census suites) inherit the fail-closed refusal, red on all three CI runners (the T-20261104-003 relative-path pollution class resurfacing via a gitignored path).

### 3.5 D1.5 — Backport diff tenant paths (`scripts/backport-diff.ts`)

`resolveProjects()` (lines 216-228) passes any path containing a separator through unchanged — an absolute tenant `projectDir` **already works** today; no `Projects/` prefix hardcode needs fixing. One real gap: `variantName()` (lines 231-235) derives the variant from the directory basename under `templates/` — a tenant dir is named `project`, so the lookup yields null and variant-keyed comparisons silently skip. Decision: when the path resolves to a registered tenant, take the variant from the **registry entry's `variant` field** (authoritative — it is the variant the tenant was scaffolded with), falling back to the existing basename heuristic otherwise. Read-only tool; the §6.7 WARN-and-proceed policy of the fleet design does not apply (tenants are not exclusions); `scopes.backportReview=false` tenants are skipped from default sets and warned on explicit `--project` naming.

## 4. WP2 — Admin ACL (all in `services/co-workspace/src/`)

### 4.1 D2.1 — Groups migration (new `src/migrations.ts`)

A versioned migration runner: ordered steps keyed on `PRAGMA user_version`, each step idempotent, and a **downgrade guard** refusing to open a database whose `user_version` is above the highest known step (never guess an unknown future schema). The runner is applied to `users.db` where the new tables live:

```sql
CREATE TABLE IF NOT EXISTS groups (
  group_id   TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  loop_config TEXT NOT NULL          -- JSON: { designatedUsers: string[], scopes: {...}, windows: {...} }
);
CREATE TABLE IF NOT EXISTS user_groups (
  group_id  TEXT NOT NULL REFERENCES groups(group_id),
  principal TEXT NOT NULL,
  PRIMARY KEY (group_id, principal)
);
```

`groups.loop_config` carries the **group-default** scopes/windows; a **per-tenant override** rides the tenant row itself as a JSON field on `TenantRecord` (stored in the `tenants.data` JSON column — the versionable-by-design column, `registry-db.ts:6-11,32-41`), no DDL needed: `loopGroup?: string` (governing group id) and `loopOverride?: { scopes?; windows? }` (sparse; unset keys inherit the group). `users.ts`'s ad-hoc pattern (PRAGMA table_info + rebuild-table + ALTERs, lines 108-140) is reused **only** as the rebuild-table technique for future constraint changes; new tables go through the migration runner, not more inline ALTERs.

### 4.2 D2.2 — Gating (default deny, audited both ways)

Tenant loop operations — registering/suspending/deregistering a tenant, changing tenant loop config, triggering a tenant upgrade — require **caller = admin role** (the existing `requireAdminReady` posture, `access.ts:55-62`, including the password-set force) **OR** `callerPrincipal` (`access.ts:29-35`) ∈ `designatedUsers` of the governing group/tenant. Everything else: **403, default deny**. Every decision — allow **and** deny — is recorded via `state.audit.record(caller, action, target, detail)` (the established signature, e.g. `access.ts:77`), with new action names `tenant.loop.<op>.allowed|denied`.

### 4.3 D2.3 — Windows double enforcement

The gateway refuses an out-of-window upgrade trigger at the admin route (same window math, server side). The workspace **re-checks at execution time** via `isTenantWithinWindows` inside the upgrade guard (§3.4) — covering the nightly/runner path where no gateway call is involved and covering clock skew between the two processes. One implementation (fleet.ts), two enforcement points; a window config change between trigger and execution is caught at execution.

### 4.4 D2.4 — Admin API (`src/routes/admin.ts`)

Ordered route matches in the existing `handleAdmin` style (method + path checks with `requireAdminReady`, e.g. `routes/admin.ts:22-23,60-61`):

| Route | Behavior |
|---|---|
| `POST /admin/tenant-loop/tenants/:id/register` | body `{scopes?, windows?, gitRemote?, group?}` → validates against the §3.1 schema, writes `loopGroup`/`loopOverride` on the tenant record, marks the registry export |
| `POST /admin/tenant-loop/tenants/:id/suspend` / `.../deregister` | status flip / removal (deregister keeps the tenant itself; only its loop participation ends) |
| `PUT /admin/tenant-loop/config` | group-level defaults (scopes/windows/designatedUsers) |
| `POST /admin/tenant-loop/tenants/:id/upgrade` | **dry-run first**: returns the plan JSON (variant, target template version, snapshot branch name, scope/window verdict). A second call with `{confirm:true}` executes: snapshot → spawn workspace `scripts/upgrade-project.ts` |
| `GET /admin/tenant-loop/registry` | preview export (the exact JSON that would be written) |

**Kill switch**: env `CO_WORKSPACE_TENANT_LOOP_DISABLED` (any non-empty value) short-circuits every tenant-loop route with an explicit 503-style message, plus per-tenant `status: suspended`. **Quota**: per-tenant daily upgrade count, reusing the daily UTC-day bucket pattern (`tenant.ts recordTurnUsage` :98-114 / `access.ts windowUsage` :131-144): a `loopState: { upgradesDay: string, upgradesToday: number }` block on the tenant record; the cap is a config constant (default 1/day/tenant), 429 on exceed, counter reset when the day key rolls. **Snapshot before upgrade**: `git -C <tenantDir> branch tenant-backup/<ts>` (tenants are git repos from `new-project.ts`'s initial scaffold commit); when `gitRemote === "local-only"` the API response notes the backup is branch-local (no remote safety net). **Credential separation**: the spawned upgrade subprocess gets a **minimal env allowlist** — the gateway's own env is never passed through, reusing the `allowlistedEnv` mechanism (`hermes.ts:286-292`, already applied to the scaffold child at `scaffold.ts:56`).

### 4.5 D2.5 — Registry export discipline

The registry file (§3.1) is rewritten after **every** successful admin mutation and once at gateway boot (after migrations and config load, alongside the existing boot sweeps in `server.ts:209-230`). A failed export write is loud (console error + audit row) and leaves the previous file in place — the 24h staleness bound (§3.1) then fails the workspace side closed rather than acting on stale data.

## 5. WP3 — Hardening

### 5.1 D3.1 — Fixture-root gate (mechanical, in `scripts/dev-sync.ts` + standalone)

**Problem**: nothing forbids a test suite from creating repo-root residue — the class that made `rm -rf Projects` look reasonable on 2026-11-04 (`memory/2026-11-04.md:159`). PR #1855 made the fixtures absolute; this gate makes it **enforced**.

**Placement** (verified against the live step order): the pipeline stages files by name **earlier** than the staging block — Step 3b stages `CHANGELOG.md` (:786), Step 3.86 stages generator outputs (:899), Step 4.87 stages regenerated agent files (:1630) — so a blanket "porcelain must be empty" assertion before staging is impossible. The last test-executing steps are Step 3.95 (`bun run test`, :1097) and Step 4.85 (`bun run test:unit` on version bumps, :1569-1586); the scoped-staging S1 snapshot reads `git status --porcelain=v1 -z -uall` at :1791. **Decision: a new blocking step immediately before the S1 snapshot** (proposed number **Step 5.9** — final number assigned at edit time to sit between the 4.x family and the staging block), asserting on **untracked whole-directory entries only**:

- run `git status --porcelain` from the repo root;
- **FAIL** on any `??` entry of the form `?? <top>/` where `<top>` is one of the repo's known top-level directories (`Projects`, `services`, `templates`, `tests`, `docs`, `scripts`, `agents`, `skills`) — porcelain shows `?? <dir>/` only when the **entire directory is untracked**, which is precisely the fixture-escaped-its-tmpdir signature (a suite recreating `Projects/` at the repo root; a mkdtemp fixture landed under `tests/` or `services/` with a relative root — the T-20261104-003 class);
- file-level untracked entries inside tracked directories (`?? tests/unit/new-thing.test.ts`) are ordinary task work — left to the existing scoped-staging residual classification (:1786-1845), not this gate.

**Standalone**: `scripts/check-workspace-hygiene.ts` (new, `@version` header + rationale comment per the fleet.ts convention) runs the same rule locally (exit 1 with the offending entries + the design citation); dev-sync's Step 5.9 invokes this script rather than duplicating the logic — one implementation, two callers.

### 5.2 D3.2 — Boot validation (gateway refuses a silent-empty catalog)

In `services/co-workspace/src/` — after config load in the boot path (`createState()`, `server.ts:147`), before the boot sweeps: if the resolved variant catalog is empty (`state.cfg.variants.length === 0` — reachable today via `CO_WORKSPACE_VARIANTS=all|*` with a missing/unreadable `templates/` dir, `config.ts:273-274`, or an empty explicit list) **and** `CO_WORKSPACE_ALLOW_EMPTY_CATALOG` is not set → **refuse boot** (`process.exit(1)`) with an actionable message naming: the escape env var, the `workspaceDir` searched (`config.ts:309`), and the expected `templates/` path. The same check validates that `scripts/new-project.ts` exists under `workspaceDir` (the scaffold engine the gateway shells out to, `scaffold.ts:24`) under the same escape. Implement as a **pure decision function** (inputs: resolved config + env; output: `{ok} | {ok:false, reasons[]}`) so the unit suite exercises it without spawning the server — the boot path calls it and exits on `ok:false`. The message text cites this design section.

## 6. Failure semantics (fail-closed summary)

| Surface | Condition | Behavior |
|---|---|---|
| Workspace tenant registry reader | file absent / malformed / stale (>24h) / major `schemaVersion` bump | zero tenants; consumers hard-fail or no-op, never guess (§3.1) |
| `listTenantLoopProjects` consumers | loader throws (malformed) | run aborts with the malformed detail — no silent fallback to enumeration |
| `isTenantWithinWindows` | invalid/absent `tz`, unparseable window | `false` (deny) — fail-closed |
| Upstream tenant identity | unregistered tenant cwd | explicit rejection message stating the registration rule (§3.3) |
| Upgrade guard | suspended tenant / `scopes.upgrade=false` / out-of-window / no `--confirm` | refuse or stay dry-run; reason recorded (§3.4) |
| Admin gating | non-admin, non-designated caller | 403 default deny; allow AND deny audited (§4.2) |
| Gateway boot | empty variant catalog / missing scaffold engine, escape env unset | `exit(1)` with actionable message (§5.2) |
| dev-sync Step 5.9 | untracked whole-dir residue in a known top-level dir | blocking failure naming the entries (§5.1) |
| Registry export write | write fails | previous file stays; 24h staleness then fails the workspace closed; gateway logs + audits (§4.5) |

## 7. Test plan

Unit tests colocated in `tests/unit/`, mkdtempSync fixtures + **absolute** tmpdir roots only (never relative roots that could recreate `Projects/` — the T-20261104-003 / PR #1855 lesson), deterministic helpers with injected roots.

### 7.1 Registry + windows — `tests/unit/tenant-loop-registry.test.ts`, `tests/unit/tenant-loop-windows.test.ts`

Registry: valid file parses all fields; each malformed case → `malformed` with useful detail (bad id — `co-wrongnamespace`, 13 hex, uppercase; bad status; bad scopes keys; bad `days` (7, -1, floats); bad `HH:MM` (`24:00`, `22:60`); duplicate id); absent file → zero tenants; stale `writtenAt` (25h old) → zero tenants; `schemaVersion: 2` → treated as absent (never misread). Windows: KST default; wrap-midnight window (22:00-06:00) true at 23:30 and 01:00, false at 12:00; `days` matching per `Intl` weekday; invalid tz → false; DST-edge sanity via fixed offsets; determinism with injected `now`.

### 7.2 Fleet separation — `tests/unit/tenant-loop-list.test.ts` (+ existing suites untouched)

`listTenantLoopProjects` on mkdtemp fixtures: only `nightlyFleet:true` + `active` tenants returned; sorted; suspended/nightly-off dropped; injected-root determinism (two roots never cross). `isTenantLoopProjectPath`: absolute/relative/trailing-separator; a fleet path (`Projects/co-x`) is never a tenant path and vice versa. `tests/unit/fleet-membership.test.ts`, `tests/unit/fleet-list.test.ts`, `tests/unit/fleet-script-parity.test.ts` must pass **unchanged** — the namespace-separation proof.

### 7.3 Structural guard extension — `tests/unit/fleet-iteration-routing.test.ts`

Keep both existing layers green; extend the pinned-consumer list with the new WP1 consumer sites (resync-audit, backport-diff tenant enumeration) asserting they import from `scripts/lib/fleet.ts`; layer 2 already fails any new unregistered `Projects/` enumerator — add an explicit case that a registry-reading helper triggers no `Projects`-readdir classification (it reads `.pipeline-state/`).

### 7.4 Upstream tenant filing — `tests/unit/mcp-upstream-tenant-identity.test.ts`

resolveProject tenant branch: cwd inside a registered `projectDir` (realpath, incl. a symlinked cwd) resolves as the tenant; cwd outside every registered dir falls through to the existing rule/message; nested `.git` below the tenant root rejected; precedence cwd > client roots > self_declared preserved (assert ordering with all three present); rejection messages state the rule (tenant-unregistered vs `REGISTRATION_RULE` — snapshot the strings); caps keyed on tenant id (11th filing → soft-cap rejection); first filing from an unknown tenant → `triage: inbox` via the extended `known-projects.json`; reprioritize actor `spoke-tenant:gw-<hex>`: parse, cap raise +1/24h, P0 refusal, strike ledger keyed on tenant id (extend `tests/unit/ticket-upstream-triage.test.ts` style).

### 7.5 Upgrade guard + backport diff — `tests/unit/upgrade-project-tenant-guard.test.ts`, backport-diff tenant case

Tenant guard: active+scoped+in-window → dry-run by default, `--confirm` proceeds; suspended → refuse; `scopes.upgrade=false` → refuse; out-of-window → refuse with reason rows; non-tenant target → existing behavior byte-for-byte (regression pins). Backport diff: `resolveProjects` accepts an absolute tenant path; variant derived from the registry entry, not the `project` basename.

### 7.6 Gateway migrations + ACL — `tests/unit/co-workspace-migrations.test.ts`, `tests/unit/co-workspace-tenant-loop-acl.test.ts`

Migrations: fresh DB → all steps applied, `user_version` at head; re-run → idempotent no-op; seeded `user_version` above head → refused (downgrade guard); groups tables created with the declared columns. ACL: admin passes, designated user passes, ordinary user 403 default deny; **audit rows recorded for allow AND deny**; kill switch env → every tenant-loop route refuses; per-tenant suspend refuses upgrades only; daily upgrade quota → 429 on exceed, reset on day-key roll; windows double enforcement (gateway refuses out-of-window trigger; execution-time re-check unit-tested via the fleet.ts helper); registry export written after a mutation and at boot (tmp fixture dataDir); upgrade spawn env is the allowlist (no `CO_WORKSPACE_*` secret passthrough — assert the constructed env object); snapshot branch command shape (`branch tenant-backup/<ts>`); `local-only` note present.

### 7.7 Boot validation — `tests/unit/co-workspace-boot-validation.test.ts`

Pure decision function: empty catalog + env unset → `ok:false` with reasons naming the env var/workspaceDir/templates path; env set → ok; non-empty catalog → ok; missing `scripts/new-project.ts` → ok:false under the same escape.

### 7.8 Hygiene gate — `tests/unit/workspace-hygiene.test.ts` + dev-sync

`check-workspace-hygiene.ts`: fixture repo (a real `git init` under mkdtemp) with an untracked whole-dir `Projects/` → exit 1 listing it; untracked file inside a tracked dir → exit 0; dirty-but-tracked files → exit 0 (not this gate's concern). Dev-sync Step 5.9: structural placement asserted (the step invocation appears before the S1 snapshot in source order) + the script's exit code is honored (blocking). Existing suites (`bun run test`, `verify-scripts.ts --verify`, `audit.ts`, spec-check) stay green.

## 8. Rollout and acceptance

One implementation PR set (automation-engineer + docs-writer dispatches after approval; per-WP sub-PRs acceptable, WP2 last since it depends on WP1's registry):

1. WP1: `fleet.ts` tenant helpers + registry reader; upstream server tenant branch + actor grammar + known-projects tenants; upgrade guard; backport-diff variant fix; tests of §7.1-7.5, §7.3.
2. WP2: `src/migrations.ts` + groups tables; gating + audit; admin routes; kill switch/quota/snapshot/env allowlist; export writer at boot + mutation; tests of §7.6.
3. WP3: `check-workspace-hygiene.ts` + dev-sync Step 5.9; boot validation; tests of §7.7-7.8.
4. SCRIPTS.md / VERSION_MANIFEST rows for the new script; version-header bumps with rationale comments on every touched script.

**Acceptance criteria**:

- [ ] With a registered tenant fixture, `listTenantLoopProjects` returns it only when `nightlyFleet` is true; renaming the registry away yields zero tenants and every consumer proceeds as if no tenants exist (fail-closed proof).
- [ ] `fleet-iteration-routing.test.ts` passes unchanged; fleet suites report no tenant anywhere.
- [ ] A tenant cwd can file an upstream request when registered+scoped and cannot otherwise — with the reason stated in the rejection message; caps and first-seen inbox behave identically to `co-*` projects.
- [ ] `upgrade-project.ts` on a tenant is dry-run by default and refuses suspended/out-of-scope/out-of-window targets; non-tenant invocations are unchanged.
- [ ] Gateway: only admin/designated callers reach tenant-loop routes; every decision audited; kill switch and suspend work; registry export regenerated on mutation and boot.
- [ ] dev-sync Step 5.9 fails on a planted `Projects/` dir and passes a clean tree; the standalone script matches.
- [ ] Gateway boot with `CO_WORKSPACE_VARIANTS=all` and a hidden `templates/` dir exits 1 naming the escape env; with the env set it boots.
- [ ] No split artifacts anywhere in the diff (no workspace-contract.json, updater, ADR-0104, public docs).

## 9. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no SKILL.md, CLAUDE.md, or mirror changes; the `project-resync` skill's Step-4 upgrade wave consumes tenants via the same `lib/fleet.ts` helper without wording edits (skill text change, if any, is deliberately deferred to the implementation PR) | None in this PR |
| Antigravity (GEMINI.md) | None — gateway and pipeline changes are platform-agnostic | None |
| templates/common | **Hard rule — nothing propagates.** `.pipeline-state/` is gitignored runtime state; `fleet.ts` tenant helpers, `check-workspace-hygiene.ts`, `migrations.ts`, and the admin routes are L0/workspace-root or `services/co-workspace` assets and must NOT enter any propagation map, the common-contract delivery, or L1/L2 deliveries | N/A — validated by existing propagation audits |

**Addendum (2026-11-09, QA finding F1 — ruling recorded at implementation, no code change):** the `templates/common` hard rule above is amended for `scripts/lib/fleet.ts` exactly the way DEC-20261107-01 condition 7 amended the fleet design's own delivery rule: the file — now including this design's WP1 tenant-loop helpers (`loadTenantLoopRegistry`, `listTenantLoopProjects`, `isTenantWithinWindows`, `tenantForProjectPath`, `isTenantLoopProjectPath`) — is **intentionally delivered L0+L1 byte-identical** (`templates/common/scripts/lib/fleet.ts`), because variants consume the SAME helper: the delivered consumer scripts (e.g. `evidence-backport-scan.ts` A3, and the resync/backport tooling the §3.2 consumers rule routes through it) statically import it, so the IC-01 `l1-import-closure` gate (validate-templates, per the ADR-0073 Amendment 4 fix policy) forces the leaf pure-module into the delivered closure. This is the ruling already recorded in the `tests/unit/generate-scripts-mirror.test.ts` registry row for `lib/fleet.ts` and enforced byte-for-byte by the `tests/unit/fleet-iteration-routing.test.ts` delivery-deviation pin; a delivered copy reads the PROJECT's own `.pipeline-state/tenant-loop-registry.json` (absent/stale → zero tenants), so no workspace tenant state ever reaches L1/L2 — the operative intent of the hard rule stands.

## 10. Risks and open questions

**Risks** (with mitigations already designed in): registry staleness between gateway write and workspace read → 24h bound + fail-closed zero; tz/clock misconfiguration → window check denies (fail-closed) and the admin API surfaces the effective window in the dry-run plan; symlink games against `projectDir` prefix matching → realpath on both sides + the tenant's own `.git` required + direct-registry-entry only (no discovery walk); gateway-spawned upgrade executes workspace code → dry-run default, snapshot branch, minimal env allowlist, kill switch; migration downgrade → `user_version` guard refuses; hygiene-gate false positives → whole-directory-untracked rule only, known top-level dir list, file-level entries untouched; dual-state consistency (SQLite record ↔ registry export) → export rewritten after every mutation, staleness bound as the safety net.

**Open questions**: none blocking. Non-blocking notes: (1) the exact dev-sync step number for §5.1 is finalized at edit time (the 5.x/6.x boundary is crowded); (2) if tenant filings grow noisy, a per-tenant `UPSTREAM_*_CAP` override can follow later — same `readCap` pattern, out of scope here.

## 11. Repository-config integrity guard (2026-11-09 incident)

**Addendum — implementation hardening landed after this design's first merge.** Not a change to the §3-§8 scope: it closes the second corruption mode produced by the incident this design's QA wave caused.

**Context.** §5.1 hardened the pipeline against a child process inheriting a git hook's environment (`scripts/lib/git-env.ts`, PR #1935). That fix addressed *commits*. The same inheritance has a second, unguarded failure mode: **`git config` writes**.

Two corruption modes, both attributed to the same inheritance path on 2026-11-09. Their evidence differs and is stated separately:

1. **Rogue commits — reproduced.** `git push` exports `GIT_DIR` into the `pre-push` hook; the hook's `bun test` child inherited it, and the `upgrade-project` fixtures' `git init`/`add`/`commit` ran against the checkout instead of their tmpdir — 10 commits authored `Test <test@example.com>`, ~393 files, three L1 core scripts deleted. Reproduced on 2026-11-09 (`GIT_DIR=$(git rev-parse --git-dir) bun test <suite>` re-created it with HEAD unchanged). Fixed by `scripts/lib/git-env.ts` (`gitCleanEnv` for `spawnSync`/`Bun.spawn`, `gitCleanEnvForShell` for Bun Shell) applied at every test spawn.
2. **Repository config corruption — directly observed, not mechanically detected.** After the mode-1 recovery the checkout was unusable and the operator/agent in that session observed it first-hand: `git status` failed with `fatal: this operation must be run in a work tree`; `git worktree list --porcelain` marked the main worktree `bare`; `.git/config` was read and contained `bare = true`; `.git/worktrees/` was absent. No gate named the cause — the day's memory log records only the mode-1 rogue commits, and the config write itself was not separately reproduced. Repair applied manually: `git config --local core.bare false`. The mechanism is the mode-1 inheritance path (reproducible) applied to `git config`: any fixture-side `git config` write made under an inherited `GIT_DIR` lands here, because **worktrees share the main `.git/config`** — one redirected write corrupts every checkout of the repository, and the damage outlives the process that caused it.

**Why worktrees are the amplifier.** A linked worktree's own state lives in `.git/worktrees/<name>/`, but *config* is not per-worktree unless `extensions.worktreeConfig` is enabled — `--local` resolves to the common `.git/config`. A guard that only inspects the working tree's own directory therefore cannot see the damage; it must read the repository config the way git does.

**Design.**

- `scripts/lib/repo-integrity.ts` (v1.0.0) — one derivation, three primitives:
  - `snapshotRepoConfig(root?)` → sorted `key=value` lines from `git -C <root> config --local --list` plus the *effective* `core.bare` (local > global > system; a global bare breaks the tree just as effectively);
  - `diffRepoConfig(before, after)` → pure `{ added, removed, changed }`, order-insensitive and multi-value aware (`remote.origin.fetch` repeats); added/removed are key-level, so an existing key gaining a value reports as `changed`;
  - `assertWorkTreeHealthy(root?)` → `{ ok: true }` or `{ ok: false, reason }`, where the reason carries the exact repair (`git config --local core.bare false`) and the incident reference.
  Every git spawn inside the module runs under `gitCleanEnv()` — a redirected *read* would snapshot a different repository and compare clean, defeating the gate itself.
- `scripts/dev-sync.ts` v1.45.0 — **start-of-run invariant** immediately after the CWD guard (`assertWorkTreeHealthy` → FATAL with the repair line, turning the cryptic git fatal into a one-line fix), and **config integrity gate** as step 4.88, after the last test-executing step (4.85) and before the 4.9 audit gate: the run-start snapshot is compared against a post snapshot, and any delta is FATAL listing added/removed/changed keys plus the statement that a test mutated the repository config. Blocking, because a run that corrupted the repository must never reach staging/commit.
- `scripts/hooks/pre-push.ts` v1.8.1 — the same snapshot/compare around the changed-path test run (the origin of mode 1); four `git config` reads, no writes. v1.8.1 closes the fail-open gap: an unreadable snapshot at either phase aborts non-zero (v1.8.0 warned and skipped), and the comparison includes the effective `core.bare`, so a bare flip with an unchanged local key list is refused.
- `tests/unit/repo-integrity.test.ts` — pure diff pins, mkdtemp fixture integration (healthy / `core.bare = true` / non-repository / a mid-run flip detected by the snapshot pair / a global-scope bare flip with an empty local key diff), the pre-push fail-closed contract (an unreadable snapshot aborts; a bare flip with an empty key diff is still refused), and structural pins that the invariant precedes the first test step, the gate sits between 4.85 and the audit gate, and the hook has no fail-open skip path.

**Fail-closed semantics.** Unreadable config at run start, unreadable config after the tests, any delta, or a bare work tree all abort with a non-zero exit and a named remedy. No silent repair: the guard reports, it does not edit `.git/config`.

**Sanctioned-writer exclusions: none, deliberately.** Verified 2026-11-09 that no sanctioned tool writes *this* repository's local config during a sync or push run — every `git config` write in `scripts/` targets an explicit project directory (`-C <projectDir>` or a chdir'd scaffold: `new-project.ts`, `adopt-project.ts`, `migrate-project.ts`, `upgrade-project.ts`, `create-l3-scaffold.ts`), and dev-sync installs no hooks. The gate is therefore exact rather than relaxed by a key allowlist. If a sanctioned writer is ever added, that one key is named at the call site; a blanket skip env is explicitly rejected (it would let the original incident through).

**Non-goals.** Rewriting `.git/config` back to a snapshot (a config write from the pipeline is the exact hazard being guarded); detecting corruption that predates the run (that is the start-of-run invariant's job); cleaning `.git/worktrees/` residue.

## 12. References

- `memory/meeting-2026-11-08-coworkspace-gap-review.md`, `memory/meeting-2026-11-08-coworkspace-public-repo-design-review.md` (ratifying meetings; co-workspace-stays ruling)
- `scripts/lib/fleet.ts:1-258` (version-header + fail-closed conventions; `FLEET_ID_RE` :58; `isFleetProjectPath` :215)
- `scripts/mcp-upstream-server.ts` (`REGISTRATION_RULE` :183, `resolveProject` :327-376, caps :196-197, `KNOWN_PROJECTS_FILE` :227, atomic write :320-323, intake lock :600)
- `scripts/helpers/reprioritize.ts` (actor grammar :24-40, cap check :74-81) + `scripts/helpers/ticket-store.ts` :729-770
- `scripts/upgrade-project.ts` (usage :1071, `allowNonMember` :1224/:1274, membership refusal :1463-1481); `scripts/backport-diff.ts` (:207-235)
- `services/co-workspace/src/`: `util.ts:7-10` (genId), `registry-db.ts:32-41,119-169` (tenants table, storage layout), `tenant.ts:33-114` (record shape, daily buckets), `access.ts:29-104,204-215` (principal/admin/quota/reauth gates), `routes/admin.ts` (route conventions), `config.ts:266-310` (resolveVariants, dataDir/workspaceDir), `server.ts:145-278` (boot sequence), `scaffold.ts` (new-project subprocess, env allowlist :56), `hermes.ts:286-292` (allowlistedEnv), `users.ts:108-140` (rebuild-table precedent)
- `scripts/dev-sync.ts` (:786, :899, :1097, :1569-1586, :1630 staging-by-name sites; :1786-1845 scoped-staging S1) — placement evidence for §5.1
- `memory/2026-11-04.md:159` (rm -rf Projects incident), T-20261104-003/-004, PR #1855 (fixtures absolute)
- `docs/designs/2026-11-07-fleet-membership-ssot-design.md` (format exemplar + the SSOT this design extends without disturbing)
