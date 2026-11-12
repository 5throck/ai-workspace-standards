# Revert Drill Evidence — Unified Batch Runner Runbook (T-20261112-002)

- **Date**: 2026-11-12
- **Spec**: `2026-11-12-unified-batch-runner-design` (AC-5; design §4.6 R14)
- **Condition**: the meeting's adopted condition — "one revert drill before first fire; an untested runbook is documentation, not a control" (`memory/meeting-2026-11-12-unified-batch-runner.md`, ISSUE 5)
- **Result**: **PASS** — reverse-order revert of three simulated merge commits restored the tree to the exact pre-run state.
- **First fire**: 2026-11-13 03:00 KST — the runbook is drilled, satisfying the auditor's condition.

## 1. Setup

Scratch repo at `/Users/techcross/git/ai_workspace-worktrees/revert-drill-<ts>` (removed after the drill):

```
git init && git config user.name "revert-drill" && git config user.email "drill@localhost"
echo "base content" > base.txt && git add . && git commit -m "base: pre-run state"   # 033a69c (pre-run head)
# for i in 1 2 3: branch pr-sim-$i off main, commit a distinct file (pr-$i-file.txt),
# merge --no-ff into main -> three true merge commits:
#   e5964c8  Merge PR #1
#   b19d270  Merge PR #2
#   6985f10  Merge PR #3
```

## 2. Run manifest (STEP-0 convention, design R13)

`run-manifest-drill.json` written BEFORE any revert, listing `preRunHead` and the three `mergedPRs` rows (PR number, merge SHA, expected file), plus empty `sanctionedRepairs` / `billingWallEvidence` / `skippedBudget` arrays. Final version is reproduced here:

```json
{
  "preRunHead": "033a69c4165e8ecdf6f32962864876ec88d184af",
  "mergedPRs": [
    {"pr": 1, "mergeSha": "e5964c82ba1b1cc3272a54d9c4626c3ac6c0e9f3", "file": "pr-1-file.txt"},
    {"pr": 2, "mergeSha": "b19d27033829a53a9e923e9c747d8d8ea6b9b036", "file": "pr-2-file.txt"},
    {"pr": 3, "mergeSha": "6985f106d9b0d63830fbdbce6d4fb3875529b29b", "file": "pr-3-file.txt"}
  ]
}
```

## 3. Drill execution (runbook: reverse order, newest → oldest, verify each step)

```
git revert --no-edit -m 1 6985f10   # PR #3 (newest)  -> OK, pr-3-file.txt removed
git revert --no-edit -m 1 b19d270   # PR #2           -> OK, pr-2-file.txt removed
git revert --no-edit -m 1 e5964c8   # PR #1 (oldest)  -> OK, pr-1-file.txt removed
```

Each step verified the target file was gone before proceeding. No conflicts; no force-push; the revert commits stack normally (a0d35cc → eb562fe → 68f6fa3).

## 4. Verification

`git diff --quiet <preRunHead> HEAD` after the third revert: **tree equal to the pre-run state — PASS** (the diff is empty; only `base.txt` remains).

## 5. Drill findings (runbook text hardening)

Two drill-script errors, both caught by the drill's own verification and corrected in-drill; both harden the runbook text:

1. **preRunHead formula**: the pre-run head must be `(first merge SHA)^1`. The first attempt derived it with `git rev-list --max-parents=1 HEAD | tail -1`, which also matches the PR branch commits and picked a wrong commit — the tree-equality check then false-FAILED. The runner's manifest convention (pre-run HEAD written at STEP 0, before any merge) makes this moot in real runs, but the runbook's manual-repair path now names the formula explicitly.
2. **SHA extraction needs `--merges`**: `git log --grep='Merge PR #N'` double-matches after the revert lands, because the revert commit subject embeds the merge subject. Merge SHAs must be extracted with `git log --merges --grep=...`.

## 6. Watchdog host installation (same ticket, evidence-only)

- `crontab` writes are blocked by macOS TCC in this environment (`crontab: tmp/tmp.X: Operation not permitted`, reproducible outside the tool sandbox) — the prepared crontab line is recorded below for an operator who prefers cron:
  `0 13 * * * cd /Users/techcross/git/ai_workspace && bun scripts/watchdog-automation-stop.ts "13:00 KST wall reached" >/dev/null 2>&1`
- **Installed instead via the meeting-sanctioned equivalent mechanism (launchd)**: user LaunchAgent `~/Library/LaunchAgents/ai.workspace.watchdog-automation-stop.plist`, label `ai.workspace.watchdog-automation-stop`, `StartCalendarInterval` 13:00 local, `WorkingDirectory /Users/techcross/git/ai_workspace`, running `bun scripts/watchdog-automation-stop.ts "13:00 KST wall reached"`, logging to `.pipeline-state/watchdog-automation-stop.log`. `plutil -lint` OK; `launchctl bootstrap gui` OK; `launchctl print` shows state `not running` with the schedule loaded.
- **Inert until PR #1990 merges**: the script exists only on the PR branch until the human merges; until then a 13:00 fire would fail (missing script) without side effects.
- **Operator-manual step (NOT installed)**: the kill-guard past deadline + 15 minutes (pkill class + stamping the automation lock dead for `--break-stale` recovery, design R11) requires live-process testing before it can be automated safely; an untested auto-kill entry was deliberately NOT installed.

## 7. Scratch cleanup

The drill repo and its scratch directory were removed after the evidence was recorded.
