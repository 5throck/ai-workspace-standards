/** Admin console tenant routes (design §8.4): owner and group views, and bulk archive, restore,
 * and delete. Archive is a flag on the tenant record; it stops turns but keeps the tenant
 * counted toward the owner's cap. */

import { requireAdminReady, requireAdminReauth } from "../../access";
import { deleteTenantData } from "../../lifecycle";
import { HttpError, jsonResponse, readJsonBody } from "../../http";
import type { GatewayState } from "../../state";
import type { TenantRecord } from "../../tenant";
import type { Ctx } from "../ctx";
import { BulkFailure, PAGE_SIZE_MAX, parseBulkIds } from "./shared";

const TENANT_BULK_ACTIONS = ["archive", "restore", "delete"] as const;
type TenantBulkAction = (typeof TENANT_BULK_ACTIONS)[number];

const AUDIT_ACTION: Record<TenantBulkAction, string> = {
  archive: "tenant.archive",
  restore: "tenant.restore",
  delete: "tenant.delete",
};

function pageParam(params: URLSearchParams, name: string, fallback: number, max: number): number {
  const raw = params.get(name);
  if (raw === null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > max) throw new HttpError(400, "invalid_request");
  return value;
}

export async function handleAdminTenants(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path, url } = ctx;

  if (req.method === "GET" && path === "/admin/tenants") {
    requireAdminReady(state, req);
    const params = url.searchParams;
    const owner = params.get("owner") || undefined;
    const variant = params.get("variant") || undefined;
    const status = params.get("status");
    if (status !== null && status !== "active" && status !== "archived") throw new HttpError(400, "invalid_request");
    const group = params.get("group") || undefined;
    const groupMembers = group ? new Set(state.users.listMembers(group)) : null;
    const page = pageParam(params, "page", 1, Number.MAX_SAFE_INTEGER);
    const size = pageParam(params, "size", 50, PAGE_SIZE_MAX);

    const matching = state.registry
      .list()
      .filter((t) => (owner ? (t.ownerPrincipal ?? "anonymous") === owner : true))
      .filter((t) => (groupMembers ? groupMembers.has(t.ownerPrincipal ?? "anonymous") : true))
      .filter((t) => (variant ? t.variant === variant : true))
      .filter((t) => (status === "archived" ? Boolean(t.archivedAt) : status === "active" ? !t.archivedAt : true));
    const slice = matching.slice((page - 1) * size, page * size);
    return jsonResponse({
      tenants: slice.map((t) => ({
        tenantId: t.tenantId,
        name: t.name ?? null,
        variant: t.variant,
        status: t.status,
        ownerPrincipal: t.ownerPrincipal ?? "anonymous",
        archivedAt: t.archivedAt ?? null,
        sessions: t.sessions,
        inputTokens: t.inputTokens,
        outputTokens: t.outputTokens,
        createdAt: t.createdAt,
      })),
      total: matching.length,
      page,
      size,
    });
  }

  if (req.method === "POST" && path === "/admin/tenants/bulk") {
    const caller = requireAdminReady(state, req);
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const action = body.action;
    if (typeof action !== "string" || !(TENANT_BULK_ACTIONS as readonly string[]).includes(action)) {
      throw new HttpError(400, "invalid_request");
    }
    const bulkAction = action as TenantBulkAction;
    const ids = parseBulkIds(body.ids);
    await requireAdminReauth(state, req);

    const failed: BulkFailure[] = [];
    let ok = 0;
    for (const id of ids) {
      const rec: TenantRecord | undefined = state.registry.get(id);
      if (!rec) {
        failed.push({ id, error: "not_found" });
        continue;
      }
      if (bulkAction === "delete") {
        try {
          await deleteTenantData(state, rec, caller.principal);
        } catch {
          failed.push({ id, error: "delete_failed" });
          continue;
        }
      } else if (bulkAction === "archive") {
        if (!rec.archivedAt) {
          rec.archivedAt = new Date().toISOString();
          state.registry.upsert(rec);
        }
      } else {
        delete rec.archivedAt;
        state.registry.upsert(rec);
      }
      state.audit.record(caller.principal, AUDIT_ACTION[bulkAction], id);
      ok += 1;
    }
    state.audit.record(caller.principal, `tenant.bulk.${bulkAction}`, undefined, `ok=${ok} failed=${failed.length}`);
    return jsonResponse({ ok, failed });
  }

  return null;
}
