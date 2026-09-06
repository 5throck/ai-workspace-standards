---
name: project-resync
version: 1.0.0
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
last_reviewed: 2026-09-06
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
5. **PR base = project default branch** (co-develop uses `master`); verify
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
| STALE-RESIDUE | equals an older revision of the current L0/L1/L2 source | snapshot → discard (tracked: `git checkout --`, untracked: delete) |
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
- Produce the per-variant judgment report (promoted / stays-project /
  discarded-stale) — it feeds Step 3's PR body and the root CHANGELOG.
- Validate: `bun scripts/validate-templates.ts`, `bun test` (root).

## Step 3 — Root PR

Standard `/sync` with the Step-2 report; merge before Step 4 (sequential
branch rule — upgrades must see merged templates).

## Step 4 — Upgrade projects

Per project: `bun scripts/upgrade-project.ts Projects/<p> --dry-run` → review
category plan → run → verify `.claude/template-version.txt` and project
`bun scripts/audit.ts`.

## Step 5 — Upgrade PRs + final verification

Per project: dev-sync `chore: upgrade template to <version>`, merge CLEAN,
default + pull + delete branches. Final gate: all projects have clean trees,
0 unpushed, 0 open PRs, passing audits; root audit + validate-templates pass.

## Output Format

- Step 0: audit tables (script output) + applied-verdict summary per project.
- Steps 1/5: per-project PR URLs + merge states.
- Step 2: per-variant judgment report.
- Cycle summary: one table — project → synced? / promoted? / upgraded? / final state.

## Related Skills

- **sync**: single-repo commit→PR pipeline (used inside projects and at root).
- **upgrade-project**: L2→L3 delivery (Step 4).
- **project-to-variant**: standalone-project promotion (different concern —
  not part of this cycle).
