# Per-Session Isolated Worktree Convention — Design

- **Spec id**: `2026-11-07-session-worktree-convention-design`
- **Date**: 2026-11-07
- **Status**: implemented (design registered; normative landings listed in §8 rollout)
- **Ticket**: T-20261106-010 (PM decision: ADOPT with hybrid scope — not a universal mandate)
- **Owner**: workspace-root PM; design by architect (Row 0)

## 1. Problem Statement

Multiple concurrent agent sessions share one checkout of the workspace root
(`/Users/techcross/git/ai_workspace`). A session's write surface is the shared
working tree: its current branch, its staged set, and its untracked files. When
two sessions run concurrently, each one's `git checkout` mutates the other's
state. Three collisions occurred on 2026-11-06 alone:

1. **PR #1863 force-repoint incident.** Branch flips during the #1862/#1863
   landing window: one session's checkout/reset repointed the branch another
   session was actively committing onto
   ([Source: memory/2026-11-06.md line 720 — "branch flips during #1862/#1863"]).
2. **Registry artifacts swept into a foreign commit.** A co-work session
   committed onto the d8-retro-specs branch, sweeping that branch's registry
   artifacts into its own commit; the #1869 landing only preserved integrity
   because content was verified per-file after the fact
   ([Source: T-20261106-010; PR #1869 body — "shared-checkout stacking",
   "cross-session commit contamination (content integrity verified per-file)"]).
3. **Two-phase stash dances in the #1867/#1869 landings.** Landing sessions
   had to set aside foreign in-flight dirt before syncing (copying a foreign
   session's uncommitted memory block to /tmp, stashing its co-work dirt) and
   restore it afterward — fragile manual choreography
   ([Source: PR #1867 body — foreign dirt "stashed and explicitly excluded";
   memory/2026-11-06.md line 608 — foreign block "set aside (copy in /tmp) …
   restored to the worktree after landing"]).

The same workspace has already proven the alternative twice:

- **Co-deck render batch (PRs landed 2026-11-03/06).** "Isolated-worktree
  landing pattern used for both PRs (shared tree contaminated by a parallel
  co-work session's untracked files; nothing absorbed, relocated, or deleted)"
  ([Source: memory/2026-11-03.md lines 514, 853]) — zero contention.
- **Co-work restore inspection.** Read-only inspection performed in a
  worktree while the shared tree was held by another session
  ([Source: T-20261106-010]).

This design codifies the proven pattern as a **hybrid convention**: mandatory
for the collision-prone case, recommended for read-only work, and explicitly
out of scope for PM bookkeeping.

## 2. Root Cause

A dispatched session's write surface is shared mutable state (branch pointer +
working tree), while the existing disciplines assume exclusivity:

- Scoped staging (T-20261001-015, dev-sync step 6) excludes foreign dirt from a
  commit — it protects the **commit content**, but it cannot protect the
  **branch pointer** or the **checkout itself**. Collision 1 is invisible to
  scoped staging.
- `verify branch before mutate` discipline detects a flip **after** it
  happened; it does not prevent it.

The fix is structural, not procedural: give each write session its own branch
pointer and working tree via `git worktree`. Worktrees are a first-class git
feature — each gets an independent HEAD, index, and working tree over the same
object database, so no clone cost and no object duplication.

**Feasibility check (supersedes a stale observation).** memory/2026-11-03.md
line 903 records "in-worktree dev-sync is impossible (CWD guard)". Code
review of the guard (`scripts/dev-sync.ts:392-404`) shows it compares
`process.cwd()` against `path.resolve(import.meta.dir, '..')` — the script's
**own copy's** parent directory. Each worktree owns a full checkout including
`scripts/dev-sync.ts`, so running `bun scripts/dev-sync.ts` from the worktree
root satisfies the guard by construction. The 2026-11-03 failure mode was a
CWD/script-root mismatch (running the shared checkout's script, or running
from a wrong directory), not a fundamental incompatibility. In-worktree
dev-sync is supported. Likewise `git rev-parse --git-dir` inside a worktree
resolves to the worktree's private git dir
(`<repo>/.git/worktrees/<name>`), so the sync PR-body file location is
per-worktree and never collides.

## 3. Decision — Hybrid Rule Set

PM decision (T-20261106-010 triage): **ADOPT with hybrid scope**. The
convention is not a universal mandate; the scope below is normative.

### 3.1 Mandatory (isolated worktree REQUIRED)

A dispatched specialist performing a **multi-file WRITE batch** (code or docs)
MUST work in an isolated `git worktree` branched from `origin/main` whenever
there is evidence of concurrent sessions, defined as ANY of:

- the shared working tree is dirty (`git status --porcelain` non-empty),
- the shared checkout's current branch is not `main`,
- any open PR exists in the repository (`gh pr list --state open` non-empty).

The check runs at dispatch time by the PM (recorded in the task brief) and is
re-checked by the specialist at start (recorded in the task report). The
specialist re-checks because state can change between dispatch and start.

### 3.2 Optional (worktree RECOMMENDED)

- **Read-only tasks** (research, analysis, inspection): a worktree is
  recommended (proven by the co-work restore inspection) but not required —
  a read-only task can never absorb or repoint foreign state.
- **Single-file writes under concurrency evidence**: worktree recommended;
  if the specialist stays on the shared checkout, the existing
  verify-branch-before-mutate discipline applies before every mutating
  command.

### 3.3 Never (stays on the shared checkout)

- **PM bookkeeping**: ticket-yaml moves via `scripts/ticket.ts`,
  memory-log-only changes, CHANGELOG entries. Rationale: these ride the
  dev-sync pipeline's session-entry and scoped-staging machinery, which
  already excludes foreign dirt (collision 3's choreography was needed only
  because a *content* landing shared the tree; pure bookkeeping has no
  branch-flip exposure beyond the existing verify-branch discipline).
- **Trivial single-file changes with no concurrency evidence** (clean tree,
  on `main`, no open PR): shared checkout, existing discipline.

### 3.4 Trade-offs considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| Status quo (discipline only) | Zero new procedure | Collisions recur; recovery is manual choreography | Rejected — 3 collisions in one day |
| Universal worktree mandate | Simplest rule | PM bookkeeping must stay shared (dev-sync session entry is workspace-scoped); overhead for trivial edits | Rejected — over-broad |
| **Hybrid (this design)** | Mandatory exactly where collisions occur; bookkeeping keeps its existing safe pipeline | Trigger requires judgment at dispatch time (mitigated: PM states it in the brief) | **Adopted** |

## 4. Sync-Skill Worktree Landing Variant

A documented variant of the `/sync` pipeline procedure, to be added as a
section in the sync skill (see §8 for file targets). Outline:

1. **Concurrency check**: `git status --porcelain` / `git branch --show-current`
   / `gh pr list --state open` — any hit ⇒ worktree.
2. **Create**: `git fetch origin && git worktree add <path> -b pr/<YYYYMMDD>-<slug> origin/main`.
   Path convention: a sibling directory outside the repository tree
   (`../<repo-name>-worktrees/<slug>`), so no `.gitignore` change is needed
   and worktrees never appear in the repo's own untracked-file surface.
3. **Install**: `cd <path> && bun install` — a fresh worktree has no
   `node_modules`.
4. **Work**: perform all writes inside the worktree; never edit shared-checkout
   paths from the worktree session.
5. **Stage + PR body**: stage task files explicitly (scoped staging rules
   unchanged); write the PR body to
   `$(git rev-parse --git-dir)/sync-pr-body.md` (per-worktree private git
   dir — no collision).
6. **Sync**: run `bun scripts/dev-sync.ts --body-file …` **from the worktree
   root**. The CWD guard passes (guard anchors to `import.meta.dir`; each
   worktree owns its `scripts/` copy). Branch behavior: the pipeline detects
   an existing branch and commits there.
7. **PR**: the pipeline pushes and opens/updates the PR as usual; CI runs
   against the branch — identical to a shared-checkout landing.
8. **Cleanup**: after the PR opens (or merges, per the finishing-branch
   discipline), `git worktree remove <path>` from the shared checkout; the
   shared tree is never touched during the session.
9. **Report**: the task report states the worktree path, branch, and the
   concurrency evidence observed at start.

Branch-name convention is unchanged: `pr/<YYYYMMDD>-<slug>`.

## 5. Checkout-Recovery Convention

When a specialist discovers mid-flight that the shared tree was flipped by a
foreign session (current branch changed, foreign dirt appears):

1. **Do NOT force-restore blindly** — no `git checkout -f`, no
   `git reset --hard`, no branch repointing of another session's in-flight
   branch, no deletion of foreign untracked files.
2. **Stash foreign dirt ONLY if it blocks the required checkout** — scoped,
   named: `git stash push -m "foreign-<session>-<date>" -- <paths>`. Leave it
   otherwise untouched.
3. **Leave foreign commits alone** — another session's branch and its commits
   are not ours to rebase, reset, or delete.
4. **Re-branch from origin/main**:
   `git fetch origin && git checkout -b pr/<YYYYMMDD>-<slug>-retry origin/main`,
   then re-apply own staged work (or move to a worktree per §3.1).
5. **Report the collision** in the task report and the session memory block
   (who flipped, when detected, what was stashed) — the pattern proven in the
   #1867/#1869 landings.

## 6. Affected Files (minimal-touch surface set)

| File | Action | Description |
|------|--------|-------------|
| `docs/governance/agents/workflows.md` | modify | New compact subsection under **§4.1 PM Subagent Dispatch Protocol** (after the Subagent Roster table): "Per-Session Worktree Convention" — the §3 rule set, the recovery convention (§5), and a pointer to the sync-skill variant. This is the ADR-0090 dispatch-protocol SSOT with an explicit load contract ("PM and specialists MUST Read this file before executing the workflow it describes"), so the rule reaches every dispatched session at the moment the convention applies: dispatch. |
| `skills/sync/SKILL.md` | modify | New "Worktree Landing Variant" section carrying the §4 procedure (bumped version per skill-lifecycle rules at implementation time). `skills/` is the SSOT: the pipeline mirrors it to `.agents/skills/sync/SKILL.md` (dev-sync step 4.6) and propagates to `templates/common/.agents/skills/sync/SKILL.md` (steps 4.5/4.62). No mirror is edited by hand. |
| `docs/designs/2026-11-07-session-worktree-convention-design.md` | create | This document (Row 0, landed with the registration record). |

**Surfaces deliberately NOT touched**:

- `AGENTS.md §3/§7` — ADR-0090 thin-dispatcher doctrine already delegates
  dispatch-protocol detail to `workflows.md`, and AGENTS.md §3.1 and §4
  already point there. A second pointer would duplicate SSOT content.
- Any script, hook, `settings.json`, or CI configuration — see §7.
- `docs/templates/common-contract.json` — the `sync` skill entry is
  content-agnostic (source path + version), so no contract change is needed;
  the version field is refreshed by the pipeline at implementation time.

**Platform Impact (MANDATORY)**

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | Docs-only convention; no hooks or platform config changes | `docs/governance/agents/workflows.md`, `skills/sync/SKILL.md` |
| Antigravity (GEMINI.md) | None — justified: the convention is platform-neutral prose read by both platforms from the same two files (workflows.md load contract covers all platforms; sync skill has no platform-specific dispatch mechanics), and no hook/config surface changes | N/A |
| templates/common | Propagation only: the sync-skill variant section flows to `templates/common/.agents/skills/sync/SKILL.md` via dev-sync steps 4.5/4.6/4.62 (known L1 token substitution `CONSTITUTION.md`→`context.md` applies automatically). workflows.md is L0-resident by design. | propagated copy only |

## 7. Enforcement Stance — Advisory Convention + PM Task-Brief Duty, No Machine Gate

The convention is enforced by **procedure, not machinery**:

1. **PM task-brief duty**: at dispatch time, the PM evaluates the §3.1
   concurrency evidence and states the worktree requirement (or its absence)
   in the task brief. A specialist that observes concurrency evidence not
   present at dispatch applies §3.1 itself and notes it in the report.
2. **Post-hoc auditability**: task reports and session memory blocks record
   the worktree path/branch or the shared-checkout justification, so the
   convention is reviewable in project-review passes without any runtime
   instrumentation.

**Why no hook / machine gate**:

- **Non-deterministic trigger.** The mandate's predicate ("evidence of
  concurrent sessions") is a judgment over dirty-tree state, current branch,
  and open-PR liveness at a point in time — cheap for a dispatching agent,
  but a PreToolUse hook would either false-positive on legitimate shared
  bookkeeping (§3.3) or false-negative by the time an Edit fires. Encoding
  the hybrid scope as machine rules would block the sanctioned exceptions.
- **Hook-complexity precedent.** The workspace's hook review history
  (T-20261106-005: TOCTOU window documented, single-PM-limited; delete-guard
  v1.2.0 needing transparent-prefix skips) shows git-plumbing hooks accrue
  bypass enumerations and failure modes faster than they prevent incidents.
  A gate that can be skipped by design is weaker than a stated convention
  with a report duty.
- **Structural backstop already exists.** Scoped staging (T-20261001-015)
  already prevents foreign-dirt absorption at commit time; the residual
  risks the convention targets are branch-pointer flips and checkout
  contention, which a hook on file edits cannot prevent at all — only the
  worktree isolation itself does.

## 8. Rollout

One PR lands the entire surface set (§6): the workflows.md subsection, the
sync-skill section (with version bump, mirrored/propagated by the pipeline),
and this design doc + registration record. No code, no config, no template
content beyond propagation output.

## 9. Acceptance Criteria

- [ ] The three §6 files land in one PR (workflows.md subsection, sync-skill
      variant section, design doc + registration).
- [ ] The next dispatched specialist task that meets a §3.1 trigger works in
      a worktree and its task report records the worktree path/branch (the
      proof is behavioral, verified in the next concurrent session's report
      and project-review pass).
- [ ] No hook, script, or CI gate was added (verifiable from the PR diff —
      docs-only).
- [ ] The 2026-11-03 "in-worktree dev-sync is impossible" observation is
      superseded in the record by this design's §2 feasibility check.

## 10. References

- Ticket: `tickets/governance/T-20261106-010.yaml`
- PRs: #1863 (force-repoint window; parallel-fix-branch note), #1867 (foreign
  dirt stash dance), #1869 (shared-checkout stacking, per-file integrity
  verification)
- Memory: `memory/2026-11-03.md:514,853,903` (isolated-worktree landings; CWD
  observation), `memory/2026-11-06.md:608,720` (foreign-block choreography;
  branch-flip flag)
- Mechanics: `scripts/dev-sync.ts:392-404` (CWD guard anchored to
  `import.meta.dir`); dev-sync branch behavior (existing-branch commit path);
  scoped staging (T-20261001-015)
