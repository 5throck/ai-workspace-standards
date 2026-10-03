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
import { bootstrapAdminFromEnv, isolationPostureWarning, openModeWarning, runtimeProviderKeyWarning } from "./access";
import { runtimeProviderKeyEnv } from "./config";
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
  isolationPostureWarning,
  runtimeProviderKeyWarning,
} from "./access";
export { provisionTenant, sanitizeProjectName, tenantKeyFor, hostSidePath, getOrStartTenant, resolveLazyTenant, deleteTenantData, removeUnrelocatedScaffold, sweepOrphanedScaffolds } from "./lifecycle";
import { sweepOrphanedScaffolds } from "./lifecycle";
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
    // 2026-10-03 review M1: non-HttpError throws carry internals (fs paths, SQLite and
    // spawn stderr tails). Log the full error server-side; the client gets a generic body.
    console.error(`[co-workspace] 500 on ${req.method} ${path}:`, err);
    return jsonResponse({ error: "internal error" }, 500);
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
  // 2026-10-03 review H3: graceful shutdown — kill running turn children, drain the chat
  // locks with a bound, checkpoint the SQLite WALs, then exit. Docker mode is rescued by
  // the reaper + `init: true`; bare-host process mode previously left orphaned children
  // and open handles behind (open handles also block data-dir deletion on Windows).
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[co-workspace] ${signal} — killing ${state.activeProcs.size} active turn(s), draining locks…`);
    for (const proc of state.activeProcs.values()) {
      try {
        proc.kill();
      } catch {
        /* already exited */
      }
    }
    void Promise.race([
      Promise.allSettled([...state.chatLocks.values()]),
      new Promise((r) => setTimeout(r, 10_000)),
    ]).then(() => {
      for (const store of [state.registry, state.turns, state.users, state.audit]) {
        try {
          store.close();
        } catch {
          /* best effort */
        }
      }
      process.exit(0);
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  bootstrapAdminFromEnv(state);
  // SEC-14: expire verification mails older than 24h at startup.
  const swept = sweepOutbox(state.cfg.dataDir);
  if (swept) console.log(`[co-workspace] outbox sweep: ${swept} expired file(s) removed`);
  const openWarn = openModeWarning(state.cfg);
  if (openWarn) console.warn(openWarn);
  // 2026-10-03 review H1: credential-protected deployments must see the real process-mode
  // boundary (same-uid agents read /proc/1/environ + the shared data dir).
  const isoWarn = isolationPostureWarning(state.cfg);
  if (isoWarn) console.warn(isoWarn);
  // 2026-10-03 CLI provider-key design (D3): the configured key cannot serve this runtime.
  const keyWarn = runtimeProviderKeyWarning(state.cfg);
  if (keyWarn) console.warn(keyWarn);
  // Credential-mode visibility: what the non-hermes turns will authenticate with.
  if (state.cfg.runtime !== "hermes") {
    const keyEnv = runtimeProviderKeyEnv(state.cfg.runtime, state.cfg);
    const mode = keyEnv
      ? `provider-key (${Object.keys(keyEnv).join(", ")})`
      : "interactive CLI login (provider-key off, not applicable, or family mismatch)";
    console.log(`[co-workspace] runtime ${state.cfg.runtime}: credentials = ${mode}`);
  }
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
  // 2026-10-02 gate design G5: remove Projects/gw-<12hex> dirs with no registry row —
  // the residue of scaffolds killed by a gateway death mid-provision (no catch ran).
  const sweptScaffolds = sweepOrphanedScaffolds(state);
  if (sweptScaffolds.error) console.warn(`[co-workspace] scaffold sweep failed: ${sweptScaffolds.error}`);
  else if (sweptScaffolds.removed.length > 0) {
    console.log(`[co-workspace] scaffold sweep: removed ${sweptScaffolds.removed.join(", ")}`);
  }
  if (state.cfg.isolation === "docker") {
    const probe = dockerProbe(state.cfg.dockerBin);
    if (!probe.ok) {
      console.error(`[co-workspace] docker isolation unusable: ${probe.error ?? "probe failed"}`);
      process.exit(1);
    }
    if (state.cfg.isolation === "docker" && state.cfg.runtime === "antigravity") {
      // 2026-10-03 sibling-turns design (D7): antigravity stays excluded from docker
      // isolation — the agy CLI is login-only with no verifiable Linux artifact to bake
      // or mount into the runtime image. claude/codex proceed (their CLIs are baked into
      // the image and the broker policy carries their runtime profiles).
      console.error(
        `[co-workspace] docker-isolated turns for runtime "antigravity" are not available (the agy CLI is login-only with no verifiable Linux artifact) — ` +
          `use CO_WORKSPACE_ISOLATION=process (the image bakes agy; login state via the creds overlay), or CO_WORKSPACE_RUNTIME=hermes|claude|codex`,
      );
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
    // 2026-10-03 review M6: the boot reap alone leaked a container whose kill failed until
    // the next gateway restart. Hourly interval reap — idempotent, instance-labeled.
    const reaper = setInterval(() => {
      const r = reapOrphanedTurns(state.cfg);
      if (r.found > 0 || r.error) {
        console.log(`[co-workspace] orphan turn reap: found ${r.found}, removed ${r.killed}${r.error ? `, error: ${r.error}` : ""}`);
      }
    }, 60 * 60 * 1000);
    reaper.unref();
  }
  const server = createServer(state);
  console.log(`[co-workspace] listening on http://${state.cfg.host}:${server.port}`);
  console.log(`[co-workspace] variants: ${state.cfg.variants.join(", ")}`);
  console.log(`[co-workspace] data dir: ${state.cfg.dataDir}`);
  console.log(`[co-workspace] workspace: ${state.cfg.workspaceDir}`);
}
