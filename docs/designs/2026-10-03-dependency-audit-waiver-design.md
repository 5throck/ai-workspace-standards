# Dependency-Audit Advisory-Waiver Channel — Design

- **Date**: 2026-10-03
- **Status**: implemented
- **Spec id**: `2026-10-03-dependency-audit-waiver-design`
- **Ticket**: T-20261003-011 (high)
- **Owner**: security-expert scope, implemented by automation-engineer dispatch
- **Related**: `.github/gitleaks-full.toml` (reviewed-exception precedent), `.github/workflows/test.yml` (L0 gate threshold), `templates/common/.github/workflows/ci.yml` (fleet CI), `scripts/dependency-audit.ts`, T-20261003-028c (fold-in scope note at the end)

## R1 — Problem

Every co-price CI run fails on `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm, high,
stack-exhaustion DoS). The vulnerable chain is dev-only tooling:
`eslint-config-next > @next/eslint-plugin-next > fast-glob > micromatch > braces`.
No patched `braces` release exists (3.0.3 is the latest), and no
`eslint-config-next` version drops the chain, so the finding is unfixable
upstream today. The fleet CI gate (`dependency-audit` job) fails on any
high/critical finding with no exception mechanism, so:

- Every future co-price CI run stays red.
- The co-price upgrade PR (#138) is blocked behind a finding nobody can fix.

A gate that cannot express "reviewed, accepted, revisit-later" forces either a
permanently red branch-protection check or a lowered threshold for everyone.
Both are worse than a narrow, auditable exception channel.

## R2 — Decision

Add a **reviewed advisory-waiver file** to the dependency-audit gate, following
the gitleaks-allowlist precedent (path-scoped entries, mandatory rationale,
review/verification notes). Fleet disposition: the channel ships in the L1
template, so every project receives it on the next template sync.

1. New script `scripts/dependency-audit.ts` (L0) mirrored byte-identical to
   `templates/common/scripts/dependency-audit.ts` (L1; standard
   `domains/scripts` propagation delivers it to scaffolded projects). It runs
   `bun audit --json` and evaluates the gate from machine-readable findings
   instead of grepping the human summary line.
2. The CI job's inline `bun audit` block in
   `templates/common/.github/workflows/ci.yml` is replaced by
   `bun scripts/dependency-audit.ts`. Gate semantics are unchanged:
   fail on any high/critical finding, report low/moderate, treat empty or
   unparseable audit output as a loud infrastructure failure.
3. A project opts into a waiver by committing
   `.github/dependency-waivers.toml` (per project, not fleet-global).
4. co-price receives the first waiver: braces@3.0.3 / GHSA-vfj7-8cjw-p6xm,
   scope dev-only, revisit-by 2027-01-03.

The gate without a waiver file behaves exactly like the old gate — the channel
is opt-in per project and the default stays fail-closed.

## R3 — Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| Wait for an upstream fix (request braces release / eslint-config-next chain change) | No patched braces exists and no eslint-config-next bump drops the chain; the gate stays red for an unbounded time. A date-bounded waiver with a revisit-by is the honest interim state, and the stale-waiver guard converts an upstream fix into an automatic review trigger. |
| Lower the fleet threshold (fail on critical only) | Weakens every project to unblock one dev-only finding; the fleet assessment (FW-1) set high/critical deliberately. |
| `bun audit --ignore` / `audit overlook` flags in CI | The suppression would live inside a command line in `ci.yml`, with no schema, no rationale, no expiry, and no stale-detection — a silent ignore-all, exactly what this design must not become. |
| Override-with-resolution in package.json (`resolutions`/`overrides` pin) | braces 3.0.3 is already the latest; pinning a version that does not exist is impossible, and faking the tree breaks honest installs. |
| Keep grep-based parsing, add a waiver grep in bash | Bash TOML parsing is fragile and untestable; the JSON path also removes the old coupling to bun's human-readable summary format. |

## R4 — Waiver Schema (`.github/dependency-waivers.toml`)

Only `[[waiver]]` array-of-tables entries are allowed; any other top-level key
is a hard failure (strict schema, no silent extension surface).

```toml
[[waiver]]
advisory   = "GHSA-vfj7-8cjw-p6xm"  # GitHub Security Advisory id (required)
package    = "braces"               # affected npm package name (required)
version    = "3.0.3"                # exact installed semver pin (required)
scope      = "dev-only"             # dev-only | production (required)
reason     = "no upstream fix; ..." # non-empty rationale (required)
decided_by = "T-20261003-011"       # review note / deciding ticket (required)
revisit_by = "2027-01-03"           # mandatory revisit date (required)
```

Validation is strict and fail-closed:

- Malformed TOML → FAIL.
- Unknown top-level key or unknown per-entry key → FAIL.
- Missing or empty required field → FAIL.
- `advisory` must match `GHSA(-[0-9a-z]{4}){3,4}` (case-insensitive input,
  normalized to upper case) → otherwise FAIL.
- `version` must be an exact semver pin (`x.y.z[-prerelease]`) → otherwise FAIL.
- `scope` must be `dev-only` or `production` → otherwise FAIL.
- `revisit_by` must be a real calendar date in `YYYY-MM-DD` → otherwise FAIL.
- Duplicate `advisory|package` pairs → FAIL (one decision per finding).

## R5 — Fail-Closed Rules

A waiver channel must never decay into a silent ignore-all. The gate fails
(run exit 1) when:

1. **Infrastructure**: `bun audit --json` produced no stdout, or the output is
   not parseable JSON. (Preserved from the old gate's empty-output rule.)
2. **Waiver file defects**: any R4 violation.
3. **Expired waiver**: `revisit_by < today (UTC)`. On the revisit date itself
   the waiver is still valid; the day after, CI turns red until a human
   re-decides or removes the entry.
4. **Stale waiver**: the advisory/package no longer appears in the audit
   output. A fixed vulnerability must end its waiver — the guard forces the
   entry's removal through review instead of letting it rot.
5. **Version drift**: the installed version of the waived package (read from
   `node_modules/<pkg>/package.json`) differs from the waiver's `version` pin —
   the tree changed since the decision, so the decision is stale. When
   `node_modules` is absent (e.g. an audit-only invocation without install),
   the version pin cannot be verified: the run prints a visible WARN and
   matches on advisory+package only. This is the single non-fatal softness in
   the channel; rules 2-4 still apply in full.
6. **Scope contradiction**: a `dev-only` waiver for a package declared in
   `package.json` `dependencies` (production). Note the boundary honestly:
   the check covers direct production declarations, not full transitive
   reachability; `production`-scoped waivers carry no automated cross-check and
   rely on review. Transitive dev-only chains (the braces case) are the
   intended use.
7. **Remaining findings**: any high/critical advisory not covered by a waiver.
   Unknown severity strings count as high (never guessed down).
8. **Unmatched advisory shape**: a finding whose URL carries no GHSA id cannot
   be matched by any waiver — a waiver aimed at it fails as stale (fail-closed
   by construction).

Suppression is always **visible**: waived findings print with their advisory,
severity, scope, revisit date, reason, and decider. Nothing is silenced.

## R6 — Revisit Policy

- `revisit_by` is mandatory and bounded (co-price waiver: 90 days out,
  2027-01-03). There is no waiver without an expiry.
- Revisit means: re-check whether an upstream fix exists (new braces release,
  chain change), re-run the audit, and either re-decide (new date, updated
  rationale) or remove the waiver.
- The stale-waiver guard makes the natural end state automatic: once the
  advisory disappears from the audit output, the run fails until the entry is
  removed. Waivers retire themselves through review; they never need to be
  remembered.

## R7 — Verification

- Unit tests (`tests/unit/dependency-audit.test.ts`, bun test): strict-schema
  parse matrix, expiry boundary, suppression/stale/drift matching, scope
  contradiction, audit-JSON tolerance, L0↔L1 mirror identity. 34 tests pass.
- Live co-price run: gate red without waiver (braces high), green with the
  waiver, and the waiver does not hide the unrelated `some-prod-pkg` finding
  (covered by unit test with a second critical finding in the same tree).
- Fail-closed drills (unit tests): malformed TOML, expired date, stale waiver,
  version drift all fail.
- YAML validity of both changed `ci.yml` files checked by parse.

## R8 — T-20261003-028c Scope Note (fold-in)

T-20261003-028 part (c) is a docs-only backport: carry the corrected
enforcement-strategy paragraph (`propagate-to-templates.ts` replaces the
removed `publish-to-template.ts`) from the workspace-root `SECURITY.md` into
`templates/common/SECURITY.md`, which ships no enforcement section. The
exemption codes E1-E5 (docs/governance/agents/execution-plan-templates.md §5.1)
do not cover it — E1 is memory-log, E2 changelog-only, E3 typo/single-line, E4
README-only, E5 sync-only; a new substantive section in a template governance
doc fits none. The Design Gate therefore applies and this section is the
required spec activity for that change (delivered in the same design
registration; implementation lands on its own branch/commit).
