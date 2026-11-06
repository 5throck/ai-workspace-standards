# Design: External-dependency machinery — generic pinned-git-dep manifest with scaffold fetch, upgrade compat-gate, and vendoring guard

- **Spec ID**: 2026-11-07-external-deps-machinery-design
- **Date**: 2026-11-07
- **Status**: Implemented (2026-11-07 — machinery landed: scripts/lib/external-deps.ts v1.0.0, new-project.ts v1.42.0 §7.9, upgrade-project.ts v1.91.0 EXTERNAL DEPS pass, template seeds, vendoring guard, D6 checker, tests/unit/external-deps.test.ts; D8 local-patch retirement pending the next real upgrade-project run over Projects/co-work)
- **Implements upstream ticket**: U-20261106-003 (L1: external-dependency manifest + scaffold/upgrade support; status waiting, triage ready) — the machinery this design specifies is the implementation of that ticket
- **Origin**: docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md (D2) and docs/decisions/DEC-20261106-04.md — co-work rebased its deck emitter onto [ppt-master](https://github.com/hugohe3/ppt-master) (MIT, pinned `v6.8.0`, commit `5e8856be…`), consumed as-is behind an adapter; the user-settled distribution posture for that rebase requires a generic L0 facility, of which ppt-master is the first consumer
- **Supersedes (interim)**: the project-local interim in `Projects/co-work/external-deps.json` + `Projects/co-work/scripts/deck/fetch-ppt-master.ts` (both carry `LOCAL-PATCH(upstream-request: U-20261106-003)` markers; retirement per D8)
- **Owner**: implementation specialist (PM Gateway dispatch; design-only this round)
- **Tiers**: L0 (workspace root scripts + template seeds) · L2 (templates/co-work deck scripts) · project-local (manifest instance, gitignored install dirs)

## 1. Problem and goal

co-work decks are now produced by ppt-master's conversion chain (design
2026-11-06-deck-emitter-ppt-master-rebase-design, Phase 1+2 implemented).
The distribution question was settled by the user during that rebase:

1. **Never vendor external repos into template trees.** External code is
   cloned from GitHub at a pinned release tag, at scaffold time, into a
   gitignored project-local directory.
2. **Upgrades are gated, not automatic.** Check upstream for a newer
   release, run the dependency's compatibility tests, and only on pass move
   the pin; on failure hold the current pin and report.
3. **Propagation never crosses the template boundary.** Variant promotion
   and template sync must never deliver or accept external-dependency parts
   in either direction.
4. **The mechanism is generic.** Any co-* variant may declare external git
   dependencies; ppt-master is merely the first consumer.

Today none of this is machinery: the interim state is a hand-written
project-local manifest plus a bespoke fetch script in `Projects/co-work/`,
marked `LOCAL-PATCH(upstream-request: U-20261106-003)` so the landing can
find and retire them. Existing projects (including co-work itself) have no
scaffold/upgrade path for external deps at all.

**Goal**: one generic L0 facility — a schema-versioned `external-deps.json`
manifest convention, scaffold-time fetch in `new-project.ts`, upgrade-time
compat-gated pin updates in `upgrade-project.ts`, and hard propagation
exclusion — so the interim local patch retires after one real upgrade run
and any variant can declare dependencies with the same guarantees.

## 2. Decisions

### D1 — Manifest: `external-deps.json`, seeded at L1, extended per variant

Format (top level an object with a schema-version field and a
`dependencies` array; an empty array is the valid L1 seed):

```jsonc
{
  "schema_version": 1,
  "dependencies": [
    {
      "id": "ppt-master",
      "repo": "https://github.com/hugohe3/ppt-master",   // https URL, no credentials
      "pin": "v6.8.0",                                    // release tag — the version we run
      "commit": "5e8856be0da8e6bc85c4aa28acc614478f7b7137", // resolved sha, advisory (D2/D3 write it back)
      "install": "git clone --depth 1 --branch {pin} {repo} {dir}", // {pin}/{repo}/{dir} placeholders
      "install_dir": "external/ppt-master",          // project-relative, MUST be gitignored (D5)
      "consumer": "deck pipeline (scripts/deck/ppt-master-adapter.ts)",
      "compatibility_test": "bun test tests/external/ppt-master-contract.test.ts", // run from project root; exit 0 = pass
      "propagation": "never"                              // enum; "never" is the only value for now
    }
  ]
}
```

Placement:

| Location | Content | Effect |
|---|---|---|
| `templates/common/external-deps.json` (L1 seed) | empty array + schema doc comment | every scaffolded project gets the convention from day one |
| `templates/co-work/external-deps.json` (variant seed) | the ppt-master entry above | co-work projects scaffold with ppt-master pre-declared |
| existing projects | delivered via the upgrade manifest pass | co-work's hand-written instance is reconciled on next upgrade (D8) |

Variant templates **extend** the common seed (merge on `id`; a variant may
add entries, not redefine L1 semantics). Validation lives in the shared
helper (D-Lib): unknown fields rejected, `propagation` enum-checked,
`install_dir` checked (project-relative, no `..`, not inside template
trees), placeholders resolved. The advisory `commit` field is filled at
fetch/update time and used only as a drift tripwire — the **pin tag is the
contract**; if the tag resolves to a different sha than recorded, upgrade
reports it (pin drift, §5).

The interim project-local manifest's extra fields (`license`,
`excluded_packages`, `notes`) are not promoted into the generic schema —
they are co-work-specific context that belongs in the consuming variant's
docs, not in a shared format. (Alternative considered: promote them as
optional fields for license bookkeeping — rejected for now; license posture
is already governed by decision records, and the AGPL/PyMuPDF exclusion is
adapter-level policy, not a manifest concern.)

### D2 — Scaffold fetch (new-project.ts)

After project materialization completes, for each manifest entry: run the
`install` command into `install_dir` (clone at depth 1 at the pin tag;
`file://` and local paths are accepted only from test manifests — see §4),
then record the resolved commit back into the manifest.

**Failure posture: WARN, not fail.** A network-dependent scaffold must not
leave the user without a project: on fetch failure the project is still
scaffolded, a WARN row lands in the run output, and the documented retry is
`bun scripts/upgrade-project.ts --external-deps-only` (same update pass,
fetch-only flavor). `--strict-external-deps` flips this to hard-fail for
CI/provisioning contexts that must not proceed without deps.

### D3 — Upgrade update pass (upgrade-project.ts)

A new pass **after the TEMPLATE TREE SYNC pass**, per dependency:

1. `git ls-remote --tags` against `repo`; resolve the newest release tag
   (semver-aware; a tag that is not newer than `pin` short-circuits to
   "current").
2. Newer tag exists → run `compatibility_test` from the project root.
   - **Pass**: move the pin (update `pin` + `commit` in the manifest,
     re-clone or `git fetch` + checkout the new tag in `install_dir`).
   - **Fail**: hold the current pin, WARN report row, no changes.
3. Every dependency yields a **decision log row** per the unified decision
   log convention already used by upgrade passes.

`--dry-run` compatible: the pass reports what it *would* do (upgrade found
/ test would run / pin would move) without touching the manifest or
`install_dir`. A `--external-deps-only` flag runs just this pass (used as
the scaffold-retry path, D2). Existing projects receive the pass on their
next upgrade — that is exactly how co-work's `LOCAL-PATCH` interim retires
(D8).

### D4 — Propagation exclusion and vendoring guard

- `propagate-to-templates` and the `l3-to-variant-pipeline.ts`
  (variant-promotion) path **hard-skip** any path under any manifest
  `install_dir` — external code never flows project → template.
- `tree-sync` (upgrade's template→project delivery) likewise skips those
  paths — external code never flows template → project either.
- `validate-templates.ts` **FAILs** if any path inside a template tree
  matches a manifest `install_dir` (a vendoring guard: the fastest way to
  detect an `external/ppt-master/` accidentally committed into
  `templates/co-work/`). Variant promotion inherits the guard because it
  runs through the same validation.
- The manifest files themselves (`templates/common/external-deps.json`,
  variant seeds) are ordinary governed template files — they propagate
  normally; only `install_dir` content is excluded.

### D5 — Gitignore coverage

`install_dir` must be covered by `.gitignore` — enforced two ways:
`new-project.ts` appends the install_dir line when scaffolding, and the
upgrade pass validates existing coverage (WARN + auto-append offer when
missing). A project that commits an external clone defeats the entire
distribution model (upstream would see our fork as a diff); the validator
check in D4 plus this rule close both directions of the hole.

### D6 — CI openability leg (review Q4 folded in)

The full headless-PowerPoint/LibreOffice open harness is **out of scope**
(documented below) — but a cheap openability leg is worth having now. New
**project-side** script `scripts/deck/check_openability.py`:

- stdlib-only baseline; uses **python-pptx if available**;
- opens a produced `.pptx`, asserts expected slide count and notes-slide
  presence/counts from a JSON expectation file passed as an argument;
- **graceful SKIP** (exit code distinguishing skip from fail) when
  python-pptx is absent — CI stays green on minimal environments.

Delivery: **template-delivered** under `templates/co-work/scripts/deck/`
(recommended, adopted here) so every co-work project gets it on scaffold
and upgrades carry it like any other deck script — a project-local L3 file
would strand older projects. Wiring: (a) an optional step in the deck
delivery checklist (pptx-export skill note), (b) runnable inside the
opt-in CI unit-tests job (ADR-0094) against the golden fixture deck.

### D7 — Checker-class backlog (Q5, recorded not built)

The retired Bun checker class (svg-check.ts, now a parity oracle) still
carries schema-coverage knowledge (known-good DrawingML construct
whitelist) that strengthens over time. **Backlog item** (owned by
deck-builder, no code this round): mine the checker's schema-coverage pins
into an expectation format `check_openability.py` (or a successor
structural gate) can consume, so openability assertions grow with checker
knowledge instead of staying hand-written.

### D8 — Local-patch retirement

After implementation + **one real `upgrade-project.ts` run over
`Projects/co-work`**:

1. the upgrade manifest pass delivers the generic
   `templates/co-work/external-deps.json` seed and reconciles the project's
   hand-written instance into it;
2. the `LOCAL-PATCH(upstream-request: U-20261106-003)` markers in
   `external-deps.json` and `fetch-ppt-master.ts` are removed;
3. `fetch-ppt-master.ts` is superseded — delete it, or reduce it to a thin
   wrapper over `lib/external-deps.ts` if the adapter's venv bootstrap
   depends on it (implementation decides; report which).

## 3. Implementation map

| Tier | Item | File / location | Change |
|---|---|---|---|
| L0 | Shared helper (NEW) | `scripts/lib/external-deps.ts` | parse/validate manifest, resolve placeholders, install (spawn git), ls-remote pin check, update-pass core; consumed by both scripts and tests |
| L0 | Scaffold fetch | `scripts/new-project.ts` | post-materialization hook: seed common+variant manifests, fetch each entry (D2), append gitignore lines (D5), `--strict-external-deps` flag |
| L0 | Upgrade update pass | `scripts/upgrade-project.ts` | new pass after TEMPLATE TREE SYNC (D3), `--dry-run` compatible, `--external-deps-only`, decision-log rows, install_dir gitignore validation |
| L0 | L1 seed | `templates/common/external-deps.json` | empty array + schema doc comment (D1) |
| L0 | Variant seed | `templates/co-work/external-deps.json` | ppt-master entry (D1); delivered to existing projects via the upgrade manifest pass |
| L2 | Openability checker (NEW) | `templates/co-work/scripts/deck/check_openability.py` | D6; template-delivered |
| L2 | Delivery checklist wiring | `templates/co-work/skills/pptx-export/SKILL.md` | optional openability step note (D6) |
| L0 | Vendoring guard | `scripts/validate-templates.ts` | FAIL on install_dir paths inside template trees (D4); `scripts/propagate-to-templates.ts` + `scripts/l3-to-variant-pipeline.ts` skip those paths |
| L0 | Tests (NEW) | `tests/unit/external-deps.test.ts` | helper unit tests + fixture-manifest flows (§4) |
| L0 | Tests (extend) | new-project E2E surface (`tests/unit/new-project-rollback.test.ts` and the scaffold-path suite) | scaffold fetch happy path, WARN-on-failure path, gitignore append |
| Registry | Script registry + mirrors | `scripts/SCRIPTS.md` (+ template mirrors) | new script rows per house conventions, at implementation |

**Windows note**: the machinery shells out to `git`; Windows hosts need git
on PATH (documented in the script help text and the scaffold failure WARN
message — not worked around in code).

## 4. Verification plan

1. **Unit tests** (`tests/unit/external-deps.test.ts`): manifest parsing +
   validation (schema drift, bad install_dir, unknown propagation value),
   placeholder resolution, pin-comparison semantics, vendoring-guard
   detection.
2. **E2E scaffold test, no network**: a test-only fixture manifest points
   at a **tiny local fixture repo** (created in `tests/fixtures/` via
   `git init` + one commit + one tag; consumed through a `file://` path in
   the `install` command). Assertions: clone lands in `install_dir`,
   manifest `commit` filled, gitignore line appended; a manifest entry
   whose fixture repo path is bogus produces the WARN-not-fail scaffold
   outcome; `--strict-external-deps` fails instead.
3. **Upgrade update pass test**: against the same fixture repo, a newer
   tag exists → `compatibility_test` is a trivial always-pass command →
   pin moves + decision row written; compat test fails → pin held + WARN;
   `--dry-run` touches nothing. Fixture repos are cleaned per run.
4. **Vendoring guard test**: a template tree containing an `install_dir`
   path fails `validate-templates.ts`; propagate/tree-sync skip it.
5. **Real-world dry run**: `bun scripts/upgrade-project.ts --dry-run`
   against `Projects/co-work` (its live manifest entry) — expect the
   ppt-master pin reported "current" and the manifest-seed delivery shown
   without side effects. The real (non-dry) run is the D8 retirement step,
   executed by the implementation dispatch.
6. **Governance gates**: `bun test`, `bun scripts/validate-templates.ts`,
   `bun scripts/audit.ts` green; spec registry flips `draft →
   implemented` only after the implementation round lands.

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scaffold becomes network-dependent | WARN posture + documented retry (D2); `--strict-external-deps` for contexts that must hard-fail; tests use local fixture repos, never the network |
| Pin drift (tag re-pointed upstream) | advisory `commit` field compared at update time; mismatch reported, pin still authoritative |
| Manifest schema drift between template generations | `schema_version` field + strict validation in the shared helper; upgrade validates before running the pass |
| Windows hosts without git | documented requirement in help text and the WARN message; no code-level workaround (§3) |
| `install_dir` accidentally committed | D5 gitignore enforcement (scaffold append + upgrade validation) and D4 validate-templates vendoring guard |
| Compatibility test weakens over time (passes everything) | D3 requires the test to exist and pass; D7 backlog records the strengthening path; pin moves remain human-visible via decision log rows |
| Fixture repo leaking network access into tests | `file://` install commands only in test manifests; helper rejects nothing new for https — tests simply never use it |

## 6. Out of scope

- **Private-repo auth** — https-only public repos for now; token/SSH
  handling is a future design.
- **Lockfile-style transitive dependency resolution** — external deps are
  whole repos pinned at a tag; per-commit lockfiles and dependency graphs
  of external repos are not modeled.
- **Non-git sources** (tarballs, package registries) — the `install`
  field is a command template, so nothing structurally blocks it, but
  validation, pin checks, and the update pass are git-semantics only this
  round.
- **Full headless open harness** (PowerPoint/LibreOffice automation) — the
  standing no-Office-tooling policy holds; D6's stdlib/python-pptx
  openability check is the sanctioned leg.

## 7. References

- docs/designs/2026-11-06-deck-emitter-ppt-master-rebase-design.md (D2 origin; distribution posture)
- docs/decisions/DEC-20261106-04.md (MIT adoption, as-is consumption, AGPL exclusion)
- U-20261106-003 (upstream ticket this design implements; status waiting, triage ready)
- https://github.com/hugohe3/ppt-master (MIT; pinned v6.8.0, commit 5e8856be…)
- `Projects/co-work/external-deps.json`, `Projects/co-work/scripts/deck/fetch-ppt-master.ts` (interim; LOCAL-PATCH markers — retired per D8)
- docs/adr/0094 (opt-in CI unit-tests job — D6 wiring), docs/adr/0074 (Design Gate)
- scripts/upgrade-project.ts (TEMPLATE TREE SYNC pass ordering; unified decision log), scripts/validate-templates.ts, scripts/propagate-to-templates.ts, scripts/l3-to-variant-pipeline.ts
