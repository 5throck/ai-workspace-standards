/** Named-policy CRUD + group-only assignments (round-2 unit-model amendment C: design
 * docs/designs/2026-11-09-gw-admin-console-round2-plan.md). Reauth matrix: create and read
 * need no re-confirmation; PATCH, DELETE, assign and unassign require the password
 * (x-admin-password). A create carrying inline assignments answers 409 — create first, then
 * assign under reauth. Every mutation is audited (policy.create/update/delete/assign/
 * unassign); updates record the old AND new limits. */

import { requireAdminReady, requireAdminReauth } from "../../access";
import { validateGroupPolicy } from "../../policy";
import { GroupConflictError } from "../../users";
import { HttpError, jsonResponse, readJsonBody } from "../../http";
import type { GatewayState } from "../../state";
import type { Ctx } from "../ctx";

function policyOr404(state: GatewayState, policyId: string) {
  const policy = state.users.getPolicy(policyId);
  if (!policy) throw new HttpError(404, "not_found");
  return policy;
}

function parseName(body: Record<string, unknown>): string {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) throw new HttpError(400, "invalid_name");
  return name;
}

function parseDescription(body: Record<string, unknown>): string | null | undefined {
  if (body.description === undefined) return undefined;
  if (body.description === null) return null;
  if (typeof body.description !== "string" || body.description.length > 500) throw new HttpError(400, "invalid_description");
  return body.description;
}

/** POST/DELETE /admin/policies/:id/assignments — the body is {groupId} (GROUP-ONLY targets:
 * the v4 amendment removed per-user assignment targets entirely). */
function parseAssignmentGroupId(body: Record<string, unknown>): string {
  if (body.targets !== undefined) throw new HttpError(400, "assignments carry {groupId} only (group-only targets per the unit model)");
  const groupId = typeof body.groupId === "string" ? body.groupId.trim() : "";
  if (!groupId) throw new HttpError(400, "invalid_group_id");
  return groupId;
}

export async function handlePolicies(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  if (!path.startsWith("/admin/policies")) return null;

  if (req.method === "GET" && path === "/admin/policies") {
    requireAdminReady(state, req);
    return jsonResponse({ policies: state.users.listPolicies() });
  }

  if (req.method === "POST" && path === "/admin/policies") {
    const caller = requireAdminReady(state, req);
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    // No inline assignment payloads exist on create (round-2 reauth matrix): answer 409 and
    // point at the assignments route so the caller creates first, then assigns under reauth.
    if (body.assignments !== undefined || body.targets !== undefined) {
      return jsonResponse({ error: "assignments_not_allowed_on_create", pointer: "/admin/policies/:id/assignments" }, 409);
    }
    const name = parseName(body);
    const description = parseDescription(body);
    const limits = validateGroupPolicy(body.limits ?? {}, state.cfg);
    try {
      const policy = state.users.createPolicy({ name, description: description ?? null, limits });
      state.audit.record(caller.principal, "policy.create", policy.policyId, `name=${name} limits=${JSON.stringify(limits)}`);
      return jsonResponse({ policy }, 201);
    } catch (err) {
      if (err instanceof GroupConflictError) throw new HttpError(409, "conflict");
      throw err;
    }
  }

  const detail = path.match(/^\/admin\/policies\/([^/]+)$/);
  if (detail) {
    const policyId = decodeURIComponent(detail[1]);

    if (req.method === "GET") {
      requireAdminReady(state, req);
      const policy = policyOr404(state, policyId);
      return jsonResponse({ policy, assignments: state.users.listAssignments(policyId) });
    }

    if (req.method === "PATCH") {
      const caller = requireAdminReady(state, req);
      await requireAdminReauth(state, req);
      const old = policyOr404(state, policyId);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const patch: { name?: string; description?: string | null; limits?: ReturnType<typeof validateGroupPolicy> } = {};
      if (body.name !== undefined) patch.name = parseName(body);
      const description = parseDescription(body);
      if (description !== undefined) patch.description = description;
      if (body.limits !== undefined) patch.limits = validateGroupPolicy(body.limits, state.cfg);
      let updated;
      try {
        updated = state.users.updatePolicy(policyId, patch);
      } catch (err) {
        if (err instanceof GroupConflictError) throw new HttpError(409, "conflict");
        throw err;
      }
      if (!updated) throw new HttpError(404, "not_found");
      state.audit.record(
        caller.principal,
        "policy.update",
        policyId,
        `old=${JSON.stringify(old.limits)} new=${JSON.stringify(updated.limits)}`,
      );
      return jsonResponse({ policy: updated });
    }

    if (req.method === "DELETE") {
      const caller = requireAdminReady(state, req);
      await requireAdminReauth(state, req);
      const policy = policyOr404(state, policyId);
      const assignments = state.users.listAssignments(policyId).length;
      state.users.deletePolicy(policyId); // cascades its assignments (single transaction)
      state.audit.record(caller.principal, "policy.delete", policyId, `name=${policy.name} assignments=${assignments}`);
      return jsonResponse({ ok: true });
    }
  }

  const assignments = path.match(/^\/admin\/policies\/([^/]+)\/assignments$/);
  if (assignments && (req.method === "POST" || req.method === "DELETE")) {
    const caller = requireAdminReady(state, req);
    await requireAdminReauth(state, req);
    const policyId = decodeURIComponent(assignments[1]);
    policyOr404(state, policyId);
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const groupId = parseAssignmentGroupId(body);
    if (req.method === "POST") {
      try {
        state.users.assignPolicy(policyId, groupId);
      } catch (err) {
        if (err instanceof GroupConflictError) throw new HttpError(409, "conflict");
        throw err;
      }
      state.audit.record(caller.principal, "policy.assign", policyId, `group=${groupId}`);
      return jsonResponse({ ok: true, policyId, groupId });
    }
    const removed = state.users.unassignPolicy(policyId, groupId);
    if (!removed) throw new HttpError(404, "not_found");
    state.audit.record(caller.principal, "policy.unassign", policyId, `group=${groupId}`);
    return jsonResponse({ ok: true, policyId, groupId });
  }

  throw new HttpError(404, `no route: ${req.method} ${path}`);
}
