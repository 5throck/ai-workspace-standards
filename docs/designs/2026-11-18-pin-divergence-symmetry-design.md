# Design: Pin-divergence symmetry between template seed and project manifest — seed-lag reporting and the seed-target arm

- **Spec ID**: `2026-11-18-pin-divergence-symmetry-design`
- **Date**: 2026-11-19 (ticket T-20261118-005; design authored at origin/main `b694167a9`)
- **Author**: Template Architect (Design Gate, ADR-0074; PM Row 0)
- **Decision record**: none needed — the governing ticket IS the owner decision record (owner direction 2026-11-18 verbatim in `tickets/governance/T-20261118-005.yaml`); this doc implements it and rules the sub-questions the direction left open
- **Builds on (does NOT replace)**: docs/designs/2026-11-07-external-deps-machinery-design.md (D1–D5), docs/designs/2026-11-07-external-deps-standard-design.md (§5.3 pin-move rules — amended by this design, §12), docs/designs/2026-11-17-external-deps-drift-workflow-fix-design.md (seed-vs-upstream weekly scan), docs/designs/2026-11-17-sync-auto-detection-design.md (§5.2 evidence/filing split — cited, not extended)
- **Governing ticket**: T-20261118-005

---

## 1. Problem

The EXTERNAL DEPS pass (D3) is upstream-driven only: per dependency it compares the
project pin against upstream tags (`checkUpstreamTags`) and never consults the
template seed as a pin source. The template seed (`templates/<variant>/external-deps.json`)
and the project manifest (`Projects/<name>/external-deps.json`) can therefore diverge
in both directions with no detection:

1. **Project pin ahead of seed** (project moved first — T-20261117-012: the co-deck
   project ran QuickDL `v1.0.1` while `templates/co-deck/external-deps.json` stayed
   `v1.0.0`). Nothing detects this. The lag surfaced only because a `v1.0.1` tag
   happened to exist upstream; a project-side move without a matching upstream tag
   (fork-internal release, re-tagged repo) would be invisible forever. Meanwhile
   every NEW scaffold inherits the stale seed pin.
2. **Project pin behind seed** (seed moved via a compat-gated template PR — the
   #2093 class: `templates/co-work/external-deps.json` ppt-master `v6.8.0 → v6.9.0`,
   im-not-ai `v2.4.4 → v2.4.5`; the #2099 class: quickdl `v1.0.0 → v1.0.1`). A
   project converges to the seed pin today only by coincidence — when upstream's
   newest tag equals the seed's tag. If the upstream check fails (network, auth) or
   is unreachable, the project stays behind indefinitely.

The owner direction (2026-11-18) is a **symmetric divergence model**: project ahead
→ report + ticket so the seed moves (review-gated); project behind → adopt the seed
pin as the compat-test target (compatibility_test still runs from the PROJECT root —
no gate bypass; the project adapter environment differs from the template gate).

## 2. Evidence (file:line, verified at b694167a9)

**Gap (a) — no detection of project-pin-ahead-of-seed anywhere:**

1. `scripts/upgrade-project.ts:3975-4111` (the D3 per-dependency loop) reads only
   `checkUpstreamTags(dep)` (`:4000`); the seed parsed in channels 2/2b/2c
   (`:3754`, `:3848`, `:3909`) is never consulted for pin comparison.
2. `scripts/helpers/external-deps-reconcile.ts:257` — `adoptSeedEntries` is strictly
   add-if-missing: "existing project entries (including project-only ...) are never
   modified ... a project's operative pin for an id it already has is the project's
   fact". No comparison, no move, no report.
3. `scripts/lib/external-deps.ts:1410-1437` (`migrateManifestV1ToV2`) — the seed
   contributes only v2 contract fields; "the project's pin/commit are its facts".
4. The weekly drift scan compares **seeds vs upstream** only
   (`docs/designs/2026-11-17-external-deps-drift-workflow-fix-design.md` §6.1 —
   `templates/*/external-deps.json` vs `check-updates`); project manifests are
   gitignored (`/*/`, `.gitignore:10`) and invisible to it.
5. `detect-backport` cannot see it either: its evidence surface is project-local
   (`docs/designs/2026-11-17-sync-auto-detection-design.md` §5.2: "the script reads
   only project-local facts; it never diffs against `templates/` (projects lack
   that tree)"). The seed lives only in the workspace's `templates/`.

**Gap (b) — D3 never consults the seed as a pin-move target:**

6. The target is exclusively `upstream.newer` (`scripts/upgrade-project.ts:4033`).
   When `checkUpstreamTags` fails, the pin is held (`:4001-4013`) even though a
   compat-gated seed pin may be strictly newer than the project pin.
7. The seed IS available where needed: `runExternalDepsPass` computes `seedPath`
   (`:3727`, variant seed wins over common seed) — no plumbing beyond reading it.
8. `resolveClaim` (`scripts/lib/upgrade-policy.ts:714`) classifies
   `external-deps.json` as policy PROJECT_STATE, pass EXTERNAL DEPS — the manifest
   is project-owned state; only the pass may rewrite it.

**Install-template constraints that bound the seed-target arm:**

9. `installDependency` git paths are tag-only: the clone is
   `git clone --depth 1 --branch {pin}` (`scripts/lib/external-deps.ts:816-857`) —
   `--branch` accepts a branch or tag name, **not** a raw commit SHA; the refresh
   path fetches `refs/tags/{pin}` (`:844`). A commit-SHA pin is therefore
   uninstallable by every current install template.
10. The standard pins this down: "`pin` is a release tag" (standard design §5.2
    pin rules), and `V7` fails when `refs/tags/<pin>` does not resolve
    (`scripts/lib/external-deps.ts:1155-1160`). Non-semver tags are never
    auto-promoted (`isNewerTag` returns false on non-semver, `:872-882`).
11. Precedent for "project ahead of template, report and port back": the E3/E4
    `PROJECT_AHEAD` verdict + `pendingBackport[]` machinery
    (`scripts/upgrade-project.ts:3143-3163`,
    docs/designs/2026-11-11-upgrade-overwrite-protection-design.md §4.5). But
    reusing `PROJECT_AHEAD` here would couple pin rows to the backport gate —
    today report-only (`:9427-9449`), but the overwrite-protection design's
    enforce rollout ("an apply with project-ahead or pendingBackport files
    requires `--backport-ack`") would silently start blocking upgrades over a
    pin row. Violates "never blocks". A dedicated verdict is required.
12. Decision rows persist in `.claude/last-upgrade-delivery.json` in apply mode and
    print on stdout in dry-run / `--external-deps-only` (`:2250-2273`, `:9267`) —
    both surfaces are session-readable today; no new artifact is needed.
13. `record` verdicts are cast through to `recordDecision`
    (`:7564-7574`); `DecisionVerdict` + `DECISION_SEVERITY_CONTRACT` +
    `pendingKindForDecision` live in `scripts/lib/upgrade-policy.ts` (`:1526`,
    contract block, `:1610`) — an additive verdict member is a small, compiler-
    audited change (two exhaustive switches).
14. `lib/external-deps.ts` is a delivered L1 leaf (`templates/common/scripts/lib/external-deps.ts`
    mirror, ADR-0073) — pure helpers belong there; `upgrade-project.ts` is L0-only
    (absent from `templates/common/scripts/`).

## 3. Goals / Non-goals

**Goals**

- G1. A project pin strictly ahead of the seed pin (or diverging non-semver) emits
  a report-only `SEED_LAG` decision row (WARN) — never blocks, never counts as a
  failure, never auto-moves a seed.
- G2. A project pin strictly behind the seed pin converges: the seed pin becomes
  the compat-test target, the full existing gate applies (compatibility_test from
  the project root → pass moves pin+commit, fail holds + WARN).
- G3. The filing route is ruled explicitly: script-side evidence, session-mediated
  ticket — with `detect-backport` unchanged (no new E-class).
- G4. Byte-identical behavior when project pin == seed pin and upstream is in sync
  (the fleet majority).

**Non-goals**

- N1. No change to seed files, `adoptSeedEntries`, `reconcileExternalDepsManifest`,
  the CLI, `checkPinDrift`, or the drift workflow.
- N2. No automatic seed movement of any kind (review-gated template PRs only).
- N3. No cascade from an upstream-target compat failure to the seed target in v1
  (deferred, §8 R5).
- N4. No new detect-backport evidence class, no sync-skill/upgrade-skill text
  change (§5.4 rules the minimal integration).
- N5. No install-semantics extension (commit-SHA pins stay unsupported, §5.2).

## 4. Options considered

| Option | Pro | Con | Verdict |
|---|---|---|---|
| (a) Reuse the `PROJECT_AHEAD` verdict for the seed-lag row | zero union change; free pendingBackport persistence | couples pin rows to the E3/E4 backport gate — the planned `--backport-ack` enforce rollout would silently turn a report-only pin row into an upgrade blocker (evidence 11); pendingBackport semantics (projectVersion/templateVersion file vintage) do not fit pins | rejected |
| (b) New dedicated verdict `SEED_LAG` (WARN, no pendingBackport kind) | explicit vocabulary; structurally cannot block (no gate kind); compiler-audited switch coverage | one union member + one contract row | **chosen** |
| (c) Seed-lag detection in detect-backport (new E5 class) | project-side detection at /sync time | impossible by construction: projects lack `templates/` (evidence 5); a project-side copy of the seed would duplicate the SSOT | rejected |
| (d) Seed-target arm as seed-first-when-newer (seed pin always beats `upstream.newer`) | staircase through the compat-gated pin | changes today's happy path (project jumps straight to the newest upstream tag); two-pass convergence where one suffices | rejected |
| (e) Seed-target arm as max-semver (upstream target wins when present, seed pin is the fallback) — chosen | preserves today's upstream-first behavior byte-for-byte when upstream is reachable (G4); adds convergence exactly where today none exists (upstream unreachable/failed) | none identified | **chosen** |

## 5. Rulings

### 5.1 The symmetric model (per dep, after the pre-install gate and license verdict)

One parsed seed (`seedPath` from `:3727`; invalid seed → treated as absent, the 2c
precedent at `:3911`) and the seed entry with the same `id` (`seedDep`) drive two
independent mechanisms:

**Arm 1 — SEED LAG detection (project ahead / diverged; report-only).** Runs for
every dependency on the dep's **final pin state for the run** — after the
move/hold arms, including the upstream-failure and compat-failure exits — so a run
that moves the project pin past the seed still reports the resulting lag (the
T-20261117-012 lesson: post-move lag must not vanish).

| Divergence class (pure helper) | Row |
|---|---|
| `isNewerTag(dep.pin, seedDep.pin)` (project strictly newer, both semver) | verdict `SEED_LAG`, severity WARN |
| pins differ, neither direction is `isNewerTag` (non-semver on either side) | verdict `SEED_LAG`, severity WARN |
| pins equal, both commits present and different (tag re-cut upstream) | verdict `SKIP`, severity WARN — manual refresh recommended, NOT auto-executed (a same-tag refresh changes bytes with no compat gate; the human reviews the re-cut first) |
| `seedDep.repo !== dep.repo` (id reused across repos) | verdict `SKIP`, severity WARN — comparison skipped (guards a meaningless compare) |
| pins equal and commits equal (or either commit absent) | **no row** (in-sync; G4) |
| no seed file / no seed entry for the id | no row — documented designed behavior |

`SEED_LAG` rows never increment `changed` or `failures`, never affect exit codes,
never write anything, and never move a seed.

**Arm 2 — seed-target adoption (project behind; compat-gated).** Target selection
(pure helper; `upstream` is the existing `UpstreamTagCheck`):

1. `upstream.ok && upstream.newer` → target = `upstream.newer`, source `upstream`
   (unchanged behavior — ruling (e): when the seed pin is a strictly-newer upstream
   tag, `upstream.newer ≥ seed.pin` by construction, so "max of both" reduces to
   upstream-first).
2. else `isNewerTag(seedDep.pin, dep.pin)` AND `seedDep.pin` is semver-shaped AND
   (`upstream.ok` implies `seedDep.pin ∈ upstream.tags`) → target = `seedDep.pin`,
   source `seed`. The membership requirement prevents a doomed fetch when the seed
   pin is absent from upstream (tag renamed/deleted) — that state gets its own WARN
   row instead ("the seed is out of sync with upstream; not adopted").
3. else → no target (today's hold, unchanged).

When a seed target fires, the mechanics are byte-for-byte the upstream arm's:
`runCompatibilityTest({...dep, pin: target}, projectDir)` **from the project root**
(no gate bypass — the template-level gate tested the seed pin against the template
adapter; the project gate tests it against the project adapter) → pass:
`installDependency` refresh + manifest rewrite (pin, commit) → `ADOPT` row +
`changed++`; fail or fetch failure: hold + WARN + `failures++` (symmetric with the
upstream arm, including the `--external-deps-only` exit code). Decision rows carry
a `(seed target)` marker and, when the upstream check failed, the upstream error.

**Commit-only seed pins (evidence 9-10): ruled unsupported and report-only.** A
seed pin that is not semver-shaped (a commit SHA, or any non-tag ref) never
becomes a target: every current install template is tag-only (`--branch <sha>`
fails; the refresh path fetches `refs/tags/<pin>`), the standard's pin rules say
"release tag", and V7 enforces tag resolution. Extending install semantics is
out of scope (N5); the non-semver divergence lands in Arm 1's report rows until a
human fixes the seed. The design does NOT add `--branch` handling or
fetch+checkout for SHAs.

### 5.2 Dry-run semantics

- Arm 1 rows print identically in dry-run (they are report-only; nothing is
  persisted under dry-run per the existing rule at `:9267`).
- Arm 2 mirrors the upstream arm's dry-run shape (`:4034-4046`): an `UPDATE` row
  stating that compatibility_test **would** run from the project root and the pin
  **would** move to the seed pin on pass; no compat test, no fetch, no write.
- `--external-deps-only` (stdout-only decisions, `:2256-2273`): both arms emit
  rows; Arm 1 never affects the exit code, Arm 2 failures do (symmetry with the
  upstream arm).

### 5.3 Interaction with the pin-drift tripwire

`checkPinDrift` (clone HEAD vs recorded commit) is untouched. Arm 1's
same-pin-diff-commit class is a **recorded-seed-commit vs recorded-project-commit**
comparison — an independent signal about tag re-cuts, orthogonal to clone-HEAD
drift. A successful Arm 2 move re-fetches the clone (`installDependency`), which
naturally resolves any pre-existing drift.

### 5.4 Filing route (ruled explicitly — the task's open question)

**detect-backport gains NO new E-class.** Its evidence surface is project-local;
projects do not have `templates/` (sync-auto-detection §5.2 binding constraint),
so E5_SEED_LAG would be structurally blind. Rejected (option c).

**The route is: D3 decision row → session-mediated filing**, per the §5.2 split of
the sync-detection design (deterministic script evidence, agent-mediated filing —
a spawned subprocess cannot honor the MCP contract, and governance tickets are
session-side workspace-store writes):

- **Normal case — the upgrade runs in a workspace-root session** (the only place
  seeds exist): the session reading the pass output / delivery manifest sees the
  `SEED_LAG` WARN row and files a **governance ticket** (`bun scripts/ticket.ts`
  create, kind manual) naming `templates/<variant>/external-deps.json` (or
  `templates/common/...`) with old → new pins — the exact T-20261117-012 precedent
  class. The seed move itself is then a **compat-gated template PR** (the #2093
  procedure: template selftest against the target clone, CI, review) — review-gated,
  never auto-applied.
- The **upstream-request MCP route** is NOT the channel here: it serves
  project→workspace filing, and this signal is only visible where the workspace
  owns both sides. If a future project-side surface ever needs to report it, that
  is a new design, not an E-class bolt-on.
- **Minimal integration ruled**: the row's `detail` text self-instructs ("file a
  governance ticket to move the seed — compat-gated template PR"); NO skill-text
  change in v1 (N4). The upgrade-project skill has no report-reading step today
  and adding one sentence across the platform mirrors is disproportionate to a
  WARN row the operator already reads. Revisit only if filing lapses in practice
  (recorded as §8 R6).

### 5.5 Decision-row texts (exact, for automation-engineer)

`seedFile` below is the resolved seed path as `templates/<variant>/external-deps.json`
or `templates/common/external-deps.json` (relative, workspace-root framing — the
session that reads the row is workspace-side).

| Class | verdict / severity | detail |
|---|---|---|
| project ahead | `SEED_LAG` / WARN | `dep <id>: project pin <p> is ahead of the template seed pin <s> (<seedFile>) — seed lag; new scaffolds inherit the older pin; file a governance ticket to move the seed (compat-gated template PR)` |
| non-semver divergence | `SEED_LAG` / WARN | `dep <id>: project pin <p> and template seed pin <s> diverge non-semver (<seedFile>) — not auto-comparable; inspect and align manually` |
| same-pin commit divergence | `SKIP` / WARN | `dep <id>: seed records commit <c2> for tag <pin> while the project records <c1> — tag likely re-cut upstream; review the re-cut, then refresh manually: bun scripts/external-deps.ts install --id <id> (a same-tag refresh runs no compat gate)` |
| repo mismatch | `SKIP` / WARN | `dep <id>: seed entry repo differs from the project entry (<seedRepo> vs <repo>) — pin comparison skipped` |
| seed target, dry-run | `UPDATE` / INFO | `dep <id>: seed pin <s> is newer than the project pin <p> (seed target<upstream-failed ? ", upstream check failed: " + err : "">) — compatibility_test would run from the project root; pin would move to <s> on pass, hold + WARN on fail` |
| seed target, compat fail / fetch fail | `SKIP` / WARN | `dep <id>: seed pin <s> REJECTED — compatibility_test <failed (err) / did not run (err)>; pin <p> held` |
| seed target, adopted | `ADOPT` / INFO | `dep <id>: compatibility_test passed — pin <p> → <s> (seed target; commit <sha> recorded)` |
| seed pin not in upstream tags | `SKIP` / WARN | `dep <id>: template seed pin <s> is newer than the project pin but is not among upstream tags — the seed is out of sync with upstream; not adopted` |

All Arm 1 rows carry policy `PROJECT_STATE`, pass `EXTERNAL DEPS`, path
`external-deps.json` (the existing row shape).

## 6. Change spec (for automation-engineer)

| File | Action | Change |
|---|---|---|
| `scripts/lib/external-deps.ts` | modify (1.2.0 → 1.3.0) | Two exported pure functions + header note: `classifySeedDivergence(dep: {pin; commit?}, seedDep: {pin; commit?; repo}, depRepo: string): {kind: "in-sync" \| "project-ahead" \| "non-semver-divergence" \| "same-pin-commit-divergence" \| "repo-mismatch"}` and `resolveSeedTarget(dep, seedDep, upstream: UpstreamTagCheck): {target?: string; source: "upstream" \| "seed"; reason?: string}` (semver-shape via the module's existing `parseSemverTag`; §5.1 table is their spec). No other lib change. |
| `templates/common/scripts/lib/external-deps.ts` | modify | L1 mirror — byte-identical to the L0 change; `docs/templates/common-contract.json` pin bump for the lib. |
| `scripts/lib/upgrade-policy.ts` | modify (minor) | `DecisionVerdict` gains `"SEED_LAG"`; `DECISION_SEVERITY_CONTRACT` gains `SEED_LAG: "WARN"`; `pendingKindForDecision` untouched (default → null — structurally not a backport-gate kind, evidence 11 ruling). |
| `templates/common/scripts/lib/upgrade-policy.ts` | modify | L1 mirror of the upgrade-policy change (+ contract pin bump). |
| `scripts/upgrade-project.ts` | modify (minor bump) | D3 loop: parse the seed once next to the existing channel parses (invalid seed → absent, `:3911` precedent); call `resolveSeedTarget` before the move/hold arms — target selection gains the seed arm with the §5.1 row texts; run `classifySeedDivergence` per dep on the dep's final pin state (after every verdict path, §5.1) and emit Arm 1 rows. `upgrade-policy.ts` consumers of the verdict union: compiler-driven; the two exhaustive switches are the contract and `pendingKindForDecision`. |
| `tests/unit/external-deps.test.ts` | modify | Fixtures per §7. |
| `docs/designs/2026-11-07-external-deps-standard-design.md` | modify | **Addendum B — Pin-divergence symmetry (2026-11-19)** appended: §5.3's "Pin moves stay in one place" paragraph gains the seed-target arm (seed pin as a compat-gated fallback target; upstream-first max rule) and the `SEED_LAG` reporting row; commit-only seed pins ruled unsupported. Points here for rationale. |
| `scripts/SCRIPTS.md` | modify | version rows for the touched scripts (convention). |

No change: `dev-sync.ts`, `audit.ts`, `detect-backport.ts`, seeds, the CLI
(`scripts/external-deps.ts`), the drift workflow, any skill.

## 7. Test plan

1. **Unit — `classifySeedDivergence`** (extend `tests/unit/external-deps.test.ts`):
   project `v1.0.1` vs seed `v1.0.0` → `project-ahead` (the T-20261117-012
   replica); project `v1.0.0` vs seed `v1.0.1` → behind-class value consumed by
   the target helper; equal pins + equal commits → `in-sync`; equal pins, commits
   `57e4fe78` vs `228044a3` → `same-pin-commit-divergence` (the #2099 numbers);
   project `main-rc1` vs seed `v1.0.0` → `non-semver-divergence`; repo strings
   differing → `repo-mismatch` even with equal pins.
2. **Unit — `resolveSeedTarget`** (synthetic `UpstreamTagCheck` objects, no
   network): `upstream.newer = v1.2.0` + seed `v1.0.1` (both newer than project
   `v1.0.0`) → upstream wins (ruling (e), the max case); `upstream.ok=false` +
   seed `v1.0.1` → seed target with source `seed`; `upstream.ok=true`, no newer,
   seed pin present in `tags`, seed newer → seed target (the anomalous-but-sound
   path); `upstream.ok=true`, no newer, seed pin NOT in `tags` → no target +
   the out-of-sync reason; seed pin `57e4fe78...` (commit-only) → no target;
   seed pin ≤ project pin → no target.
3. **Rehearsal (workspace, dry-run)**: `bun scripts/upgrade-project.ts
   Projects/co-deck --dry-run` — expect zero Arm rows (quickdl `v1.0.1` vs seed
   `v1.0.1`, G4 byte-identical); on a throwaway copy of the manifest rolled back
   behind the seed, expect the seed-target dry-run row and no writes; with the pin
   bumped ahead of the seed, expect the `SEED_LAG` row and exit 0.
4. **Gates**: `bun scripts/audit.ts` all-pass, spec-check green, `bun run
   test:unit`, typecheck baseline not raised, L0↔L1 mirror byte-equality
   (`dev-sync` step 3.9 will enforce).

## 8. Risks

| Risk | Mitigation |
|---|---|
| `SEED_LAG` noise after an upstream-driven move passes the seed (row fires every week until the seed moves) | the signal is real — the seed genuinely should move; the row is the intended reminder, and the governance ticket it prompts disposes it |
| Seeds that deliberately lag upstream (template gate pending) get "file a ticket" rows | filing is review-gated (a ticket, then a compat-gated PR); PM can dispose a deliberate lag in triage — the row never acts |
| New verdict member breaks an unaudited exhaustive switch | only two exhaustive switches exist over `DecisionVerdict` (severity contract, `pendingKindForDecision`) — both updated/specified; compiler audits the rest |
| No cascade: upstream target compat-fails while a compat-gated seed pin would pass | held pin retries next pass (upstream arm re-fires); the staircase-through-seed-pin fallback is deferred (N3) — if the scenario recurs, a follow-up design adds the cascade |
| Commit-only seed pins silently never converge | they emit `SEED_LAG`/WARN report rows (Arm 1 non-semver class); the seed is human-fixed — consistent with the standard's release-tag rule |
| Filing lapses (no skill-text duty for the row) | R6 watch item: the row self-instructs; if T-20261118-005's successor tickets don't materialize from real lags, add one guidance sentence to the upgrade-project skill in a follow-up |

## 9. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | None — the change is workspace automation + L1 delivered lib mirrors; no `.claude/` config, command, or skill text | N/A |
| Antigravity (GEMINI.md) | None — **justification**: no `.gemini/` setting, hook, or skill is touched; the upgrade pass runs identically on every platform from the same delivered scripts | N/A |
| Codex / Hermes / ZCode | None — same justification (platform-neutral script changes; no platform skill/config edits) | N/A |
| templates/common | **Propagation required** — `scripts/lib/external-deps.ts` + `scripts/lib/upgrade-policy.ts` L1 mirrors (byte-identical), `docs/templates/common-contract.json` pin bumps, `templates/common/scripts/SCRIPTS.md` rows | listed in §6 |

## 10. Accessibility / preview exemptions

ADR-0065: exempt — backend automation and CLI report rows; no UI.
ADR-0070: exempt — verification is command-exit and decision-row based (§7).

## 11. Rollout / ticket handling

Single PR (design + implementation ride together, per the PM's sequencing note):
lib helpers + tests → upgrade-policy verdict → D3 wiring → standard Addendum B →
contract/registry bumps. T-20261118-005 moves `review` with the PR and closes on
the §7 rehearsal evidence. The `SEED_LAG` rows that fire on real projects
afterwards file their own governance tickets (the designed flow — the first real
row is the acceptance evidence that the filing route works).

## 12. Standard amendment (the ticket's required note)

The external-deps standard's pin-move section ("Pin moves stay in one place", §5.3)
is amended by Addendum B in that same document (not a new standard doc): the one
audited pin-move path now has two target sources — `upstream.newer` (as today) and,
as a compat-gated fallback, the template seed's pin when strictly newer than the
project pin — plus the report-only `SEED_LAG` row for the ahead/diverged direction.
The compat gate, the project-root execution site, and "the CLI never moves a pin"
are unchanged.
