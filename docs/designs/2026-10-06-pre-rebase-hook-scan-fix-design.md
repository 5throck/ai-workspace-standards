# Design: pre-rebase secret scan scans the rebase range, not the working tree

- - **Spec ID**: 2026-10-06-pre-rebase-hook-scan-fix
- **Date**: 2026-10-06
- **Status**: implemented
- **Source**: manual (2026-10-06 PM health-check remediation follow-up — the hook blocked a routine ticket-branch rebase with a bogus verdict)

## Problem

`.githooks/pre-rebase` (gitleaks path) pipes `git show <commit>` into
`gitleaks detect --no-git`. Since gitleaks 8.x, `detect --no-git` ignores
stdin entirely: with or without the pipe it scans the current directory
(measured: 462 MB, 1,110 findings on the workspace tree — default rules, no
config, mostly template fixtures). The hook therefore treats those working-tree
findings as the commit's verdict and blocks EVERY rebase, regardless of what
the replayed commits contain. Two aggravators: (1) plain `git rebase <upstream>`
passes only ONE hook argument, which routed into the "scan last 10 commits"
fallback, scanning commits that are not being replayed (common history — e.g.
aeb204a, already merged to main via #1433 and clean by repo-mode scan);
(2) the fallback shares the same broken scan shape.

## Decision

Replace the per-commit stdin pipes with a single repo-mode scan of exactly the
replay range:

- 2 args (upstream, branch) → `UPSTREAM..BRANCH`; 1 arg (upstream only) →
  `UPSTREAM..HEAD`; no args → `HEAD~10..HEAD` (preserves the documented
  fallback intent).
- `gitleaks detect --no-banner --log-opts="--no-merges $RANGE"` — scans the
  real commit diffs and honors the repo's `.gitleaks.toml` allowlist.
- The no-gitleaks regex fallback (T-20260912-021) is unchanged.

Verified: pass path — `bash .githooks/pre-rebase origin/main` on an
up-to-date main exits 0 ("No secrets found"); block path — the same
invocation shape in a scratch repo flags a non-allowlisted AWS-key pattern
(leaks found: 1, exit 1), while the previously flagged aeb204a scans clean
in repo mode ("no leaks found").

## Accessibility

Non-UI infrastructure change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).
