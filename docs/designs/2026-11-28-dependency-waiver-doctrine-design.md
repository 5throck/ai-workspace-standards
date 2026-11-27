# Dependency-Advisory Waiver-File Doctrine — fleet documentation port from Projects/co-price (R2 resync backport)

- **Spec id**: `2026-11-28-dependency-waiver-doctrine-design`
- **Date**: 2026-11-28
- **Status**: implemented (owner-directed R2 backport review of Projects/co-price; PM candidate assessed — the waiver mechanism question (a)-vs-(b) is resolved as (a) with wrapper evidence below; this document is the port: doctrine, not code. No code, template, or project files change in this dispatch.)
- **Author**: automation-engineer (PM-dispatched R2 flow, Design Gate Row 0, ADR-0074; design + registration only — this dispatch modifies nothing outside `docs/designs/` and `docs/specs/`).
- **Tier**: L0 (documentation only; the mechanism itself lives in delivered `templates/common/` surfaces).
- **Related**: co-price T-20261003-011 (channel creation, commit `408b999`), DEC-20261101-02 (stale-waiver removal precedent), DEC-20261126-01 (owner-approved effect waiver, revisit 2027-02-26), ADR-0031 (L1/L2 fork model — backport gate), `docs/designs/2026-08-28-project-template-backport-design.md` (5-surface method), T-20261126-004 (wrapper v1.2.0 lockfile-skip).

## 0. Summary

The R2 resync-backport pass for `Projects/co-price` (window `13a5cf6..f5c104b`, 265 changed files) found exactly one project-side asset with fleet value: the fail-closed dependency-advisory waiver file `.github/dependency-waivers.toml`. Assessment of the PM candidate:

- **Verdict (a) — the mechanism is already fleet-available in code.** The waiver parsing, strict schema, and all fail-closed guards live in the DELIVERED wrapper `templates/common/scripts/dependency-audit.ts` (v1.2.0, sha256 `932ff3e9…`), byte-identical in 15/16 fleet projects; the delivered common CI workflow (`templates/common/.github/workflows/ci.yml`, `dependency-audit` job, run-step comments) explicitly documents the waiver-file channel. The `co-newbiz` outlier carries wrapper v1.1.0, which already contains the waiver machinery (`DEFAULT_WAIVER_FILE`, `matchWaivers`, `expiredWaivers` present; its 91-line delta vs v1.2.0 is solely the T-20261126-004 lockfile-skip addition) and converges at its next upgrade wave. `Projects/co-utility` is outside the fleet SSOT (`docs/fleet-membership.json`).
- Therefore **no code port exists to make**: any fleet project can create the file today. The only co-price-local artifacts are the FILE itself (co-price-specific advisory/package pins) and its decision records — both stay project-side per ADR-0031.
- **The port is doctrine**: this note records the pattern, its guards, its governance rules, and its precedents for fleet operators, so future waiver usage follows the co-price discipline instead of re-deriving it (or worse, re-deriving an ignore-all).

## 1. Provenance (measured facts, 2026-11-28)

| Fact | Evidence |
|---|---|
| Channel originated in co-price, project-side | commit `408b999` (build(ci): advisory-waiver channel, T-20261003-011) is the `--diff-filter=A` creator of `.github/dependency-waivers.toml` in co-price history |
| Wrapper waiver handling is template-delivered, not project-forked | `Projects/co-price/scripts/dependency-audit.ts` sha256 `932ff3e9c875dacf…` == `templates/common/scripts/dependency-audit.ts` (same file delivered by the machinery wave) |
| Fleet convergence on the same wrapper | 15/16 `fleet-list.ts` members carry sha `932ff3e9…`; exception `co-newbiz` = v1.1.0 (`61bd211c…`), delta = lockfile-skip only |
| CI wiring is template-delivered | `templates/common/.github/workflows/ci.yml` job `dependency-audit` (line 55) documents `.github/dependency-waivers.toml` in its run-step comments |
| Waiver file is co-price-local state, correctly so | single active entry: effect `GHSA-7589-6fvf-x4pw` @ 3.20.0, production, decided_by DEC-20261126-01, revisit_by 2027-02-26 |
| Removal path exercised | DEC-20261101-02 removed the braces waiver after the advisory was withdrawn from the DB — the stale-waiver guard fail-closed and forced the cleanup |

## 2. The doctrine (what fleet operators must follow)

1. **Preference order — never waiver first.** In-range version bumps clear most advisories (co-price precedents: `6ec4671` next in-range bump cleared seven moderates; `da3e8c1` vitest/typescript-eslint bumps, 4 → 1 advisories). A waiver is the channel of last resort, only when **no fix path exists** (e.g. a transitive exact-pin, fixed only in a next-major migration).
2. **The file is `.github/dependency-waivers.toml`, `[[waiver]]` entries only.** Required fields per entry (all validated by `parseWaiverFile`, `templates/common/scripts/dependency-audit.ts:137`): `advisory` (GHSA id format), `package` (npm name), `version` (exact semver pin), `scope` (`dev-only` or `production`), `reason` (why no fix path), `decided_by` (ticket id — DEC-/T- — never prose), `revisit_by` (ISO date; ~90 days is the working cadence).
3. **Fail-closed guarantees (all enforced by the delivered wrapper; none are optional):**
   - stale waiver — advisory absent from current audit output ⇒ FAIL (fix shipped ⇒ entry must be removed; DEC-20261101-02 precedent);
   - version drift — installed version ≠ pinned `version` ⇒ FAIL;
   - scope contradiction — `dev`-scope waiver for a production-declared package ⇒ FAIL;
   - duplicate advisory/package pair, unknown top-level keys, malformed dates, non-TOML ⇒ FAIL;
   - every non-waivered high/critical finding still fails the job — the file is not an ignore-all.
4. **Governance: no entry without a deciding ticket.** `decided_by` must cite the owner-approved decision record; entries without one are review-rejected (gitleaks-allowlist precedent: scoped entries, mandatory rationale, verification date).
5. **Local check before PR**: `bun scripts/dependency-audit.ts` (exit 0 required; suppressed findings stay visible in output, never silent).
6. **Co-location**: the decision record lives in the project (`docs/decisions/DEC-*`); the waiver file stays project-local because its pins are project-specific. Nothing about the mechanism needs to be copied between projects — it is already everywhere.

## 3. R2 backport classification (Projects/co-price, base `13a5cf6`)

backport-diff v1.3.0 over 265 changed files: **213 NO_ACTION (in-sync), 0 REDELIVER (no template-ahead rows), 25 PORT_CANDIDATE, 27 ADJUDICATE.** Adjudication:

- **Doctrine port (this document)**: `.github/dependency-waivers.toml` (+13) — mechanism fleet-available, file co-price-local; provenance `docs/decisions/DEC-20261126-01.md` (+48, stays project-side).
- **KEEP (generated/mechanical)**: `.claude/last-upgrade-*`, `template-version.txt`, `scripts-snapshot.json`, `.gemini/commands/*` (platform skeleton stubs), generated `.claude/agents/pm.md` mirror (regen-script output, T-20261124-002), registries and projection surfaces (`docs/VERSION_MANIFEST.md`, `scripts/SCRIPTS.md`, `skills/SKILLS.md`, `docs/skill-graph.*`, `docs/workspace-schema.json`).
- **KEEP (engagement/memory, ADR-0031)**: `memory/*` deltas incl. two retention prunes (`memory/2026-11-18.md`, `memory/2026-11-19.md`), `CHANGELOG.md`, `bun.lock`/`package.json`, `.gitignore`, `.claude/settings.json`, `.github/workflows/ci.yml` (project-specific wiring on top of the delivered common workflow), `AGENTS.md`/`CLAUDE.md`/`agents/pm.md` registry-projection surfaces.
- **KEEP (cosmetic, not promoted)**: `docs/lifecycle/skills/{decision-record,evidence-ledger,handbook}.md` +1 `**Version**` line each — duplicates the version SSOT already carried by VERSION_MANIFEST/SKILLS registries; root and template copies of those docs deliberately carry no version line.

## 4. Landing plan

Root-only, docs surfaces: this design doc + its `docs/specs/entries/<id>.json` + regenerated `docs/specs/registry.json`, via `bun scripts/dev-sync.ts --scoped-staging` (spec-check satisfied by this registration). No project, template, or script file changes; no project-side PR required (REDELIVER set is empty; co-price is clean on `main` at origin `f5c104b`, template 0.31.0, verifier clean).
