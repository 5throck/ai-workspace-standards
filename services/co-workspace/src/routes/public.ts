import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
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

/** Max mtime across the web app's static files — the page polls /health with this
 * (stale-tab guard, voice-conversation design revision 6): a redeployed gateway
 * bumps webBuild, the open tab notices and offers a reload instead of running
 * days-old JS. */
function webBuildStamp(): number {
  const dir = join(SERVICE_ROOT, "web");
  let max = 0;
  for (const name of ["index.html", "login.html", "app-helpers.js"]) {
    try {
      max = Math.max(max, statSync(join(dir, name)).mtimeMs);
    } catch {
      /* missing file — skip */
    }
  }
  return Math.round(max);
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
      webBuild: webBuildStamp(),
      tenants: state.registry.list().length,
    });
  }

  return null;
}
