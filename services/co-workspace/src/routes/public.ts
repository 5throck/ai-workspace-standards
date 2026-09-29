import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SERVICE_ROOT } from "../config";
import { googleConfigured } from "../google-sso";
import { HttpError, jsonResponse, htmlHeaders } from "../http";
import { demoPage } from "../pages";
import type { GatewayState } from "../state";
import type { Ctx } from "./ctx";

export async function handlePublic(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  if (req.method === "GET" && path === "/") return demoPage();

  if (req.method === "GET" && path === "/login") {
    const loginPath = resolve(SERVICE_ROOT, "web", "login.html");
    if (existsSync(loginPath)) {
      return new Response(readFileSync(loginPath, "utf8"), {
        headers: htmlHeaders(),
      });
    }
    throw new HttpError(404, "login page not found");
  }

  // T-20260928-012: the demo app's pure helpers module (imported by the
  // index.html module script). Same no-cache posture as the HTML pages.
  if (req.method === "GET" && path === "/app-helpers.js") {
    const helpersPath = resolve(SERVICE_ROOT, "web", "app-helpers.js");
    if (existsSync(helpersPath)) {
      return new Response(readFileSync(helpersPath, "utf8"), {
        headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
      });
    }
    throw new HttpError(404, "app helpers not found");
  }

  if (req.method === "GET" && path === "/health") {
    return jsonResponse({
      ok: true,
      service: "co-workspace",
      authEnabled: state.cfg.apiKeys.length > 0,
      googleSso: googleConfigured(),
      loginRequired: state.cfg.loginRequired,
      isolation: state.cfg.isolation,
      runtime: state.cfg.runtime,
      variants: state.cfg.variants,
      templateVersion: state.cfg.templateVersion ?? "head",
      tenants: state.registry.list().length,
    });
  }

  return null;
}
