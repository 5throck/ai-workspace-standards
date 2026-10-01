/** Access control: principal resolution, authentication, and quotas. */

import { timingSafeEqual } from "node:crypto";
import type { GatewayState } from "./state";
import { GatewayConfig } from "./config";
import { credentialValid, presentedCredential, principalFor } from "./auth";
import { sessionTokenFromCookie } from "./users";
import type { TenantRecord } from "./tenant";
import { HttpError } from "./http";

/** Wave B3/SEC-13: bootstrap the admin account at startup (idempotent). */
export function bootstrapAdminFromEnv(state: GatewayState): void {
  const email = process.env.CO_WORKSPACE_ADMIN_EMAIL;
  if (!email) return;
  const admin = state.users.bootstrapAdmin(email);
  if (admin) console.log(`[co-workspace] admin bootstrapped: ${admin.principal} (${email})`);
}

/** SEC-01: resolve the caller's trusted principal — session first, then key label. */
export function callerPrincipal(state: GatewayState, req: Request): string | null {
  const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
  if (sessionUser) return sessionUser.principal;
  const cred = presentedCredential(req);
  if (cred && credentialValid(state.cfg, cred)) return principalFor(state.cfg, cred);
  return null;
}

export function isAdminCaller(state: GatewayState, req: Request): boolean {
  const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
  return sessionUser?.role === "admin";
}

/** SEC-01: tenant access requires owner match, admin role, or the Phase 0 open mode
 * (no keys, no login requirement, anonymous-owned tenant). */
export function requireTenantAccess(state: GatewayState, req: Request, rec: TenantRecord): void {
  if (isAdminCaller(state, req)) return;
  const openMode = state.cfg.apiKeys.length === 0 && !state.cfg.loginRequired;
  if (openMode && (rec.ownerPrincipal ?? "anonymous") === "anonymous") return;
  const caller = callerPrincipal(state, req);
  if (caller && rec.ownerPrincipal && rec.ownerPrincipal === caller) return;
  throw new HttpError(403, `tenant ${rec.tenantId} is owned by ${rec.ownerPrincipal ?? "anonymous"}`);
}

/** 2026-10-02 gate-anonymous-tenant-provisioning design (D1/D2/D6): provisioning is a
 * privileged operation — it spawns the scaffold engine inside the workspace — so a
 * credential (session or API key) or an explicit opt-in is required to create a tenant.
 * Reachability of existing tenants (requireTenantAccess, open mode) is a separate,
 * weaker property and stays unchanged. */
export function assertProvisioningAllowed(state: GatewayState, req: Request, variant: string): void {
  if (callerPrincipal(state, req) !== null) return;
  if (state.cfg.allowAnonProvisioning) return;
  state.audit.record("anonymous", "tenant.provision.denied", variant, "unauthenticated");
  throw new HttpError(401, "authentication required to create a session — sign in or present an API key");
}

/** SEC-05, single shared implementation: at most `tenantMaxPerPrincipal` tenants per
 * principal (0 = unlimited). Called at creation time only, after the existing-key
 * short-circuit, so reaching one's current team is never capped. Covers POST /sessions
 * and the lazy surfaces alike (the lazy path previously skipped this cap entirely). */
export function assertTenantCap(state: GatewayState, owner: string): void {
  const max = state.cfg.tenantMaxPerPrincipal;
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
  const max = state.cfg.principalMaxTokens;
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

/** Phase 2 quotas (D2): enforced BEFORE any stream opens, so a rejected turn costs nothing. */
export function assertQuota(
  cfg: GatewayConfig,
  rec: TenantRecord,
  dayKey = new Date().toISOString().slice(0, 10),
): void {
  const usage = windowUsage(cfg, rec, dayKey);
  if (cfg.tenantMaxTurns > 0 && usage.turns >= cfg.tenantMaxTurns) {
    throw new HttpError(429, `tenant turn quota exhausted (${usage.turns}/${cfg.tenantMaxTurns} turns, window: ${cfg.quotaWindow})`);
  }
  if (cfg.tenantMaxTokens > 0 && usage.tokens >= cfg.tenantMaxTokens) {
    throw new HttpError(429, `tenant token quota exhausted (${usage.tokens}/${cfg.tenantMaxTokens} tokens, window: ${cfg.quotaWindow})`);
  }
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
