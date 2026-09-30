import { rmSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { GatewayConfig, resolveLlmProviderKey, resolveLlmProviderName } from "./config";
import { scaffoldProject } from "./scaffold";
import { chownTree, recordProgress, seedHermesHome, sweepTenantStragglers, TenantRecord } from "./tenant";
import { dirSize, moveDir } from "./util";
import { HttpError } from "./http";
import type { GatewayState } from "./state";
import { callerPrincipal, requireTenantAccess } from "./access";

/** Scaffold, relocate, seed the tenant Hermes home; persists terminal status either way. */
export async function provisionTenant(state: GatewayState, rec: TenantRecord): Promise<void> {
  try {
    recordProgress(rec, "scaffolding", `scaffolding ${rec.variant} team…`);
    state.registry.upsert(rec);
    const scaffolded = await scaffoldProject({
      workspaceDir: state.cfg.workspaceDir,
      variant: rec.variant,
      projectName: rec.tenantId,
      description: rec.description,
      templateVersion: state.cfg.templateVersion,
      timeoutMs: state.cfg.scaffoldTimeoutMs,
    });
    recordProgress(rec, "relocating", "moving to tenant storage…");
    state.registry.upsert(rec);
    moveDir(scaffolded.sourceDir, rec.projectDir);
    recordProgress(rec, "seeding", "seeding hermes home…");
    state.registry.upsert(rec);
    seedHermesHome(
      rec,
      state.cfg.hermesSeedHome,
      state.cfg.hermesModel,
      resolveLlmProviderKey(state.cfg)
        ? {
            name: resolveLlmProviderName(state.cfg),
            baseUrl: state.cfg.llmBaseUrl,
            apiKey: state.cfg.llmApiKey,
          }
        : undefined,
      resolveLlmProviderKey(state.cfg) ? state.cfg.hermesReasoningEffort ?? "low" : undefined,
    );
    if (state.cfg.isolation === "docker") {
      // The isolated turn runs as the hermes image's UID 10000 — the tenant tree must be
      // owned by it (the scaffold subprocess wrote everything as root).
      if (state.cfg.dataVolume) {
        // Volume mode (T-20260930-038): ownership is fixed by a broker-internal helper
        // container on the volume subpath; chownTree cannot reach into the volume.
        await brokerVolumeControl("init", tenantSubpathBase(state.cfg, rec));
      } else {
        chownTree(rec.hermesHome, 10000, 10000);
        chownTree(rec.projectDir, 10000, 10000);
      }
    }
    rec.status = "ready";
    recordProgress(rec, "ready", "session ready");
  } catch (err) {
    rec.status = "failed";
    rec.error = String((err as Error)?.message ?? err);
  }
  state.registry.upsert(rec);
}

export function startProvisioning(state: GatewayState, rec: TenantRecord): Promise<void> {
  const promise = provisionTenant(state, rec).finally(() => {
    state.provisioning.delete(rec.tenantId);
  });
  state.provisioning.set(rec.tenantId, promise);
  return promise;
}

/** Wait for an in-flight provisioning, or reject with a helpful status. */
export async function ensureReady(state: GatewayState, rec: TenantRecord): Promise<TenantRecord> {
  const inflight = state.provisioning.get(rec.tenantId);
  if (inflight) await inflight;
  const current = state.registry.get(rec.tenantId) ?? rec;
  if (current.status === "ready") return current;
  if (current.status === "failed") {
    throw new Error(`tenant ${current.tenantId} failed provisioning: ${current.error ?? "unknown"}`);
  }
  throw new Error(`tenant ${current.tenantId} is ${current.status}`);
}

/** P7: sanitize a user-supplied project name to what the scaffold engine accepts. */
export function sanitizeProjectName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return cleaned;
}


export function tenantKeyFor(variant: string, user: string): string {
  return `${variant}::${user}`;
}

// R5: walking every tenant's file tree per panel-open is O(total files); a 60s TTL keeps
// the admin panel instant at many tenants (freshness tradeoff is fine for stats).
export const diskSizeCache = new Map<string, { bytes: number; at: number }>();
export async function cachedDirSize(tenantId: string, projectDir: string, hermesHome: string): Promise<number> {
  const hit = diskSizeCache.get(tenantId);
  if (hit && Date.now() - hit.at < 60_000) return hit.bytes;
  const bytes = (await dirSize(projectDir)) + (await dirSize(hermesHome));
  diskSizeCache.set(tenantId, { bytes, at: Date.now() });
  return bytes;
}

/** T-20260930-038 volume mode: `storage/<P>/<N>` for a tenant record - the subpath inside
 * the data volume, matching what hostSidePath's bind sources express on the host. */
export function tenantSubpathBase(cfg: GatewayConfig, rec: TenantRecord): string {
  const rel = relative(resolve(cfg.dataDir, "storage"), resolve(rec.projectDir, ".."));
  if (!rel || rel.startsWith("..")) {
    throw new Error(`tenant folder ${rec.projectDir} is not under ${cfg.dataDir}/storage`);
  }
  return `storage/${rel.split(sep).join("/")}`;
}

/** Broker volume control route client (POST /coworkspace/volume). The gateway has no docker
 * socket; DOCKER_HOST (tcp://docker-broker:2375 in compose) names the broker. */
async function brokerVolumeControl(op: "init" | "rm", subpath: string): Promise<void> {
  const m = (process.env.DOCKER_HOST ?? "").match(/^tcp:\/\/([^/:]+)(?::(\d+))?$/);
  if (!m) throw new Error(`volume mode requires DOCKER_HOST=tcp://<broker>:<port> (got ${process.env.DOCKER_HOST ?? "unset"})`);
  const token = process.env.CO_WORKSPACE_BROKER_TOKEN;
  const res = await fetch(`http://${m[1]}:${m[2] ?? 2375}/coworkspace/volume`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-co-workspace-token": token } : {}),
    },
    body: JSON.stringify({ op, subpath }),
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status !== 204) {
    throw new Error(`broker volume ${op} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
}

/** Host-side equivalent of a container path under <dataDir> (docker isolation mounts must
 * resolve on the host — CO_WORKSPACE_DATA_DIR_HOST). Undefined when dataDirHost is unset.
 * BIND MODE ONLY: in volume mode tenant data lives in the data volume, not on the host. */
export function hostSidePath(cfg: GatewayConfig, absPath: string): string | undefined {
  if (!cfg.dataDirHost) return undefined;
  const rel = absPath.slice(cfg.dataDir.length);
  return join(cfg.dataDirHost, rel);
}

/** OpenAI-surface lazy tenant: find by key, or create and start provisioning. */
export function getOrStartTenant(
  state: GatewayState,
  variant: string,
  user: string,
  ownerPrincipal?: string,
): { rec: TenantRecord; promise?: Promise<void> } {
  const key = tenantKeyFor(variant, user);
  const existing = state.registry.findByKey(key);
  if (existing) return { rec: existing };
  const rec = state.registry.create({
    dataDir: state.cfg.dataDir,
    variant,
    key,
    ownerPrincipal,
    description: `lazy tenant for ${key}`,
  });
  return { rec, promise: startProvisioning(state, rec) };
}

/** Lazy-tenant resolution for the OpenAI/Anthropic/Gemini surfaces. The tenant is keyed on the
 * authenticated principal (same key as /sessions), never on a client-supplied body user. */
export function resolveLazyTenant(
  state: GatewayState,
  req: Request,
  variant: string,
): { rec: TenantRecord; promise?: Promise<void> } {
  const principal = callerPrincipal(state, req) ?? "anonymous";
  const found = getOrStartTenant(state, variant, principal, principal);
  requireTenantAccess(state, req, found.rec);
  return found;
}

export async function waitForTenant(state: GatewayState, tenantId: string): Promise<TenantRecord> {
  const rec = state.registry.get(tenantId);
  if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
  return ensureReady(state, rec);
}

export const DELETE_WAIT_MS = 30_000;

export async function boundedWait(p: Promise<unknown> | undefined, ms = DELETE_WAIT_MS): Promise<void> {
  if (!p) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    p.catch(() => undefined),
    new Promise<void>((r) => { timer = setTimeout(r, ms); }),
  ]);
  if (timer) clearTimeout(timer);
}

/**
 * Single tenant-delete implementation for the tenant DELETE route and the admin user delete
 * (T-20260929-007). Order matters: validate paths first (a tampered record throws with the
 * registry row, turn history and files untouched, so a corrected delete can be retried), then
 * quiesce the tenant, remove files, and only then drop the registry/history state.
 */
export async function deleteTenantData(state: GatewayState, rec: TenantRecord, actor: string): Promise<void> {
  const tenantId = rec.tenantId;
  // T-20260928-003: a tampered/legacy record must never point any rmSync outside the tenant
  // storage root (projectDir at the storage root would otherwise wipe <storage> itself).
  const tenantFolder = resolve(rec.projectDir, "..");
  const storageRoot = resolve(state.cfg.dataDir, "storage");
  if (!tenantFolder.startsWith(storageRoot + sep) || !resolve(rec.hermesHome).startsWith(tenantFolder + sep)) {
    throw new HttpError(500, `refusing to delete: tenant folder ${tenantFolder} escapes ${storageRoot}`);
  }
  state.activeProcs.get(tenantId)?.kill();
  await boundedWait(state.provisioning.get(tenantId));
  await boundedWait(state.chatLocks.get(tenantId));
  if (state.cfg.isolation === "docker" && state.cfg.dataVolume) {
    // Volume mode (T-20260930-038): rmSync cannot reach into the volume - the broker helper
    // removes the subpath. On failure the registry row stays (status failed, retryable).
    try {
      await brokerVolumeControl("rm", tenantSubpathBase(state.cfg, rec));
    } catch (err) {
      rec.status = "failed";
      rec.error = String((err as Error)?.message ?? err);
      state.registry.upsert(rec);
      throw new HttpError(502, `tenant data removal failed: ${rec.error}`);
    }
  } else {
    rmSync(rec.projectDir, { recursive: true, force: true });
    rmSync(rec.hermesHome, { recursive: true, force: true });
    // The folder only ever holds the two dirs above; clear the shell, then legacy stragglers.
    rmSync(tenantFolder, { recursive: true, force: true });
    sweepTenantStragglers(dirname(tenantFolder), tenantId, basename(tenantFolder));
  }
  state.turns.deleteTenant(tenantId);
  state.registry.delete(tenantId);
  state.chatLocks.delete(tenantId);
  state.activeProcs.delete(tenantId);
  state.audit.record(actor, "tenant.delete", tenantId, rec.variant);
}
