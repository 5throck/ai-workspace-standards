---
name: project-resync
version: 1.5.1
description: >
  Full bidirectional sync cycle for Projects/co-* instances: provenance-audit
  uncommitted content, sync each project to its GitHub remote, selectively
  promote reusable work back into templates/L0, run the root /sync, upgrade
  projects from their variant templates, and land upgrade PRs. Use when:
  user says "project-resync", "resync projects", "resync the project fleet",
  "sync project cycle", or asks to sync/backport/upgrade the Projects/* fleet.
  Distinct from the `sync` skill (single-repo commit→PR pipeline): this is the
  whole-fleet, bidirectional cycle.
status: active
scope: common
l2_propagate: false
owner: pm
last_reviewed: 2026-09-23
prerequisites: gh CLI authenticated; workspace-root CWD
relates_to:
  - skill: sync
    type: composes_with
  - skill: upgrade-project
    type: follows
  - skill: project-to-variant
    type: relates_to
metadata:
  type: orchestration
  triggers:
    - project-resync
    - resync projects
    - sync project cycle
---

# project-resync

Full bidirectional sync cycle for the `Projects/co-*` fleet. One run covers:
provenance audit → GitHub sync → selective backport → root PR → upgrades →
upgrade PRs. **Safety first: nothing is pushed without a dated provenance
verdict** — stale sync-wave residue must never pollute a remote.

## Safety Rules (non-negotiable)

1. **Audit before any commit/push** (Step 0). No verdict → no action.
2. **Never commit STALE-RESIDUE verdicts.** Snapshot locally before discarding;
   snapshots are never pushed.
3. **Never use `--no-verify`** or bypass either the project's or the
   workspace's sync gates.
4. **Remote bootstrap**: remote-less repos get `gh repo create 5throck/<name>
   --private` + `git remote add origin` — private strictly, no
   collaborators/topics unless asked.
5. **PR base = project default branch**; verify
   before merging.
6. **Backport gate**: promote only template-grade, reusable content. Engagement
   output, domain stacks, and VARIANT-INJECT content stay in the project
   (ADR-0031). Never backport deprecated skills.
7. KEEP-uncertain defaults to COMMIT-side review, never silent deletion.

## Step 0 — Provenance audit

```bash
bun scripts/resync-audit.ts --snapshot-dir /tmp/resync-snapshots
```

Review the per-project verdict tables:

| Verdict | Meaning | Action |
|---|---|---|
| STALE-RESIDUE | equals a current L0/L1/L2 source, or an older revision corroborated by project mtime older + line-order agreement | snapshot → discard (tracked: `git checkout --`, untracked: delete) |
| PRESUME-STALE | subset of a source without mtime/order corroboration — possible deliberate reordering or legitimate deletion | human confirm before discard; routes to commit-side review like LOCAL-WORK |
| LOCAL-WORK | diverges from HEAD and every source; or non-template file | commit candidate (Step 1); feeds backport review (Step 2) |
| KEEP | unresolvable | human review; default to commit on a side branch if risky |

Apply verdicts only after reading the MIXED-group per-file details.

## Step 1 — Sync each project to GitHub

Per project (clean of STALE-RESIDUE now):

1. Commit the LOCAL-WORK set via the **project's own dev-sync** (mandatory
   pathway; creates `pr/<ts>-<slug>` + PR with audit gates):
   `bun scripts/dev-sync.ts --body-file <body> "<english conventional message>"`.
2. Bootstrap remote-less repos first (`gh repo create 5throck/<x> --private`,
   `git remote add origin`, push current branch).
3. Merge each PR when checks are CLEAN; checkout default + pull; delete
   branches. Projects with no changes (or already-pushed commits only): just
   push / skip.

## Step 2 — Selective backport review

Diff each project's committed LOCAL-WORK against its variant surface
(`templates/co-<x>/`) using the 5-surface method
(docs/designs/2026-08-28-project-template-backport-design.md):

- **Promote** template-grade, reusable assets into `templates/co-<x>/` (or L0
  for cross-variant assets) — after measuring that the project copy is
  genuinely newer/richer, not just divergent.
- **Stays-project**: engagement output, domain content, VARIANT-INJECT blocks.
- Optional aid: `bun scripts/backport-diff.ts --project <co-name> [--base <commit>]`
  — read-only per-file candidate table (surface / divergence direction /
  +added/-removed) over the committed range (L0-only).
- Produce the per-variant judgment report (promoted / stays-project /
  discarded-stale) — it feeds Step 3's PR body and the root CHANGELOG.
- Validate: `bun scripts/validate-templates.ts`, `bun test` (root).

## Step 2b — Evidence plane review

Run `bun scripts/evidence-backport-scan.ts`. Read-only: reports candidates, never
writes into `templates/` or into any `Projects/co-*` instance (design
docs/designs/2026-09-19-actor-model-and-evidence-backport-design.md §4, ADR-0084
Decision 6).

For each project, record the detected form (F1 prose ledger / F2 registry-backed /
F3 schema-typed / F0 unrecognized / MIXED / none), the M1-M6 maturity results, and
the verdict:

| Verdict | Meaning | Action |
|---|---|---|
| PROMOTABLE | form real + all of M1-M6 pass | promote (see below) |
| SCHEMA-ONLY | M6a passes (a procedure exists) but M6b fails (not repeatedly used) | human-triage row; do not promote |
| NOT_YET | some other maturity test failed | human-triage row; do not promote |
| NEEDS_TRIAGE | F0, MIXED, or no evidence-shaped content at all | human-triage row; do not promote |

Promote only `PROMOTABLE` candidates, and only by authoring the **pair** — under
`templates/co-<x>/`:

- the F3 schema (`evidence-models/<record-type>.schema.json`, regardless of the
  source form),
- its companion `evidence-collection-<name>` skill (a generalization of the
  source collection procedure — never a copy of engagement-specific content),
- a provenance `README.md` recording the source project, source form, the skill
  path that satisfied M6, the commit range the maturity bar was measured over,
  and the M1-M6 results.

A schema promoted without its companion procedure is an incomplete backport and
MUST be rejected at review. Route `F0`, `MIXED`, `SCHEMA-ONLY`, and any
`NOT_YET` verdict to the cycle report as human-triage rows. Never auto-write
into `templates/`. Safety Rule 6 (backport gate) governs this step unchanged.

## Step 2c — Fleet echo check

For each backport-worthy LOCAL-WORK candidate from Step 2, check whether the
same change (fix, improvement, or gap) echoes across the rest of the fleet:

1. Derive a fixed query per candidate: its distinctive identifiers or strings
   (symbol names, error messages, config keys — stable tokens that only match
   the changed code).
2. Run the query across ALL `Projects/co-*` repos, scoped to the surface the
   candidate came from (e.g.
   `grep -rn "<identifier>" Projects/*/skills/ Projects/*/scripts/`).
3. Record a per-project verdict in the Step 2 judgment report:

| Verdict | Meaning | Action |
|---|---|---|
| same-defect-present | the sibling carries the same pre-fix content | row in the cycle report — the fix lands in that project's own next resync |
| absent | the sibling has no matching content (different lineage, or already resolved) | no action |
| divergent-implementation | the sibling solves the same problem differently | human-triage row — possible cross-project learning, never merged mechanically |

Report-only: this step never edits sibling projects. ADR-0031 Principle 5
(`docs/adr/0031-l1-l2-fork-model.md`) forbids automated sibling sync — drift
REPORTING is the sanctioned direction. Each project adopts its echo fixes
through its own reviewed resync cycle.

## Step 3 — Root PR

Standard `/sync` with the Step-2 report; merge before Step 4 (sequential
branch rule — upgrades must see merged templates).

## Step 4 — Upgrade projects

Per project: `bun scripts/upgrade-project.ts Projects/<p> --dry-run --prune-removed` →
review category plan → run with the same flags → verify
`.claude/template-version.txt` and project `bun scripts/audit.ts`.

`--prune-removed` is mandatory in this cycle: the upgrade engine is
`L0`-only (ADR-0073 Amendments 1 and 3 — engine-only scope;
`lib/upgrade-policy.ts` stays delivered as the shared data module project
`dev-sync.ts`/`validate-templates.ts` import), so any project still holding
an engine copy (`scripts/upgrade-project.ts`, `helpers/skills-registry.ts`)
gets it retired by this flag — v1.44.0 also drops the pruned script's
registry row itself. A registered project-local script (SCRIPTS.md source
cell = the variant name) is never pruned; if one still disappears, that is a
pruner defect — file a ticket, do not hand-restore silently.

Since `upgrade-project` v1.19.0 the delivered scripts` SCRIPTS.md
registry rows reconcile automatically (common-registry fallback, layer
rewrite, duplicate-row removal). Still proof-check the upgrade:
`bun scripts/verify-scripts.ts --verify` per project must exit clean — an
unregistered script there means the reconcile missed a case (report it,
do not hand-patch silently). Upgrades must run on a clean tree: the
pre-upgrade `git stash push` snapshot reverts uncommitted tracked changes.
Note the upgrader is workspace-side only (`L0`, ADR-0073 Amendment 1) —
invoke `bun scripts/upgrade-project.ts …` from the workspace root; from
inside a project use `bun ../../scripts/upgrade-project.ts .`.

## Step 5 — Upgrade PRs + final verification

Per project: dev-sync `chore: upgrade template to <version>`, merge CLEAN,
default + pull + delete branches. Final gate: all projects have clean trees,
0 unpushed, 0 open PRs, passing audits; root audit + validate-templates pass.

## Step 6 — Fleet branch cleanup + root final sync

After Step 5's merges:

1. **Remote PR branches**: for every project, delete merged `pr/*` branches —
   `git -C <project> branch -r --merged origin | grep 'origin/pr/'` →
   `git -C <project> push origin --delete <branch>`; then `git fetch --prune`.
   (Repos with auto-delete-on-merge need only the prune.)
2. **Local PR branches**: `git -C <project> branch --list 'pr/*'` → `-D` after
   verifying each is merged. Return every repo to its default branch + pull.
3. **Root final sync**: root must be on `main`, pulled, clean (`git status`).
4. Emit the final state table — per project: dirty / unpushed / open PRs /
   template version — all zeros before declaring the cycle complete.

## Output Format

- Step 0: audit tables (script output) + applied-verdict summary per project.
- Steps 1/5: per-project PR URLs + merge states.
- Step 2: per-variant judgment report.
- Step 2b: evidence-backport-scan verdict table per project + human-triage rows.
- Step 2c: fleet echo-check verdict table per backport candidate.
- Cycle summary: one table — project → synced? / promoted? / upgraded? / final state.

## Related Skills

- **sync**: single-repo commit→PR pipeline (used inside projects and at root).
- **upgrade-project**: L2→L3 delivery (Step 4).
- **project-to-variant**: standalone-project promotion (different concern —
  not part of this cycle).
