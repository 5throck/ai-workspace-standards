/** HTTP utilities: error responses, JSON parsing, client IP resolution. */

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "request body must be valid JSON");
  }
}

/** Client IP for rate limiting. Untrusted (default): the socket peer, "local" when unknown.
 * trustProxy: the RIGHT-most X-Forwarded-For entry — the hop the trusted proxy appended; the
 * left-most entries are client-supplied and spoofable. Falls back to the peer address. */
export function resolveClientIp(trustProxy: boolean, req: Request, peerIp?: string): string {
  if (trustProxy) {
    const parts = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return peerIp || "local";
}

/** Whether the session cookie gets `Secure` for this request. true/false force it; "auto"
 * (or unset) is Secure over an https URL, or — only when trustProxy — when the right-most
 * X-Forwarded-Proto entry (the hop the trusted proxy appended) is https. */
export function cookieSecureFor(cfg: { cookieSecure?: boolean | "auto"; trustProxy?: boolean }, req: Request): boolean {
  if (cfg.cookieSecure === true) return true;
  if (cfg.cookieSecure === false) return false;
  if (new URL(req.url).protocol === "https:") return true;
  if (cfg.trustProxy) {
    const parts = (req.headers.get("x-forwarded-proto") ?? "").split(",");
    return (parts[parts.length - 1] ?? "").trim().toLowerCase() === "https";
  }
  return false;
}

/** The single-file app ships without versioned asset URLs — `no-cache` forces revalidation
 * on every load, otherwise browsers heuristically cache the page across redeploys and run
 * stale code for days (the "nothing changed" report of 2026-09-27/28).
 *
 * CSP (2026-10-03 review M2): the app's scripts are INLINE modules (index.html/login.html),
 * so `script-src 'unsafe-inline'` is unavoidable today — the header's value is what it still
 * blocks: external-origin script/img/connect exfiltration, plugin content, framing, and
 * base-tag hijacking. Splitting the module out (web-split plan) can tighten script-src. */
export function htmlHeaders(): Record<string, string> {
  return {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache",
    "content-security-policy":
      "default-src 'self'; script-src 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  };
}
