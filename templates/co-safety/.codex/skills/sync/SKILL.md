---
name: sync
description: Runs the full project sync pipeline — lifecycle update, audit, L0→L1 publish, commit, push, and PR creation.
version: 1.11.0
last_reviewed: 2026-11-28
status: active
scope: co-safety
l2_propagate: true
owner: pm
prerequisites: Bun runtime
metadata:
  type: process
  triggers:
    - sync
    - /sync
    - commit and push
    - create PR
---

# Skill: sync

## Context

Runs the full project sync pipeline (`scripts/dev-sync.ts`). This is the single mandatory pathway for all workspace commits — it handles lifecycle finalization, audit gating, L0→L1 template propagation, git branch creation, commit, push, and PR creation in one orchestrated flow.

## When to Use

- After completing any set of file changes that should be committed, pushed, and PR'd
- When the user says "commit", "push", "create PR", "/sync", or "finish this branch"
- At the end of any execution plan row or multi-agent task
- As the final step in any workspace governance workflow (Phase 5/6 of the Harness Engineering Workflow)

## Output Format

- A git branch `pr/<timestamp>-<slug>` created (or reused) from `main`
- A commit with the task-staged files plus pipeline-generated files and a conventional commit message
- An open GitHub PR with the agent-written body (Why / What Changed / Test Plan / Security Checklist / Notes)
- Console output listing each pipeline step and its result

## Execution Steps

0. **Stage the task files** (BEFORE invoking the pipeline): `git add <task files>`. Only explicitly task-staged files plus files the pipeline itself generates (memory log, VERSION_MANIFEST, propagation output, ...) are committable. Dev-sync snapshots the working tree at start and at commit time. Any working-tree change that is neither task-staged nor pipeline-generated is EXCLUDED from the commit by default (scoped staging, T-20261001-015 soak exit; design: `docs/designs/2026-09-12-dev-sync-scoped-staging-design.md`) — stage everything the commit needs explicitly. To restore the legacy WARN-soak sweep, set `SYNC_SCOPED_STAGING=0` or pass `--warn-staging`. Never rely on `git add -A` to pick up your edits. Never leave unrelated dirt in the tree when syncing. Within the sweep, ignored paths are classified: tracked-but-ignored paths are force-staged (`git add -f`, one log line per path), while untracked-but-ignored paths are WARN-listed and skipped — never force-added (dev-sync 1.50.0; design `docs/designs/2026-11-17-root-machinery-batch-design.md`).

1. **Write the PR body** (the agent writes it — never shell out to an LLM CLI):
   - Inspect the change: `git diff HEAD~1 --stat` and `git diff HEAD~1 --name-only` (first 30 files).
   - Write the body in English using EXACTLY this structure (keep all section headers, fill placeholders):

     ## Why
     [1-3 sentences: what problem does this solve and why now?]

     ## What Changed
     [concise bullet list of actual changes — be specific, not generic]

     ## Test Plan
     - [ ] `bun scripts/audit.ts` passes
     - [ ] [add relevant manual or automated test steps]

     ## Security Checklist
     - [ ] No secrets, credentials, or API keys committed
     - [ ] No `.env` files staged (use `.env.sample` for templates)
     - [ ] Dependencies unchanged or reviewed for new CVEs

     ## Notes
     [Breaking changes, deployment steps, or reviewer guidance. Write 'None' if not applicable.]

     ---

   - Save it to `<git-dir>/sync-pr-body.md`, where `<git-dir>` is `git rev-parse --git-dir` (e.g. `.git/sync-pr-body.md`) — outside the working tree so it is never committed.

2. Run the sync script with the provided arguments, passing the body file:
   ```bash
   bun scripts/dev-sync.ts --body-file "$(git rev-parse --git-dir)/sync-pr-body.md" "$ARGUMENTS"
   ```

   Branch behavior (dev-sync 1.27.0+; T-20261012-011 / T-20261013-005):
   - On `main`/`master` the pipeline creates a fresh `pr/<timestamp>-<slug>` branch from the staged set — the PR title derives from the **full branch-vs-main diff** (`origin/main...HEAD`), never the message alone, so the review surface stays represented.
   - On an existing branch it commits there — **unless that branch's PR is CLOSED (unmerged)**, which is refused: a dead branch under-represents the review surface (#1509's 45 files re-landed as a 1-file #1510). Re-branch from main and re-run.
   - **Prefer fresh branches for superseding deliveries**: a reused branch can hit GitHub-server-side merge conflicts that a local 3-way merge reports clean (#1526 case). When `gh pr update-branch` refuses, re-branch the identical diff from current main, open a new PR, close the old one as superseded.
   - When `gh pr view` fails with 403/GraphQL (cloud sessions), dev-sync resolves the open PR via the REST API (1.28.0).

3. The pipeline executes the following steps in order:

| Step | Name | Fatal? | Description |
|------|------|:------:|-------------|
| 0 | CWD Guard | **FATAL** | Verifies script runs from workspace root; exits if CWD mismatches `import.meta.dir/..` |
| 1 | Language Gate | **FATAL** | Commit message / PR title must be English (context.md S3); blocks non-English via `language-guard.ts` |
| 2 | Memory Session Entry | **FATAL** | Appends session summary (changes, decisions, open issues) to `memory/YYYY-MM-DD.md` |
| 2 | MEMORY.md Index Sync | **FATAL** | Updates `memory/MEMORY.md` index via `sync-md.ts` |
| 2.5 | scripts/README.md Generation | **FATAL** | Regenerates `scripts/README.md` via `generate-scripts-readme.ts` if the script exists |
| 3 | CHANGELOG.md Check | **FATAL** | Checks `CHANGELOG.md [Unreleased]` — **blocks and exits** if empty (agent must add entries first via `/changelog` or manual edit) |
| 3.6 | Deprecated Script Warnings | non-fatal | Scans `SCRIPTS.md` for deprecated scripts and prints warnings |
| 3.7 | L0/L1 Script Drift Check | non-fatal | Runs `verify-scripts.ts --check-drift` to detect drift between L0 and L1 script copies |
| 3.8 | Memory File Archival | non-fatal | Runs `archive-memory.ts` to archive old memory files |
| 3.9 | Spec Registry Check | **FATAL** (L0) | Runs `audit.ts --spec-check --lifecycle-only` — blocks on the spec-relevance Fail (code diff with no spec activity; ADR-0055 Stage 2) and any always-on audit Fail; stale/missing-spec stay WARN; escape hatch `--spec-exempt=E1-E5` (AGENTS.md §5.1.1); substantive LLM-assisted work must reach this gate through the PM routing path (ADR-0078); a missing `docs/specs/registry.json` is a loud WARN (gate INACTIVE — Universal Design Gate, ADR-0074; activate via `spec-register.ts`; the registry seed ships to projects add-if-missing) |
| 3.95 | QA Pre-checks | non-fatal | Runs project tests (if `package.json` has `test` script) and warns if `README_ko.md` is missing |
| 3.95b | Typecheck Gate | **FATAL** (L0) | Runs `scripts/typecheck.ts` — `tsc --noEmit` over `scripts/` against the zero-error baseline (`scripts/helpers/typecheck-baseline.json`; T-20260910-012). Root context only; L1+ contexts skip cleanly via the missing-baseline guard. Never raise the error count — fix the error instead |
| 3.96c | Session-Evidence Skill Review | non-fatal | Runs `skill-session-review.ts` — accumulates Observed Symptom + Evidence from the day's `## Skills Used` section into `memory/skill-review/` (diagnosis/candidate left empty for human triage); plus a non-fatal full `skill-dependency-analysis.ts --report` pass (SkillHone-inspired loop; design doc `docs/designs/2026-09-06-skill-session-review-design.md`) |
| 3.97 | Governance Reflection Gate | **FATAL** (L0) | Runs `verify-adr-governance.ts --strict` — blocks sync when post-cutoff Accepted ADRs lack governance-doc references (ADR-0059 Stages 2+2b: unlinked-ADR and marker-drift findings block); skipped in scaffolded projects (L0-only validator) |
| 4.52 | Template Dependency Sync | **FATAL** (L0) | Runs `sync-template-deps.ts --apply` — aligns shared dependency versions from root `package.json` into `templates/common/package.json` and regenerates `bun.lock` (shared keys only; root-only deps never added, template-only deps never removed); workspace-root gated |
| 4.6 | Skill Sync to Platforms | non-fatal | Runs `sync-skills.ts` to distribute skills to `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`; warnings only |
| 4.7 | VERSION_MANIFEST.md Generation | **FATAL** | Generates `VERSION_MANIFEST.md` via `generate-version-manifest.ts` |
| 4.85 | Version-Bump Test Gate | **FATAL** | When the task-staged change set bumps a version (a `SKILL.md` frontmatter `version:` line or a script `@version` header line changed), runs `bun run test:unit` BEFORE the audit gate; a failing suite blocks the sync. Skipped cleanly when `package.json` has no `test:unit` script (L1+ projects) and when nothing staged bumps a version. No escape env var — fix the tests or unstage the bump (detection: `scripts/helpers/version-bump.ts`; user directive 2026-10-08) |
| 4.9 | AUDIT GATE | **FATAL** | Runs `audit.ts` — must exit 0 before proceeding. Includes the auto-activating gates: skill-graph drift (ADR-0060) and upgrade coverage (`check-upgrade-coverage.ts --strict`, ADR-0073) |
| 5 | Branch Creation | **FATAL** | Creates `pr/<timestamp>-<slug>` branch if on main/master; reuses existing branch otherwise |
| 6 | Sensitive File Guard + Scoped Staging + Commit/Push | **FATAL** | Guards against `.pem`, `.key`, `.env`, `credentials.json`, etc.; scoped-staging check (S0/S1 tree snapshots — WARN-lists files that are neither task-staged nor pipeline-generated; excluded by default; `SYNC_SCOPED_STAGING=0`/`--warn-staging` restore the legacy sweep), then `git add`, `git commit`, `git push` |
| 7 | PR Creation | **FATAL** | If `--body-file` was passed, validates it (English) and opens the PR via `gh pr create --body-file`; otherwise falls back to `gen-pr-body.ts` template, `.github/pull_request_template.md`, then `gh pr create --fill`; idempotent — updates existing PR if one already exists for the branch |

4. If audit fails, fix the reported issue before re-running.

## Conditional Steps (opt-in detection — sync-embedded backport detection)

These two steps run ONLY when the detection gate is ON. The gate check below is UNCONDITIONAL — every sync performs it and must state the outcome (on/off) in its log; silently skipping the check itself is a process violation. When the gate is OFF, steps 5–6 are skipped entirely and /sync behavior is byte-identical to the pre-detection pipeline (zero new artifacts, zero new behavior — AC-1 of `docs/designs/2026-11-17-sync-auto-detection-design.md`).

5. **Detection & filing — CONDITIONAL (gate check first, design §5.2/§5.4/§5.8)**:
   1. **Gate check (always performed)**: read the project's `variant.json` top-level `syncDetection` block AND check whether this sync invocation carried a `--detect-backport` argument. Gate is ON iff `syncDetection.enabled: true` (config) OR the invocation carried `--detect-backport` (one-off override; explicit argument > config). Absent key / `enabled: false` / no argument = feature OFF — log `sync-detection: disabled (feature off)` and skip steps 5.2–6 entirely. A malformed `syncDetection` block is treated as OFF by the detector with a stderr warning; the shape is validated loudly by `the L0 template lifecycle validator` (check `sync-detection`), so fix the config instead of relying on the silent OFF.
   2. **Run the detector**: `bun scripts/detect-backport.ts --json > "$(git rev-parse --git-dir)/detect-backport-report.json"` — pass `--detect-backport` as well when the gate source is the invocation argument. The script reads only project-local facts (never diffs against `templates/`), writes the report + dedupe state to `<git-dir>/` (outside the working tree, never committed), and prints a console summary. Read the report (schema `detect-backport-report/1`).
   3. **Filing** (§5.4 single channel — the upstream-request MCP for both kinds; `upstream_request_create`):
      - `template-defect` candidates with disposition `within-cap` and `suggested_action: file-upstream` → file via `upstream_request_create` with `suspected_layer` from the claim class (delivered-common file → L1, variant-delivered file → L2, ambiguous → unsure), the report's `affected_paths`, and `drafted_symptom` as input. The session reviews and may refine the wording before calling (the script's text is declarative input, not the verbatim contract).
      - `reusable-asset` candidates with disposition `within-cap` → file via `upstream_request_create` with `suspected_layer: "unsure"` and the symptom prefixed `[sync-detect:reusable-asset]` (lands inbox; promotion into `templates/` stays human-judged — ADR-0031).
      - `over-cap`, `duplicate-local`, and `already-filed` rows (E1 markers carrying real U-ids) are report-only — never re-filed; they stay visible in the report.
      - After each defect filing, mark the patch site with the returned `LOCAL-PATCH(upstream-request: <id>)` marker and update any `pending` E1 markers with the real id (closes the upgrade-report loop `local-patch-scan.ts` serves).
   4. **Notes line**: append one line to the PR body Notes section and the task log: `sync-detection: N candidates, M filed, K over-cap`.
   5. **Upgrade-warning line (§5.8 — warning-only, NEVER blocking)**: refine the report's `unresolved_template_defects` pending set by dropping U-ids whose `upstream.resolution = fixed` (looked up via `upstream_request_status`). When the refined count > 0, print and append to the same Notes line: `sync-detection: N unresolved template defects (upgrade NOT blocked; report: <git-dir>/detect-backport-report.json)`. An unresolved template defect never blocks the sync, the landing PR, the auto-merge, or an upgrade — no gate, exit code, or enforcement hook attaches to this line; the safety net is the pre-existing CONFLICT/PROJECT_EVOLVED preserve semantics of `lib/upgrade-policy.ts`.
   6. **Standalone-upgrade gap case (§5.8 placement ruling)**: an upgrade wave applied outside this flow never runs detection. The upgrade-delivery guidance reads the last persisted `<git-dir>/detect-backport-report.json` when it exists and prints the same warning-only line when `unresolved_template_defects.count > 0`; an absent report (feature off / never run) produces no warning — documented designed behavior, not a defect.

6. **Auto-merge close-out — CONDITIONAL (gate ON only; design §5.6; SSOT ADR-0105)**: merge the flow's own landing PR by the predicate below, then apply the same predicate at close-out to open self-authored PRs. The skill cites the ADR-0105 conditions rather than redefining them:
   1. **Author guard**: PR author is this project's own automation identity or the user (ADR-0105 condition 4); a PR carrying foreign/ridden commits is never merged (condition 5) — report it instead.
   2. **Protected-path guard**: the PR's changed files intersect no governance-control path — `.githooks/**`, `scripts/hooks/**`, `.claude/settings.json`, `.gemini/settings.json`, `docs/context.md`, `scripts/SCRIPTS.md` (ADR-0105 §2 protected-path class, project layout). Hit → human merge only.
   3. **Checks-green arm**: `gh pr checks` reports all checks succeeded (a repo with no CI workflows qualifies vacuously — nothing ever ran to fail).
   4. **Billing-block arm** (ADR-0105 conditions 1–2, standing disposition): the head SHA has a startup_failure-class failure — annotation "recent account payments have failed or your spending limit needs to be increased", `runner_id 0`, zero steps. "No checks appeared" is not evidence; the wall is the known account-level state (T-20261110-008 / DEC-20261110-03), not re-diagnosed per PR. Conditions 3/7/8 are satisfied at project scope: dev-sync's own audit/typecheck/test gates already ran locally before this PR exists, the session merges only its own 1–N PRs (no wave), and the merge evidence lands in the task log.
   5. **Never-merge floor**: any other failure class (test failure, timeout, missing required check that is not startup_failure) → the PR stays open and the failing condition is reported. Real failures never auto-merge.
   - **Close-out**: after the landing PR resolves, enumerate `gh pr list --state open`, apply the predicate to each self/user-authored PR, merge qualifying ones (squash/merge per repo convention), and report any that stay open with the failing condition. Foreign-authored PRs are reported, never merged.

## Worktree Landing Variant

When concurrency evidence exists (shared tree dirty, shared checkout off `main`, or any open PR), land multi-file write batches from an isolated worktree instead of the shared checkout. Full rule set and rationale: `docs/designs/2026-11-07-session-worktree-convention-design.md` (T-20261106-010). PM bookkeeping (ticket moves, memory-log-only, CHANGELOG entries) and trivial single-file changes stay on the shared checkout.

1. **Concurrency check**: run `git status --porcelain`, `git branch --show-current`, and `gh pr list --state open`. Any hit selects this variant.
2. **Create the worktree**: `git fetch origin && git worktree add ../<repo-name>-worktrees/<slug> -b pr/<YYYYMMDD>-<slug> origin/main`. Keep the path outside the repository tree: no `.gitignore` change is needed and worktrees never appear in the repo's own untracked-file surface.
3. **Install**: `cd <worktree-path> && bun install`. A fresh worktree has no `node_modules`. dev-sync self-provisions the rest on first run (step 3.94, worktree-robustness design 2026-11-28): nested package installs (depth-2 `package.json` dirs lacking `node_modules` — e.g. `app/web-next`), plus the declared Python env via the variant's `variant.json` `script_manifest.provision.python` hook when `.venv/bin/python3` is absent; both are idempotent (re-runs are no-ops) and nothing is mirrored (no `.env`, no `.venv` copy). Keep the manual one-liners below for pre-provisioning if you want the first sync's test gate warm from the start: nested install = `cd <worktree-path>/<nested-package-dir> && bun install`; Python env = `cd <worktree-path> && bun <variant.json script_manifest.provision.python> --soft`.
4. **Work**: perform all writes inside the worktree. Never edit shared-checkout paths from the worktree session.
5. **Stage + PR body**: stage task files explicitly (step 0 scoped-staging rules unchanged). Write the PR body to `$(git rev-parse --git-dir)/sync-pr-body.md`. Inside a worktree, `git rev-parse --git-dir` resolves to the worktree's private git dir (`<repo>/.git/worktrees/<name>`), so the body file is per-worktree and never collides with a concurrent session's file.
6. **Sync**: run `bun scripts/dev-sync.ts --body-file "$(git rev-parse --git-dir)/sync-pr-body.md" "$ARGUMENTS"` **from the worktree root**. The CWD guard (step 0 of the pipeline) compares CWD against the script's own copy's parent directory (`import.meta.dir` anchor), and each worktree owns a full checkout including `scripts/dev-sync.ts`, so the guard passes by construction. This supersedes the 2026-11-03 "in-worktree dev-sync is impossible" observation, which was a CWD/script-root mismatch, not a fundamental incompatibility. On the pre-created branch, the pipeline commits there (step 2 branch behavior applies unchanged).
7. **PR**: the pipeline pushes and opens or updates the PR as usual. CI runs against the branch - identical to a shared-checkout landing.
8. **Cleanup**: after the PR opens (or merges, per the finishing-branch discipline), run `git worktree remove <worktree-path>` from the shared checkout. The shared tree is never touched during the session.
9. **Report**: state the worktree path, the branch, and the concurrency evidence observed at start in the task report.

## Session Evidence Duty (`## Skills Used`)

While the session is still open — BEFORE invoking `/sync` — record the skills
actually loaded this session into `memory/YYYY-MM-DD.md` under `## Skills Used`
(one block per skill; schema in the skill-lifecycle standards, §6.6
Session-Evidence Skill Review Loop, and `docs/designs/2026-09-06-skill-session-review-design.md`). If the section was not filled before
sync, the dev-sync step 2 skeleton is appended as a comment for later editing.
Step 3.96c consumes this evidence automatically; it never modifies skills.
Step 2 tags its session-summary block with `<!-- dev-sync:session branch=<branch> -->`: a same-branch re-run on the same day REPLACES that block — carrying the `## Skills Used` section forward verbatim — instead of appending a duplicate; legacy markerless blocks keep the plain append.

## Related Skills

- `scripts/dev-sync.ts` — Core sync pipeline implementation
- `scripts/detect-backport.ts` — Opt-in detection script invoked by conditional step 5 (gate: `variant.json` `syncDetection` or `--detect-backport`; design `docs/designs/2026-11-17-sync-auto-detection-design.md`)
- `skills/gateguard/SKILL.md` — Pre-edit quality gate (run before edits that lead to sync)
- `context.md §3` — PR workflow and branch rules

## PR Language Rule

All PR titles and bodies generated by this command **must be written in English**, regardless of the active session language. This applies to the agent-written body in step 1 and to any `gh pr create` / `gh pr edit` calls — `dev-sync.ts` blocks non-English bodies at the same `language-guard` gate used for commit messages.
