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

/** The single-file app ships without versioned asset URLs — `no-cache` forces revalidation
 * on every load, otherwise browsers heuristically cache the page across redeploys and run
 * stale code for days (the "nothing changed" report of 2026-09-27/28). */
export function htmlHeaders(): Record<string, string> {
  return { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" };
}
