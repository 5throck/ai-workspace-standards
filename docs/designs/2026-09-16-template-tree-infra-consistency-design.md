---
schemaVersion: 1.0.0
spec-id: template-tree-infra-consistency
---

# Template-Tree Infrastructure Consistency — 2026-09-16

One design doc for the Wave C batch: T-20260916-001 (test staging race
under `templates/`) and T-20260916-008 (stale L1 platform-mirror skills).

## 1. Overview

Two infrastructure defects share one root shape: components that read the
`templates/` tree cannot distinguish **transient test fixtures** from real
variants (T-001), and the L0→L1 skill-mirror propagation applies a scope
filter to three platform domains but not the fourth, so mirror policy
diverged and shipped a stale `upgrade-project` skill (T-008). This batch
serializes the templates/-staging E2E suite, teaches every
`templates/`-scanning check to skip recognized fixture names via one shared
predicate, makes all four platform skill mirrors propagate identically, and
adds a staleness arm so a mirror can never silently diverge from the SSOT
again.

## 2. Problem

### 2.1 T-20260916-001 — staging race

`bun scripts/test-runner.ts scripts` runs its members in parallel
(`test-runner.ts` defaults to parallel whenever a suite has more than one
file). Within that suite:

- `scripts/test-l3-to-variant-promotion.ts` stages disposable fixture dirs
  under the REAL `templates/` tree for the duration of the run:
  `templates/test-l3promo-<RUN_ID>` (the scaffold variant, created by
  `create-l3-scaffold`), `templates/test-l3promo-<RUN_ID>-agentsmd-stage`
  (AGENTS.md staging), `templates/co-e2eguard-{beta,stable}-<RUN_ID>`
  (overlay-guard variant.json-only slots, Tests 6–7), and
  `templates/co-e2p2{b,s,c}-<RUN_ID>` (project-to-variant guard fixtures).
- Concurrently, `scripts/test-new-project.ts` scaffolds real projects whose
  governance pre-check (`new-project.ts` §governance) spawns
  `bun scripts/validate-templates.ts --variant <v> --json`.

`validate-templates.ts` enumerates `templates/` subdirectories at seven
sites. The Check 2 enumeration admits any non-`co-` directory
unconditionally, so `test-l3promo-*` enters the variant set (the `co-*`
fixtures are mostly shielded by the git-index `isCoVariantTracked` filter,
but the `managed-block-parity` site lacks that filter and fails on the
fixture's missing `AGENTS.md`). In a full (unfiltered) validate run the
fixture manifests reach B-07 `updateVersionRegistry`, which writes fixture
rows into `docs/templates/VERSION_REGISTRY.json` — the observed pollution.
The same interference class already bit the parallel unit suite (fixed in
PR #937 by moving subprocess fixtures to the sequential E2E).

### 2.2 T-20260916-008 — mirror staleness

`propagate-to-templates.ts` `collectDiffs` skips skills for exactly three
platform domains (`claude-skills`, `gemini-skills`, `agents-skills`) when
the SKILL.md frontmatter `scope` is not `common` (lines "Skip
workspace-scoped AND variant-scoped platform skills"). The `codex-skills`
domain has no such arm. Recorded rationale: **the inline comment only**
("only common-layer skills reach L1 mirrors") — no ADR, DEC, or design-doc
section covers the asymmetry; the block landed inside bulk commit
`7aa478c9` (2026-08-29). Consequence observed today:

| Mirror | upgrade-project | drift vs `skills/` SSOT |
|--------|-----------------|-------------------------|
| SSOT `skills/upgrade-project` | 1.5.0 | — |
| `templates/common/.claude/skills/` | 1.4.1 | stale |
| `templates/common/.gemini/skills/` | 1.4.1 | stale |
| `templates/common/.agents/skills/` | 1.4.1 | stale |
| `templates/common/.codex/skills/`  | 1.5.0 | current (no skip) |

## 3. Investigation findings (T-008 adjudication input)

1. **Skip location**: `scripts/propagate-to-templates.ts` `collectDiffs`,
   domain-name condition over `claude-skills|gemini-skills|agents-skills`
   reading `scope` from the source platform mirror's SKILL.md.
   `codex-skills` is absent from the condition — the sole asymmetry.
2. **Delivery answer**: mirrors ARE delivered to projects.
   `new-project.ts` copies the whole `templates/common/` tree (platform
   profile governs `.codex/`/`CODEX.md` only); its post-copy sweep removes
   only `l2_propagate: false` skills and the legacy L0 list — `scope:
   workspace` skills survive. Therefore every fresh project receives
   `templates/common/.claude/skills/upgrade-project@1.4.1` etc.: a stale
   mirror ships a stale upgrader. `lib/upgrade-policy.ts` routes project
   platform-skill mirrors to the post-upgrade `sync-skills.ts` pass, which
   heals them only after the first upgrade — the scaffold state itself is
   inconsistent (project `skills/` has no upgrade-project; the platform
   mirror copy is 1.4.1 while the SSOT moved to 1.5.0).
3. **Drop-the-skip blast radius** (measured): adds exactly
   `ticket-run`, `release-template`, `context-commonization-review`,
   `simulate-pipeline` to the three mirrors — all four are ALREADY shipped
   by the codex L1 mirror today (codex workspace→L1 delta is empty) — and
   updates `upgrade-project` 1.4.1 → 1.5.0. validate-templates C-CM-05
   needs no contract changes: mirrored workspace skills are exempt
   (exists-in-`skills/` arm). None of the four carries
   `security-gate: true`.

## 4. Decision (T-008)

**Branch 1 — keep all mirrors current.** Mirrors are delivered, so the
mirrors must be correct. Drop the scope skip: all four platform domains
propagate unconditionally (honoring each domain's `exclude` list — the
`agents-skills` `simulate-pipeline` exclusion stays). The codex anomaly
disappears by generalizing codex's behavior; no project loses skills it
receives today. A staleness arm makes the class unregressable.

Rejected alternative: add the skip to `codex-skills` instead. That would
freeze `upgrade-project` at 1.4.1 in all four L1 mirrors (permanent
staleness for a project-facing skill), remove skills codex-profile projects
receive today, and leave the existing mirror rows stranded. It optimizes
for an unrecorded purist intent over the verified delivery behavior.

## 5. Design (T-001)

Preference-order implementation per the ticket.

### 5.1 (a) Serialize the scripts suite

`test-runner.ts` gains a per-suite `sequential?: boolean` (`TestSuite`);
the `scripts` suite is marked `sequential: true`. Default parallelism
becomes: explicit CLI `--parallel`/`--sequential` flag wins, else
`!suite.sequential && files.length > 1`. The unit suite stays parallel.
An explicit `--parallel scripts` invocation remains possible for manual
runs — documented as "you own the race" in the suite help text.

### 5.2 (b) Shared transient-fixture predicate

`scripts/helpers/scaffold-markers.ts` (the existing shared-helpers home,
L0+L1) exports:

- `TRANSIENT_TEST_FIXTURE_PREFIXES` = `['test-l3promo-', 'co-e2eguard-',
  'co-e2p2b-', 'co-e2p2s-', 'co-e2p2c-']`
- `isTransientTestFixture(name: string): boolean` — pure prefix test.

`test-l3-to-variant-promotion.ts` derives its fixture names from the same
prefix constants, so the fixture vocabulary cannot drift between the
producer and the skipper.

`validate-templates.ts` applies the predicate at every
`readdirSync(TEMPLATES_DIR)` site (Check 2 manifests, platform-parity
root↔templates, common-contract variant dirs, managed-block-parity, VRG
readiness, governance-zone domains, pm-extends-stub bodies) — defense in
depth so a stray manual `bun scripts/test-new-project.ts` while an E2E
runs cannot pollute `docs/templates/VERSION_REGISTRY.json` or fail on
fixture-shaped variants.

### 5.3 (c) Post-suite hygiene assertion

After the `scripts` suite finishes, `test-runner.ts` snapshots-then-verifies:

- pre-run: record `git status --porcelain -- docs/templates` entries and
  any `templates/` entries matching `isTransientTestFixture`;
- post-run: any NEW dirty `docs/templates/` path, or any NEW fixture dir
  under `templates/`, fails the suite with the offending paths listed.

Only new pollution fails — pre-existing workspace dirt is reported as a
warning, never blamed on the suite. (Requires a git checkout; skipped
elsewhere with a note.)

## 6. Design (T-008)

- `propagate-to-templates.ts`: delete the three-domain scope-skip block.
  All four platform skill domains propagate uniformly; domain `exclude`
  lists remain the only carve-outs.
- `validate-templates.ts` new standing check **platform-mirror-freshness**
  (Error severity): for each of the four platform mirror dirs
  (`templates/common/.{claude,gemini,agents,codex}/skills`), every skill
  present in BOTH the mirror and the `skills/` SSOT must carry the SAME
  `version:` as the SSOT SKILL.md. L1-only assets (no SSOT counterpart)
  and unparseable/absent versions are skipped. Pure comparison logic lives
  in a new import-safe `scripts/lib/platform-mirror-freshness.ts`
  (unit-tested); the validator wires it to `fail()`.
- One `propagate-to-templates.ts --apply` run lands both the code
  propagation (L0+L1 scripts/helpers/lib) and the mirror catch-up
  (upgrade-project 1.5.0 + the four newly-propagating skills), after which
  the staleness arm is green by construction.

## 7. Version bumps (minor — new behavior)

| File | From → To |
|------|-----------|
| `scripts/test-runner.ts` | 1.2.0 → 1.3.0 |
| `scripts/validate-templates.ts` | 1.32.0 → 1.33.0 |
| `scripts/propagate-to-templates.ts` | 2.15.1 → 2.16.0 |
| `scripts/test-l3-to-variant-promotion.ts` | 1.5.0 → 1.6.0 |
| `scripts/helpers/scaffold-markers.ts` | 1.2.0 → 1.3.0 |
| `scripts/lib/platform-mirror-freshness.ts` | new, 1.0.0 |

Both `scripts/SCRIPTS.md` and the hand-maintained
`templates/common/scripts/SCRIPTS.md` receive matching rows/versions.

## 8. Test plan

1. `tests/unit/transient-test-fixtures.test.ts` — predicate truth table
   (each prefix matches; real variant names and near-misses do not).
2. `tests/unit/platform-mirror-freshness.test.ts` — pure comparison over
   scratch dirs in `os.tmpdir()` (never the real `templates/`): equal
   versions pass, drift reported, L1-only and versionless skills skipped,
   missing mirror dir tolerated.
3. Battery: `bun run test:unit`; `bun scripts/test-runner.ts scripts`
   TWICE back-to-back (second run proves no cross-run pollution and
   exercises the hygiene assertion twice); `bun scripts/validate-templates.ts`
   (0 errors); `bun scripts/typecheck.ts` (delta 0); `bun scripts/audit.ts`
   (PASS); `bun scripts/lifecycle-sync-audit.ts` (0 errors);
   `bun scripts/review-baseline.ts` (6/6).

## 9. Out of scope

- Re-deciding whether L1 should ship workspace-governance skills at all
  (the `skills` SSOT-mirror layer filter is untouched; only the platform
  mirror policy is made uniform).
- `.codex/prompts`, `commands`, and other non-skills codex asymmetries.
- Moving E2E fixture staging out of `templates/` entirely (larger surgery;
  the serialization + skip + assertion triple closes the defect class).

## 10. Accessibility

Non-UI infrastructure batch (test runner, validators, propagation
tooling). No user-facing interface changes; ADR-0065 exemption applies.

## 11. Preview Verification

No rendered UI is produced or modified by this batch; ADR-0070 exemption
applies (pure backend/tooling work).
