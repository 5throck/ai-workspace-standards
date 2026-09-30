/**
 * Phase 2 authentication (design 2026-09-27-co-workspace-phase2-hardening, D1).
 * Bearer-key auth for every non-exempt route. Keys come from `CO_WORKSPACE_API_KEYS`;
 * an empty pool keeps the Phase 0 localhost mode (auth disabled, startup warns).
 * Comparison hashes both sides (SHA-256) before a constant-time compare — no length,
 * prefix, or content oracles. Keys are never echoed by any endpoint or log line.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { readKeyEntries } from "./config";

// GET /login must stay keyless: with keys configured, a fresh browser has no session yet,
// so gating the sign-in page makes sign-in itself impossible. The page holds no data and
// POST /auth/login carries its own rate limits; the loginRequired gate still demands a
// session for everything the page leads to.
export const AUTH_EXEMPT_ROUTES: ReadonlySet<string> = new Set(["GET /", "GET /health", "GET /login"]);

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function constantTimeEquals(a: string, b: string): boolean {
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

/** P9: a key entry may carry a principal label (`key:label`) — file style only. The label is
 * a trusted identity for ownership filtering; keys without a label map to the label `default`. */
export function keyPrincipals(cfg: { apiKeys: string[]; apiKeysFile?: string }): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of cfg.apiKeys) map.set(key, "default");
  for (const e of readKeyEntries(cfg.apiKeysFile)) map.set(e.key, e.label);
  return map;
}

/** Principal for a presented credential (P9): the trusted label, or "anonymous" when auth is off. */
export function principalFor(cfg: { apiKeys: string[]; apiKeysFile?: string }, presented: string | null): string {
  if (presented === null || presented === "") return "anonymous";
  const map = keyPrincipals(cfg);
  for (const [key, label] of map) {
    if (constantTimeEquals(key, presented)) return label;
  }
  return "anonymous";
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
