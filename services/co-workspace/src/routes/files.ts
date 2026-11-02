import { listTenantFiles, readTenantFile } from "../tenant-files";
import { HttpError, jsonResponse } from "../http";
import { requireTenantAccess } from "../access";
import { attachScratchDir } from "../attach";
import type { GatewayState } from "../state";
import type { TenantRecord } from "../tenant";
import type { Ctx } from "./ctx";

export async function handleFiles(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  // Wave A (P11): tenant files listing / content, and turn history.
  // Addendum 17: attached tenants browse the per-session SCRATCH — the same directory the
  // session container mounts at /work/project. rec.projectDir for an attached tenant is the
  // HUB checkout; pointing this API at it would hand the spoke key read access to the whole
  // hub working tree through the gateway, defeating the scratch+ticket-queue mount policy
  // (the session cannot read the hub tree in this pilot posture — nor can its API surface).
  const filesRootOf = (rec: TenantRecord): string => (rec.kind === "attached" ? attachScratchDir(rec) : rec.projectDir);
  const filesRoute = path.match(/^\/tenants\/([^/]+)\/files(?:\/(.*))?$/);
  if (req.method === "GET" && filesRoute) {
    const rec = state.registry.get(decodeURIComponent(filesRoute[1]));
    if (!rec) throw new HttpError(404, `tenant ${filesRoute[1]} not found`);
    const rel = filesRoute[2] ? decodeURIComponent(filesRoute[2]) : "";
    requireTenantAccess(state, req, rec);
    const entries = listTenantFiles(filesRootOf(rec), rel);
    if (entries === null) throw new HttpError(404, "path not found or not allowed");
    return jsonResponse({ path: rel, entries });
  }

  const fileRoute = path.match(/^\/tenants\/([^/]+)\/file\/(.+)$/);
  if (req.method === "GET" && fileRoute) {
    const rec = state.registry.get(decodeURIComponent(fileRoute[1]));
    if (!rec) throw new HttpError(404, `tenant ${fileRoute[1]} not found`);
    const rel = decodeURIComponent(fileRoute[2]);
    requireTenantAccess(state, req, rec);
    const content = readTenantFile(filesRootOf(rec), rel);
    if (content === null) throw new HttpError(404, "file not found or not allowed");
    if ("tooLarge" in content) throw new HttpError(413, "file exceeds the 256KB preview cap");
    return jsonResponse({ path: rel, content: content.content });
  }

  const historyRoute = path.match(/^\/tenants\/([^/]+)\/history$/);
  if (req.method === "GET" && historyRoute) {
    const tenantId = decodeURIComponent(historyRoute[1]);
    const rec = state.registry.get(tenantId);
    if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
    requireTenantAccess(state, req, rec);
    return jsonResponse({ turns: state.turns.list(tenantId) });
  }

  return null;
}
