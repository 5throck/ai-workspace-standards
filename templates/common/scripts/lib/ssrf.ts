/**
 * SSRF Protection Library
 *
 * Provides URL validation and DNS resolution guard to prevent
 * Server-Side Request Forgery (SSRF) attacks, including
 * TOCTOU (Time-of-Check-Time-of-Use) DNS rebinding protection.
 *
 * Attack vector: An attacker registers a domain that resolves to a
 * private IP (10.x, 172.16-31.x, 192.168.x, 127.x) on first DNS query
 * (passing validation), then re-resolves to the internal service on the
 * actual HTTP request. This library prevents this by:
 *
 * 1. Pre-resolving DNS and validating the IP before making requests
 * 2. Connecting to the resolved IP directly (bypassing second DNS lookup)
 * 3. Validating TLS certificates match the original hostname
 *
 * IMPORTANT: validateUrl() alone does NOT close the TOCTOU window — it only
 * tells you whether a hostname's *current* resolution is safe. If a caller
 * validates, then separately calls the global fetch(url), fetch() performs
 * its own independent DNS lookup, which can legitimately return a different
 * (attacker-controlled) address for a rebinding domain. Use safeFetch() (or
 * fetchPinned() directly) to actually eliminate the second lookup — Bun/Node's
 * global fetch() does not support a custom DNS resolver, so the pinned
 * connection is made via http.request()/https.request()'s `lookup` option
 * instead (verified empirically: fetch()'s `dns` init option is silently
 * ignored, while http(s).request()'s `lookup` option is honored).
 *
 * @version 1.2.0
 * v1.2.0 (2026-11-27, spec docs/designs/2026-11-27-safefetch-headers-design.md,
 *          U-20261127-003): structured header passthrough — safeFetch()/fetchPinned()
 *          gain optional `init.headers?: Record<string, string>` routed through
 *          http(s).request()'s structured `headers` option object (never string
 *          concatenation). Case-insensitive deny-list rejects destination/protocol
 *          control headers (exact: host, content-length, transfer-encoding,
 *          connection, upgrade, te, trailer, expect, via; prefix: proxy-*, forward*)
 *          with a typed SSRFHeaderBlockedError naming the offending header;
 *          defense-in-depth regex rejects CR/LF/control chars in header names and
 *          values before the runtime check (Node/Bun reject invalid header chars
 *          with ERR_INVALID_CHAR — that runtime line is retained beneath ours).
 *          Header validation runs before validateUrl(): a denied header fails with
 *          zero DNS/network activity. Headers NEVER influence destination
 *          resolution; the SSRF guard core (destination pinning, CIDR checks,
 *          redirect refusal, SNI/Host pinning) is byte-for-byte unchanged, and
 *          behaviour with init.headers absent is identical to v1.1.1.
 * v1.1.1 (2026-10-31, spec docs/designs/2026-10-31-template-security-hardening-design.md
 *          R2.3, U-20261031-003): BLOCKED_CIDRS corrections — current-network ends at
 *          0x00ffffffn (0.0.0.0/8, was 0x0fffffffn) and private-10 ends at 0x0affffffn
 *          (10.0.0.0/8, was 0x0fffffffn); the old ends over-blocked public 1.x–15.x
 *          addresses (8.8.8.8 was refused as "current-network"). Strictly widens
 *          availability for public IPs; private/loopback/metadata coverage unchanged.
 *          isBlockedIp exported for pin tests.
 * @security Production hardening — TOCTOU DNS rebinding mitigation
 */

import * as dns from "node:dns";
import * as net from "node:net";
import * as URL from "node:url";
import * as http from "node:http";
import * as https from "node:https";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Blocked IP ranges (private, loopback, link-local, metadata endpoints) */
const BLOCKED_CIDRS: ReadonlyArray<{ start: bigint; end: bigint; reason: string }> = [
  // Loopback (127.0.0.0/8)
  { start: 0x7f000000n, end: 0x7fffffffn, reason: "loopback" },
  // Current network (0.0.0.0/8)
  // U-20261031-003: end corrected 0x0fffffffn → 0x00ffffffn — the old value
  // spanned 0.0.0.0–15.255.255.255, blocking public 1.x–15.x addresses
  // (e.g. 8.8.8.8) as fail-open "availability" collateral.
  { start: 0x00000000n, end: 0x00ffffffn, reason: "current-network" },
  // Private (10.0.0.0/8)
  // U-20261031-003: end corrected 0x0fffffffn → 0x0affffffn — the old value
  // spanned 10.0.0.0–15.255.255.255, blocking public 11.x–15.x addresses.
  { start: 0x0a000000n, end: 0x0affffffn, reason: "private-10" },
  // Private (172.16.0.0/12)
  { start: 0xac100000n, end: 0xac1fffffn, reason: "private-172" },
  // Private (192.168.0.0/16)
  { start: 0xc0a80000n, end: 0xc0a8ffffn, reason: "private-192" },
  // Link-local (169.254.0.0/16) — AWS/GCP metadata endpoints
  { start: 0xa9fe0000n, end: 0xa9feffffn, reason: "link-local-metadata" },
  // Carrier-grade NAT / shared address space (100.64.0.0/10)
  { start: 0x64400000n, end: 0x647fffffn, reason: "carrier-grade-nat" },
  // Network benchmarking (198.18.0.0/15)
  { start: 0xc6120000n, end: 0xc613ffffn, reason: "network-benchmarking" },
  // Multicast (224.0.0.0/4)
  { start: 0xe0000000n, end: 0xefffffffn, reason: "multicast" },
  // Reserved (240.0.0.0/4)
  { start: 0xf0000000n, end: 0xffffffffn, reason: "reserved" },
  // IPv4-mapped IPv6 loopback (::ffff:127.0.0.0/104)
  { start: 0xffff7f000000n, end: 0xffff7fffffffn, reason: "ipv6-mapped-loopback" },
];

// ============================================================================
// HEADER PASSTHROUGH POLICY (v1.2.0, spec
// docs/designs/2026-11-27-safefetch-headers-design.md)
// ============================================================================

/**
 * Case-insensitive deny-list for caller-supplied headers (U-20261127-003).
 *
 * Exact matches — headers that alter destination, framing, or hop-by-hop
 * connection semantics the SSRF guard owns:
 * - `host`           : the validated hostname must stay the Host header and
 *                      (https) the TLS SNI — the module's pin contract
 *                      (see fetchPinned doc comment). A caller-supplied Host
 *                      would rename the virtual host at the pinned target.
 * - `content-length`, `transfer-encoding`, `te`, `trailer`
 *                    : request-framing control (smuggling primitives; the
 *                      library sends no body — framing is never caller-owned).
 * - `connection`, `upgrade`, `expect`
 *                    : hop-by-hop connection semantics / protocol upgrade /
 *                      100-continue interaction.
 * - `via`            : proxy-chain description header.
 *
 * Prefix matches (case-insensitive):
 * - `proxy-`         : proxy-authorization, proxy-connection, … hop-by-hop
 *                      proxy control and proxy credentials.
 * - `forward`        : forwarded, forward-*, … proxy-chain injection.
 */
const DENIED_HEADER_EXACT: ReadonlySet<string> = new Set([
  "host",
  "content-length",
  "transfer-encoding",
  "connection",
  "upgrade",
  "te",
  "trailer",
  "expect",
  "via",
]);
const DENIED_HEADER_PREFIXES: ReadonlyArray<string> = ["proxy-", "forward"];

/**
 * Defense-in-depth: CR/LF and all other control characters are rejected in
 * header names and values before the runtime check. Node/Bun already reject
 * invalid header characters with ERR_INVALID_CHAR — this regex guarantees the
 * property holds even if a future runtime relaxes validation, and covers
 * header names that would otherwise smuggle a newline past the deny-list.
 */
const FORBIDDEN_HEADER_CHARS = /[\u0000-\u001f\u007f]/;

// ============================================================================
// TYPES
// ============================================================================

export interface SSRFValidationResult {
  /** Whether the URL is safe to fetch */
  allowed: boolean;
  /** Human-readable reason if blocked */
  reason?: string;
  /** Pre-resolved IP addresses (for direct connection) */
  resolvedAddresses?: string[];
  /** Original hostname */
  hostname: string;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validate a URL for SSRF safety with TOCTOU DNS rebinding protection.
 *
 * Resolves DNS, validates all resulting IPs against blocked ranges,
 * and returns the resolved addresses for direct connection (preventing
 * a second DNS lookup that could return a different IP).
 *
 * @param targetUrl - The URL to validate
 * @returns SSRFValidationResult with allowed/denied status and resolved IPs
 */
export async function validateUrl(targetUrl: string): Promise<SSRFValidationResult> {
  let parsed: URL.URL;
  try {
    parsed = new URL.URL(targetUrl);
  } catch {
    return { allowed: false, reason: "invalid-url", hostname: targetUrl };
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { allowed: false, reason: `unsupported-protocol: ${parsed.protocol}`, hostname: parsed.hostname };
  }

  const hostname = parsed.hostname;

  // Reject numeric IPs in hostname (direct IP access)
  if (net.isIPv4(hostname) || net.isIPv6(hostname)) {
    const blocked = isBlockedIp(hostname);
    if (blocked) {
      return { allowed: false, reason: `blocked-ip: ${blocked}`, hostname };
    }
    return { allowed: true, resolvedAddresses: [hostname], hostname };
  }

  // DNS resolution with lookup (respects /etc/hosts and system DNS)
  let addresses: string[];
  try {
    addresses = await dns.promises.lookup(hostname, { all: true }).then((result) => result.map((r) => r.address));
  } catch {
    return { allowed: false, reason: "dns-resolution-failed", hostname };
  }

  if (addresses.length === 0) {
    return { allowed: false, reason: "no-dns-records", hostname };
  }

  // Validate every resolved address
  for (const addr of addresses) {
    const blocked = isBlockedIp(addr);
    if (blocked) {
      return { allowed: false, reason: `blocked-ip-via-dns: ${hostname} -> ${addr} (${blocked})`, hostname };
    }
  }

  return { allowed: true, resolvedAddresses: addresses, hostname };
}

/** Thrown by safeFetch() when validateUrl() rejects the target. */
export class SSRFBlockedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly hostname: string,
  ) {
    super(`SSRF check blocked ${hostname}: ${reason}`);
    this.name = "SSRFBlockedError";
  }
}

/**
 * Thrown by safeFetch()/fetchPinned() when a caller-supplied header is
 * rejected by the passthrough policy (U-20261127-003): a deny-list match, or
 * a control character in the name/value. Always names the offending header.
 */
export class SSRFHeaderBlockedError extends Error {
  constructor(
    public readonly header: string,
    public readonly reason: "denied-header" | "invalid-header-name" | "invalid-header-value",
  ) {
    super(`SSRF header policy rejected "${header}": ${reason}`);
    this.name = "SSRFHeaderBlockedError";
  }
}

/**
 * Optional init for safeFetch()/fetchPinned().
 * - `signal`: abort handle (unchanged since v1.1.1).
 * - `headers`: optional caller headers (v1.2.0) — routed through
 *   http(s).request()'s structured `headers` option after deny-list and
 *   control-character validation. Never influences destination resolution.
 */
export interface SafeFetchInit {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * Validate a caller-supplied header map against the passthrough policy and
 * return it unchanged when clean. Deny-list matches and control characters in
 * names/values throw SSRFHeaderBlockedError naming the offending header.
 */
function resolveSafeHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined;
  const entries = Object.entries(headers);
  if (entries.length === 0) return undefined;
  for (const [name, value] of entries) {
    const lower = name.toLowerCase();
    if (DENIED_HEADER_EXACT.has(lower) || DENIED_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
      throw new SSRFHeaderBlockedError(name, "denied-header");
    }
    if (FORBIDDEN_HEADER_CHARS.test(name)) {
      throw new SSRFHeaderBlockedError(name, "invalid-header-name");
    }
    if (FORBIDDEN_HEADER_CHARS.test(value)) {
      throw new SSRFHeaderBlockedError(name, "invalid-header-value");
    }
  }
  return headers;
}

/**
 * Connects directly to one of `pinnedAddresses` — never re-resolves
 * `targetUrl`'s hostname — using http(s).request()'s `lookup` override. The
 * original hostname is still used for the Host header and (on https) the
 * TLS SNI/certificate hostname, so only the socket-level DNS step is pinned.
 *
 * Does not follow redirects (rejects instead) — matching the `redirect:
 * 'error'` behavior the previous fetch()-based call sites relied on.
 *
 * Optional `init.headers` (v1.2.0, U-20261127-003) are passed to
 * http(s).request()'s structured `headers` option — never string
 * concatenation — after deny-list and control-character validation
 * (resolveSafeHeaders). The validated hostname keeps being sent as the Host
 * header and the TLS SNI regardless of the header set: headers never
 * influence destination resolution or connection semantics. Absent
 * `init.headers` means the `headers` option is not set at all (v1.1.1
 * behaviour, byte-identical).
 *
 * @param portOverride - Test-only seam: connect to this port instead of the
 *   URL's own port, while keeping the original hostname for Host/SNI. Lets
 *   tests point a fake, non-resolvable hostname at a real local test server.
 * @throws {SSRFHeaderBlockedError} if init.headers contains a denied header
 *   or a control character in a name/value.
 */
export async function fetchPinned(
  targetUrl: string,
  pinnedAddresses: string[],
  portOverride?: number,
  init: SafeFetchInit = {},
): Promise<Response> {
  const parsed = new URL.URL(targetUrl);
  const isHttps = parsed.protocol === "https:";
  const requestFn = isHttps ? https.request : http.request;
  const safeHeaders = resolveSafeHeaders(init.headers);

  const lookup: net.LookupFunction = (_hostname, options, callback) => {
    const results = pinnedAddresses.map((address) => ({
      address,
      family: net.isIPv6(address) ? 6 : 4,
    }));
    if ((options as dns.LookupOneOptions)?.all) {
      callback(null, results);
    } else {
      callback(null, results[0].address, results[0].family);
    }
  };

  return new Promise<Response>((resolve, reject) => {
    const req = requestFn(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: portOverride ?? (parsed.port || (isHttps ? 443 : 80)),
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        lookup,
        // v1.2.0: caller headers via the structured `headers` option — only
        // when supplied, so absent-init behaviour stays byte-identical to
        // v1.1.1. The Host option (from `hostname` above) is never overridden.
        ...(safeHeaders ? { headers: safeHeaders } : {}),
        // TLS: keep servername/cert validation pinned to the original hostname.
        ...(isHttps ? { servername: parsed.hostname } : {}),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          reject(
            new Error(
              `fetchPinned: refusing to follow redirect (status ${status}, location: ${res.headers.location ?? "unknown"})`,
            ),
          );
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const headers = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value === undefined) continue;
            headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
          }
          resolve(
            new Response(Buffer.concat(chunks), {
              status,
              statusText: res.statusMessage ?? "",
              headers,
            }),
          );
        });
        res.on("error", reject);
      },
    );

    req.on("error", reject);
    if (init.signal) {
      if (init.signal.aborted) {
        req.destroy();
        reject(new DOMException("Aborted", "AbortError"));
      } else {
        init.signal.addEventListener(
          "abort",
          () => {
            req.destroy();
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      }
    }
    req.end();
  });
}

/**
 * Validates `targetUrl` via validateUrl() and, if allowed, fetches it with
 * the DNS resolution pinned to the addresses that were just validated —
 * closing the TOCTOU window that a bare `validateUrl()` + `fetch()` pair
 * leaves open (see module doc comment).
 *
 * Optional `init.headers` (v1.2.0, U-20261127-003) let callers send auth /
 * user-agent / custom application headers through the guarded path. They are
 * validated (case-insensitive deny-list + control-character regex, throwing
 * SSRFHeaderBlockedError naming the offending header) BEFORE validateUrl() —
 * a rejected header costs zero DNS or network activity — then routed through
 * http(s).request()'s structured `headers` option. Headers never influence
 * destination resolution; with `init.headers` absent, behaviour is identical
 * to v1.1.1. The method stays GET in v1 (spec section 1).
 *
 * @throws {SSRFHeaderBlockedError} if init.headers violates the header policy.
 * @throws {SSRFBlockedError} if validateUrl() rejects the target.
 */
export async function safeFetch(targetUrl: string, init: SafeFetchInit = {}): Promise<Response> {
  resolveSafeHeaders(init.headers); // fail fast, before any DNS/network
  const check = await validateUrl(targetUrl);
  if (!check.allowed) {
    throw new SSRFBlockedError(check.reason ?? "blocked", check.hostname);
  }
  return fetchPinned(targetUrl, check.resolvedAddresses!, undefined, init);
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Check if an IP address falls within any blocked CIDR range.
 * @returns The reason string if blocked, or null if allowed.
 */
export function isBlockedIp(ip: string): string | null {
  let ipNum: bigint;

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    ipNum = (BigInt(parts[0]) << 24n) | (BigInt(parts[1]) << 16n) | (BigInt(parts[2]) << 8n) | BigInt(parts[3]);
  } else if (net.isIPv6(ip)) {
    // Check for IPv4-mapped IPv6 (::ffff:x.x.x.x)
    const v4Match = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4Match) {
      return isBlockedIp(v4Match[1]);
    }
    // Full IPv6 blocked range checks
    const ipv6Num = ipv6ToBigInt(ip);
    const BLOCKED_IPV6_CIDRS: ReadonlyArray<{ start: bigint; end: bigint; reason: string }> = [
      // Loopback (::1/128)
      { start: 1n, end: 1n, reason: "ipv6-loopback" },
      // Unique local (fc00::/7)
      { start: 0xfc00000000000000n, end: 0xfdffffffffffffffn, reason: "ipv6-unique-local" },
      // Link-local (fe80::/10)
      { start: 0xfe80000000000000n, end: 0xfebfffffffffffffn, reason: "ipv6-link-local" },
      // IPv4-mapped (::ffff:0:0/96)
      { start: 0xffff000000000000n, end: 0xffffffffffffffffn, reason: "ipv6-mapped" },
      // Multicast (ff00::/8)
      { start: 0xff00000000000000n, end: 0xffffffffffffffffn, reason: "ipv6-multicast" },
    ];
    for (const range of BLOCKED_IPV6_CIDRS) {
      if (ipv6Num >= range.start && ipv6Num <= range.end) {
        return range.reason;
      }
    }
    return null;
  } else {
    return "invalid-ip-format";
  }

  for (const range of BLOCKED_CIDRS) {
    if (ipNum >= range.start && ipNum <= range.end) {
      return range.reason;
    }
  }

  return null;
}

/**
 * Convert an IPv6 address string to a 128-bit bigint for CIDR comparison.
 */
function ipv6ToBigInt(ip: string): bigint {
  const groups = ip.split(":");
  let expanded: number[] = [];

  // Handle :: expansion
  const doubleColonIdx = groups.indexOf("");
  if (doubleColonIdx !== -1) {
    const before = groups.slice(0, doubleColonIdx).map((g) => parseInt(g, 16) || 0);
    const after = groups.slice(doubleColonIdx + 1).map((g) => parseInt(g, 16) || 0);
    const missing = 8 - before.length - after.length;
    expanded = [...before, ...new Array(missing).fill(0), ...after];
  } else {
    expanded = groups.map((g) => parseInt(g, 16) || 0);
  }

  let result = 0n;
  for (const group of expanded) {
    result = (result << 16n) | BigInt(group);
  }
  return result;
}
