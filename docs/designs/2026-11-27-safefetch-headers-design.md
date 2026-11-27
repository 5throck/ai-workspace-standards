# Design: safeFetch structured headers passthrough (U-20261127-003)

- **Spec ID**: 2026-11-27-safefetch-headers
- **Status**: approved
- **Date**: 2026-11-27
- **Owner**: automation-engineer
- **Source**: upstream request U-20261127-003 (co-newbiz DART adapter), triage `docs/reports/2026-11-27-conewbiz-upstream-triage.md` (ACCEPT-FEATURE, size S)
- **Scope**: `scripts/lib/ssrf.ts` + twin `templates/common/scripts/lib/ssrf.ts` (byte-identical) + `tests/unit/ssrf-safe-fetch.test.ts`

## 1. Problem

`safeFetch(targetUrl, { signal })` exposes no way for callers to send request
headers. Any variant calling an authenticated external API (co-newbiz DART
corpCode needs UA/auth headers) must either bypass the SSRF guard with a bare
`fetch()` or patch the delivered library — both are policy failures. The
request method is hardcoded `"GET"`; this design intentionally keeps GET in v1
(triage §U-003: DART corpCode is GET; method/body is a separate future spec if
a real consumer appears).

## 2. Threat analysis — what caller-controlled headers could break

Caller-supplied header names/values are untrusted configuration surface even
though the caller here is local, reviewed code. Five threat classes:

1. **Host/SNI pin contract break** (`scripts/lib/ssrf.ts:167-171`, fetchPinned
   doc comment): the module's documented invariant is that the *validated
   hostname* stays the Host header and the TLS SNI/certificate hostname while
   only the socket-level DNS step is pinned. A caller-supplied `host` header
   would override (Node replaces, never duplicates, when `headers.host` is
   set) the validated Host — the request would name a different virtual host
   at the pinned destination, re-opening host-based confusion (cache poisoning
   against shared frontends, vhost routing bypass) with the SSRF guard's
   blessing. `host` must be denied.
2. **Request smuggling** (`content-length`, `transfer-encoding`): contradictory
   or duplicate framing headers (CL.TE / TE.CL differentials) are the classic
   smuggling primitive against any intermediary. The library controls neither
   body nor framing (GET, no body) — a caller must never influence framing.
   `content-length`, `transfer-encoding` denied; `te` (token used by
   `Transfer-Encoding`/trailers negotiation in RFC 7230 hop-by-hop semantics)
   and `trailer` denied with it.
3. **Connection/upgrade semantics** (`connection`, `upgrade`): these govern
   hop-by-hop connection behaviour and protocol upgrade (WebSocket,
   `Connection: Upgrade` + `Upgrade: h2c` cleartext upgrade). Letting a caller
   flip connection semantics inside a pinned socket can change which parser
   and which protocol state machine reads the response — outside the guard's
   threat model. Both denied. `expect` (100-continue interaction) denied with
   them.
4. **Proxy interference** (`proxy-*`, `via`, `forward*`): `proxy-authorization`,
   `proxy-connection` are hop-by-hop proxy control headers; `via` and
   `forwarded`/`forward-*` describe the proxy chain. Injecting them makes the
   guarded request impersonate or manipulate proxy topology (and can leak
   proxy credentials through chains that were never supposed to see them).
   Prefix-denied, case-insensitive: `proxy-*`, `forward*`, and exact `via`.
5. **CRLF / control-character injection**: a header name or value containing
   CR/LF lets a caller inject arbitrary raw request lines (smuggling header
   split); other control chars (U+0000–U+001F, U+007F) are either invalid or
   exploitable in lenient parsers. Defended in depth (Section 3).

## 3. Chosen mechanism

Three layers, all additive; the SSRF guard core (destination pinning, CIDR
checks, redirect refusal, SNI/Host pinning) is untouched — **headers never
influence destination resolution** (`validateUrl()` and the pinned `lookup`
never read `init.headers`).

1. **Structured parameter**: `safeFetch`/`fetchPinned` gain an optional
   `init.headers?: Record<string, string>`. Headers are passed to
   `http(s).request` via its structured `headers` *option object* — never
   string concatenation into the raw request. The runtime already rejects
   invalid characters in header names/values with `ERR_INVALID_CHAR`
   (Node `http` validates per RFC 7230: values must not contain CR/LF except
   as trailing OWS, and `Invalid character in header content` is thrown;
   Bun's `http` compat layer performs the same validation). We do not rely on
   the runtime as the only line of defense.
2. **Case-insensitive deny-list** (superset from the triage security
   assessment; the dispatch's 8 core entries plus the triage's
   `trailer`/`via`/`forward*`):
   - exact: `host`, `content-length`, `transfer-encoding`, `connection`,
     `upgrade`, `te`, `trailer`, `expect`, `via`
   - prefix: `proxy-` (proxy-authorization, proxy-connection, …),
     `forward` (forwarded, forward-*, …)
   - Match on `name.toLowerCase()`; violation throws the typed
     `SSRFHeaderBlockedError` carrying `header` (the offending name as
     supplied) and `reason` (`denied-header` | `invalid-header-name` |
     `invalid-header-value`). Header validation runs **before**
     `validateUrl()` in `safeFetch` — a bad header fails fast with zero DNS
     or network activity.
3. **Defense-in-depth value/name regex**: before the runtime ever sees the
   pair, reject any name or value containing `[\u0000-\u001f\u007f]`
   (CR/LF/control) with the same typed error. This holds even if a future
   runtime relaxes validation, and it covers names too (the deny-list cannot
   match a name it cannot see past an injected newline).

## 4. Explicitly allowed

`authorization`, `user-agent`, `x-api-key`, `cookie`, `accept`,
`accept-language`, `content-type` and any other application-level header not
on the deny-list and free of control characters. These are the legitimate
payload of the feature (auth/UA/custom application headers for authenticated
external APIs). The deny-list is closed under case variants; every non-denied,
control-char-free header passes through verbatim.

## 5. Behaviour preservation

- When `init.headers` is absent (or empty), the `headers` request option is
  not set at all — request bytes identical to v1.1.1 for every existing
  caller (`scripts/audit.ts:613`, `scripts/ingest-security-frameworks.ts:54`,
  `scripts/ingest-external-skills.ts:55,97`, all pass `{ signal }` only).
- Destination resolution, CIDR blocking, redirect refusal, SNI/Host pinning:
  byte-for-byte unchanged (hard rule: deny-list additions and the structured
  headers option are the ONLY permitted changes).
- Twin `templates/common/scripts/lib/ssrf.ts` kept byte-identical.

## 6. Test plan (pins)

Deny-list: every exact entry + both prefixes (`proxy-authorization`,
`forwarded`) rejected with `SSRFHeaderBlockedError` naming the header;
case-insensitivity (`HOST`, `hOsT`, `Content-Length`, `Proxy-Authorization`);
CRLF in value rejected; NUL/control char in value rejected; CRLF in name
rejected; allowed auth/UA/custom headers observed verbatim by a local test
server (via the `portOverride` seam, per the existing test pattern — loopback
is CIDR-blocked so `safeFetch` itself cannot target it) with Host still the
URL's hostname; unchanged behaviour when `init.headers` absent/`{signal}`-only
(no `authorization` reaches the server, request succeeds).

## 7. Versioning

`ssrf.ts` 1.1.1 → 1.2.0 (new public API surface, minor bump); registry row
`scripts/SCRIPTS.md` L0+L1 updated; test file @version 1.0.0 → 1.1.0.
