/** Admin console group routes (design §8.3). Loop groups are visible here but their membership
 * is owned by the tenant-loop config, so membership edits, deletes, and policy writes refuse
 * them (409 loop_group_readonly). */

import { requireAdminReady, requireAdminReauth } from "../../access";
import { validateGroupPolicy } from "../../policy";
import { GroupConflictError } from "../../users";
import { HttpError, jsonResponse, readJsonBody } from "../../http";
import type { GatewayState } from "../../state";
import type { Ctx } from "../ctx";
import { parsePrincipals } from "./shared";

const GROUP_ID_RE = /^[a-z0-9-]{2,40}$/;

function groupOr404(state: GatewayState, groupId: string) {
  const group = state.users.getGroupRecord(groupId);
  if (!group) throw new HttpError(404, "not_found");
  return group;
}

function optionalString(value: unknown, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > max) throw new HttpError(400, "invalid_request");
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
    const groupId = typeof body.groupId === "string" ? body.groupId : "";
    if (!GROUP_ID_RE.test(groupId)) throw new HttpError(400, "invalid_request");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) throw new HttpError(400, "invalid_request");
    const description = optionalString(body.description, 500);
    const policy = body.policy === undefined || body.policy === null ? null : validateGroupPolicy(body.policy, state.cfg);
    try {
      const group = state.users.createGroup({ groupId, name, description, policy });
      state.audit.record(caller.principal, "group.create", groupId, `name=${name}`);
      return jsonResponse(group, 201);
    } catch (err) {
      if (err instanceof GroupConflictError) throw new HttpError(409, "conflict");
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
        if (!name || name.length > 80) throw new HttpError(400, "invalid_request");
        patch.name = name;
      }
      if (body.description !== undefined) {
        patch.description = body.description === null ? null : (optionalString(body.description, 500) ?? null);
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
      state.users.deleteGeneralGroup(groupId);
      state.audit.record(caller.principal, "group.delete", groupId, `members=${members}`);
      return jsonResponse({ ok: true });
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
      return jsonResponse(result);
    }
    const result = state.users.removeMembers(groupId, principals);
    state.audit.record(caller.principal, "group.member.remove", groupId, `n=${result.removed}`);
    return jsonResponse(result);
  }

  const policy = path.match(/^\/admin\/groups\/([^/]+)\/policy$/);
  if (req.method === "PUT" && policy) {
    const caller = requireAdminReady(state, req);
    // 2026-11-09 review M4: every policy write re-confirms the password.
    await requireAdminReauth(state, req);
    const groupId = decodeURIComponent(policy[1]);
    const group = groupOr404(state, groupId);
    // 2026-11-09 review M1: loop groups carry no policy (their limits come from the loop config).
    if (group.kind === "loop") throw new HttpError(409, "loop_group_readonly");
    const body = (await readJsonBody(req)) as unknown;
    const canonical = body === null ? null : validateGroupPolicy(body, state.cfg);
    const updated = state.users.setGroupPolicy(groupId, canonical)!;
    state.audit.record(caller.principal, "group.policy.update", groupId, canonical ? JSON.stringify(canonical) : "null");
    return jsonResponse(updated);
  }

  return null;
}
