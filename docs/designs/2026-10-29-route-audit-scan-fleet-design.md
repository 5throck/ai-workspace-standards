# Route-Audit-Scan — Fleet-General Write-Route Audit Tripwire (T-20261029-005)

- **Status**: implemented
- **Date**: 2026-10-29
- **Owner**: automation-engineer (PM Gateway dispatch)
- **Ticket**: T-20261029-005 (kind: manual, Step 2f 2026-10-29 learning extraction)
- **Tier**: L0 workspace root + L1 (`templates/common/scripts/`, scripts domain)
- **Design provenance**: Projects/co-newbiz PR #742 (FR-SEC-07 — new route-audit
  scan, 226 write routes swept to 0 unaudited, 4 real audit gaps closed);
  source `Projects/co-newbiz/scripts/co-newbiz/route-audit-scan.ts` v1.0.0
  (ticket evidence lines 26-28, 49-60, 90-94).
- **Distinct from**: T-20261026-003 (#743 guards) and T-20261028-008
  (decision-write-integrity skill) — this is the code-level complement.

## 1. Problem

co-newbiz built a write-route audit tripwire for its own Next.js app (FR-SEC-07)
and swept 226 write routes to 0 unaudited. The mechanism is project-specific in
three ways, which is why it cannot simply be copied into the fleet tooling:

1. **Hardcoded audit-token vocabulary** — `appendAudit`, `audit`,
   `auditTokenUse`, `INTO audit_log` are co-newbiz names baked into a regex
   (source line 28). Another project's audit token would silently never match.
2. **Hardcoded scan root** — `app/web-next/app/api` (line 22).
3. **Sibling allowlist file** — `route-audit-allowlist.json` next to the script,
   keyed API-dir-relative.

The ticket asks for the same tripwire as L0 tooling, delivered L0+L1, with the
co-newbiz specifics parameterized, plus a graceful skip for projects with no
API surface. Wiring into `audit.ts`/`dev-sync.ts` is explicitly OUT of scope —
that is a deliberate follow-up once a host project adopts the config block.

## 2. What was implemented

New `scripts/route-audit-scan.ts` v1.0.0 (L0), propagated L0+L1 via the
`scripts` domain (`propagation-map.json`), registry rows in both
`scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md`, unit-pinned by
`tests/unit/route-audit-scan.test.ts` (25 cases).

### 2.1 Tripwire (co-newbiz logic, ported)

Every `route.ts` file under the target root's `app/` or `src/` directories that
exports `POST`/`PUT`/`PATCH`/`DELETE` (the `export async function POST(` or
`export const POST =` forms, line 26 of the source, verbatim shape) must reach
an audit-token match in its own file or in a local module reachable through
relative imports within `MAX_DEPTH = 3` hops (source lines 49-60 ported
exactly: cycle-safe `seen` set, `./`-`../` resolution over
`.ts`/`.tsx`/`index.ts`, the token test of the depth-0 file itself still
counts, and hop 4 is never followed). Token presence is a tripwire, not proof
every branch audits — the source's own caveat, kept in the header.

**Definition guard**: the source's `(?<!function\s)` lookbehind (a declaration
such as `function appendAudit(` must never count as a call site) is generalized
to arbitrary pattern lists: any match whose preceding text ends with
`function` + whitespace is skipped (`isDefinitionMatch`).

### 2.2 Config — ONE mechanism (the decision the ticket delegated)

**Chosen: the `docs/workspace-schema.json` `routeAudit` block**, following the
`platform_surfaces` / `designLint` block precedent (the designLint loader shape
at design-lint.ts:315-329 is mirrored: read under the target root, missing
block → safe defaults, present-but-malformed block → hard error). Shape:

```json
"routeAudit": {
  "auditTokenPatterns": ["\\bappendAudit\\s*\\(", "..."],   // regex sources
  "allowlist": { "app/api/x/route.ts": "reason >= 10 chars" },
  "sharedInfra": ["auth.ts"]                                 // optional
}
```

Why one mechanism and not the alternatives the ticket enumerated:

- *Script constant only* — cannot express a host's own token names; the
  co-newbiz names would silently under-scan every other project.
- *CLI flags* — a tripwire that only works when the caller remembers six flags
  is a tripwire nobody runs in CI.
- *Schema block* — the fleet already treats `docs/workspace-schema.json` as the
  per-project capability/config SSOT (two existing blocks establish the
  loading convention), so the pattern list travels with the project, is
  reviewable in the same PR that adds the routes, and needs zero invocation
  discipline.

Fallback rule: a missing block (or unreadable schema file) falls back to the
script's `DEFAULT_AUDIT_TOKEN_PATTERNS` constant, which carries the co-newbiz
defaults verbatim and is documented as such; a block that is present but
malformed (non-array patterns, non-string entries, non-object allowlist,
non-string reasons, unparseable regex) throws `RouteAuditConfigError` at load —
a malformed tripwire config must never silently degrade into defaults. A unit
test pins the schema block's patterns in lockstep with the script constant
(grep-level rot guard, the sync-agent-mirrors canonical-literal pattern).

### 2.3 Allowlist (co-newbiz semantics, verbatim)

Entries live in the same block (`routeAudit.allowlist`), keyed by
root-relative POSIX `route.ts` path (co-newbiz keyed API-dir-relative; the
generalized scan may discover `src/**` too, so the unambiguous base is the
project root). All three co-newbiz validations are kept (source lines 90-94):
a wildcard `*` in a key is rejected; a reason trimmed shorter than 10 chars is
rejected; a key that is not a discovered write route is rejected as stale.
Each violation fails the scan (exit 1).

### 2.4 No-API-surface skip (design-lint convention)

API-surface discovery walks `app/` and `src/` under the target root when they
exist (dot-dirs, `node_modules`, `dist`, `build`, `generated` never entered —
the design-lint walk convention). No `route.ts` anywhere is a **SKIP**: exit 0
with `route-audit-scan.ts: SKIP — no API surface under <root> (looked for
app/**/route.ts, src/**/route.ts)` — the design-lint "registry absence is a
SKIP, never an error; invoking the lint is itself the project opt-in" posture
(design-lint.ts `skipped()` verdict + exit-code rule "0 = every PASS or SKIP").
This is the generalized form of the ticket's cited precedent
(design-lint existsSync skip): no surface → nothing to trip over.

### 2.5 CLI

`bun scripts/route-audit-scan.ts [--dir <path>] [--json]` — default target root
is cwd; `--dir` overrides; exit 1 on any unaudited write route or allowlist
error; `--json` for machine-readable reports; offenders print as
`route.ts:<line>` anchored at the first write-method export. Error paths use
`die()` per ADR-0054. The summary line keeps the co-newbiz report shape
(`PASS — N write route(s), N unaudited, N allowlist error(s).`) and surfaces
which token source was effective (schema block vs co-newbiz defaults).

### 2.6 Shared-infrastructure exclusion

The source's `SHARED_INFRA` set (auth.ts, envelope.ts, client.ts,
access-control.ts — login-failure tokens in shared modules must not count as
route-level audit) becomes the optional `routeAudit.sharedInfra` config key,
default empty: a hardcoded co-newbiz file list would misfire on other
projects (any host's own `client.ts` would go silently unscanned), so the
mechanism is config-supplied where needed. Unit tests cover both directions
(infra tokens excluded; non-infra call sites still count).

## 3. Not in scope (deliberate)

- **No audit.ts / dev-sync wiring** — per the ticket scope note, recorded in
  the SCRIPTS.md row and the script header; wiring follows host adoption.
- **No variant.json override** — the designLint block later gained a
  per-variant override (U-20261028-014); routeAudit starts schema-only. If a
  variant ever needs per-project patterns, the designLint override is the
  established pattern to replicate — not a reason to invent a second mechanism
  now.

## 4. Validation

- `bun test tests/unit/route-audit-scan.test.ts` — 25 cases covering the
  ticket's required matrix (reach → pass; no-reach → fail naming file:line;
  GET-only ignored; depth-3 walk at each hop level + hop-4 exclusion +
  cycle safety; allowlist reason honored / wildcard rejected / stale rejected
  / short reason rejected; no-API-surface skip) plus config loading,
  declaration guard, sharedInfra, CLI exit codes, discovery exclusions, and
  the schema↔constant lockstep pin.
- `bun scripts/audit.ts`, `bun scripts/verify-scripts.ts --verify`.
- E2E against Projects/co-newbiz (read-only) and against a project with no API
  surface — recorded in the delivery PR body.
