/** Admin console group routes (design §8.3, as amended by the round-2 unit-model plan).
 * POST creates from name/description only — the server generates the id as an ASCII slug of
 * the name (the round-1 bug: a Korean or uppercase id died on GROUP_ID_RE with a bare
 * invalid_request). Explicit groupId stays accepted for API callers. The v4 unit model
 * merged loop groups into general groups, and the group-policy blob moved to the policies
 * API: PUT /admin/groups/:id/policy answers 410 Gone. Membership edits trigger the
 * tenant-loop registry export (a member change alters loop coverage). */

import { isReservedLoginId, requireAdminReady, requireAdminReauth } from "../../access";
import { quarantineGroupSharedTeams } from "../../lifecycle";
import { GroupConflictError } from "../../users";
import { exportTenantLoopRegistry } from "../../tenant-loop";
import { HttpError, jsonResponse, readJsonBody } from "../../http";
import type { GatewayState } from "../../state";
import type { Ctx } from "../ctx";
import { parsePrincipals } from "./shared";

const GROUP_ID_RE = /^[a-z0-9-]{2,40}$/;

/** Field-specific client error: the console shows it inline on the named field. */
function fieldError(status: number, error: string, field: string): Response {
  return jsonResponse({ error, field }, status);
}

/** ASCII slug of a group name: NFKD-transliterate (é → e), lowercase, collapse every
 * non-[a-z0-9] run to one dash, trim. Empty (e.g. a fully Korean name) → "" — the caller
 * falls back to g-<8hex>. Clamped to the GROUP_ID_RE length. */
export function slugifyGroupName(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/** Deduplicate a candidate group id against existing groups AND the reserved-principal
 * guard (a group id sharing the login-id namespace must not claim a reserved word, the
 * u-<12hex> account shape, or a configured key label) with numeric suffixes. */
function dedupeGroupId(state: GatewayState, candidate: string): string {
  let id = candidate;
  for (let n = 2; state.users.getGroupRecord(id) || isReservedLoginId(state.cfg, id); n += 1) {
    id = `${candidate}-${n}`;
  }
  return id;
}

/** Server-generated id: slug of the name, or g-<8hex> when the slug is empty. */
function generateGroupId(state: GatewayState, name: string): string {
  const slug = slugifyGroupName(name);
  const base = GROUP_ID_RE.test(slug) ? slug : `g-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  return dedupeGroupId(state, base);
}

function groupOr404(state: GatewayState, groupId: string) {
  const group = state.users.getGroupRecord(groupId);
  if (!group) throw new HttpError(404, "not_found");
  return group;
}

function optionalString(value: unknown, max: number, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) throw new HttpError(400, `invalid_${field}`);
  return value;
}

export async function handleGroups(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path, url } = ctx;

  if (req.method === "GET" && path === "/admin/groups") {
    requireAdminReady(state, req);
    const kind = url.searchParams.get("kind");
    if (kind !== null && kind !== "general" && kind !== "loop") throw new HttpError(400, "invalid_request");
    return jsonResponse({ groups: state.users.listGroupRecords(kind ? { kind } : {}) });
  }

  if (req.method === "POST" && path === "/admin/groups") {
    const caller = requireAdminReady(state, req);
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) return fieldError(400, "invalid_name", "name");
    const description = optionalString(body.description, 500, "description");
    // v4 unit model: no inline policy — limits are named policies assigned under reauth
    // (POST /admin/policies + POST /admin/policies/:id/assignments). The deprecated
    // groups.policy column is never written.
    if (body.policy !== undefined && body.policy !== null) {
      return jsonResponse({ error: "policy_not_allowed_on_create", field: "policy", pointer: "/admin/policies" }, 400);
    }
    let groupId: string;
    if (body.groupId !== undefined && body.groupId !== null) {
      // API-compat path: an explicit id must still satisfy the group-id shape.
      if (typeof body.groupId !== "string" || !GROUP_ID_RE.test(body.groupId)) {
        return fieldError(400, "invalid_group_id", "groupId");
      }
      groupId = body.groupId;
      if (state.users.getGroupRecord(groupId)) return fieldError(409, "conflict", "groupId");
    } else {
      groupId = generateGroupId(state, name);
    }
    try {
      const group = state.users.createGroup({ groupId, name, description });
      state.audit.record(caller.principal, "group.create", groupId, `name=${name}`);
      return jsonResponse(group, 201);
    } catch (err) {
      if (err instanceof GroupConflictError) return fieldError(409, "conflict", "groupId");
      throw err;
    }
  }

  const detail = path.match(/^\/admin\/groups\/([^/]+)$/);
  if (detail) {
    const groupId = decodeURIComponent(detail[1]);

    if (req.method === "GET") {
      requireAdminReady(state, req);
      const group = groupOr404(state, groupId);
      return jsonResponse({ ...group, members: state.users.listMembers(groupId) });
    }

    if (req.method === "PATCH") {
      const caller = requireAdminReady(state, req);
      groupOr404(state, groupId);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const patch: { name?: string; description?: string | null } = {};
      if (body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 80) return fieldError(400, "invalid_name", "name");
        patch.name = name;
      }
      if (body.description !== undefined) {
        patch.description = body.description === null ? null : (optionalString(body.description, 500, "description") ?? null);
      }
      const updated = state.users.updateGroup(groupId, patch)!;
      state.audit.record(caller.principal, "group.update", groupId, Object.keys(patch).join(","));
      return jsonResponse(updated);
    }

    if (req.method === "DELETE") {
      const caller = requireAdminReady(state, req);
      await requireAdminReauth(state, req);
      const group = groupOr404(state, groupId);
      if (group.kind === "loop") throw new HttpError(409, "loop_group_readonly");
      const members = state.users.listMembers(groupId).length;
      // deleteGeneralGroup cascades the group's policy_assignments / loop_enrollments /
      // loop_operators rows (round-2 amendment C — group ids are reusable).
      state.users.deleteGeneralGroup(groupId);
      state.audit.record(caller.principal, "group.delete", groupId, `members=${members}`);
      // Round-3 QA (S2): group ids are reusable, so the group's shared teams are QUARANTINED
      // (archived + audited) — a recreated group id must never inherit the old team. Runs
      // after the successful delete: the teams belong to a group id that no longer exists.
      quarantineGroupSharedTeams(state, groupId, caller.principal);
      // A deleted group can no longer cover tenants — refresh the registry export.
      const exported = exportTenantLoopRegistry(state);
      return jsonResponse({ ok: true, export: exported });
    }
  }

  const members = path.match(/^\/admin\/groups\/([^/]+)\/members$/);
  if (members && (req.method === "POST" || req.method === "DELETE")) {
    const caller = requireAdminReady(state, req);
    // 2026-11-09 review M4: removing members re-confirms the password (adding does not).
    if (req.method === "DELETE") await requireAdminReauth(state, req);
    const groupId = decodeURIComponent(members[1]);
    const group = groupOr404(state, groupId);
    if (group.kind === "loop") throw new HttpError(409, "loop_group_readonly");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const principals = parsePrincipals(body.principals);
    if (req.method === "POST") {
      const result = state.users.addMembers(groupId, principals);
      state.audit.record(caller.principal, "group.member.add", groupId, `n=${result.added}`);
      // A member change alters the group's loop coverage — export trigger (round-2 amendment C).
      const exported = exportTenantLoopRegistry(state);
      return jsonResponse({ ...result, export: exported });
    }
    const result = state.users.removeMembers(groupId, principals);
    state.audit.record(caller.principal, "group.member.remove", groupId, `n=${result.removed}`);
    const exported = exportTenantLoopRegistry(state);
    return jsonResponse({ ...result, export: exported });
  }

  const policy = path.match(/^\/admin\/groups\/([^/]+)\/policy$/);
  if (req.method === "PUT" && policy) {
    // Round-2 compat shim (amendment C): the group-policy blob is GONE — the route answers
    // 410 Gone pointing at the policies API; it does not stay functional. Answered before
    // any auth so stale UI callers see the removal, not a credentials error.
    return jsonResponse({ error: "policy_route_removed", pointer: "/admin/policies" }, 410);
  }

  return null;
}
