# Design — project-resync v1.7.0: closing the project-coverage gaps (per-project review, merged-landing backports, skill-graph learning)

- **Date**: 2026-10-27
- **Author**: nightly runner session (architect role), user directive 2026-10-27
- **Status**: draft → implemented
- **Skill**: `skills/project-resync/SKILL.md` 1.6.2 → **1.7.0** (root-only; `l2_propagate: false`; no template mirror — verified 2026-10-27)
- **Companion spec**: extends 2026-10-07-daily-fleet-learning-extraction-design (2e/2f); ADR-0031 backport safety unchanged

## Problem (user directive 2026-10-27: the 01:30 nightly batch does not properly perform project-review, backporting, and skill-graph learning for Projects/co-*)

Verified against skill 1.6.2 and the 2026-10-27 nightly run:

1. **No per-project project-review exists anywhere in the nightly.** Phase I reviews the workspace root; Phase 1b reviews `templates/co-*` variants; Phase II runs resync (provenance audit + backport + upgrade). The 16 `Projects/co-*` instances get `resync-audit.ts` (dirty-tree verdicts) and post-upgrade `audit.ts`, but never a review pass. Project reviews only happened in ad-hoc sessions (e.g. co-abap 2026-10-10 full review).
2. **Step 2 (backport) sees only Step-1 LOCAL-WORK.** Its delta source is "each project's committed LOCAL-WORK" — content a project session landed via its own merged PRs (co-newbiz #740–#743, co-design #54, co-price #157 in the 10-26 window) never enters the 5-surface judgment. It is seen only by Step 2e/2f learning extraction, which is requests-only with a 3-landings/night FIFO budget — so backportable work sits in a growing carry list instead of a promote/stays-project verdict.
3. **Skill-graph learning is disconnected from the cycle.** Phase I writes `memory/skill-graph-metrics/snapshot-<date>.json` with per-project skill/node data, but no resync step consumes the per-project deltas: new project-side skills don't feed extraction candidates, and ≥3-project convergence / root-missing delivery gaps surface only in the weekly `skill-graph-analytics` run, not in the nightly.
4. (Doc defect found while diagnosing) Step 2 still says `backport-diff.ts` "was never implemented (T-20261009-003)" — the helper exists at v1.0.2 and ran in the 2026-10-27 cycle.

## Non-goals

- No automation-prompt changes (scheduled session cannot modify server-side automation definitions; the runner follows this skill file verbatim — the skill is the fix surface).
- No change to promotion authority: Step 2 promote rules, ADR-0031 Principle 5 (no automated sibling sync), and the 2e "never write into templates/" rule stand unchanged.
- No new scheduled automation; budget stays inside the existing nightly (wall clock 09:45 KST, ≤4 agents/night, 10 tickets/day shared).

## Changes (skill 1.7.0)

### R1 — Step 2 delta source widened to merged-window landings

Per project, the Step 2 review delta is the union of:

- (a) Step-1 LOCAL-WORK landings (unchanged); and
- (b) **merged PRs in the review window** that are **non-mechanical** (mechanical = title/`gh pr view --json files` content exclusively template-delivery artifacts: `chore: upgrade template…`, `chore: workspace sync…`, changed paths limited to `template-version.txt`, `.claude/last-upgrade-*`, `docs/VERSION_MANIFEST.md`, `memory/`, generated registries). For (b), `backport-diff.ts --base <pre-window-rev>` where pre-window-rev = the project revision before the window's first non-mechanical merge (or `main@{window-start}`), so session-landed work gets the same promote / stays-project / discarded-stale judgment as runner-landed work.

Backport gate, verdicts, echo check (2c), and validate-templates step unchanged.

### R2 — new Step 2g "per-project review" (the missing project-review leg)

Runs inside Phase II, before Step 3:

1. **Battery ALWAYS** (no agents): per project `bun scripts/audit.ts`; PASS/FAIL recorded per project in the cycle report. Any FAIL → same-day ticket (Class column mandatory).
2. **SCOPED review** for every project with a non-mechanical window landing (same set as R1b): one window-scoped read-only reviewer (Explore-class) per project — findings Critical/High/Moderate/Strengths with file:line evidence, Class column (one-time / systemic / script-gap), into the cycle report's per-project section.
3. **ROTATION safety net**: when the scoped set is empty (or ≤2 projects on a heavy night), take exactly one project per night by deterministic rotation (`day-of-year mod N` over the sorted `Projects/co-*` glob) for the same scoped review, so every project is reviewed at least every N nights even when quiet.
4. **Budget binding**: Step 2g agents share the nightly ≤4-agent cap with Phase 1b and Step 2e/2f; when the cap is exhausted, remaining projects degrade to battery-only with an explicit note and carry FIFO to the next night.

### R3 — Step 2e skill-graph learning cross-reference

After the Phase I fleet-report snapshot exists, Step 2e additionally:

- diffs per-project skill sets (and node counts) against the prior snapshot; **new project-side skills this window** join the extraction pass as candidates;
- files a `skill-graph:`-prefixed ticket row when (i) a new/similar skill converges across ≥3 projects, or (ii) the fleet report's delivery gaps show a root skill missing from projects;
- records all of it in the cycle report (report-only; no writes into skills/, templates/, or projects).

### R4 — doc corrections

- Step 2 stale note replaced: `backport-diff.ts` v1.0.2 is the standard aid; document the `--base` window usage (R1).
- Output Format gains "Step 2g: per-project review section" and "skill-graph learning" bullets.
- Frontmatter `last_updated` / `last_reviewed` → 2026-10-27; lifecycle record + VERSION_MANIFEST regenerated (1.7.0).

## Alternatives rejected

- **Separate per-project-review automation**: a second cron multiplies lock contention and cost; the resync cycle already visits every project nightly and owns the window data the review needs.
- **Runner-prompt edit**: impossible from a scheduled session (harness restriction, 2026-10-27); the skill file is the binding procedure the runner follows, so the behavior fix lands without touching the automation.
- **Auto-promote from merged-window deltas**: rejected — promotion stays human-judged (2026-10-07 directive, ADR-0031); R1 only widens what gets *judged and reported*, not what gets *written*.

## Budget/safety analysis

- Agent load: worst case 1b (≤4) + 2g scoped (≤4) + 2e/2f (≤4) exceeds the cap, so the shared ≤4 cap with FIFO carry is restated as binding across all three consumers; battery work is agent-free.
- Wall clock: scoped reviews are window-scoped (small blast radius); rotation adds exactly one project on quiet nights; degraded mode (Phase I ≥3 ERROR) reduces 2g to battery-only.
- Writes: 2g and R3 are read-only + tickets; only Step 2's existing promote path writes templates, unchanged.

## Test / acceptance plan

- Battery: `audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`, `bun test` (root), `propagate-to-templates.ts --check-drift` (tolerated gemini-settings only).
- `generate-version-manifest.ts --check` passes after the manifest regeneration.
- Behavior acceptance: next nightly's cycle report contains a per-project review section (Step 2g) with ≥1 battery table row per project, and Step 2 lists any non-mechanical window PRs as (b)-source deltas — verified at the 10-28 run.
- Rollback: single-file skill revert (v1.6.2) — no script/data migrations.

## Files

- `skills/project-resync/SKILL.md` (1.6.2 → 1.7.0) — R1–R4
- `docs/lifecycle/skills/project-resync.md` — 1.7.0 row + Last Updated
- `docs/VERSION_MANIFEST.md` — regenerated
- `docs/designs/2026-10-27-project-resync-coverage-design.md` — this spec (registered)
