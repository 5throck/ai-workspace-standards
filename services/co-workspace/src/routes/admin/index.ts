/** Admin route dispatcher. Each module answers the paths it owns and returns null otherwise. */

import { HttpError } from "../../http";
import type { GatewayState } from "../../state";
import type { Ctx } from "../ctx";
import { handleLegacy } from "./legacy";
import { handleUsers } from "./users";
import { handleGroups } from "./groups";
import { handlePolicies } from "./policies";
import { handleAdminTenants } from "./tenants";
import { handleTenantLoop } from "./tenant-loop";

export async function handleAdmin(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  // Design §10: console mutations always carry the SEC-09 header. Unlike the global guard, this
  // applies even when an API key is presented, because the console's credential is a cookie.
  const adminPath = path === "/admin" || path.startsWith("/admin/");
  if (adminPath && req.method !== "GET" && req.method !== "HEAD" && req.headers.get("x-requested-with") !== "co-workspace") {
    throw new HttpError(403, "missing x-requested-with header (CSRF guard)");
  }
  return (
    (await handleUsers(state, req, ctx)) ??
    (await handleGroups(state, req, ctx)) ??
    (await handlePolicies(state, req, ctx)) ??
    (await handleAdminTenants(state, req, ctx)) ??
    (await handleLegacy(state, req, ctx)) ??
    (await handleTenantLoop(state, req, ctx))
  );
}
