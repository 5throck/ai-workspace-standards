import { basename, join, resolve } from "node:path";
import { publicTenant } from "../tenant";
import { modelsPayload } from "../openai";
import { genId } from "../util";
import { HttpError, jsonResponse, readJsonBody } from "../http";
import { variantStatus } from "../pages";
import { callerPrincipal, isPasswordSetAdmin, requireTenantAccess, assertPrincipalQuota, assertQuota, assertProvisioningAllowed, assertTenantCap } from "../access";
import { sanitizeProjectName, tenantKeyFor, startProvisioning, deleteTenantData } from "../lifecycle";
import { allocateAttachProviderKey, assertAttachHubAdmittable, ATTACH_KIND, resolveAttachDir } from "../attach";
import { nativeChatResponse } from "../responses";
import type { GatewayState } from "../state";
import type { Ctx } from "./ctx";

/** Addendum 17: `attach_dir` (alias `existing_project`) — the existing checkout to attach to. */
function attachRawFromBody(body: Record<string, unknown>): string | null {
  const v = body.attach_dir ?? body.existing_project;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function handleTenants(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  if (req.method === "GET" && path === "/v1/models") {
    const runtimeMeta: Record<string, { runtime: string; provider: string }> = {
      hermes: { runtime: "hermes", provider: "operator-configured" },
      antigravity: { runtime: "antigravity", provider: "Google (via agy)" },
      claude: { runtime: "claude", provider: "Anthropic (via Claude Code)" },
      codex: { runtime: "codex", provider: "OpenAI (via Codex CLI)" },
    };
    const rm = runtimeMeta[state.cfg.runtime] ?? { runtime: state.cfg.runtime, provider: "operator-configured" };
    const meta: Record<string, { status?: string; runtime?: string; provider?: string }> = {};
    for (const v of state.cfg.variants) {
      meta[v] = { status: variantStatus(state.cfg, v), ...rm };
    }
    return jsonResponse(modelsPayload(state.cfg.variants, meta));
  }

  if (req.method === "POST" && path === "/sessions") {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const variant = typeof body.variant === "string" ? body.variant.trim() : "";
    if (!variant) throw new HttpError(400, "variant is required");
    if (!state.cfg.variants.includes(variant)) {
      throw new HttpError(400, `variant ${variant} is not in the allowlist: ${state.cfg.variants.join(", ")}`);
    }
    // 2026-10-02 gate design D3: provisioning is privileged — gate before any create.
    assertProvisioningAllowed(state, req, variant);
    // ── ADR-0092 Addendum 17: attach mode ────────────────────────────────────────────────
    // Identity is derived from the VERIFIED KEY only (Decision 6): client-asserted identity
    // fields (`principal`, `spoke_id`, `ownerPrincipal`) are never read for ownership.
    const attachRaw = attachRawFromBody(body);
    let hubDir: string | null = null;
    if (attachRaw) {
      // Decision 4: docker isolation ONLY — process-isolated attach sessions would share the
      // gateway uid (read /proc/1/environ + the shared data dir). A launch blocker, not a warning.
      if (state.cfg.isolation !== "docker") {
        throw new HttpError(
          409,
          "attach mode requires CO_WORKSPACE_ISOLATION=docker — process-isolated sessions share the gateway uid and could read gateway secrets",
          "attach_requires_docker",
        );
      }
      // Volume mode cannot express the hub ticket-queue bind (volume-subpath mounts only) — fail closed.
      if (state.cfg.dataVolume) {
        throw new HttpError(
          409,
          "attach mode requires bind-mode docker isolation (CO_WORKSPACE_DATA_DIR_HOST); volume mode cannot mount the hub ticket-queue",
          "attach_requires_bind_mode",
        );
      }
      hubDir = resolveAttachDir(state.cfg, attachRaw);
      // Decisions 9/10: hub UNAVAILABLE → cancel its active attach sessions, refuse; then the
      // per-hub concurrent-session cap.
      assertAttachHubAdmittable(state, hubDir, callerPrincipal(state, req) ?? "anonymous");
    }
    let name = typeof body.name === "string" ? sanitizeProjectName(body.name) : "";
    if (name) {
      if (state.registry.list().some((r) => r.name === name)) name = `${name}-${genId("").slice(0, 6)}`;
    }
    const owner = callerPrincipal(state, req) ?? "anonymous";
    // One active team per (principal, variant): creation is keyed and idempotent, so a
    // /sessions-created team is visible to the lazy key lookup instead of diverging.
    const key = tenantKeyFor(variant, owner);
    const existing = state.registry.findByKey(key);
    if (existing) {
      if (hubDir) {
        // Addendum 6 invariant applies per (principal, variant) for attach tenants too — but
        // silently aliasing a request for hub X to a session bound to hub Y (or to a
        // scaffolded tenant whose projectDir is not the hub) would attach the caller to the
        // wrong tree. Idempotent ONLY for a re-attach to the SAME hub; otherwise 409.
        if (existing.kind === ATTACH_KIND && existing.attachHub && resolve(existing.attachHub) === resolve(hubDir)) {
          return jsonResponse({ tenantId: existing.tenantId, name: existing.name, status: existing.status, existing: true });
        }
        const bound = existing.kind === ATTACH_KIND ? `an attached session on ${basename(existing.attachHub ?? "")}` : "a scaffolded tenant";
        throw new HttpError(
          409,
          `this principal already owns a ${variant} session (${bound}) — detach/delete it before attaching to ${basename(hubDir)}`,
          "attach_conflict",
        );
      }
      return jsonResponse({ tenantId: existing.tenantId, name: existing.name, status: existing.status, existing: true });
    }
    assertTenantCap(state, owner);
    // Decision 7: one low-limit provider key per attach session (pool; empty pool = the
    // deployment key per Addendum 9).
    const attachProviderKey = hubDir ? allocateAttachProviderKey(state) : undefined;
    const rec = state.registry.create({
      variant,
      key,
      name: name || undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      ownerPrincipal: owner,
      // §3.5 toolset scoping: the attach session's tools are the delegation task's declared
      // toolset, not the full default set. Attach requests cannot name a project — the
      // registry key (principal, variant) already pins one team per variant.
      ...(hubDir
        ? {
            kind: "attached" as const,
            attachHub: hubDir,
            projectDir: hubDir,
            attachProviderKey,
            attachToolsets: typeof body.toolsets === "string" && body.toolsets.trim() !== "" ? body.toolsets.trim() : undefined,
          }
        : {}),
    });
    state.audit.record(owner, hubDir ? "tenant.attach" : "tenant.create", rec.tenantId, hubDir ? basename(hubDir) : variant);
    startProvisioning(state, rec);
    return jsonResponse(
      { tenantId: rec.tenantId, name: rec.name, status: rec.status, ...(hubDir ? { attached: basename(hubDir) } : {}) },
      202,
    );
  }

  if (req.method === "GET" && path === "/tenants") {
    // T-20260928-007: cross-user tenant metadata (owner, names, usage, provisioning
    // error strings) is not world-readable — admins see all, others see their own.
    // `?mine=1` remains accepted for backwards compat (same as the default for
    // non-admin callers).
    let list = state.registry.list();
    // T-20261003-027 (sub-feature 4): the admin-wide listing needs the one-time password set
    // complete — a passwordless admin sees their own tenants like any user until then.
    if (!isPasswordSetAdmin(state, req)) {
      const principal = callerPrincipal(state, req) ?? "anonymous";
      list = list.filter((r) => (r.ownerPrincipal ?? "anonymous") === principal);
    }
    return jsonResponse({ tenants: list.map(publicTenant) });
  }

  const tenantDetail = path.match(/^\/tenants\/([^/]+)$/);
  if (req.method === "GET" && tenantDetail) {
    const rec = state.registry.get(decodeURIComponent(tenantDetail[1]));
    if (!rec) throw new HttpError(404, `tenant ${tenantDetail[1]} not found`);
    requireTenantAccess(state, req, rec);
    return jsonResponse(publicTenant(rec));
  }

  const tenantDelete = path.match(/^\/tenants\/([^/]+)$/);
  if (req.method === "DELETE" && tenantDelete) {
    const tenantId = decodeURIComponent(tenantDelete[1]);
    const rec = state.registry.get(tenantId);
    if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
    requireTenantAccess(state, req, rec);
    // Addendum 17 Decision 3: DELETE on an attached tenant = DETACH. A full-delete request is
    // refused with a typed 409 — the gateway never recurses into an attached checkout.
    if (rec.kind === ATTACH_KIND && ctx.url.searchParams.get("purge")) {
      state.audit.record(
        callerPrincipal(state, req) ?? "anonymous",
        "tenant.delete.refused",
        tenantId,
        "full delete requested on an attached tenant",
      );
      throw new HttpError(
        409,
        "attached tenants support DETACH only — the hub working tree is never deleted by the gateway (omit ?purge=1 to detach)",
        "attach_full_delete_refused",
      );
    }
    await deleteTenantData(state, rec, callerPrincipal(state, req) ?? "anonymous");
    return jsonResponse({ deleted: tenantId, name: rec.name ?? null, ...(rec.kind === ATTACH_KIND ? { detached: true } : {}) });
  }

  const tenantChat = path.match(/^\/tenants\/([^/]+)\/chat$/);
  if (req.method === "POST" && tenantChat) {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message : "";
    if (!message.trim()) throw new HttpError(400, "message is required");
    const rec = state.registry.get(decodeURIComponent(tenantChat[1]));
    if (!rec) throw new HttpError(404, `tenant ${tenantChat[1]} not found`);
    requireTenantAccess(state, req, rec);
    // Addendum 17 Decision 4: an attached tenant turns under docker isolation ONLY — refused
    // before the stream opens (the same contract as the quota 429s below). Covers the config
    // flipped after attach, not just creation-time.
    if (rec.kind === ATTACH_KIND && state.cfg.isolation !== "docker") {
      throw new HttpError(409, "attach tenant requires CO_WORKSPACE_ISOLATION=docker (process isolation would share the gateway uid)", "attach_requires_docker");
    }
    // Quota trips stay a plain 429 before streaming for ready tenants (contract of the
    // 429-before-streaming tests); a provisioning team is checked once it turns ready,
    // inside the stream where the progress frames are already flowing.
    if (rec.status !== "provisioning") {
      assertQuota(state.cfg, rec);
      assertPrincipalQuota(state, rec.ownerPrincipal ?? "anonymous");
    }
    // The stream starts immediately: provisioning progress is streamed as `: …` comment
    // frames while the team prepares, instead of the response blocking until ready.
    return nativeChatResponse(state, rec, message);
  }

  return null;
}
