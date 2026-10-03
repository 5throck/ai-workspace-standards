import { join } from "node:path";
import { publicTenant } from "../tenant";
import { modelsPayload } from "../openai";
import { genId } from "../util";
import { HttpError, jsonResponse, readJsonBody } from "../http";
import { variantStatus } from "../pages";
import { callerPrincipal, isPasswordSetAdmin, requireTenantAccess, assertPrincipalQuota, assertQuota, assertProvisioningAllowed, assertTenantCap } from "../access";
import { sanitizeProjectName, tenantKeyFor, startProvisioning, deleteTenantData } from "../lifecycle";
import { nativeChatResponse } from "../responses";
import type { GatewayState } from "../state";
import type { Ctx } from "./ctx";

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
      return jsonResponse({ tenantId: existing.tenantId, name: existing.name, status: existing.status, existing: true });
    }
    assertTenantCap(state, owner);
    const rec = state.registry.create({
      variant,
      key,
      name: name || undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      ownerPrincipal: owner,
    });
    state.audit.record(owner, "tenant.create", rec.tenantId, variant);
    startProvisioning(state, rec);
    return jsonResponse({ tenantId: rec.tenantId, name: rec.name, status: rec.status }, 202);
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
    await deleteTenantData(state, rec, callerPrincipal(state, req) ?? "anonymous");
    return jsonResponse({ deleted: tenantId, name: rec.name ?? null });
  }

  const tenantChat = path.match(/^\/tenants\/([^/]+)\/chat$/);
  if (req.method === "POST" && tenantChat) {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message : "";
    if (!message.trim()) throw new HttpError(400, "message is required");
    const rec = state.registry.get(decodeURIComponent(tenantChat[1]));
    if (!rec) throw new HttpError(404, `tenant ${tenantChat[1]} not found`);
    requireTenantAccess(state, req, rec);
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
