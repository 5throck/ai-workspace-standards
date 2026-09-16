---
schemaVersion: 1.0.0
spec-id: pre-push-deletion-skip
---

# Pre-Push Ref-Deletion Skip — 2026-09-16

## 1. Overview

Lands ticket T-20260916-014: the project pre-push hook runs its full gate
battery (gitleaks scan + `audit.ts --lifecycle-only` + changed-path tests)
even when the push transfers no commits — i.e. a pure ref-deletion push
(`git push origin --delete pr/<branch>`). Observed live during the
2026-09-16 fleet branch cleanup: 15 branch deletions in Projects/co-* repos
were blocked by failing project-side audits and the operator had to fall
back to the GitHub API. A deletion push carries no content, so there is
nothing to scan or audit; the hook must skip the battery and exit 0.

## 2. Problem

### 2.1 Chain map (what runs where)

- `.githooks/pre-push` (L0) is a thin bash wrapper: it checks that `bun`
  exists, then runs `bun run scripts/hooks/pre-push.ts`. It does NO
  pre-scanning and performs NO logic of its own; git's stdin (one
  `<local-ref> SP <local-oid> SP <remote-ref> SP <remote-oid>` line per
  ref update) passes through to the TS hook.
- `scripts/hooks/pre-push.ts` is the entire implementation: parses stdin
  once, runs the gitleaks scan scoped to pushed commits (or a working-tree
  regex fallback when gitleaks is absent), then runs
  `bun scripts/audit.ts --lifecycle-only` unconditionally (unless
  `SYNC_ACTIVE=1`), then changed-path tests, then branch protection.
- Delivered projects receive the identical pair — `.githooks/` copied into
  the project plus `core.hooksPath=.githooks`, and `scripts/hooks/*.ts`
  propagated via the `scripts-hooks` domain of `scripts/propagation-map.json`.
  Verified: the co-architect project copies are byte-identical to L0 today.
  The deletion-push stdin therefore reaches the same TS logic in both the
  workspace and every delivered project; the TS hook is the single seam.

### 2.2 Why deletion pushes were blocked

The hook already special-cased deletions piecemeal (the gitleaks scope
filter and changed-path collector skipped all-zero local OIDs, and branch
protection exempted them), but nothing short-circuited the battery:

- `bun scripts/audit.ts --lifecycle-only` ran on every push. In a delivered
  project whose audit fails (the fleet-cleanup case), the deletion push was
  blocked: `❌ Audit failed — push blocked` (exit 1).
- With gitleaks absent, the regex fallback scanned the working tree —
  content-bearing work with no content-bearing push.
- Reproduced pre-fix in a throwaway repo with the L0 hook chain: a
  `git push origin --delete pr/x` executed the scan + audit and exited 1
  with the audit-failure block, exactly as in the co-* projects.

## 3. Deletion-detection rule

Git sends an all-zero local OID on a deletion line — 40 zeros on SHA-1
repositories, 64 on SHA-256. One shared predicate replaces the former
hard-coded 40-zero constant:

- `isZeroOid(oid)` — true iff `oid` is exactly 40 or 64 `0` characters
  (`/^(?:0{40}|0{64})$/`). `undefined`/empty (malformed lines) is false.
- `isPureDeletionPush(refUpdates)` — true iff the stdin carried at least
  one line and EVERY line's local OID is zero. Consequences:
  - Mixed pushes (commits + deletions) are not pure deletions and keep the
    full gate, auditing the commit-bearing refs exactly as before.
  - Empty stdin (no ref updates) is not a pure deletion — the existing
    no-updates fallback (crude branch protection) still applies.
  - A malformed line (undefined OID) is never classified as a deletion —
    the gate runs (fail-closed).

## 4. Seam choice + rationale

The early exit lives in `scripts/hooks/pre-push.ts` `main()`, immediately
after the single stdin parse and before the gitleaks section:

```
ℹ️  pre-push: ref-deletion push — no commits to audit, skipping
```

(exit 0). Rationale:

- The shell wrapper delegates stdin verbatim to the TS hook, so the TS
  hook is the one seam that covers the workspace AND every delivered
  project with a single implementation. `.githooks/pre-push` (L0 + L1
  mirrors) stays untouched and remains byte-identical (Check G).
- The parse must happen before the exit (stdin can be consumed only once),
  and the existing parse already normalizes lines into
  `{localRef, localOid, remoteRef, remoteOid}`.
- Supporting change: the remaining `ZERO_OID` equality comparisons
  (gitleaks scope filter, changed-path collector, branch-protection
  exemption) now use `isZeroOid`, giving all four sites one definition of
  "deletion" that is hash-algorithm correct. This does not weaken any
  gate: an all-zero OID is never a real commit on either hash algorithm,
  so classifying it as a deletion matches the documented intent.
- `main()` is now invoked under `if (import.meta.main)` so unit tests can
  import the exported helpers without executing the hook; git still
  invokes the file directly, where `import.meta.main` is true and
  behavior (including the exit-1 catch) is unchanged.

## 5. What stays gated

Everything that is not a pure ref-deletion push keeps the full battery,
unchanged: gitleaks scan scoped to pushed commits (or regex fallback),
`audit.ts --lifecycle-only` (subject to the existing `SYNC_ACTIVE=1`
dedup), changed-path tests, tag-only bypass, and branch protection on
`main`/`master`. Mixed pushes gate on their commit-bearing refs; deleting
`main` itself still hits branch protection when it is not a pure-deletion
stdin (a pure deletion of `main` exits 0 like any other deletion — remote
branch deletion is a legitimate remote-admin operation the hook has no
mandate to gate).

## 6. Version bumps (minor)

| File | Version | Surfaces |
|------|---------|----------|
| `scripts/hooks/pre-push.ts` | 1.3.0 → 1.4.0 | `@version`; L0 + L1 SCRIPTS.md rows; L1 copy refreshed via `propagate-to-templates --apply` (`scripts-hooks` domain) |
| `tests/unit/pre-push-deletion-detection.test.ts` | 1.0.0 (new) | new unit test file |

`.githooks/pre-push` (L0 and the hand-maintained L1 mirror) is unchanged —
no version convention exists in the shell wrappers (confirmed: no `@version`
marker; the audit's version-header check covers `scripts/*.ts`, not
`.githooks`). Check G byte-parity is therefore trivially preserved.

## 7. Test plan

- Unit (`tests/unit/pre-push-deletion-detection.test.ts`, scratch
  fixtures only): `isZeroOid` (40/64 zeros true; real SHA, near-zero,
  wrong-length, undefined, empty false); `isPureDeletionPush` (single and
  multiple deletions pure on both hash lengths; deletion+commit, commit-only,
  new-tag, empty-stdin, malformed-line not pure).
- LIVE verification (mandatory, throwaway repos only):
  1. Scratch repo with the fixed hook chain + `git push origin --delete` →
     hook prints the skip note and exits 0 (push succeeds).
  2. Scratch repo + a normal commit push → the full battery still fires
     (audit output shown, push blocked where the audit fails).
  3. Mixed push (new commit + a branch deletion in one push) → battery
     runs for the commit-bearing ref.
  No pushes to any real project repository.

## 8. Accessibility

Backend/CLI-only work (a git hook skip path and unit tests). No user-facing
UI is produced. Exempt from ADR-0065 WCAG scope; the WCAG 2.1 AA baseline
does not apply.

## 9. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed validation
battery (unit suite, validate-templates, typecheck delta, audit, scripts
suite, lifecycle-sync-audit incl. Check G, review-baseline) plus the live
scratch-repo deletion/commit/mixed push scenarios.
