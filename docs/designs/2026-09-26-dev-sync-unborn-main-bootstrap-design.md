# Design: dev-sync Unborn-Main Branch Detection + Fresh-Repo Remote Bootstrap (T-20260926-031)

## 1. Background

`new-project.ts` runs `git init` in the scaffolded project and stops there — the repo has no commits (unborn `main`). The first `/sync` in that state dead-ends twice, observed live on `Projects/co-design` (2026-09-25, PR #1 merged after manual recovery):

1. **Unborn-main blind spot** (`scripts/dev-sync.ts` step 5, `git rev-parse --abbrev-ref HEAD`): on an unborn branch this command exits non-zero, so `currentBranch` stays `""`, the `main`/`master` comparison misses, and the pipeline commits straight onto `main`. The pre-push hook then blocks the push ("Direct push to 'main' is blocked") and the run exits fatal.
2. **Fresh-repo bootstrap gap**: even with branch creation fixed, a brand-new remote has no `origin/main`, so `gh pr create` has no base branch and the PR step fails. `main` can only advance through server-side PR merges (the pre-push hook blocks every direct push to `refs/heads/main` by design), which is unreachable while no `main` exists on the remote.

Manual recovery applied to co-design: seed `origin/main` with a minimal README through the GitHub Contents API, merge the seed into the PR branch with `--allow-unrelated-histories -X ours`, then open and merge the PR server-side.

## 2. Goals

- G1: The first `/sync` on an unborn `main` creates a `pr/*` branch and never commits onto `main`.
- G2: The first `/sync` against an empty GitHub remote completes the full flow — push the PR branch, bootstrap `origin/main`, open a mergeable PR.
- G3: Repos that already have `origin/main` see zero behavior change.

## 3. Non-goals

- The pre-push `main` block stays unchanged; `main` moves only through PR merges.
- `new-project.ts` does not start creating GitHub remotes; repo creation remains an operator step.
- No fleet rollout in this change — scaffolded projects receive v1.21.0 through the standard `upgrade-project` flow.

## 4. Requirements (ASD-STE100, ADR-0079)

- R1: Step 5 shall resolve the checked-out branch with `git symbolic-ref --short -q HEAD` first. When that fails (detached HEAD), it shall fall back to `git rev-parse --abbrev-ref HEAD`.
- R2: After the PR-branch push, when `git ls-remote --heads origin main` returns no ref, dev-sync shall seed `origin/main` through `gh api repos/<owner>/<repo>/contents/README.md`, merge `origin/main` into the PR branch with `--allow-unrelated-histories -X ours --no-edit`, and push the branch again.
- R3: The bootstrap shall fail closed with an actionable message when the origin URL is not a GitHub slug, or `gh` is missing or unauthenticated.
- R4: The bootstrap shall not run when `origin/main` exists.

## 5. Acceptance criteria

- A1: In a repo with unborn `main`, `/sync` lands the commit on a `pr/*` branch.
- A2: Against an empty GitHub remote, `/sync` ends with an OPEN PR whose base is `main`; the PR merges clean (the README add/add resolves in favor of the PR branch).
- A3: On any repo with `origin/main`, no seed or extra merge runs.
- A4: `lifecycle-sync-audit` Check A passes: `@version` 1.21.0 matches the SCRIPTS.md registry row.

## 6. Design decisions and trade-offs

- **`symbolic-ref` over `rev-parse`**: `git symbolic-ref --short -q HEAD` resolves the checked-out branch before the first commit. Detached-HEAD repos keep today's semantics through the fallback.
- **Seed via the Contents API, not a git push**: pushing to `refs/heads/main` is blocked as a constitutional control (PR-only main). The API seed is what GitHub's own "initialize with a README" creates — one content-free README commit, server-side. All real content still lands through the reviewed PR.
- **`-X ours` for the seed merge**: the PR branch carries the real content; the seed README must lose the add/add conflict. This is exactly the resolution applied manually on co-design.
- **Trigger keyed on remote state** (`git ls-remote`), not local refs: authoritative, immune to stale local refs, and a natural no-op on every normal repo (G3).

## 7. Verification plan

- The exact command sequence this design encodes was rehearsed manually on `Projects/co-design` (2026-09-25) and produced merged PR #1 — the live rehearsal predates the code.
- Root sync gate battery covers the change mechanically: typecheck (Step 3.95b), full `audit.ts` (Step 4.9), lifecycle-sync-audit Check A.
- No new module surface: the changes stay inline in dev-sync's step 5/6 git-I/O region, matching the house style for those steps (unit-tested helpers live in `scripts/lib/` only when shared).

## 8. Registry cascade

- `scripts/SCRIPTS.md`: `dev-sync.ts` row 1.20.0 → 1.21.0 (v1.21.0 blurb, prior = v1.20.0).
- `generate-scripts-mirror.ts` regenerates the L1 SCRIPTS.md span at Step 2.6; no manual template edit.
- Templates receive dev-sync.ts 1.21.0 through Step 4.5 `propagate-to-templates` during this same sync.
- Scaffolded projects receive it later via `upgrade-project` (operator-triggered wave).

## 9. Implementation brief (ordered phases)

1. `scripts/dev-sync.ts`: bump header to `@version 1.21.0`, prepend the v1.21.0 note.
2. Step 5 (~line 981): unborn-safe branch resolution (R1).
3. New step 6.7 between push success (~line 1256) and step 7 (~line 1258): remote-main bootstrap (R2–R4).
4. `scripts/SCRIPTS.md`: registry row version + blurb.
5. `CHANGELOG.md` [Unreleased] Fixed entry.

## 10. Platform Impact (mandatory)

Bun + git + `gh` CLI — all already dev-sync prerequisites (`gh` is step 7's PR engine). No OS-specific paths or shells; Bun shell interpolation keeps it Windows-safe.

## 11. Risks

- `gh` unauthenticated on a fresh machine → R3 fails closed and names the manual seed command; the operator recovers in one step.
- Non-GitHub remotes (GitLab etc.) → R3 reports the URL mismatch; step 7's `gh pr create` dependency already excludes those hosts today, so no capability regression.

## 12. Accessibility exemption (ADR-0065)

N/A — no UI or document surface.

## 13. Preview-verification exemption (ADR-0070)

N/A — no rendered artifact.
