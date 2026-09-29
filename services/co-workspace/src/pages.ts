/** Demo page and variant status cache. */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { GatewayConfig, SERVICE_ROOT } from "./config";
import { htmlHeaders } from "./http";

export const DEMO_PAGE_PATH = resolve(SERVICE_ROOT, "web", "index.html");

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
