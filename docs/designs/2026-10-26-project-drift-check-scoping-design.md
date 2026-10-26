---
schemaVersion: 1.0.0
spec-id: 2026-10-26-project-drift-check-scoping-design
---

# Project Drift-Check Scoping and Guard Landing Design

Covers two upstream tickets:

- **Part A** — U-20261026-010 (from co-design): scope `verify-scripts.ts --check-drift` blocking to true mirror contexts.
- **Part B** — U-20261026-011 (from co-newbiz): land the pr/* deletion guard and the MERGED-PR branch guard in L0, mirrored to templates/common.

Implementation is out of scope for this document; it specifies the decision, acceptance criteria, and test plan for the automation-engineer.

## Part A — Drift-check scoping by context layer (U-20261026-010)

### A.1 Problem (verified facts)

- `scripts/dev-sync.ts` Step 3.7 (~line 586) runs `bun scripts/verify-scripts.ts --check-drift` and blocks the sync on exit 1.
- In a nested project (`Projects/<p>`), `verify-scripts.ts` resolves "L0" as the project's own `scripts/` (`findWorkspaceRoot` picks the nearest marker, ~lines 129-168) and "L1" as the true workspace root's `templates/common/scripts/`, read from the live **working tree**.
- `checkDriftReport` (~line 463) exits 1 on equal-version content divergence.
- Reproduced: co-design blocks on `generate-version-manifest.ts @1.10.1`. The workspace root has an uncommitted edit that bumps L1 to 1.10.1, and that edit collides with co-design's own project-local 1.10.1. So any workspace-side edit, even an uncommitted one, can stall every project's sync.
- `detectContextLayer()` already returns `"L3"` for `Projects/*`.

### A.2 Decision

Make the blocking severity of equal-version divergence depend on `detectContextLayer()`:

| Context layer | Equal-version content divergence vs L1 | Exit code |
|---|---|---|
| L0 (workspace root) | ERROR (blocking), unchanged | 1 |
| L1 (templates/common context) | ERROR (blocking), unchanged | 1 |
| L2 (variant template / variant project) | WARNING | 0 |
| L3 (`Projects/*`) | WARNING | 0 |

The L2/L3 warning text must name the script, both versions, and the remedy:
`Run upgrade-project to reconcile with the workspace template (project-vs-upstream divergence is not a mirror violation).`

Other drift classes keep their current severity. This change only alters the equal-version-divergence branch.

### A.3 Rationale

- L0↔L1 is a true mirror invariant: `templates/common/scripts/` must equal the root `scripts/` at equal versions (T-20261004-022, T-20260912-009). Blocking there is correct.
- In a project, the "L1" side is the upstream delivery source. Divergence between a project and upstream is the delivery relationship. `upgrade-project` owns that relationship, not the mirror check. Blocking a project's sync on the workspace's live working tree couples every project to unrelated, possibly uncommitted, workspace edits.

### A.4 Rollout note

Projects carry their own copy of `verify-scripts.ts`. The fix reaches them only through a template release followed by `upgrade-project` in each project. Until then, affected projects can unblock by running `upgrade-project` (or by waiting until the workspace edit is committed and released).

### A.5 Alternatives considered

1. **Compare against the last-received delivery manifest** instead of the live workspace working tree. This is the most precise approach: it flags only local edits made since the last upgrade. Rejected for now because it requires a reliable per-project delivery manifest with content hashes for every script, which not all projects have yet. It also needs a migration. This may be revisited as a follow-up.
2. **Change-set scoping**: only check scripts touched in the current change set. Rejected because it hides real drift in untouched files, depends on git state (staged vs unstaged vs untracked), and still fails when the upstream side changes underneath an unchanged project file.
3. **Status quo** (always block). Rejected because of the reproduced fleet-wide stall.

### A.6 Acceptance criteria

- AC-A1: In an L3 context, equal-version divergence prints a WARNING that includes the upgrade-project guidance, and `--check-drift` exits 0 (absent other blocking findings).
- AC-A2: In an L2 context, the same behavior as AC-A1 applies.
- AC-A3: In an L0 context, equal-version divergence still exits 1 (no regression).
- AC-A4: `dev-sync.ts` Step 3.7 no longer blocks a project sync on this class of finding.
- AC-A5: `verify-scripts.ts` version is bumped and mirrored to `templates/common/scripts/`. Root `--check-drift` is clean. SCRIPTS.md is updated.

### A.7 Test plan

- Unit test (new): build a fixture with a nested `Projects/<p>` marker and an L1 `templates/common/scripts/x.ts` at the same version but different content. Assert `checkDriftReport` returns a warning (not an error) and the exit code is 0. Assert the message contains `upgrade-project`.
- Unit test (regression): use the same divergence in an L0 fixture and assert an error with exit 1.
- Unit test: an L2 fixture follows the warn path.
- Run `bun run test:unit` and root `bun scripts/verify-scripts.ts --check-drift`.

## Part B — Land pr/* deletion and MERGED-PR guards in L0 (U-20261026-011)

### B.1 Problem (verified facts)

- Commit 7d75e2f14 (T-20261026-003) bumped `scripts/hooks/pre-push.ts` to @1.5.0. It described a pr/* remote-branch deletion guard (override: `ALLOW_REMOTE_BRANCH_DELETE=1`) in SCRIPTS.md and claimed a MERGED-PR branch guard for dev-sync. Because of cwd drift, the code was written only into `Projects/co-newbiz`.
- `dev-sync.ts @1.30.0` is already used by T-20261026-009 content, so the guard cannot reuse that version.

### B.2 Decision

- Implement both guards in L0 `scripts/`:
  - `scripts/hooks/pre-push.ts` → **@1.6.0**: refuse pushes that delete `refs/heads/pr/*` on the remote unless `ALLOW_REMOTE_BRANCH_DELETE=1`. Extract the check as a pure, exported `branchDeletionGuardError(...)`.
  - `scripts/dev-sync.ts` → **@1.31.0**: refuse to push or reuse a branch whose PR is already MERGED, and tell the user to create a fresh branch.
- Mirror both to `templates/common/scripts/` at the same versions. Update SCRIPTS.md (root and template) so the description matches the code.
- The new versions are deliberately distinct from co-newbiz's local @1.5.0 edits, so `upgrade-project` supersedes the local copies cleanly.
- After the template release, co-newbiz discards its local edits to these two files and runs `upgrade-project`. Workspace agents must not edit `Projects/co-newbiz` as part of this work.

### B.3 Acceptance criteria

- AC-B1: Root `bun scripts/verify-scripts.ts --check-drift` shows `hooks/pre-push.ts` (1.6.0) and `dev-sync.ts` (1.31.0) in sync between L0 and L1.
- AC-B2: A unit test covers `branchDeletionGuardError`: deletion of `pr/*` is blocked by default, allowed with `ALLOW_REMOTE_BRANCH_DELETE=1`, and non-`pr/*` deletions and normal pushes are unaffected.
- AC-B3: A unit test covers the dev-sync MERGED refusal with the PR state lookup mocked: MERGED is refused, while OPEN and no-PR proceed.
- AC-B4: SCRIPTS.md entries in both locations match the implemented behavior.

### B.4 Test plan

- `bun run test:unit` with the two new test files.
- `bun scripts/verify-scripts.ts --check-drift` and `bun scripts/audit.ts` at the root.

## Sequencing

Ship Part B and Part A in the same template release if practical. Part A should land first or together with Part B, so that projects upgrading for Part B are not blocked by drift during the upgrade.
