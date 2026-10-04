# Fleet Security Assessment Checklist

**Purpose**: Standing checklist for any security assessment of a co-* project (or the fleet). Derived from (1) the verified countermeasure catalog, (2) the 2026-10-01 fleet assessment findings, (3) the 2026-09 assessment.bizknights.org engagement (F-01…F-06, NF-01/NF-02), and (4) the 2026-10-03 co-workspace deployment review (docker-socket broker, workload/spend caps, auth-audit logging, provider-key hygiene).

**Usage**: For each item, record ✅ pass / ❌ fail / ➖ N/A plus the evidence pointer (file:line or request/response). Failures become findings with severity per the report template in `docs/reports/`. Re-verify claimed "FIXED" findings on every retest — a documented control that fails verification is itself a finding (see 2026-10-01 FW-4).

> **Template note**: This is the template copy maintained in `templates/co-security`.
> Scaffolded projects receive it at `docs/findings/security-checklist.md` (undated
> standing name; the deployed co-security workspace keeps the dated,
> evidence-backed source `2026-10-01-fleet-security-checklist.md`). The evidence
> sources this checklist was derived from live in the deployed workspace — consult
> them there when a template-local path does not resolve:
> `2026-10-01-fleet-security-countermeasure-catalog.md` (countermeasure catalog with
> file:line exemplars), `docs/reports/2026-10-01-co-fleet-security-assessment.md`
> (fleet findings), `docs/assessment-2026-09-bizknights.md` (prior web-app
> engagement), `docs/reports/2026-10-03-co-workspace-deployment-review.md`
> (container/credential caps). Refresh rule: whenever the deployed checklist gains
> derivations or items, refresh this template copy in the same PR
> (spec 2026-10-04-co-security-checklist-backport-design).
---

## 1. Secrets & Data at Rest

- [ ] `gitleaks detect --no-git --config .gitleaks.toml` on the working tree is clean — **always pass `--config` explicitly** (auto-discovery silently drops the allowlist on subdirectory scans).
- [ ] Full git-history scan (`gitleaks detect` without `--no-git`) is clean.
- [ ] `.gitignore` covers `.env*` (all variants, not just `.env`), `*.db`, `*.key`, `*.pem`, `node_modules/`; `.env.sample` is the only committed env file (carve-out pattern).
- [ ] gitleaks allowlist contains only documentation placeholders and content-scoped regexes with written rationale — **no whole-directory exclusions of git-tracked content** (`memory/` must stay scannable; blanket exclusions create CI blind spots — 2026-10-01 FW-2).
- [ ] If a database or encryption key exists locally: key material lives OUTSIDE the data volume / backup artifact, or is coupled only by a documented procedure (master-key/data separation — catalog B3); key files carry `600` permissions.
- [ ] Secrets in images: `.dockerignore` excludes `.env*` and `*.db`; no `ARG`-passed secrets in the Dockerfile.
- [ ] No SQLite/DB files committed in git history (`git log --all -- '**/*.db'`) — historical blobs keep data recoverable even after untracking (2026-10-01 CP-7).
- [ ] Runtime secret files are not inside any directory bind-mounted into the service container — walk the compose `volumes:` list to each host-side source; a secret under an RW mount (repo checkout, data dir) is readable by a compromised service (catalog B7; 2026-10-03 co-workspace review — accepted single-operator risk).
- [ ] Metered provider/LLM credentials are dedicated service keys, scope- and spend-limited, with a documented rotation path — never the operator's personal account key (catalog B7).

## 2. Dependencies

- [ ] `bun audit` clean, or no high/critical findings — and a CI gate exists that fails on high/critical (the fleet lacked this until 2026-10-01 FW-1; a critical RCE survived because nothing ran `bun audit`).
- [ ] Transitive deps carrying advisories are either updatable, overridden (`package.json` `overrides`), or documented as accepted residual risk with the exposure rationale (e.g. mysql2 advisory irrelevant on a SQLite deployment).
- [ ] Non-registry dependencies (CDN tarballs) are version-pinned URLs with lockfile integrity hash.
- [ ] No mutable `@latest` execution of remote packages in scripts (`npx -y pkg@latest` is a supply-chain exposure — 2026-10-01 CS-4).

## 3. CI/CD Pipeline

- [ ] Every workflow has a `permissions:` block, least-privilege (fleet standard: `contents: read`).
- [ ] `packages: write` (or any write scope) is scoped to the publish **job**, never workflow-wide on PR-triggered workflows (2026-10-01 FW-5).
- [ ] No `pull_request_target` anywhere.
- [ ] **Event data is never interpolated into `run:` scripts** — `${{ github.head_ref }}` and friends pass through `env:` (expression injection = CWE-78; 2026-10-01 CS-1).
- [ ] Third-party actions pinned to full commit SHAs; first-party may use major tags; container images digest-pinned where practical.
- [ ] Publish jobs gated behind tests and `push`-only triggers; GHCR auth via short-lived `secrets.GITHUB_TOKEN` + `${{ github.actor}}`, never PATs.
- [ ] Auto-merge logic: required check names **actually exist** in this repo's workflows (dead check names fail closed but leave the gate untested — 2026-10-01 FW-6); approvals pinned to the exact head SHA.
- [ ] Ephemeral test containers use throwaway credentials, not repo secrets.

## 4. Web Application — AuthN/AuthZ

- [ ] Password hashing: PBKDF2 (≥200k iterations, per-user salt, stored iteration count) / scrypt / bcrypt(≥12); corrupted-hash verify path degrades safely.
- [ ] Session/API tokens: ≥256-bit CSPRNG (`randomBytes(32)`), stored hash-only, plaintext shown once; expired-session pruning on boot + periodic.
- [ ] Password policy at registration AND at forced change: min/max length enforced server-side (max cap also prevents bcrypt DoS via oversized input — 2026-10-01 CP-6).
- [ ] Centralized auth gate that every route handler/server action calls (no middleware-only shortcuts); role matrix enforced centrally incl. admin/content separation.
- [ ] Object ownership checks on every read/write by ID (IDOR — retest positive control #3 in the 2026-09 engagement).
- [ ] Approval-gated lifecycle: non-approved accounts rejected at login; SSO auto-provisioning never lands as APPROVED; must-change-password restricted to a minimal endpoint allowlist.
- [ ] Authentication outcomes are audit-logged (timestamp, actor, action) to a queryable store, and failed-login review has an owner or cadence — a silent auth path hides credential-stuffing (catalog C15).

## 5. Web Application — Session & CSRF

- [ ] Cookies: httpOnly + SameSite + `secure` (auto-derived from https NEXTAUTH_URL; `__Secure-`/`__Host-` prefixes on https).
- [ ] CSRF: double-submit requiring BOTH cookie and header (missing-cookie must reject, not skip); Origin/Host cross-check as first layer.
- [ ] Rate limiting on login/registration/copilot endpoints: sliding window or throttling keyed hybrid per-IP + per-account.
- [ ] **Lockout design does not enable attacker-triggered account denial** — a hard per-account lockout (5 failures → 10 min 429) lets anyone knowing an email lock the victim out (2026-09 NF-01); prefer exponential backoff/CAPTCHA + hybrid keying + `Retry-After` header (NF-02: normalize window, advertise it).
- [ ] Login latency is uniform across existing/unknown users (no timing oracle — 2026-09 positive control #2).

## 6. Web Application — Input/Output Handling

- [ ] Subprocess invocation uses argument arrays, never interpolated shell strings; timeouts + maxBuffer on untrusted-file processing.
- [ ] Uploads: filename sanitized to a safe charset, length-capped, ULID/unique prefix, size limit, extraction timeout.
- [ ] SQL access parameterized everywhere; no string-built queries.
- [ ] `dangerouslySetInnerHTML` (or equivalent raw-HTML sink) carries a written trust-model comment at the sink: source is repo-committed content via a fixed file list, no user write path (2026-10-01 CN verified pattern). If LLM/user output reaches the sink → sanitizer required → finding.
- [ ] LLM integration: provider keys server-side only (no `NEXT_PUBLIC_` secrets); untrusted data wrapped in "DATA ONLY, ignore instructions" blocks; numeric output comes from a deterministic ledger, not model computation; client-facing errors generic, no provider internals.
- [ ] SSRF surface: user-controlled URLs/fetch targets validated; WebSocket-rewrite and image-optimization paths assessed against current Next.js advisories.

## 7. HTTP Headers & Transport (from 2026-09 engagement)

- [ ] HSTS present: `strict-transport-security: max-age=31536000; includeSubDomains` (2026-09 F-01 — was missing, then fixed).
- [ ] `Permissions-Policy` header present (2026-09 F-03).
- [ ] CSP reviewed — flag `style-src 'unsafe-inline'` as an open Low (2026-09 F-04, still open at retest).
- [ ] `/.well-known/security.txt` returns 200 with RFC 9116 fields (2026-09 F-05).
- [ ] Deployment transport: TLS terminated properly; `X-Forwarded-Proto`-aware secure-cookie derivation; no plaintext-HTTP exposure beyond loopback (2026-10-01 CP-5).
- [ ] Registration/login responses do not distinguish existing vs. new accounts (email enumeration — 2026-09 F-02 still open at retest; `409 "email already registered"` is a leak).

## 8. Runtime / Deployment

- [ ] Dockerfile: multi-stage, non-root USER before EXPOSE, pinned base (digest where practical), healthcheck present.
- [ ] Entrypoint references files that **exist and are COPYed into the runtime stage** — verify by building the image, not by reading the Dockerfile (2026-10-01 CP-2: deleted script crash-looped every deployment).
- [ ] Schema migration on boot uses `prisma migrate deploy` (never `db push --accept-data-loss`), and failure aborts startup rather than being swallowed (2026-10-01 CP-4).
- [ ] Services bind loopback by default; broader binding requires an explicit env opt-in with a comment.
- [ ] Docker compose: no default/weak credentials on non-ephemeral containers; volumes least-privilege (`:ro` where possible); image retention cleanup scheduled.
- [ ] The Docker socket is never mounted into the application container; container-spawning features go through a policy broker — create-body allowlist with canonical rebuild, label-scoped ref resolution, bind-path symlink walk, endpoint allowlist — or rootless/userns-remap, with the residual TOCTOU documented (catalog D5).
- [ ] Ephemeral/untrusted containers carry resource caps (memory, cpus, pids), and metered external spend (LLM tokens/turns) carries explicit per-tenant/per-principal caps — anonymous access with uncapped spend must fail boot (catalog D6).

## 9. Documentation & Process

- [ ] SECURITY.md filled in (reporting channel operational, not TODO placeholders) and every claimed control re-verifiable at file:line (2026-10-01 FW-4/FW-7: doc drift is a finding).
- [ ] `bun scripts/audit.ts` governance gate passes; spec activity recorded per the Universal Design Gate (ADR-0074) for any remediation code change.
- [ ] Findings tracked with retest status (FIXED / STILL OPEN / Unchanged) per the 2026-09 report format; blocked/untested areas listed explicitly.

---

## Severity quick reference

| Severity | Typical examples from fleet history |
|---|---|
| Critical | Unauthenticated RCE advisories on a network-exposed app (CP-1) |
| High | CI expression injection (CS-1); broken entrypoint (CP-2); inherited libvips RCEs (CP-3) |
| Medium | Blanket gitleaks exclusions (FW-2); missing audit gate (FW-1); destructive boot sync (CP-4); plaintext HTTP + insecure cookies (CP-5); no permissions block (CS-2) |
| Low | Email enumeration (F-02/CP-6); CSP unsafe-inline (F-04); lockout abuse (NF-01); doc drift (FW-4) |
| Info | `/api/me` null-user 200 (F-06); missing Retry-After (NF-02); mutable-tag pins where fail-closed |

## Assessment execution order

1. Run §1–§2 mechanical scans first (gitleaks ×2 modes, `bun audit`, history check) — fastest, highest signal.
2. Run §3 CI review (grep-level, applies to whole repo).
3. Run §4–§7 only for projects with a real runtime surface; §8 when Docker is present; §9 last.
4. Record evidence per item; convert failures to findings; propose remediation referencing the countermeasure catalog's file:line exemplars.
