# verify-prompt-integrity.ts Script Lifecycle

## Metadata

- **Script**: verify-prompt-integrity (scripts/verify-prompt-integrity.ts)
- **Status**: active
- **Version**: 1.0.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-20
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort — created 2026-11-20 with the current entry; full version detail lives in the SCRIPTS.md registry row.

## Created

2026-11-20

## Description

Prompt-integrity verifier of record for the unified 03:00 batch runner (T-20261120-002; reopens the T-20261112-003 false closure; design `docs/designs/2026-11-20-runner-hardening-integrity-design.md` §T-20261120-002; DEC-20261120-04; ADR-0105 §Prompt-Integrity; AC-15). Hashes the LIVE automation prompt bytes out of `~/.zcode/v2/tasks-index.sqlite` table `automations` via bun:sqlite READ-ONLY (`SELECT prompt … WHERE automation_id = ?`, plus a `SELECT 1 … LIMIT 1` self-test) and reconciles against `prompts.manifest.json`. NEVER shells out to the sqlite3 CLI — its read path is not byte-faithful (21,967 chars vs 22,153 bytes; different sha256 — measured 2026-11-20, design V3). Verdict classes: match / unratified-live-edit / drift-both / stale-snapshot (WARN only) / missing-automation / cannot-verify (never a pass). Alert side effects: exit 1, `.pipeline-state/prompt-integrity-alert-<date>.json` (both hashes + hunk summary), one `prompt-integrity ALERT:` line in the day memory log, urgent governance ticket via `ticket.ts create --manual` (unless `--no-ticket`; duplicate-title refusal tolerated as already-filed). Clean runs append the AC-15 contract line `prompt integrity verify: N/N match`. `--exec-closure` requires every `bun scripts/*.ts` the live prompt names to sit inside `docs/protected-paths.json` protectedPaths[] ∪ `docs/runner-exec-allowlist.json` (design §T-20261119-006 adjacency). `--gate` is the runner STEP 0 pre-fire wrapper (defense-in-depth; implies `--no-ticket`). Control run is OUT-OF-PROCESS: host launchd job `ai.workspace.prompt-integrity-verify.plist` daily 06:00 KST (tracked plist copy + install notes under `docs/governance/automation-prompts/`; ZCode-automation fallback documented). Store schema is app-owned, kept in one constant block; drift fails the self-test → cannot-verify alert (visible, never a silent pass). The store is LIVE operator state — read-only, never written. L0-only, never propagated. Unit-pinned by `tests/unit/verify-prompt-integrity.test.ts`.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-11-20 | production | production | v1.0.0 (T-20261120-002; runner-hardening PR-2; design §T-20261120-002): initial release — closes the T-20261112-003 false closure (nothing hashed the LIVE prompt while the store text ran 5 hunks ahead of the ratified v4 snapshot for 8 days). First armed run against the live store reported 1/1 match after the PR-1 v5 ratification (manifest sha256 c91eeb1cad1e…, 22,153 bytes). | automation-engineer |
