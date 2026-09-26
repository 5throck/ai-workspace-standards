---
lang: ko
lang_reason: source-material
---

# Design: Automatic Template Versioning — Nightly Auto-Release Step — Governance Registration (Design Gate)

- **Spec id**: `2026-09-27-auto-template-release`
- **Date**: 2026-09-27
- **Author**: Template Architect (Design Gate, ADR-0074)
- **Source**: user directive 2026-09-27 — template versioning must become automatic ("템플릿 버전이 자동으로 관리할 수 있도록 할 필요가 있어")
- **Related**: ADR-0089 (01:30 runner cadence + unattended merge policy — the integration host), ADR-0073 (file-level, deliver-by-default upgrade coverage — why the version number is not an upgrade gate), ADR-0078 (LLM work routing), ADR-0079 (instruction standard), ADR-0065 / ADR-0070 (exemptions, §8–§9)

---

## 1. Background

The user directed on 2026-09-27 that template versioning must become automatic. Today it is a human act: `bun scripts/release-template.ts` bumps `templates/VERSION`, cuts `templates/CHANGELOG.md`, and delegates tagging to `scripts/tag-template.ts` (`template-vX.Y.Z`, optional `--push`). Both helpers are atomic and rollback-safe, but releases happen only when a human runs them. Tag history: `template-v0.5.0` 2026-05-26, `template-v0.5.1` 2026-06-01, `template-v0.5.2` 2026-06-03, `template-v0.6.0` 2026-08-28 — event-driven, at most monthly.

The manual process is already inconsistent with its own tooling. The `template-v0.6.0` tag was cut at the PR #744 merge commit after `templates/VERSION` was bumped inside the PR, bypassing `release-template.ts`'s changelog cut: at tag time `templates/CHANGELOG.md` carried no `[0.6.0]` section at all, and stale June entries sat in `[Unreleased]` (the `[0.6.0]` section was backfilled by hand after the tag). Meanwhile the template tree moved on: `git diff template-v0.6.0..HEAD -- templates/` holds ~2,400 delivered-path changes across 310 commits (1,074 A / 211 D / 950 M / ~270 R as of 2026-09-27). Upgrade waves ran on 2026-09-23 and 2026-09-25 and delivered those changes to the fleet while `templates/VERSION` stayed `0.6.0`.

Ground truth on what the version number and the tag actually do (verified in source, 2026-09-27):

- **Upgrades are file-level and version-blind.** `scripts/upgrade-project.ts` never reads the tag or compares versions. Delivery resolves per-path claims in `scripts/lib/upgrade-policy.ts` (ADR-0073 deny-list, fallback `SYNC`/`TEMPLATE TREE SYNC`). `templates/VERSION` is read once as provenance and written into each project's `.claude/template-version.txt` post-upgrade (policy `REGENERATED`, never delivered). The project's recorded version (`detectedVersion`) is display-only.
- **The tag's consumers are audit and orientation.** `scripts/audit.ts` checks `git tag -l template-v<VERSION>` existence and reports `Pass` when published; `scripts/list-template-versions.ts` lists tags; humans read them.

So an automatic releaser does not change upgrade behavior — upgrades fire regardless. Its value is provenance accuracy and auditability: today a project upgraded on 09-25 records `version=0.6.0` for a tree roughly 2,400 delivered paths past the `v0.6.0` tag. The version marker must stop lagging the tree it labels.

## 2. Goals

1. Make the template release (version bump, changelog cut, tag) a governed, automatic nightly step.
2. Bound the automation with a deterministic classification rule: `patch`/`minor` only, never `major`.
3. Reuse the existing atomic helpers (`release-template.ts`, `tag-template.ts`) without reimplementation.
4. Integrate as one step in the ADR-0089 01:30 runner with explicit guards and failure routing.

## 3. Non-goals

- Changing upgrade delivery semantics. ADR-0073 file-level delivery and ADR-0089 canary-first upgrade merges stay exactly as they are. The auto-release creates the version and the tag only.
- Automatic `major` releases. A major bump stays a human decision, routed through a ticket.
- Per-commit tagging and changes to `release-template.ts` / `tag-template.ts` (the step composes them as-is).
- The 03:00 governance-ticket batch (ADR-0082 contract unchanged).
- Editing the runner prompt in this change set — the prompt edit is implementation work specified by §4.5.

## 4. Requirements (ASD-STE100, ADR-0079)

### 4.1 Trigger and scope

- R1. Compute the pending set with `git diff -M template-v<current>..HEAD --name-status -- templates/`, where `<current>` is `templates/VERSION`.
- R2. Scope the classifier to delivered paths only: rows under `templates/common/` or `templates/co-*/`. Exclude `templates/VERSION`, `templates/CHANGELOG.md`, `templates/README.md`, and `templates/README_ko.md` (release metadata; none is upgrade-delivered).
- R3. Exit as no-op with one log line when the scoped set is empty. Mutate nothing.
- R4. Classify the scoped set before any execution. Print the classification table (counts per status, per top-level directory, chosen level, next version) to the run log in both dry-run and live modes.

### 4.2 Classification (semver rule, 0.x convention)

The pure function `classifyTemplateChanges(rows, currentVersion)` in `scripts/lib/template-release-classify.ts` returns `no-op | patch | minor | manual-review`:

| Scoped input row (`git diff -M --name-status`) | Level | Rationale |
|---|---|---|
| `D` — deleted delivered path | MINOR | Delivered-surface removal is breaking under the 0.x convention. |
| `R###` — renamed/moved delivered path (any similarity score) | MINOR | Path identity changed: one delivered path removed, one added. |
| `A` — new delivered path (new skill, script, command, variant file) | MINOR | Feature addition. |
| `M` only — modifications to existing delivered paths | PATCH | Content fix inside the existing surface. |
| Contract rows — see note | — | `docs/templates/common-contract.json` sits outside the `templates/` diff scope. Its schema-level removals surface here as `D` rows and classify MINOR. A contract-only change with no `templates/` change produces no release. |

- R5. Apply precedence: `manual-review` beats `minor`; `minor` beats `patch`.
- R6. Return `manual-review`, never `major`, when any of these hold: (a) a status code outside `A`/`M`/`D`/`R###` appears; (b) `templates/VERSION` does not match `X.Y.Z`; (c) the tag `template-v<current>` does not exist while an older `template-v*` tag does (previous release incomplete — reconcile by hand); (d) `templates/VERSION` itself appears in the pending diff (uncommitted bump signature).
- R7. Never emit `major`. A major-worthy change classifies at most `minor`; a human files the major release.

### 4.3 Execution (composition of existing helpers)

- R8. In live mode run `bun scripts/release-template.ts --bump <level> --notes "auto-release <date>: <N> delivered paths (<one-line class summary>)" --no-tag`. Do not reimplement the VERSION bump or the changelog cut. `cutChangelog` preserves a non-empty `[Unreleased]` verbatim and falls back to the `--notes` line when empty.
- R9. Land the bump through a PR titled `chore(templates): auto-release v<next> (<level>, <N> delivered paths)` touching only `templates/VERSION` and `templates/CHANGELOG.md`. The runner merges it under ADR-0089 R27 (all checks CLEAN; provenance-only diff).
- R10. After the release PR merges, run `bun scripts/tag-template.ts --fail-on-push-error`. The tag then points at a commit whose tree contains its own `templates/VERSION` (the `template-v0.6.0` precedent).
- R11. Run the secrets gate (`gitleaks detect --no-git --config .github/gitleaks-full.toml`) before the release PR push, per ADR-0089 R30.

Ordering rationale: `release-template.ts` writes VERSION/CHANGELOG and then tags HEAD — a bare `--push` run would tag the pre-bump commit and the tag's tree would carry the old version. The `--no-tag` → commit → `tag-template.ts` sequence uses both helpers in their documented roles and keeps the tag tree consistent.

### 4.4 Guards

- R12. Require a clean tree at step entry (`git status --porcelain` empty). Skip with a log line otherwise.
- R13. Skip the step when Phase I ended in degraded mode (ADR-0089 R37: baseline ≥3 ERRORs or any Critical).
- R14. Release at most once per calendar day. The nightly cadence enforces this; idempotency does too — after a release, the scoped diff against the new tag is empty, so a re-run exits no-op.
- R15. Route any failure at R8–R11 to exactly one ticket (`bun scripts/ticket.ts create auto-template-release --priority high`). Continue Phase II. Never block Phase II on a release failure.

### 4.5 Runner integration (ADR-0089 host)

- R16. Insert the auto-release step in the 01:30 runner prompt between Phase I completion (root PR merged, tree clean) and Phase II start. The same night's Phase II upgrade records then carry the fresh version, and the tag captures the night's merged template changes.
- R17. Add an `auto_template_release` block to `docs/examples/runner-config.json` (`enabled`, position note). Follow the file's stated pattern: the runner prompt references the config instead of restating numbers. Edit prompt and example config in the same change set.
- R18. Register both new files in `scripts/SCRIPTS.md`: `auto-release-template.ts` (L0, `--dry-run`) and `lib/template-release-classify.ts` (L0). Use `scripts/lib/error-handling.ts` (`die()`/`fatalError()`) for error paths from birth.

### 4.6 Reporting

- R19. Write the classification table, chosen level, next version, release PR id, and tag name into the day's run evidence (`memory/YYYY-MM-DD.md` block; `docs/reports/` when Phase I report conventions apply).

## 5. Acceptance criteria

- AC-1 (R1–R3, trigger). With an empty scoped diff the step exits no-op with one log line and zero mutations. Release-metadata paths never enter the classifier.
- AC-2 (R4–R7, classification). Pure-function unit tests cover every table row class, precedence, all four `manual-review` triggers, and the no-op case. No code path returns `major`.
- AC-3 (R8–R11, execution). The step invokes `release-template.ts` (VERSION/CHANGELOG writes are never reimplemented) and `tag-template.ts`. After a live run, `git show template-v<next>:templates/VERSION` prints `<next>` — the tag tree contains its own version.
- AC-4 (R12–R14, guards). A dirty tree skips the step. A degraded-mode night skips the step. A same-day second run exits no-op.
- AC-5 (R15, failure routing). An injected failure produces exactly one ticket and Phase II still runs to completion.
- AC-6 (R16–R19, integration and evidence). The runner prompt places the step between Phase I and Phase II; `docs/examples/runner-config.json` carries the block; the run log holds the classification table, level, next version, PR id, and tag name.

## 6. Alternatives considered

1. **Weekly release train — rejected.** It adds a second standing cadence to govern, and the fleet upgrades daily (waves on 09-23/09-25), so weekly versions would still mislabel most upgrades' provenance. The nightly slot already exists and already throttles to one release per day.
2. **Threshold-based release (release only when N paths changed or H days passed) — rejected.** Arbitrary thresholds hide policy in constants. Classification already bounds severity, and a nightly no-op costs one git diff.
3. **Fully-continuous per-commit tagging (tag every templates/-touching merge) — rejected.** Tag spam, no meaningful `[Unreleased]` changelog section (it would be cut empty every merge), and coupling to the PR pipeline. The nightly batch is the smallest granularity that keeps a readable changelog.
4. **Reimplement bump/tag logic inside the new script — rejected.** `release-template.ts` and `tag-template.ts` are atomic, idempotent, and rollback-safe; a second implementation re-creates drift between two release paths.

## 7. Verification plan

- `bun test tests/unit/template-release-classify.test.ts` — classification table, precedence, manual-review triggers, no-op (pure function; no git fixtures needed, following `tests/unit/upgrade-delivered-diff.test.ts` conventions).
- `bun scripts/auto-release-template.ts --dry-run` — prints the live classification table with zero mutations. Expected first-run verdict: `minor` (the 2026-09-27 backlog: 1,074 A / 211 D / ~270 R / 950 M scoped rows).
- `bun scripts/release-template.ts --bump patch --dry-run` — confirms the reused helper's untouched contract.
- Post-landing manual check on the first live night: `git show template-v<next>:templates/VERSION` equals `<next>`; `scripts/audit.ts` reports the tag-existence `Pass`; Phase II upgrade logs record the fresh version in `.claude/template-version.txt`.
- Registration verification: `git status --porcelain` lists exactly this design doc and `docs/specs/registry.json`; `bun scripts/spec-register.ts` reports spec id `2026-09-27-auto-template-release`.

## 8. Accessibility exemption (ADR-0065)

Backend automation only — no UI. ADR-0065 accessibility baseline not applicable.

## 9. Preview-verification exemption (ADR-0070)

Exempt — non-UI change (ADR-0070). No rendered artifact is produced; verification is command-exit, test-result, and git-artifact based (§7).

## 10. Decision record

- **User-directed delegation.** The human release act (version bump, changelog cut, tag) is delegated to the nightly runner by user directive of 2026-09-27. Upgrade delivery remains separately gated (ADR-0089 canary-first merges); the auto-release only creates the version and the tag, so the blast radius of unattended mutation is unchanged.
- **Runner integration.** This is a step addition inside the ADR-0089 automation — no cadence change, so the ADR-0089 schedule-change rule does not force an ADR amendment. The release PR merges under ADR-0089 R27's existing CLEAN-checks authority; no new never-merge-class power is granted.
- **Standalone ADR: not warranted now.** No new policy class (the tag push publishes provenance, not user content). Recommendation: if PM wants the human-decision delegation formalized at ADR level, file it as a governance-backlog ticket rather than blocking this design.
- **Cadence honesty.** Template churn is daily (skill promotions, backports, mirror syncs — ~80 delivered paths/day observed). With additions present, most nights will classify `minor`. That nightly `minor` drift is the direct consequence of the directive and the point of it: the version stops lagging the tree. If a slower train is wanted later, tune the trigger (for example, gate on additions only) — out of scope here.

## 11. Deviations from the draft position (ground-truth corrections)

1. **`[Unreleased]` synthesis is unnecessary.** `release-template.ts` `cutChangelog` already preserves a non-empty `[Unreleased]` verbatim and synthesizes a fallback line from `--notes` when empty. The step passes `--notes`; it does not pre-edit the changelog.
2. **The tag does not gate upgrades.** `upgrade-project.ts` never reads tags or compares versions; delivery is file-level (ADR-0073) and the version is post-upgrade provenance (`REGENERATED`). The Phase-I-before-Phase-II placement is kept for provenance accuracy and tag-captures-merged-content, not because upgrades would otherwise miss the tag.
3. **Tag-tree correctness requires commit-then-tag.** A bare `release-template.ts --push` tags HEAD before the bump is committed, so the tag's tree would carry the old VERSION — diverging from the `template-v0.6.0` precedent. Fixed with the `--no-tag` → release PR → `tag-template.ts` composition (R8–R10).
4. **Classifier scope excludes release metadata.** The only non-delivered top-level rows in the current backlog are `templates/CHANGELOG.md`, `templates/README.md`, `templates/README_ko.md` (+ `templates/VERSION`, currently unchanged). Without the scope rule, release artifacts and changelog edits would classify as phantom template changes.
5. **No percentage-based mass-removal tripwire.** The standing 211-deletion backlog would trip any threshold under ~10% on night one and file a noise ticket. Replaced with the four explicit `manual-review` triggers (R6).
6. **The release commit lands via PR, not a direct main push.** No evidence exists of the runner committing directly to main; ADR-0082's PR-only landing discipline is preserved (R9).
7. **Lib/test split.** The classifier lives in `scripts/lib/template-release-classify.ts` with `tests/unit/template-release-classify.test.ts`, matching the `lib/upgrade-policy.ts` precedent for pure decision functions.
