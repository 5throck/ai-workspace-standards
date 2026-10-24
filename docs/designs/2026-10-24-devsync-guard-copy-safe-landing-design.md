# Design: dev-sync flag-leak guard + copy-safe landing emission (T-20261024-001)

- **Spec ID**: 2026-10-24-devsync-guard-copy-safe-landing-design
- **Date**: 2026-10-24
- **Status**: implemented
- **Tickets**: T-20261024-001 (high; co-design PR #47/#48 recovery evidence)

## Summary

Two hardening changes close the mangled-PR failure class opened by the co-design
0.20.0 upgrade (PR #47 shipped only pipeline scaffolding while the 16 delivered
files sat unstaged, recovered manually as PR #48):

### D1 — dev-sync 1.29.0: flag-leak hard-fail

When the argument order is swapped (e.g. `dev-sync "--body-file <path>" <message>`),
the `--body-file` token falls through to the message position: the commit message
becomes the token string (branch slug `--body-file-...`), body-file handling is
skipped, and the PR ships mangled. Guard: after message composition, hard-fail
when the message starts with `--` or any message-slot argument starts with
`--body-file`, printing the copy-safe invocation.

### D2 — upgrade-project 1.72.0: copy-safe landing emission

The `Upgrade Complete` summary now emits the landing command block:
`git add -A`, `cd <workspace-root>`, and the full dev-sync invocation with
`--body-file <project>/.claude/last-upgrade-pr-body.md` as a SEPARATE argument —
annotated that the token must never sit inside the quoted message.

## Verification

- dev-sync compiles; the guard triggers on a leading-`--` message (manual probe).
- upgrade-project dry-run/real-run output carries the Landing block (co-abap canary
  re-run observed).
- Registry rows: dev-sync 1.29.0, upgrade-project 1.72.0; lifecycle records updated;
  mirror parity via propagate-to-templates.
- The 16 untracked ticket files (T-20261022-034..051 minus superseded, plus
  T-20261024-001) land with the nightly's closeout.
