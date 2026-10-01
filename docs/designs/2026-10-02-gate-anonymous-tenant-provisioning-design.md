---
lang: ko
lang_reason: source-material
---

# Gate Anonymous Tenant Provisioning Design — co-workspace

- **Date**: 2026-10-02
- **Status**: Implemented 2026-10-02 — D1–D6 recommendations accepted by the user ("진행해줘"); gate, knob, companion hardening, and tests delivered (§5 as built; existing open-mode test sandboxes migrated per §5.5).
- **Spec ID**: 2026-10-02-gate-anonymous-tenant-provisioning-design
- **Related**: `services/co-workspace/src/{access,lifecycle,scaffold,config}.ts`, `services/co-workspace/src/routes/{tenants,compat,gemini}.ts`; incident record `memory/2026-10-02.md` (gw-76f6b4c9c6ff orphan cleanup); prior orphan `memory/2026-09-29.md` (gw-fd71bde230fa); `memory/meeting-2026-10-01-upstream-request-mcp.md` (Q8, `gw-*` as Projects/ residents); ADR-0074 (Design Gate).
- **Scope**: design of the provisioning gate, the companion hardening (lazy-path tenant cap, provisioning audit, failed-scaffold rollback, boot-time sweep), and the configuration knob. No implementation in this document.

---

## 1. Background — the 2026-10-01 orphan as evidence

On 2026-10-01 11:06:27 KST, a request with **no credential** reached the co-workspace gateway and lazily
provisioned tenant `gw-76f6b4c9c6ff` (`co-consult::anonymous`, owner `anonymous`). The scaffold subprocess
(`scripts/new-project.ts`, thousands of files plus an initial git commit inside the workspace's `Projects/`)
was then externally SIGTERMed (exit 143). The provisioning-failure path persisted `status: failed` but never
removed the scaffolded source dir, so `Projects/gw-76f6b4c9c6ff` stayed behind as an orphan. The operator
cleaned it manually on 2026-10-02 (registry row + directory). This was the second incident of the class —
`gw-fd71bde230fa` orphans were cleaned on 2026-09-29.

The incident exposed two distinct problems:

1. **P-A (this design's subject)**: an unauthenticated HTTP request can trigger a full workspace scaffold.
   Provisioning is a privileged, resource-consuming operation, but in open mode it runs with zero privilege check.
2. **P-B (companion hardening, in scope)**: a failed provisioning leaves permanent state — the `failed` registry
   row wedges the key forever (lifecycle.ts `ensureReady` throws on `failed`), and the scaffolded source dir is
   never cleaned up. A gateway crash mid-scaffold leaves the same litter.

## 2. Current behavior — provisioning entry points and their gates

| Entry point | Where | Create happens | Gates before create | Gates after create |
|---|---|---|---|---|
| Lazy surface routes (OpenAI/Anthropic compat, Gemini) | `routes/compat.ts`, `routes/gemini.ts` → `resolveLazyTenant` → `getOrStartTenant` (lifecycle.ts) | Immediately on request | Variant allowlist (config, not request) | `requireTenantAccess` — runs **after** `startProvisioning` has been called |
| Explicit session create | `routes/tenants.ts` `POST /sessions` | On request | Variant allowlist; `tenantMaxPerPrincipal` cap; audit `tenant.create` | none needed (owner = caller) |
| Tenant reachability (any route) | `access.ts` `requireTenantAccess` | — | — | owner match / admin / open mode |

Gaps:

- **G-A1**: `resolveLazyTenant` falls the principal back to `"anonymous"` (lifecycle.ts:177) and creates +
  starts provisioning **before** any access check. In open mode (`apiKeys.length === 0 && !loginRequired`,
  access.ts:37) every caller is unauthenticated by definition, so anyone who can reach the port can spend the
  scaffold engine (bun + git writing thousands of files into the operator's workspace clone).
- **G-A2**: the lazy path never enforces `tenantMaxPerPrincipal` (only `POST /sessions` does), so the cap is
  advisory for exactly the path anonymous traffic actually takes.
- **G-A3**: the lazy path records **no audit event** on create (`getOrStartTenant` calls `registry.create` +
  `startProvisioning` only); a denial today would be invisible too.
- **G-B1**: `provisionTenant`'s catch marks `failed` and persists — it never removes the scaffolded
  `Projects/<tenantId>` source dir, even when the failure happened before relocation. No boot-time sweep
  reconciles `Projects/gw-*` dirs against the registry, so a gateway crash mid-scaffold also litters.
- Note on principal identity: `"anonymous"` is one **shared** principal. Any cap keyed on it bounds the total
  anonymous surface per instance, not per attacker; any audit line reading `anonymous` cannot attribute a source.

## 3. Cost model — why gate rather than warn

Per provisioning run: `new-project.ts` writes thousands of files under the workspace's `Projects/<tenantId>`,
inits a git repo and commits (≈4 s CPU observed), seeds a hermes home, and in docker isolation starts
containers. Disk persists until someone deletes it. The surface is bounded — one scaffold per
`(variant, principal)` key, and the default variant list is `co-consult` only — but the bounds are set by
server config, not by any property of the caller. Two aggravators:

- **Failure wedge**: once provisioning fails, the key is permanently unusable (`ensureReady` throws on
  `failed`), and (before this design) the leftover scaffold stays in `Projects/`.
- **Cross-feature amplification**: other workspace tooling trusts `Projects/` residents by directory rule —
  the upstream-request MCP registration rule is "direct child of `Projects/`, `^co-…`, carries
  `template-version.txt`" (2026-10-01 meeting, Q2/Q8). Unauthenticated scaffolding manufactures plausible
  requester directories. The first-request-forced-to-inbox rule mitigates; the gate removes the source.

## 4. Goals / Non-Goals

**Goals**

- G1: Default-deny tenant provisioning for unauthenticated callers; allow only via an explicit opt-in env var.
- G2: Open mode semantics unchanged for *reaching existing tenants* (`requireTenantAccess` untouched).
- G3: Every provisioning attempt — created, denied — produces an audit record.
- G4: `tenantMaxPerPrincipal` enforced on the lazy path, from a single shared implementation.
- G5: A failed provisioning removes its `Projects/<tenantId>` source dir (path-guarded); a boot-time sweep
  removes `gw-*`-pattern leftovers absent from the registry (covers gateway-death mid-scaffold).
- G6: Env-only configuration, zero new dependencies (house pattern).

**Non-Goals**

- N1: No per-IP rate limiting or attribution — the gateway is a local/shared-host service; the shared
  `anonymous` principal makes per-source accounting meaningless today.
- N2: No auth redesign, no login requirement changes, no per-caller identity for anonymous users.
- N3: No migration tooling for pre-existing `failed` rows or already-orphaned dirs (cleaned manually on
  2026-10-02; the boot-time sweep covers future residue).
- N4: No changes to docker/volume isolation paths, turn handling, or token quotas.

## 5. Design

### 5.1 The gate (P-A)

New helper in `access.ts`:

```ts
/** Provisioning is privileged: a credential (session or API key) or an explicit
 *  opt-in is required to spawn a new tenant scaffold. Reachability (requireTenantAccess)
 *  is a separate, weaker property and stays as-is. */
export function assertProvisioningAllowed(state: GatewayState, req: Request, variant: string): void {
  if (callerPrincipal(state, req) !== null) return;   // session user or valid API key label
  if (state.cfg.allowAnonProvisioning) return;        // explicit opt-in for public/throwaway deploys
  state.audit.record("anonymous", "tenant.provision.denied", variant, "unauthenticated");
  throw new HttpError(401, "authentication required to create a session — sign in or present an API key");
}
```

Call sites — both before any `registry.create`:

1. `resolveLazyTenant` (lifecycle.ts): call **first**, resolving the current create-then-check ordering
   into check-then-create. No registry row, no `gw-*` directory, and no scaffold occurs on denial.
2. `POST /sessions` (routes/tenants.ts): before the `registry.create` block. `POST /sessions` keeps its
   existing cap + audit, which now also cover the credentialed path uniformly.

Response mapping needs no per-surface work: `HttpError` already flows through each surface's existing error
envelope (compat/gemini/chat). 401 is chosen over 403 because the condition is *absence of credential*
(D6).

### 5.2 Configuration knob

- `GatewayConfig.allowAnonProvisioning: boolean`, read from `CO_WORKSPACE_ALLOW_ANON_PROVISIONING === "true"`.
  Default **false** (fail-closed).
- `openModeWarning` (access.ts) gains a second line when open mode is active: whether anonymous provisioning
  is enabled or gated, so the operator can see the effective posture at boot:

  ```text
  [co-workspace] OPEN MODE: no API keys and login not required — anonymous tenants are reachable by anyone who can reach this port
  [co-workspace] OPEN MODE: anonymous provisioning is GATED (set CO_WORKSPACE_ALLOW_ANON_PROVISIONING=true to allow)
  ```

### 5.3 Companion hardening (P-B, same change set)

1. **Lazy-path cap**: extract the `POST /sessions` per-principal cap into `assertTenantCap(state, owner)`
   (access.ts) and call it from `resolveLazyTenant` before create. For the shared `anonymous` principal this
   bounds total anonymous tenants per instance — the cap becomes meaningful in opt-in deployments.
2. **Audit completeness**: `getOrStartTenant` records `tenant.create.lazy` (owner, tenantId, variant) after
   `registry.create`; denials are recorded by the gate itself (5.1). Every provisioning decision is now
   attributable to an audit line.
3. **Failed-scaffold rollback**: in `provisionTenant`'s catch, if the failure occurred **before the relocate
   step completed** (track a `relocated` boolean set after `moveDir` returns), remove the source dir:
   `rmSync(resolve(cfg.workspaceDir, "Projects", rec.tenantId), { recursive: true, force: true })` — guarded
   the same way `deleteTenantData` guards its rmSync targets (resolved path must be
   `<workspaceDir>/Projects/<rec.tenantId>` exactly). After relocation failures, cleanup is
   `deleteTenantData`'s job (its targets then exist) — no behavior change there.
4. **Boot-time sweep**: at startup, after `reapOrphanedTurns`, list `<workspaceDir>/Projects/` entries
   matching `^gw-[0-9a-f]{12}$` that have no registry row, and remove them (force, path-guarded). This is the
   reconciliation for gateway-death mid-scaffold, where no catch block can run. It never touches `co-*` dirs
   (those are bare-name human scaffolds).

### 5.4 Resulting posture matrix

| Caller | Reach existing tenant (open mode) | Provision new tenant (default) | Provision new tenant (`ALLOW_ANON=true`) |
|---|---|---|---|
| Unauthenticated | allowed (unchanged) | **401 + audit** | allowed, subject to shared `anonymous` cap |
| API-key label | owner/admin rules (unchanged) | allowed + cap + audit | same |
| Logged-in session | owner/admin rules (unchanged) | allowed + cap + audit | same |

### 5.5 Migration and compatibility

- Behavior change is confined to unauthenticated callers *creating* tenants. Deployments running with API
  keys or `CO_WORKSPACE_LOGIN_REQUIRED=true` see no change. Open-mode deployments that relied on
  zero-friction first use must set `CO_WORKSPACE_ALLOW_ANON_PROVISIONING=true` during migration (one env
  line) — recommended only for genuinely public, throwaway instances.
- Web UI (`web/index.html`): the "new session" failure path surfaces the 401 message; a hint line pointing
  at sign-in is a copy-only follow-up, not a blocker.
- No registry schema change, no data migration.

### 5.6 Tests

Colocated per the service convention (`tests/unit/co-workspace-*.test.ts`, run via
`bun test tests/unit/co-workspace-`):

1. Unauthenticated `resolveLazyTenant` → 401, registry row count unchanged, no `Projects/gw-*` dir created,
   audit contains `tenant.provision.denied`.
2. Same with `allowAnonProvisioning=true` → row created, `tenantMaxPerPrincipal` enforced on the lazy path
   (429 at cap).
3. `POST /sessions` unauthenticated → 401 before `registry.create`.
4. Credentialed caller on both paths → unchanged behavior, audit lines present.
5. Rollback: force `scaffoldProject` to throw pre-relocation → `failed` row persists, source dir removed;
   post-relocation failure → source dir untouched (deletion owns it).
6. Boot sweep: `Projects/gw-<12hex>` dir absent from registry → removed; `co-*` dir → untouched.

## 6. Decision points

| # | Question | Recommendation |
|---|---|---|
| D1 | Deny unauthenticated provisioning by default, or keep it and rely on caps? | **Deny by default.** Caps bound cost but still grant unauthenticated requests a code-execution-shaped path (bun + git writing into the operator's workspace). Fail-closed matches the SEC-lineage direction (SEC-01, Phase 2 quotas). |
| D2 | Does open mode imply provisioning rights? | **No.** Open mode = reachability of existing tenants (its warning text already frames tenants as "reachable"); provisioning is a separate privilege. `openModeWarning` states the split. |
| D3 | Where to enforce? | Both `resolveLazyTenant` and `POST /sessions`, strictly before any `registry.create`; lazy path reordered to check-then-create. |
| D4 | Opt-in knob | `CO_WORKSPACE_ALLOW_ANON_PROVISIONING` (default off). Env-only, consistent with the config module. |
| D5 | Companion hardening in the same change? | **Yes** — cap on lazy path, audit on both outcomes, pre-relocation rollback, boot-time sweep. One PR closes both P-A and P-B; the sweep also automates the manual cleanup done on 2026-10-02. |
| D6 | 401 vs 403 on denial | **401** — the condition is "no credential presented", not "credential lacks permission". |

## 7. Residual risks (stated honestly)

- Opted-in deployments still expose bounded unauthenticated scaffolding: up to `tenantMaxPerPrincipal`
  tenants (shared `anonymous` principal), each reusable until deleted. That is the accepted cost of the
  opt-in; do not enable it on instances that hold anything valuable.
- If the **gateway process itself** dies mid-scaffold, no in-process rollback runs; the boot-time sweep is
  the reconciliation, so litter persists until next start.
- Rollback's `rmSync` is path-guarded against record tampering, but both the guard and the sweep trust the
  registry row's `tenantId` format (`^gw-[0-9a-f]{12}$`); a future tenant-id format change must update the
  sweep pattern.
- Audit lines for anonymous activity remain unattributable (shared principal) — visibility improves,
  attribution does not (N1).

## 8. References

- Incident + cleanup record: `memory/2026-10-02.md` (gw-76f6b4c9c6ff); prior orphan: `memory/2026-09-29.md` (gw-fd71bde230fa)
- Open-mode definition and warning: `services/co-workspace/src/access.ts:35-42,107-113`
- Lazy provisioning path: `services/co-workspace/src/lifecycle.ts:150-181`; failure path `:12-61`
- Explicit create route with cap + audit: `services/co-workspace/src/routes/tenants.ts:30-66`
- Scaffold subprocess + timeout kill semantics: `services/co-workspace/src/scaffold.ts:46-83`
- Upstream-requester directory rule and Q8: `memory/meeting-2026-10-01-upstream-request-mcp.md`
