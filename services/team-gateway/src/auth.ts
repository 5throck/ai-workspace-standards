/**
 * Phase 2 authentication (design 2026-09-27-team-gateway-phase2-hardening, D1).
 * Bearer-key auth for every non-exempt route. Keys come from `TEAM_GATEWAY_API_KEYS`;
 * an empty pool keeps the Phase 0 localhost mode (auth disabled, startup warns).
 * Comparison hashes both sides (SHA-256) before a constant-time compare — no length,
 * prefix, or content oracles. Keys are never echoed by any endpoint or log line.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_EXEMPT_ROUTES: ReadonlySet<string> = new Set(["GET /", "GET /health"]);

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function constantTimeEquals(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}

/** Extract a presented credential from the three accepted header styles. */
export function presentedCredential(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  return req.headers.get("x-api-key") ?? req.headers.get("x-goog-api-key");
}

export function isAuthEnabled(cfg: { apiKeys: string[] }): boolean {
  return cfg.apiKeys.length > 0;
}

/** True when the presented credential matches any configured key. */
export function credentialValid(cfg: { apiKeys: string[] }, presented: string | null): boolean {
  if (presented === null || presented === "") return false;
  return cfg.apiKeys.some((key) => constantTimeEquals(key, presented));
}

/** Route gate: exempt routes pass; otherwise a valid key is required when auth is on. */
export function requestAuthorized(
  cfg: { apiKeys: string[] },
  req: Request,
  routeKey: string,
): boolean {
  if (!isAuthEnabled(cfg)) return true;
  if (AUTH_EXEMPT_ROUTES.has(routeKey)) return true;
  return credentialValid(cfg, presentedCredential(req));
}
