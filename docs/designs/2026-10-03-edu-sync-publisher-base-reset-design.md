# Design: edu-sync publisher base reset

- **Spec ID**: `2026-10-03-edu-sync-publisher-base-reset`
- **Date**: 2026-10-03
- **Status**: implemented (this PR)
- **Trigger**: failed `edu-sync` run of 2026-10-02 — the trusted "Publish patches" step exited 128 at `git am` ("patch does not apply" on 8 files in `5throck/intro-to-ai-harness`)
- **Related**: T-20260912-026 (two-phase credential separation), T-20260926-015 (publisher hardening), DEC-20261003-01

## Summary

The publisher step rebuilt the sync branch from wherever the AI agent left HEAD.
When the agent follows its prompt exactly, it commits on `edu-sync/<date>` and
stays there, so `git checkout -B` (no start-point) "resets" the branch onto the
agent's tip and `git am` applies each patch onto a tree that already contains
the patch's post-image. Every touched file fails pre-image matching and the job
dies before the second repo is processed. The fix makes the publisher's start
state a deterministic function of the remote: resolve the remote default branch
from `refs/remotes/origin/HEAD`, reset the worktree to that tip, and apply the
audited patch bundle on top. The patch bundle stays the single source of truth;
the agent's local commits are expendable. This restores the T-20260912-026
invariant: the deterministic step must not depend on agent behavior.

## Failure trace (2026-10-02 run)

1. Agent cloned `intro-to-ai-harness` (`--depth 1`), created `edu-sync/2026-10-02`, committed 1 patch, exported the bundle. HEAD = agent tip.
2. Publisher: `base=$(git rev-parse HEAD)` captured the agent tip. `git checkout -B edu-sync/2026-10-02` reset the existing branch onto that same tip ("Reset branch" in the log).
3. `git am --keep-non-patch` checked each hunk's pre-image against files that already carried the post-image → `patch does not apply` on all 8 files → exit 128.
4. `set -e` stopped the loop; `multi-agent-harness-handbook` was never processed. Baseline did not advance (publish outcome = failure), so the range re-processes next run — no content is lost, only the run is wasted.

## Root cause

`git am` applies patches relative to a base. The publisher assumed HEAD equals
the remote default-branch tip at publish time. Nothing enforces that assumption;
the agent's own prompt instructs it into the breaking state (commit and remain
on the sync branch). `git am -3` is not a remedy here: the clones are
`--depth 1` (implies `--single-branch`), so the patches' pre-/post-image blobs
are absent and 3-way merge cannot build a fake ancestor.

## Files to change

| File | Action | Description |
|------|--------|-------------|
| `.github/workflows/edu-sync.yml` | modify | Publisher: resolve `origin/HEAD`, reset to it before `git am`, force-push the rebuilt branch, tolerate an already-open PR |

## Requirements

1. The publisher shall resolve the remote default branch from
   `git symbolic-ref --short refs/remotes/origin/HEAD`.
2. The publisher shall exit with an error when the resolution fails. No silent
   fallback to a guessed branch name.
3. The publisher shall reset the worktree to the default-branch tip before the
   first `git am`. Use `git checkout -f -B "$branch" "$default_ref"` plus
   `git clean -fd`.
4. `base` shall be the default-branch tip commit. All existing verification
   gates keep using it: docs/ path allowlist, symlink/gitlink blob rejection,
   post-apply whole-branch re-verify, `ls-files` blob-mode sweep, tip-count
   check.
5. The publisher shall force-push the rebuilt branch. The pushed tip is a
   deterministic function of the remote tip and the audited patches, and every
   commit on it passed the allowlist gates, so a non-fast-forward reject can
   only reject a stale same-day run.
6. The publisher shall skip `gh pr create` when an open PR already exists for
   the branch. A force-push updates that PR in place.

## Trade-offs considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| Reset publisher to remote default tip (start-point checkout) | Deterministic; independent of agent behavior; minimal diff | Discards agent's local branch state (patches preserved) | **Chosen** |
| `git am -3` three-way fallback | Survives small drift | Impossible on `--depth 1` clones (no blob objects); masks real drift | Rejected |
| Tell the agent to leave HEAD clean after exporting | No publisher change | Relies on LLM compliance — exactly what T-20260912-026 removed | Rejected |
| Same-day rerun hardening (force-push + PR guard) | Removes the next predictable `workflow_dispatch` failure | 6 extra lines in the trusted step | **Included now** |

Known limitation: a same-day re-dispatch after the earlier PR was already
merged produces a zero-diff branch and `gh pr create` fails loudly. Merges are
human-gated and not same-day in practice; revisit if it ever fires.

## Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None | N/A — GitHub Actions workflow is platform-neutral CI infrastructure; carries no agent instruction content |
| Antigravity (GEMINI.md) | None — same justification; `.github/` is L0-only CI infrastructure, not agent-facing guidance | N/A |
| templates/common | None — propagation not required; the workflow does not exist in variant templates and `.github/` is outside the propagation map | N/A |

## Acceptance criteria

- [ ] A scratch-repo reproduction shows the old publisher logic failing exactly as the 2026-10-02 run did.
- [ ] The same reproduction passes with the fixed logic and produces one commit per patch on top of the remote tip.
- [ ] `bash -n` accepts the extracted publisher script.
- [ ] All five existing validation gates remain present and unchanged in the step.
- [ ] The agent phase remains credential-free; the publish step remains the only PAT holder.
- [ ] `bun scripts/spec-register.ts` registers the design with status `implemented`.
- [ ] `bun scripts/audit.ts` passes.
