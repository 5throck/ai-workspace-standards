# Parallel Dispatch Grants

From co-abap's parallel-dispatch model (ADR-0007, ADR-0005 D4; PR #194;
T-20261011-007). The problem: write-capable agents fanning out in parallel can
mutate a live system with no single accountable human decision, and each
platform's config drifts into its own command vocabulary.

## Grant model — one human decision bounds one run

- Plan rows are typed **`read`** or **`write`**. Read rows run at the
  read-only ceiling; write rows must declare **exact-object scope** (packages,
  objects, actions, max object level).
- The dispatcher **stops** when any write row lacks a grant for the run: it
  writes a grant request and exits — it never guesses scope.
- A human approves the grant for the `runId`; children then run **under the
  grant**, and any **out-of-scope call is denied** by the enforcement point.
- The grant is **revoked at run end** — scope never outlives the run.
- Escalations beyond the granted class (destructive/privileged actions) still
  need their own explicit approval; grants do not bundle R3-class power.

## Isolation and termination

- **One git worktree per row** — children never share a working tree, so
  partial writes cannot cross-contaminate (and `git stash`/`checkout --`/
  `clean` races between siblings become structurally impossible).
- **Staged termination**: SIGTERM first, a 10-second grace period, then
  SIGKILL — in-flight calls finish or get reaped by the enforcement point
  instead of being severed mid-write.
- A missing or dropped per-child ceiling env **fails closed to read-only**,
  never to full power.

## Command SSOT — one source, rendered per platform

- Commands live in a single `config/commands/` source and are **rendered**
  into each platform's format (Claude/Codex markdown, Gemini TOML, ...);
  hand-editing a rendered copy is drift.
- A **`--check` CI gate** re-renders and fails on drift, so the eight platform
  surfaces cannot silently diverge.
- Deny semantics render identically everywhere: **"ask means deny"** — where a
  platform cannot express ask-per-call, the rendered rule denies.
- The same SSOT + render + check pattern covers deny rules
  (see docs/guides/agent-shell-hardening.md).

## Checklist

- [ ] Rows typed read/write; write rows declare exact-object scope
- [ ] Dispatcher stops for a missing grant; never infers scope
- [ ] Out-of-scope calls denied under grant; grant revoked at run end
- [ ] Per-row git worktrees; no shared working tree
- [ ] SIGTERM -> 10s grace -> SIGKILL; missing ceiling fails closed to read-only
- [ ] Commands single-sourced, rendered to all platforms, `--check` gate in CI
