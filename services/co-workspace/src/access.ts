/** Access control: principal resolution, authentication, and quotas. */

import { timingSafeEqual } from "node:crypto";
import type { GatewayState } from "./state";
import { GatewayConfig, readKeyEntries, runtimeProviderKeyGap } from "./config";
import { credentialValid, presentedCredential, principalFor } from "./auth";
import { sessionTokenFromCookie, UserRecord } from "./users";
import type { TenantRecord } from "./tenant";
import { HttpError } from "./http";
import { tenantLoopDisabled } from "./tenant-loop";
import { effectivePolicyFor, type EffectivePolicy } from "./policy";

/** Wave B3/SEC-13: bootstrap the admin account at startup (idempotent). A promotion of an
 * EXISTING user is loud (2026-10-03 review M5): logged AND audited — the sessions of the
 * promoted user were already invalidated by the store, so the grant lands on a fresh
 * sign-in instead of silently upgrading an in-flight session. */
export function bootstrapAdminFromEnv(state: GatewayState): void {
  const email = process.env.CO_WORKSPACE_ADMIN_EMAIL;
  if (!email) return;
  const { user: admin, promoted } = state.users.bootstrapAdmin(email);
  if (!admin) return;
  if (promoted) {
    console.warn(`[co-workspace] ADMIN PROMOTION: existing user ${admin.principal} (${email}) was promoted to admin; their existing sessions were invalidated`);
    state.audit.record("system", "user.admin.promoted", admin.principal, email);
  } else {
    console.log(`[co-workspace] admin bootstrapped: ${admin.principal} (${email})`);
  }
}

/** SEC-01: resolve the caller's trusted principal — session first, then key label. */
export function callerPrincipal(state: GatewayState, req: Request): string | null {
  const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
  if (sessionUser) return sessionUser.principal;
  const cred = presentedCredential(req);
  if (cred && credentialValid(state.cfg, cred)) {
    const principal = principalFor(state.cfg, cred);
    // 2026-11-09 review M2: a key whose label is a suspended or deleted account's principal
    // carries no identity — the caller is treated as anonymous, not as that account.
    if (state.users.isPrincipalBlocked(principal)) return null;
    return principal;
  }
  return null;
}

/** 2026-11-09 review namespace rule: login IDs and key labels share the principal namespace,
 * so a signup may not claim a reserved word, the `u-<12 hex>` account-ID shape, or a label
 * configured for an API key (a key labelled `alice` would otherwise act as user alice). */
const RESERVED_PRINCIPALS = new Set(["anonymous", "default", "system"]);
const ACCOUNT_ID_SHAPE = /^u-[0-9a-f]{12}$/;

export function isReservedLoginId(cfg: GatewayConfig, value: string): boolean {
  const v = value.toLowerCase();
  if (RESERVED_PRINCIPALS.has(v) || ACCOUNT_ID_SHAPE.test(v)) return true;
  return readKeyEntries(cfg.apiKeysFile).some((e) => [e.label, e.spokeId].some((label) => label?.toLowerCase() === v));
}

export function isAdminCaller(state: GatewayState, req: Request): boolean {
  const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
  return sessionUser?.role === "admin";
}

/** T-20261003-027 (sub-feature 4): a session admin whose one-time password set is COMPLETE.
 * Passwordless (bootstrap/SSO) admins answer false, so admin-wide surfaces refuse them until
 * they set a password — regular SSO-only users (role "user") are unaffected. */
export function isPasswordSetAdmin(state: GatewayState, req: Request): boolean {
  const user = state.users.resolveSession(sessionTokenFromCookie(req));
  return user?.role === "admin" && Boolean(user.passwordHash);
}

/** T-20261003-027 (sub-feature 4): admin-route gate that also enforces the first-time
 * password set. An admin provisioned without a password (CO_WORKSPACE_ADMIN_EMAIL bootstrap,
 * or SSO-linked) must complete the one-time set (PATCH /auth/me with just the new password —
 * no current-password check for a null hash, session-hardening D5) before ANY admin action;
 * previously only the D4 destructive ops refused them. Returns the session admin. */
export function requireAdminReady(state: GatewayState, req: Request): UserRecord {
  const user = state.users.resolveSession(sessionTokenFromCookie(req));
  if (!user || user.role !== "admin") throw new HttpError(403, "admin only");
  if (!user.passwordHash) {
    throw new HttpError(403, "set a password first to use admin actions (Account > set password; PATCH /auth/me with the new password)");
  }
  return user;
}

/** SEC-01: tenant access requires owner match, admin role, live group membership (shared
 * teams), or the Phase 0 open mode (no keys, no login requirement, anonymous-owned tenant). */
export function requireTenantAccess(state: GatewayState, req: Request, rec: TenantRecord): void {
  // Round-3 quarantine (group-delete side effect, QA S2): an archived tenant is inaccessible
  // to EVERYONE through the member surfaces — no detail view, no files, no turns. Checked
  // BEFORE the admin bypass so a quarantined team stays sealed; the console's archive,
  // restore and bulk delete act through their own routes, which bypass this gate. The typed
  // code matches the quota refusal (assertQuota) that already stopped turns on archived rows.
  if (rec.archivedAt) {
    state.audit.record(callerPrincipal(state, req) ?? "anonymous", "tenant.access.denied", rec.tenantId, "archived");
    throw new HttpError(409, "tenant is archived", "tenant_archived");
  }
  // T-20261003-027 (sub-feature 4): the admin-wide bypass requires the one-time password
  // set to be complete — a passwordless (bootstrap/SSO) admin keeps only their own access
  // until they set one. Key-authenticated callers resolve no session, unchanged.
  if (isPasswordSetAdmin(state, req)) return;
  const openMode = state.cfg.apiKeys.length === 0 && !state.cfg.loginRequired;
  if (openMode && (rec.ownerPrincipal ?? "anonymous") === "anonymous") return;
  const caller = callerPrincipal(state, req);
  if (caller && rec.ownerPrincipal && rec.ownerPrincipal === caller) return;
  // Round-3 shared teams (D-S5): the caller's group memberships are queried LIVE at request
  // time — group removal ends access on the very next request (no cached grant). The owner
  // check above is skipped for shared teams: the owner is the synthetic `group:<id>`
  // principal, never a caller. In-flight turns complete (no change to the chatLock queue).
  if (caller && rec.teamKind === "shared") {
    const ownerGroup = rec.ownerGroup
      ?? (rec.ownerPrincipal?.startsWith("group:") ? rec.ownerPrincipal.slice("group:".length) : undefined);
    if (ownerGroup && state.users.groupsOf(caller).some((g) => g.groupId === ownerGroup)) return;
  }
  // 2026-10-03 review M1: the client message used to name the owner principal — a probing
  // caller learned who owns a tenant id. Keep the detail in the audit trail only.
  state.audit.record(caller ?? "anonymous", "tenant.access.denied", rec.tenantId, `owner=${rec.ownerPrincipal ?? "anonymous"}`);
  throw new HttpError(403, "forbidden: you do not have access to this tenant");
}

/** 2026-10-02 gate-anonymous-tenant-provisioning design (D1/D2/D6): provisioning is a
 * privileged operation — it spawns the scaffold engine inside the workspace — so a
 * credential (session or API key) or an explicit opt-in is required to create a tenant.
 * Reachability of existing tenants (requireTenantAccess, open mode) is a separate,
 * weaker property and stays unchanged. */
export function assertProvisioningAllowed(state: GatewayState, req: Request, variant: string): void {
  const principal = callerPrincipal(state, req);
  if (principal !== null) {
    // Admin console: a group's allowedVariants narrows what its members may provision.
    const allowed = callerPolicyFor(state, req).allowedVariants;
    if (allowed && !allowed.includes(variant)) {
      state.audit.record(principal, "tenant.provision.denied", variant, "variant-policy");
      throw new HttpError(403, "variant_not_allowed");
    }
    return;
  }
  // A valid key whose label is a suspended or deleted account carries no identity (review M2),
  // and must not fall through to anonymous provisioning below.
  const cred = presentedCredential(req);
  if (cred && credentialValid(state.cfg, cred) && state.users.isPrincipalBlocked(principalFor(state.cfg, cred))) {
    state.audit.record("anonymous", "tenant.provision.denied", variant, "blocked-principal");
    throw new HttpError(403, "account_disabled");
  }
  if (state.cfg.allowAnonProvisioning) return;
  state.audit.record("anonymous", "tenant.provision.denied", variant, "unauthenticated");
  throw new HttpError(401, "authentication required to create a session — sign in or present an API key");
}

/** Admin console (§7): a suspended account has no session, but a login with the CORRECT
 * password must still be refused explicitly. Call only after the credential is verified, so a
 * wrong password keeps the uniform 401 and does not reveal suspension. */
export function assertAccountEnabled(state: GatewayState, user: UserRecord): void {
  if (!user.disabledAt) return;
  state.audit.record(user.principal, "login.denied.disabled");
  throw new HttpError(403, "account_disabled");
}

/** Group policy follows the trusted principal on every channel (2026-11-09 review M3): a session
 * user, or an API key whose label is a user principal, is bound by that user's general groups.
 * Group policies only tighten, so this fails closed. Anonymous callers get the cfg values. */
export function callerPolicyFor(state: GatewayState, req: Request): EffectivePolicy {
  return effectivePolicyFor(state, callerPrincipal(state, req) ?? "anonymous");
}

/** SEC-05, single shared implementation: at most the effective `maxTenants` tenants per
 * principal (cfg tenantMaxPerPrincipal, tightened by group policy; 0 = unlimited). Called at
 * creation time only, after the existing-key short-circuit, so reaching one's current team is
 * never capped. Covers POST /sessions and the lazy surfaces alike. `policy` is the creating
 * caller's policy (see callerPolicyFor). */
export function assertTenantCap(state: GatewayState, owner: string, policy: EffectivePolicy = effectivePolicyFor(state, owner)): void {
  const max = policy.maxTenants;
  if (max <= 0) return;
  const owned = state.registry.list().filter((r) => (r.ownerPrincipal ?? "anonymous") === owner).length;
  if (owned >= max) {
    throw new HttpError(429, `tenant cap reached (${owned}/${max} per principal)`);
  }
}

/** SEC-05 remnant: aggregate token usage across ALL tenants owned by a principal. */
export function principalTokenUsage(state: GatewayState, principal: string): { input: number; output: number } {
  let input = 0;
  let output = 0;
  for (const t of state.registry.list()) {
    if ((t.ownerPrincipal ?? "anonymous") !== principal) continue;
    input += t.inputTokens;
    output += t.outputTokens;
  }
  return { input, output };
}

/** Per-principal lifetime token budget across tenants (0 = off). */
export function assertPrincipalQuota(state: GatewayState, principal: string): void {
  const max = effectivePolicyFor(state, principal).maxPrincipalTokens;
  if (max <= 0) return;
  const usage = principalTokenUsage(state, principal);
  const used = usage.input + usage.output;
  if (used >= max) {
    throw new HttpError(429, `principal token budget exhausted (${used}/${max} tokens across all tenants)`);
  }
}

/** Usage inside the configured quota window: `daily` reads today's UTC-day bucket, `lifetime`
 * reads the cumulative counters (design docs/designs/2026-09-27-co-workspace-phase2-hardening-design.md). */
export function windowUsage(
  cfg: GatewayConfig,
  rec: TenantRecord,
  dayKey = new Date().toISOString().slice(0, 10),
): { turns: number; tokens: number } {
  if (cfg.quotaWindow === "daily") {
    const bucket = rec.daily?.[dayKey];
    return {
      turns: bucket?.turns ?? 0,
      tokens: (bucket?.inputTokens ?? 0) + (bucket?.outputTokens ?? 0),
    };
  }
  return { turns: rec.sessions, tokens: rec.inputTokens + rec.outputTokens };
}

/** Phase 2 quotas (D2): enforced BEFORE any stream opens, so a rejected turn costs nothing.
 * `limits` carries the owner's effective per-tenant caps (group policy tightens the cfg
 * defaults); callers without one get the cfg values exactly. An archived tenant refuses turns. */
export function assertQuota(
  cfg: GatewayConfig,
  rec: TenantRecord,
  dayKey = new Date().toISOString().slice(0, 10),
  limits: { maxTurns: number; maxTokens: number } = { maxTurns: cfg.tenantMaxTurns, maxTokens: cfg.tenantMaxTokens },
): void {
  if (rec.archivedAt) throw new HttpError(409, "tenant is archived", "tenant_archived");
  const usage = windowUsage(cfg, rec, dayKey);
  if (limits.maxTurns > 0 && usage.turns >= limits.maxTurns) {
    throw new HttpError(429, `tenant turn quota exhausted (${usage.turns}/${limits.maxTurns} turns, window: ${cfg.quotaWindow})`);
  }
  if (limits.maxTokens > 0 && usage.tokens >= limits.maxTokens) {
    throw new HttpError(429, `tenant token quota exhausted (${usage.tokens}/${limits.maxTokens} tokens, window: ${cfg.quotaWindow})`);
  }
}

/** 2026-10-03 review H1 (T-20261003-017): process isolation runs every tenant's agent as a
 * same-uid sibling INSIDE the gateway container — such a child can read `/proc/1/environ`
 * (the gateway's own env: `CO_WORKSPACE_LLM_API_KEY`, `GOOGLE_CLIENT_SECRET`,
 * `CO_WORKSPACE_API_KEYS`) and the whole shared data dir (every tenant's storage, users.db,
 * turns.db, the live mail outbox). The env allowlist filters what WE construct for the
 * child; it is not a boundary against /proc. Credential-protected deployments get this
 * warning at boot so the operator sees the real boundary. (Changing the default isolation
 * is a breaking deploy decision — consciously deferred, see the ticket.) */
export function isolationPostureWarning(cfg: {
  isolation: string;
  loginRequired: boolean;
  apiKeys: string[];
}): string | null {
  if (cfg.isolation !== "process") return null;
  if (!cfg.loginRequired && cfg.apiKeys.length === 0) return null; // open mode already warns
  return [
    "[co-workspace] PROCESS ISOLATION: tenant agents run as same-uid siblings inside the gateway container —",
    "[co-workspace]   a compromised or prompt-injected agent can read /proc/1/environ (gateway secrets) and",
    "[co-workspace]   every tenant's data under the shared data dir. Use CO_WORKSPACE_ISOLATION=docker for",
    "[co-workspace]   real per-tenant separation (single trusted operator is the documented use for process mode).",
  ].join("\n");
}

/** 2026-10-03 CLI provider-key design (D3): warn when a configured provider key cannot
 * serve the active runtime (antigravity is login-only; named-provider protocol mismatch) —
 * otherwise the operator discovers it from failed turns. Silent when matched or keyless. */
export function runtimeProviderKeyWarning(cfg: {
  runtime: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmProvider?: string;
}): string | null {
  const gap = runtimeProviderKeyGap(cfg.runtime, cfg);
  if (!gap) return null;
  return `[co-workspace] PROVIDER KEY NOT APPLICABLE: ${gap}`;
}

/** 2026-10-03 session-hardening design (D4): destructive admin operations require the
 * caller to RE-PRESENT their password (`x-admin-password` header) — a stolen session must
 * not be able to delete users or mint temp credentials even inside its (now short) window.
 * The proof is the password itself, verified against the SESSION caller's argon2 hash.
 * Passwordless (SSO/bootstrap) admins have no proof to give: they must set a password
 * first (first-time set needs no current password — see PATCH /auth/me). */
export async function requireAdminReauth(state: GatewayState, req: Request): Promise<void> {
  const user = state.users.resolveSession(sessionTokenFromCookie(req));
  if (!user || user.role !== "admin") throw new HttpError(403, "admin only");
  const presented = req.headers.get("x-admin-password") ?? "";
  if (!user.passwordHash) {
    throw new HttpError(403, "password re-confirmation required — set a password first (Account > set password)");
  }
  // 2026-11-09 review L6: re-confirmation attempts share the login limiter's per-account
  // budget, so a stolen session cannot brute-force the operator password. A success clears it.
  const bucket = `reauth:${user.principal}`;
  if (!state.loginLimiter.allow(bucket)) {
    state.audit.record(user.principal, "admin.reauth.failed", "admin-op", "rate-limited");
    throw new HttpError(429, "too many password re-confirmation attempts — try later");
  }
  if (!(await Bun.password.verify(presented, user.passwordHash))) {
    state.audit.record(user.principal, "admin.reauth.failed", "admin-op");
    throw new HttpError(403, "password re-confirmation required (wrong password or missing x-admin-password header)");
  }
  state.loginLimiter.reset(bucket);
}

/** M2: constant-time comparison of the OAuth `state` param against the cookie value. */
export function oauthStateMatches(returned: string | null | undefined, expected: string | null | undefined): boolean {
  if (!returned || !expected) return false;
  const a = Buffer.from(returned);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** M8: startup warning text when the gateway is reachable without any credential. The
 * second line states the provisioning posture so the operator can see the effective
 * gate at boot (2026-10-02 gate design, D2). */
export function openModeWarning(cfg: {
  apiKeys: string[];
  loginRequired: boolean;
  allowAnonProvisioning?: boolean;
}): string | null {
  if (cfg.apiKeys.length === 0 && !cfg.loginRequired) {
    const posture = cfg.allowAnonProvisioning
      ? "[co-workspace] OPEN MODE: anonymous provisioning is ENABLED (CO_WORKSPACE_ALLOW_ANON_PROVISIONING=true)"
      : "[co-workspace] OPEN MODE: anonymous provisioning is GATED (set CO_WORKSPACE_ALLOW_ANON_PROVISIONING=true to allow)";
    return [
      "[co-workspace] OPEN MODE: no API keys and login not required — anonymous tenants are reachable by anyone who can reach this port",
      posture,
    ].join("\n");
  }
  return null;
}

/** ── Tenant-loop ACL — round-2 CO-GOVERNANCE (design
 * docs/designs/2026-11-09-gw-admin-console-round2-plan.md, amendment part B, rewriting the
 * 2026-11-08 design §4.2 gate): the governing set is ALL active enrollment groups covering
 * the tenant, and the permitted non-admin caller pool is the union of those groups'
 * `loop_operators`. Everything else: 403 default deny. The pre-v4 per-tenant designated-user
 * read path is DELETED (no fallback) — it rode the deprecated per-tenant loopGroup, which
 * the unit model removed. Every decision — allow AND deny — is audited as
 * `tenant.loop.<op>.allowed|denied` with the sorted covering-group set as the attribution. ── */

export type TenantLoopOp = "upgrade";

/** The kill switch itself lives in tenant-loop.ts; this wrapper records the audit row so
 * the route layer stays one-liner. Returns true (and audited) when disabled. */
export function tenantLoopSwitchBlocked(state: GatewayState, req: Request, path: string): boolean {
  if (!tenantLoopDisabled()) return false;
  state.audit.record(callerPrincipal(state, req) ?? "anonymous", "tenant.loop.denied", path, "kill switch CO_WORKSPACE_TENANT_LOOP_DISABLED");
  return true;
}

/** Default-deny gate for one tenant-loop operation. `coveringGroups` is the sorted set of
 * active enrollment groups covering the tenant (resolveEnrollment's coveringGroups — the
 * route resolves it BEFORE calling this; an empty set is denied outright, so an uncovered
 * tenant can never be acted on by naming a group). Returns the acting principal. */
export function assertTenantLoopAllowed(state: GatewayState, req: Request, op: TenantLoopOp, coveringGroups: string[]): string {
  const principal = callerPrincipal(state, req);
  const caller = principal ?? "anonymous";
  // Audit attribution: the sorted covering-group set, comma-joined (amendment B).
  const attribution = coveringGroups.join(",");
  // A nested FUNCTION DECLARATION (not a const arrow) so TS propagates `never` at the
  // call site and the default-deny tail typechecks without an unreachable return.
  function deny(reason: string): never {
    state.audit.record(caller, `tenant.loop.${op}.denied`, attribution || "none", reason);
    throw new HttpError(403, `tenant-loop ${op} forbidden: ${reason}`);
  }
  if (coveringGroups.length === 0) {
    deny("no active enrollment covers this tenant");
  }
  try {
    const admin = requireAdminReady(state, req);
    state.audit.record(admin.principal, `tenant.loop.${op}.allowed`, attribution, "via=admin");
    return admin.principal;
  } catch {
    /* not a password-set admin — fall through to the co-governance operator pool */
  }
  if (principal && state.users.isLoopOperatorOfAny(principal, coveringGroups)) {
    state.audit.record(principal, `tenant.loop.${op}.allowed`, attribution, "via=operator");
    return principal;
  }
  deny(principal ? `not an operator of any covering group (${attribution})` : "unauthenticated");
}
