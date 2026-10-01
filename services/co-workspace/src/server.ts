/**
 * Team Gateway HTTP server (ADR-0092). One bun process serving:
 *   - native REST:   POST /sessions, GET /tenants[/:id], POST /tenants/:id/chat (raw SSE)
 *   - OpenAI wire:   GET /v1/models, POST /v1/chat/completions (SSE chunks or JSON)
 *   - dev aid:       GET / (single-file demo chat page)
 * Phase 0 posture (D6): loopback bind by default, no auth, single process, per-tenant
 * HERMES_HOME isolation, per-tenant chat serialization.
 *
 * This file keeps the shared request preamble (path normalisation, session, CSRF/auth/login
 * gates), the ordered route-area dispatch, the 404 and error mapping. Route handlers live in
 * ./routes/*; everything else the gateway exports is re-exported below.
 */


import { dockerProbe, dockerVolumeProbe } from "./config";
import { credentialValid, presentedCredential, requestAuthorized } from "./auth";
import { sessionTokenFromCookie } from "./users";
import { csrfRequired, sweepOutbox } from "./hardening";
import { HttpError, jsonResponse, resolveClientIp } from "./http";
import type { GatewayState } from "./state";
import { createState } from "./state";
import { bootstrapAdminFromEnv, openModeWarning } from "./access";
import type { Ctx } from "./routes/ctx";
import { handlePublic } from "./routes/public";
import { handleTenants } from "./routes/tenants";
import { handleCompat } from "./routes/compat";
import { handleFiles } from "./routes/files";
import { handleAuth } from "./routes/auth";
import { handleAdmin } from "./routes/admin";
import { handleGemini } from "./routes/gemini";
import { reapOrphanedTurns } from "./reaper";

export { resolveClientIp } from "./http";
export { createState } from "./state";
export type { GatewayState } from "./state";
export { variantStatus } from "./pages";
export {
  bootstrapAdminFromEnv,
  callerPrincipal,
  isAdminCaller,
  requireTenantAccess,
  principalTokenUsage,
  assertPrincipalQuota,
  windowUsage,
  assertQuota,
  oauthStateMatches,
  openModeWarning,
} from "./access";
export { provisionTenant, sanitizeProjectName, tenantKeyFor, hostSidePath, getOrStartTenant, resolveLazyTenant, deleteTenantData } from "./lifecycle";
export { runChat, resolveAuthDir } from "./chat";
export { openaiChatResponse } from "./responses";

export async function handleRequest(state: GatewayState, req: Request, peerIp?: string): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
    const clientIp = resolveClientIp(state.cfg.trustProxy, req, peerIp);
    // SEC-09: keyless-mode CSRF guard — mutating routes need the custom header (a cross-site
    // form cannot set it without a preflight; the server sends no CORS headers).
    const hasApiKey = credentialValid(state.cfg, presentedCredential(req));
    if (
      csrfRequired(state.cfg, hasApiKey) &&
      req.method !== "GET" &&
      req.headers.get("x-requested-with") !== "co-workspace"
    ) {
      throw new HttpError(403, "missing x-requested-with header (CSRF guard)");
    }
    // Phase 2 auth gate + Wave B: a route passes with a valid API key OR a signed-in session
    // (cookie). Exemptions: `GET /`, `GET /health`, and the sign-in page itself (`GET /login`).
    // /auth/* is the self-service auth surface (login/logout/signup/verify/me): it must stay
    // reachable without an API key even when keys are configured, or sign-in itself is
    // impossible. The routes authenticate themselves; the loginRequired gate below still
    // exempts them from session demands.
    const authRoute = path.startsWith("/auth/");
    const authorized =
      authRoute ||
      requestAuthorized(state.cfg, req, `${req.method} ${path}`) ||
      (state.cfg.apiKeys.length > 0 && Boolean(sessionUser));
    if (!authorized) {
      throw new HttpError(401, "missing or invalid API key");
    }
    // Wave B gate: when login is required, the web UI demands a session; the API demands a
    // key (Bearer) or a valid session — a key-authenticated caller satisfies the demand
    // without a session. Exempt: /login page, /auth/*, /health.
    if (state.cfg.loginRequired) {
      const exempt =
        path === "/login" ||
        path.startsWith("/auth/") ||
        path === "/health";
      if (!exempt && !sessionUser && !hasApiKey) {
        if (path === "/" || req.method === "GET") {
          return new Response(null, { status: 302, headers: { location: "/login" } });
        }
        throw new HttpError(401, "sign-in required");
      }
    }
    // R1 gate: a session opened with an admin-issued temp credential is confined to the
    // auth surface (finish the rotation via PATCH /auth/me, sign out) plus the shell pages
    // the forced-change dialog renders on. Every other area — tenants, chat, admin, files —
    // answers 403 until the password is rotated. API-key callers carry no session, so they
    // pass; a caller presenting both satisfies the gate only via the session branch.
    if (sessionUser?.mustChangePassword) {
      const shell = req.method === "GET" && ["/", "/login", "/app-helpers.js", "/health"].includes(path);
      if (!authRoute && !shell) {
        throw new HttpError(403, "password change required — your sign-in used a temporary password");
      }
    }
    const ctx: Ctx = { url, path, sessionUser, clientIp };
    const routed =
      (await handlePublic(state, req, ctx)) ??
      (await handleTenants(state, req, ctx)) ??
      (await handleCompat(state, req, ctx)) ??
      (await handleFiles(state, req, ctx)) ??
      (await handleAuth(state, req, ctx)) ??
      (await handleAdmin(state, req, ctx)) ??
      (await handleGemini(state, req, ctx));
    if (routed) return routed;

    throw new HttpError(404, `no route: ${req.method} ${path}`);
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ error: err.message }, err.status);
    return jsonResponse({ error: String((err as Error)?.message ?? err) }, 500);
  }
}

export function createServer(state: GatewayState) {
  return Bun.serve({
    port: state.cfg.port,
    hostname: state.cfg.host,
    idleTimeout: 255,
    fetch: (req, server) => handleRequest(state, req, server.requestIP(req)?.address),
  });
}

if (import.meta.main) {
  console.log(`[co-workspace] running as uid ${process.getuid?.() ?? "n/a"}`);
  const state = createState();
  bootstrapAdminFromEnv(state);
  // SEC-14: expire verification mails older than 24h at startup.
  const swept = sweepOutbox(state.cfg.dataDir);
  if (swept) console.log(`[co-workspace] outbox sweep: ${swept} expired file(s) removed`);
  const openWarn = openModeWarning(state.cfg);
  if (openWarn) console.warn(openWarn);
  // chatLocks/activeProcs are memory-only: docker mode is covered by the orphan reaper below,
  // process mode children die with the gateway container (bare-host `bun`: stop the process
  // group or accept up to runBudgetSeconds of orphan runtime).
  // P2-5: a restart orphans in-flight "provisioning" records (the promise map is memory-only).
  for (const t of state.registry.list()) {
    if (t.status === "provisioning") {
      t.status = "failed";
      t.error = "interrupted by server restart — create a new session";
      state.registry.upsert(t);
    }
  }
  if (state.cfg.isolation === "docker") {
    const probe = dockerProbe(state.cfg.dockerBin);
    if (!probe.ok) {
      console.error(`[co-workspace] docker isolation unusable: ${probe.error ?? "probe failed"}`);
      process.exit(1);
    }
    if (state.cfg.isolation === "docker" && state.cfg.runtime !== "hermes") {
      console.error(`[co-workspace] docker isolation requires runtime hermes (got ${state.cfg.runtime})`);
      process.exit(1);
    }
    console.log(`[co-workspace] docker isolation: server ${probe.version}`);
    if (state.cfg.dataVolume) {
      const vp = dockerVolumeProbe(state.cfg.dockerBin, state.cfg.dataVolume);
      if (!vp.ok) {
        console.error(
          `[co-workspace] data volume "${state.cfg.dataVolume}" missing or uninspectable: ${vp.error ?? "probe failed"}` +
            ` - run: docker volume create ${state.cfg.dataVolume}`,
        );
        process.exit(1);
      }
      console.log(`[co-workspace] volume mode: tenant data volume "${state.cfg.dataVolume}" ok`);
    }
    const reap = reapOrphanedTurns(state.cfg);
    if (reap.error) console.warn(`[co-workspace] orphan turn reap failed: ${reap.error}`);
    else console.log(`[co-workspace] orphan turn reap: found ${reap.found}, removed ${reap.killed}`);
  }
  const server = createServer(state);
  console.log(`[co-workspace] listening on http://${state.cfg.host}:${server.port}`);
  console.log(`[co-workspace] variants: ${state.cfg.variants.join(", ")}`);
  console.log(`[co-workspace] data dir: ${state.cfg.dataDir}`);
  console.log(`[co-workspace] workspace: ${state.cfg.workspaceDir}`);
}
