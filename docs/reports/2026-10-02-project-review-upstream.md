# Project Review — ai-workspace-upstream (MCP upstream-request feature) — 2026-10-02

**Date**: 2026-10-02
**Scope**: scoped — upstream MCP server, installer, ticket triage/resolve, template contract, governance docs
**Method**: 4 parallel read-only agents (architecture, standards+lifecycle, automation, security+docs) + machine battery

> Analysis only — no files modified in this report (apart from this report and the tickets listed under Action wiring).

## Baseline

`bun scripts/review-baseline.ts`: **6/6 green**. The L1/L2 drift check exits 1 by design: documented tolerated drift — tolerated 6, unexpected 0. The three unit test files ran 73 + 14 + 12 = 99 pass / 0 fail, isolated, and run in the 3-OS CI matrix.

Findings marked **[PM-verified]** were re-verified directly by the PM (H1, H2, M1, M2, M4, M6, M7 partly, M11 partly).

## Critical

None.

## High

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 [PM-verified] | §3.12 tells the PM to hand-edit: step 3 reject = `move <U-id> done --result ...` fails because `backlog: ['waiting']` (needs --force); step 8 repeats a transition `ticket.ts resolve` already walks. Neither §3.12 nor agents/pm.md mentions `ticket.ts triage\|resolve\|--confirm-reviewed` (grep = 0 hits) although T-20261001-016 is `done` with result "3.12 rewritten". | architect, auditor, security | docs/governance/agents/pm-gateway-workflow.md ~83, ~91 (+ templates/common copy); scripts/helpers/ticket-schema.ts:103 | systemic + script-gap | Rewrite steps 3 and 8 around `ticket.ts triage <id> ready\|inbox [--confirm-reviewed]` and `ticket.ts resolve <id> --outcome ... --summary ...` in L0 + templates/common; add both commands to agents/pm.md; add a doc-command lint. |
| H2 [PM-verified] | `setUpstreamResolution` writes upstream.resolution before the status walk; a mid-walk failure leaves a resolution with status < done and the retry guard refuses re-resolution (only --force recovers). `setUpstreamTriage` writes triage before `moveTicket`: promoting a `review` ticket to ready throws after the write leaving triage:ready/status:review; `triage inbox` on a `done` ticket force-moves done->backlog, silently reopening a closed request. | architect, automation | scripts/helpers/ticket-store.ts:314-326, 288-296 | one-time | Check `canTransition` before any write, write once (or make the walk resumable), refuse inbox on done. |
| H3 | Self-declared `project_root` lets any caller (GUI fallback cwd=/) act as any Projects/co-* project. create is forced flagged (identity:self_declared) but consumes the victim project's caps; status has no flag and no audit line and returns another project's ticket ids/triage/resolution (summary, PR URL), contradicting the design's "status returns no other project's content". | automation, security | scripts/mcp-upstream-server.ts:471-480 (create), 615-621 (status) | systemic | Audit-log status calls with identity:declared; redact resolution (ids+status only) for declared identity or require a client-supplied root/allowlist; document as trust-boundary downgrade in design §6. |
| H4 | PM CLI and server merge read-modify-write the same ticket file under different or no locks (merge: `loadUpstreamTickets` -> `writeYamlAtomic` under `.intake-lock` in LOGS_DIR; `setUpstreamTriage`/`setUpstreamResolution`/`writeTicketAtomic` take no lock) => lost updates (reverted triage, dropped duplicates entry, lost resolution). No test. | automation, security | scripts/mcp-upstream-server.ts:516-521; scripts/helpers/ticket-store.ts | systemic | Shared ticket lock, or re-read + mtime compare before rename. |
| H5 | `backupAndWrite`: `writeFileSync(tmp)` with no mode then `renameSync`: loses original file mode (umask default; `~/.claude.json` can hold OAuth/env secrets; currently 0644 so no widening observed), replaces a symlinked config with a regular file, read-modify-write race with a running client, `.bak-<ts>` plaintext backups accumulate unbounded. | automation, security | scripts/install-upstream-mcp.ts:72-83 | systemic | Stat original mode and apply, `realpathSync` target, backups 0600 with last-N pruning, mtime re-check before rename. |

## Moderate

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 [PM-verified] | Header `@version 1.5.0` vs `serverInfo.version '1.4.0'`; test only checks SCRIPTS.md row vs header. | standards | mcp-upstream-server.ts:2, 670 | script-gap | Single constant + test. |
| M2 [PM-verified] | `validateTicket` does not check triage<->status consistency (inbox => backlog\|done; ready => waiting\|review\|done), done => resolution present, resolution.summary required, pr_url https / template_version string types, upstream.project matching `^co-[a-z0-9-]{1,40}$`. Real instance: tickets/governance/U-20261001-001.yaml is status done with `upstream.triage: inbox` and no resolution.template_version (hand-edited before `ticket.ts resolve` existed). | standards | scripts/helpers/ticket-schema.ts:218-235 | script-gap | Add the invariants and format checks to `validateTicket`. |
| M3 | `validate-surface-registry.ts` never compares installer `ALL_TARGETS` / adapters with CONSTITUTION §11.0 and the templates/common/docs/context.md "Machine-global MCP config" column. No divergence today (6 targets cover 8 surfaces + legacy gemini) but nothing guards it. | standards | scripts/validate-surface-registry.ts; install-upstream-mcp.ts ~42-43 | script-gap | Add the comparison. |
| M4 [PM-verified] | `dryRun` only when `--dry-run` is passed, so a bare run writes to all detected clients; `parseTargets` turns a trailing `--target` with no value or a typo like `--dryrun` into a silent all-targets real write. | automation | install-upstream-mcp.ts ~359-362, ~296-309 | script-gap | Require --apply or confirm; reject unknown flags and valueless --target. |
| M5 | Intake lock fails open after 5 s (default) and stale takeover is racy (two waiters can both rm a stale lock; finally `rmSync` removes another process's lock) => caps and first-request gate can be double-spent. Tests cover only stale takeover, deadline-0 fail-open and retention; no parallel-instances test, so T-20261001-017 "races handled" is only partly evidenced. | automation, security | mcp-upstream-server.ts:336-376; tests/unit/mcp-upstream-server.test.ts:1299-1330 | systemic | Owner token in lock, fail closed with retryable -32000 for accept/merge, add N-parallel create test against hard cap 3. |
| M6 [PM-verified] | Reject paths call `appendAuditLog` outside the lock with no cap; `readTodayAudit` re-parses the whole day file on every accept => unbounded log growth and slowdown by any caller looping invalid calls. | security | mcp-upstream-server.ts:484, 491, 321-330 | systemic | Cap/rate-limit reject-path audit writes; avoid full re-parse. |
| M7 [PM-verified, partly] | First-request gate records the project in known-projects.json when a ticket is first accepted regardless of PM disposition; design C8 intends a trust-building gate. A project whose first ticket the PM rejects can still auto-ready its second request. | security | mcp-upstream-server.ts:600-603 | systemic | Mark trusted on PM triage/fixed, or document. |
| M8 | templates/common §3.12 (76+) and templates/common/agents/pm.md:108-112 ("Handling an upstream ticket body (workspace PM)") reference L0-only scripts (`ticket.ts list --upstream`, `scripts/mcp-upstream-server.ts`, `scripts/propagation-map.json`) that do not exist in templates/common/scripts => dead procedures shipped to every project. | docs | templates/common/docs/governance/agents/pm-gateway-workflow.md:76+; templates/common/agents/pm.md:108-112 | systemic | Replace with a pointer to the project-side Upstream Reporting Duty, or mark L0-only. |
| M9 | Antigravity CLI path `~/.gemini/antigravity-cli/mcp_config.json` (design Appendix B ~451, ADR-0097:37) is not covered by the installer (`.gemini/config/mcp_config.json` at install-upstream-mcp.ts ~190) and docs/surface-gaps.json has no entry (ADR-0097 rule 1); CONSTITUTION §11.0 row 4 still says "(shared with #3)". Also Codex `--force` (install-upstream-mcp.ts:244-246) removes then adds: if add fails the old registration is lost. | architect | install-upstream-mcp.ts ~190, 244-246 | systemic / one-time | Cover or record the gap; make Codex force add-then-remove or restore on failure. |
| M10 | Resolution walk goes through runner-only `running` for kind: manual (design §5.1 maps investigation to review reached from waiting; TRANSITIONS.waiting allows review). `ticket.ts list` shows only a flag suffix; design §9 L3/§12.1 require a `[FLAGGED]` prefix, flagged-first sorting, triage and inbox/ready counts. | architect | ticket-store.ts:319; scripts/ticket.ts:172-175 | one-time | Align walk and list output with the design. |
| M11 [PM-verified, partly] | MCP protocol handling: no `ping` handler (returns -32601 at ~739-741; confirmed absent from file); tool-level failures returned as JSON-RPC errors rather than `result.isError:true` (~485, 714, 735) so hint text may not reach the agent; invalid JSON / non-object / missing jsonrpc / batch / id:null get no -32700/-32600 handling; no stdin line-size cap before the 16 KB check. Tests pin current behavior. | automation | mcp-upstream-server.ts ~485, 714, 735, 739-741 | one-time / systemic | Add ping, isError results, envelope validation, line cap. |
| M12 | Phase 3 of the design is not implemented: audit-hash immutability check (§5.2; stored `request_sha256` hashes `JSON.stringify(req)` which includes project_root never stored in the ticket, so it cannot be recomputed from the ticket), LOCAL-PATCH report in upgrade-project; docs/specs/registry.json:1804-1811 lists the design as "implemented" while its header (design line 4) says "Approved". T-20261001-017 and -016 marked done with partially evidenced claims (see H1, M5). | standards | docs/specs/registry.json:1804-1811 | systemic / one-time | Implement or correct status; re-open evidence claims. |
| M13 | tests/unit/mcp-upstream-server.test.ts:1258 test 13c asserts a source regex, would pass on broken logic; no tests for BOM/anchors/quoted keys/empty file/mixed EOL in mcp-config-edit.ts (also mishandles: BOM or quoted `"mcp_servers":` => misleading duplicate-key error; empty file throws before null guard; mixed EOL normalized to CRLF); installer codex test is skipIf(IS_WIN); Windows APPDATA branch untested on any OS. | automation | tests/unit/mcp-upstream-server.test.ts:1258; mcp-config-edit.ts | one-time | Add behavioral tests and fix edge cases. |

## Low

- ticket-store.ts `MAX_YAML_BYTES` 64 KB vs unbounded `upstream.duplicates` growth => ticket may become unreadable by ticket.ts.
- mcp-upstream-server.ts:425 non-string `project_root` yields -32603 not -32602; relative `project_root` accepted (docs say absolute).
- mcp-upstream-server.ts:516 failed or already-resolved tickets still receive merges.
- Log pruning compares UTC midnight (line 392) while daily file names use local time (296); ticket-store `today()` is UTC.
- Installer `--force` drops user fields (env, timeout, disabled); Hermes `sameEntry` ignores `enabled`.
- `saveKnownProjects` no fsync; corrupt known-projects.json treated as empty (fails safe to inbox); temp file leaks if `writeFileSync` throws before `linkSync` (~588).
- Windows: `resolveProject` startsWith is case-sensitive/8.3 untested; `Bun.which('codex')` may return .cmd which `spawnSync` cannot run.
- Cross-project merge is an existence oracle (merged:true, no id); merges skip the soft cap and first-request gate.
- Design doc self-contradictions: line 55 "cwd -> git root" vs §6 "Git is never consulted"; D1 line ~418 still says .claude/template-version.txt; §5.1 outcome `failed` not in §5.2 enum / ticket-schema; §4.1/4.2 lack project_root and 3-4 digit ids; ADR-0097:34 says "three" Codex subcommands but lists two; templates pm.md duty lacks the project_root fallback line; L0 agents/pm.md changed 2026-10-01 without a version bump (unverified); design says flagged tickets get [FLAGGED] (see M10).
- Server header says "zero dependencies" but imports js-yaml; written files/logs use default modes 0644/0755.
- Injection heuristics are an English-only denylist (design acknowledges residual risk); opening-tag attributes and Reasons/Affected paths lines in ticket.ts rendering are unescaped but regex-constrained (add a test that keeps them constrained).

## Strengths

- Input sanitization: Unicode Cf/Cc/Co/Cs/Cn/tag-char stripping before validation, NFKC heuristics, ALLOWED_KEYS rejection, 16 KB cap, JSON_SCHEMA YAML dump/load, so requester text can never set kind/status/command/triage/resolution.
- Git-free filesystem identity with symlink/.git-dir/nested-repo/worktree rejection; atomic id allocation via `linkSync`+EEXIST; uniform not-found answers for missing vs foreign ids.
- ticket.ts boundary-tag escaping incl. bracket lookalikes and corrupt-ticket raw-YAML fallback, tested via real CLI spawn.
- Installer refuses unparseable configs, is idempotent, only deletes its own key, uses `spawnSync` argv (no shell), has test seams (UPSTREAM_INSTALL_HOME, UPSTREAM_WORKSPACE_ROOT); Hermes edit verified by YAML-parse equivalence.
- Per-script versions in code, SCRIPTS.md and CHANGELOG are in step; `validate-surface-registry.ts --strict` passes (all 8 surfaces covered).
- T-018 validator is real and gated in audit.ts; T-019 handled honestly; T-020 honestly left in backlog.
- No secrets found, logs/ gitignored, no CI/hook permission concerns.

## Domain summary

- **Architecture**: sound core design; H2 (write-before-validate ordering) and H4 (split locking) are the structural weaknesses; M9/M10/M12 are design-vs-implementation gaps.
- **Standards + lifecycle**: H1 is the main gap — the governance procedure does not match the shipped CLI; version and schema checks are missing (M1, M2, M3).
- **Automation**: server and installer are robust on input handling but weak on concurrency and file-write hygiene (H4, H5, M4, M5, M11).
- **Security + docs**: identity is self-declared in the GUI fallback (H3); audit-log growth (M6) and trust-gate semantics (M7) need decisions; no secrets exposure.

## Action wiring

| Ticket | Priority | Findings |
|--------|----------|----------|
| T-20261002-002 | high | H1 |
| T-20261002-003 | high | H2 |
| T-20261002-004 | high | H3 |
| T-20261002-005 | normal | H4 |
| T-20261002-006 | normal | H5, M4 (script-gap) |
| T-20261002-007 | normal | M2 — validator-hardening (script-gap) |
| T-20261002-008 | normal | M1, H1 doc-command lint — validator-hardening (script-gap) |
| T-20261002-009 | normal | M3 — validator-hardening (script-gap) |
| T-20261002-010 | normal | M5-M13 and the Low list |

The three validator-hardening tickets (T-20261002-007, -008, -009) cover the script-gap findings M2, M1 and M3; M4, also a script-gap, is covered by T-20261002-006.
