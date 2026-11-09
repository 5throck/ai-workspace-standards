/** Demo page and variant status cache. */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { GatewayConfig, SERVICE_ROOT } from "./config";
import { isPasswordSetAdmin } from "./access";
import { sessionTokenFromCookie } from "./users";
import { htmlHeaders } from "./http";
import type { GatewayState } from "./state";

export const DEMO_PAGE_PATH = resolve(SERVICE_ROOT, "web", "index.html");
export const ADMIN_PAGE_PATH = resolve(SERVICE_ROOT, "web", "admin.html");

const variantStatusCache = new Map<string, string>();

/** P1: variant lifecycle status for catalog metadata (default "stable" when unreadable). */
export function variantStatus(cfg: GatewayConfig, variant: string): string {
  const cached = variantStatusCache.get(variant);
  if (cached) return cached;
  try {
    const v = JSON.parse(readFileSync(join(cfg.workspaceDir, "templates", variant, "variant.json"), "utf8")) as {
      status?: string;
    };
    const status = v.status ?? "stable";
    variantStatusCache.set(variant, status);
    return status;
  } catch {
    return "stable";
  }
}

export function demoPage(): Response {
  if (existsSync(DEMO_PAGE_PATH)) {
    return new Response(readFileSync(DEMO_PAGE_PATH, "utf8"), {
      headers: htmlHeaders(),
    });
  }
  return new Response("<!doctype html><title>co-workspace</title><p>demo page not built</p>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

/** GET /admin: the admin console shell (design §9.2). Only a session admin whose password is
 * set receives the page; every other caller, including one still on a temporary password, is
 * redirected to the chat page, where the forced-change dialog appears. The API routes enforce
 * authz themselves, so the redirect is cosmetic. */
export function adminPage(state: GatewayState, req: Request): Response {
  const user = state.users.resolveSession(sessionTokenFromCookie(req));
  if (!isPasswordSetAdmin(state, req) || user?.mustChangePassword) {
    return new Response(null, { status: 302, headers: { location: "/" } });
  }
  if (existsSync(ADMIN_PAGE_PATH)) {
    return new Response(readFileSync(ADMIN_PAGE_PATH, "utf8"), {
      headers: htmlHeaders(),
    });
  }
  return new Response("<!doctype html><title>co-workspace admin</title><p>admin page not built</p>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
