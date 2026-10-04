# External Web Security Assessment Checklist

**Purpose**: Standing checklist for black-box / grey-box security assessments of an **external website or web application** — a target we do not own (client engagement, vendor review, bug-bounty scope). It covers what is observable or testable from outside the perimeter. Source-repository controls (CI/CD, dependencies, secret scanning, Dockerfiles) are out of scope here — use the [fleet security checklist](findings/security-checklist.md) for owned co-* projects.

**Usage**: For each item, record ✅ pass / ❌ fail / ➖ N/A plus the evidence pointer (request/response excerpt, screenshot, or tool output). Failures become findings with severity per the report template in `docs/reports/`. **Stay inside the authorized scope at all times** — a test outside scope is a finding against the assessor, not the target.

**Derived from**: the 2026-09 assessment.bizknights.org engagement (F-01…F-06, NF-01/NF-02), the fleet security checklist §4–§7, and OWASP WSTG v4.2 section mapping (stable identifiers cited per section).

> **Template note**: This is the template copy maintained in `templates/co-security`.
> Scaffolded projects receive it at `docs/external-web-security-checklist.md`. The
> evidence-backed sources live in the deployed co-security workspace — consult them
> there when a template-local path does not resolve:
> `docs/assessment-2026-09-bizknights.md` (prior engagement report),
> `docs/findings/2026-10-01-fleet-security-checklist.md` (fleet checklist, owned
> projects), `docs/findings/2026-10-01-fleet-security-countermeasure-catalog.md`
> (file:line exemplars). Refresh rule: engagement-driven changes land in the
> deployed workspace first, then this template copy in the same PR
> (spec 2026-10-04-co-security-checklist-backport-design).
---

## 0. Authorization & Rules of Engagement

- [ ] Written authorization signed by the target owner: in-scope hosts/IPs/ranges, permitted methods, test windows, and explicitly OUT-of-scope targets (third-party CDNs, SaaS embeds, adjacent hosts).
- [ ] Test accounts provisioned at each privilege level (low/high); rate-limit expectations and an emergency contact agreed in writing.
- [ ] Data-handling rules documented for any personal data encountered (no exfiltration beyond minimum needed to prove a finding; secure deletion at engagement close).
- [ ] Evidence log started on day one: every stored request carries URL, redacted headers, and timestamp so each finding is reproducible at retest.

## 1. Reconnaissance & Attack Surface (WSTG-INFO)

- [ ] DNS inventory (A/AAAA/CNAME/TXT/MX/NS) for in-scope hosts; enumerated subdomains cross-checked against scope; dangling CNAMEs checked for takeover (WSTG-INFO-02/05).
- [ ] Certificate-transparency SANs enumerated for forgotten hostnames — only in-scope names pursued (WSTG-INFO-01).
- [ ] Fingerprinting recorded: server/framework/CDN/WAF from headers and behavior; version banners captured (WSTG-INFO-02/04).
- [ ] Public-leak review: search engines and public code hosts for the target's domains — leaked keys, staging URLs, internal hostnames. Report only; do not exploit (WSTG-INFO-08).
- [ ] Client JS bundles analyzed: undocumented API endpoints, embedded API keys/secrets, internal hostnames, debug flags, source maps left deployed.

## 2. Transport & TLS (WSTG-CRYP)

- [ ] Certificate valid: chain complete, hostname matches, not expired/revoked (WSTG-CRYP-01/02).
- [ ] Weak protocols rejected: SSLv3/TLS1.0/1.1 refused; TLS1.2+ with modern ciphers (Mozilla "intermediate" as the bar).
- [ ] Every vhost redirects HTTP→HTTPS; rendered pages contain no mixed content.
- [ ] HSTS present: `strict-transport-security: max-age=31536000; includeSubDomains` (2026-09 F-01 — was missing, then fixed).
- [ ] `/.well-known/security.txt` returns 200 with RFC 9116 fields (2026-09 F-05).

## 3. HTTP Headers & Security Policy

- [ ] CSP present and reviewed — flag `unsafe-inline`/`unsafe-eval` and missing `default-src`/`frame-ancestors` (2026-09 F-04 pattern).
- [ ] `X-Content-Type-Options: nosniff`; frame protection via `frame-ancestors` (or X-Frame-Options); `Referrer-Policy` set.
- [ ] `Permissions-Policy` header present (2026-09 F-03).
- [ ] Every `Set-Cookie` carries `HttpOnly`, `Secure`, `SameSite`; `__Host-`/`__Secure-` prefixes on session cookies over HTTPS.
- [ ] Server/framework version banners suppressed where trivially reachable (information disclosure only — note, don't inflate severity).

## 4. Authentication (WSTG-ATHN)

- [ ] Login/registration/reset flows enumerated; responses and latency uniform for existing vs unknown accounts — no enumeration, no timing oracle (2026-09 F-02; positive control #2).
- [ ] Rate limiting on auth endpoints; lockout design NOT attacker-triggerable — prefer exponential backoff + `Retry-After` over hard per-account locks (2026-09 NF-01/NF-02).
- [ ] Password policy enforced server-side at registration AND at change (observable length/complexity bounds; max cap present — CP-6 pattern).
- [ ] Password reset: token ≥256-bit, single-use, short expiry; reset flow does not reveal account existence; reset-link host/URL cannot be confused across environments.
- [ ] MFA (if present): bypass candidates checked (remember-device, backup codes, OTP reuse window).
- [ ] SSO/OAuth (if present): `redirect_uri` validated exactly, `state`/`nonce` enforced, SSO auto-provisioning never lands as an approved/privileged account.

## 5. Session Management (WSTG-SESS)

- [ ] New session identifier issued at login (no fixation); identifier entropy ≥128 bits, non-sequential (WSTG-SESS-01/02).
- [ ] Logout invalidates the session server-side — the old cookie no longer authenticates (WSTG-SESS-06).
- [ ] Idle/absolute timeout enforced and matches stated policy; "remember me" scope explicit.
- [ ] Session cookies scoped minimally (`Domain`/`Path`); no session token in URLs.

## 6. Authorization & Access Control (WSTG-ATHZ)

- [ ] Horizontal (IDOR): with two test accounts, swap every enumerable object ID on read AND write APIs — one positive control minimum (2026-09 positive control #3).
- [ ] Vertical: low-privilege account probes admin routes/UI-hidden actions with direct API calls; client-side hiding is not authorization.
- [ ] Role matrix documented from observed behavior (what each tier can reach) and deviations listed as findings.
- [ ] Sequential/IDOR-prone identifiers noted for the remediation conversation even where no cross-account access was achieved.

## 7. Input Handling & Injection (WSTG-INPV)

- [ ] Reflected and stored XSS tested at every reflection point: query params, echoed headers, filenames, rich-text fields; CSP effectiveness noted per finding (WSTG-INPV-01/02).
- [ ] SQL/NoSQL injection signals on search, filter, sort, and login (error-based, boolean, time-based — in-scope-safe techniques only) (WSTG-INPV-05).
- [ ] Open redirect: every redirect parameter validated against an allowlist (WSTG-INPV-04).
- [ ] SSRF on any URL-fetching feature (webhooks, import-by-URL, avatar fetch): internal-address and scheme handling checked.
- [ ] File upload (if present): extension/content-type handling, storage exposure, content-type confusion, archive handling (WSTG-BUSL-09 pattern).
- [ ] Template/command injection signals on document/file-rendering features.

## 8. API Surface (WSTG-APIT)

- [ ] Undocumented endpoints (from JS bundles, mobile clients, archive.org) tested for authentication and authorization — they are often less hardened.
- [ ] Error responses generic: no stack traces, provider internals, or version leaks (fleet catalog C13 pattern).
- [ ] Mass assignment: create/update endpoints tested with extra fields (`role`, `status`, price-like fields) where a schema is inferable.
- [ ] GraphQL (if present): introspection exposure, field-level authorization, query depth/amount limits.

## 9. Perimeter & Misconfiguration (WSTG-CFG)

- [ ] Directory listing disabled; no backup/deploy artifacts reachable (`.git`, `.env`, `.bak`, dumps, editor temp files) (WSTG-CFG-04).
- [ ] No unauthenticated admin panels, default app pages, or framework consoles exposed.
- [ ] Stale hostnames/environments (staging, legacy, retired subdomains) still serving — takeover and stale-content risk recorded (WSTG-CFG-01…05).
- [ ] Email spoofing surface: SPF/DKIM/DMARC for the target's domains — phishing reachability reported as informational-to-medium per DMARC posture.

## 10. Business Logic & Abuse (WSTG-BUSL)

- [ ] Workflow steps cannot be skipped or replayed (pay-before-fulfilment, approval-before-action classes) (WSTG-BUSL-02…06).
- [ ] Negative/zero/overflow values on quantities, prices, and credits rejected server-side.
- [ ] Rate-limit-sensitive flows (signup, referral, coupon, voting) modeled for abuse within ROE — pattern proven at minimum scale, never run at volume.
- [ ] Race conditions on limited-quantity/redemption features tested only with explicit written permission.

## 11. Reporting & Retest

- [ ] Findings written per the report template in `docs/reports/`: severity, evidence (request/response), reproduction steps, remediation.
- [ ] Positive controls executed and recorded — they bound the false-negative rate of the whole assessment.
- [ ] Blocked/untested areas listed explicitly (credentials not provided, WAF interference, out-of-scope surfaces).
- [ ] Retest statuses tracked per finding: FIXED / STILL OPEN / Unchanged (bizknights 2026-09-05 retest format).

---

## Severity calibration

Use the fleet checklist's severity quick reference ([findings/security-checklist.md](findings/security-checklist.md) — bottom section) as the calibration table; external-engagement specifics so far: plaintext HTTP with session cookies = Medium (CP-5 class); email enumeration = Low (F-02); lockout abuse = Low (NF-01); missing security.txt = Info (F-05).

## Execution order

1. §0 first — no assessment starts without signed authorization.
2. §1–§3 (recon, TLS, headers) are fully non-invasive: run first, highest signal-to-risk ratio.
3. §4–§8 need the provisioned test accounts from §0.
4. §9–§10 only after passive confirmation; §11 closes the loop — convert every ❌ to a finding the same day it is confirmed.
