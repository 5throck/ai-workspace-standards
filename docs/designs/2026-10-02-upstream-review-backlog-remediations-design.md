# Upstream Review Backlog Remediations — 2026-10-02

**Status**: Approved
**Scope**: implements the accepted findings from `docs/reports/2026-10-02-project-review-upstream.md` (T-20261002-002..010, T-20261002-013, T-20261001-020 disposition, T-20261002-012 decision) as one batch design, landed as domain-grouped PRs.
**Method**: findings are quoted from the review; each group below states the design decision and verification. No behavior change outside the listed surfaces.

## Context

The 2026-10-02 four-agent review of the upstream MCP feature found 5 High, 13 Moderate and ~15 Low findings. Nine tickets were filed. This design fixes the structural findings (H2/H4 write-order and locking), closes the script-gaps (M1/M2/M3/M4), closes the identity/file-write holes (H3/H5), aligns the governance docs with the shipped CLI (H1/M8), fixes the Windows path class (T-013), and disposes the remaining items (M5–M13, Low list) with explicit implement-or-accept decisions.

## Group A — ticket system (T-20261002-003, -005, -007)

### A1. Validate-before-write + resumable resolution walk (H2, `ticket-store.ts`)

- `setUpstreamTriage` pre-validates before ANY write: a `done` ticket refuses both triage values ("closed request is never re-triaged"); a `ready` promotion from a status without a forward edge to `waiting` throws before the triage field is written. The documented `inbox` demotion (force) is unchanged.
- `setUpstreamResolution` pre-computes the full legal hop chain (`canTransition` on every hop) before writing anything; if any hop is illegal it throws before mutating the ticket. The write is resumable: a ticket that already carries a resolution but is not yet `done` (crash mid-walk) resumes the walk instead of refusing — only `status: done` + existing resolution is refused as "never re-resolved".
- Both functions take the shared ticket lock (A2).

### A2. Shared ticket lock (H4)

- New `withTicketLock(dir, fn)` in `ticket-store.ts`: mkdir-based lock at `<dir>/.ticket-lock` with an owner token file (`pid` + random token + holder label). Acquisition retry is bounded by `TICKET_LOCK_TIMEOUT_MS` (default 5000) and **fails closed** (throws) on timeout — ticket mutations are sub-second and a silent fail-open is what produced H4 lost updates. Stale takeover (>30s) uses atomic `renameSync(lock, lock.stale-<ts>)` so exactly one waiter wins; the winner removes the stale copy. Release removes the lock only if the owner token still matches.
- All store mutations that read-modify-write an EXISTING ticket (`moveTicket`, `setUpstreamTriage`, `setUpstreamResolution`) run under the lock; `createTicket` stays lock-free (exclusive `wx` create, no existing-file read). The server's merge section (`mcp-upstream-server.ts` duplicates write) wraps its read-modify-write in the same lock, nested inside the intake lock (ordering always intake → ticket; the reverse is never taken, so no deadlock).
- `tickets/governance/.ticket-lock` is added to `.gitignore`.

### A3. `validateTicket` upstream invariants (M2, `ticket-schema.ts`)

New checks (upstream tickets only):
- `upstream.project` matches `^co-[a-z0-9-]{1,40}$`.
- `upstream.template_version` / `upstream.variant`: string or null.
- triage↔status consistency: `inbox` ⇒ status ∈ {backlog, done}; `ready` ⇒ status ∈ {waiting, review, done}.
- `status: done` ⇒ `upstream.resolution` present; resolution present ⇒ non-empty `summary`; `pr_url` (when present) matches `^https:\/\/\S+$`; `template_version` (when present) non-empty string.

Verified against both real legacy tickets (U-20261001-001: done+inbox+no resolution.template_version — valid under these invariants; U-20261002-001: complete) — no data migration required.

## Group B — governance server + installer (T-20261002-004, -006, -008)

### B1. Status redaction + audit for declared identity (H3, `mcp-upstream-server.ts`)

- `upstream_request_status` appends an audit line (`outcome: 'status'`, project, `identity: declared|cwd`).
- When identity was self-declared (`project_root` path), the status result redacts ticket content: returns ids + status/triage flags only — no resolution summary, no PR URL, no symptom (matches the design's "status returns no other project's content").
- Design doc of the upstream feature gets a §6 addendum documenting the trust-boundary downgrade (declared identity is unverified until PM review).

### B2. Installer write hardening (H5 + M4, `install-upstream-mcp.ts`)

- `backupAndWrite`: `statSync` original mode and apply it to the temp file; resolve the target with `realpathSync` before compare/replace (symlinked config updates the real file, not the link); mtime re-check between read and rename — a changed mtime aborts with a retryable error; backups written 0600 with last-N pruning (N=5).
- CLI: a bare run is read-only summary + exit 2 unless `--apply`; unknown flags and a valueless trailing `--target` are hard errors (no silent all-targets write).

### B3. Version constant + doc-command lint (M1 + H1 lint, T-20261002-008)

- `mcp-upstream-server.ts`: single `SERVER_VERSION` constant feeding both the `@version` header comment source of truth and `serverInfo.version`; test asserts equality.
- New check in `validate-surface-registry.ts` (or a dedicated guard in `audit.ts` path): every `ticket.ts <subcommand>` literal in `docs/governance/agents/pm-gateway-workflow.md`, `agents/pm.md` and their templates/common copies must name an existing ticket.ts subcommand (parse from the CLI's usage line). Fails the audit on drift.

## Group C — surface registry + propagation (T-20261002-009, -011)

### C1. Installer↔CONSTITUTION §11.0 comparison (M3)

`validate-surface-registry.ts` gains a check that imports the installer's target list and compares it against the CONSTITUTION §11.0 "Machine-global MCP config" column (parsed from the table) — divergence fails the validator.

### C2. Variant propagation domains (T-20261002-011)

`propagation-map.json` gains the two missing domains so variant HERMES.md heads (bootstrap block) and variant `.claude/settings.json` SessionStart hook entries propagate from templates/<variant> like the common ones already do; `validate-templates` PM-02 covers them.

## Group D — governance docs (T-20261002-002, M8)

- L0 `docs/governance/agents/pm-gateway-workflow.md` §3.12 steps 3 and 8 rewritten around `ticket.ts triage <id> <inbox|ready> [--confirm-reviewed]` and `ticket.ts resolve <id> --outcome ... --summary ...` (no `move --force`, no hand-edit); agents/pm.md gains both commands; templates/common copies updated (M8: the common copies mark the server/CLI as L0-only and point projects at the project-side Upstream Reporting Duty instead of dead procedures).

## Group E — Windows path class (T-20261002-013)

`scripts/hooks/agent-model-gate.ts` replaces `new URL('../..', import.meta.url).pathname` with `fileURLToPath(new URL('../..', import.meta.url))` (same fix pm-role-bootstrap.ts got in PR #1317). Sibling hooks audited — none left.

## Group F — remaining findings (T-20261002-010)

Implement: M5 (lock owner token, fail-closed retryable -32000 for accept/merge, parallel-create test vs hard cap), M6 (reject-path audit writes capped per project/day; today-audit cached in memory), M7 (known-projects marks a project trusted on `fixed|local-only` resolution — first-request gate no longer re-fires; design §6 note), M8 (folded into Group D), M9 (Antigravity CLI gap recorded in docs/surface-gaps.json + CONSTITUTION §11.0 wording; Codex `--force` becomes add-then-remove with restore-on-failure), M10 (manual resolution walk waiting→review→done, skipping the service-runner `running` hop; `ticket.ts list` prints `[FLAGGED]` prefix, sorts flagged-first, shows triage counts), M11 (JSON-RPC `ping` handler, tool failures as `result.isError: true`, envelope validation -32700/-32600, stdin line cap), M12 (audit hash recomputed over stored fields only, going forward; `docs/specs/registry.json` status corrected; LOCAL-PATCH report added to upgrade-project), M13 (behavioral tests for mcp-config-edit edge cases: BOM/quoted keys/empty file/mixed EOL + fixes; test 13c rewritten behaviorally; APPDATA branch exercised via injected home).

Accepted-as-documented (recorded here, not fixed): the Low list items that are hardening-margin only — unbounded `upstream.duplicates` vs MAX_YAML_BYTES (mitigated by cap M6 + doctor visibility), non-string project_root -32603 vs -32602 nuance, UTC/local log-pruning mismatch, Hermes `sameEntry` ignoring `enabled`, saveKnownProjects fsync, cross-project merge existence oracle (by design), design-doc wording nits, English-only injection denylist residual risk (design-acknowledged). Each stays visible in the review report; reopening any is a one-ticket follow-up.

## T-20261002-012 (Gemini SessionStart hook)

Proceeds only if the vendor doc check passes (Gemini CLI hooks semantics equivalent to the Claude Code SessionStart contract). Otherwise the ticket moves to `waiting` with the open question recorded — never implemented against unverified vendor behavior.

## T-20261001-020 (real-hardware verification)

Not autonomously executable (requires a real Windows machine, a real Gemini CLI install, and interactive client restarts). Moved to `waiting` with the blocker recorded; scope unchanged.

## Verification

Per PR: `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`, `bun scripts/verify-scripts.ts --verify`, `bun scripts/test-runner.ts unit` (or the repo's `bun test` battery), plus the targeted new tests. Final: fresh `workflow_dispatch` of the weekly health check stays green and the 3-OS CI matrix passes on every PR.
