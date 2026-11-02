/**
 * Phase 2 authentication (design 2026-09-27-co-workspace-phase2-hardening, D1).
 * Bearer-key auth for every non-exempt route. Keys come from `CO_WORKSPACE_API_KEYS`;
 * an empty pool keeps the Phase 0 localhost mode (auth disabled, startup warns).
 * Comparison hashes both sides (SHA-256) before a constant-time compare — no length,
 * prefix, or content oracles. Keys are never echoed by any endpoint or log line.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { keyEntryExpired, readKeyEntries } from "./config";

// GET /login must stay keyless: with keys configured, a fresh browser has no session yet,
// so gating the sign-in page makes sign-in itself impossible. The page holds no data and
// POST /auth/login carries its own rate limits; the loginRequired gate still demands a
// session for everything the page leads to.
// GET /app-helpers.js: the web app's pure-helper module (no tenant data) — without
// this exemption an unauthenticated browser in key mode gets a dead shell (the
// module import 401s) instead of the sign-in pointer card (found 2026-10-04,
// voice-conversation UI verification).
export const AUTH_EXEMPT_ROUTES: ReadonlySet<string> = new Set(["GET /", "GET /health", "GET /login", "GET /app-helpers.js"]);

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

/** True when the presented credential matches any configured key. ADR-0092 Addendum 17
 * (Decision 6): file entries whose `expires` timestamp has passed no longer validate — the
 * auth gate 401s them (revocation-by-expiry). Env keys never expire. */
export function credentialValid(cfg: { apiKeys: string[] }, presented: string | null): boolean {
  if (presented === null || presented === "") return false;
  const expired = new Set(
    readKeyEntries((cfg as { apiKeysFile?: string }).apiKeysFile)
      .filter((e) => keyEntryExpired(e))
      .map((e) => e.key),
  );
  return cfg.apiKeys.some((key) => !expired.has(key) && constantTimeEquals(key, presented));
}

/** Principal for a presented credential (P9): the trusted label — or, when the entry carries
 * a `spoke-id` (Addendum 17 Decision 6), the spoke id, which scopes the key to one spoke and
 * becomes the principal for attached-tenant ownership. Always gateway-derived from the
 * verified key; "anonymous" when auth is off or the key is expired. An expired file entry
 * also never resolves through the env-keys fallback below (the merged `apiKeys` list still
 * contains it — a revoked key maps NO principal, Addendum 17 Decision 6). */
export function principalFor(cfg: { apiKeys: string[]; apiKeysFile?: string }, presented: string | null): string {
  if (presented === null || presented === "") return "anonymous";
  const entries = readKeyEntries(cfg.apiKeysFile);
  const expired = new Set(entries.filter((e) => keyEntryExpired(e)).map((e) => e.key));
  for (const e of entries) {
    if (keyEntryExpired(e)) continue;
    if (constantTimeEquals(e.key, presented)) return e.spokeId || e.label;
  }
  for (const key of cfg.apiKeys) {
    if (expired.has(key)) continue;
    if (constantTimeEquals(key, presented)) return "default";
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
